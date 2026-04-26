# The Smart Health Assistant 🏥

An AI-driven healthcare support platform that integrates machine learning, real-time APIs, and an intuitive user interface.

## Features
- **Health Prediction**: Powered by **Google Gemini 3.1 Flash** for state-of-the-art clinical parameter analysis.
- **Symptom Checker**: Intelligent AI-driven triage for health concerns using Gemini 3.1.
- **Hospital Discovery**: Location-based discovery of nearby medical centers using Overpass API.
- **Vitals Dashboard**: Real-time tracking of heart rate, BP, and more.
- **Emergency SOS**: One-tap emergency response protocol with GPS broadcasting.

## Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: FastAPI (Python), Uvicorn
- **AI/ML**: Google Gemini 3.1 Flash, Scikit-Learn (Local fallback), NLP Triage Engine

## Getting Started

### 1. Prerequisites
- Python 3.8+
- Node.js & npm

### 2. Full Stack Run
The easiest way to run the project is using the orchestration script:
```bash
python run_all.py
```

### 3. Individual Service Setup

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Machine Learning
The model is pre-trained. If you want to re-train the local fallback model:
```bash
python ml-engine/train_model.py
```

## Environment Variables
Create a `.env` file in the `frontend/` folder:
```env
VITE_GEMINI_API_KEY=your_google_api_key_here
VITE_API_URL=http://localhost:8000
```
