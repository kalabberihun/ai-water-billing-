import uuid
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.throttling import ScopedRateThrottle
from django.conf import settings
from django.core.files.storage import default_storage
from django.shortcuts import get_object_or_404
from PIL import Image

from .models import Meter, MeterReading
from .serializers import (
    MeterSerializer, MeterReadingSerializer, 
    ReadingUploadSerializer, VerifyReadingSerializer
)
from .tasks import process_ocr

class MeterListView(generics.ListAPIView):
    serializer_class = MeterSerializer
    pagination_class = None
    
    def get_queryset(self):
        if hasattr(self.request.user, 'customer'):
            return Meter.objects.filter(customer=self.request.user.customer)
        return Meter.objects.all()

class ReadingListView(generics.ListAPIView):
    serializer_class = MeterReadingSerializer
    
    def get_queryset(self):
        queryset = MeterReading.objects.all()
        if hasattr(self.request.user, 'customer'):
            queryset = queryset.filter(meter__customer=self.request.user.customer)
        return queryset.select_related('meter').order_by('-submitted_at')

class UploadReadingView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload'
    
    def post(self, request):
        serializer = ReadingUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            meter = Meter.objects.get(id=data['meter_id'])
        except Meter.DoesNotExist:
            return Response({'error': 'Meter not found'}, status=404)
        
        # Check system active
        from apps.accounts.models import SystemSetting
        system_active = SystemSetting.get('billing_system_active', 'true') == 'true'
        
        # Check permissions: Customers only own meters; Clerks/Admins can upload for anyone.
        user_role = request.user.role.name if request.user.role else ''
        is_staff_or_clerk = request.user.is_staff or user_role in ['ADMIN', 'CLERK', 'TECHNICIAN']
        
        if not system_active and not is_staff_or_clerk:
            return Response({'error': 'The water billing system is temporarily deactivated. Meter scanning and bill generation are currently unavailable.'}, status=403)
            
        if not is_staff_or_clerk:
            if not hasattr(request.user, 'customer') or request.user.customer != meter.customer:
                return Response({'error': 'Unauthorized'}, status=403)
        
        # Save file
        image = data['image']
        
        # Image quality check
        if image.size < 50 * 1024: # 50KB
            return Response({'error': 'Image file is too small or low quality. Must be at least 50KB.'}, status=400)
            
        try:
            with Image.open(image) as img:
                width, height = img.size
                if width < 400 or height < 400:
                    return Response({'error': 'Image resolution too low. Must be at least 400x400 pixels.'}, status=400)
        except Exception:
            return Response({'error': 'Invalid image file.'}, status=400)
            
        # Reset file pointer after reading with PIL
        image.seek(0)
        
        file_path = f"meter_readings/{meter.id}/{uuid.uuid4()}_{image.name}"
        
        # Simulate local storage
        path = default_storage.save(file_path, image)
        image_url = settings.MEDIA_URL + path
        
        # Create reading record
        reading = MeterReading.objects.create(
            meter=meter,
            image_url=image_url,
            status='PENDING'
        )
        
        try:
            # Call OCR asynchronously via Celery
            try:
                process_ocr.delay(str(reading.id))
            except Exception as celery_err:
                print(f"Celery error, falling back to sync: {celery_err}")
                process_ocr(str(reading.id))
                reading.refresh_from_db()
            
            return Response({
                'id': str(reading.id),
                'reading_id': str(reading.id),
                'status': reading.status,
                'message': 'Image uploaded successfully. Processing...'
            }, status=201)
            
        except Exception as e:
            print(f"Error triggering OCR: {e}")
            reading.status = 'MANUAL_REVIEW'
            reading.save()
            
            return Response({
                'id': str(reading.id),
                'status': "MANUAL_REVIEW",
                'message': 'AI processing failed. Requires manual review.'
            }, status=201)

