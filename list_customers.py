import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.accounts.models import User

customers = []
for u in User.objects.all():
    role_name = getattr(u.role, 'name', str(u.role)) if u.role else 'None'
    if role_name.upper() not in ['ADMIN', 'CLERK', 'TECHNICIAN']:
        customers.append((u.email, u.first_name, u.last_name, role_name))

print("Found Customers:")
for c in customers:
    print(f"- Email: {c[0]} | Name: {c[1]} {c[2]} | Role: {c[3]}")
