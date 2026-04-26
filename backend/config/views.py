import os
from django.http import HttpResponse, Http404, FileResponse
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.metering.models import Meter

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def secure_media_serve(request, path):
    """
    Serves media files only to authenticated users who have permission to view them.
    Specifically protects meter readings by checking meter ownership.
    """
    parts = path.split('/')
    
    # If it's a meter reading image, check ownership
    if len(parts) >= 2 and parts[0] == 'meter_readings':
        meter_id = parts[1]
        user = request.user
        user_role = user.role.name.upper() if user.role else ''
        is_staff = user.is_staff or user_role in ['ADMIN', 'CLERK', 'TECHNICIAN']
        
        if not is_staff:
            # Customer checking their own reading
            if not hasattr(user, 'customer') or not Meter.objects.filter(id=meter_id, customer=user.customer).exists():
                return HttpResponse('Unauthorized', status=403)
                
    full_path = os.path.join(settings.MEDIA_ROOT, path)
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise Http404("File not found")
        
    return FileResponse(open(full_path, 'rb'))
