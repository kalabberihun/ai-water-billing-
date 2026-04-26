#!/bin/bash

set -e

cd "$(dirname "$0")/../infrastructure"

echo "🚀 Deploying AI Water Billing System..."

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Build and start services
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
echo "⏳ Running database migrations..."
sleep 10
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate

# Collect static
echo "📦 Collecting static files..."
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput

# Health check
echo "🏥 Health checking..."
sleep 5
curl -f http://localhost/api/analytics/health || exit 1

echo ""
echo "✅ Deployment successful!"
echo "Frontend: https://yourdomain.com"
echo "API: https://yourdomain.com/api/"
