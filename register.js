import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// ตั้งค่า Firebase Configuration
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

// บันทึกข้อมูลผู้ใช้ลง Cloud Firestore Database
async function saveUserToDatabase(user, providerId, customName = null) {
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);

    if (!docSnap.exists()) {
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: customName || user.displayName || "Specimen 1",
            photoURL: user.photoURL || "",
            role: "user", // กำหนดสิทธิ์เริ่มต้น
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

// สมัครสมาชิกปกติ (Email / Password)
const registerForm = document.querySelector("form");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm-password").value;

        // ตรวจสอบรหัสผ่าน
        if (password !== confirmPassword) {
            alert("รหัสผ่านไม่ตรงกัน!");
            return;
        }

        if (password.length < 6) {
            alert("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
            return;
        }

        try {
            // สร้าง Account ใน Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // บันทึก Display Name ในโปรไฟล์ Firebase Auth
            if (username) {
                await updateProfile(user, { displayName: username });
            }

            // บันทึกลง Firestore Database
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

// สมัครสมาชิกด้วย Google
const googleBtn = document.querySelector(".btn-google");
if (googleBtn) {
    // ลบ attribute inline onclick บน HTML เพื่อป้องกันการ Redirect ก่อนยืนยันตัวตนสำเร็จ
    googleBtn.removeAttribute("onclick");

    googleBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            await saveUserToDatabase(result.user, "google.com");
            alert("เชื่อมต่อ Google สำเร็จ!");
            window.location.href = "homepage.html";
        } catch (error) {
            console.error("Google Register Error:", error);
            if (error.code !== "auth/popup-closed-by-user") {
                alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Google");
            }
        }
    });
}