import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, getDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const currentProjectId = new URLSearchParams(window.location.search).get("projectId");
const readerContainer = document.getElementById("reader-container");
const projectTitleEl = document.getElementById("reader-project-title");
const btnBackWriting = document.getElementById("btn-back-writing");

if (btnBackWriting && currentProjectId) {
    btnBackWriting.href = `writing.html?projectId=${currentProjectId}`;
}

onAuthStateChanged(auth, async (user) => {
    if (user && currentProjectId) {
        fetchProjectTitle(user.uid, currentProjectId);
        loadContinuousEpisodes(user.uid, currentProjectId);
    } else if (!currentProjectId) {
        readerContainer.innerHTML = `<div class="empty-state">ไม่พบรหัสโปรเจกต์ กรุณากลับไปเลือกโปรเจกต์ก่อน</div>`;
    } else {
        window.location.href = "login.html";
    }
});

async function fetchProjectTitle(userId, projectId) {
    try {
        const snap = await getDoc(doc(db, "users", userId, "projects", projectId));
        if (snap.exists()) {
            projectTitleEl.textContent = snap.data().title || "อ่านนิยาย";
        }
    } catch (err) {
        console.error("Error fetching title:", err);
    }
}

function loadContinuousEpisodes(userId, projectId) {
    const episodesRef = collection(db, "users", userId, "projects", projectId, "episodes");
    const q = query(episodesRef, orderBy("order", "asc"));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            readerContainer.innerHTML = `<div class="empty-state">ยังไม่มีตอนในโปรเจกต์นี้</div>`;
            return;
        }

        readerContainer.innerHTML = "";
        
        // แก้ไขจุดนี้: ใช้ snapshot.docs.forEach เพื่อให้ได้ index ที่ถูกต้อง
        snapshot.docs.forEach((docSnap, index) => {
            const data = docSnap.data();
            const chapterArticle = document.createElement("article");
            chapterArticle.className = "reader-chapter-card";

            chapterArticle.innerHTML = `
                <div class="reader-chapter-badge">ตอนที่ ${index + 1}</div>
                <h3 class="reader-chapter-title">${escapeHtml(data.title)}</h3>
                <div class="reader-chapter-content">${escapeHtml(data.content || "ไม่มีเนื้อหา")}</div>
            `;
            readerContainer.appendChild(chapterArticle);
        });
    });
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]) : '';
}