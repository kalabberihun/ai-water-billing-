import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Meter(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('MAINTENANCE', 'Maintenance'),
        ('DISCONNECTED', 'Disconnected'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey('accounts.Customer', on_delete=models.CASCADE, related_name='meters', null=True, blank=True)
    meter_number = models.CharField(max_length=50, unique=True)
    installation_date = models.DateField()
    location_description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.meter_number

class MeterReading(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('VERIFIED', 'Verified'),
        ('MANUAL_REVIEW', 'Manual Review'),
        ('FIELD_TASK', 'Field Task'),
        ('REJECTED', 'Rejected'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meter = models.ForeignKey(Meter, on_delete=models.CASCADE, related_name='readings')
    reading_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    image_url = models.CharField(max_length=500, blank=True)
    ocr_confidence = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    submitted_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_reviews')
    assigned_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['meter', '-submitted_at']),
            models.Index(fields=['status', 'submitted_at']),
        ]

class MaintenanceTask(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meter = models.ForeignKey(Meter, on_delete=models.CASCADE, related_name='maintenance_tasks', null=True, blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_maintenance_tasks')
    issue_description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['assigned_to', 'status']),
        ]


class LeakageReport(models.Model):
    URGENCY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('UNDER_REVIEW', 'Under Review'),
        ('DISPATCHED', 'Dispatched'),
        ('RESOLVED', 'Resolved'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey('accounts.Customer', on_delete=models.CASCADE, related_name='leakage_reports')
    meter = models.ForeignKey(Meter, on_delete=models.SET_NULL, null=True, blank=True, related_name='leakage_reports')
    location_description = models.TextField(help_text="Where is the leak? (e.g. near the meter, street pipe, inside home)")
    urgency = models.CharField(max_length=10, choices=URGENCY_CHOICES, default='MEDIUM')
    description = models.TextField(help_text="Describe what you are observing")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='SUBMITTED')
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['customer', '-created_at']),
        ]
    
    def __str__(self):
        return f"Leak Report #{str(self.id)[:8]} - {self.urgency}"
