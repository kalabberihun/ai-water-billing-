import json
import logging
import base64
import requests as http_requests
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.conf import settings

logger = logging.getLogger(__name__)

GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'


class ChatbotView(APIView):
    """AI Chatbot powered by Gemini (primary) + Groq (fallback)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_message = request.data.get('message', '').strip()
        if not user_message:
            return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Build customer context
        context = self._build_context(request.user)
        context_json = json.dumps(context, indent=2, default=str)

        # Build the prompt
        system_prompt = (
            "You are AI WATER BILLING SYSTEM Assistant, a friendly and highly capable support agent for AI WATER BILLING SYSTEM — "
            "an advanced, AI-powered water billing and metering platform in Ethiopia.\n\n"
            "HOW AI WATER BILLING SYSTEM WORKS:\n"
            "- We use AI Vision (OCR) to automatically read water meters from uploaded photos, eliminating manual entry errors.\n"
            "- We use Machine Learning to detect water leaks and unusual consumption spikes early.\n"
            "- We provide a seamless digital portal for customers to view bills, make mobile payments (like Chapa/Telebirr), and track usage.\n\n"
            "YOUR INSTRUCTIONS:\n"
            "1. Be extremely friendly, helpful, and conversational. Use emojis naturally. Keep answers clear and under 150 words.\n"
            "2. If the user asks general questions about water usage, how the system works, or AI, answer them enthusiastically using the context above.\n"
            "3. If the user asks about THEIR specific account (bills, balance, meters, alerts), ALWAYS use the CUSTOMER DATA provided below. This is their real data.\n"
            "4. Always format currency as Ethiopian Birr (ETB).\n"
            "5. If they have unpaid bills, gently remind them in a helpful tone.\n"
            "6. If they ask about a specific account detail that isn't in the data below, politely explain what you can see and offer support.\n\n"
            f"=== CUSTOMER DATA (Real-time from Database) ===\n{context_json}\n=== END CUSTOMER DATA ==="
        )

        # Try Gemini first
        ai_response = self._try_gemini(system_prompt, user_message)

        # Fallback to Groq if Gemini fails
        if ai_response is None:
            ai_response = self._try_groq(system_prompt, user_message)

        # All failed
        if ai_response is None:
            ai_response = (
                "I'm currently experiencing high demand. "
                "Please try again in about a minute, or contact support at Support.aiwaterbillingsystem@gmail.com. ⏳"
            )

        return Response({'response': ai_response})

    def _try_gemini(self, system_prompt, user_message):
        """Try Gemini models."""
        try:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            full_prompt = f"{system_prompt}\n\nCUSTOMER QUESTION: {user_message}"

            for model_name in ['gemini-2.0-flash', 'gemini-2.0-flash-lite']:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=full_prompt,
                    )
                    return response.text.strip()
                except Exception as e:
                    if '429' in str(e) or 'RESOURCE_EXHAUSTED' in str(e):
                        logger.warning(f"Chatbot rate limited on {model_name}")
                        continue
                    raise e
        except Exception as e:
            logger.warning(f"Gemini chatbot failed: {e}")
        return None

    def _try_groq(self, system_prompt, user_message):
        """Fallback to Groq API."""
        groq_key = getattr(settings, 'GROQ_API_KEY', '')
        if not groq_key:
            return None

        try:
            res = http_requests.post(
                GROQ_CHAT_URL,
                headers={
                    'Authorization': f'Bearer {groq_key}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': 'llama-3.3-70b-versatile',
                    'messages': [
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': user_message},
                    ],
                    'max_tokens': 500,
                    'temperature': 0.3,
                },
                timeout=30,
            )
            if res.status_code == 200:
                return res.json()['choices'][0]['message']['content'].strip()
            else:
                logger.warning(f"Groq chatbot error {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.warning(f"Groq chatbot failed: {e}")
        return None

    def _build_context(self, user):
        """Gather the customer's real data for the AI prompt."""
        context = {
            'name': user.first_name or user.email.split('@')[0],
            'email': user.email,
            'role': str(user.role) if user.role else 'Customer',
        }

        if not hasattr(user, 'customer'):
            context['note'] = 'This user is staff/admin, not a customer.'
            return context

        customer = user.customer
        context['customer_class'] = customer.customer_class or 'RESIDENT'
        context['phone'] = customer.phone or 'Not set'

        # Bills
        from apps.billing.models import Bill, Payment, WaterAlert
        bills = Bill.objects.filter(customer=customer).order_by('-created_at')[:5]
        context['recent_bills'] = []
        for b in bills:
            context['recent_bills'].append({
                'amount': str(b.total_amount),
                'status': b.status,
                'due_date': str(b.due_date) if b.due_date else 'N/A',
                'consumption': str(b.consumption),
                'created': b.created_at.strftime('%Y-%m-%d'),
            })

        # Unpaid balance
        from django.db.models import Sum
        unpaid = Bill.objects.filter(
            customer=customer, status__in=['UNPAID', 'OVERDUE']
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0')
        context['unpaid_balance'] = str(unpaid)

        # Recent payments
        payments = Payment.objects.filter(
            bill__customer=customer, status='COMPLETED'
        ).order_by('-paid_at')[:3]
        context['recent_payments'] = [
            {'amount': str(p.amount), 'date': p.paid_at.strftime('%Y-%m-%d') if p.paid_at else 'N/A', 'method': p.payment_method}
            for p in payments
        ]

        # Meters
        from apps.metering.models import Meter
        meters = Meter.objects.filter(customer=customer)
        context['meters'] = [
            {'number': m.meter_number, 'status': m.status, 'address': m.location_description or 'N/A'}
            for m in meters
        ]

        # Active alerts
        alerts = WaterAlert.objects.filter(customer=customer, is_resolved=False)
        context['active_alerts'] = [
            {'type': a.alert_type, 'message': a.message}
            for a in alerts[:3]
        ]

        return context
