import os
import re

file_path = r'c:\Users\kalth\OneDrive\Desktop\ai-water-billing\backend\apps\billing\views.py'
with open(file_path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. PaymentCreateView check
c = re.sub(
    r"(if request\.user\.customer != bill\.customer:\s*return Response\(\{'error': 'Unauthorized'\}, status=403\))",
    r"\1\n\n            # Payment interval limit\n            today = timezone.now().date()\n            if Payment.objects.filter(bill__customer=request.user.customer, status='COMPLETED', paid_at__year=today.year, paid_at__month=today.month).exists():\n                return Response({'error': \"You have paid this month's bill, so wait till next month.\"}, status=400)",
    c, count=1
)

# 2. CustomerDashboardStatsView info alert
c = re.sub(
    r"(alerts = list\(WaterAlert\.objects\.filter\(\s*customer=customer,\s*is_resolved=False\s*\)\.values\('id', 'alert_type', 'message', 'created_at'\)\))",
    r"\1\n        \n        # Payment interval info alert\n        from datetime import date\n        today = date.today()\n        from .models import Payment\n        has_paid = Payment.objects.filter(\n            bill__customer=customer,\n            status='COMPLETED',\n            paid_at__year=today.year,\n            paid_at__month=today.month\n        ).exists()\n        \n        if has_paid:\n            alerts.append({\n                'id': 'paid_interval_alert',\n                'alert_type': 'INFO',\n                'message': \"You have paid this month's bill, so wait till next month.\",\n                'created_at': timezone.now().isoformat()\n            })",
    c, count=1
)

# NOTE: Since the previous chunk operation failed, the file might still have the old 'alerts = WaterAlert.objects.filter...' without list() if it was reverted, or I need to handle both.
c = re.sub(
    r"(alerts = WaterAlert\.objects\.filter\(\s*customer=customer,\s*is_resolved=False\s*\)\.values\('id', 'alert_type', 'message', 'created_at'\))",
    r"alerts = list(\1)\n        \n        # Payment interval info alert\n        from datetime import date\n        today = date.today()\n        from .models import Payment\n        has_paid = Payment.objects.filter(\n            bill__customer=customer,\n            status='COMPLETED',\n            paid_at__year=today.year,\n            paid_at__month=today.month\n        ).exists()\n        \n        if has_paid:\n            alerts.append({\n                'id': 'paid_interval_alert',\n                'alert_type': 'INFO',\n                'message': \"You have paid this month's bill, so wait till next month.\",\n                'created_at': timezone.now().isoformat()\n            })",
    c, count=1
)

# 3. ChapaInitializeView check
c = re.sub(
    r"(if bill\.status == 'PAID':\s*return Response\(\{'error': 'Bill is already paid'\}, status=status\.HTTP_400_BAD_REQUEST\))",
    r"\1\n\n        # Payment interval limit\n        today = timezone.now().date()\n        if Payment.objects.filter(bill__customer=bill.customer, status='COMPLETED', paid_at__year=today.year, paid_at__month=today.month).exists():\n            return Response({'error': \"You have paid this month's bill, so wait till next month.\"}, status=status.HTTP_400_BAD_REQUEST)",
    c, count=1
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(c)
print("Updated views.py successfully")
