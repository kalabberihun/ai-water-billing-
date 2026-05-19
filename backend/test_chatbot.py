import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.billing.chatbot import ChatbotView

User = get_user_model()
user = User.objects.filter(role__name='Admin').first()
if not user:
    user = User.objects.first()

print(f"Testing with user: {user.email}")
factory = APIRequestFactory()
request = factory.post('/api/billing/chatbot/', {'message': 'hello'})
force_authenticate(request, user=user)

view = ChatbotView.as_view()
try:
    response = view(request)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.data}")
except Exception as e:
    import traceback
    traceback.print_exc()
