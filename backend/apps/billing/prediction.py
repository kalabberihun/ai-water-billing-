from decimal import Decimal
from django.db.models import Avg
from .models import Bill
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

def predict_next_consumption(customer):
    """
    Predicts the next month's water consumption for a customer based on historical data.
    Uses a weighted combination of:
    1. Linear trend (last 3-6 months)
    2. Historical average for the upcoming month (seasonality)
    """
    
    # Get last 6 months of paid/finalized bills
    history = Bill.objects.filter(
        customer=customer
    ).order_by('-created_at')[:6]
    
    if not history or len(history) < 2:
        return None # Not enough data to predict
    
    consumptions = [float(b.consumption) for b in history][::-1] # Order chronologically
    
    # 1. Calculate Trend (Simple Linear Regression Slant)
    # x = [0, 1, 2, ...], y = consumptions
    n = len(consumptions)
    x = list(range(n))
    y = consumptions
    
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(i * j for i, j in zip(x, y))
    sum_x2 = sum(i**2 for i in x)
    
    # denominator
    denom = (n * sum_x2 - sum_x**2)
    if denom == 0:
        slope = 0
    else:
        slope = (n * sum_xy - sum_x * sum_y) / denom
        
    intercept = (sum_y - slope * sum_x) / n
    
    # Prediction based on trend for index n
    trend_prediction = slope * n + intercept
    
    # 2. Seasonality (Average consumption for the next month in previous years)
    # Since we might not have years of data in a demo, we'll use a local rolling average
    avg_hist = sum(consumptions) / n
    
    # Final Weighted Prediction (70% Trend, 30% Average)
    # Ensure we don't predict negative consumption
    final_prediction = (trend_prediction * 0.7) + (avg_hist * 0.3)
    final_prediction = max(0, final_prediction)
    
    # Calculate confidence based on variance
    if n > 0:
        variance = sum((c - avg_hist)**2 for c in consumptions) / n
        std_dev = variance ** 0.5
        # Lower std_dev relative to mean = higher confidence
        if avg_hist > 0:
            confidence = max(0.5, 1.0 - (std_dev / avg_hist))
        else:
            confidence = 0.5
    else:
        confidence = 0.5
        
    return {
        'predicted_consumption': round(final_prediction, 2),
        'confidence': round(confidence * 100, 1),
        'trend': 'UP' if slope > 0.5 else 'DOWN' if slope < -0.5 else 'STABLE',
        'historical_data': consumptions
    }
