#!/bin/bash
set -e

echo "==> Installing core Django packages..."
pip install --no-cache-dir Django==5.0.2 djangorestframework==3.14.0 django-cors-headers==4.3.1 django-encrypted-model-fields==0.6.5 django-prometheus==2.3.1 gunicorn==21.2.0 python-dotenv==1.0.0 psycopg2-binary==2.9.9

echo "==> Installing auth & task packages..."
pip install --no-cache-dir celery==5.3.6 redis==5.0.1 bcrypt==4.1.2 "python-jose[cryptography]==3.3.0" PyJWT==2.11.0 sentry-sdk==1.40.6 requests==2.31.0

echo "==> Installing image processing packages..."
pip install --no-cache-dir opencv-python-headless==4.9.0.80 pytesseract==0.3.10 pillow==10.2.0

echo "==> Installing storage & API packages..."
pip install --no-cache-dir boto3==1.34.0 django-storages==1.14.2 drf-yasg==1.21.7 openpyxl==3.1.5 reportlab==4.4.10


echo "==> Installing AI packages..."
pip install --no-cache-dir "google-genai>=1.51.0"

echo "==> All packages installed successfully!"
