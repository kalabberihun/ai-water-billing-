import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import SystemNotification
print("Notifications in DB:")
for n in SystemNotification.objects.all():
    print(f"- {n.user.email}: {n.alert_type} | Read: {n.is_read} | {n.message}")
