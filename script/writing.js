import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    collection, 
    addDoc, 
    doc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query, 
    orderBy, 
    onSnapshot,
    writeBatch,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// อ่าน Parameter projectId จาก URL
let currentProjectId = new URLSearchParams(window.location.search).get("projectId");

// DOM Elements
const episodesContainer = document.getElementById("episodes-container");
const projectTitleHeading = document.getElementById("project-title-heading");
const projectSelectDropdown = document.getElementById("project-select-dropdown");
const searchInput = document.getElementById("search-input");

// User Profile
const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// Modal Elements
const episodeModal = document.getElementById("episode-modal");
const btnOpenModal = document.getElementById("btn-open-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const episodeForm = document.getElementById("episode-form");
const modalTitle = document.getElementById("modal-title");

let currentUser = null;
let rawEpisodes = [];
let searchQuery = "";
let unsubscribeEpisodes = null;

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

// --- 1. Auth Checker & Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        updateUserProfile(user);

        // ดึงรายชื่อโปรเจกต์ทั้งหมดมาใส่ Dropdown
        await loadProjectDropdownOptions(user.uid);

        if (currentProjectId) {
            if (projectSelectDropdown) projectSelectDropdown.value = currentProjectId;
            await fetchProjectHeader(user.uid, currentProjectId);
            listenToEpisodes(user.uid, currentProjectId);
        } else {
            episodesContainer.innerHTML = `<div class="empty-state">กรุณาเลือกโปรเจกต์จากเมนูด้านบนเพื่อเริ่มเขียน</div>`;
        }
    } else {
        window.location.href = "login.html";
    }
});

function updateUserProfile(user) {
    const name = user.displayName || user.email.split("@")[0];
    if (userNameEl) userNameEl.textContent = name;
    if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
}

// --- 2. โหลดรายชื่อโปรเจกต์ใส่ Dropdown ---
async function loadProjectDropdownOptions(userId) {
    if (!projectSelectDropdown) return;
    try {
        const projectsRef = collection(db, "users", userId, "projects");
        const snap = await getDocs(projectsRef);

        if (snap.empty) {
            projectTitleHeading.textContent = "ยังไม่มีโปรเจกต์ กรุณาสร้างโปรเจกต์ก่อน";
            return;
        }

        projectSelectDropdown.innerHTML = `<option value="">-- กรุณาเลือกโปรเจกต์ --</option>`;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const opt = document.createElement("option");
            opt.value = docSnap.id;
            opt.textContent = data.title || "ไม่มีชื่อโปรเจกต์";
            projectSelectDropdown.appendChild(opt);
        });

        projectSelectDropdown.style.display = "inline-block";
    } catch (err) {
        console.error("Error loading project list:", err);
    }
}

// Event เมื่อเลือกเปลี่ยนโปรเจกต์จาก Dropdown
if (projectSelectDropdown) {
    projectSelectDropdown.addEventListener("change", (e) => {
        const selectedId = e.target.value;
        if (selectedId) {
            currentProjectId = selectedId;
            window.history.pushState({}, "", `writing.html?projectId=${selectedId}`);
            fetchProjectHeader(currentUser.uid, selectedId);
            listenToEpisodes(currentUser.uid, selectedId);
        } else {
            currentProjectId = null;
            window.history.pushState({}, "", `writing.html`);
            if (unsubscribeEpisodes) unsubscribeEpisodes();
            projectTitleHeading.textContent = "กรุณาเลือกโปรเจกต์";
            rawEpisodes = [];
            renderEpisodes();
        }
    });
}

// --- 3. ดึงข้อมูลชื่อโปรเจกต์ ---
async function fetchProjectHeader(userId, pId) {
    try {
        const projectRef = doc(db, "users", userId, "projects", pId);
        const snap = await getDoc(projectRef);
        if (snap.exists()) {
            projectTitleHeading.textContent = snap.data().title || "ไม่มีชื่อโปรเจกต์";
            projectTitleHeading.style.display = "inline-block";
        } else {
            projectTitleHeading.textContent = "ไม่พบโปรเจกต์นี้";
        }
    } catch (err) {
        console.error("Error loading project header:", err);
    }
}

