from django.contrib import admin
from django.utils.html import format_html
from .models import Meter, MeterReading


# ─── Meter Reading Inline ─────────────────────────────────────────────────────
class MeterReadingInline(admin.TabularInline):
    model       = MeterReading
    fields      = ('submitted_at', 'reading_value', 'ocr_confidence', 'status', 'verified_by', 'notes')
    readonly_fields = ('submitted_at', 'reading_value', 'ocr_confidence')
    extra       = 0
    can_delete  = False
    ordering    = ('-submitted_at',)
    show_change_link = True
    verbose_name = "Reading"
    verbose_name_plural = "Readings (latest first)"


# ─── Meter Admin ──────────────────────────────────────────────────────────────
@admin.register(Meter)
class MeterAdmin(admin.ModelAdmin):
    list_display    = ('meter_number', 'get_customer', 'get_customer_email',
                       'status', 'installation_date', 'created_at')
    list_filter     = ('status', 'installation_date', 'created_at')
    search_fields   = ('meter_number', 'customer__user__email',
                       'customer__user__first_name', 'customer__user__last_name')
    list_editable   = ('status',)           # change status straight from list
    ordering        = ('-created_at',)
    inlines         = [MeterReadingInline]

    # Fields shown on the edit page – customer can be changed here
    fieldsets = (
        ('Meter Details', {
            'fields': ('meter_number', 'status', 'installation_date', 'location_description')
        }),
        ('Customer Assignment', {
            'fields': ('customer',),
            'description': '⚡ Assign or re-assign this meter to a different customer.',
        }),
    )

    @admin.display(description='Customer')
    def get_customer(self, obj):
        if obj.customer:
            u = obj.customer.user
            name = f"{u.first_name} {u.last_name}".strip()
            return name or "—"
        return format_html('<span style="color:#aaa;">Unassigned</span>')

    @admin.display(description='Customer Email')
    def get_customer_email(self, obj):
        if obj.customer:
            return obj.customer.user.email
        return "—"


# ─── Meter Reading Admin ──────────────────────────────────────────────────────
@admin.register(MeterReading)
class MeterReadingAdmin(admin.ModelAdmin):
    list_display    = ('get_meter_number', 'reading_value', 'ocr_confidence',
                       'status', 'submitted_at', 'verified_by')
    list_filter     = ('status', 'submitted_at')
    search_fields   = ('meter__meter_number',)
    list_editable   = ('status',)
    readonly_fields = ('submitted_at', 'processed_at', 'ocr_confidence', 'reading_value', 'image_url')
    ordering        = ('-submitted_at',)

    fieldsets = (
        ('Reading Info', {
            'fields': ('meter', 'image_url', 'reading_value', 'ocr_confidence', 'submitted_at', 'processed_at')
        }),
        ('Review', {
            'fields': ('status', 'verified_by', 'notes'),
        }),
    )

    @admin.display(description='Meter #')
    def get_meter_number(self, obj):
        return obj.meter.meter_number
