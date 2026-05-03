from django.contrib.auth import get_user_model

User = get_user_model()
if not User.objects.filter(email='admin@example.com').exists():
    user = User.objects.create_superuser('admin@example.com', 'admin123')
    user.first_name = 'Admin'
    user.last_name = 'User'
    user.save()
    print("Superuser 'admin@example.com' with password 'admin123' created successfully.")
else:
    print("Superuser 'admin@example.com' already exists.")
