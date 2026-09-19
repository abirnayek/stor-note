import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBUXXQ0hqjjHMG5LLo9uhdVNa1KxC2ZYSE",
  authDomain: "sea-fish-stor-note.firebaseapp.com",
  projectId: "sea-fish-stor-note",
  storageBucket: "sea-fish-stor-note.firebasestorage.app",
  messagingSenderId: "390140060608",
  appId: "1:390140060608:web:c49d30f0b14dcb55859e25",
  measurementId: "G-WD8RF3JNST"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
