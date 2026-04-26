
from django.utils import timezone
from django.core.mail import send_mail

class AdminBatchAssignReviewsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN']:
            return Response({'error': 'Unauthorized'}, status=403)
            
        from apps.accounts.models import User
        clerks = User.objects.filter(role__name__iexact='CLERK')
        if not clerks.exists():
            return Response({'error': 'No clerks available in the system.'}, status=400)
            
        unassigned_readings = list(MeterReading.objects.filter(status='MANUAL_REVIEW', assigned_to__isnull=True).order_by('submitted_at'))
        
        assigned_count = 0
        clerk_count = 0
        
        for clerk in clerks:
            readings_to_assign = unassigned_readings[:20]
            unassigned_readings = unassigned_readings[20:]
            
            if not readings_to_assign:
                break
                
            for r in readings_to_assign:
                r.assigned_to = clerk
                r.assigned_at = timezone.now()
                r.save()
            
            assigned_count += len(readings_to_assign)
            clerk_count += 1
            
            # Send Email
            try:
                send_mail(
                    'New Meter Readings Assigned',
                    f'Hello {clerk.first_name},\n\nYou have been newly assigned {len(readings_to_assign)} meter readings to review. Please check your dashboard.',
                    'noreply@aiwaterbilling.com',
                    [clerk.email],
                    fail_silently=True,
                )
            except Exception as e:
                print(f"Failed to send email to {clerk.email}: {e}")
                
        return Response({'message': f'Successfully assigned {assigned_count} readings across {clerk_count} clerks.'})

class ClerkPendingReadingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['CLERK', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=403)
            
        # Get assigned readings for this user
        readings = MeterReading.objects.filter(
            status='MANUAL_REVIEW', assigned_to=request.user
        ).select_related('meter__customer__user').order_by('assigned_at')
        
        data = []
        for r in readings:
            customer_name = "Unassigned"
            if r.meter.customer and hasattr(r.meter.customer, 'user') and r.meter.customer.user:
                customer_name = f"{r.meter.customer.user.first_name} {r.meter.customer.user.last_name}".strip()
                
            data.append({
                'id': r.id,
                'customer': customer_name,
                'meter': r.meter.meter_number,
                'submitted': r.submitted_at.strftime('%Y-%m-%d %H:%M'),
                'status': r.status,
                'image_url': r.image_url,
                'reading_value': r.reading_value,
                'ocr_confidence': r.ocr_confidence,
                'assigned_duration_mins': (timezone.now() - r.assigned_at).total_seconds() / 60 if r.assigned_at else 0
            })
            
        return Response(data)
