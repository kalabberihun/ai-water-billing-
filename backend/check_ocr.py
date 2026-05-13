import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from apps.metering.models import MeterReading

# Show recent readings
readings = MeterReading.objects.order_by('-submitted_at')[:5]
if not readings:
    print("No readings found in the database.")
    sys.exit()

for r in readings:
    print(f"ID: {str(r.id)[:8]}  Status: {r.status}  Value: {r.reading_value}  Image: {r.image_url}  Notes: {r.notes}")

# Try processing the most recent PENDING/PROCESSING one
pending = MeterReading.objects.filter(status__in=['PENDING', 'PROCESSING']).order_by('-submitted_at').first()
if pending:
    print(f"\n--- Attempting OCR on reading {str(pending.id)[:8]} ---")
    print(f"Image URL: {pending.image_url}")
    
    try:
        from apps.metering.tasks import extract_reading_gemini
        result, confidence = extract_reading_gemini(pending.image_url)
        print(f"SUCCESS! Reading: {result}, Confidence: {confidence}")
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
else:
    print("\nNo pending readings to test OCR on.")
