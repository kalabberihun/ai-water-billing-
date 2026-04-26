from datetime import date
from decimal import Decimal
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Avg
from .models import Bill, Payment, TariffTier, WaterAlert, Dispute
from .serializers import BillSerializer, PaymentSerializer, DisputeSerializer
import logging

logger = logging.getLogger(__name__)

class BillListView(generics.ListAPIView):
    serializer_class = BillSerializer
    
    def get_queryset(self):
        if hasattr(self.request.user, 'customer'):
            return Bill.objects.filter(
                customer=self.request.user.customer
            ).select_related('reading').order_by('-created_at')
        return Bill.objects.all().select_related('customer', 'reading')

class BillDetailView(generics.RetrieveAPIView):
    serializer_class = BillSerializer
    
    def get_queryset(self):
        if hasattr(self.request.user, 'customer'):
            return Bill.objects.filter(customer=self.request.user.customer)
        return Bill.objects.all()

class PaymentCreateView(APIView):
    def post(self, request):
        bill_id = request.data.get('bill_id')
        try:
            bill = Bill.objects.get(id=bill_id)
            
            # Verify ownership
            if request.user.customer != bill.customer:
                return Response({'error': 'Unauthorized'}, status=403)

            # Payment interval limit
            today = timezone.now().date()
            if Payment.objects.filter(bill__customer=request.user.customer, status='COMPLETED', paid_at__year=today.year, paid_at__month=today.month).exists():
                return Response({'error': "You have already made a payment this month. Additional payments are restricted until next month."}, status=400)
            
            # Payment gateway integration here
            # For demo, mark as completed immediately
            payment = Payment.objects.create(
                bill=bill,
                amount=bill.total_amount,
                transaction_ref=f"MANUAL_{bill.id}_{timezone.now().timestamp()}",
                payment_method=request.data.get('method', 'manual'),
                status='COMPLETED',
                paid_at=timezone.now()
            )
            
            bill.status = 'PAID'
            bill.paid_at = timezone.now()
            bill.save()
            
            return Response(PaymentSerializer(payment).data)
            
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found'}, status=404)

