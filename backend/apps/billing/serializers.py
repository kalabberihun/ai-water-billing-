from rest_framework import serializers
from .models import Bill, Payment, TariffTier, Dispute

class TariffSerializer(serializers.ModelSerializer):
    class Meta:
        model = TariffTier
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class BillSerializer(serializers.ModelSerializer):
    payment_status = serializers.CharField(source='status', read_only=True)
    meter_number = serializers.CharField(source='reading.meter.meter_number', read_only=True)
    
    class Meta:
        model = Bill
        fields = [
            'id', 'meter_number', 'previous_reading', 'current_reading',
            'consumption', 'subtotal', 'tax_amount', 'penalty', 
            'total_amount', 'due_date', 'status', 'payment_status',
            'created_at', 'paid_at'
        ]

class DisputeSerializer(serializers.ModelSerializer):
    bill_date = serializers.DateTimeField(source='bill.created_at', read_only=True)
    customer_name = serializers.CharField(source='customer.user.get_full_name', read_only=True)
    
    class Meta:
        model = Dispute
        fields = '__all__'
        read_only_fields = ['customer', 'status', 'admin_notes', 'resolved_at']
