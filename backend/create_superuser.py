import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.accounts.models import Role

# 1. Ensure system roles exist in the database
roles = ['CUSTOMER', 'CLERK', 'TECHNICIAN', 'ADMIN']
role_objects = {}
for role_name in roles:
    role_obj, created = Role.objects.get_or_create(name=role_name)
    role_objects[role_name] = role_obj
    if created:
        print(f"Role '{role_name}' created.")

# 2. Create the superuser
User = get_user_model()
admin_role = role_objects.get('ADMIN')

if not User.objects.filter(email='admin@example.com').exists():
    user = User.objects.create_superuser('admin@example.com', 'admin123')
    user.first_name = 'Admin'
    user.last_name = 'User'
    user.role = admin_role
    user.save()
    print("Superuser 'admin@example.com' with password 'admin123' and ADMIN role created successfully.")
else:
    user = User.objects.get(email='admin@example.com')
    if user.role != admin_role:
        user.role = admin_role
        user.save()
        print("Updated existing superuser 'admin@example.com' to have ADMIN role.")
    else:
        print("Superuser 'admin@example.com' already exists and is configured correctly.")

