from datetime import date
from decimal import Decimal
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Avg, Sum
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
        # Check system active
        from apps.accounts.models import SystemSetting
        if SystemSetting.get('billing_system_active', 'true') != 'true':
            return Response(
                {'error': 'The water billing system is temporarily deactivated. Bill payments are currently unavailable.'},
                status=status.HTTP_403_FORBIDDEN
            )

        bill_id = request.data.get('bill_id')
        try:
            bill = Bill.objects.get(id=bill_id)
            
            # Verify ownership
            if request.user.customer != bill.customer:
                return Response({'error': 'Unauthorized'}, status=403)

            # Payment interval limit
            today = timezone.now().date()
            if Payment.objects.filter(bill__customer=request.user.customer, status='COMPLETED', paid_at__year=today.year, paid_at__month=today.month).exists():
                message = "You have already made a payment this month. Additional payments are restricted until next month."
                
                from apps.accounts.models import SystemNotification
                from utils.email import send_html_email
                
                SystemNotification.objects.create(
                    user=request.user,
                    alert_type='WARNING',
                    message=message
                )
                
                try:
                    send_html_email(
                        subject='Monthly Payment Restriction',
                        template_name='emails/notification.html',
                        context={
                            'name': request.user.first_name or 'Customer',
                            'message': message
                        },
                        recipient_list=[request.user.email],
                        fail_silently=True
                    )
                except Exception:
                    pass
                    
                return Response({'error': message}, status=400)
            
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
        customer_id = request.query_params.get('customer_id')
        
        # If admin/staff is requesting for a specific customer
        if customer_id and (request.user.is_staff or (request.user.role and request.user.role.name.upper() in ['ADMIN', 'CLERK'])):
            from apps.accounts.models import Customer
            try:
                customer = Customer.objects.get(id=customer_id)
            except Customer.DoesNotExist:
                return Response({'error': 'Customer not found'}, status=404)
        else:
            # Normal customer flow
            if not hasattr(request.user, 'customer'):
                return Response({'error': 'Prediction only available for customers'}, status=400)
            customer = request.user.customer
            
        prediction_data = predict_next_consumption(customer)
        
        if not prediction_data:
            return Response({
                'message': 'Insufficient data for prediction. Please wait until you have at least 2 bills.'
            }, status=200)
            
        # Estimate cost based on predicted units using actual tiered logic
        from decimal import Decimal
        from .models import TariffTier
        
        predicted_consumption = Decimal(str(prediction_data['predicted_consumption']))
        customer_class = customer.customer_class or 'RESIDENT'
        tiers = list(TariffTier.objects.filter(customer_class=customer_class))
        if not tiers:
            tiers = list(TariffTier.objects.filter(customer_class='RESIDENT'))
            
        subtotal = Decimal('0')
        remaining = predicted_consumption
        
        for i, tier in enumerate(tiers):
            if remaining <= 0:
                break
            if i == len(tiers) - 1:
                # Last tier is catch-all, consume all remaining consumption
                tier_usage = remaining
            else:
                tier_usage = min(remaining, tier.max_usage - tier.min_usage)
            subtotal += tier_usage * tier.price_per_unit
            remaining -= tier_usage
            
        # Add fixed base fee (e.g. meter maintenance fee)
        base_fee = Decimal('5.00')
        subtotal += base_fee
        
        # Add 5% tax
        tax_amount = subtotal * Decimal('0.05')
        estimated_cost = float(subtotal + tax_amount)
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
        # Check system active
        from apps.accounts.models import SystemSetting
        if SystemSetting.get('billing_system_active', 'true') != 'true':
            return Response(
                {'error': 'The water billing system is temporarily deactivated. Bill payments are currently unavailable.'},
                status=status.HTTP_403_FORBIDDEN
            )

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
        # Check system active
        from apps.accounts.models import SystemSetting
        if SystemSetting.get('billing_system_active', 'true') != 'true':
            return Response(
                {'error': 'The water billing system is temporarily deactivated. Bill payments are currently unavailable.'},
                status=status.HTTP_403_FORBIDDEN
            )

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
            message = "You have already made a payment this month. Additional payments are restricted until next month."
            
            from apps.accounts.models import SystemNotification
            from utils.email import send_html_email
            
            SystemNotification.objects.create(
                user=request.user,
                alert_type='WARNING',
                message=message
            )
            
            try:
                send_html_email(
                    subject='Monthly Payment Restriction',
                    template_name='emails/notification.html',
                    context={
                        'name': request.user.first_name or 'Customer',
                        'message': message
                    },
                    recipient_list=[request.user.email],
                    fail_silently=True
                )
            except Exception:
                pass

            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

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


