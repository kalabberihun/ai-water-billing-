import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from decimal import Decimal
from apps.billing.models import TariffTier

# Clear old tiers
TariffTier.objects.all().delete()
print("Cleared existing tariff tiers.")

# Define tiers per customer class (min, max, price per m3 in ETB)
TARIFF_DATA = {
    'RESIDENT': [
        (1, 5, '67'),
        (6, 10, '76'),
        (11, 15, '84'),
        (16, 25, '93'),
        (26, 40, '101'),
        (41, 99999, '110'),
    ],
    'ORGANIZATION': [
        (1, 5, '84'),
        (6, 10, '93'),
        (11, 15, '84'),
        (16, 25, '93'),
        (26, 40, '101'),
        (41, 99999, '155'),
    ],
    'FACTORY': [
        (1, 5, '93'),
        (6, 10, '101'),
        (11, 15, '110'),
        (16, 25, '118'),
        (26, 40, '180'),
        (41, 99999, '195'),
    ],
    'GOVERNMENT': [
        (1, 5, '76'),
        (6, 10, '84'),
        (11, 15, '93'),
        (16, 25, '101'),
        (26, 40, '110'),
        (41, 99999, '118'),
    ],
    'PUBLIC_SERVICE': [
        (1, 5, '67'),
        (6, 10, '67'),
        (11, 15, '67'),
        (16, 25, '67'),
        (26, 40, '67'),
        (41, 99999, '67'),
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
    print(f"  Created {len(tiers)} tiers for {customer_class}")

print(f"\nDone! Created {total} tariff tiers across all customer classes.")
