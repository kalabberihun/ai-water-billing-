"""
Utility for making water consumption predictions using the trained model.
"""
import os
import joblib
import numpy as np

ML_DIR = os.path.dirname(__file__)
MODEL_FILE = os.path.join(ML_DIR, 'consumption_model.joblib')
ENCODER_FILE = os.path.join(ML_DIR, 'class_encoder.joblib')

# Load models lazily to avoid overhead if not used
_model = None
_encoder = None


def load_model():
    global _model, _encoder
    if _model is None:
        if not os.path.exists(MODEL_FILE):
            raise FileNotFoundError("Prediction model not found. Run train_model.py first.")
        _model = joblib.load(MODEL_FILE)
        _encoder = joblib.load(ENCODER_FILE)
    return _model, _encoder


def predict_next_month(customer_class, m1_val, m2_val, m3_val, m4_val,
                       m1_month, m2_month, m3_month, m4_month):
    """
    Predict next month's consumption.
    Args:
        customer_class: String (e.g., 'RESIDENT', 'FACTORY')
        m1_val, m2_val, m3_val, m4_val: Past 4 months consumption (m1 is oldest, m4 is newest)
        m1_month...m4_month: Calendar months (1-12) for those readings
    Returns:
        Predicted consumption value (float)
    """
    model, encoder = load_model()

    # Encode class
    try:
        class_encoded = encoder.transform([customer_class])[0]
    except ValueError:
        # Fallback to resident if class not recognized
        class_encoded = encoder.transform(['RESIDENT'])[0]

    avg_consumption = (m1_val + m2_val + m3_val + m4_val) / 4.0
    
    # Calculate trend if we have real values, else 0
    # trend = (month_4 - month_1) / 3
    consumption_trend = (m4_val - m1_val) / 3.0

    features = np.array([[
        class_encoded,
        m1_val, m2_val, m3_val, m4_val,
        m1_month, m2_month, m3_month, m4_month,
        avg_consumption, consumption_trend
    ]])

    prediction = model.predict(features)[0]
    return max(0.0, round(float(prediction), 2))
