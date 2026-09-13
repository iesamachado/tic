// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — Firebase Configuration
//  -----------------------------------------------------------------------
//  ⚠️  INSTRUCCIONES:
//  1. Crea un nuevo proyecto en https://console.firebase.google.com/
//  2. Activa Authentication → Google + Email/Password
//  3. Crea Firestore Database (modo producción)
//  4. Ve a Configuración del proyecto → Tus apps → Añadir app Web
//  5. Copia los valores y reemplaza los PLACEHOLDERS de abajo
//  6. En Google Cloud Console del mismo proyecto, activa:
//     - Google Classroom API
//     - Añade el dominio de GitHub Pages a "Orígenes autorizados de JS"
// ═══════════════════════════════════════════════════════════════════════

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc, collection,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
  arrayUnion, arrayRemove,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ──────────────────────────────────────────────────────────────────────
//  🔧 REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO FIREBASE
// ──────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDA0LWJS8gSSyjtzkDE-RJbYr7WNiD7ymc",
  authDomain: "rompehielos-fe104.firebaseapp.com",
  projectId: "rompehielos-fe104",
  storageBucket: "rompehielos-fe104.firebasestorage.app",
  messagingSenderId: "527236439235",
  appId: "1:527236439235:web:a22ab9cedf8b49e37a1676",
  measurementId: "G-BL8NT4840E"
};
// ──────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export {
  app, auth, db, googleProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  doc, collection,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
  arrayUnion, arrayRemove,
  serverTimestamp,
  Timestamp,
  onSnapshot
};
