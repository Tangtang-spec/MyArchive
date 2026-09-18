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
    getCountFromServer,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Elements ---
const projectsContainer = document.getElementById("projects-container");
const projectModal = document.getElementById("project-modal");
const btnOpenModal = document.getElementById("btn-open-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const createProjectForm = document.getElementById("create-project-form");
const btnLogout = document.getElementById("btn-logout");

// User Elements
const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const welcomeTitleEl = document.getElementById("welcome-title");

// --- Sidebar Toggle Logic ---
const sidebar = document.getElementById("sidebar");
const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
const dashboardContainer = document.querySelector(".dashboard-container");

if (btnToggleSidebar && sidebar) {
    // ดึงสถานะเดิมจาก localStorage (ถ้ามี)
    const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
    if (isCollapsed) {
        sidebar.classList.add("collapsed");
        if (dashboardContainer) dashboardContainer.classList.add("sidebar-collapsed");
    }

    // อีเวนต์คลิกปุ่มเพื่อเปิด/ปิด
    btnToggleSidebar.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        if (dashboardContainer) dashboardContainer.classList.toggle("sidebar-collapsed");

        // บันทึกสถานะลง localStorage
        const collapsedState = sidebar.classList.contains("collapsed");
        localStorage.setItem("sidebarCollapsed", collapsedState);
    });
}

// Stat Elements
const statTotalProjects = document.getElementById("stat-total-projects");
const statTotalChapters = document.getElementById("stat-total-chapters");
const statTotalCharacters = document.getElementById("stat-total-characters");
const statTotalWorldbuilding = document.getElementById("stat-total-worldbuilding");

let currentUser = null;

// --- 1. ตรวจสอบสถานะการเข้าสู่ระบบ ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        updateUserProfileUI(user);
        listenToUserProjects(user.uid);
    } else {
        window.location.href = "login.html";
    }
});

// อัปเดตข้อมูลผู้ใช้บน UI
function updateUserProfileUI(user) {
    const name = user.displayName || user.email.split("@")[0];
    if (userNameEl) userNameEl.textContent = name;
    if (welcomeTitleEl) welcomeTitleEl.textContent = `Welcome, ${name}`;
    if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
}

// --- 2. ดึงข้อมูล Projects & สถิติภาพรวมจาก Firestore (Real-time + Direct Count) ---
function listenToUserProjects(userId) {
    const projectsRef = collection(db, "users", userId, "projects");
    const q = query(projectsRef, orderBy("updatedAt", "desc"));

    onSnapshot(q, async (snapshot) => {
        if (snapshot.empty) {
            projectsContainer.innerHTML = `<div class="empty-state">ยังไม่มีโปรเจกต์ กดปุ่ม "+ New Project" เพื่อเริ่มต้นสร้าง</div>`;
            updateDashboardStats(0, 0, 0, 0);
            return;
        }

        projectsContainer.innerHTML = "";

        // ดึงจำนวนนับจาก Sub-collections ของทุกโปรเจกต์แบบ Parallel
        const projectPromises = snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const projectId = docSnap.id;

            // สร้าง Element การ์ดโปรเจกต์
            const card = createProjectCard(projectId, data);
            projectsContainer.appendChild(card);

            try {
                const basePath = `users/${userId}/projects/${projectId}`;
                const epRef = collection(db, `${basePath}/episodes`);
                const charRef = collection(db, `${basePath}/characters`);
                const wbRef = collection(db, `${basePath}/worldbuilding`);

                const [epSnap, charSnap, wbSnap] = await Promise.all([
                    getCountFromServer(epRef),
                    getCountFromServer(charRef),
                    getCountFromServer(wbRef)
                ]);

                return {
                    chapters: epSnap.data().count,
                    characters: charSnap.data().count,
                    worldbuilding: wbSnap.data().count
                };
            } catch (err) {
                console.error(`Error counting subcollections for project ${projectId}:`, err);
                return {
                    chapters: data.chapterCount || 0,
                    characters: data.characterCount || 0,
                    worldbuilding: data.worldbuildingCount || 0
                };
            }
        });

        const counts = await Promise.all(projectPromises);

        let totalChapters = 0;
        let totalChars = 0;
        let totalWorld = 0;

        counts.forEach(c => {
            totalChapters += c.chapters;
            totalChars += c.characters;
            totalWorld += c.worldbuilding;
        });

        // อัปเดตสถิติใน Right Panel
        updateDashboardStats(snapshot.size, totalChapters, totalChars, totalWorld);
    }, (error) => {
        console.error("Error fetching projects:", error);
        projectsContainer.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`;
    });
}

// สร้างการ์ด Project HTML
function createProjectCard(id, data) {
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
            <div class="card-footer">
                <span class="time">อัปเดตล่าสุด: ${updatedAt}</span>
            </div>
        </div>
    `;

    card.addEventListener("click", () => {
        window.location.href = `fictionproject.html?id=${id}`;
    });

    return card;
}

// อัปเดตตัวเลขคลังข้อมูลภาพรวม
function updateDashboardStats(projectCount, chapterCount, charCount, worldCount) {
    if (statTotalProjects) statTotalProjects.textContent = projectCount;
    if (statTotalChapters) statTotalChapters.textContent = chapterCount;
    if (statTotalCharacters) statTotalCharacters.textContent = charCount;
    if (statTotalWorldbuilding) statTotalWorldbuilding.textContent = `${worldCount} รายการ`;
}

// --- การใช้งาน Modal สร้าง Project ใหม่ ---
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
    if (e.key === "Escape" && projectModal.classList.contains("active")) {
        closeModal();
    }
});

// บันทึกโปรเจกต์ใหม่ลง Firestore
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
            chapterCount: 0,
            characterCount: 0,
            worldbuildingCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        closeModal();
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการสร้างโปรเจกต์: " + error.message);
    }
});

// --- 4. ออกจากระบบ (Logout) ---
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