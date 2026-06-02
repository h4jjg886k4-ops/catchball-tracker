import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA_cqLs0qOpOImGlxkJn3s8dtM8pIp4sJo",
  authDomain: "catchcoach.firebaseapp.com",
  projectId: "catchcoach",
  storageBucket: "catchcoach.firebasestorage.app",
  messagingSenderId: "257402051950",
  appId: "1:257402051950:web:5e68fb0b2b72289187b57f",
  measurementId: "G-1LNR4QHCR9",
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
