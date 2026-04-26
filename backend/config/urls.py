from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/metering/', include('apps.metering.urls')),
    path('api/billing/', include('apps.billing.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('metrics/', include('django_prometheus.urls')),
]

from django.urls import re_path
from .views import secure_media_serve

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', secure_media_serve, name='secure-media'),
]