class ReadingStatusView(APIView):
    """Returns the current processing status of a meter reading."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, reading_id):
        reading = get_object_or_404(MeterReading, id=reading_id)
        
        # Check permissions
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['CLERK', 'ADMIN', 'TECHNICIAN']:
            if not hasattr(request.user, 'customer') or request.user.customer != reading.meter.customer:
                return Response({'error': 'Unauthorized'}, status=403)
                
        status_messages = {
            'PENDING': 'Queued for AI processing...',
            'PROCESSING': 'AI is analyzing the image...',
        }
        msg = status_messages.get(reading.status, 'Processing complete')
        
        return Response({
            'status': reading.status,
            'reading_value': reading.reading_value,
            'confidence': reading.ocr_confidence,
            'message': msg
        })

class VerifyReadingView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = VerifyReadingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        reading = get_object_or_404(MeterReading, id=data['reading_id'])
        
        # Check permissions - only clerks/admins/staff can verify
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['CLERK', 'ADMIN', 'TECHNICIAN']:
            return Response({'error': 'Permission denied'}, status=403)
        
        reading.reading_value = data['confirmed_value']
        reading.status = 'VERIFIED'
        reading.verified_by = request.user
        reading.save()
        
        # Trigger billing generation
        from apps.billing.tasks import generate_bill
        try:
            generate_bill.apply_async(args=[str(reading.id)])
        except Exception:
            # Fallback: call task function directly (bypasses celery)
            try:
                generate_bill.__wrapped__(None, str(reading.id))
            except Exception as e:
                print(f"Bill generation failed: {e}")
        
        return Response(MeterReadingSerializer(reading).data)


from django.utils import timezone

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
            
            # Send Email and Notification
            from utils.email import send_html_email
            from apps.accounts.models import SystemNotification
            
            msg = f"You have been newly assigned {len(readings_to_assign)} meter readings to review. Please check your dashboard."
            
            SystemNotification.objects.create(
                user=clerk,
                alert_type='TASK',
                message=msg
            )
            
            try:
                send_html_email(
                    subject='New Meter Readings Assigned',
                    template_name='emails/task_assigned.html',
                    context={
                        'name': clerk.first_name or 'Clerk',
                        'task_type': 'batch of meter readings',
                        'meter_number': 'Multiple Meters',
                        'message': msg
                    },
                    recipient_list=[clerk.email],
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

class AdminMaintenanceTaskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=403)
        
        from .models import MaintenanceTask
        from .serializers import MaintenanceTaskSerializer
        tasks = MaintenanceTask.objects.all().select_related('meter__customer__user', 'assigned_to').order_by('-created_at')
        return Response(MaintenanceTaskSerializer(tasks, many=True).data)
        
    def post(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=403)
            
        from .models import MaintenanceTask, Meter
        from .serializers import MaintenanceTaskSerializer
        serializer = MaintenanceTaskSerializer(data=request.data)
        if serializer.is_valid():
            task = serializer.save()
            # Set meter status to MAINTENANCE
            meter = task.meter
            meter.status = 'MAINTENANCE'
            meter.save()
            
            # Send Email & Notification
            if task.assigned_to:
                from apps.accounts.models import SystemNotification
                from utils.email import send_html_email
                
                msg = f"A new maintenance task has been assigned for Meter {meter.meter_number}."
                
                SystemNotification.objects.create(
                    user=task.assigned_to,
                    alert_type='TASK',
                    message=msg
                )
                
                customer_name = None
                if meter.customer and hasattr(meter.customer, 'user') and meter.customer.user:
                    customer_name = f"{meter.customer.user.first_name} {meter.customer.user.last_name}".strip()
                
                try:
                    send_html_email(
                        subject='Maintenance Task Assigned',
                        template_name='emails/task_assigned.html',
                        context={
                            'name': task.assigned_to.first_name or 'Technician',
                            'task_type': 'maintenance task',
                            'meter_number': meter.meter_number,
                            'customer_name': customer_name,
                            'address': meter.installation_address,
                            'message': f"{msg} Issue: {task.issue_description}"
                        },
                        recipient_list=[task.assigned_to.email],
                        fail_silently=True,
                    )
                except Exception:
                    pass
                    
            return Response(MaintenanceTaskSerializer(task).data, status=201)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk=None):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=403)
            
        from .models import MaintenanceTask
        if not pk:
            return Response({'error': 'Task ID is required'}, status=400)
            
        try:
            task = MaintenanceTask.objects.get(pk=pk)
            task.delete()
            return Response({'message': 'Task deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
        except MaintenanceTask.DoesNotExist:
            return Response({'error': 'Task not found'}, status=404)

# Force reload comment
class TechnicianMaintenanceTaskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role != 'TECHNICIAN':
            return Response({'error': 'Unauthorized'}, status=403)
            
        from .models import MaintenanceTask
        from .serializers import MaintenanceTaskSerializer
        tasks = MaintenanceTask.objects.filter(assigned_to=request.user).select_related('meter__customer__user').order_by('-created_at')
        return Response(MaintenanceTaskSerializer(tasks, many=True).data)
        
    def patch(self, request, pk):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role != 'TECHNICIAN':
            return Response({'error': 'Unauthorized'}, status=403)
            
        from .models import MaintenanceTask
        from .serializers import MaintenanceTaskSerializer
        from django.utils import timezone
        
        try:
            task = MaintenanceTask.objects.get(pk=pk, assigned_to=request.user)
        except MaintenanceTask.DoesNotExist:
            return Response({'error': 'Task not found'}, status=404)
            
        status_val = request.data.get('status')
        resolution_notes = request.data.get('resolution_notes')
        
        if status_val:
            task.status = status_val
        if resolution_notes is not None:
            task.resolution_notes = resolution_notes
            
        if status_val == 'RESOLVED' and task.status != 'RESOLVED':
            task.resolved_at = timezone.now()
            # Set meter status back to ACTIVE
            meter = task.meter
            meter.status = 'ACTIVE'
            meter.save()
            
        task.save()
        return Response(MaintenanceTaskSerializer(task).data)

    def delete(self, request, pk=None):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role != 'TECHNICIAN':
            return Response({'error': 'Unauthorized'}, status=403)
            
        from .models import MaintenanceTask
        if not pk:
            return Response({'error': 'Task ID is required'}, status=400)
            
        try:
            task = MaintenanceTask.objects.get(pk=pk, assigned_to=request.user)
            task.delete()
            return Response({'message': 'Task deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
        except MaintenanceTask.DoesNotExist:
            return Response({'error': 'Task not found'}, status=404)


# ─── Leakage Report Views ──────────────────────────────────────────────────

class CustomerLeakageReportView(APIView):
    """Customers can submit and view their own leakage reports."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'customer'):
            return Response({'error': 'Customer profile required'}, status=400)
        
        from .models import LeakageReport
        from .serializers import LeakageReportSerializer
        reports = LeakageReport.objects.filter(customer=request.user.customer)
        return Response(LeakageReportSerializer(reports, many=True).data)

    def post(self, request):
        if not hasattr(request.user, 'customer'):
            return Response({'error': 'Only customers can report leakages'}, status=403)
        
        from .models import LeakageReport
        from .serializers import LeakageReportSerializer
        
        serializer = LeakageReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(customer=request.user.customer)
        
        # Send confirmation email
        from utils.email import send_html_email
        from apps.accounts.models import SystemNotification
        
        msg = f"Your leakage report has been submitted successfully. Our team will investigate soon. Urgency: {report.urgency}."
        
        SystemNotification.objects.create(
            user=request.user,
            alert_type='INFO',
            message=msg
        )
        
        try:
            send_html_email(
                subject='Leakage Report Received - AquaBill AI',
                template_name='emails/notification.html',
                context={
                    'name': request.user.first_name or 'Customer',
                    'message': f"Thank you for reporting a water leakage. Your report (#{str(report.id)[:8]}) has been received and our team will investigate shortly.\n\nLocation: {report.location_description}\nUrgency: {report.get_urgency_display()}\n\nWe will notify you once action has been taken."
                },
                recipient_list=[request.user.email],
                fail_silently=True,
            )
        except Exception:
            pass
            
        # Notify Admins via email
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            # Fetch users with ADMIN role
            admins = User.objects.filter(role__iexact='ADMIN', is_active=True)
            # If no explicit role, fallback to is_staff
            if not admins.exists():
                admins = User.objects.filter(is_staff=True, is_active=True)
                
            admin_emails = [admin.email for admin in admins if admin.email]
            if admin_emails:
                send_html_email(
                    subject='⚠️ New Leakage Report - Action Required',
                    template_name='emails/notification.html',
                    context={
                        'name': 'Admin Team',
                        'message': f"A new leakage report has been submitted by {request.user.get_full_name() or request.user.email}.\n\nLocation: {report.location_description}\nUrgency: {report.get_urgency_display()}\n\nPlease review and dispatch a technician via the Admin Dashboard."
                    },
                    recipient_list=admin_emails,
                    fail_silently=True,
                )
        except Exception as e:
            print(f"Failed to send admin email: {e}")
        
        return Response(LeakageReportSerializer(report).data, status=201)


