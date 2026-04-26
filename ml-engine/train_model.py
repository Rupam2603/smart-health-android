import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pickle
import os

def train_and_export_model():
    # Generate synthetic data for demonstration
    # Features: [Glucose, BloodPressure, Insulin, BMI, Age]
    np.random.seed(42)
    n_samples = 1000
    
    glucose = np.random.randint(70, 200, n_samples)
    bp = np.random.randint(60, 110, n_samples)
    insulin = np.random.randint(0, 250, n_samples)
    bmi = np.random.uniform(18, 45, n_samples)
    age = np.random.randint(20, 80, n_samples)
    
    # Simple logic for outcome: higher glucose/bmi/age increases risk
    # Outcome: 0 = Healthy, 1 = Pre-diabetes, 2 = Diabetes
    outcome_prob = (glucose/200 * 0.5) + (bmi/45 * 0.3) + (age/80 * 0.2)
    outcome = []
    for p in outcome_prob:
        if p < 0.4: outcome.append(0)
        elif p < 0.6: outcome.append(1)
        else: outcome.append(2)
        
    df = pd.DataFrame({
        'Glucose': glucose,
        'BloodPressure': bp,
        'Insulin': insulin,
        'BMI': bmi,
        'Age': age,
        'Outcome': outcome
    })

    X = df.drop('Outcome', axis=1)
    y = df['Outcome']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # Save model
    model_path = os.path.join('backend', 'models', 'health_model.pkl')
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    
    print(f"Model trained and saved to {model_path}")

if __name__ == "__main__":
    train_and_export_model()
