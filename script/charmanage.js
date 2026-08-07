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

let currentUser = null;
let characters = [];

// ตรวจสอบสถานะการเข้าสู่ระบบ
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await fetchUserCharacters();
    } else {
        window.location.href = "login.html"; // หากยังไม่ล็อกอิน ให้กลับไปหน้า Login
    }
});

// ดึงข้อมูลตัวละครเฉพาะของผู้ใช้นี้ (User Isolation)
async function fetchUserCharacters() {
    if (!currentUser) return;
    
    // ค้นหาเฉพาะเอกสารที่มี userId ตรงกับ uid ของผู้ใช้
    const q = query(collection(db, "characters"), where("userId", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    characters = [];
    querySnapshot.forEach((docSnap) => {
        characters.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    renderCharacters();
}

// เพิ่มหรือแก้ไขตัวละครลง Firestore
const charForm = document.getElementById('char-form');
charForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('char-id').value;
    const charData = {
        userId: currentUser.uid, // ผูกข้อมูลกับ User ID
        name: document.getElementById('char-name').value,
        role: document.getElementById('char-role').value,
        race: document.getElementById('char-race').value,
        ability: document.getElementById('char-ability').value,
        desc: document.getElementById('char-desc').value,
        updatedAt: serverTimestamp()
    };

    if (id) {
        await updateDoc(doc(db, "characters", id), charData);
    } else {
        charData.createdAt = serverTimestamp();
        charData.relationships = [];
        await addDoc(collection(db, "characters"), charData);
    }

    closeAllModals();
    await fetchUserCharacters();
});

// ลบตัวละครออกจาก Firestore
window.deleteCharacter = async function(id) {
    if (confirm("คุณต้องการลบตัวละครนี้ใช่หรือไม่?")) {
        await deleteDoc(doc(db, "characters", id));
        await fetchUserCharacters();
    }
}