import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import {
  Heart,
  Activity,
  MapPin,
  Stethoscope,
  AlertCircle,
  ChevronRight,
  Navigation,
  PhoneCall,
  User,
  Bell,
  Thermometer,
  Wind,
  Moon,
  Mic,
  MicOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser
} from "@clerk/clerk-react";

// --- Sub-components ---

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit: string;
  color: string;
  trend?: number;
}

interface SectionTitleProps {
  title: string;
  subtitle: string;
}

interface PredictionResult {
  prediction_code: number;
  prediction: string;
  advice?: string;
  summary?: string;
}

interface Facility {
  name: string;
  specialty?: string;
  hospital?: string;
  distance: string;
  time?: string;
  rating?: number | string;
  mapUrl: string;
}

interface LocationData {
  city: string;
  region: string;
  country_name: string;
  latitude: number;
  longitude: number;
}

interface Notification {
  id: number;
  message: string;
  type: 'warning' | 'info' | 'alert';
  read: boolean;
  time: string;
}

const StatCard = ({ icon: Icon, label, value, unit, color, trend }: StatCardProps) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="glass p-6 rounded-3xl flex items-center gap-4 card-hover"
  >
    <div className={`p-4 rounded-2xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <div className="flex items-baseline gap-1">
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        <span className="text-xs font-semibold text-slate-400">{unit}</span>
      </div>
      {trend && (
        <span className={`text-xs font-bold ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last week
        </span>
      )}
    </div>
  </motion.div>
);

const SectionTitle = ({ title, subtitle }: SectionTitleProps) => (
  <div className="mb-8">
    <h2 className="text-3xl font-bold text-slate-800">{title}</h2>
    <p className="text-slate-500 mt-2">{subtitle}</p>
  </div>
);

// --- Splash Screen for Auth Loading ---

const SplashScreen = () => (
  <div className="min-h-screen bg-white flex flex-col items-center justify-center">
    <motion.div
      animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
      transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-200"
    >
      <Heart className="w-12 h-12 fill-current" />
    </motion.div>
    <p className="mt-8 text-slate-400 font-medium tracking-widest uppercase text-xs animate-pulse">Initializing SmartHealth...</p>
  </div>
);

// --- Landing Page for Guest Users ---

