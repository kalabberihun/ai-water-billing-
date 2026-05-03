from rest_framework import serializers
from .models import User, Customer, Role, SystemNotification

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SlugRelatedField(slug_field='name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'is_staff', 'is_active', 'is_email_verified', 'created_at']
        read_only_fields = ['id', 'created_at']

class CustomerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Customer
        fields = ['id', 'user', 'national_id', 'phone', 'address', 'city', 'created_at']
        read_only_fields = ['id', 'created_at']

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=50)
    last_name = serializers.CharField(max_length=50)
    national_id = serializers.CharField(max_length=50)
    meter_number = serializers.CharField(max_length=50)
    phone = serializers.CharField(max_length=20, required=False)
    address = serializers.CharField(required=False)
    city = serializers.CharField(max_length=100, required=False)
    customer_class = serializers.CharField(max_length=20, required=False)
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists")
        return value
    
    def validate_national_id(self, value):
        if Customer.objects.filter(national_id=value).exists():
            raise serializers.ValidationError("National ID already registered")
        return value

    def validate_meter_number(self, value):
        from apps.metering.models import Meter
        try:
            meter = Meter.objects.get(meter_number=value)
            # Check if this meter is already assigned to a customer
            # (In this schema, Meter has a FK to Customer, so we check if it's already set)
            # If the meter is already linked to a customer, it's taken.
            # However, usually there might be a default 'unassigned' customer or null.
            # Looking at Meter model: customer = models.ForeignKey('accounts.Customer'...)
            # We'll assume if it's already registered, we can't use it.
            if meter.customer_id:
                 raise serializers.ValidationError("Meter number is already assigned to another customer")
        except Meter.DoesNotExist:
            raise serializers.ValidationError("Invalid meter number. Please contact support.")
        return value

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetConfirmSerializer(serializers.Serializer):
    uidb64 = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6, min_length=6)

class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

class SystemNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemNotification
        fields = ['id', 'alert_type', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']

