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
        
        # Check permissions: Customers only own meters; Clerks/Admins can upload for anyone.
        user_role = request.user.role.name if request.user.role else ''
        is_staff_or_clerk = request.user.is_staff or user_role in ['ADMIN', 'CLERK', 'TECHNICIAN']
        
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
                
        return Response({
            'status': reading.status,
            'reading_value': reading.reading_value,
            'confidence': reading.ocr_confidence,
            'message': 'Processing complete' if reading.status != 'PENDING' else 'AI is analyzing the image...'
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
            return Response(MaintenanceTaskSerializer(task).data, status=201)
        return Response(serializer.errors, status=400)

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