class CustomerDashboardStatsView(APIView):
    """Returns aggregated stats and recent usage history for the Customer Dashboard."""
    
    def get(self, request):
        if not hasattr(request.user, 'customer'):
            return Response({'error': 'No customer profile found'}, status=400)
            
        customer = request.user.customer
        from django.db.models import Sum
        
        # 1. Current Balance (Sum of unpaid/overdue bills)
        balance = Bill.objects.filter(
            customer=customer, 
            status__in=['UNPAID', 'OVERDUE']
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        
        # 2. Latest Bill Info
        latest_bill = Bill.objects.filter(customer=customer).order_by('-created_at').first()
        
        last_reading = "0"
        monthly_usage = "0"
        days_to_due = 0
        
        if latest_bill:
            last_reading = str(latest_bill.current_reading)
            monthly_usage = str(latest_bill.consumption)
            
            if latest_bill.status in ['UNPAID', 'OVERDUE'] and latest_bill.due_date:
                from datetime import date
                delta = (latest_bill.due_date - date.today()).days
                days_to_due = max(0, delta)
        
        # 3. Last 6 Months Usage History (for the chart)
        # Derive from verified meter readings (differences = monthly consumption)
        from apps.metering.models import Meter, MeterReading
        from django.db.models import Q

        meter = Meter.objects.filter(customer=customer).first()
        if meter:
            verified_readings = list(
                MeterReading.objects.filter(
                    meter=meter,
                    status='VERIFIED'
                ).order_by('submitted_at')[:7]  # 7 readings = up to 6 intervals
            )
            usage_history = []
            for i in range(1, len(verified_readings)):
                prev = verified_readings[i - 1]
                curr = verified_readings[i]
                consumption_val = float(curr.reading_value - prev.reading_value)
                if consumption_val < 0:
                    consumption_val = 0  # meter reset protection
                usage_history.append({
                    'name': curr.submitted_at.strftime('%b %Y'),
                    'usage': round(consumption_val, 2)
                })
        else:
            # Fallback to billing records
            recent_bills = Bill.objects.filter(customer=customer).order_by('-created_at')[:6]
            usage_history = []
            for b in reversed(recent_bills):
                usage_history.append({
                    'name': b.created_at.strftime('%b %Y'),
                    'usage': float(b.consumption)
                })

        # 4. Active Leak/Spike Alerts
        alerts = list(WaterAlert.objects.filter(
            customer=customer, 
            is_resolved=False
        ).values('id', 'alert_type', 'message', 'created_at'))
        
        return Response({
            'balance': f"{balance:,.2f}",
            'last_reading': last_reading,
            'monthly_usage': monthly_usage,
            'days_to_due': days_to_due,
            'usage_history': usage_history,
            'alerts': list(alerts)
        })

from django.http import FileResponse
from .utils import generate_invoice_pdf

from .prediction import predict_next_consumption

class ConsumptionPredictionView(APIView):
    """Provides AI-driven consumption forecasts for customers."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not hasattr(request.user, 'customer'):
            return Response({'error': 'Prediction only available for customers'}, status=400)
            
        prediction_data = predict_next_consumption(request.user.customer)
        
        if not prediction_data:
            return Response({
                'message': 'Insufficient data for prediction. Please wait until you have at least 2 bills.'
            }, status=200)
            
        # Estimate cost based on predicted units
        # Simple estimation using average price per unit (can be made more precise with tiers)
        from .models import TariffTier
        avg_price = TariffTier.objects.all().aggregate(avg=Avg('price_per_unit'))['avg'] or 50
        estimated_cost = float(prediction_data['predicted_consumption']) * float(avg_price)
        
        prediction_data['estimated_cost'] = round(estimated_cost, 2)
        prediction_data['next_month'] = (date.today() + relativedelta(months=1)).strftime('%B %Y')
        
        return Response(prediction_data)

class BillPDFView(APIView):
    """Generates and returns a PDF invoice for a specific bill."""
    
    def get(self, request, bill_id):
        try:
            bill = Bill.objects.get(id=bill_id)
            
            # Authorization check
            is_owner = hasattr(request.user, 'customer') and request.user.customer == bill.customer
            if not request.user.is_staff and not is_owner:
                return Response({'error': 'Unauthorized'}, status=403)
                
            buffer = generate_invoice_pdf(bill)
            
            filename = f"Invoice_{bill.created_at.strftime('%Y%m%d')}_{str(bill.id)[:8]}.pdf"
            
            return FileResponse(
                buffer, 
                as_attachment=True, 
                filename=filename,
                content_type='application/pdf'
            )
            
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found'}, status=404)
import threading

class MpesaSimulationView(APIView):
    """Simulates an M-Pesa STK Push and a background webhook callback."""
    
    def post(self, request):
        bill_id = request.data.get('bill_id')
        phone = request.data.get('phone', '254700000000')
        
        try:
            bill = Bill.objects.get(id=bill_id)
            
            # 1. Simulate the "STK Push Sent" response
            # In a real app, you'd hit Daraja API here.
            
            def simulate_callback(bill_id):
                # Wait 10 seconds to simulate user typing PIN
                import time
                time.sleep(10)
                
                from django.utils import timezone
                try:
                    b = Bill.objects.get(id=bill_id)
                    b.status = 'PAID'
                    b.paid_at = timezone.now()
                    b.save()
                    
                    # Also create a payment record
                    Payment.objects.create(
                        bill=b,
                        amount=b.total_amount,
                        transaction_ref=f"MPESA_{str(b.id)[:8]}_{int(time.time())}",
                        payment_method='mobile_money',
                        status='COMPLETED',
                        paid_at=timezone.now()
                    )
                    print(f"DEBUG: M-Pesa Simulation - Bill {bill_id} marked as PAID")
                except Exception as e:
                    print(f"DEBUG: M-Pesa Simulation Error - {e}")

            # Start the background simulator
            thread = threading.Thread(target=simulate_callback, args=(bill_id,))
            thread.start()
            
            return Response({
                'message': 'STK Push sent to your phone. Please enter your M-Pesa PIN.',
                'CheckoutRequestID': f"SIM_{str(bill_id)[:8]}"
            }, status=200)
            
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found'}, status=404)


# ─── Chapa Payment Integration ───────────────────────────────────────────────

import uuid as uuid_lib
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .chapa import initialize_transaction, verify_transaction


class ChapaInitializeView(APIView):
    """
    Initialize a Chapa payment for a given bill.
    POST body: { "bill_id": "<uuid>" }
    Returns: { "checkout_url": "https://checkout.chapa.co/..." }
    """

    def post(self, request):
        bill_id = request.data.get('bill_id')
        if not bill_id:
            return Response({'error': 'bill_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bill = Bill.objects.select_related('customer__user').get(id=bill_id)
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found'}, status=status.HTTP_404_NOT_FOUND)

        # Authorization: only the bill owner (or staff) can pay
        is_owner = hasattr(request.user, 'customer') and request.user.customer == bill.customer
        if not request.user.is_staff and not is_owner:
            logger.warning(f"Chapa: Unauthorized attempt to pay bill {bill_id} by user {request.user}")
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        if bill.status == 'PAID':
            return Response({'error': 'Bill is already paid'}, status=status.HTTP_400_BAD_REQUEST)

        # Payment interval limit
        today = timezone.now().date()
        if Payment.objects.filter(bill__customer=bill.customer, status='COMPLETED', paid_at__year=today.year, paid_at__month=today.month).exists():
            return Response({'error': "You have already made a payment this month. Additional payments are restricted until next month."}, status=status.HTTP_400_BAD_REQUEST)

        # Generate a unique transaction reference
        tx_ref = f"WATER-{str(bill.id)[:8]}-{uuid_lib.uuid4().hex[:8]}"

        # Build callback and return URLs
        base_url = request.build_absolute_uri('/').rstrip('/')
        callback_url = f"{base_url}/api/billing/chapa/callback/"

        # Frontend return URL after Chapa checkout
        frontend_url = request.headers.get('Origin', 'http://localhost:3000')
        return_url = f"{frontend_url}/payment/callback?tx_ref={tx_ref}&bill_id={bill_id}"

        user = bill.customer.user
        phone = None
        if hasattr(request.user, 'customer') and request.user.customer.phone:
            # Basic cleaning: remove spaces, dashes, etc. Keep only digits and leading +
            phone = "".join(c for c in request.user.customer.phone if c.isdigit() or c == '+')

        # Initialize Chapa transaction
        chapa_res = initialize_transaction(
            amount=bill.total_amount,
            email=request.user.email,
            first_name=request.user.first_name,
            last_name=request.user.last_name,
            tx_ref=tx_ref,
            callback_url=callback_url,
            return_url=return_url,
            currency='ETB', # Chapa requires currency
            phone_number=phone
        )

        if not chapa_res:
            logger.error(f"Chapa: Initialization failed for bill {bill_id}. User: {request.user.email}")
            return Response(
                {'error': 'Failed to initialize payment with Chapa. Please check if your profile has a valid phone number.'}, 
                status=status.HTTP_502_BAD_GATEWAY
            )

        # Create a pending payment record
        Payment.objects.create(
            bill=bill,
            amount=bill.total_amount,
            transaction_ref=tx_ref,
            chapa_tx_ref=tx_ref,
            payment_method='chapa',
            status='PENDING',
        )

        checkout_url = chapa_res.get('data', {}).get('checkout_url')
        return Response({
            'checkout_url': checkout_url,
            'tx_ref': tx_ref,
            'message': 'Redirecting to Chapa checkout...',
        })


@method_decorator(csrf_exempt, name='dispatch')
class ChapaCallbackView(APIView):
    """
    Webhook endpoint called by Chapa after payment completion.
    This view is CSRF-exempt and does not require authentication.
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        tx_ref = request.data.get('tx_ref') or request.data.get('trx_ref')

        if not tx_ref:
            return Response({'error': 'tx_ref is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify the transaction with Chapa
        verification = verify_transaction(tx_ref)
        if not verification:
            return Response(
                {'error': 'Could not verify transaction'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        chapa_data = verification.get('data', {})
        chapa_status = chapa_data.get('status', '').lower()

        try:
            payment = Payment.objects.select_related('bill').get(chapa_tx_ref=tx_ref)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

        if chapa_status == 'success':
            payment.status = 'COMPLETED'
            payment.paid_at = timezone.now()
            payment.provider_response = chapa_data
            payment.save()

            # Mark the bill as paid
            bill = payment.bill
            bill.status = 'PAID'
            bill.paid_at = timezone.now()
            bill.save()

            return Response({'message': 'Payment verified and bill marked as paid'})
        else:
            payment.status = 'FAILED'
            payment.provider_response = chapa_data
            payment.save()
            return Response({'message': f'Payment status: {chapa_status}'})


class ChapaVerifyView(APIView):
    """
    Manual verification endpoint for the frontend to check payment status.
    GET /api/billing/chapa/verify/<tx_ref>/
    """

    def get(self, request, tx_ref):
        # First check our local database
        try:
            payment = Payment.objects.select_related('bill').get(chapa_tx_ref=tx_ref)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

        # If already completed locally, return immediately
        if payment.status == 'COMPLETED':
            return Response({
                'status': 'success',
                'message': 'Payment completed successfully',
                'bill_id': str(payment.bill.id),
                'bill_status': payment.bill.status,
                'amount': str(payment.amount),
                'paid_at': payment.paid_at.isoformat() if payment.paid_at else None,
            })

        # Otherwise, verify with Chapa
        verification = verify_transaction(tx_ref)
        if not verification:
            return Response({
                'status': 'pending',
                'message': 'Payment is still being processed',
                'bill_id': str(payment.bill.id),
            })

        chapa_data = verification.get('data', {})
        chapa_status = chapa_data.get('status', '').lower()

        if chapa_status == 'success':
            payment.status = 'COMPLETED'
            payment.paid_at = timezone.now()
            payment.provider_response = chapa_data
            payment.save()

            bill = payment.bill
            bill.status = 'PAID'
            bill.paid_at = timezone.now()
            bill.save()

            return Response({
                'status': 'success',
                'message': 'Payment completed successfully',
                'bill_id': str(bill.id),
                'bill_status': 'PAID',
                'amount': str(payment.amount),
                'paid_at': payment.paid_at.isoformat(),
            })
        elif chapa_status in ('failed', 'cancelled'):
            payment.status = 'FAILED'
            payment.provider_response = chapa_data
            payment.save()

            return Response({
                'status': 'failed',
                'message': 'Payment was not successful',
                'bill_id': str(payment.bill.id),
            })
        else:
            return Response({
                'status': 'pending',
                'message': 'Payment is still being processed',
                'bill_id': str(payment.bill.id),
            })

class DisputeListView(generics.ListAPIView):
    serializer_class = DisputeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff or (user.role and user.role.name.upper() in ['ADMIN', 'CLERK']):
            return Dispute.objects.all().select_related('bill', 'customer__user')
        if hasattr(user, 'customer'):
            return Dispute.objects.filter(customer=user.customer).select_related('bill')
        return Dispute.objects.none()

class DisputeCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        if not hasattr(request.user, 'customer'):
            return Response({'error': 'Only customers can file disputes'}, status=status.HTTP_403_FORBIDDEN)
            
        bill_id = request.data.get('bill_id') or request.data.get('bill')
        reason = request.data.get('reason')
        
        if not bill_id or not reason:
            return Response({'error': 'bill and reason are required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            bill = Bill.objects.get(id=bill_id, customer=request.user.customer)
        except Bill.DoesNotExist:
            return Response({'error': 'Bill not found'}, status=status.HTTP_404_NOT_FOUND)
            
        # Prevent duplicate disputes
        if Dispute.objects.filter(bill=bill, status__in=['PENDING', 'IN_PROGRESS']).exists():
            return Response({'error': 'An active dispute already exists for this bill'}, status=status.HTTP_400_BAD_REQUEST)
            
        dispute = Dispute.objects.create(
            bill=bill,
            customer=request.user.customer,
            reason=reason
        )
        
        return Response(DisputeSerializer(dispute).data, status=status.HTTP_201_CREATED)


class AdminDisputeUpdateView(APIView):
    """Allows admin/staff to resolve or reject a dispute."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, dispute_id):
        # Only admins/staff can update
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            dispute = Dispute.objects.select_related('bill').get(id=dispute_id)
        except Dispute.DoesNotExist:
            return Response({'error': 'Dispute not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        admin_notes = request.data.get('admin_notes', '')

        allowed = ['RESOLVED', 'REJECTED', 'IN_PROGRESS']
        if new_status not in allowed:
            return Response({'error': f'Status must be one of: {allowed}'}, status=status.HTTP_400_BAD_REQUEST)

        dispute.status = new_status
        dispute.admin_notes = admin_notes
        if new_status in ['RESOLVED', 'REJECTED']:
            from django.utils import timezone
            dispute.resolved_at = timezone.now()
        dispute.save()

        return Response(DisputeSerializer(dispute).data)
