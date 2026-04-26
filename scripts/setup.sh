#!/bin/bash

set -e

echo "🔧 AI Water Billing System Setup"
echo "================================"

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose required but not installed. Aborting." >&2; exit 1; }

# Generate JWT keys
echo "🔑 Generating JWT signing keys..."
mkdir -p secrets
openssl genrsa -out secrets/jwt_private.pem 4096 2>/dev/null
openssl rsa -in secrets/jwt_private.pem -pubout -out secrets/jwt_public.pem 2>/dev/null
chmod 600 secrets/jwt_private.pem
chmod 644 secrets/jwt_public.pem
echo "✅ JWT keys generated"

# Generate Django secret key
DJANGO_SECRET=$(openssl rand -hex 32)
FIELD_KEY=$(openssl rand -hex 32)

# Create environment file
echo "📝 Creating .env file..."
cat > .env <<EOL
# Django
DJANGO_SECRET_KEY=${DJANGO_SECRET}
DEBUG=False
ALLOWED_HOSTS=api.yourdomain.com,localhost

# Database
DB_PASSWORD=$(openssl rand -hex 16)

# Encryption
FIELD_ENCRYPTION_KEY=${FIELD_KEY}

# Redis
REDIS_URL=redis://redis:6379/0

# AWS (Optional - leave empty for local storage)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=
AWS_REGION=us-east-1

# Sentry (Optional)
SENTRY_DSN=
EOL

echo "✅ Environment file created"

# Create SSL directory
mkdir -p infrastructure/ssl
echo "⚠️  Please place your SSL certificates in infrastructure/ssl/ as cert.pem and key.pem"

echo ""
echo "🚀 Setup complete! Next steps:"
echo "1. Place SSL certificates in infrastructure/ssl/"
echo "2. Update .env with your domain name"
echo "3. Run: cd infrastructure && docker-compose -f docker-compose.prod.yml up -d"
