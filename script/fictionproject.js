import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    collection, 
    addDoc, 
    doc,
    updateDoc,
    deleteDoc,
    query, 
    orderBy, 
    onSnapshot,
    getCountFromServer,
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

// Modal Elements (Form Create/Edit)
const projectModal = document.getElementById("project-modal");
const btnOpenModal = document.getElementById("btn-open-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const projectForm = document.getElementById("project-form");
const modalTitle = document.getElementById("modal-title");
const btnSubmitProject = document.getElementById("btn-submit-project");

// Modal Elements (Project Detail & Quick Links)
const projectDetailModal = document.getElementById("project-detail-modal");
const btnCloseDetailModal = document.getElementById("btn-close-detail-modal");

let currentUser = null;
let rawProjects = [];
let activeGenre = "all";
let searchQuery = "";

// --- 1. Auth State Observer ---
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
    if (userNameEl) userNameEl.textContent = name;
    if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
}

// --- 2. Real-time Listener ---
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

// --- 3. Render Projects ---
function renderProjects() {
    let filtered = rawProjects;

    if (activeGenre !== "all") {
        filtered = filtered.filter(p => 
            p.genre && p.genre.toLowerCase() === activeGenre.toLowerCase()
        );
    }

    if (searchQuery.trim() !== "") {
        const queryLower = searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            (p.title && p.title.toLowerCase().includes(queryLower)) ||
            (p.description && p.description.toLowerCase().includes(queryLower)) ||
            (p.genre && p.genre.toLowerCase().includes(queryLower))
        );
    }

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
    card.style.cursor = "pointer";
    
    const updatedAt = data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleDateString("th-TH", {
        day: "numeric", month: "short", year: "numeric"
    }) : "เมื่อเร็วๆ นี้";

    const themeClass = data.theme || "fantasy";

    card.innerHTML = `
        <div class="card-cover ${themeClass}"></div>
        <div class="card-body">
            <h4>${escapeHtml(data.title)}</h4>
            <p class="desc">${escapeHtml(data.genre)} | ${escapeHtml(data.description || "ไม่มีคำอธิบาย")}</p>
            
            <div class="project-meta-info" style="grid-template-columns: repeat(3, 1fr);">
                <div class="meta-item">📝 บทนิยาย: ${data.chapterCount || 0}</div>
                <div class="meta-item">👥 ตัวละคร: ${data.characterCount || 0}</div>
                <div class="meta-item">🌍 Worldbuilding: ${data.worldbuildingCount || 0}</div>
            </div>

            <div class="card-footer">
                <span class="time">อัปเดตล่าสุด: ${updatedAt}</span>
            </div>

            <div class="card-action-bar">
                <button class="btn-card-action btn-edit-project">✏️ แก้ไข</button>
                <button class="btn-card-action delete btn-delete-project">🗑️ ลบ</button>
            </div>
        </div>
    `;

    // คลิกที่การ์ดเพื่อเปิด Modal รายละเอียดเชิงลึก
    card.addEventListener("click", () => {
        openDetailModal(data);
    });

    // ปุ่มแก้ไขโปรเจกต์
    card.querySelector(".btn-edit-project").addEventListener("click", (e) => {
        e.stopPropagation();
        openModal(data);
    });

    // ปุ่มลบโปรเจกต์
    card.querySelector(".btn-delete-project").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`คุณต้องการลบโปรเจกต์ "${data.title}" ใช่หรือไม่?`)) {
            try {
                const projectDocRef = doc(db, "users", currentUser.uid, "projects", data.id);
                await deleteDoc(projectDocRef);
            } catch (err) {
                alert("เกิดข้อผิดพลาดในการลบโปรเจกต์: " + err.message);
            }
        }
    });

    return card;
}