// --- 4. Real-time Listener ดึงตอนทั้งหมด เรียงตาม order ---
function listenToEpisodes(userId, pId) {
    if (unsubscribeEpisodes) {
        unsubscribeEpisodes();
    }

    const episodesRef = collection(db, "users", userId, "projects", pId, "episodes");
    const q = query(episodesRef, orderBy("order", "asc"));

    unsubscribeEpisodes = onSnapshot(q, (snapshot) => {
        rawEpisodes = [];
        snapshot.forEach((docSnap) => {
            rawEpisodes.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderEpisodes();
        updateChapterCountInProject(rawEpisodes.length);
    }, (error) => {
        console.error("Error fetching episodes:", error);
        episodesContainer.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการโหลดเนื้อหา</div>`;
    });
}

// --- 5. Render & Search ---
function renderEpisodes() {
    if (!currentProjectId) {
        episodesContainer.innerHTML = `<div class="empty-state">กรุณาเลือกโปรเจกต์จากเมนูด้านบนเพื่อเริ่มเขียน</div>`;
        return;
    }

    let filtered = rawEpisodes;

    if (searchQuery.trim() !== "") {
        const qLower = searchQuery.toLowerCase();
        filtered = filtered.filter(ep => 
            (ep.title && ep.title.toLowerCase().includes(qLower)) ||
            (ep.content && ep.content.toLowerCase().includes(qLower))
        );
    }

    if (filtered.length === 0) {
        episodesContainer.innerHTML = `<div class="empty-state">ยังไม่มีตอนในโปรเจกต์นี้ กด "+ เพิ่มตอนใหม่" เพื่อเริ่มเขียน</div>`;
        return;
    }

    episodesContainer.innerHTML = "";
    filtered.forEach((ep, index) => {
        const card = createEpisodeCard(ep, index, filtered.length);
        episodesContainer.appendChild(card);
    });
}

function createEpisodeCard(ep, index, total) {
    const card = document.createElement("div");
    card.className = "episode-item-card";

    const updatedAt = ep.updatedAt ? new Date(ep.updatedAt.toDate()).toLocaleDateString("th-TH", {
        day: "numeric", month: "short", year: "numeric"
    }) : "เมื่อเร็วๆ นี้";

    const wordCount = ep.content ? ep.content.trim().split(/\s+/).length : 0;

    card.innerHTML = `
        <div class="order-controls">
            <button class="btn-order btn-move-up" ${index === 0 ? "disabled" : ""} title="เลื่อนขึ้น">▲</button>
            <button class="btn-order btn-move-down" ${index === total - 1 ? "disabled" : ""} title="เลื่อนลง">▼</button>
        </div>

        <div class="episode-badge">ตอนที่ ${index + 1}</div>

        <div class="episode-details">
            <h4>${escapeHtml(ep.title)}</h4>
            <div class="preview-text">${escapeHtml(ep.content || "")}</div>
        </div>

        <div class="episode-meta">
            <span>📝 ${wordCount} คำ</span>
            <span>🕒 ${updatedAt}</span>
        </div>

        <div class="card-action-bar" style="border: none; margin: 0; padding: 0;">
            <button class="btn-card-action btn-edit">✏️ แก้ไข</button>
            <button class="btn-card-action delete btn-delete">🗑️ ลบ</button>
        </div>
    `;

    // Event: เลื่อนลำดับขึ้น
    const btnUp = card.querySelector(".btn-move-up");
    if (btnUp) {
        btnUp.addEventListener("click", () => swapOrder(index, index - 1));
    }

    // Event: เลื่อนลำดับลง
    const btnDown = card.querySelector(".btn-move-down");
    if (btnDown) {
        btnDown.addEventListener("click", () => swapOrder(index, index + 1));
    }

    // Event: แก้ไขตอน
    card.querySelector(".btn-edit").addEventListener("click", () => openModal(ep));

    // Event: ลบตอน
    card.querySelector(".btn-delete").addEventListener("click", async () => {
        if (confirm(`คุณต้องการลบตอน "${ep.title}" ใช่หรือไม่?`)) {
            try {
                const epDocRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "episodes", ep.id);
                await deleteDoc(epDocRef);
            } catch (err) {
                alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
            }
        }
    });

    return card;
}

// --- 6. สลับลำดับ (Reorder Swapping) ---
async function swapOrder(indexA, indexB) {
    if (!currentProjectId) return;
    if (indexA < 0 || indexB < 0 || indexA >= rawEpisodes.length || indexB >= rawEpisodes.length) return;

    const itemA = rawEpisodes[indexA];
    const itemB = rawEpisodes[indexB];

    try {
        const batch = writeBatch(db);
        const refA = doc(db, "users", currentUser.uid, "projects", currentProjectId, "episodes", itemA.id);
        const refB = doc(db, "users", currentUser.uid, "projects", currentProjectId, "episodes", itemB.id);

        batch.update(refA, { order: itemB.order ?? indexB });
        batch.update(refB, { order: itemA.order ?? indexA });

        await batch.commit();
    } catch (err) {
        console.error("Error swapping orders:", err);
        alert("ไม่สามารถปรับลำดับได้: " + err.message);
    }
}

// อัปเดตจำนวนบทกลับไปที่ Document หลักของ Project
async function updateChapterCountInProject(count) {
    if (!currentUser || !currentProjectId) return;
    try {
        const pRef = doc(db, "users", currentUser.uid, "projects", currentProjectId);
        await updateDoc(pRef, { chapterCount: count });
    } catch (err) {
        console.error("Error updating chapter count:", err);
    }
}

// --- 7. Modal Controller ---
function openModal(ep = null) {
    episodeForm.reset();

    if (ep) {
        modalTitle.textContent = "แก้ไขตอน";
        document.getElementById("episode-id").value = ep.id;
        document.getElementById("episode-order").value = ep.order ?? 0;
        document.getElementById("episode-title").value = ep.title || "";
        document.getElementById("episode-content").value = ep.content || "";
    } else {
        modalTitle.textContent = "เขียนตอนใหม่";
        document.getElementById("episode-id").value = "";
        document.getElementById("episode-order").value = rawEpisodes.length;
    }

    episodeModal.classList.add("active");
}

function closeModal() {
    episodeModal.classList.remove("active");
    episodeForm.reset();
}

btnOpenModal.addEventListener("click", () => {
    if (!currentProjectId) {
        alert("กรุณาเลือกโปรเจกต์ก่อนเพิ่มตอนใหม่");
        return;
    }
    openModal();
});

btnCloseModal.addEventListener("click", closeModal);
btnCancelModal.addEventListener("click", closeModal);

episodeModal.addEventListener("click", (e) => {
    if (e.target === episodeModal) closeModal();
});

// บันทึก Episode
episodeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser || !currentProjectId) return;

    const epId = document.getElementById("episode-id").value;
    const title = document.getElementById("episode-title").value.trim();
    const content = document.getElementById("episode-content").value.trim();
    const orderVal = parseInt(document.getElementById("episode-order").value, 10);

    try {
        if (epId) {
            const epRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "episodes", epId);
            await updateDoc(epRef, {
                title,
                content,
                updatedAt: serverTimestamp()
            });
        } else {
            const epColRef = collection(db, "users", currentUser.uid, "projects", currentProjectId, "episodes");
            await addDoc(epColRef, {
                title,
                content,
                order: orderVal,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        closeModal();
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    }
});

// Search
searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderEpisodes();
});

// Logout
if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
        e.preventDefault();
        signOut(auth).then(() => window.location.href = "login.html");
    });
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]) : '';
}