class AdminLeakageReportView(APIView):
    """Admin view: list all reports and update their status."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN']:
            return Response({'error': 'Unauthorized'}, status=403)
        
        from .models import LeakageReport
        from .serializers import LeakageReportSerializer
        reports = LeakageReport.objects.all().select_related('customer__user', 'meter')
        return Response(LeakageReportSerializer(reports, many=True).data)

    def patch(self, request, report_id):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN']:
            return Response({'error': 'Unauthorized'}, status=403)
        
        from .models import LeakageReport
        from .serializers import LeakageReportSerializer
        
        try:
            report = LeakageReport.objects.select_related('customer__user').get(id=report_id)
        except LeakageReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)
        
        new_status = request.data.get('status')
        admin_notes = request.data.get('admin_notes')
        technician_id = request.data.get('technician_id')
        
        allowed = ['UNDER_REVIEW', 'DISPATCHED', 'RESOLVED']
        if new_status and new_status not in allowed:
            return Response({'error': f'Status must be one of: {allowed}'}, status=400)
            
        if new_status == 'DISPATCHED' and report.status != 'DISPATCHED':
            if not technician_id:
                return Response({'error': 'technician_id is required when dispatching a report'}, status=400)
            
            from apps.metering.models import MaintenanceTask
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            try:
                technician = User.objects.get(id=technician_id, role__name__iexact='TECHNICIAN')
            except User.DoesNotExist:
                return Response({'error': 'Invalid technician ID'}, status=400)
                
            MaintenanceTask.objects.create(
                meter=report.meter,
                assigned_to=technician,
                issue_description=f"Leakage Report #{str(report.id)[:8]}\nLocation: {report.location_description}\nDescription: {report.description}",
                status='PENDING'
            )
        
        if new_status:
            report.status = new_status
        if admin_notes is not None:
            report.admin_notes = admin_notes
        report.save()
        
        # Notify customer of status change
        if new_status:
            from apps.accounts.models import SystemNotification
            from utils.email import send_html_email
            
            status_messages = {
                'UNDER_REVIEW': 'Your leakage report is now under review by our team.',
                'DISPATCHED': 'A technician has been dispatched to investigate your reported leakage.',
                'RESOLVED': 'Your leakage report has been resolved. Thank you for reporting!'
            }
            msg = status_messages.get(new_status, f'Your leakage report status has been updated to {new_status}.')
            
            SystemNotification.objects.create(
                user=report.customer.user,
                alert_type='INFO',
                message=msg
            )
            
            try:
                send_html_email(
                    subject=f'Leakage Report Update - {new_status.replace("_", " ").title()}',
                    template_name='emails/notification.html',
                    context={
                        'name': report.customer.user.first_name or 'Customer',
                        'message': msg + (f'\n\nAdmin Notes: {admin_notes}' if admin_notes else '')
                    },
                    recipient_list=[report.customer.user.email],
                    fail_silently=True,
                )
            except Exception:
                pass
        
        return Response(LeakageReportSerializer(report).data)

# ─── Field Reading Tasks Views ──────────────────────────────────────────────

class AdminAssignFieldTaskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN']:
            return Response({'error': 'Unauthorized'}, status=403)
            
        meter_id = request.data.get('meter_id')
        clerk_id = request.data.get('clerk_id')
        
        if not meter_id or not clerk_id:
            return Response({'error': 'meter_id and clerk_id are required'}, status=400)
            
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        try:
            meter = Meter.objects.get(id=meter_id)
            clerk = User.objects.get(id=clerk_id, role__name__iexact='CLERK')
        except Meter.DoesNotExist:
            return Response({'error': 'Meter not found'}, status=404)
        except User.DoesNotExist:
            return Response({'error': 'Clerk not found'}, status=404)
            
        from django.utils import timezone
        # Create a field task (MeterReading)
        reading = MeterReading.objects.create(
            meter=meter,
            status='FIELD_TASK',
            assigned_to=clerk,
            assigned_at=timezone.now(),
            image_url=''  # initially blank
        )
        
        # Send Notification
        from apps.accounts.models import SystemNotification
        msg = f"You have been assigned a field check for meter {meter.meter_number}. Please visit the location."
        SystemNotification.objects.create(user=clerk, alert_type='TASK', message=msg)
        
        return Response({'message': 'Field task assigned successfully', 'id': reading.id}, status=201)

class AdminBatchAssignFieldTasksView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN']:
            return Response({'error': 'Unauthorized'}, status=403)
            
        from django.contrib.auth import get_user_model
        User = get_user_model()
        clerks = list(User.objects.filter(role__name__iexact='CLERK'))
        
        if not clerks:
            return Response({'error': 'No clerks available for assignment'}, status=400)
            
        active_meters = list(Meter.objects.filter(status='ACTIVE'))
        
        if not active_meters:
            return Response({'error': 'No active meters available'}, status=400)
            
        from django.utils import timezone
        now = timezone.now()
        
        tasks_created = 0
        from apps.accounts.models import SystemNotification
        
        for i, meter in enumerate(active_meters):
            clerk = clerks[i % len(clerks)]
            
            # Create a field task
            MeterReading.objects.create(
                meter=meter,
                status='FIELD_TASK',
                assigned_to=clerk,
                assigned_at=now,
                image_url=''  # initially blank
            )
            tasks_created += 1
            
            # Send Notification
            msg = f"You have been assigned a field check for meter {meter.meter_number}. Please visit the location."
            SystemNotification.objects.create(user=clerk, alert_type='TASK', message=msg)
            
        return Response({'message': f'Successfully created {tasks_created} field tasks and assigned to {len(clerks)} clerks.'}, status=201)

class ClerkFieldTasksView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['CLERK', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=403)
            
        from django.utils import timezone
        tasks = MeterReading.objects.filter(
            status='FIELD_TASK', assigned_to=request.user
        ).select_related('meter__customer__user').order_by('-assigned_at')
        
        data = []
        for r in tasks:
            customer_name = "Unassigned"
            address = "No address provided"
            if r.meter.customer:
                if hasattr(r.meter.customer, 'user') and r.meter.customer.user:
                    customer_name = f"{r.meter.customer.user.first_name} {r.meter.customer.user.last_name}".strip()
                if r.meter.customer.address:
                    address = r.meter.customer.address
                
            data.append({
                'id': r.id,
                'customer': customer_name,
                'address': address,
                'meter': r.meter.meter_number,
                'assigned_at': r.assigned_at.strftime('%Y-%m-%d %H:%M') if r.assigned_at else None,
                'status': r.status,
            })
            
        return Response(data)

class ClerkSubmitFieldTaskView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['CLERK', 'ADMIN']:
            return Response({'error': 'Unauthorized'}, status=403)
            
        try:
            reading = MeterReading.objects.get(id=pk, status='FIELD_TASK', assigned_to=request.user)
        except MeterReading.DoesNotExist:
            return Response({'error': 'Field task not found or already completed'}, status=404)
            
        image = request.data.get('image')
        reading_value = request.data.get('reading_value')
        
        if not image or not reading_value:
            return Response({'error': 'Both image and reading_value are required'}, status=400)
            
        try:
            val = float(reading_value)
            if val < 0:
                raise ValueError
        except ValueError:
            return Response({'error': 'reading_value must be a positive number'}, status=400)
            
        # Save image
        file_path = f"meter_readings/field_tasks/{reading.meter.id}/{uuid.uuid4()}_{image.name}"
        path = default_storage.save(file_path, image)
        image_url = settings.MEDIA_URL + path
        
        reading.image_url = image_url
        reading.reading_value = val
        reading.status = 'VERIFIED'
        reading.verified_by = request.user
        reading.save()
        
        # Trigger bill generation
        from apps.billing.tasks import generate_bill
        try:
            generate_bill.apply_async(args=[str(reading.id)])
        except Exception:
            try:
                generate_bill.__wrapped__(None, str(reading.id))
            except Exception as e:
                print(f"Bill generation failed: {e}")
                
        return Response({'message': 'Task completed and reading submitted successfully.'})

