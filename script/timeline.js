import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const timelineContainer = document.getElementById("timeline-container");
const selectProject = document.getElementById("select-project");
const searchInput = document.getElementById("search-input");

// User Elements
const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// Modal Elements
const timelineModal = document.getElementById("timeline-modal");
const btnOpenTimelineModal = document.getElementById("btn-open-timeline-modal");
const btnCloseTimelineModal = document.getElementById("btn-close-timeline-modal");
const btnCancelTimelineModal = document.getElementById("btn-cancel-timeline-modal");
const timelineForm = document.getElementById("timeline-form");
const timelineModalTitle = document.getElementById("timeline-modal-title");

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

// Application State
let currentUser = null;
let currentProjectId = null;
let rawTimelineItems = [];
let searchQuery = "";
let unsubscribeTimelineListener = null;

// --- 1. Authentication State Observer ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if (userNameEl) userNameEl.textContent = user.displayName || user.email.split("@")[0];
        if (userAvatarEl) userAvatarEl.textContent = (user.displayName || user.email).charAt(0).toUpperCase();
        loadUserProjects();
    } else {
        window.location.href = "login.html";
    }
});

// --- 2. Load User Projects ---
async function loadUserProjects() {
    try {
        const projectsRef = collection(db, "users", currentUser.uid, "projects");
        const q = query(projectsRef, orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);

        selectProject.innerHTML = "";

        if (snapshot.empty) {
            selectProject.innerHTML = `<option value="">-- ไม่พบโปรเจกต์ --</option>`;
            timelineContainer.innerHTML = `<div class="empty-state">กรุณาสร้างโปรเจกต์ก่อนเริ่มสร้าง Timeline</div>`;
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get("projectId") || urlParams.get("id");

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const option = document.createElement("option");
            option.value = docSnap.id;
            option.textContent = data.title;
            selectProject.appendChild(option);
        });

        if (urlProjectId && selectProject.querySelector(`option[value="${urlProjectId}"]`)) {
            selectProject.value = urlProjectId;
        }

        currentProjectId = selectProject.value;
        listenToTimeline(currentProjectId);

    } catch (error) {
        console.error("Error loading projects:", error);
    }
}

selectProject.addEventListener("change", (e) => {
    currentProjectId = e.target.value;
    if (currentProjectId) listenToTimeline(currentProjectId);
});

