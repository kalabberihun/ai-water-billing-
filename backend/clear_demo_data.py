"""
Cleanup script to remove all demo/test data from the database.
Keeps: Admin accounts, TariffTier config, Meter records (unlinked).
Removes: Bills, Payments, Disputes, MeterReadings, WaterAlerts, demo customers.

Usage:
    cd backend
    venv\\Scripts\\python.exe manage.py shell < clear_demo_data.py
"""
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.billing.models import Bill, Payment, Dispute, TariffTier, WaterAlert
from apps.metering.models import MeterReading, Meter
from apps.accounts.models import Customer

User = get_user_model()

print("=" * 60)
print("  AI Water Billing - Demo Data Cleanup")
print("=" * 60)

# 1. Delete Payments
count = Payment.objects.all().count()
Payment.objects.all().delete()
print(f"[OK] Deleted {count} Payment(s)")

# 2. Delete Disputes
count = Dispute.objects.all().count()
Dispute.objects.all().delete()
print(f"[OK] Deleted {count} Dispute(s)")

# 3. Delete Bills
count = Bill.objects.all().count()
Bill.objects.all().delete()
print(f"[OK] Deleted {count} Bill(s)")

# 4. Delete Water Alerts
count = WaterAlert.objects.all().count()
WaterAlert.objects.all().delete()
print(f"[OK] Deleted {count} WaterAlert(s)")

# 5. Delete Meter Readings
count = MeterReading.objects.all().count()
MeterReading.objects.all().delete()
print(f"[OK] Deleted {count} MeterReading(s)")

# 6. Unlink meters from demo customers (keep meters for real use)
Meter.objects.filter(customer__isnull=False).update(customer=None)
print(f"[OK] Unlinked all meters from customers")

# 7. Delete demo customer profiles and users
# Keep admin accounts
admin_emails = ['testuser@example.com', 'kalblackfx@gmail.com']
demo_customers = Customer.objects.exclude(user__email__in=admin_emails)
demo_customer_count = demo_customers.count()

# Get user IDs before deleting customers
demo_user_ids = list(demo_customers.values_list('user_id', flat=True))
demo_customers.delete()
print(f"[OK] Deleted {demo_customer_count} demo Customer profile(s)")

# Delete the non-admin users that had customer profiles
demo_users = User.objects.filter(id__in=demo_user_ids)
demo_user_count = demo_users.count()
demo_users.delete()
print(f"[OK] Deleted {demo_user_count} demo User account(s)")

# 8. Summary
print()
print("-" * 60)
print("  Remaining data:")
print(f"  Users:        {User.objects.count()}")
print(f"  Customers:    {Customer.objects.count()}")
print(f"  Meters:       {Meter.objects.count()}")
print(f"  TariffTiers:  {TariffTier.objects.count()}")
print(f"  Bills:        {Bill.objects.count()}")
print(f"  Payments:     {Payment.objects.count()}")
print("-" * 60)
print("[OK] Cleanup complete! Database is ready for production use.")