class AdminCustomerPaymentsView(APIView):
    """
    Dashboard API for managing customer payments and meter connections.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN', 'CLERK']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        from apps.accounts.models import Customer
        from apps.metering.models import Meter

        # Calculate KPIs
        total_customers = Customer.objects.filter(deleted_at__isnull=True).count()
        
        # Paid this month (bills created/paid in the current month)
        now = timezone.now()
        paid_this_month = Bill.objects.filter(
            status='PAID',
            paid_at__year=now.year,
            paid_at__month=now.month
        ).count()

        unpaid = Bill.objects.filter(status='UNPAID').count()
        overdue = Bill.objects.filter(status='OVERDUE').count()
        
        total_revenue = Payment.objects.filter(status='COMPLETED').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Get customer list
        customers = Customer.objects.filter(deleted_at__isnull=True).select_related('user').order_by('user__first_name', 'user__last_name')
        
        customer_data = []
        for c in customers:
            # Latest bill
            latest_bill = c.bills.order_by('-created_at').first()
            current_bill_amount = latest_bill.total_amount if latest_bill else Decimal('0.00')
            latest_bill_date = latest_bill.created_at.strftime('%Y-%m-%d') if latest_bill else None
            
            # Determine payment status
            if not latest_bill:
                payment_status = 'UNPAID'
            elif latest_bill.status == 'PAID':
                payment_status = 'PAID'
            else:
                payments_total = latest_bill.payments.filter(status='COMPLETED').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
                if payments_total > Decimal('0.00') and payments_total < latest_bill.total_amount:
                    payment_status = 'PARTIAL'
                else:
                    payment_status = latest_bill.status
                
                # Payment Status should change to 'DUE' if it passes its due_date (monthly boundary) and is not paid
                if latest_bill.due_date and timezone.now().date() > latest_bill.due_date:
                    payment_status = 'DUE'

            # Calculate consecutive unpaid months (counting current calendar month as unpaid if not paid)
            current_month_bill = c.bills.filter(
                created_at__year=now.year,
                created_at__month=now.month
            ).first()

            consecutive_unpaid_months = 0
            if not current_month_bill:
                # No bill has been generated/paid for the current month yet; count current month as unpaid.
                consecutive_unpaid_months = 1
            elif current_month_bill.status != 'PAID':
                # A bill exists for the current month, but it is not paid yet.
                pass

            for bill in c.bills.order_by('-created_at'):
                if bill.status == 'PAID':
                    break
                # Avoid double counting if a bill for the current month is encountered in the loop when we already added 1.
                if not current_month_bill and bill.created_at.year == now.year and bill.created_at.month == now.month:
                    continue
                consecutive_unpaid_months += 1

            # Last payment date
            last_payment = Payment.objects.filter(bill__customer=c, status='COMPLETED').order_by('-paid_at').first()
            last_payment_date = last_payment.paid_at.strftime('%Y-%m-%d') if (last_payment and last_payment.paid_at) else '-'

            # Meter status
            meter = c.meters.first()
            meter_info = {
                'id': str(meter.id) if meter else None,
                'meter_number': meter.meter_number if meter else 'N/A',
                'status': meter.status if meter else 'NONE'
            }

            # Billing history
            billing_history = []
            for bill in c.bills.order_by('-created_at'):
                billing_history.append({
                    'id': str(bill.id),
                    'created_at': bill.created_at.strftime('%Y-%m-%d'),
                    'due_date': bill.due_date.strftime('%Y-%m-%d'),
                    'consumption': float(bill.consumption),
                    'total_amount': float(bill.total_amount),
                    'status': bill.status,
                    'paid_at': bill.paid_at.strftime('%Y-%m-%d %H:%M') if bill.paid_at else None
                })

            customer_data.append({
                'id': str(c.id),
                'name': f"{c.user.first_name} {c.user.last_name}".strip() or c.user.email,
                'email': c.user.email,
                'phone': c.phone or '',
                'zone': c.city or '',
                'customer_class': c.customer_class,
                'current_bill_amount': float(current_bill_amount),
                'latest_bill_date': latest_bill_date,
                'payment_status': payment_status,
                'consecutive_unpaid_months': consecutive_unpaid_months,
                'last_payment_date': last_payment_date,
                'meter': meter_info,
                'billing_history': billing_history
            })

        return Response({
            'kpis': {
                'total_customers': total_customers,
                'paid_this_month': paid_this_month,
                'unpaid': unpaid,
                'overdue': overdue,
                'total_revenue': f"{total_revenue:,.2f}"
            },
            'customers': customer_data
        })

    def post(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN', 'CLERK']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get('action')
        from apps.accounts.models import Customer, SystemNotification, AuditLog
        from apps.metering.models import Meter
        from utils.email import send_html_email

        if action == 'warn':
            customer_id = request.data.get('customer_id')
            warning_type = request.data.get('warning_type', 'standard')
            try:
                customer = Customer.objects.get(id=customer_id)
                unpaid_count = customer.bills.filter(status__in=['UNPAID', 'OVERDUE']).count()
                
                if warning_type == 'urgent':
                    subject = 'URGENT: Outstanding Water Bill Notice'
                    msg = f"Dear Customer, you have {unpaid_count} unpaid/overdue water bill(s). Please settle them immediately to avoid remote deactivation of your meter."
                elif warning_type == 'disconnection':
                    subject = 'FINAL NOTICE: Water Meter Disconnection Warning'
                    msg = f"FINAL NOTICE: Your water meter is scheduled for remote deactivation due to {unpaid_count} unpaid/overdue bill(s). Please settle them now to prevent service cutoff."
                else:
                    subject = 'Outstanding Water Bill Warning'
                    msg = f"Dear Customer, you have {unpaid_count} unpaid/overdue water bill(s). Please settle them as soon as possible to avoid service disruption."

                SystemNotification.objects.create(
                    user=customer.user,
                    alert_type='WARNING',
                    message=msg
                )
                send_html_email(
                    subject=subject,
                    template_name='emails/notification.html',
                    context={
                        'name': customer.user.first_name or 'Customer',
                        'message': msg
                    },
                    recipient_list=[customer.user.email],
                    fail_silently=True
                )
                return Response({'success': True, 'message': f'{warning_type.capitalize()} warning notification and email sent.'})
            except Customer.DoesNotExist:
                return Response({'error': 'Customer not found'}, status=404)

        elif action == 'deactivate_meter':
            customer_id = request.data.get('customer_id')
            try:
                customer = Customer.objects.get(id=customer_id)
                meter = customer.meters.first()
                if not meter:
                    return Response({'error': 'No meter assigned to customer'}, status=400)
                
                meter.status = 'DISCONNECTED'
                meter.save(update_fields=['status'])

                # Audit Log
                AuditLog.objects.create(
                    user=request.user,
                    action="DEACTIVATE_METER",
                    entity_type="Meter",
                    entity_id=str(meter.id),
                    ip_address=request.META.get('REMOTE_ADDR', '0.0.0.0'),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    metadata={"customer_id": str(customer.id), "meter_number": meter.meter_number}
                )

                # Notification & Email
                msg = "Your water meter has been remotely deactivated due to unpaid bills. Please pay to reactivate."
                SystemNotification.objects.create(
                    user=customer.user,
                    alert_type='WARNING',
                    message=msg
                )
                send_html_email(
                    subject='Water Meter Deactivated',
                    template_name='emails/notification.html',
                    context={
                        'name': customer.user.first_name or 'Customer',
                        'message': 'Your water meter has been remotely deactivated due to unpaid bills. Please settle all overdue payments to reactivate your connection.'
                    },
                    recipient_list=[customer.user.email],
                    fail_silently=True
                )
                return Response({'success': True, 'message': 'Meter deactivated.'})
            except Customer.DoesNotExist:
                return Response({'error': 'Customer not found'}, status=404)

        elif action == 'reactivate_meter':
            customer_id = request.data.get('customer_id')
            try:
                customer = Customer.objects.get(id=customer_id)
                meter = customer.meters.first()
                if not meter:
                    return Response({'error': 'No meter assigned to customer'}, status=400)
                
                meter.status = 'ACTIVE'
                meter.save(update_fields=['status'])

                # Audit Log
                AuditLog.objects.create(
                    user=request.user,
                    action="REACTIVATE_METER",
                    entity_type="Meter",
                    entity_id=str(meter.id),
                    ip_address=request.META.get('REMOTE_ADDR', '0.0.0.0'),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    metadata={"customer_id": str(customer.id), "meter_number": meter.meter_number}
                )

                # Notification & Email
                msg = "Your water meter has been reactivated. Thank you for your payment."
                SystemNotification.objects.create(
                    user=customer.user,
                    alert_type='INFO',
                    message=msg
                )
                send_html_email(
                    subject='Water Meter Reactivated',
                    template_name='emails/notification.html',
                    context={
                        'name': customer.user.first_name or 'Customer',
                        'message': 'Your water meter has been successfully reactivated. Thank you for keeping your billing status up to date!'
                    },
                    recipient_list=[customer.user.email],
                    fail_silently=True
                )
                return Response({'success': True, 'message': 'Meter reactivated.'})
            except Customer.DoesNotExist:
                return Response({'error': 'Customer not found'}, status=404)

        elif action == 'bulk_warn':
            customer_ids = request.data.get('customer_ids', [])
            warning_type = request.data.get('warning_type', 'standard')
            sent_count = 0
            for customer_id in customer_ids:
                try:
                    customer = Customer.objects.get(id=customer_id)
                    unpaid_count = customer.bills.filter(status__in=['UNPAID', 'OVERDUE']).count()
                    
                    if warning_type == 'urgent':
                        subject = 'URGENT: Outstanding Water Bill Notice'
                        msg = f"Dear Customer, you have {unpaid_count} unpaid/overdue water bill(s). Please settle them immediately to avoid remote deactivation of your meter."
                    elif warning_type == 'disconnection':
                        subject = 'FINAL NOTICE: Water Meter Disconnection Warning'
                        msg = f"FINAL NOTICE: Your water meter is scheduled for remote deactivation due to {unpaid_count} unpaid/overdue bill(s). Please settle them now to prevent service cutoff."
                    else:
                        subject = 'Outstanding Water Bill Warning'
                        msg = f"Dear Customer, you have {unpaid_count} unpaid/overdue water bill(s). Please settle them as soon as possible to avoid service disruption."

                    SystemNotification.objects.create(
                        user=customer.user,
                        alert_type='WARNING',
                        message=msg
                    )
                    send_html_email(
                        subject=subject,
                        template_name='emails/notification.html',
                        context={
                            'name': customer.user.first_name or 'Customer',
                            'message': msg
                        },
                        recipient_list=[customer.user.email],
                        fail_silently=True
                    )
                    sent_count += 1
                except Customer.DoesNotExist:
                    continue
            return Response({'success': True, 'message': f'Bulk {warning_type} warnings sent to {sent_count} customers.'})

        elif action == 'bulk_flag':
            customer_ids = request.data.get('customer_ids', [])
            flagged_count = 0
            for customer_id in customer_ids:
                try:
                    customer = Customer.objects.get(id=customer_id)
                    
                    # Audit Log
                    AuditLog.objects.create(
                        user=request.user,
                        action="FLAG_FOR_REVIEW",
                        entity_type="Customer",
                        entity_id=str(customer.id),
                        ip_address=request.META.get('REMOTE_ADDR', '0.0.0.0'),
                        user_agent=request.META.get('HTTP_USER_AGENT', ''),
                        metadata={"flagged_reason": "Bulk administrator review flag"}
                    )

                    msg = "Your account has been flagged for administrative review due to outstanding billing history. Please contact support."
                    SystemNotification.objects.create(
                        user=customer.user,
                        alert_type='WARNING',
                        message=msg
                    )
                    flagged_count += 1
                except Customer.DoesNotExist:
                    continue
            return Response({'success': True, 'message': f'{flagged_count} accounts flagged for review.'})

        else:
            return Response({'error': 'Invalid action'}, status=400)


class AdminPaymentHistoryView(APIView):
    """
    Returns all payment records across all customers for the admin payment history sidebar.
    Supports search and status filtering via query params.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_role = request.user.role.name.upper() if request.user.role else ''
        if not request.user.is_staff and user_role not in ['ADMIN', 'CLERK']:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        # Query params for filtering
        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip()
        method_filter = request.query_params.get('method', '').strip()

        payments_qs = Payment.objects.select_related(
            'bill__customer__user'
        ).order_by('-created_at')

        if status_filter:
            payments_qs = payments_qs.filter(status=status_filter.upper())

        if method_filter:
            payments_qs = payments_qs.filter(payment_method__icontains=method_filter)

        if search:
            from django.db.models import Q
            payments_qs = payments_qs.filter(
                Q(bill__customer__user__first_name__icontains=search) |
                Q(bill__customer__user__last_name__icontains=search) |
                Q(bill__customer__user__email__icontains=search) |
                Q(transaction_ref__icontains=search)
            )

        # Limit to last 200 records for performance
        payments_qs = payments_qs[:200]

        results = []
        for p in payments_qs:
            customer = p.bill.customer if p.bill else None
            user = customer.user if customer else None
            results.append({
                'id': str(p.id),
                'customer_name': f"{user.first_name} {user.last_name}".strip() if user else 'Unknown',
                'customer_email': user.email if user else '',
                'amount': float(p.amount),
                'transaction_ref': p.transaction_ref or '',
                'payment_method': p.payment_method,
                'status': p.status,
                'paid_at': p.paid_at.strftime('%Y-%m-%d %H:%M') if p.paid_at else None,
                'created_at': p.created_at.strftime('%Y-%m-%d %H:%M'),
                'bill_id': str(p.bill.id) if p.bill else None,
                'bill_period': p.bill.created_at.strftime('%B %Y') if p.bill else '',
            })

        # Summary stats
        from django.db.models import Count
        total_completed = Payment.objects.filter(status='COMPLETED').count()
        total_pending = Payment.objects.filter(status='PENDING').count()
        total_failed = Payment.objects.filter(status='FAILED').count()
        total_amount = Payment.objects.filter(status='COMPLETED').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')

        return Response({
            'payments': results,
            'summary': {
                'total_completed': total_completed,
                'total_pending': total_pending,
                'total_failed': total_failed,
                'total_amount': f"{total_amount:,.2f}",
            }
        })
