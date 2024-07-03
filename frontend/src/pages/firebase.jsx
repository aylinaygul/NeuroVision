


import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// Firebase konfigürasyon bilgilerinizi buraya ekleyin
const firebaseConfig = {
    apiKey: "AIzaSyDRMjYeU0Udl8Y-byPnjRPHZOgYJo85NeA",
    authDomain: "bitirme-user.firebaseapp.com",
    projectId: "bitirme-user",
    storageBucket: "bitirme-user.appspot.com",
    messagingSenderId: "800183994843",
    appId: "1:800183994843:web:73ed8b12fde89bf1f47ffe"
  };

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Firebase Authentication ve Firestore'u alın
export const auth = getAuth(app);
export const db = getFirestore(app);

export { createUserWithEmailAndPassword, sendEmailVerification };
export default app;
