"""
Generate synthetic water consumption training data for the AI prediction model.
Creates a CSV with realistic consumption patterns across 5 customer classes,
with seasonal variation, trends, and noise.
"""
import csv
import random
import math
import os

# --- Configuration ---
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'water_consumption_data.csv')
NUM_CUSTOMERS = 2500  # number of synthetic customer profiles
MONTHS_PER_CUSTOMER = 8  # generate 8 months, slide a 5-month window to create samples

# Consumption ranges (m³/month) by customer class
CLASS_PROFILES = {
    'RESIDENT': {'base_min': 5, 'base_max': 35, 'noise': 3, 'seasonal_amplitude': 5},
    'ORGANIZATION': {'base_min': 50, 'base_max': 200, 'noise': 15, 'seasonal_amplitude': 20},
    'FACTORY': {'base_min': 500, 'base_max': 2000, 'noise': 100, 'seasonal_amplitude': 150},
    'GOVERNMENT': {'base_min': 100, 'base_max': 500, 'noise': 30, 'seasonal_amplitude': 40},
    'PUBLIC_SERVICE': {'base_min': 30, 'base_max': 150, 'noise': 10, 'seasonal_amplitude': 15},
}

# Weights for how often each class appears (reflecting real-world distribution)
CLASS_WEIGHTS = {
    'RESIDENT': 0.60,
    'ORGANIZATION': 0.12,
    'FACTORY': 0.08,
    'GOVERNMENT': 0.10,
    'PUBLIC_SERVICE': 0.10,
}


def seasonal_factor(month):
    """
    Simulate seasonal water usage: peaks in dry season (Jan-Mar, ~months 1-3)
    and dips in rainy season (Jun-Sep, ~months 6-9). Based on Ethiopian climate.
    """
    # Sine wave peaking in February (month=2) and dipping in August (month=8)
    return math.sin(2 * math.pi * (month - 2) / 12)


def generate_customer_history(customer_class, start_month):
    """Generate MONTHS_PER_CUSTOMER months of consumption for one customer."""
    profile = CLASS_PROFILES[customer_class]
    base = random.uniform(profile['base_min'], profile['base_max'])
    
    # Random trend per customer (slight increase or decrease over time)
    trend_per_month = random.uniform(-0.02, 0.03) * base  # -2% to +3% drift

    history = []
    for i in range(MONTHS_PER_CUSTOMER):
        month_num = ((start_month + i - 1) % 12) + 1  # Calendar month 1-12
        
        seasonal = profile['seasonal_amplitude'] * seasonal_factor(month_num)
        noise = random.gauss(0, profile['noise'])
        trend = trend_per_month * i
        
        # Occasional spike (5% chance — simulates leak or guest/event)
        spike = 0
        if random.random() < 0.05:
            spike = random.uniform(0.2, 0.6) * base
        
        consumption = max(0.5, base + seasonal + noise + trend + spike)
        history.append((round(consumption, 2), month_num))
    
    return history


def create_samples_from_history(customer_class, history):
    """
    Slide a 5-month window over the history to produce training samples.
    Window: [month_1, month_2, month_3, month_4] -> next_month_consumption
    """
    samples = []
    for i in range(len(history) - 4):
        m1_val, m1_month = history[i]
        m2_val, m2_month = history[i + 1]
        m3_val, m3_month = history[i + 2]
        m4_val, m4_month = history[i + 3]
        target_val, _ = history[i + 4]

        avg = round((m1_val + m2_val + m3_val + m4_val) / 4, 2)
        trend = round((m4_val - m1_val) / 3, 2)

        samples.append({
            'customer_class': customer_class,
            'month_1_consumption': m1_val,
            'month_2_consumption': m2_val,
            'month_3_consumption': m3_val,
            'month_4_consumption': m4_val,
            'month_1_month': m1_month,
            'month_2_month': m2_month,
            'month_3_month': m3_month,
            'month_4_month': m4_month,
            'avg_consumption': avg,
            'consumption_trend': trend,
            'next_month_consumption': target_val,
        })
    return samples


def main():
    random.seed(42)
    all_samples = []

    # Distribute customers by class weight
    for cls, weight in CLASS_WEIGHTS.items():
        n = int(NUM_CUSTOMERS * weight)
        for _ in range(n):
            start_month = random.randint(1, 12)
            history = generate_customer_history(cls, start_month)
            samples = create_samples_from_history(cls, history)
            all_samples.extend(samples)

    # Shuffle all samples
    random.shuffle(all_samples)

    # Write CSV
    fieldnames = [
        'customer_class',
        'month_1_consumption', 'month_2_consumption',
        'month_3_consumption', 'month_4_consumption',
        'month_1_month', 'month_2_month',
        'month_3_month', 'month_4_month',
        'avg_consumption', 'consumption_trend',
        'next_month_consumption',
    ]

    with open(OUTPUT_FILE, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_samples)

    print(f"✅ Generated {len(all_samples)} training samples")
    print(f"📄 Saved to: {OUTPUT_FILE}")

    # Print class distribution
    from collections import Counter
    dist = Counter(s['customer_class'] for s in all_samples)
    for cls, count in sorted(dist.items()):
        print(f"   {cls}: {count} samples")


if __name__ == '__main__':
    main()
