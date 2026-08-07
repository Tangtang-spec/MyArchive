import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    updateProfile, 
    GoogleAuthProvider, 
    signInWithPopup 
} from "firebase/auth";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp 
} from "firebase/firestore";

import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDq5_JfoO8iVa-ZoobyetWchPSHeTwGKCQ",
  authDomain: "fictionarchive.firebaseapp.com",
  projectId: "fictionarchive",
  storageBucket: "fictionarchive.firebasestorage.app",
  messagingSenderId: "629845800031",
  appId: "1:629845800031:web:bea825a00e55dcfd4ad7ea"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function updateLoginTimestamp(user, providerId) {
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        await setDoc(userDocRef, {
            lastLoginAt: serverTimestamp()
        }, { merge: true });
    } else {
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "Specimen 1",
            photoURL: user.photoURL || "",
            role: "user",
            providerId: providerId,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp()
        });
    }
}

const loginForm = document.querySelector("form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            await updateLoginTimestamp(userCredential.user, "password");
            alert("เข้าสู่ระบบสำเร็จ!");
            window.location.href = "homepage.html";
        } catch (error) {
            console.error("Login Error:", error);
            let errorMessage = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
            if (
                error.code === "auth/invalid-credential" || 
                error.code === "auth/wrong-password" || 
                error.code === "auth/user-not-found"
            ) {
                errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
            } else if (error.code === "auth/invalid-email") {
                errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
            }
            alert(errorMessage);
        }
    });
}

const googleBtn = document.querySelector(".btn-google");

if (googleBtn) {
    googleBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const auth = getAuth();
        const db = getFirestore();
        const provider = new GoogleAuthProvider();

        try {
            // 1. แสดง Popup ให้ผู้ใช้เข้าสู่ระบบด้วย Google
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // 2. ตรวจสอบว่ามีข้อมูลผู้ใช้ใน Firestore แล้วหรือยัง
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                // หากยังไม่มี (สมัครใหม่) ให้บันทึกข้อมูลใหม่
                await setDoc(userRef, {
                    uid: user.uid,
                    displayName: user.displayName || "User",
                    email: user.email,
                    photoURL: user.photoURL || "",
                    providerId: "google.com",
                    role: "user",
                    createdAt: serverTimestamp(),
                    lastLoginAt: serverTimestamp()
                });
            } else {
                // หากมีแล้ว (เข้าสู่ระบบ) ให้ อัปเดตเวลาเข้าใช้งานล่าสุด
                await setDoc(userRef, {
                    lastLoginAt: serverTimestamp()
                }, { merge: true });
            }

            alert("เข้าสู่ระบบด้วย Google สำเร็จ!");
            window.location.href = "homepage.html";

        } catch (error) {
            console.error("Google Auth Error:", error);
            if (error.code !== "auth/popup-closed-by-user") {
                alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Google");
            }
        }
    });
}