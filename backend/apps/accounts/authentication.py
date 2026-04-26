import uuid
import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

User = get_user_model()

class JWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        try:
            payload = jwt.decode(
                token, 
                settings.JWT_PUBLIC_KEY, 
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            user_id = payload.get('user_id')
            if not user_id:
                raise exceptions.AuthenticationFailed('Invalid token')
            
            user = User.objects.select_related('role').get(id=uuid.UUID(user_id))
            if not user.is_active:
                raise exceptions.AuthenticationFailed('User inactive')
            
            return (user, payload)
            
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Token expired')
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed('Invalid token')
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('User not found')

def generate_tokens(user):
    now = datetime.now(timezone.utc)
    
    access_payload = {
        'user_id': str(user.id),
        'email': user.email,
        'role': user.role.name if user.role else None,
        'type': 'access',
        'iat': now,
        'exp': now + settings.JWT_ACCESS_TOKEN_LIFETIME,
    }
    
    refresh_payload = {
        'user_id': str(user.id),
        'type': 'refresh',
        'iat': now,
        'exp': now + settings.JWT_REFRESH_TOKEN_LIFETIME,
    }
    
    access_token = jwt.encode(
        access_payload, 
        settings.JWT_PRIVATE_KEY, 
        algorithm=settings.JWT_ALGORITHM
    )
    
    refresh_token = jwt.encode(
        refresh_payload,
        settings.JWT_PRIVATE_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return {
        'access': access_token,
        'refresh': refresh_token,
        'expires_in': int(settings.JWT_ACCESS_TOKEN_LIFETIME.total_seconds())
    }
