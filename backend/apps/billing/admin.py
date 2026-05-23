from django.contrib import admin
from .models import Bill, Payment, TariffTier, WaterAlert, Dispute

@admin.register(TariffTier)
class TariffTierAdmin(admin.ModelAdmin):
    list_display = ('min_usage', 'max_usage', 'price_per_unit')
    ordering = ('min_usage',)

@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'consumption', 'total_amount', 'status', 'due_date', 'is_paid')
    list_filter = ('status', 'due_date', 'created_at')
    search_fields = ('customer__user__email', 'id')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)

    def is_paid(self, obj):
        return obj.status == 'PAID'
    is_paid.boolean = True
    is_paid.short_description = 'Paid?'

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('transaction_ref', 'bill', 'amount', 'payment_method', 'status', 'paid_at')
    list_filter = ('payment_method', 'status', 'paid_at')
    search_fields = ('transaction_ref', 'bill__id', 'bill__customer__user__email')
    readonly_fields = ('paid_at',)

@admin.register(WaterAlert)
class WaterAlertAdmin(admin.ModelAdmin):
    list_display = ('customer', 'alert_type', 'is_resolved', 'created_at')
    list_filter = ('alert_type', 'is_resolved', 'created_at')
    search_fields = ('customer__user__email', 'message')
    readonly_fields = ('created_at',)
    list_editable = ('is_resolved',)

@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ('id', 'bill', 'customer', 'status', 'created_at', 'resolved_at')
    list_filter = ('status', 'created_at', 'resolved_at')
    search_fields = ('customer__user__email', 'id', 'bill__id')
    readonly_fields = ('created_at',)
    list_editable = ('status',)
    ordering = ('-created_at',)
