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

TASK: Analyze the provided image and:
1. Locate the main mechanical or digital counter display showing cumulative consumption.
2. Extract the exact 5 digits on the main register, including leading zeros (e.g. "00109").
3. Search EVERYWHERE on the meter — the face, casing, brass rim, outer edge, engraved text — for ALL serial numbers, IDs, and numeric codes you can find. Return them as a list.

RULES:
1. Every meter has exactly 5 digits on the main register. Do NOT skip any leading zeros.
2. The "detected_ids" list should contain ALL numbers/serials found on the meter body, casing, and rim — NOT the reading digits.
3. If the image is too blurry, dark, or does not contain a water meter, return confidence 0.

Return ONLY a valid JSON object:
{
  "digits": "<5-digit string>",
  "detected_ids": ["<serial1>", "<serial2>", ...],
  "confidence": <float 0-1>
}
"""


def check_meter_id_match(expected_id, detected_ids):
    """
    Check if the expected meter ID matches any of the detected IDs.
    Uses case-insensitive substring matching.
    Returns True if any match is found.
    """
    if not expected_id or not detected_ids:
        return False
    expected_clean = expected_id.strip().lower()
    for detected in detected_ids:
        detected_clean = str(detected).strip().lower()
        if not detected_clean or detected_clean == 'null':
            continue
        # Exact match
        if expected_clean == detected_clean:
            return True
        # Substring match: expected is contained in detected (e.g. expected is "666702191" and detected is "sn-666702191")
        if len(expected_clean) >= 4 and expected_clean in detected_clean:
            return True
        # Substring match: detected is contained in expected (e.g. expected is "MTR-00001" and detected is "00001")
        # To avoid false positive on single/double digit noise (e.g. "1", "16", "50", "1.5"),
        # we require the detected ID to have a length of at least 4 characters.
        if len(detected_clean) >= 4 and detected_clean in expected_clean:
            return True
    return False


def _parse_ocr_result(raw_text):
    """Parse JSON digits, detected_ids list, and confidence from AI response text."""
    import re
    try:
        text = raw_text.strip()
        data = None
        
        # Try direct JSON parse first
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown fences
        if data is None and '```' in text:
            code_block = text.split('```')[1]
            if code_block.startswith('json'):
                code_block = code_block[4:]
            code_block = code_block.strip()
            try:
                data = json.loads(code_block)
            except json.JSONDecodeError:
                pass

        # Try regex extraction
        if data is None:
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
        
        if data and 'digits' in data:
            detected_ids = data.get('detected_ids', [])
            # Normalize: if AI returned a single string instead of list
            if isinstance(detected_ids, str):
                detected_ids = [detected_ids] if detected_ids else []
            # Also accept legacy fields if present
            legacy_id = data.get('meter_id_detected')
            if legacy_id and legacy_id != 'null' and str(legacy_id) not in [str(d) for d in detected_ids]:
                detected_ids.append(str(legacy_id))
                
            return (
                str(data['digits']),
                [str(d) for d in detected_ids if d],
                float(data.get('confidence', 0.5))
            )
            
        # Fallback regex search for digits
        digits_match = re.search(r'"digits"\s*:\s*"([0-9]{5})"', text)
        if not digits_match:
            digits_match = re.search(r'\b([0-9]{5})\b', text)
            
        if digits_match:
            digits_val = digits_match.group(1)
            conf_match = re.search(r'"confidence"\s*:\s*([\d.]+)', text)
            return (
                digits_val,
                [],
                float(conf_match.group(1)) if conf_match else 0.5
            )
            
        raise ValueError(f"No valid digits found in AI response: {text[:200]}")
    except Exception as e:
        logger.warning(f"Failed to parse OCR response: {raw_text[:200]}, err: {e}")
        raise ValueError(f"Failed to parse OCR response: {str(e)}")


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


def extract_reading_gemini(image_url, expected_meter_number=None):
    """Extract digits and detected IDs using Gemini (primary) with Groq fallback."""
    img, img_bytes = _load_image(image_url)
    
    prompt = OCR_PROMPT

    # --- Try Gemini models first ---
    if getattr(settings, 'GEMINI_API_KEY', None):
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        for model_name in ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[img, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )
                digits, detected_ids, confidence = _parse_ocr_result(response.text)
                logger.info(f"OCR success via {model_name}: digits={digits}, detected_ids={detected_ids}, confidence={confidence}")
                return digits, detected_ids, confidence
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
            
            system_msg = 'You are a water meter OCR reader. Respond with ONLY JSON: {"digits": "<5-digit string>", "detected_ids": ["<serial1>", ...], "confidence": <float 0-1>}'

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
                            'content': system_msg
                        },
                        {
                            'role': 'user',
                            'content': [
                                {'type': 'image_url', 'image_url': {'url': f'data:{content_type};base64,{b64_image}'}},
                                {'type': 'text', 'text': prompt}
                            ]
                        }
                    ],
                    'response_format': {'type': 'json_object'},
                    'max_tokens': 200,
                    'temperature': 0.0,
                },
                timeout=45,
            )

            if res.status_code == 200:
                text = res.json()['choices'][0]['message']['content'].strip()
                digits, detected_ids, confidence = _parse_ocr_result(text)
                logger.info(f"OCR success via Groq: digits={digits}, detected_ids={detected_ids}, confidence={confidence}")
                return digits, detected_ids, confidence
            else:
                logger.error(f"Groq OCR error {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.error(f"Groq OCR failed: {e}")

    raise ValueError("All AI models failed for OCR extraction")


def calculate_reading_value(digits_str):
    # Strip any whitespace
    digits_str = "".join(digits_str.split())
    if len(digits_str) != 5 or not digits_str.isdigit():
        raise ValueError(f"Reading must be exactly 5 digits: '{digits_str}'")
    
    d1, d2, d3, d4, d5 = digits_str[0], digits_str[1], digits_str[2], digits_str[3], digits_str[4]
    if d1 == '0' and d2 == '0':
        whole = int(d3 + d4)
        decimal = int(d5)
    else:
        whole = int(d1 + d2 + d3 + d4)
        decimal = int(d5)
    return float(f"{whole}.{decimal}")


@shared_task(bind=True, max_retries=3, soft_time_limit=250)
def process_ocr(self, reading_id):
    try:
        reading = MeterReading.objects.get(id=reading_id)
        
        # Update status to processing
        reading.status = 'PROCESSING'
        reading.save()
        
        # OCR Extraction via Gemini / Groq
        digits, detected_ids, confidence = extract_reading_gemini(reading.image_url)

        should_generate_bill = False
        if digits is not None and confidence > 0.70:
            try:
                parsed_val = calculate_reading_value(digits)
                reading.reading_value = parsed_val
                reading.ocr_confidence = confidence
                
                if confidence >= 0.885:
                    reading.status = 'VERIFIED'
                    should_generate_bill = True
                else:
                    reading.status = 'MANUAL_REVIEW'
                    reading.notes = 'Low OCR confidence. Please review manually.'
            except ValueError as val_err:
                reading.status = 'MANUAL_REVIEW'
                reading.ocr_confidence = confidence
                reading.notes = f'Failed to parse 5 digits: {val_err}'
        else:
            reading.status = 'MANUAL_REVIEW'
            reading.notes = 'Low OCR confidence or no digits detected by Gemini 2.5 Flash'
            
        reading.processed_at = timezone.now()
        reading.save()
        
        if should_generate_bill:
            # Auto-generate bill for high confidence readings
            from apps.billing.tasks import generate_bill
            try:
                generate_bill.delay(str(reading_id))
            except Exception:
                # Fallback if Celery isn't running
                try:
                    generate_bill(str(reading_id))
                except Exception as fb_err:
                    print(f"Fallback bill generation failed: {fb_err}")
        
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
