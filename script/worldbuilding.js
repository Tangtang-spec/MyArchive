import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const wbContainer = document.getElementById("wb-container");
const selectProject = document.getElementById("select-project");
const filterContainer = document.getElementById("filter-container");
const searchInput = document.getElementById("search-input");

// Profile & Auth
const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// Modal Elements
const wbModal = document.getElementById("wb-modal");
const btnOpenWbModal = document.getElementById("btn-open-wb-modal");
const btnCloseWbModal = document.getElementById("btn-close-wb-modal");
const btnCancelWbModal = document.getElementById("btn-cancel-wb-modal");
const wbForm = document.getElementById("wb-form");
const wbModalTitle = document.getElementById("wb-modal-title");

// App State
let currentUser = null;
let currentProjectId = null;
let rawWbItems = [];
let activeCategoryFilter = "all";
let searchQuery = "";
let unsubscribeWbListener = null;

// Auth Observer
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

// Load Projects
async function loadUserProjects() {
    try {
        const projectsRef = collection(db, "users", currentUser.uid, "projects");
        const q = query(projectsRef, orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);

        selectProject.innerHTML = "";

        if (snapshot.empty) {
            selectProject.innerHTML = `<option value="">-- ไม่พบโปรเจกต์ --</option>`;
            wbContainer.innerHTML = `<div class="empty-state">กรุณาสร้างโปรเจกต์ก่อนเริ่มบันทึกข้อมูล Worldbuilding</div>`;
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
        listenToWorldbuilding(currentProjectId);

    } catch (error) {
        console.error("Error loading projects:", error);
    }
}

selectProject.addEventListener("change", (e) => {
    currentProjectId = e.target.value;
    if (currentProjectId) listenToWorldbuilding(currentProjectId);
});

// Real-time Firestore Listener
function listenToWorldbuilding(projectId) {
    if (unsubscribeWbListener) unsubscribeWbListener();

    wbContainer.innerHTML = `<div class="loading-state">กำลังโหลดข้อมูล Worldbuilding...</div>`;

    const wbRef = collection(db, "users", currentUser.uid, "projects", projectId, "worldbuilding");
    const q = query(wbRef, orderBy("createdAt", "desc"));

    unsubscribeWbListener = onSnapshot(q, (snapshot) => {
        rawWbItems = [];
        snapshot.forEach((docSnap) => {
            rawWbItems.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderWbItems();
    }, (error) => {
        console.error("Error fetching worldbuilding:", error);
        wbContainer.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`;
    });
}

// Render & Filter Items
function renderWbItems() {
    let filtered = rawWbItems;

    if (activeCategoryFilter !== "all") {
        filtered = filtered.filter(item => item.category === activeCategoryFilter);
    }

    if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.desc && item.desc.toLowerCase().includes(q)) ||
            (item.tags && item.tags.toLowerCase().includes(q)) ||
            (item.content && item.content.toLowerCase().includes(q))
        );
    }

    const counts = {
        all: rawWbItems.length,
        location: rawWbItems.filter(i => i.category === "location").length,
        power: rawWbItems.filter(i => i.category === "power").length,
        race: rawWbItems.filter(i => i.category === "race").length,
        culture: rawWbItems.filter(i => i.category === "culture").length,
        tech: rawWbItems.filter(i => i.category === "tech").length,
        history: rawWbItems.filter(i => i.category === "history").length
    };

    filterContainer.querySelectorAll(".tab-btn").forEach(btn => {
        const cat = btn.getAttribute("data-category");
        const labels = {
            all: `ทั้งหมด (${counts.all})`,
            location: `🏰 สถานที่/เมือง (${counts.location})`,
            power: `✨ ระบบพลังวิเศษ (${counts.power})`,
            race: `🧝 เผ่าพันธุ์/สิ่งมีชีวิต (${counts.race})`,
            culture: `📜 วัฒนธรรม/ศาสนา (${counts.culture})`,
            tech: `⚙️ เทคโนโลยี/ระบบเงิน (${counts.tech})`,
            history: `🏛️ ประวัติศาสตร์ (${counts.history})`
        };
        if (labels[cat]) btn.textContent = labels[cat];
    });

    if (filtered.length === 0) {
        wbContainer.innerHTML = `<div class="empty-state">ไม่พบข้อมูล Worldbuilding</div>`;
        return;
    }

    wbContainer.innerHTML = "";
    filtered.forEach(item => {
        wbContainer.appendChild(createWbCard(item));
    });
}

function createWbCard(item) {
    const card = document.createElement("div");
    card.className = "character-card";

    const catMap = {
        location: { label: "🏰 สถานที่ / เมือง", class: "main" },
        power: { label: "✨ ระบบพลังวิเศษ", class: "supporting" },
        race: { label: "🧝 เผ่าพันธุ์ / สิ่งมีชีวิต", class: "main" },
        culture: { label: "📜 วัฒนธรรม / ศาสนา", class: "supporting" },
        tech: { label: "⚙️ เทคโนโลยี / ระบบเงิน", class: "antagonist" },
        history: { label: "🏛️ ประวัติศาสตร์", class: "antagonist" }
    };

    const catInfo = catMap[item.category] || { label: item.category, class: "main" };

    card.innerHTML = `
        <div class="char-header">
            <div class="char-title-meta">
                <span class="char-role-badge ${catInfo.class}">${catInfo.label}</span>
                <h4 class="char-name" style="margin-top:6px;">${escapeHtml(item.title)}</h4>
            </div>
        </div>
        <div class="char-body">
            <p class="char-desc">${escapeHtml(item.desc)}</p>
            ${item.tags ? `<div class="detail-badge">แท็ก: <span>${escapeHtml(item.tags)}</span></div>` : ''}
            ${item.content ? `<p style="font-size:0.8rem; color:#657e85; margin-top:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(item.content)}</p>` : ''}
        </div>
        <div class="char-actions">
            <button class="btn-action btn-edit-wb">✏️ แก้ไข</button>
            <button class="btn-action delete btn-delete-wb">🗑️ ลบ</button>
        </div>
    `;

    card.querySelector(".btn-edit-wb").addEventListener("click", () => openWbModal(item));
    card.querySelector(".btn-delete-wb").addEventListener("click", () => deleteWbItem(item.id, item.title));

    return card;
}

// Modal Controllers
function openWbModal(data = null) {
    if (selectProject && selectProject.value) {
        currentProjectId = selectProject.value;
    }

    if (!currentProjectId) {
        alert("กรุณาเลือกโปรเจกต์ก่อนเริ่มบันทึกข้อมูล Worldbuilding");
        return;
    }

    wbForm.reset();
    if (data) {
        wbModalTitle.textContent = "แก้ไขข้อมูล Worldbuilding";
        document.getElementById("wb-id").value = data.id;
        document.getElementById("wb-title").value = data.title || "";
        document.getElementById("wb-category").value = data.category || "location";
        document.getElementById("wb-tags").value = data.tags || "";
        document.getElementById("wb-desc").value = data.desc || "";
        document.getElementById("wb-content").value = data.content || "";
    } else {
        wbModalTitle.textContent = "เพิ่มข้อมูล Worldbuilding ใหม่";
        document.getElementById("wb-id").value = "";
    }

    wbModal.classList.add("active");
}

function closeWbModal() {
    wbModal.classList.remove("active");
    wbForm.reset();
}

// Modal Event Listeners
btnOpenWbModal.addEventListener("click", () => openWbModal());
btnCloseWbModal.addEventListener("click", closeWbModal);
btnCancelWbModal.addEventListener("click", closeWbModal);

wbModal.addEventListener("click", (e) => {
    if (e.target === wbModal) closeWbModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && wbModal.classList.contains("active")) {
        closeWbModal();
    }
});

// Form Submit Handler
wbForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser || !currentProjectId) return;

    const id = document.getElementById("wb-id").value;
    const title = document.getElementById("wb-title").value.trim();
    const category = document.getElementById("wb-category").value;
    const tags = document.getElementById("wb-tags").value.trim();
    const desc = document.getElementById("wb-desc").value.trim();
    const content = document.getElementById("wb-content").value.trim();

    try {
        const wbColRef = collection(db, "users", currentUser.uid, "projects", currentProjectId, "worldbuilding");

        if (id) {
            const docRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "worldbuilding", id);
            await updateDoc(docRef, { title, category, tags, desc, content, updatedAt: serverTimestamp() });
        } else {
            await addDoc(wbColRef, { title, category, tags, desc, content, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
        closeWbModal();
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    }
});

async function deleteWbItem(id, title) {
    if (!confirm(`คุณต้องการลบข้อมูล "${title}" ใช่หรือไม่?`)) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "worldbuilding", id);
        await deleteDoc(docRef);
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
    }
}

// Search and Filters
filterContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;

    filterContainer.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCategoryFilter = btn.getAttribute("data-category");
    renderWbItems();
});

searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderWbItems();
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
