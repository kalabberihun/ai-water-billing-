import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from apps.billing.tasks import generate_bill
from apps.billing.models import Bill
from apps.metering.models import MeterReading

# Generate bills for unbilled verified readings
unbilled_ids = [
    '85fff8cd-c6e5-4361-b673-ffe1c0cd0acb',
    '7e292f2e-aa84-4a02-9f28-340e76dc1f25',
    'ada748f0-9a3b-4d74-9e79-ae40f55580a3',
]

for rid in unbilled_ids:
    r = MeterReading.objects.get(id=rid)
    print(f'Generating bill for reading {str(r.id)[:8]} (meter={r.meter.meter_number}, value={r.reading_value})...')
    result = generate_bill.run(str(r.id))
    print(f'  Result: {result}')
    print()

# Final state
print('=== All bills now ===')
for b in Bill.objects.all().order_by('-created_at'):
    date_str = b.created_at.strftime("%Y-%m-%d %H:%M")
    print(f'  {str(b.id)[:8]} | customer={b.customer.user.email} | consumption={b.consumption} | total={b.total_amount} | status={b.status} | created={date_str}')
