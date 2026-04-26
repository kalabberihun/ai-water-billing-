from django.urls import path
from .views import (
    BillListView, BillDetailView, PaymentCreateView, 
    CustomerDashboardStatsView, BillPDFView, MpesaSimulationView,
    ConsumptionPredictionView,
    ChapaInitializeView, ChapaCallbackView, ChapaVerifyView,
    DisputeListView, DisputeCreateView, AdminDisputeUpdateView
)

urlpatterns = [
    path('bills', BillListView.as_view(), name='bills'),
    path('bills/<uuid:pk>', BillDetailView.as_view(), name='bill-detail'),
    path('bills/<uuid:bill_id>/pdf', BillPDFView.as_view(), name='bill-pdf'),
    path('pay-sim', MpesaSimulationView.as_view(), name='mpesa-pay-sim'),
    path('prediction', ConsumptionPredictionView.as_view(), name='consumption-prediction'),
    path('payments', PaymentCreateView.as_view(), name='payments'),
    path('customer-stats', CustomerDashboardStatsView.as_view(), name='customer-stats'),
    # Chapa Payment
    path('chapa/initialize/', ChapaInitializeView.as_view(), name='chapa-initialize'),
    path('chapa/callback/', ChapaCallbackView.as_view(), name='chapa-callback'),
    path('chapa/verify/<str:tx_ref>/', ChapaVerifyView.as_view(), name='chapa-verify'),
    # Disputes
    path('disputes', DisputeListView.as_view(), name='disputes-list'),
    path('disputes/create/', DisputeCreateView.as_view(), name='dispute-create'),
    path('disputes/<uuid:dispute_id>/resolve/', AdminDisputeUpdateView.as_view(), name='dispute-resolve'),
]

