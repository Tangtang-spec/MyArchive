import { auth, googleProvider } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

// เพิ่ม Import สำหรับ Firestore
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const db = getFirestore();

/**
 * ฟังก์ชันช่วยบันทึก/อัปเดต ข้อมูลผู้ใช้ลง Firestore
 */
async function saveUserData(user, extraData = {}) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    // หากยังไม่มี Document ของผู้ใช้ หรือต้องการอัปเดตข้อมูลเพิ่มเติม
    if (!docSnap.exists()) {
        const userData = {
            uid: user.uid,
            displayName: extraData.displayName || user.displayName || "Anonymous",
            email: user.email,
            photoURL: user.photoURL || "",
            provider: user.providerData[0]?.providerId || "password",
            role: "user",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        await setDoc(userRef, userData);
    } else {
        // กรณีผู้ใช้เข้าสู่ระบบด้วย Google ซ้ำ ให้อัปเดตเฉพาะวันที่ล่าสุด
        await setDoc(userRef, { updatedAt: serverTimestamp() }, { merge: true });
    }
}

// --- 1. การสมัครสมาชิกด้วย Email & Password ---
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

            // อัปเดต Profile ใน Firebase Auth
            await updateProfile(user, { displayName: name });

            // บันทึกข้อมูลผู้ใช้ลง Firestore
            await saveUserData(user, { displayName: name });

            alert("สมัครสมาชิกสำเร็จ!");
            window.location.href = "index.html";
        } catch (error) {
            alert("เกิดข้อผิดพลาด: " + error.message);
        }
    });
}

// --- 2. การเข้าสู่ระบบ / สมัครด้วย Google ---
const handleGoogleAuth = async () => {
    try {
        const userCredential = await signInWithPopup(auth, googleProvider);
        const user = userCredential.user;

        // บันทึกข้อมูลผู้ใช้ลง Firestore
        await saveUserData(user);

        window.location.href = "index.html";
    } catch (error) {
        alert("การยืนยันตัวตนด้วย Google ล้มเหลว: " + error.message);
    }
};

const googleLoginBtn = document.getElementById("btn-google-login");
const googleRegBtn = document.getElementById("btn-google-register");
if (googleLoginBtn) googleLoginBtn.addEventListener("click", handleGoogleAuth);
if (googleRegBtn) googleRegBtn.addEventListener("click", handleGoogleAuth);