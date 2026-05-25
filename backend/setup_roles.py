import os
import django

# Set up Django environment so we can run this as a standalone script
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.accounts.models import Role

User = get_user_model()

# Create basic roles
roles_to_create = ['Admin', 'Clerk', 'Technician', 'CUSTOMER']
for role_name in roles_to_create:
    role, created = Role.objects.get_or_create(name=role_name)
    if created:
        print(f"Role '{role_name}' created.")

admin_role = Role.objects.get(name='Admin')
clerk_role = Role.objects.get(name='Clerk')
tech_role = Role.objects.get(name='Technician')

# Ensure Admin user has Admin role
admin_user = User.objects.filter(email='admin@example.com').first()
if admin_user:
    admin_user.role = admin_role
    admin_user.save()
    print("Assigned Admin role to admin@example.com.")

# Create Clerk User
if not User.objects.filter(email='clerk@example.com').exists():
    clerk = User.objects.create_user(email='clerk@example.com', password='clerk123')
    clerk.first_name = 'Jane'
    clerk.last_name = 'Clerk'
    clerk.role = clerk_role
    clerk.is_staff = True # Clerks likely need some dashboard access
    clerk.save()
    print("Created Clerk user: clerk@example.com / clerk123")
else:
    print("Clerk user already exists.")

# Create Technician User
if not User.objects.filter(email='tech@example.com').exists():
    tech = User.objects.create_user(email='tech@example.com', password='tech123')
    tech.first_name = 'John'
    tech.last_name = 'Tech'
    tech.role = tech_role
    tech.is_staff = True # Technicians also need dashboard access
    tech.save()
    print("Created Technician user: tech@example.com / tech123")
else:
    print("Technician user already exists.")

print("Setup complete.")
