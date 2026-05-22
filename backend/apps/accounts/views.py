import random
from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from django.db import transaction
from django.db.models import Sum, Count
import bcrypt
import jwt
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from django.conf import settings as django_settings
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone

from .models import User, Customer, Role, EmailVerification
from .serializers import (
    UserSerializer, CustomerSerializer, RegisterSerializer,
    LoginSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    SystemNotificationSerializer, VerifyEmailSerializer, ResendOTPSerializer
)
from .authentication import generate_tokens

from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

from utils.email import send_html_email


def _generate_otp():
    """Generate a random 6-digit OTP code."""
    return f"{random.randint(100000, 999999)}"


def _send_otp_email(user, otp_code):
    """Send the OTP verification email."""
    send_html_email(
        subject='Verify Your Email - AquaBill AI',
        template_name='emails/otp_verification.html',
        context={
            'user': user,
            'otp_code': otp_code
        },
        recipient_list=[user.email],
        fail_silently=False,
    )


def _create_and_send_otp(user):
    """Create an OTP record and send it via email. Returns the OTP object."""
    # Invalidate any previous unused OTPs
    EmailVerification.objects.filter(user=user, is_used=False).update(is_used=True)

    otp_code = _generate_otp()
    otp = EmailVerification.objects.create(
        user=user,
        otp_code=otp_code,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    _send_otp_email(user, otp_code)
    return otp


# ─── Admin-only permission helper ─────────────────────────────────────────────
class IsAdminOrStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.is_staff or
             (request.user.role and request.user.role.name.upper() in ['ADMIN', 'CLERK']))
        )

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        with transaction.atomic():
            # Create user — inactive until email is verified
            password_hash = make_password(data['password'])
            
            user = User.objects.create(
                email=data['email'],
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                password=password_hash,
                is_active=False,
                is_email_verified=False,
            )
            
            # Create customer profile
            customer = Customer.objects.create(
                user=user,
                national_id=data['national_id'],
                phone=data.get('phone', ''),
                address=data.get('address', ''),
                city=data.get('city', ''),
                customer_class=data.get('customer_class', 'RESIDENT')
            )

            # Assign meter to customer
            from apps.metering.models import Meter
            meter = Meter.objects.get(meter_number=data['meter_number'])
            meter.customer = customer
            meter.save()
        
        # Send OTP verification email
        try:
            _create_and_send_otp(user)
        except Exception as e:
            print(f"Error sending OTP email: {e}")
        
        return Response({
            'message': 'Account created! Please check your email for a verification code.',
            'email': user.email,
        }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        try:
            user = User.objects.get(email=data['email'])
        except User.DoesNotExist:
            return Response(
                {'error': 'No account exists with this email address.'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        

        
        # Check password with legacy fallback
        stored_hash = user.password
        try:
            if stored_hash.startswith('$2b$') or stored_hash.startswith('$2a$'):
                if not bcrypt.checkpw(data['password'].encode('utf-8'), stored_hash.encode('utf-8')):
                    return Response({'error': 'Incorrect password.'}, status=status.HTTP_401_UNAUTHORIZED)
                # Upgrade to Django hash
                user.password = make_password(data['password'])
                user.save(update_fields=['password'])
            else:
                if not check_password(data['password'], stored_hash):
                    return Response({'error': 'Incorrect password.'}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception:
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_401_UNAUTHORIZED)
        
        tokens = generate_tokens(user)
        return Response({
            'user': UserSerializer(user).data,
            **tokens
        })

class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'Refresh token required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            payload = jwt.decode(
                refresh_token, 
                django_settings.JWT_PUBLIC_KEY, 
                algorithms=[django_settings.JWT_ALGORITHM]
            )
            
            if payload.get('type') != 'refresh':
                return Response({'error': 'Invalid token type'}, status=status.HTTP_401_UNAUTHORIZED)
                
            user_id = payload.get('user_id')
            user = User.objects.get(id=user_id)
            
            tokens = generate_tokens(user)
            return Response(tokens)
            
        except jwt.ExpiredSignatureError:
            return Response({'error': 'Refresh token expired'}, status=status.HTTP_401_UNAUTHORIZED)
        except (jwt.InvalidTokenError, User.DoesNotExist):
            return Response({'error': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    
    def get_object(self):
        return self.request.user

class CustomerProfileView(generics.RetrieveAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return Customer.objects.get(user=self.request.user)

# ─── Admin Endpoints ──────────────────────────────────────────────────────────
class AdminStatsView(APIView):
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        from apps.metering.models import Meter, MeterReading
        from apps.billing.models import Bill

        total_customers = Customer.objects.count()
        active_meters = Meter.objects.filter(status='ACTIVE').count()
        pending_readings = MeterReading.objects.filter(status__in=['PENDING', 'MANUAL_REVIEW']).count()
        
        # Calculate total collected revenue (paid bills)
        total_revenue = Bill.objects.filter(status='PAID').aggregate(
            total=Sum('total_amount')
        )['total'] or 0

        # --- Chart Data: Collection Status ---
        paid_count = Bill.objects.filter(status='PAID').count()
        unpaid_count = Bill.objects.filter(status__in=['UNPAID', 'OVERDUE']).count()
        
        collection_stats = [
            {'name': 'Paid', 'value': paid_count},
            {'name': 'Unpaid', 'value': unpaid_count}
        ]

        # --- Chart Data: Revenue History (Last 6 Months) ---
        revenue_history = []
        today = datetime.now()
        for i in range(5, -1, -1):
            date = today - relativedelta(months=i)
            month_name = date.strftime('%b')
            year = date.year
            month = date.month
            
            monthly_revenue = Bill.objects.filter(
                status='PAID',
                created_at__year=year,
                created_at__month=month
            ).aggregate(total=Sum('total_amount'))['total'] or 0
            
            revenue_history.append({
                'month': month_name,
                'amount': float(monthly_revenue)
            })

        return Response({
            'totalUsers': total_customers,
            'activeMeters': active_meters,
            'pendingReadings': pending_readings,
            'totalRevenue': f"{total_revenue:,.2f}",
            'revenueHistory': revenue_history,
            'collectionStats': collection_stats
        })


class AdminPendingReadingsView(APIView):
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        from apps.metering.models import MeterReading
        
        # Get the latest 50 pending readings
        readings = MeterReading.objects.filter(
            status__in=['PENDING', 'MANUAL_REVIEW']
        ).select_related('meter__customer__user').order_by('-submitted_at')[:50]
        
        data = []
        for r in readings:
            customer_name = "Unassigned"
            if r.meter.customer:
                user = r.meter.customer.user
                customer_name = f"{user.first_name} {user.last_name}".strip()
                
            data.append({
                'id': r.id,
                'customer': customer_name,
                'meter': r.meter.meter_number,
                'submitted': r.submitted_at.strftime('%Y-%m-%d %H:%M'),
                'status': r.status,
                'image_url': r.image_url,
                'reading_value': r.reading_value,
                'ocr_confidence': r.ocr_confidence
            })
            
        return Response(data)


class AdminDisputesView(APIView):
    """Returns all open disputes for the admin to review."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        from apps.billing.models import Dispute
        disputes = (
            Dispute.objects
            .filter(status__in=['PENDING', 'IN_PROGRESS'])
            .select_related('bill', 'customer__user')
            .order_by('-created_at')
        )
        data = []
        for d in disputes:
            user = d.customer.user
            data.append({
                'id': str(d.id),
                'customer': f"{user.first_name} {user.last_name}".strip() or user.email,
                'email': user.email,
                'bill_id': str(d.bill.id),
                'bill_amount': str(d.bill.total_amount),
                'bill_date': d.bill.created_at.strftime('%Y-%m-%d'),
                'reason': d.reason,
                'status': d.status,
                'admin_notes': d.admin_notes or '',
                'created_at': d.created_at.strftime('%Y-%m-%d %H:%M'),
            })
        return Response(data)


class AdminUserListView(APIView):
    """Returns all users with their current role — for admin role management."""
    permission_classes = [IsAdminOrStaff]

    def get(self, request):
        users = User.objects.select_related('role').order_by('first_name', 'last_name')
        roles = Role.objects.all()
        user_data = []
        for u in users:
            user_data.append({
                'id': str(u.id),
                'email': u.email,
                'full_name': f"{u.first_name} {u.last_name}".strip() or u.email,
                'role': u.role.name if u.role else None,
                'role_id': u.role.id if u.role else None,
                'is_staff': u.is_staff,
                'created_at': u.created_at.strftime('%Y-%m-%d'),
            })
        role_data = [{'id': r.id, 'name': r.name} for r in roles]
        return Response({'users': user_data, 'roles': role_data})


class AdminSetRoleView(APIView):
    """Allows admin to assign or remove a role from any user."""
    permission_classes = [IsAdminOrStaff]

    def patch(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        role_id = request.data.get('role_id')  # null = remove role

        if role_id is None:
            target_user.role = None
        else:
            try:
                role = Role.objects.get(id=role_id)
                target_user.role = role
            except Role.DoesNotExist:
                return Response({'error': 'Role not found'}, status=404)

        target_user.save(update_fields=['role'])
        return Response({
            'id': str(target_user.id),
            'email': target_user.email,
            'role': target_user.role.name if target_user.role else None,
        })

class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'anon'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.filter(email=email).first()
            if user:
                # Generate token and uid
                token = default_token_generator.make_token(user)
                uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
                
                # Create the link pointing to the frontend React app
                frontend_url = 'http://localhost:3000' if django_settings.DEBUG else 'https://yourdomain.com'
                reset_link = f"{frontend_url}/reset-password/{uidb64}/{token}"

                # Send email
                try:
                    send_html_email(
                        subject='Password Reset - AquaBill AI',
                        template_name='emails/password_reset.html',
                        context={'reset_link': reset_link},
                        recipient_list=[user.email],
                        fail_silently=False,
                    )
                except Exception as e:
                    print(f"Error sending email: {e}")
            
            # Always return success to prevent email enumeration
            return Response(
                {"message": "If an account with that email exists, we have sent a password reset link."},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            uidb64 = serializer.validated_data['uidb64']
            token = serializer.validated_data['token']
            new_password = serializer.validated_data['new_password']

            try:
                uid = force_str(urlsafe_base64_decode(uidb64))
                user = User.objects.get(pk=uid)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                user = None

            if user is not None and default_token_generator.check_token(user, token):
                # Hash the password and save using Django's built-in helper
                user.set_password(new_password)
                user.save()
                return Response({"message": "Password has been successfully reset."}, status=status.HTTP_200_OK)
            
            return Response({"error": "Invalid or expired reset link."}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    """Verify email address using a 6-digit OTP code."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            user = User.objects.get(email=data['email'])
        except User.DoesNotExist:
            return Response(
                {'error': 'No account found with this email address.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if user.is_email_verified:
            return Response(
                {'error': 'This email is already verified. You can log in.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find a valid (unused, not expired) OTP for this user
        otp = EmailVerification.objects.filter(
            user=user,
            otp_code=data['otp_code'],
            is_used=False,
            expires_at__gt=timezone.now(),
        ).order_by('-created_at').first()

        if not otp:
            return Response(
                {'error': 'Invalid or expired verification code. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark OTP as used and activate user
        otp.is_used = True
        otp.save(update_fields=['is_used'])

        user.is_active = True
        user.is_email_verified = True
        user.save(update_fields=['is_active', 'is_email_verified'])

        # Return tokens so user is logged in immediately
        tokens = generate_tokens(user)
        return Response({
            'message': 'Email verified successfully!',
            'user': UserSerializer(user).data,
            **tokens
        })


class ResendOTPView(APIView):
    """Resend OTP verification code to the user's email."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'  # Reuse the login rate limit (10/min)

    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't reveal whether email exists
            return Response(
                {'message': 'If an account with that email exists, a new verification code has been sent.'},
                status=status.HTTP_200_OK
            )

        if user.is_email_verified:
            return Response(
                {'error': 'This email is already verified. You can log in.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check cooldown — prevent resend within 60 seconds
        recent_otp = EmailVerification.objects.filter(
            user=user,
            is_used=False,
            created_at__gt=timezone.now() - timedelta(seconds=60),
        ).first()

        if recent_otp:
            return Response(
                {'error': 'Please wait before requesting another code.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        try:
            _create_and_send_otp(user)
        except Exception as e:
            print(f"Error sending OTP email: {e}")
            return Response(
                {'error': 'Failed to send verification email. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {'message': 'A new verification code has been sent to your email.'},
            status=status.HTTP_200_OK
        )

class SystemNotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import SystemNotification
        notifications = SystemNotification.objects.filter(
            user=request.user
        ).order_by('-created_at')[:50]
        serializer = SystemNotificationSerializer(notifications, many=True)
        return Response(serializer.data)

class SystemNotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk=None):
        from .models import SystemNotification
        if pk:
            try:
                notification = SystemNotification.objects.get(id=pk, user=request.user)
                notification.is_read = True
                notification.save(update_fields=['is_read'])
            except SystemNotification.DoesNotExist:
                return Response({'error': 'Notification not found'}, status=404)
        else:
            # Mark all as read
            SystemNotification.objects.filter(user=request.user, is_read=False).update(is_read=True)
            
        return Response({'success': True})


class SystemControlView(APIView):
    """
    Admin endpoint to activate/deactivate the billing system.
    GET  → returns current system status
    POST → toggles the system and notifies all customers
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import SystemSetting
        system_active = SystemSetting.get('billing_system_active', 'true')
        return Response({
            'system_active': system_active == 'true',
            'updated_at': SystemSetting.objects.filter(key='billing_system_active').values_list('updated_at', flat=True).first()
        })

    def post(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get('action')  # 'activate' or 'deactivate'
        if action not in ['activate', 'deactivate']:
            return Response({'error': 'action must be "activate" or "deactivate"'}, status=status.HTTP_400_BAD_REQUEST)

        from .models import SystemSetting, SystemNotification, Customer

        is_activating = action == 'activate'
        SystemSetting.set('billing_system_active', 'true' if is_activating else 'false')

        # Send notification to all customers
        if is_activating:
            subject = '✅ Water Billing System Activated'
            msg = 'The water billing system has been activated. You can now scan your water meter and generate bills through the app. Thank you for using our services!'
        else:
            subject = '⚠️ Water Billing System Deactivated'
            msg = 'The water billing system has been temporarily deactivated by the administration. Meter scanning and bill generation are currently unavailable. We will notify you when the system is back online.'

        # Create in-app notifications for all customers
        customers = Customer.objects.filter(deleted_at__isnull=True).select_related('user')
        notifications = []
        customer_emails = []
        for c in customers:
            notifications.append(SystemNotification(
                user=c.user,
                alert_type='INFO' if is_activating else 'WARNING',
                message=msg
            ))
            if c.user.email:
                customer_emails.append(c.user.email)

        SystemNotification.objects.bulk_create(notifications)

        # Send bulk email
        if customer_emails:
            for email in customer_emails:
                try:
                    send_html_email(
                        subject=subject,
                        template_name='emails/notification.html',
                        context={
                            'name': 'Valued Customer',
                            'message': msg
                        },
                        recipient_list=[email],
                        fail_silently=True,
                    )
                except Exception:
                    pass

        # Audit log
        from .models import AuditLog
        AuditLog.objects.create(
            user=request.user,
            action=f"SYSTEM_{action.upper()}",
            entity_type="SystemSetting",
            entity_id="billing_system_active",
            ip_address=request.META.get('REMOTE_ADDR', '0.0.0.0'),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            metadata={"new_value": 'true' if is_activating else 'false'}
        )

        return Response({
            'success': True,
            'system_active': is_activating,
            'message': f'System {"activated" if is_activating else "deactivated"} successfully. {len(notifications)} customers notified.'
        })
