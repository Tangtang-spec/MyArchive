import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const projectsContainer = document.getElementById("projects-container");
const filterContainer = document.getElementById("filter-container");
const searchInput = document.getElementById("search-input");

// User Elements
const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// Modal Elements
const projectModal = document.getElementById("project-modal");
const btnOpenModal = document.getElementById("btn-open-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const createProjectForm = document.getElementById("create-project-form");

let currentUser = null;
let rawProjects = [];
let activeGenre = "all";
let searchQuery = "";

// --- 1. ตรวจสอบ Auth State ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        updateUserProfile(user);
        listenToProjects(user.uid);
    } else {
        window.location.href = "login.html";
    }
});

function updateUserProfile(user) {
    const name = user.displayName || user.email.split("@")[0];
    userNameEl.textContent = name;
    userAvatarEl.textContent = name.charAt(0).toUpperCase();
}

// --- 2. Real-time Listener ดึงข้อมูล Projects ทั้งหมด ---
function listenToProjects(userId) {
    const projectsRef = collection(db, "users", userId, "projects");
    const q = query(projectsRef, orderBy("updatedAt", "desc"));

    onSnapshot(q, (snapshot) => {
        rawProjects = [];
        snapshot.forEach((docSnap) => {
            rawProjects.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderProjects();
    }, (error) => {
        console.error("Error fetching projects:", error);
        projectsContainer.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการดึงข้อมูล</div>`;
    });
}

// --- 3. Render และ กรองข้อมูล (Filter & Search) ---
function renderProjects() {
    let filtered = rawProjects;

    // Filter ตาม Genre
    if (activeGenre !== "all") {
        filtered = filtered.filter(p => 
            p.genre && p.genre.toLowerCase() === activeGenre.toLowerCase()
        );
    }

    // Filter ตาม Search Text
    if (searchQuery.trim() !== "") {
        const queryLower = searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            (p.title && p.title.toLowerCase().includes(queryLower)) ||
            (p.description && p.description.toLowerCase().includes(queryLower)) ||
            (p.genre && p.genre.toLowerCase().includes(queryLower))
        );
    }

    // อัปเดตตัวเลขในปุ่ม "ทั้งหมด"
    const btnAll = filterContainer.querySelector('[data-genre="all"]');
    if (btnAll) btnAll.textContent = `ทั้งหมด (${rawProjects.length})`;

    if (filtered.length === 0) {
        projectsContainer.innerHTML = `<div class="empty-state">ไม่พบโปรเจกต์ที่ตรงกับการค้นหา</div>`;
        return;
    }

    projectsContainer.innerHTML = "";
    filtered.forEach(data => {
        const card = createProjectCard(data);
        projectsContainer.appendChild(card);
    });
}

function createProjectCard(data) {
    const card = document.createElement("div");
    card.className = "pc-project-card";
    
    const updatedAt = data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleDateString("th-TH", {
        day: "numeric", month: "short", year: "numeric"
    }) : "เมื่อเร็วๆ นี้";

    const themeClass = data.theme || "fantasy";

    card.innerHTML = `
        <div class="card-cover ${themeClass}"></div>
        <div class="card-body">
            <h4>${escapeHtml(data.title)}</h4>
            <p class="desc">${escapeHtml(data.genre)} | ${escapeHtml(data.description || "ไม่มีคำอธิบาย")}</p>
            
            <div class="project-meta-info">
                <div class="meta-item">👥 ตัวละคร: ${data.characterCount || 0}</div>
                <div class="meta-item">🌍 สถานที่: ${data.worldbuildingCount || 0}</div>
                <div class="meta-item">✨ พลังวิเศษ: ${data.powerCount || 0}</div>
                <div class="meta-item">📝 บทนิยาย: ${data.chapterCount || 0}</div>
            </div>

            <div class="card-footer">
                <span class="time">อัปเดตล่าสุด: ${updatedAt}</span>
            </div>
        </div>
    `;

    card.addEventListener("click", () => {
        window.location.href = `fictionproject.html?id=${data.id}`;
    });

    return card;
}

// --- 4. Event Listeners สำหรับ Filter & Search ---
filterContainer.addEventListener("click", (e) => {
    const filterBtn = e.target.closest(".btn-filter");
    if (!filterBtn) return;

    filterContainer.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("active"));
    filterBtn.classList.add("active");

    activeGenre = filterBtn.getAttribute("data-genre");
    renderProjects();
});

searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderProjects();
});

// --- 5. Modal Controllers ---
const openModal = () => projectModal.classList.add("active");
const closeModal = () => {
    projectModal.classList.remove("active");
    createProjectForm.reset();
};

btnOpenModal.addEventListener("click", openModal);
btnCloseModal.addEventListener("click", closeModal);
btnCancelModal.addEventListener("click", closeModal);

projectModal.addEventListener("click", (e) => {
    if (e.target === projectModal) closeModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && projectModal.classList.contains("active")) closeModal();
});

// สร้างโปรเจกต์ใหม่
createProjectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const title = document.getElementById("project-title").value.trim();
    const genre = document.getElementById("project-genre").value.trim();
    const theme = document.getElementById("project-theme").value;
    const description = document.getElementById("project-desc").value.trim();

    try {
        const projectsRef = collection(db, "users", currentUser.uid, "projects");
        await addDoc(projectsRef, {
            title,
            genre,
            theme,
            description,
            characterCount: 0,
            worldbuildingCount: 0,
            powerCount: 0,
            chapterCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        closeModal();
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการสร้างโปรเจกต์: " + error.message);
    }
});

// --- 6. Logout ---
if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            window.location.href = "login.html";
        });
    });
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]) : '';
}