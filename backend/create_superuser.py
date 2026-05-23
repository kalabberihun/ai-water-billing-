import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.accounts.models import Role

# 1. Ensure system roles exist in the database
roles = ['CUSTOMER', 'CLERK', 'TECHNICIAN', 'ADMIN']
role_objects = {}
for role_name in roles:
    role_obj, created = Role.objects.get_or_create(name=role_name)
    role_objects[role_name] = role_obj
    if created:
        print(f"Role '{role_name}' created.")

# 2. Create the superuser
User = get_user_model()
admin_role = role_objects.get('ADMIN')

if not User.objects.filter(email='admin@example.com').exists():
    user = User.objects.create_superuser('admin@example.com', 'admin123')
    user.first_name = 'Admin'
    user.last_name = 'User'
    user.role = admin_role
    user.save()
    print("Superuser 'admin@example.com' with password 'admin123' and ADMIN role created successfully.")
else:
    user = User.objects.get(email='admin@example.com')
    updated = False
    if user.role != admin_role:
        user.role = admin_role
        updated = True
    if not user.is_staff:
        user.is_staff = True
        updated = True
    if not user.is_superuser:
        user.is_superuser = True
        updated = True
    if updated:
        user.save()
        print("Updated existing superuser 'admin@example.com' with correct ADMIN role, staff status, and superuser privileges.")
    else:
        print("Superuser 'admin@example.com' already exists and is configured correctly.")

# 3. Safely seed Tariff Tiers if database is empty
from apps.billing.models import TariffTier
from decimal import Decimal

if TariffTier.objects.count() == 0:
    print("No tariff tiers found. Seeding default tariff tiers...")
    TARIFF_DATA = {
        'RESIDENT': [
            (1, 5, '67'), (6, 10, '76'), (11, 15, '84'),
            (16, 25, '93'), (26, 40, '101'), (41, 99999, '110'),
        ],
        'ORGANIZATION': [
            (1, 5, '84'), (6, 10, '93'), (11, 15, '84'),
            (16, 25, '93'), (26, 40, '101'), (41, 99999, '155'),
        ],
        'FACTORY': [
            (1, 5, '93'), (6, 10, '101'), (11, 15, '110'),
            (16, 25, '118'), (26, 40, '180'), (41, 99999, '195'),
        ],
        'GOVERNMENT': [
            (1, 5, '76'), (6, 10, '84'), (11, 15, '93'),
            (16, 25, '101'), (26, 40, '110'), (41, 99999, '118'),
        ],
        'PUBLIC_SERVICE': [
            (1, 5, '67'), (6, 10, '67'), (11, 15, '67'),
            (16, 25, '67'), (26, 40, '67'), (41, 99999, '67'),
        ],
    }
    total = 0
    for customer_class, tiers in TARIFF_DATA.items():
        for min_u, max_u, price in tiers:
            TariffTier.objects.create(
                customer_class=customer_class,
                min_usage=Decimal(str(min_u)),
                max_usage=Decimal(str(max_u)),
                price_per_unit=Decimal(price),
            )
            total += 1
    print(f"Default tariff tiers seeded successfully ({total} tiers).")
else:
    print(f"Tariff tiers already exist ({TariffTier.objects.count()} found). Skipping seed.")

# 4. Safely seed Meters if database is empty
from apps.metering.models import Meter
import random
from datetime import datetime, timedelta

if Meter.objects.count() == 0:
    print("No meters found. Seeding default meters...")
    prefixes = ['RES', 'ORG', 'FAC', 'GOV', 'PUB', 'MTR']
    created = 0
    for prefix in prefixes:
        for i in range(20):
            meter_number = f"{prefix}-{(i + 1):05d}"
            days_ago = random.randint(1, 730)
            installation_date = datetime.now() - timedelta(days=days_ago)
            status = random.choice(['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DISCONNECTED'])
            location_description = random.choice([
                'Front yard, near the gate',
                'Backyard, next to the garden',
                'Basement utility room',
                'Side of the house, near the garage',
                'Kitchen, under the sink',
                'Commercial property, main entrance'
            ])
            Meter.objects.create(
                meter_number=meter_number,
                installation_date=installation_date.date(),
                location_description=location_description,
                status=status
            )
            created += 1
    print(f"Default meters seeded successfully ({created} meters).")
else:
    print(f"Meters already exist ({Meter.objects.count()} found). Skipping seed.")

