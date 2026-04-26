import uuid
from decimal import Decimal
from django.db import models

class TariffTier(models.Model):
    """Tiered pricing structure"""
    min_usage = models.DecimalField(max_digits=12, decimal_places=2)
    max_usage = models.DecimalField(max_digits=12, decimal_places=2)
    price_per_unit = models.DecimalField(max_digits=12, decimal_places=4)
    
    class Meta:
        ordering = ['min_usage']
    
    def __str__(self):
        return f"{self.min_usage}-{self.max_usage} units @ {self.price_per_unit}"

class Bill(models.Model):
    STATUS_CHOICES = [
        ('UNPAID', 'Unpaid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
        ('VOID', 'Void'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey('accounts.Customer', on_delete=models.CASCADE, related_name='bills')
    reading = models.OneToOneField('metering.MeterReading', on_delete=models.CASCADE, related_name='bill')
    previous_reading = models.DecimalField(max_digits=12, decimal_places=2)
    current_reading = models.DecimalField(max_digits=12, decimal_places=2)
    consumption = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    penalty = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UNPAID')
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['status', 'due_date']),
            models.Index(fields=['customer', '-created_at']),
        ]

class Payment(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_ref = models.CharField(max_length=255, unique=True)
    chapa_tx_ref = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    payment_method = models.CharField(max_length=50)  # 'chapa', 'mobile_money', 'bank_transfer'
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    provider_response = models.JSONField(default=dict)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class WaterAlert(models.Model):
    """Flags for anomalous usage detected by system analysis."""
    ALERT_TYPES = [
        ('LEAK', 'Potential Leak'),
        ('SPIKE', 'Unusual Usage Spike'),
        ('TAMPER', 'Potential Meter Tampering'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey('accounts.Customer', on_delete=models.CASCADE, related_name='alerts')
    bill = models.ForeignKey(Bill, on_delete=models.SET_NULL, null=True, blank=True)
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.alert_type} - {self.customer.user.first_name} {self.customer.user.last_name} ({self.created_at.date()})"

class Dispute(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
        ('REJECTED', 'Rejected'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='disputes')
    customer = models.ForeignKey('accounts.Customer', on_delete=models.CASCADE, related_name='disputes')
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    admin_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"Dispute for Bill {self.bill.id} - {self.status}"
