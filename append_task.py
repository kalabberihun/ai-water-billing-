
@shared_task
def reassign_expired_reviews():
    from datetime import timedelta
    from django.utils import timezone
    from apps.metering.models import MeterReading
    from apps.accounts.models import User
    from django.core.mail import send_mail
    
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
        
        try:
            send_mail(
                'Reassigned Meter Reading Review',
                f'Hello {new_clerk.first_name},\n\nA manual review has been reassigned to you due to expiration. Please check your dashboard.',
                'noreply@aiwaterbilling.com',
                [new_clerk.email],
                fail_silently=True,
            )
        except Exception:
            pass
            
    return f"Reassigned {reassigned} expiring reviews"
