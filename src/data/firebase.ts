// Single Firebase client entry point. Initialises the app from the public
// VITE_FIREBASE_* config and, when VITE_USE_FIREBASE_EMULATOR is set, wires the
// SDK to the local Auth/Firestore/Functions emulators instead of production.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-worldcup-sweep',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'demo-app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'demo-sender',
};

let app: FirebaseApp | null = null;
let connected = false;

function getApp(): FirebaseApp {
  if (!app) app = initializeApp(config);
  return app;
}

/** Connect the SDK to local emulators exactly once. */
function connectEmulatorsOnce(auth: Auth, db: Firestore, fns: Functions): void {
  if (connected || !useEmulator) return;
  connected = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
}

export function firebaseAuth(): Auth {
  const auth = getAuth(getApp());
  connectEmulatorsOnce(auth, getFirestore(getApp()), getFunctions(getApp()));
  return auth;
}

export function firebaseDb(): Firestore {
  const db = getFirestore(getApp());
  connectEmulatorsOnce(getAuth(getApp()), db, getFunctions(getApp()));
  return db;
}

export function firebaseFunctions(): Functions {
  const fns = getFunctions(getApp());
  connectEmulatorsOnce(getAuth(getApp()), getFirestore(getApp()), fns);
  return fns;
}
