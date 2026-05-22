from django.urls import path
from .views import (
    RegisterView, LoginView, ProfileView, CustomerProfileView,
    AdminStatsView, AdminPendingReadingsView, RefreshView,
    AdminDisputesView, AdminUserListView, AdminSetRoleView,
    PasswordResetRequestView, PasswordResetConfirmView,
    SystemNotificationListView, SystemNotificationMarkReadView,
    VerifyEmailView, ResendOTPView, SystemControlView
)

urlpatterns = [
    path('register', RegisterView.as_view(), name='register'),
    path('login', LoginView.as_view(), name='login'),
    path('refresh', RefreshView.as_view(), name='refresh'),
    path('profile', ProfileView.as_view(), name='profile'),
    path('customer/profile', CustomerProfileView.as_view(), name='customer-profile'),
    
    # Email Verification
    path('verify-email', VerifyEmailView.as_view(), name='verify-email'),
    path('resend-otp', ResendOTPView.as_view(), name='resend-otp'),
    
    # Password Reset
    path('password-reset', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset-confirm', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # Admin endpoints
    path('admin/stats', AdminStatsView.as_view(), name='admin-stats'),
    path('admin/system-control', SystemControlView.as_view(), name='admin-system-control'),
    path('admin/pending-readings', AdminPendingReadingsView.as_view(), name='admin-pending-readings'),
    path('admin/disputes', AdminDisputesView.as_view(), name='admin-disputes'),
    path('admin/users', AdminUserListView.as_view(), name='admin-users'),
    path('admin/users/<uuid:user_id>/set-role/', AdminSetRoleView.as_view(), name='admin-set-role'),
    
    # Notifications
    path('notifications/', SystemNotificationListView.as_view(), name='notifications'),
    path('notifications/<uuid:pk>/read/', SystemNotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/read-all/', SystemNotificationMarkReadView.as_view(), name='notification-mark-all-read'),
]
