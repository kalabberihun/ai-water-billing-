import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'django_prometheus',
    'apps.accounts',
    'apps.billing.apps.BillingConfig',
    'apps.metering',
    'apps.analytics',
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

ROOT_URLCONF = 'config.urls'
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

db_host_env = os.environ.get('DB_HOST', 'localhost')
db_url_env = os.environ.get('DATABASE_URL', '')
db_uri = db_url_env if (db_url_env.startswith('postgresql://') or db_url_env.startswith('postgres://')) else db_host_env

if db_uri.startswith('postgresql://') or db_uri.startswith('postgres://'):
    # Custom split-based parser to avoid ValueError: ... does not appear to be an IPv4 or IPv6 address
    # caused by bracketed passwords containing '@' in urllib.parse.
    try:
        s = db_uri.split('://', 1)[1]
        path_parts = s.split('/', 1)
        auth_host = path_parts[0]
        db_name = path_parts[1] if len(path_parts) > 1 else 'postgres'
        
        auth_parts = auth_host.rsplit('@', 1)
        credentials = auth_parts[0]
        host_port = auth_parts[1] if len(auth_parts) > 1 else auth_parts[0]
        
        cred_parts = credentials.split(':', 1)
        db_user = cred_parts[0]
        db_password = cred_parts[1] if len(cred_parts) > 1 else ''
        
        if db_password.startswith('[') and db_password.endswith(']'):
            db_password = db_password[1:-1]
            
        hp_parts = host_port.split(':', 1)
        db_host = hp_parts[0]
        db_port = hp_parts[1] if len(hp_parts) > 1 else '5432'
    except Exception:
        # Fallback to defaults on any parsing error
        db_user = 'postgres'
        db_password = 'postgres'
        db_host = 'localhost'
        db_port = '5432'
        db_name = 'ai_water_billing'
else:
    db_user = os.environ.get('DB_USER', 'postgres')
    db_password = os.environ.get('DB_PASSWORD', 'postgres')
    db_host = db_host_env
    db_port = os.environ.get('DB_PORT', '5432')
    db_name = os.environ.get('DB_NAME', 'ai_water_billing')
    
    # Strip accidental brackets from password if set in separate DB_PASSWORD env var
    if db_password.startswith('[') and db_password.endswith(']'):
        db_password = db_password[1:-1]

DATABASES = {
    'default': {
        'ENGINE': os.environ.get('DB_ENGINE', 'django.db.backends.postgresql'),
        'NAME': db_name,
        'USER': db_user,
        'PASSWORD': db_password,
        'HOST': db_host,
        'PORT': db_port,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.accounts.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'user': '1000/hour',
        'login': '10/min',
        'upload': '30/hour',
    },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20
}

# CORS
CORS_ALLOWED_ORIGINS = [
    f"https://{host}" for host in ALLOWED_HOSTS if host not in ['localhost', '127.0.0.1']
] + [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


# JWT Configuration (RS256)
JWT_ALGORITHM = 'RS256'
JWT_ACCESS_TOKEN_LIFETIME = timedelta(hours=1)
JWT_REFRESH_TOKEN_LIFETIME = timedelta(days=7)

# Load keys from files
import os
try:
    with open(BASE_DIR.parent / 'secrets' / 'jwt_private.pem') as f:
        JWT_PRIVATE_KEY = f.read()
    with open(BASE_DIR.parent / 'secrets' / 'jwt_public.pem') as f:
        JWT_PUBLIC_KEY = f.read()
except FileNotFoundError:
    print("Warning: JWT keys not found. Run key generation script.")
    JWT_PRIVATE_KEY = None
    JWT_PUBLIC_KEY = None

# Celery Configuration
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_TASK_SOFT_TIME_LIMIT = 300
CELERY_TASK_TIME_LIMIT = 600
CELERY_TASK_ALWAYS_EAGER = os.environ.get('CELERY_TASK_ALWAYS_EAGER', 'False') == 'True'

# Celery Beat Schedule
from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'delete-expired-bills-every-hour': {
        'task': 'apps.billing.tasks.delete_expired_bills',
        'schedule': crontab(minute=0, hour='*'),  # Run at the start of every hour
    },
    'delete-resolved-leakage-reports-every-hour': {
        'task': 'apps.metering.tasks.delete_resolved_leakage_reports',
        'schedule': crontab(minute=0, hour='*'),  # Run at the start of every hour
    },
    'reassign-expired-field-tasks-every-hour': {
        'task': 'apps.metering.tasks.reassign_expired_field_tasks',
        'schedule': crontab(minute=0, hour='*'),  # Run at the start of every hour
    },
}

# Encryption
FIELD_ENCRYPTION_KEY = os.environ.get('FIELD_ENCRYPTION_KEY', '')

# Chapa Payment Gateway
CHAPA_SECRET_KEY = os.environ.get('CHAPA_SECRET_KEY', '')
CHAPA_API_BASE_URL = 'https://api.chapa.co/v1'

# Google Gemini API
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

# Groq API (fallback AI provider)
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')

# Email (Gmail SMTP)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'Water Billing <noreply@example.com>')
# Fallback: if no credentials, log emails to console
if not EMAIL_HOST_USER or EMAIL_HOST_USER == 'your_gmail@gmail.com':
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Default file storage - use local for development
if os.environ.get('AWS_ACCESS_KEY_ID'):
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_BUCKET_NAME', '')
AWS_S3_REGION_NAME = os.environ.get('AWS_REGION', 'us-east-1')
AWS_S3_SIGNATURE_VERSION = 's3v4'
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = 'private'

# Security
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Sentry
SENTRY_DSN = os.environ.get('SENTRY_DSN')
if SENTRY_DSN and not DEBUG:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )
