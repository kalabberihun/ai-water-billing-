import os
import django
import random
from datetime import datetime, timedelta

# Set up Django environment so we can run this as a standalone script
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.metering.models import Meter

def create_meters():
    Meter.objects.all().delete()
    print("Deleted all existing meters.")
    
    # 6 Types of meter prefixes
    prefixes = [
        'RES', # Resident
        'ORG', # Organization
        'FAC', # Factory
        'GOV', # Government
        'PUB', # Public Service
        'MTR'  # Generic / Other
    ]
    
    created_count = 0
    print(f"Starting to create meters with specific prefixes...")
    
    for prefix in prefixes:
        for i in range(20): # 20 per type = 120 meters total
            meter_number = f"{prefix}-{(i + 1):05d}"
                
            # Random installation date in the past 2 years
            days_ago = random.randint(1, 730)
            installation_date = datetime.now() - timedelta(days=days_ago)
            
            # Weighted random status
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
            created_count += 1
            
    print(f"Successfully created {created_count} meters in total across 6 prefix types.")

if __name__ == '__main__':
    create_meters()