// --- 3. Real-time Firestore Listener ---
function listenToTimeline(projectId) {
    if (unsubscribeTimelineListener) unsubscribeTimelineListener();

    timelineContainer.innerHTML = `<div class="loading-state">กำลังโหลดข้อมูล Timeline...</div>`;

    const timelineRef = collection(db, "users", currentUser.uid, "projects", projectId, "timeline");
    const q = query(timelineRef, orderBy("order", "asc"));

    unsubscribeTimelineListener = onSnapshot(q, (snapshot) => {
        rawTimelineItems = [];
        snapshot.forEach((docSnap) => {
            rawTimelineItems.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderTimeline();
    }, (error) => {
        console.error("Error fetching timeline items:", error);
        timelineContainer.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการโหลด Timeline</div>`;
    });
}

// --- 4. Render Timeline Items ---
function renderTimeline() {
    let filtered = rawTimelineItems;

    if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.arc && item.arc.toLowerCase().includes(q)) ||
            (item.desc && item.desc.toLowerCase().includes(q)) ||
            (item.characters && item.characters.toLowerCase().includes(q)) ||
            (item.inUniverseDate && item.inUniverseDate.toLowerCase().includes(q))
        );
    }

    filtered.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    if (filtered.length === 0) {
        timelineContainer.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลเหตุการณ์ใน Timeline นี้</div>`;
        return;
    }

    timelineContainer.innerHTML = "";
    filtered.forEach(item => {
        timelineContainer.appendChild(createTimelineCard(item));
    });
}

function createTimelineCard(item) {
    const node = document.createElement("div");
    node.className = "timeline-node";

    const arcText = item.arc ? escapeHtml(item.arc) : "ทั่วไป";

    node.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-header-meta">
            <div class="timeline-badges">
                <span class="order-badge">#${item.order || 1}</span>
                <span class="arc-badge arc-act1">🔖 ${arcText}</span>
            </div>
            ${item.inUniverseDate ? `<div class="timeline-time">📅 ${escapeHtml(item.inUniverseDate)}</div>` : ''}
        </div>
        <h3 class="timeline-title">${escapeHtml(item.title)}</h3>
        <p class="timeline-desc">${escapeHtml(item.desc)}</p>
        
        ${item.impact ? `
            <div class="timeline-impact-box">
                <strong>⚡ ผลกระทบ:</strong> ${escapeHtml(item.impact)}
            </div>
        ` : ''}

        <div class="timeline-footer">
            <div class="timeline-chars">
                👥 ตัวละคร: <span>${item.characters ? escapeHtml(item.characters) : 'ไม่ได้ระบุ'}</span>
            </div>
            <div class="char-actions" style="margin: 0;">
                <button class="btn-action btn-edit-tl">✏️ แก้ไข</button>
                <button class="btn-action delete btn-delete-tl">🗑️ ลบ</button>
            </div>
        </div>
    `;

    node.querySelector(".btn-edit-tl").addEventListener("click", () => openTimelineModal(item));
    node.querySelector(".btn-delete-tl").addEventListener("click", () => deleteTimelineItem(item.id, item.title));

    return node;
}

// --- 5. Modal Operations & CRUD ---
function openTimelineModal(data = null) {
    if (selectProject && selectProject.value) {
        currentProjectId = selectProject.value;
    }

    if (!currentProjectId) {
        alert("กรุณาเลือกโปรเจกต์ก่อนเริ่มบันทึก Timeline");
        return;
    }

    timelineForm.reset();
    if (data) {
        timelineModalTitle.textContent = "แก้ไขเหตุการณ์ใน Timeline";
        document.getElementById("timeline-id").value = data.id;
        document.getElementById("timeline-order").value = data.order || 1;
        document.getElementById("timeline-title").value = data.title || "";
        document.getElementById("timeline-arc").value = data.arc || "";
        document.getElementById("timeline-date").value = data.inUniverseDate || "";
        document.getElementById("timeline-characters").value = data.characters || "";
        document.getElementById("timeline-desc").value = data.desc || "";
        document.getElementById("timeline-impact").value = data.impact || "";
    } else {
        timelineModalTitle.textContent = "เพิ่มเหตุการณ์ใน Timeline ใหม่";
        document.getElementById("timeline-id").value = "";
        document.getElementById("timeline-order").value = rawTimelineItems.length + 1;
    }

    timelineModal.classList.add("active");
}

function closeTimelineModal() {
    timelineModal.classList.remove("active");
    timelineForm.reset();
}

btnOpenTimelineModal.addEventListener("click", () => openTimelineModal());
btnCloseTimelineModal.addEventListener("click", closeTimelineModal);
btnCancelTimelineModal.addEventListener("click", closeTimelineModal);

timelineModal.addEventListener("click", (e) => {
    if (e.target === timelineModal) closeTimelineModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && timelineModal.classList.contains("active")) {
        closeTimelineModal();
    }
});

// Form Submit Handler
timelineForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser || !currentProjectId) return;

    const id = document.getElementById("timeline-id").value;
    const order = Number(document.getElementById("timeline-order").value) || 1;
    const title = document.getElementById("timeline-title").value.trim();
    const arc = document.getElementById("timeline-arc").value.trim();
    const inUniverseDate = document.getElementById("timeline-date").value.trim();
    const characters = document.getElementById("timeline-characters").value.trim();
    const desc = document.getElementById("timeline-desc").value.trim();
    const impact = document.getElementById("timeline-impact").value.trim();

    try {
        const timelineColRef = collection(db, "users", currentUser.uid, "projects", currentProjectId, "timeline");

        if (id) {
            const docRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "timeline", id);
            await updateDoc(docRef, { 
                order, title, arc, inUniverseDate, characters, desc, impact, updatedAt: serverTimestamp() 
            });
        } else {
            await addDoc(timelineColRef, { 
                order, title, arc, inUniverseDate, characters, desc, impact, createdAt: serverTimestamp(), updatedAt: serverTimestamp() 
            });
        }
        closeTimelineModal();
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    }
});

async function deleteTimelineItem(id, title) {
    if (!confirm(`คุณต้องการลบเหตุการณ์ "${title}" ออกจาก Timeline ใช่หรือไม่?`)) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "timeline", id);
        await deleteDoc(docRef);
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
    }
}

// --- 6. Search Event Listener ---
searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderTimeline();
});

if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
        e.preventDefault();
        signOut(auth).then(() => window.location.href = "login.html");
    });
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]) : '';
}