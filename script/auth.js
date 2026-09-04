import { auth, googleProvider } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    updateProfile,
    getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    setDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const db = getFirestore();

/**
 * ฟังก์ชันสำหรับเปิดแสดง Popup แจ้งเตือน
 */
function showModal({ type = "success", title, message, onConfirm }) {
    const modal = document.getElementById("auth-modal");
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

// แปลง Error Code จาก Firebase ให้เป็นข้อความภาษาไทย
function getErrorMessage(code) {
    switch (code) {
        case "auth/invalid-credential":
            return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        case "auth/email-already-in-use":
            return "อีเมลนี้ถูกใช้งานในระบบแล้ว";
        case "auth/weak-password":
            return "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร";
        case "auth/popup-closed-by-user":
            return "คุณได้ยกเลิกการเข้าสู่ระบบผ่าน Google";
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
                onConfirm: () => { 
                    // เปลี่ยนเป้าหมายไปยัง homepage.html
                    window.location.href = "homepage.html"; 
                }
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

        try {
            await signInWithEmailAndPassword(auth, email, password);
            
            showModal({
                type: "success",
                title: "เข้าสู่ระบบสำเร็จ",
                message: "กำลังนำคุณไปยังหน้าหลัก...",
                onConfirm: () => { 
                    // เปลี่ยนเป้าหมายไปยัง homepage.html
                    window.location.href = "homepage.html"; 
                }
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

// --- 3. เข้าสู่ระบบ / สมัครด้วย Google ---
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
            onConfirm: () => { 
                // เปลี่ยนเป้าหมายไปยัง homepage.html
                window.location.href = "homepage.html"; 
            }
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

/**
 * ฟังก์ชันเรียกเปิด Popup เข้าสู่ระบบ / สมัครสมาชิกด้วย Google
 */
async function handleGoogleAuth() {
    try {
        // คำสั่ง signInWithPopup จะเปิดหน้าต่าง Popup เลือกบัญชี Google ขึ้นมา
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const userInfo = getAdditionalUserInfo(result);

        const userRef = doc(db, "users", user.uid);

        // ตรวจสอบว่าเป็นผู้ใช้ใหม่ที่เพิ่งกดสมัครหรือไม่
        if (userInfo?.isNewUser) {
            // บันทึกข้อมูลผู้ใช้ใหม่ลง Firestore
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

            showModal({
                type: "success",
                title: "สมัครสมาชิกด้วย Google สำเร็จ",
                message: `ยินดีต้อนรับคุณ ${user.displayName || user.email}`,
                onConfirm: () => { window.location.href = "homepage.html"; }
            });
        } else {
            // กรณีเป็นผู้ใช้เดิม เข้าสู่ระบบ
            await setDoc(userRef, { updatedAt: serverTimestamp() }, { merge: true });

            showModal({
                type: "success",
                title: "เข้าสู่ระบบด้วย Google สำเร็จ",
                message: `ยินดีต้อนรับกลับ ${user.displayName || user.email}`,
                onConfirm: () => { window.location.href = "homepage.html"; }
            });
        }

    } catch (error) {
        console.error("Google Auth Error:", error);

        // ดักจับ Error กรณีผู้ใช้ปิด Popup หรือเบราว์เซอร์บล็อก Popup
        if (error.code === "auth/popup-closed-by-user") {
            // ปิด Popup เอง ไม่ต้องขึ้น alert รบกวนผู้ใช้
            console.log("ผู้ใช้กดปิดหน้าต่าง Google Popup");
        } else if (error.code === "auth/popup-blocked") {
            showModal({
                type: "error",
                title: "เกิดข้อผิดพลาด",
                message: "เบราว์เซอร์ของคุณบล็อก Popup กรุณาอนุญาตให้เปิด Popup สำหรับเว็บไซต์นี้"
            });
        } else {
            showModal({
                type: "error",
                title: "เกิดข้อผิดพลาด",
                message: error.message
            });
        }
    }
}

// ผูก Event Listener เข้ากับปุ่ม Google ในหน้าสมัครและหน้าเข้าสู่ระบบ
document.addEventListener("DOMContentLoaded", () => {
    const googleLoginBtn = document.getElementById("btn-google-login");
    const googleRegBtn = document.getElementById("btn-google-register");

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener("click", handleGoogleAuth);
    }
    if (googleRegBtn) {
        googleRegBtn.addEventListener("click", handleGoogleAuth);
    }
});

const googleLoginBtn = document.getElementById("btn-google-login");
const googleRegBtn = document.getElementById("btn-google-register");
if (googleLoginBtn) googleLoginBtn.addEventListener("click", handleGoogleAuth);
if (googleRegBtn) googleRegBtn.addEventListener("click", handleGoogleAuth);