import os
import json
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

def extract_reading_gemini(image_url):
    """Extract digits using Google Gemini Vision API"""
    if not getattr(settings, 'GEMINI_API_KEY', None):
        raise ValueError("GEMINI_API_KEY is not configured in settings.")
        
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Load image
    if image_url.startswith('http'):
        response = requests.get(image_url, timeout=30)
        img = Image.open(BytesIO(response.content))
    else:
        # Convert local media URL to absolute file path
        # e.g., /media/meter_readings/1/image.jpg -> C:\...\media\meter_readings\1\image.jpg
        relative_path = image_url.lstrip('/')
        # Replace forward slashes with OS-specific separator just in case
        relative_path = relative_path.replace('/', os.sep)
        full_path = os.path.join(settings.BASE_DIR, relative_path)
        img = Image.open(full_path)
            
    prompt = """
    You are an expert AI trained to read water meters. 
    Analyze the provided image of a water meter and extract the main consumption reading (the numbers).
    Ignore serial numbers, barcodes, or model numbers. Focus ONLY on the actual consumption digits (often in a prominent row or counter).
    Return your answer in strictly formatted JSON without any other text:
    {"reading": 1234.5, "confidence": 0.95}
    If you cannot read the meter at all, return a confidence of 0 and reading of 0.
    """
    
    response = client.models.generate_content(
        model='gemini-flash-latest',
        contents=[img, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )
    
    try:
        data = json.loads(response.text)
        reading = float(data.get('reading', 0))
        confidence = float(data.get('confidence', 0))
        return reading, confidence
    except Exception as e:
        raise ValueError(f"Failed to parse Gemini response: {response.text}") from e

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
                    generate_bill(None, str(reading_id))
            else:
                reading.status = 'MANUAL_REVIEW'
        else:
            reading.status = 'MANUAL_REVIEW'
            reading.notes = 'Low OCR confidence or no digits detected by Gemini'
            
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