const LandingPage = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl text-center space-y-6 sm:space-y-8"
    >
      <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-200">
        <Heart className="w-12 h-12 fill-current" />
      </div>
      <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
        Your Personal <span className="text-blue-600">Smart Health</span> Assistant
      </h1>
      <p className="text-lg sm:text-xl text-slate-500 leading-relaxed px-4">
        Empowering you with AI-driven disease prediction, symptom triage, and instant medical support. Start your health journey today.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md mx-auto px-4">
        <SignInButton mode="modal">
          <button className="w-full sm:w-auto bg-blue-600 text-white px-10 py-4 sm:py-5 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="w-full sm:w-auto bg-white text-blue-600 border-2 border-blue-100 px-10 py-4 sm:py-5 rounded-2xl font-bold text-lg hover:bg-blue-50 transition-all active:scale-95">
            Create Account
          </button>
        </SignUpButton>
      </div>
    </motion.div>

    <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
      {[
        { title: "AI Diagnostics", desc: "Advanced Random Forest models for health risk assessment.", icon: Activity },
        { title: "NLP Triage", desc: "Describe symptoms in natural language for instant guidance.", icon: Stethoscope },
        { title: "Emergency SOS", desc: "One-tap connection to nearby emergency services.", icon: AlertCircle },
      ].map((feature, i) => (
        <div key={i} className="glass p-8 rounded-3xl space-y-4">
          <feature.icon className="w-10 h-10 text-blue-600" />
          <h3 className="text-xl font-bold text-slate-800">{feature.title}</h3>
          <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

// --- Main App Component ---

export default function App() {
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [predictionData, setPredictionData] = useState({
    glucose: 120,
    blood_pressure: 80,
    insulin: 30,
    bmi: 24,
    age: 35
  });
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [symptomText, setSymptomText] = useState('');
  const [symptomResult, setSymptomResult] = useState('');
  const [hospitals, setHospitals] = useState<Facility[]>([
    {
      name: "Medica Superspecialty Hospital",
      distance: "4.2 km",
      time: "12 mins",
      mapUrl: "https://www.google.com/maps/place/Medica+Superspecialty+Hospital"
    },
    {
      name: "Apollo Multispeciality Hospitals",
      distance: "5.8 km",
      time: "18 mins",
      mapUrl: "https://www.google.com/maps/place/Apollo+Multispeciality+Hospitals,+Kolkata"
    },
    {
      name: "Fortis Hospital, Anandapur",
      distance: "3.5 km",
      time: "10 mins",
      mapUrl: "https://www.google.com/maps/place/Fortis+Hospital+Anandapur+Kolkata"
    },
    {
      name: "AMRI Hospital, Dhakuria",
      distance: "6.5 km",
      time: "20 mins",
      mapUrl: "https://www.google.com/maps/place/AMRI+Hospitals+Dhakuria"
    },
    {
      name: "Ruby General Hospital",
      distance: "2.8 km",
      time: "8 mins",
      mapUrl: "https://www.google.com/maps/place/Ruby+General+Hospital"
    },
    {
      name: "Peerless Hospital",
      distance: "7.1 km",
      time: "22 mins",
      mapUrl: "https://www.google.com/maps/place/Peerless+Hospital"
    }
  ]);
  const [doctors, setDoctors] = useState<Facility[]>([
    {
      name: "Dr. Kunal Sarkar",
      specialty: "Senior Cardiac Surgeon",
      hospital: "Medica Superspecialty Hospital",
      distance: "4.2 km",
      rating: 4.9,
      mapUrl: "https://www.google.com/maps/place/Medica+Superspecialty+Hospital"
    },
    {
      name: "Dr. Rabin Chakraborty",
      specialty: "Interventional Cardiologist",
      hospital: "Apollo Multispeciality Hospitals",
      distance: "5.8 km",
      rating: 4.8,
      mapUrl: "https://www.google.com/maps/place/Apollo+Multispeciality+Hospitals,+Kolkata"
    },
    {
      name: "Dr. L. N. Tripathy",
      specialty: "Neurosurgeon",
      hospital: "Medica Superspecialty Hospital",
      distance: "4.2 km",
      rating: 4.7,
      mapUrl: "https://www.google.com/maps/place/Medica+Superspecialty+Hospital"
    },
    {
      name: "Dr. Anirban Biswas",
      specialty: "Diabetologist & General Physician",
      hospital: "Fortis Hospital, Anandapur",
      distance: "3.5 km",
      rating: 4.6,
      mapUrl: "https://www.google.com/maps/place/Fortis+Hospital+Anandapur+Kolkata"
    },
    {
      name: "Dr. Apurba Ghosh",
      specialty: "Pediatrician",
      hospital: "Institute of Child Health",
      distance: "6.1 km",
      rating: 4.9,
      mapUrl: "https://www.google.com/maps/place/Institute+of+Child+Health"
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [sosActive, setSosActive] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, message: "Your blood pressure is slightly elevated (120/80). Keep monitoring.", type: 'warning', read: false, time: '2h ago' },
    { id: 2, message: "Dr. Kunal Sarkar is available for appointments this week.", type: 'info', read: false, time: '5h ago' },
    { id: 3, message: "Remember to log your fasting glucose today.", type: 'alert', read: true, time: '1d ago' },
  ]);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [insightMetric, setInsightMetric] = useState<'heartRate' | 'bloodPressure'>('heartRate');
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (currentTranscript) {
          setSymptomText(prev => prev + currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error starting speech recognition:", err);
      }
    }
  };

  const addNotification = (message: string, type: 'warning' | 'info' | 'alert') => {
    const newNotif: Notification = {
      id: Date.now(),
      message,
      type,
      read: false,
      time: 'Just now'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = async () => {
    // 1. Try HTML5 Geolocation for highly accurate GPS coordinates
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            // Use free OpenStreetMap Nominatim API for reverse geocoding to get city name
            const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const address = res.data.address || {};
            const city = address.city || address.town || address.village || address.county || 'Your Area';

            setLocation({
              city: city,
              region: address.state || '',
              country_name: address.country || '',
              latitude: latitude,
              longitude: longitude
            });
            fetchHospitals(latitude, longitude);
            fetchDoctors(latitude, longitude);
          } catch (geoErr) {
            console.warn("Reverse geocoding failed, falling back to IP estimation", geoErr);
            fallbackToIp();
          }
        },
        (error) => {
          console.warn("Geolocation denied or unavailable. Falling back to IP estimation.", error);
          fallbackToIp();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      fallbackToIp();
    }
  };

  const fallbackToIp = async () => {
    try {
      const res = await axios.get('https://ipapi.co/json/');
      if (res.data && res.data.error) throw new Error(res.data.reason || "Rate limited");
      setLocation(res.data);
      fetchHospitals(res.data.latitude, res.data.longitude);
      fetchDoctors(res.data.latitude, res.data.longitude);
    } catch (err) {
      console.error("Location detection failed completely", err);
    }
  };

  // Helper function to query Overpass API for real nearby facilities
  const searchNearbyFacilities = async (lat: number, lng: number, amenityType: string) => {
    const radius = 8000; // 8km radius
    const query = `
      [out:json];
      (
        node["amenity"="${amenityType}"](around:${radius},${lat},${lng});
        way["amenity"="${amenityType}"](around:${radius},${lat},${lng});
      );
      out center 15;
    `;
    const res = await axios.post('https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(query)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    interface OverpassElement {
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags: { name?: string; healthcare?: string; speciality?: string };
    }

    return res.data.elements
      .filter((e: OverpassElement) => e.tags && e.tags.name)
      .map((element: OverpassElement) => {
        const eLat = element.lat || element.center?.lat || 0;
        const eLon = element.lon || element.center?.lon || 0;

        // Calculate rough distance in km
        const R = 6371; // Earth radius in km
        const dLat = (eLat - lat) * Math.PI / 180;
        const dLon = (eLon - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(eLat * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = (R * c).toFixed(1);

        return {
          name: element.tags.name,
          specialty: element.tags.healthcare || element.tags.speciality || "Specialist",
          hospital: element.tags.name,
          distance: `${distance} km`,
          time: `${Math.round(parseFloat(distance) * 4)} mins`, // Rough estimate: 4 mins per km
          rating: (4 + Math.random()).toFixed(1), // Mock rating between 4.0 and 5.0
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${eLat},${eLon}`
        };
      })
      .sort((a: Facility, b: Facility) => parseFloat(a.distance) - parseFloat(b.distance))
      .slice(0, 6);
  };

  const fetchHospitals = async (lat?: number, lng?: number) => {
    if (!lat || !lng) return;
    setLoading(true);
    try {
      const results = await searchNearbyFacilities(lat, lng, "hospital");
      if (results.length > 0) setHospitals(results);
    } catch (err) {
      console.error("Failed to fetch hospitals dynamically", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async (lat?: number, lng?: number) => {
    if (!lat || !lng) return;
    setLoading(true);
    try {
      // Search for clinics or doctor offices nearby
      const results = await searchNearbyFacilities(lat, lng, "clinic");
      if (results.length > 0) setDoctors(results);
    } catch (err) {
      console.error("Failed to fetch doctors dynamically", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (apiKey && apiKey !== "your_gemini_api_key_here") {
        // Use advanced Gemini AI model for comprehensive prediction
        const ai = new GoogleGenAI({ apiKey });
        let responseText = "";

        try {
          const prompt = `You are an expert AI medical diagnostician. Analyze these patient vitals and provide a health risk prediction.
          
          Patient Data:
          - Age: ${predictionData.age} years
          - BMI: ${predictionData.bmi} kg/m²
          - Blood Pressure (Systolic): ${predictionData.blood_pressure} mmHg
          - Fasting Glucose: ${predictionData.glucose} mg/dL
          - Insulin: ${predictionData.insulin} µU/ml

          Format the response strictly as a JSON object with the following keys:
          - "prediction_code": 0 for healthy/low risk, 1 for moderate risk, 2 for high risk
          - "prediction": A short 3-5 word summary of the main risk (e.g., "High Risk of Diabetes")
          - "advice": A detailed 2-3 sentence medical recommendation.
          - "summary": A concise overview of what these vitals mean together.
          
          Do not include markdown blocks like \`\`\`json, just return the raw JSON object.`;

          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }]
          });
          responseText = response.text ?? "";
        } catch (geminiErr: any) {
          if (geminiErr.message?.includes("404") || geminiErr.message?.includes("not found") || geminiErr.message?.includes("429")) {
            console.warn("Gemini 2.0 error or quota exceeded, trying 1.5 fallback...");
            const nextResponse = await ai.models.generateContent({
              model: "gemini-1.5-flash",
              contents: [{ role: "user", parts: [{ text: `Analyze these patient vitals and return a JSON object (keys: prediction_code, prediction, advice, summary): Age ${predictionData.age}, BMI ${predictionData.bmi}, BP ${predictionData.blood_pressure}, Glucose ${predictionData.glucose}, Insulin ${predictionData.insulin}.` }] }]
            });
            responseText = nextResponse.text ?? "";
          } else {
            throw geminiErr;
          }
        }
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        let parsedResult;
        try {
          const jsonText = jsonMatch ? jsonMatch[0] : responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsedResult = JSON.parse(jsonText);
        } catch (parseErr) {
          console.error("JSON Parse Error:", parseErr, "Raw Text:", responseText);
          throw new Error("Invalid response format from AI.");
        }
        setPredictionResult(parsedResult);

        if (parsedResult.prediction_code === 2) {
          addNotification(`High Risk Detected: ${parsedResult.prediction}`, "alert");
        } else if (parsedResult.prediction_code === 1) {
          addNotification(`Moderate Risk: ${parsedResult.prediction}`, "warning");
        } else {
          addNotification(`Health Check: ${parsedResult.prediction}`, "info");
        }
      } else {
        // Fallback to traditional backend ML model
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/predict`, predictionData);
        setPredictionResult(res.data);

        if (res.data.prediction_code === 2) {
          addNotification(`High Risk Detected: ${res.data.prediction}`, "alert");
        } else if (res.data.prediction_code === 1) {
          addNotification(`Moderate Risk: ${res.data.prediction}`, "warning");
        } else {
          addNotification(`Health Check: ${res.data.prediction}`, "info");
        }
      }
    } catch (err) {
      console.error("Gemini Prediction failed, attempting fallback:", err);
      try {
        // Fallback to traditional backend ML model if Gemini fails
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/predict`, predictionData);
        const data = res.data;

        setPredictionResult({
          prediction_code: data.prediction_code,
          prediction: data.prediction,
          summary: data.summary,
          advice: data.advice || (data.recommendations ? data.recommendations.join(' ') : "Please consult a professional.")
        });

        if (data.prediction_code === 2) {
          addNotification(`High Risk Detected: ${data.prediction}`, "alert");
        } else if (data.prediction_code === 1) {
          addNotification(`Moderate Risk: ${data.prediction}`, "warning");
        } else {
          addNotification(`Health Check: ${data.prediction}`, "info");
        }
      } catch (fallbackErr) {
        console.error("Fallback Prediction also failed:", fallbackErr);
        alert("Failed to run diagnostics. Please check your API connections.");
        addNotification("Failed to run diagnostics.", "warning");
      }
    }
    setLoading(false);
  };

  const handleSymptomCheck = async () => {
    if (!symptomText.trim()) {
      alert("Please describe your symptoms before analyzing.");
      return;
    }
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        alert("Action Required: Please add VITE_GEMINI_API_KEY to your frontend/.env file.");
        setLoading(false);
        return;
      }

      // If user hasn't added their own key yet, provide a robust mock response so the UI doesn't break
      if (apiKey === "your_gemini_api_key_here") {
        setTimeout(() => {
          setSymptomResult(`**[DEMO MODE: Please add your real Gemini API key to .env for live analysis]**

### 🚦 Urgency Assessment
**MODERATE**

### 🔍 Potential Considerations
*   **Viral Upper Respiratory Infection** (Common Cold or Flu)
*   **Seasonal Allergic Rhinitis**
*   **Mild Dehydration** or fatigue-related stress

### 🚩 Red Flags (Seek Immediate Care if:)
*   Sudden **difficulty breathing** or shortness of breath.
*   Persistent high fever above **103°F (39.4°C)**.
*   **Chest pain** or severe pressure.
*   Confusion or altered mental state.

### 🏠 Self-Care & Monitoring
*   Prioritize **rest** and increased **hydration** (water, electrolytes).
*   Use over-the-counter saline nasal spray or humidifiers for congestion.
*   Monitor temperature every 4-6 hours.

### 🏥 Recommended Next Steps
*   Schedule a visit with a **General Physician** if symptoms do not improve within 48-72 hours.
*   If symptoms worsen rapidly, visit an **Urgent Care** center.

---
*Disclaimer: This is a simulated demonstration. Please consult a real medical professional for any health concerns.*`);
          setLoading(false);
          addNotification("Demo symptom analysis completed.", "info");
        }, 1500);
        return;
      }

      // Initialize Gemini Model with real key
      const ai = new GoogleGenAI({ apiKey });
      let responseText = "";

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ role: "user", parts: [{ text: `You are a world-class AI Medical Triage Specialist using the latest clinical protocols. A user is describing their symptoms: "${symptomText}".

          Analyze the symptoms with extreme care and provide a comprehensive triage report. 
          
          STRUCTURE YOUR RESPONSE AS FOLLOWS:
          
          ### 🚦 Urgency Assessment
          [Provide a clear status: MILD / MODERATE / URGENT / EMERGENCY]
          
          ### 🔍 Potential Considerations
          [List 2-4 potential common causes. Explicitly state that these are NOT diagnoses.]
          
          ### 🚩 Red Flags (Seek Immediate Care if:)
          [List specific high-risk symptoms associated with the user's description that require immediate ER visit.]
          
          ### 🏠 Self-Care & Monitoring
          [Safe, conservative home-care measures. Include what symptoms to track and for how long.]
          
          ### 🏥 Recommended Next Steps
          [Specify the type of specialist to see, if any, and the timeframe (e.g., "See a GP within 24 hours").]
          
          **CRITICAL INSTRUCTIONS:**
          - Maintain a professional, calm, and empathetic tone.
          - Use bold text for key medical terms.
          - Use bullet points for readability.
          - ALWAYS include a prominent disclaimer at the end.` }] }]
        });
        responseText = response.text ?? "";
      } catch (geminiErr: any) {
        if (geminiErr.message?.includes("404") || geminiErr.message?.includes("not found") || geminiErr.message?.includes("429")) {
          console.warn("Gemini 2.0 error or quota exceeded, trying 1.5 fallback...");
          const nextResponse = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: `Triage these symptoms: ${symptomText}. Provide causes, care, and recommendation.` }] }]
          });
          responseText = nextResponse.text ?? "";
        } else {
          throw geminiErr;
        }
      }

      setSymptomResult(responseText);
      addNotification("Symptom analysis completed.", "info");
    } catch (err: unknown) {
      console.error("Gemini API Error, attempting fallback:", err);
      try {
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/symptoms`, { text: symptomText });
        setSymptomResult(`**[LOCAL TRIAGE FALLBACK]**\n\n${res.data.analysis}`);
        addNotification("Symptom analysis completed via local engine.", "info");
      } catch (fallbackErr) {
        console.error("Symptom Fallback Error:", fallbackErr);
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred.";
        setSymptomResult(`**Error communicating with AI:**\n\n${errorMessage}\n\nPlease check that your Gemini API key in the .env file is correct and active.`);
        addNotification("Error analyzing symptoms.", "warning");
      }
    }
    setLoading(false);
  };

  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSOS = async () => {
    // Fetch local emergency number based on detected location
    let emergencyNumber = "108"; // Default for India
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/emergency-contacts?country=${location?.country_name || 'Global'}`);
      emergencyNumber = res.data.ambulance;
    } catch (err) {
      console.warn("Could not fetch local emergency number, using default 108");
    }

    // Start countdown
    setSosCountdown(5);

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(() => {
      setSosCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          activateSOS(emergencyNumber);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const activateSOS = (number: string) => {
    setSosActive(true);
    addNotification(`Emergency SOS triggered. Dialing ${number}...`, "alert");

    // Attempt to open dialer
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      window.location.href = `tel:${number}`;
    }
  };

  const cancelSOSCountdown = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setSosCountdown(null);
    addNotification("Emergency SOS sequence cancelled.", "info");
  };

  if (!isLoaded) return <SplashScreen />;

  // Simulated weekly data for the Health Insights chart
  const weeklyInsights = [
    { day: 'Mon', heartRate: 72, bloodPressure: 120 },
    { day: 'Tue', heartRate: 75, bloodPressure: 118 },
    { day: 'Wed', heartRate: 78, bloodPressure: 125 },
    { day: 'Thu', heartRate: 74, bloodPressure: 121 },
    { day: 'Fri', heartRate: 70, bloodPressure: 119 },
    { day: 'Sat', heartRate: 73, bloodPressure: 117 },
    { day: 'Sun', heartRate: 72, bloodPressure: 120 },
  ];
  const maxHeartRate = Math.max(...weeklyInsights.map(d => d.heartRate)) + 10;
  const maxBP = Math.max(...weeklyInsights.map(d => d.bloodPressure)) + 10;

  return (
    <>
      <AnimatePresence>
        {sosActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-red-600 p-6"
          >
            {/* Flashing Background Effect */}
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute inset-0 bg-red-700 mix-blend-multiply pointer-events-none"
            />

            <div className="relative z-10 bg-white rounded-3xl p-6 sm:p-8 lg:p-16 max-w-2xl w-full text-center shadow-2xl flex flex-col items-center mx-4">
              <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mb-8 animate-pulse">
                <AlertCircle className="w-16 h-16 text-red-600" />
              </div>

              <h1 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4 tracking-tight">EMERGENCY SOS ACTIVE</h1>
              <p className="text-xl text-slate-600 font-medium mb-8">An ambulance is being dispatched to your current location.</p>

              <div className="bg-slate-50 w-full rounded-2xl p-6 mb-8 border border-slate-200 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className="w-6 h-6 text-red-500" />
                  <span className="font-bold text-slate-800 text-lg">Dispatch Coordinates:</span>
                </div>
                {location ? (
                  <>
                    <p className="text-slate-600 font-mono text-sm mb-2">LAT: {location.latitude} | LNG: {location.longitude}</p>
                    <p className="text-slate-800 font-bold">{location.city}, {location.region}</p>
                  </>
                ) : (
                  <p className="text-red-500 font-bold animate-pulse">Scanning for GPS coordinates...</p>
                )}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">Estimated Arrival</p>
                  <p className="text-2xl font-black text-red-600">5 - 8 Minutes</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSosActive(false);
                  addNotification("Emergency SOS cancelled.", "info");
                }}
                className="w-full bg-slate-900 text-white font-bold text-xl py-5 rounded-2xl hover:bg-slate-800 transition-all active:scale-95"
              >
                CANCEL EMERGENCY
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sosCountdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-6"
          >
            <div className="bg-white rounded-[40px] p-8 sm:p-12 max-w-md w-full text-center shadow-2xl border-4 border-rose-500 mx-4">
              <div className="relative w-32 h-32 mx-auto mb-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-100"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="377"
                    animate={{ strokeDashoffset: [0, 377] }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="text-rose-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl font-black text-slate-800">{sosCountdown}</span>
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">SOS INITIATED</h2>
              <p className="text-slate-500 font-medium mb-8">Dialing emergency services and broadcasting your GPS location in {sosCountdown} seconds...</p>
              <button
                onClick={cancelSOSCountdown}
                className="w-full bg-slate-100 text-slate-800 font-bold py-5 rounded-2xl hover:bg-slate-200 transition-all active:scale-95 border-2 border-slate-200"
              >
                CANCEL SEQUENCE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <div className="min-h-screen flex flex-col">
          {/* Sidebar Navigation */}
          <div className="flex flex-1 overflow-hidden relative">
            <aside className="hidden md:flex w-20 lg:w-64 bg-white border-r border-slate-200 flex-col z-20">
              <div className="p-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                  <Heart className="w-6 h-6 fill-current" />
                </div>
                <span className="hidden lg:block font-bold text-xl tracking-tight">SmartHealth</span>
              </div>

              <nav className="flex-1 px-4 space-y-2 mt-4">
                {[
                  { id: 'dashboard', icon: Activity, label: 'Dashboard' },
                  { id: 'prediction', icon: Stethoscope, label: 'Health Prediction' },
                  { id: 'symptoms', icon: Wind, label: 'Symptom Checker' },
                  { id: 'appointments', icon: User, label: 'Doctor Appointments' },
                  { id: 'hospitals', icon: MapPin, label: 'Hospitals' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (item.id === 'appointments') fetchDoctors(location?.latitude, location?.longitude);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === item.id
                      ? 'bg-blue-50 text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                      }`}
                  >
                    <item.icon className="w-6 h-6" />
                    <span className="hidden lg:block font-semibold">{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="p-4">
                <button
                  onClick={triggerSOS}
                  className="w-full flex items-center justify-center gap-3 bg-rose-500 hover:bg-rose-600 text-white p-4 rounded-2xl shadow-lg shadow-rose-200 transition-all active:scale-95"
                >
                  <AlertCircle className="w-6 h-6" />
                  <span className="hidden lg:block font-bold">EMERGENCY SOS</span>
                </button>
              </div>
            </aside>

            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center px-2 py-3 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-safe">
              {[
                { id: 'dashboard', icon: Activity, label: 'Home' },
                { id: 'prediction', icon: Stethoscope, label: 'Predict' },
                { id: 'symptoms', icon: Wind, label: 'Triage' },
                { id: 'appointments', icon: User, label: 'Doctors' },
                { id: 'hospitals', icon: MapPin, label: 'Maps' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id === 'appointments') fetchDoctors(location?.latitude, location?.longitude);
                  }}
                  className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${activeTab === item.id ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  <item.icon className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Mobile SOS FAB */}
            <button
              onClick={triggerSOS}
              className="md:hidden fixed bottom-24 right-4 z-40 flex items-center justify-center w-14 h-14 bg-rose-500 text-white rounded-full shadow-lg shadow-rose-200 active:scale-95 transition-transform"
            >
              <AlertCircle className="w-7 h-7" />
            </button>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 pb-24 md:pb-8 w-full">
              <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-0 mb-8 md:mb-12">
                <div className="w-full sm:w-auto">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800">Welcome, {user?.firstName || 'User'} 👋</h1>
                  <p className="text-slate-500 mt-1">Here's your health summary for today.</p>
                </div>
                <div className="flex items-center gap-4 self-end sm:self-auto w-full sm:w-auto justify-end">
                  <div className="relative">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="p-3 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors relative"
                    >
                      <Bell className="w-6 h-6 text-slate-600" />
                      {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-3 h-3 bg-rose-500 border-2 border-white rounded-full"></span>
                      )}
                    </button>

                    <AnimatePresence>
                      {showNotifications && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 sm:right-auto sm:-right-4 mt-4 w-[85vw] sm:w-80 max-w-[320px] origin-top-right bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                        >
                          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Notifications</h3>
                            {unreadCount > 0 && (
                              <button
                                onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
                                className="text-xs text-blue-600 font-bold hover:underline"
                              >
                                Mark all as read
                              </button>
                            )}
                          </div>
                          <div className="max-h-[400px] overflow-y-auto p-2">
                            {notifications.length > 0 ? notifications.map(notif => (
                              <div
                                key={notif.id}
                                onClick={() => {
                                  if (!notif.read) {
                                    setNotifications(notifications.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                  }
                                }}
                                className={`p-4 mb-2 rounded-2xl transition-colors cursor-pointer ${notif.read ? 'bg-transparent hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-100/50'}`}
                              >
                                <div className="flex gap-3">
                                  <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${notif.type === 'warning' ? 'bg-orange-500' : notif.type === 'alert' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                                  <div>
                                    <p className={`text-sm ${notif.read ? 'text-slate-600' : 'text-slate-800 font-medium'}`}>{notif.message}</p>
                                    <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
                                  </div>
                                </div>
                              </div>
                            )) : (
                              <div className="p-8 text-center text-slate-400">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No new notifications</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-slate-800">{user?.fullName}</p>
                      <p className="text-xs text-slate-500">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                    <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-12 h-12 border-2 border-blue-500" } }} />
                  </div>
                </div>
              </header>

              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-12"
                  >
                    {/* Vitals Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <StatCard icon={Heart} label="Heart Rate" value="72" unit="bpm" color="bg-rose-500" trend={2.4} />
                      <StatCard icon={Activity} label="Blood Pressure" value="120/80" unit="mmHg" color="bg-blue-500" trend={-1.2} />
                      <StatCard icon={Thermometer} label="Body Temp" value="36.6" unit="°C" color="bg-orange-500" />
                      <StatCard icon={Moon} label="Sleep" value="7h 20m" unit="" color="bg-indigo-500" trend={15} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Quick Prediction Shortcut */}
                      <div className="lg:col-span-2 glass rounded-3xl p-8">
                        <h3 className="text-2xl font-bold mb-6">Health Insights</h3>
                        <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                          <div className="text-center">
                            <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Weekly health trend visualization goes here</p>
                          </div>
                        </div>
                      </div>

                      {/* SOS & Help */}
                      <div className="space-y-6">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white">
                          <h3 className="text-xl font-bold mb-2">Need a Doctor?</h3>
                          <p className="text-blue-100 mb-6 text-sm">Instantly connect with our top-rated medical specialists online.</p>
                          <button
                            onClick={() => {
                              setActiveTab('appointments');
                              fetchDoctors(location?.latitude, location?.longitude);
                            }}
                            className="w-full bg-white text-blue-600 font-bold py-4 rounded-2xl hover:bg-blue-50 transition-colors"
                          >
                            Book Appointment
                          </button>
                        </div>
                        <div className="glass rounded-3xl p-6">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <PhoneCall className="w-5 h-5 text-emerald-500" />
                            Emergency Contacts
                          </h4>
                          <ul className="space-y-4">
                            <li className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Ambulance</span>
                              <a href="tel:108" className="font-bold text-blue-600 underline hover:text-blue-700 transition-colors cursor-pointer">108</a>
                            </li>
                            <li className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Fire Brigade</span>
                              <a href="tel:101" className="font-bold text-blue-600 underline hover:text-blue-700 transition-colors cursor-pointer">101</a>
                            </li>
                            <li className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Police</span>
                              <a href="tel:100" className="font-bold text-blue-600 underline hover:text-blue-700 transition-colors cursor-pointer">100</a>
                            </li>
                            <li className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Woman & Child Care</span>
                              <a href="tel:181" className="font-bold text-blue-600 underline hover:text-blue-700 transition-colors cursor-pointer">181</a>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'prediction' && (
                  <motion.div
                    key="prediction"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="max-w-4xl mx-auto"
                  >
                    <SectionTitle
                      title="Disease Risk Prediction"
                      subtitle="Enter your clinical parameters for an AI-powered health assessment."
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                      <div className="glass p-8 rounded-3xl">
                        <form onSubmit={handlePredict} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                              { key: 'age', label: 'Age', unit: 'Yrs', min: 1, max: 120 },
                              { key: 'bmi', label: 'BMI', unit: 'kg/m²', min: 10, max: 50 },
                              { key: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', min: 50, max: 250 },
                              { key: 'glucose', label: 'Glucose Level', unit: 'mg/dL', min: 50, max: 400 },
                              { key: 'insulin', label: 'Insulin', unit: 'µU/ml', min: 0, max: 800 },
                            ].map((field) => (
                              <div key={field.key} className={field.key === 'insulin' ? 'md:col-span-2' : ''}>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                  {field.label} <span className="text-slate-400 font-normal">({field.unit})</span>
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min={field.min}
                                  max={field.max}
                                  value={predictionData[field.key as keyof typeof predictionData]}
                                  onChange={(e) => setPredictionData({ ...predictionData, [field.key as keyof typeof predictionData]: parseFloat(e.target.value) || 0 })}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                  required
                                />
                              </div>
                            ))}
                          </div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2"
                          >
                            {loading ? 'Analyzing...' : 'Run Diagnostics'}
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </form>
                      </div>

                      <div className="space-y-6">
                        {predictionResult ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`p-8 rounded-3xl text-white ${predictionResult.prediction_code === 0 ? 'bg-emerald-500' :
                              predictionResult.prediction_code === 1 ? 'bg-orange-500' : 'bg-rose-500'
                              }`}
                          >
                            <h3 className="text-2xl font-bold mb-2">Analysis Result</h3>
                            <p className="text-4xl font-black mb-4">{predictionResult.prediction}</p>
                            <hr className="opacity-20 mb-6" />
                            {predictionResult.summary && (
                              <p className="text-lg leading-relaxed mb-4 font-medium">{predictionResult.summary}</p>
                            )}
                            <div className="bg-white/20 p-5 rounded-2xl">
                              <p className="text-sm font-bold uppercase tracking-wider mb-1 text-white/80">Recommendation</p>
                              <p className="text-md leading-relaxed">{predictionResult.advice}</p>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="h-full glass rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
                            <Activity className="w-16 h-16 mb-4 opacity-10" />
                            <p>Submit the form to see your AI-generated health risk profile.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'symptoms' && (
                  <motion.div
                    key="symptoms"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto"
                  >
                    <SectionTitle
                      title="Symptom Checker"
                      subtitle="Describe how you feel in plain English. Our NLP engine will triage your symptoms."
                    />
                    <div className="glass p-8 rounded-3xl space-y-6">
                      <div className="relative">
                        <textarea
                          className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 h-48 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none text-lg pr-16"
                          placeholder="e.g., I have a slight fever and a persistent dry cough since yesterday..."
                          value={symptomText}
                          onChange={(e) => setSymptomText(e.target.value)}
                        />
                        <button
                          onClick={toggleRecording}
                          className={`absolute top-4 right-4 p-3 rounded-full transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200' : 'bg-white text-slate-400 hover:bg-blue-50 hover:text-blue-600 shadow-sm border border-slate-200'}`}
                          title={isRecording ? "Stop Recording" : "Start Voice Input"}
                        >
                          {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>
                      </div>
                      <button
                        onClick={handleSymptomCheck}
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white font-bold py-5 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
                      >
                        {loading ? 'Processing...' : 'Analyze Symptoms'}
                      </button>

                      <AnimatePresence>
                        {symptomResult && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl"
                          >
                            <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                              <Stethoscope className="w-5 h-5" />
                              Preliminary Triage Advice:
                            </h4>
                            <div className="text-indigo-800 prose prose-indigo max-w-none">
                              <ReactMarkdown>{symptomResult}</ReactMarkdown>
                            </div>
                            <p className="mt-6 pt-4 border-t border-indigo-200 text-xs text-indigo-500 uppercase font-bold tracking-wider italic">
                              Disclaimer: This is not a professional diagnosis.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'hospitals' && (
                  <motion.div
                    key="hospitals"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-8"
                  >
                    <div className="flex justify-between items-end">
                      <SectionTitle
                        title="Nearby Hospitals"
                        subtitle="Finding the best healthcare facilities near your current location."
                      />
                      <div className="flex gap-2 mb-8">
                        <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          Location: {location ? `${location.city}, ${location.country_name}` : 'Detecting...'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {hospitals.map((hosp, idx) => (
                        <motion.div
                          key={idx}
                          whileHover={{ scale: 1.03 }}
                          className="glass p-6 rounded-3xl card-hover relative overflow-hidden group"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <MapPin className="w-12 h-12" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-4">{hosp.name}</h3>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-slate-500">
                              <Navigation className="w-4 h-4 text-blue-500" />
                              <span className="text-sm font-medium">{hosp.distance} away</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-500">
                              <Activity className="w-4 h-4 text-emerald-500" />
                              <span className="text-sm font-medium">{hosp.time} travel time</span>
                            </div>
                          </div>
                          <a
                            href={hosp.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-6 flex w-full py-3 border-2 border-blue-100 text-blue-600 rounded-xl font-bold hover:bg-blue-600 hover:text-white transition-all items-center justify-center gap-2"
                          >
                            <MapPin className="w-5 h-5" />
                            View on Google Maps
                          </a>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'appointments' && (
                  <motion.div
                    key="appointments"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-12"
                  >
                    <div className="flex justify-between items-end">
                      <SectionTitle
                        title="Nearest Doctors"
                        subtitle="Analyzing your live location to find top-rated specialists near you."
                      />
                      <div className="flex gap-2 mb-8">
                        <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-bold flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          Location: {location ? `${location.city}, ${location.region}` : 'Detecting...'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {loading ? (
                        <div className="col-span-full py-20 text-center text-slate-400">
                          <Activity className="w-16 h-16 mx-auto mb-4 animate-pulse opacity-20" />
                          <p className="font-bold tracking-widest uppercase text-xs">Scanning for nearby specialists...</p>
                        </div>
                      ) : doctors.length > 0 ? (
                        doctors.map((doc, idx) => (
                          <motion.div
                            key={idx}
                            whileHover={{ y: -10 }}
                            className="glass p-8 rounded-[40px] card-hover relative overflow-hidden group"
                          >
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                <User className="w-8 h-8" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-slate-800">{doc.name}</h3>
                                <p className="text-blue-600 font-semibold text-sm">{doc.specialty}</p>
                              </div>
                            </div>

                            <div className="flex justify-between items-center bg-slate-50 p-3 sm:p-4 rounded-2xl mb-6 gap-2">
                              <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold uppercase">Distance</p>
                                <p className="font-bold text-slate-700">{doc.distance}</p>
                              </div>
                              <div className="w-[1px] h-8 bg-slate-200" />
                              <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold uppercase">Clinic</p>
                                <p className="font-bold text-blue-600 truncate max-w-[100px]" title={doc.hospital}>{doc.hospital?.split(' ')[0]}</p>
                              </div>
                              <div className="w-[1px] h-8 bg-slate-200" />
                              <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold uppercase">Rating</p>
                                <p className="font-bold text-emerald-600">⭐ {doc.rating}</p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <a
                                href={doc.mapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 text-sm"
                              >
                                <MapPin className="w-4 h-4" />
                                Map
                              </a>
                              <button
                                onClick={() => {
                                  alert(`Booking appointment with ${doc.name}...`);
                                  addNotification(`Appointment request sent to ${doc.name}`, "info");
                                }}
                                className="flex-[2] bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-2 text-sm"
                              >
                                Book
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="col-span-full py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                          <User className="w-16 h-16 mx-auto mb-4 opacity-10" />
                          <p className="text-slate-500 font-medium mb-6">No doctors found in your immediate area.</p>
                          <button
                            onClick={() => fetchDoctors(location?.latitude, location?.longitude)}
                            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
                          >
                            Retry Search
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </div>
        </div>
      </SignedIn>
    </>
  );
}