import { auth, googleProvider } from "./firebase-config.js";
import { 
    signInWithPopup, 
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
 * ฟังก์ชันเข้าสู่ระบบ / สมัครสมาชิกด้วย Google
 * @returns {Promise<void>}
 */
export async function handleGoogleSignIn() {
    try {
        // 1. แสดง Popup ให้ผู้ใช้เลือกบัญชี Google
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        // 2. เช็คว่าผู้ใช้นี้เข้าใช้งานครั้งแรกหรือไม่
        const userInfo = getAdditionalUserInfo(result);
        const isNewUser = userInfo?.isNewUser;

        const userRef = doc(db, "users", user.uid);

        if (isNewUser) {
            // --- กรณี: สมัครสมาชิกใหม่ (Register) ---
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

            alert("สมัครสมาชิกด้วย Google สำเร็จ!");
        } else {
            // --- กรณี: เข้าสู่ระบบผู้ใช้เดิม (Login) ---
            await setDoc(userRef, {
                updatedAt: serverTimestamp()
            }, { merge: true });

            alert("เข้าสู่ระบบด้วย Google สำเร็จ!");
        }

        // 3. ย้ายไปหน้า Dashboard หลัก
        window.location.href = "index.html";

    } catch (error) {
        console.error("Google Auth Error:", error);

        // จัดการกรณีผู้ใช้ปิดหน้าต่าง Popup ก่อนเข้าสู่ระบบสำเร็จ
        if (error.code === "auth/popup-closed-by-user") {
            alert("ยกเลิกการเข้าสู่ระบบผ่าน Google");
        } else {
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google: " + error.message);
        }
    }
}