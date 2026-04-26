import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.accounts.models import User

count = 0
for u in User.objects.all():
    u.set_password('admin123')
    u.save()
    count += 1
    role_name = getattr(u.role, 'name', str(u.role)) if u.role else 'None'
    print(f"Reset password for Email: {u.email} - Role: {role_name}")

print(f"\nSuccessfully reset passwords for {count} users to 'admin123'.")
