from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pickle
import numpy as np
import os
import requests
import json
from google import genai
from dotenv import load_dotenv
from typing import List, Optional, Dict, Any

load_dotenv()

app = FastAPI(title="Smart Health Assistant API")

# Configure Gemini
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
client = None
if GOOGLE_API_KEY:
    client = genai.Client(api_key=GOOGLE_API_KEY)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the ML model
MODEL_PATH = os.path.join("models", "health_model.pkl")
model = None

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)

load_model()

# Data Models
class HealthData(BaseModel):
    glucose: float
    blood_pressure: float
    insulin: float
    bmi: float
    age: int

class SymptomData(BaseModel):
    text: str

# Endpoints
@app.get("/")
def read_root():
    return {"message": "Welcome to Smart Health Assistant API"}

@app.post("/predict")
async def predict_health(data: HealthData):
    # Try Gemini 3.1 Flash first if API key is available
    if client:
        try:
            prompt = f"""
            You are an expert AI medical diagnostician. Analyze these patient vitals and provide a health risk prediction.
            Patient Data:
            - Age: {data.age} years
            - BMI: {data.bmi} kg/m²
            - Blood Pressure: {data.blood_pressure} mmHg
            - Fasting Glucose: {data.glucose} mg/dL
            - Insulin: {data.insulin} µU/ml

            Format the response strictly as a JSON object with:
            - "prediction_code": 0 (healthy), 1 (moderate risk), 2 (high risk)
            - "prediction": short risk summary
            - "summary": concise overview
            - "advice": detailed medical recommendation
            - "recommendations": list of 3 strings
            - "risk_score": "Low", "Moderate", or "High"
            - "insights": list of 2-3 specific insights
            """
            
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            # Clean up the response text if it has markdown
            clean_text = response.text.strip().replace("```json", "").replace("```", "")
            return json.loads(clean_text)
        except Exception as e:
            print(f"Gemini Backend Error: {e}. Falling back to local model.")

    # Local Model Fallback
    if model is None:
        load_model()
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded and Gemini failed")
    
    input_features = np.array([[data.glucose, data.blood_pressure, data.insulin, data.bmi, data.age]])
    prediction = int(model.predict(input_features)[0])
    
    # Detailed Insights Logic (Keeping it as fallback)
    insights = []
    if data.glucose > 140: insights.append("High Glucose: Your blood sugar level is elevated.")
    if data.bmi > 30: insights.append("BMI Alert: A BMI over 30 indicates obesity.")
    
    detailed_reports = {
        0: {"prediction": "Healthy", "summary": "Normal range.", "recommendations": ["Balanced diet", "Exercise"], "risk_score": "Low"},
        1: {"prediction": "Pre-diabetes", "summary": "Early signs of stress.", "recommendations": ["Low GI diet", "Walking"], "risk_score": "Moderate"},
        2: {"prediction": "Diabetes Risk", "summary": "Significant risk.", "recommendations": ["Consult doctor", "Carb management"], "risk_score": "High"}
    }
    
    report = detailed_reports[prediction]
    return {
        "status": "success",
        "prediction_code": prediction,
        "prediction": report["prediction"],
        "summary": report["summary"],
        "advice": " ".join(report["recommendations"]),
        "recommendations": report["recommendations"],
        "risk_score": report["risk_score"],
        "insights": insights if insights else ["Parameters within manageable ranges."]
    }

@app.post("/symptoms")
async def check_symptoms(data: SymptomData):
    # Try Gemini 3.1 Flash first
    if client:
        try:
            prompt = f"""
            You are a world-class AI Medical Triage Specialist. Analyze these symptoms: '{data.text}'.
            
            Provide a detailed report with these specific sections:
            1. Urgency Assessment (MILD, MODERATE, URGENT, or EMERGENCY)
            2. Potential Considerations (2-4 likely causes, non-diagnostic)
            3. Red Flags (Specific danger signs)
            4. Self-Care & Monitoring
            5. Professional Recommendation
            
            Format using Markdown with clear headers and bold emphasis on critical terms.
            """
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            return {"analysis": response.text}
        except Exception as e:
            print(f"Gemini Triage Error: {e}. Falling back to keyword matching.")

    text = data.text.lower()
    # Comprehensive Symptom Knowledge Base (Fallback)
    symptom_db = {
        "fever": {"causes": "Viral infections", "care": "Rest", "advice": "See doctor if > 103F"},
        "cough": {"causes": "Respiratory infections", "care": "Hydrate", "advice": "Consult if > 3 weeks"},
        "chest pain": {"causes": "Various", "care": "No home care", "advice": "**EMERGENCY**"}
    }
    
    matches = []
    for symptom, details in symptom_db.items():
        if symptom in text:
            matches.append(f"### 🔍 Analysis for: {symptom.capitalize()}\n- {details['causes']}\n- {details['advice']}")
    
    if not matches:
        response = "### 📋 General Observation\nNo specific matches found. Please consult a provider."
    else:
        response = "## 🩺 Preliminary Triage Report\n\n" + "\n".join(matches)
            
    return {"analysis": response}

@app.get("/emergency-contacts")
async def get_emergency_contacts(country: str = "Global"):
    contacts = {
        "India": {
            "ambulance": "108", 
            "fire": "101", 
            "police": "100",
            "woman_child": "181"
        },
        "USA": {
            "ambulance": "911", 
            "fire": "911", 
            "police": "911",
            "woman_child": "911"
        },
        "UK": {
            "ambulance": "999", 
            "fire": "999", 
            "police": "999",
            "woman_child": "999"
        },
        "Global": {
            "ambulance": "112", 
            "fire": "112", 
            "police": "112",
            "woman_child": "112"
        }
    }
    return contacts.get(country, contacts["Global"])

@app.get("/doctors")
async def get_doctors(lat: float, lng: float):
    # Mock doctor discovery based on location
    return [
        {"name": "Dr. Sarah Johnson", "specialty": "Cardiologist", "distance": "0.8 km", "rating": 4.9},
        {"name": "Dr. Michael Chen", "specialty": "General Physician", "distance": "1.5 km", "rating": 4.7},
        {"name": "Dr. Amit Sharma", "specialty": "Endocrinologist", "distance": "2.1 km", "rating": 4.8},
        {"name": "Dr. Elena Rodriguez", "specialty": "Pediatrician", "distance": "3.4 km", "rating": 4.6}
    ]

@app.get("/hospitals")
async def get_hospitals(city: str, api_key: Optional[str] = None):
    # Mock data
    return [
        {"name": "City General Hospital", "distance": "2.5 km", "time": "10 mins"},
        {"name": "St. Luke's Medical Center", "distance": "4.1 km", "time": "15 mins"},
        {"name": "Central Health Clinic", "distance": "1.2 km", "time": "5 mins"},
        {"name": "Emergency Care Unit", "distance": "3.8 km", "time": "12 mins"},
        {"name": "Wellness Hospital", "distance": "5.0 km", "time": "20 mins"}
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
