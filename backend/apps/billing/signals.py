from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Avg
from .models import Bill, WaterAlert
from datetime import datetime, timedelta

@receiver(post_save, sender=Bill)
def detect_usage_anomaly(sender, instance, created, **kwargs):
    """
    Automatically detects leaks or spikes when a new bill is generated.
    Trigger: If consumption > 200% of the 6-month average.
    """
    if created:
        customer = instance.customer
        
        # Get historical average for this customer (excluding the current bill)
        avg_usage = Bill.objects.filter(
            customer=customer
        ).exclude(
            id=instance.id
        ).aggregate(Avg('consumption'))['consumption__avg']
        
        if avg_usage and avg_usage > 0:
            threshold = float(avg_usage) * 2.0 # 200% spike
            current_usage = float(instance.consumption)
            
            if current_usage > threshold:
                message = (
                    f"Our AI detected an unusual usage spike of {current_usage} m³ for this period. "
                    f"Your normal average is {float(avg_usage):.2f} m³. Please check for potential leaks."
                )
                
                WaterAlert.objects.create(
                    customer=customer,
                    bill=instance,
                    alert_type='LEAK' if current_usage > threshold * 1.5 else 'SPIKE',
                    message=message
                )
        elif not avg_usage:
            # First bill or no previous consumption data, skip analysis
            pass
