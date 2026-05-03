from django.urls import path
from .views import (
    MeterListView, ReadingListView, 
    UploadReadingView, VerifyReadingView,
    ReadingStatusView,
    AdminBatchAssignReviewsView, ClerkPendingReadingsView,
    AdminMaintenanceTaskView, TechnicianMaintenanceTaskView,
    CustomerLeakageReportView, AdminLeakageReportView
)

urlpatterns = [
    path('meters', MeterListView.as_view(), name='meters'),
    path('readings', ReadingListView.as_view(), name='readings'),
    path('readings/upload', UploadReadingView.as_view(), name='upload-reading'),
    path('readings/verify', VerifyReadingView.as_view(), name='verify-reading'),
    path('readings/<uuid:reading_id>/status', ReadingStatusView.as_view(), name='reading-status'),
    path('admin/batch-assign', AdminBatchAssignReviewsView.as_view(), name='batch-assign-reviews'),
    path('clerk/pending-readings', ClerkPendingReadingsView.as_view(), name='clerk-pending-readings'),
    path('admin/maintenance', AdminMaintenanceTaskView.as_view(), name='admin-maintenance'),
    path('admin/maintenance/<uuid:pk>', AdminMaintenanceTaskView.as_view(), name='admin-maintenance-detail'),
    path('technician/maintenance', TechnicianMaintenanceTaskView.as_view(), name='tech-maintenance-list'),
    path('technician/maintenance/<uuid:pk>', TechnicianMaintenanceTaskView.as_view(), name='tech-maintenance-detail'),
    # Leakage Reports
    path('leakage-reports', CustomerLeakageReportView.as_view(), name='customer-leakage-reports'),
    path('admin/leakage-reports', AdminLeakageReportView.as_view(), name='admin-leakage-reports'),
    path('admin/leakage-reports/<uuid:report_id>', AdminLeakageReportView.as_view(), name='admin-leakage-report-detail'),
]
