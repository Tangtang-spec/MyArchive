import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signOut,
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

// จับเหตุการณ์เมื่อกดปุ่ม "ออกจากระบบ"
const logoutBtn = document.getElementById("btn-logout");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault(); // ป้องกันไม่ให้ลิงก์เคลียร์หน้าเว็บเปล่า ๆ
                    
        if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
            try {
                await signOut(auth);
                alert("ออกจากระบบสำเร็จแล้ว!");
                window.location.href = "login.html"; // เตะกลับไปหน้าล็อกอินหลัก
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการ Log out:", error.message);
                alert("ไม่สามารถออกจากระบบได้ กรุณาลองอีกครั้ง");
            }
        }
    });
}