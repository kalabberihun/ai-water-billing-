from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from celery import shared_task
from django.db import transaction
from django.core.cache import cache

from .models import Bill, TariffTier
from apps.metering.models import MeterReading

@shared_task(bind=True, max_retries=3)
def generate_bill(self, reading_id):
    """Generate bill with idempotency protection"""
    cache_key = f'bill_gen_{reading_id}'
    
    # Acquire lock
    if not cache.add(cache_key, 'locked', timeout=300):
        return {'status': 'already_processing'}
    
    try:
        with transaction.atomic():
            reading = MeterReading.objects.select_for_update().get(id=reading_id)
            
            # Check if bill exists
            if hasattr(reading, 'bill'):
                return {'status': 'already_exists', 'bill_id': str(reading.bill.id)}
            
            # Get previous reading
            previous_reading = MeterReading.objects.filter(
                meter=reading.meter,
                status='VERIFIED',
                submitted_at__lt=reading.submitted_at
            ).order_by('-submitted_at').first()
            
            prev_value = previous_reading.reading_value if previous_reading else Decimal('0')
            curr_value = reading.reading_value
            
            if curr_value is None:
                raise ValueError("Reading value is null")
            
            consumption = curr_value - prev_value
            
            if consumption < 0:
                consumption = Decimal('0')  # Handle meter reset
            
            # Calculate by tiers
            subtotal = Decimal('0')
            remaining = consumption
            
            for tier in TariffTier.objects.all():
                if remaining <= 0:
                    break
                tier_usage = min(remaining, tier.max_usage - tier.min_usage)
                subtotal += tier_usage * tier.price_per_unit
                remaining -= tier_usage
            
            # Tax calculation (example: 5%)
            tax_rate = Decimal('0.05')
            tax_amount = (subtotal * tax_rate).quantize(Decimal('0.01'))
            
            # Penalty calculation (if previous bills overdue) - simplified
            penalty = Decimal('0')
            
            total = (subtotal + tax_amount + penalty).quantize(
                Decimal('0.01'), 
                rounding=ROUND_HALF_UP
            )
            
            bill = Bill.objects.create(
                customer=reading.meter.customer,
                reading=reading,
                previous_reading=prev_value,
                current_reading=curr_value,
                consumption=consumption,
                subtotal=subtotal,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                penalty=penalty,
                total_amount=total,
                due_date=datetime.now().date() + timedelta(days=30),
            )
            
            # Send Email Notification
            from utils.email import send_html_email
            from apps.accounts.models import SystemNotification
            
            msg = f"Your new water bill for {bill.total_amount} ETB has been generated. Due Date: {bill.due_date}"
            
            SystemNotification.objects.create(
                user=bill.customer.user,
                alert_type='INFO',
                message=msg
            )
            
            try:
                send_html_email(
                    subject=f"New Water Bill Generated - {bill.created_at.strftime('%B %Y')}",
                    template_name='emails/bill_generated.html',
                    context={
                        'customer_name': bill.customer.user.first_name or 'Customer',
                        'meter_number': bill.reading.meter.meter_number,
                        'amount': str(bill.total_amount),
                        'due_date': bill.due_date.strftime('%B %d, %Y')
                    },
                    recipient_list=[bill.customer.user.email],
                    fail_silently=True,
                )
            except Exception as e:
                print(f"Failed to send email: {e}")

            return {
                'status': 'created',
                'bill_id': str(bill.id),
                'total': float(total)
            }
            
    except Exception as exc:
        if self.request.retries < 3:
            raise self.retry(countdown=60, exc=exc)
        raise
    finally:
        cache.delete(cache_key)

@shared_task
def delete_expired_bills():
    """Deletes bills that are older than 24 hours to keep the system clean"""
    from django.utils import timezone
    from datetime import timedelta
    from .models import Bill
    import logging

    logger = logging.getLogger(__name__)
    expiration_time = timezone.now() - timedelta(hours=24)
    # Only delete bills that haven't been paid
    expired_bills = Bill.objects.filter(created_at__lt=expiration_time, status__in=['UNPAID', 'OVERDUE'])
    
    count = expired_bills.count()
    if count > 0:
        expired_bills.delete()
        logger.info(f"Successfully deleted {count} bills older than 24 hours.")
    return {'deleted_count': count}
