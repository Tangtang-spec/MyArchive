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

async function saveUserToDatabase(user, providerId, customName = null) {
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: customName || user.displayName || "Specimen 1",
            photoURL: user.photoURL || "",
            role: "user",
            providerId: providerId,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp()
        });
    } else {
        await setDoc(userDocRef, {
            lastLoginAt: serverTimestamp()
        }, { merge: true });
    }
}

const registerForm = document.querySelector("form");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm-password").value;

        if (password !== confirmPassword) {
            alert("รหัสผ่านไม่ตรงกัน!");
            return;
        }

        if (password.length < 6) {
            alert("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (username) {
                await updateProfile(user, { displayName: username });
            }

            await saveUserToDatabase(user, "password", username);

            alert("สมัครสมาชิกสำเร็จ!");
            window.location.href = "login.html";
        } catch (error) {
            console.error("Register Error:", error);
            let errorMessage = "เกิดข้อผิดพลาดในการสมัครสมาชิก";
            if (error.code === "auth/email-already-in-use") {
                errorMessage = "อีเมลนี้ถูกใช้งานในระบบแล้ว";
            } else if (error.code === "auth/invalid-email") {
                errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
            } else if (error.code === "auth/weak-password") {
                errorMessage = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
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