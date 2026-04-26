from django.urls import path
from django.http import JsonResponse

urlpatterns = [
    path('health', lambda r: JsonResponse({'status': 'healthy'}), name='health'),
]
