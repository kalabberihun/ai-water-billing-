"""
Train a Random Forest Regressor for water consumption prediction.
Uses the generated CSV data and saves the model as a .joblib file.
"""
import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder

ML_DIR = os.path.dirname(__file__)
DATA_FILE = os.path.join(ML_DIR, 'water_consumption_data.csv')
MODEL_FILE = os.path.join(ML_DIR, 'consumption_model.joblib')
ENCODER_FILE = os.path.join(ML_DIR, 'class_encoder.joblib')


def train():
    # Load data
    print("📂 Loading training data...")
    df = pd.read_csv(DATA_FILE)
    print(f"   Total samples: {len(df)}")
    print(f"   Columns: {list(df.columns)}")
    print(f"\n   Class distribution:")
    print(df['customer_class'].value_counts().to_string())

    # Encode customer_class
    le = LabelEncoder()
    df['customer_class_encoded'] = le.fit_transform(df['customer_class'])

    # Feature columns
    feature_cols = [
        'customer_class_encoded',
        'month_1_consumption', 'month_2_consumption',
        'month_3_consumption', 'month_4_consumption',
        'month_1_month', 'month_2_month',
        'month_3_month', 'month_4_month',
        'avg_consumption', 'consumption_trend',
    ]
    target_col = 'next_month_consumption'

    X = df[feature_cols].values
    y = df[target_col].values

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\n   Training set: {len(X_train)} samples")
    print(f"   Test set:     {len(X_test)} samples")

    # Train model
    print("\n🤖 Training Random Forest Regressor...")
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=20,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print("\n📊 Model Evaluation:")
    print(f"   MAE  (Mean Absolute Error):  {mae:.2f} m³")
    print(f"   RMSE (Root Mean Sq Error):   {rmse:.2f} m³")
    print(f"   R²   (Coefficient of Det.):  {r2:.4f}")

    # Feature importance
    print("\n📈 Feature Importance:")
    importances = sorted(
        zip(feature_cols, model.feature_importances_),
        key=lambda x: x[1], reverse=True
    )
    for feat, imp in importances:
        bar = '█' * int(imp * 50)
        print(f"   {feat:30s} {imp:.4f} {bar}")

    # Save model and encoder
    joblib.dump(model, MODEL_FILE)
    joblib.dump(le, ENCODER_FILE)
    print(f"\n✅ Model saved to: {MODEL_FILE}")
    print(f"✅ Encoder saved to: {ENCODER_FILE}")

    return model, le


if __name__ == '__main__':
    train()
