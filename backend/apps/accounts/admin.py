from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, Customer, Role, AuditLog
from apps.metering.models import Meter


# ─── Inline: show & assign meters directly on the Customer page ───────────────
class MeterInline(admin.TabularInline):
    """Allows admins to assign or re-assign a meter to a customer inline."""
    model = Meter
    fields = ('meter_number', 'status', 'installation_date', 'location_description')
    extra = 1          # show one blank row so admin can assign a new meter
    can_delete = False # prevent accidental deletion from this view
    verbose_name = "Assigned Meter"
    verbose_name_plural = "Assigned Meters"
    show_change_link = True  # link to full Meter edit page


# ─── Customer Admin ────────────────────────────────────────────────────────────
@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display  = ('get_full_name', 'get_email', 'city', 'get_meter_numbers', 'created_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'city')
    list_filter   = ('city', 'created_at')
    inlines       = [MeterInline]

    @admin.display(description='Customer Name')
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or "—"

    @admin.display(description='Email')
    def get_email(self, obj):
        return obj.user.email

    @admin.display(description='Meters')
    def get_meter_numbers(self, obj):
        meters = obj.meters.values_list('meter_number', flat=True)
        if not meters:
            return format_html('<span style="color:#aaa;">No meter</span>')
        return ", ".join(meters)


# ─── User Admin ────────────────────────────────────────────────────────────────
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ('email', 'first_name', 'last_name', 'role', 'is_staff', 'is_active', 'created_at')
    list_filter   = ('is_active', 'is_staff', 'role', 'created_at')
    search_fields = ('email', 'first_name', 'last_name')
    ordering      = ('-created_at',)
    list_editable = ('is_staff', 'is_active')   # ← change right from the list view

    # Override the default fieldsets so 'role' appears in the edit form
    fieldsets = (
        (None,               {'fields': ('email', 'password')}),
        ('Personal Info',    {'fields': ('first_name', 'last_name')}),
        ('Role & Access',    {'fields': ('role', 'is_staff', 'is_superuser', 'is_active'),
                              'description': '⚠️ Check "Staff status" to grant Django admin access. '
                                             'Assign a Role for app-level permissions.'}),
        ('Permissions',      {'fields': ('groups', 'user_permissions'),
                              'classes': ('collapse',)}),
        ('Important dates',  {'fields': ('last_login',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields':  ('email', 'first_name', 'last_name', 'role',
                        'is_staff', 'password1', 'password2'),
        }),
    )


# ─── Role Admin ───────────────────────────────────────────────────────────────
@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display  = ('name', 'permissions')
    search_fields = ('name',)


# ─── Audit Log Admin ──────────────────────────────────────────────────────────
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display   = ('action', 'entity_type', 'user', 'ip_address', 'created_at')
    list_filter    = ('action', 'entity_type', 'created_at')
    search_fields  = ('user__email', 'entity_id', 'ip_address')
    readonly_fields = ('user', 'action', 'entity_type', 'entity_id',
                       'ip_address', 'user_agent', 'metadata', 'created_at')
