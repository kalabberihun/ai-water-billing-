import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from encrypted_model_fields.fields import EncryptedCharField, EncryptedTextField

class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    permissions = models.JSONField(default=list)
    
    def __str__(self):
        return self.name

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email
        
    def get_short_name(self):
        return self.first_name or self.email
    
    class Meta:
        db_table = 'users'
        indexes = [models.Index(fields=['role'])]

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer')
    national_id = EncryptedCharField(max_length=50, unique=True)
    phone = EncryptedCharField(max_length=20, null=True, blank=True)
    address = EncryptedTextField(null=True, blank=True)
    city = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'customers'
        indexes = [models.Index(fields=['deleted_at'])]

class AuditLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=50)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'audit_logs'
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['created_at']),
        ]

class SystemNotification(models.Model):
    ALERT_TYPES = [
        ('LEAK', 'Potential Leak'),
        ('SPIKE', 'Unusual Usage Spike'),
        ('INFO', 'Information'),
        ('WARNING', 'Warning'),
        ('TASK', 'Task Assigned'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES, default='INFO')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'system_notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return f"{self.alert_type} Notification for {self.user.email}"


class EmailVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_verifications')
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = 'email_verifications'
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"OTP for {self.user.email} ({'used' if self.is_used else 'active'})"
