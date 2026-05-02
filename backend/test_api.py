import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.authentication import generate_tokens
from apps.accounts.models import User
import sys

user = User.objects.filter(email='kalblack2m@gmail.com').first()
if not user:
    print("User not found.")
    sys.exit(1)

tokens = generate_tokens(user)
access_token = tokens['access']

from rest_framework.test import APIClient
client = APIClient()
client.credentials(HTTP_AUTHORIZATION='Bearer ' + access_token)
response = client.get('/api/accounts/notifications/')

print(f"Status: {response.status_code}")
print(f"Data: {response.json()}")
