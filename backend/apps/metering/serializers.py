from rest_framework import serializers
from .models import Meter, MeterReading, MaintenanceTask

class MeterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meter
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class MeterReadingSerializer(serializers.ModelSerializer):
    meter_number = serializers.CharField(source='meter.meter_number', read_only=True)
    
    class Meta:
        model = MeterReading
        fields = ['id', 'meter', 'meter_number', 'reading_value', 'image_url', 
                  'ocr_confidence', 'status', 'submitted_at', 'processed_at', 'notes']
        read_only_fields = ['id', 'submitted_at', 'processed_at', 'ocr_confidence']

class ReadingUploadSerializer(serializers.Serializer):
    meter_id = serializers.UUIDField()
    image = serializers.ImageField()

class VerifyReadingSerializer(serializers.Serializer):
    reading_id = serializers.UUIDField()
    confirmed_value = serializers.DecimalField(max_digits=12, decimal_places=2)

class MaintenanceTaskSerializer(serializers.ModelSerializer):
    meter_number = serializers.CharField(source='meter.meter_number', read_only=True)
    customer_name = serializers.CharField(source='meter.customer.user.get_full_name', read_only=True)
    tech_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    
    class Meta:
        model = MaintenanceTask
        fields = ['id', 'meter', 'meter_number', 'customer_name', 'assigned_to', 'tech_name', 
                  'issue_description', 'status', 'created_at', 'resolved_at', 'resolution_notes']
        read_only_fields = ['id', 'created_at', 'resolved_at']
