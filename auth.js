import { auth, googleProvider } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    updateProfile,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- 1. สมัครสมาชิกด้วย Email & Password ---
const registerForm = document.getElementById("register-form");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("reg-name").value;
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            alert("สมัครสมาชิกสำเร็จ!");
            window.location.href = "index.html"; // เปลี่ยนไปยังหน้า Dashboard หลัก
        } catch (error) {
            alert("เกิดข้อผิดพลาด: " + error.message);
        }
    });
}

// --- 2. เข้าสู่ระบบด้วย Email & Password ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        const rememberMe = document.getElementById("remember-me").checked;

        try {
            // ตั้งค่าสถานะการจำการเข้าสู่ระบบ
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);
            
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "index.html"; // เปลี่ยนไปยังหน้า Dashboard หลัก
        } catch (error) {
            alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
        }
    });
}

// --- 3. เข้าสู่ระบบ / สมัครด้วย Google ---
const googleLoginBtn = document.getElementById("btn-google-login");
const googleRegBtn = document.getElementById("btn-google-register");

const handleGoogleAuth = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
        window.location.href = "index.html";
    } catch (error) {
        alert("การยืนยันตัวตนด้วย Google ล้มเหลว: " + error.message);
    }
};

if (googleLoginBtn) googleLoginBtn.addEventListener("click", handleGoogleAuth);
if (googleRegBtn) googleRegBtn.addEventListener("click", handleGoogleAuth);

// --- 4. ระบบรีเซ็ตรหัสผ่าน ---
const forgotPassLink = document.getElementById("forgot-password");
if (forgotPassLink) {
    forgotPassLink.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = prompt("กรุณากรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน:");
        if (email) {
            try {
                await sendPasswordResetEmail(auth, email);
                alert("ส่งลิงก์สำหรับเปลี่ยนรหัสผ่านไปยังอีเมลของคุณเรียบร้อยแล้ว");
            } catch (error) {
                alert("เกิดข้อผิดพลาด: " + error.message);
            }
        }
    });
}