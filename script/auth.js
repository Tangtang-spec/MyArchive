import { auth, db, googleProvider } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    updateProfile,
    getAdditionalUserInfo,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    doc, 
    setDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- ฟังก์ชันเปิด Modal แจ้งเตือน ---
function showModal({ type = "success", title, message, onConfirm }) {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;

    const modalCard = modal.querySelector(".modal-card");
    const iconEl = document.getElementById("modal-icon");
    const titleEl = document.getElementById("modal-title");
    const msgEl = document.getElementById("modal-message");
    const btn = document.getElementById("modal-btn");

    titleEl.textContent = title;
    msgEl.textContent = message;

    modalCard.className = `modal-card ${type}`;
    iconEl.innerHTML = type === "success" ? "✓" : "✕";

    modal.classList.add("active");

    btn.onclick = () => {
        modal.classList.remove("active");
        if (onConfirm) onConfirm();
    };
}

// แปลง Error Code จาก Firebase เป็นภาษาไทย
function getErrorMessage(code) {
    switch (code) {
        case "auth/invalid-credential":
            return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        case "auth/email-already-in-use":
            return "อีเมลนี้ถูกใช้งานในระบบแล้ว";
        case "auth/weak-password":
            return "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร";
        case "auth/popup-blocked":
            return "เบราว์เซอร์ของคุณบล็อก Popup กรุณาอนุญาตการเปิด Popup";
        default:
            return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
    }
}

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
            const user = userCredential.user;

            await updateProfile(user, { displayName: name });
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                displayName: name,
                email: user.email,
                photoURL: "",
                provider: "password",
                role: "user",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            showModal({
                type: "success",
                title: "สมัครสมาชิกสำเร็จ",
                message: "สร้างบัญชีผู้ใช้เรียบร้อยแล้ว ยินดีต้อนรับ!",
                onConfirm: () => { window.location.href = "homepage.html"; }
            });

        } catch (error) {
            showModal({
                type: "error",
                title: "สมัครสมาชิกไม่สำเร็จ",
                message: getErrorMessage(error.code)
            });
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
        const rememberMe = document.getElementById("remember-me")?.checked;

        try {
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);
            
            await signInWithEmailAndPassword(auth, email, password);
            
            showModal({
                type: "success",
                title: "เข้าสู่ระบบสำเร็จ",
                message: "กำลังนำคุณไปยังหน้าหลัก...",
                onConfirm: () => { window.location.href = "homepage.html"; }
            });

        } catch (error) {
            showModal({
                type: "error",
                title: "เข้าสู่ระบบไม่สำเร็จ",
                message: getErrorMessage(error.code)
            });
        }
    });
}

// --- 3. เข้าสู่ระบบ / สมัครสมาชิกด้วย Google (Popup) ---
const handleGoogleAuth = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const userInfo = getAdditionalUserInfo(result);
        const userRef = doc(db, "users", user.uid);

        if (userInfo?.isNewUser) {
            await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName || "Google User",
                email: user.email,
                photoURL: user.photoURL || "",
                provider: "google.com",
                role: "user",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } else {
            await setDoc(userRef, { updatedAt: serverTimestamp() }, { merge: true });
        }

        showModal({
            type: "success",
            title: "ยืนยันตัวตนสำเร็จ",
            message: `เข้าสู่ระบบในชื่อ ${user.displayName || user.email}`,
            onConfirm: () => { window.location.href = "homepage.html"; }
        });

    } catch (error) {
        if (error.code !== "auth/popup-closed-by-user") {
            showModal({
                type: "error",
                title: "เข้าสู่ระบบไม่สำเร็จ",
                message: getErrorMessage(error.code)
            });
        }
    }
};

const googleLoginBtn = document.getElementById("btn-google-login");
const googleRegBtn = document.getElementById("btn-google-register");
if (googleLoginBtn) googleLoginBtn.addEventListener("click", handleGoogleAuth);
if (googleRegBtn) googleRegBtn.addEventListener("click", handleGoogleAuth);

// --- 4. ลืมรหัสผ่าน ---
const forgotPassLink = document.getElementById("forgot-password");
if (forgotPassLink) {
    forgotPassLink.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = prompt("กรุณากรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน:");
        if (email) {
            try {
                await sendPasswordResetEmail(auth, email);
                showModal({
                    type: "success",
                    title: "ส่งอีเมลสำเร็จ",
                    message: "ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณเรียบร้อยแล้ว"
                });
            } catch (error) {
                showModal({
                    type: "error",
                    title: "เกิดข้อผิดพลาด",
                    message: getErrorMessage(error.code)
                });
            }
        }
    });
}