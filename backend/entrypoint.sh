#!/bin/bash

set -e

echo "Waiting for postgres..."
while ! nc -z $DB_HOST 5432; do
  sleep 0.1
done
echo "PostgreSQL started"

echo "Applying migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Creating default roles..."
python manage.py shell << EOF
from apps.accounts.models import Role
roles = ['CUSTOMER', 'CLERK', 'TECHNICIAN', 'ADMIN']
for role_name in roles:
    Role.objects.get_or_create(name=role_name)
print("Roles created")
EOF

echo "Starting Gunicorn..."
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --threads 2 --worker-class gthread --access-logfile - --error-logfile - --capture-output --enable-stdio-inheritance