// --- 4. Detail Modal Helper (ดึงสถิติจริงเฉพาะ 3 หัวข้อ) ---
async function openDetailModal(data) {
    document.getElementById("detail-title").textContent = data.title || "ไม่มีชื่อโปรเจกต์";
    document.getElementById("detail-genre").textContent = data.genre || "General";
    document.getElementById("detail-desc").textContent = data.description || "ไม่มีคำอธิบายรายละเอียดสำหรับโปรเจกต์นี้";

    const updatedAt = data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleDateString("th-TH", {
        day: "numeric", month: "short", year: "numeric"
    }) : "เมื่อเร็วๆ นี้";
    document.getElementById("detail-updated-at").textContent = `อัปเดตล่าสุด: ${updatedAt}`;

    // แสดงสถานะกำลังโหลด
    document.getElementById("detail-chapter-count").textContent = "...";
    document.getElementById("detail-char-count").textContent = "...";
    document.getElementById("detail-wb-count").textContent = "...";

    // เชื่อมโยง URL ไปยังหัวข้อต่างๆ ตาม projectId
    document.getElementById("link-writing").href = `writing.html?projectId=${data.id}`;
    document.getElementById("link-characters").href = `characters.html?projectId=${data.id}`;
    document.getElementById("link-worldbuilding").href = `worldbuilding.html?projectId=${data.id}`;
    document.getElementById("link-timeline").href = `timeline.html?projectId=${data.id}`;

    projectDetailModal.classList.add("active");

    // ดึงจำนวนข้อมูลจริงจาก 3 Sub-collections แบบ Parallel
    if (currentUser) {
        try {
            const basePath = `users/${currentUser.uid}/projects/${data.id}`;
            const epRef = collection(db, `${basePath}/episodes`);
            const charRef = collection(db, `${basePath}/characters`);
            const wbRef = collection(db, `${basePath}/worldbuilding`);

            const [epSnap, charSnap, wbSnap] = await Promise.all([
                getCountFromServer(epRef),
                getCountFromServer(charRef),
                getCountFromServer(wbRef)
            ]);

            document.getElementById("detail-chapter-count").textContent = epSnap.data().count;
            document.getElementById("detail-char-count").textContent = charSnap.data().count;
            document.getElementById("detail-wb-count").textContent = wbSnap.data().count;
        } catch (err) {
            console.error("เกิดข้อผิดพลาดในการดึงสถิติ:", err);
            // แสดงค่า Fallback หากการนับล้มเหลว
            document.getElementById("detail-chapter-count").textContent = data.chapterCount || 0;
            document.getElementById("detail-char-count").textContent = data.characterCount || 0;
            document.getElementById("detail-wb-count").textContent = data.worldbuildingCount || 0;
        }
    }
}

function closeDetailModal() {
    projectDetailModal.classList.remove("active");
}

if (btnCloseDetailModal) btnCloseDetailModal.addEventListener("click", closeDetailModal);
if (projectDetailModal) {
    projectDetailModal.addEventListener("click", (e) => {
        if (e.target === projectDetailModal) closeDetailModal();
    });
}

// --- 5. Form Modal Operations ---
function openModal(data = null) {
    projectForm.reset();

    if (data) {
        modalTitle.textContent = "แก้ไขโปรเจกต์";
        btnSubmitProject.textContent = "บันทึกการเปลี่ยนแปลง";
        document.getElementById("project-id").value = data.id;
        document.getElementById("project-title").value = data.title || "";
        document.getElementById("project-genre").value = data.genre || "";
        document.getElementById("project-theme").value = data.theme || "fantasy";
        document.getElementById("project-desc").value = data.description || "";
    } else {
        modalTitle.textContent = "สร้างโปรเจกต์ใหม่";
        btnSubmitProject.textContent = "สร้างโปรเจกต์";
        document.getElementById("project-id").value = "";
    }

    projectModal.classList.add("active");
}

function closeModal() {
    projectModal.classList.remove("active");
    projectForm.reset();
}

btnOpenModal.addEventListener("click", () => openModal());
btnCloseModal.addEventListener("click", closeModal);
btnCancelModal.addEventListener("click", closeModal);

projectModal.addEventListener("click", (e) => {
    if (e.target === projectModal) closeModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeModal();
        closeDetailModal();
    }
});

projectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const projectId = document.getElementById("project-id").value;
    const title = document.getElementById("project-title").value.trim();
    const genre = document.getElementById("project-genre").value.trim();
    const theme = document.getElementById("project-theme").value;
    const description = document.getElementById("project-desc").value.trim();

    try {
        if (projectId) {
            const projectDocRef = doc(db, "users", currentUser.uid, "projects", projectId);
            await updateDoc(projectDocRef, {
                title,
                genre,
                theme,
                description,
                updatedAt: serverTimestamp()
            });
        } else {
            const projectsRef = collection(db, "users", currentUser.uid, "projects");
            await addDoc(projectsRef, {
                title,
                genre,
                theme,
                description,
                characterCount: 0,
                worldbuildingCount: 0,
                chapterCount: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        closeModal();
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    }
});

// --- 6. Filters & Search ---
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

// Logout
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