import os
import json
import base64
import logging
import requests
from io import BytesIO
from PIL import Image
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.utils import timezone
from google import genai
from google.genai import types

from .models import MeterReading

logger = logging.getLogger(__name__)

GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

OCR_PROMPT = """
You are an expert AI specialized in reading water meters with high precision.

TASK: Analyze the provided image and extract the main water consumption reading.

RULES:
1. Focus ONLY on the mechanical or digital counter display showing cumulative consumption (cubic meters or gallons).
2. Read ALL visible digits on the main register, including leading zeros if they are part of the counter.
3. If the meter has a decimal/fractional portion (usually in red or a smaller dial), include it after a decimal point.
4. IGNORE: serial numbers, barcodes, QR codes, model/brand text, calibration marks, and flow-rate indicators.
5. If digits are partially obscured but can be reasonably inferred from context, include them with slightly lower confidence.
6. If the image is too blurry, dark, or does not contain a water meter, return confidence 0.

Return ONLY valid JSON:
{"reading": <number>, "confidence": <float 0-1>}
"""


def _load_image(image_url):
    """Load image from URL or local path, return PIL Image and raw bytes."""
    if image_url.startswith('http'):
        response = requests.get(image_url, timeout=30)
        img = Image.open(BytesIO(response.content))
        img_bytes = response.content
    else:
        relative_path = image_url.lstrip('/')
        relative_path = relative_path.replace('/', os.sep)
        full_path = os.path.join(settings.BASE_DIR, relative_path)
        img = Image.open(full_path)
        buf = BytesIO()
        img.save(buf, format=img.format or 'JPEG')
        img_bytes = buf.getvalue()
    return img, img_bytes


def _parse_ocr_result(text):
    """Parse JSON reading from AI response text."""
    import re
    text = text.strip()
    # Try direct JSON
    try:
        data = json.loads(text)
        if 'reading' in data:
            return float(data['reading']), float(data.get('confidence', 0))
    except json.JSONDecodeError:
        pass
    # Try markdown fences
    if '```' in text:
        code = text.split('```')[1]
        if code.startswith('json'):
            code = code[4:]
        try:
            data = json.loads(code.strip())
            return float(data['reading']), float(data.get('confidence', 0))
        except (json.JSONDecodeError, KeyError):
            pass
    # Try regex
    match = re.search(r'\{[^{}]*"reading"\s*:\s*[\d.]+[^{}]*\}', text)
    if match:
        try:
            data = json.loads(match.group())
            return float(data['reading']), float(data.get('confidence', 0))
        except (json.JSONDecodeError, KeyError):
            pass
    raise ValueError(f"Failed to parse OCR response: {text[:200]}")


