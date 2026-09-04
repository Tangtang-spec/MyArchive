import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDq5_JfoO8iVa-ZoobyetWchPSHeTwGKCQ",
  authDomain: "fictionarchive.firebaseapp.com",
  projectId: "fictionarchive",
  storageBucket: "fictionarchive.firebasestorage.app",
  messagingSenderId: "629845800031",
  appId: "1:629845800031:web:bea825a00e55dcfd4ad7ea"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();