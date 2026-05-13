from django.urls import path
from django.http import JsonResponse
from .export import ExportBillingDataView, ExportCustomerListView, ExportAnomalyReportView

urlpatterns = [
    path('health', lambda r: JsonResponse({'status': 'healthy'}), name='health'),
    # Excel Export endpoints
    path('export/bills/', ExportBillingDataView.as_view(), name='export-bills'),
    path('export/customers/', ExportCustomerListView.as_view(), name='export-customers'),
    path('export/anomalies/', ExportAnomalyReportView.as_view(), name='export-anomalies'),
]
