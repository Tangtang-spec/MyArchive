// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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

// ฟังก์ชันอัปเดตเวลาใช้งานล่าสุด / สร้างข้อมูลผู้ใช้กรณีสร้างผ่าน Google
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

// ล็อกอินปกติ (Email / Password)
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

// ล็อกอินด้วย Google
const googleBtn = document.querySelector(".btn-google");
if (googleBtn) {
    // ลบ attribute inline onclick บน HTML เพื่อป้องกันการ Redirect ก่อนยืนยันตัวตนสำเร็จ
    googleBtn.removeAttribute("onclick");
    
    googleBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            await updateLoginTimestamp(result.user, "google.com");
            alert("เข้าสู่ระบบด้วย Google สำเร็จ!");
            window.location.href = "homepage.html";
        } catch (error) {
            console.error("Google Auth Error:", error);
            if (error.code !== "auth/popup-closed-by-user") {
                alert("เกิดข้อผิดพลาดในการล็อกอินด้วย Google");
            }
        }
    });
}