from django.urls import path
from .views import (
    RegisterView, LoginView, ProfileView, CustomerProfileView,
    AdminStatsView, AdminPendingReadingsView, RefreshView,
    AdminDisputesView, AdminUserListView, AdminSetRoleView,
    PasswordResetRequestView, PasswordResetConfirmView
)

urlpatterns = [
    path('register', RegisterView.as_view(), name='register'),
    path('login', LoginView.as_view(), name='login'),
    path('refresh', RefreshView.as_view(), name='refresh'),
    path('profile', ProfileView.as_view(), name='profile'),
    path('customer/profile', CustomerProfileView.as_view(), name='customer-profile'),
    
    # Password Reset
    path('password-reset', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset-confirm', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    
    # Admin endpoints
    path('admin/stats', AdminStatsView.as_view(), name='admin-stats'),
    path('admin/pending-readings', AdminPendingReadingsView.as_view(), name='admin-pending-readings'),
    path('admin/disputes', AdminDisputesView.as_view(), name='admin-disputes'),
    path('admin/users', AdminUserListView.as_view(), name='admin-users'),
    path('admin/users/<uuid:user_id>/set-role/', AdminSetRoleView.as_view(), name='admin-set-role'),
]