def extract_reading_gemini(image_url):
    """Extract digits using Gemini (primary) with Groq fallback."""
    img, img_bytes = _load_image(image_url)

    # --- Try Gemini models first ---
    if getattr(settings, 'GEMINI_API_KEY', None):
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        for model_name in ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[img, OCR_PROMPT],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )
                reading, confidence = _parse_ocr_result(response.text)
                logger.info(f"OCR success via {model_name}: reading={reading}, confidence={confidence}")
                return reading, confidence
            except Exception as e:
                if '429' in str(e) or 'RESOURCE_EXHAUSTED' in str(e):
                    logger.warning(f"Rate limited on {model_name}, trying next...")
                    continue
                logger.error(f"Gemini {model_name} error: {e}")
                continue

    # --- Fallback to Groq ---
    groq_key = getattr(settings, 'GROQ_API_KEY', '')
    if groq_key:
        try:
            b64_image = base64.b64encode(img_bytes).decode('utf-8')
            content_type = 'image/jpeg'

            res = requests.post(
                GROQ_CHAT_URL,
                headers={
                    'Authorization': f'Bearer {groq_key}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': 'meta-llama/llama-4-scout-17b-16e-instruct',
                    'messages': [
                        {
                            'role': 'system',
                            'content': 'You are a water meter OCR reader. Respond with ONLY JSON: {"reading": <number>, "confidence": <float 0-1>}'
                        },
                        {
                            'role': 'user',
                            'content': [
                                {'type': 'image_url', 'image_url': {'url': f'data:{content_type};base64,{b64_image}'}},
                                {'type': 'text', 'text': 'Read the water meter. Return ONLY JSON: {"reading": <number>, "confidence": <float 0-1>}'}
                            ]
                        }
                    ],
                    'max_tokens': 100,
                    'temperature': 0.0,
                },
                timeout=45,
            )

            if res.status_code == 200:
                text = res.json()['choices'][0]['message']['content'].strip()
                reading, confidence = _parse_ocr_result(text)
                logger.info(f"OCR success via Groq: reading={reading}, confidence={confidence}")
                return reading, confidence
            else:
                logger.error(f"Groq OCR error {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.error(f"Groq OCR failed: {e}")

    raise ValueError("All AI models failed for OCR extraction")

@shared_task(bind=True, max_retries=3, soft_time_limit=250)
def process_ocr(self, reading_id):
    try:
        reading = MeterReading.objects.get(id=reading_id)
        
        # Update status to processing
        reading.status = 'PROCESSING'
        reading.save()
        
        # OCR Extraction via Gemini
        result, confidence = extract_reading_gemini(reading.image_url)
        
        if result is not None and confidence > 0.70:
            reading.reading_value = result
            reading.ocr_confidence = confidence
            
            if confidence >= 0.885:
                reading.status = 'VERIFIED'
                reading.processed_at = timezone.now()
                
                # Auto-generate bill for high confidence readings
                from apps.billing.tasks import generate_bill
                try:
                    generate_bill.delay(str(reading_id))
                except Exception:
                    # Fallback if Celery isn't running
                    generate_bill.__wrapped__(None, str(reading_id))
            else:
                reading.status = 'MANUAL_REVIEW'
        else:
            reading.status = 'MANUAL_REVIEW'
            reading.notes = 'Low OCR confidence or no digits detected by Gemini 2.5 Flash'
            
        reading.processed_at = timezone.now()
        reading.save()
        
        return {
            'status': reading.status,
            'value': float(reading.reading_value) if reading.reading_value else None,
            'confidence': float(reading.ocr_confidence) if reading.ocr_confidence else 0.0
        }
        
    except SoftTimeLimitExceeded:
        reading.status = 'MANUAL_REVIEW'
        reading.notes = 'Processing timeout'
        reading.save()
        raise
        
    except Exception as exc:
        reading.status = 'MANUAL_REVIEW'
        reading.notes = f'Gemini Error: {str(exc)[:200]}'
        reading.save()
        print(f"OCR Exception: {exc}")
        
        # Retry logic
        if self.request.retries < 3:
            raise self.retry(countdown=60, exc=exc)
        raise


@shared_task
def reassign_expired_reviews():
    from datetime import timedelta
    from django.utils import timezone
    from apps.metering.models import MeterReading
    from apps.accounts.models import User
    from utils.email import send_html_email
    
    cutoff = timezone.now() - timedelta(hours=1)
    expired = MeterReading.objects.filter(status='MANUAL_REVIEW', assigned_at__lt=cutoff).exclude(assigned_to__isnull=True)
    
    if not expired.exists():
        return "No expired reviews"
        
    clerks = list(User.objects.filter(role__name__iexact='CLERK'))
    if not clerks:
        expired.update(assigned_to=None, assigned_at=None)
        return "Unassigned expired reviews (no clerk found)"
        
    import random
    reassigned = 0
    for r in expired:
        old_clerk = r.assigned_to
        available_clerks = [c for c in clerks if c != old_clerk] or clerks
        new_clerk = random.choice(available_clerks)
        
        r.assigned_to = new_clerk
        r.assigned_at = timezone.now()
        r.save()
        reassigned += 1
        
        from apps.accounts.models import SystemNotification
        
        SystemNotification.objects.create(
            user=new_clerk,
            alert_type='TASK',
            message='A manual review has been reassigned to you due to expiration. Please check your dashboard.'
        )
        
        try:
            send_html_email(
                subject='Reassigned Meter Reading Review',
                template_name='emails/task_assigned.html',
                context={
                    'name': new_clerk.first_name or 'Clerk',
                    'task_type': 'meter reading review',
                    'meter_number': r.meter.meter_number,
                    'message': 'A manual review has been reassigned to you due to expiration. Please check your dashboard.'
                },
                recipient_list=[new_clerk.email],
                fail_silently=True,
            )
        except Exception:
            pass
            
    return f"Reassigned {reassigned} expiring reviews"

@shared_task
def reassign_expired_field_tasks():
    from datetime import timedelta
    from django.utils import timezone
    from apps.metering.models import MeterReading
    from apps.accounts.models import User
    from utils.email import send_html_email
    
    cutoff = timezone.now() - timedelta(hours=24)
    expired = MeterReading.objects.filter(status='FIELD_TASK', assigned_at__lt=cutoff).exclude(assigned_to__isnull=True)
    
    if not expired.exists():
        return "No expired field tasks"
        
    clerks = list(User.objects.filter(role__name__iexact='CLERK'))
    if not clerks:
        expired.update(assigned_to=None, assigned_at=None)
        return "Unassigned expired field tasks (no clerk found)"
        
    import random
    reassigned = 0
    for r in expired:
        old_clerk = r.assigned_to
        available_clerks = [c for c in clerks if c != old_clerk] or clerks
        new_clerk = random.choice(available_clerks)
        
        r.assigned_to = new_clerk
        r.assigned_at = timezone.now()
        r.save()
        reassigned += 1
        
        from apps.accounts.models import SystemNotification
        
        SystemNotification.objects.create(
            user=new_clerk,
            alert_type='TASK',
            message=f'An expired field task for meter {r.meter.meter_number} has been reassigned to you. Please visit the location.'
        )
        
        try:
            send_html_email(
                subject='Reassigned Field Task',
                template_name='emails/task_assigned.html',
                context={
                    'name': new_clerk.first_name or 'Clerk',
                    'task_type': 'field check task',
                    'meter_number': r.meter.meter_number,
                    'message': f'An expired field task for meter {r.meter.meter_number} has been reassigned to you. Please visit the location.'
                },
                recipient_list=[new_clerk.email],
                fail_silently=True,
            )
        except Exception:
            pass
            
    return f"Reassigned {reassigned} expiring field tasks"

@shared_task
def delete_resolved_leakage_reports():
    from datetime import timedelta
    from django.utils import timezone
    from apps.metering.models import LeakageReport
    
    cutoff = timezone.now() - timedelta(hours=24)
    expired = LeakageReport.objects.filter(status='RESOLVED', updated_at__lt=cutoff)
    
    count = expired.count()
    if count > 0:
        expired.delete()
        return f"Deleted {count} resolved leakage reports older than 24 hours"
    return "No resolved leakage reports to delete"
