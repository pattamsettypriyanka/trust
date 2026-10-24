import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAh7kGgPFlALOkfpoZpgXKCJyDl6gRMcX0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trust-b2d3f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trust-b2d3f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trust-b2d3f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "863618608413",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:863618608413:web:817a06d2d9a123115c05f4"
};

// Initialize Firebase (singleton)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
