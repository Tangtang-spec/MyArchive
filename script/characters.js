import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    collection, 
    doc,
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    onSnapshot,
    getDocs,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const characterContainer = document.getElementById("character-container");
const selectProject = document.getElementById("select-project");
const filterContainer = document.getElementById("filter-container");
const searchInput = document.getElementById("search-input");

// User Elements
const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// Character Modal Elements
const charModal = document.getElementById("char-modal");
const btnOpenCharModal = document.getElementById("btn-open-char-modal");
const btnCloseCharModal = document.getElementById("btn-close-char-modal");
const btnCancelCharModal = document.getElementById("btn-cancel-char-modal");
const charForm = document.getElementById("char-form");
const charModalTitle = document.getElementById("char-modal-title");

// Relationship Modal Elements
const relModal = document.getElementById("rel-modal");
const btnCloseRelModal = document.getElementById("btn-close-rel-modal");
const btnCancelRelModal = document.getElementById("btn-cancel-rel-modal");
const relForm = document.getElementById("rel-form");
const relTargetSelect = document.getElementById("rel-target-id");

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

// App State
let currentUser = null;
let currentProjectId = null;
let rawCharacters = [];
let activeRoleFilter = "all";
let searchQuery = "";
let unsubscribeCharListener = null;

// --- 1. ตรวจสอบ Authentication State ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        updateUserProfile(user);
        loadUserProjects();
    } else {
        window.location.href = "login.html";
    }
});

function updateUserProfile(user) {
    const name = user.displayName || user.email.split("@")[0];
    userNameEl.textContent = name;
    userAvatarEl.textContent = name.charAt(0).toUpperCase();
}

// --- 2. โหลดรายชื่อ Projects ทั้งหมดของผู้ใช้ลงใน Dropdown ---
async function loadUserProjects() {
    try {
        const projectsRef = collection(db, "users", currentUser.uid, "projects");
        const q = query(projectsRef, orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);

        selectProject.innerHTML = "";

        if (snapshot.empty) {
            selectProject.innerHTML = `<option value="">-- ไม่พบโปรเจกต์ --</option>`;
            characterContainer.innerHTML = `<div class="empty-state">กรุณาสร้างโปรเจกต์ก่อนเริ่มเพิ่มตัวละคร</div>`;
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
        listenToCharacters(currentProjectId);

    } catch (error) {
        console.error("Error loading projects:", error);
    }
}

// เปลี่ยนโปรเจกต์เมื่อเลือก Dropdown
selectProject.addEventListener("change", (e) => {
    currentProjectId = e.target.value;
    if (currentProjectId) {
        listenToCharacters(currentProjectId);
    }
});

// --- 3. Listener Real-time สำหรับดึงตัวละครในโปรเจกต์ที่เลือก ---
function listenToCharacters(projectId) {
    if (unsubscribeCharListener) unsubscribeCharListener();

    characterContainer.innerHTML = `<div class="loading-state">กำลังโหลดข้อมูลตัวละคร...</div>`;

    const charRef = collection(db, "users", currentUser.uid, "projects", projectId, "characters");
    const q = query(charRef, orderBy("createdAt", "desc"));

    unsubscribeCharListener = onSnapshot(q, (snapshot) => {
        rawCharacters = [];
        snapshot.forEach((docSnap) => {
            rawCharacters.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderCharacters();
    }, (error) => {
        console.error("Error fetching characters:", error);
        characterContainer.innerHTML = `<div class="empty-state">เกิดข้อผิดพลาดในการโหลดตัวละคร</div>`;
    });
}

// --- 4. Render และ กรองข้อมูลตัวละคร ---
function renderCharacters() {
    let filtered = rawCharacters;

    if (activeRoleFilter !== "all") {
        filtered = filtered.filter(c => c.role === activeRoleFilter);
    }

    if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c => 
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.race && c.race.toLowerCase().includes(q)) ||
            (c.ability && c.ability.toLowerCase().includes(q)) ||
            (c.affiliation && c.affiliation.toLowerCase().includes(q))
        );
    }

    const countAll = rawCharacters.length;
    const countMain = rawCharacters.filter(c => c.role === "Main").length;
    const countSupp = rawCharacters.filter(c => c.role === "Supporting").length;
    const countAntag = rawCharacters.filter(c => c.role === "Antagonist").length;

    const btnAll = filterContainer.querySelector('[data-role="all"]');
    const btnMain = filterContainer.querySelector('[data-role="Main"]');
    const btnSupp = filterContainer.querySelector('[data-role="Supporting"]');
    const btnAntag = filterContainer.querySelector('[data-role="Antagonist"]');

    if (btnAll) btnAll.textContent = `ตัวละครทั้งหมด (${countAll})`;
    if (btnMain) btnMain.textContent = `ตัวละครเอก (${countMain})`;
    if (btnSupp) btnSupp.textContent = `ตัวละครสมทบ (${countSupp})`;
    if (btnAntag) btnAntag.textContent = `ฝ่ายตรงข้าม (${countAntag})`;

    if (filtered.length === 0) {
        characterContainer.innerHTML = `<div class="empty-state">ไม่พบข้อมูลตัวละคร</div>`;
        return;
    }

    characterContainer.innerHTML = "";
    filtered.forEach(data => {
        const card = createCharacterCard(data);
        characterContainer.appendChild(card);
    });
}

function createCharacterCard(data) {
    const card = document.createElement("div");
    card.className = "character-card";
    card.style.cursor = "pointer"; // แสดง Cursor เป็นรูปมือเมื่อชี้ที่การ์ด

    const roleClass = data.role ? data.role.toLowerCase() : "main";
    const roleTextMap = {
        "Main": "ตัวละครเอก (Main)",
        "Supporting": "ตัวละครสมทบ (Supporting)",
        "Antagonist": "ฝ่ายตรงข้าม (Antagonist)"
    };
    const roleLabel = roleTextMap[data.role] || data.role || "ตัวละคร";

    const initial = data.name ? data.name.charAt(0).toUpperCase() : "?";

    let relsHTML = "";
    if (data.relationships && data.relationships.length > 0) {
        const tags = data.relationships.map((rel, index) => `
            <span class="rel-tag">
                🔗 ${escapeHtml(rel.targetName)} (${escapeHtml(rel.relationType)})
                <span class="remove-rel" data-char-id="${data.id}" data-rel-index="${index}">&times;</span>
            </span>
        `).join("");

        relsHTML = `
            <div class="char-relationships-box">
                <label>ความสัมพันธ์:</label>
                <div class="rel-tags-container">${tags}</div>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="char-header">
            <div class="char-avatar-container">
                <div class="char-avatar">${initial}</div>
                <div class="char-title-meta">
                    <h4 class="char-name">${escapeHtml(data.name)}</h4>
                    <span class="char-role-badge ${roleClass}">${roleLabel}</span>
                </div>
            </div>
        </div>
        <div class="char-body">
            <p class="char-desc">${escapeHtml(data.description || "ไม่มีประวัติย่อ")}</p>
            <div class="char-details">
                <div class="detail-badge">เผ่าพันธุ์: <span>${escapeHtml(data.race || "-")}</span></div>
                <div class="detail-badge">สังกัด: <span>${escapeHtml(data.affiliation || "-")}</span></div>
                <div class="detail-badge">ความสามารถ: <span>${escapeHtml(data.ability || "-")}</span></div>
            </div>
            ${relsHTML}
        </div>
        <div class="char-actions">
            <button class="btn-action btn-edit-char" data-id="${data.id}">✏️ แก้ไข</button>
            <button class="btn-action btn-rel-char" data-id="${data.id}" data-name="${escapeHtml(data.name)}">🔗 ความสัมพันธ์</button>
            <button class="btn-action delete btn-delete-char" data-id="${data.id}" data-name="${escapeHtml(data.name)}">🗑️ ลบ</button>
        </div>
    `;

    // Event 1: คลิกที่การ์ดเพื่อไปยังหน้า character-detail
    card.addEventListener("click", (e) => {
        // หากคลิกที่ปุ่มจัดการ หรือปุ่มลบความสัมพันธ์ จะไม่เปลี่ยนหน้า
        if (e.target.closest(".btn-action") || e.target.closest(".remove-rel")) {
            return;
        }
        window.location.href = `character-detail.html?id=${data.id}&projectId=${currentProjectId}`;
    });

    // Event 2: ปุ่มแก้ไข
    card.querySelector(".btn-edit-char").addEventListener("click", (e) => {
        e.stopPropagation();
        openCharModal(data);
    });

    // Event 3: ปุ่มจัดการความสัมพันธ์
    card.querySelector(".btn-rel-char").addEventListener("click", (e) => {
        e.stopPropagation();
        openRelModal(data);
    });

    // Event 4: ปุ่มลบ
    card.querySelector(".btn-delete-char").addEventListener("click", (e) => {
        e.stopPropagation();
        deleteCharacter(data.id, data.name);
    });

    // Event 5: ปุ่มลบความสัมพันธ์ย่อย
    card.querySelectorAll(".remove-rel").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const charId = btn.getAttribute("data-char-id");
            const relIndex = parseInt(btn.getAttribute("data-rel-index"));
            removeRelationship(charId, relIndex);
        });
    });

    return card;
}

// --- 5. จัดการ CRUD ของ Character ---

function openCharModal(data = null) {
    if (selectProject && selectProject.value) {
        currentProjectId = selectProject.value;
    }

    if (!currentProjectId) {
        alert("กรุณาเลือกหรือสร้างโปรเจกต์ก่อนเริ่มเพิ่มตัวละคร");
        return;
    }

    charForm.reset();
    if (data) {
        charModalTitle.textContent = "แก้ไขข้อมูลตัวละคร";
        document.getElementById("char-id").value = data.id;
        document.getElementById("char-name").value = data.name || "";
        document.getElementById("char-role").value = data.role || "Main";
        document.getElementById("char-race").value = data.race || "";
        document.getElementById("char-affiliation").value = data.affiliation || "";
        document.getElementById("char-ability").value = data.ability || "";
        document.getElementById("char-desc").value = data.description || "";
    } else {
        charModalTitle.textContent = "เพิ่มตัวละครใหม่";
        document.getElementById("char-id").value = "";
    }
    
    charModal.classList.add("active");
}

function closeCharModal() {
    charModal.classList.remove("active");
    charForm.reset();
}

btnOpenCharModal.addEventListener("click", () => openCharModal());
btnCloseCharModal.addEventListener("click", closeCharModal);
btnCancelCharModal.addEventListener("click", closeCharModal);

charForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser || !currentProjectId) return;

    const charId = document.getElementById("char-id").value;
    const name = document.getElementById("char-name").value.trim();
    const role = document.getElementById("char-role").value;
    const race = document.getElementById("char-race").value.trim();
    const affiliation = document.getElementById("char-affiliation").value.trim();
    const ability = document.getElementById("char-ability").value.trim();
    const description = document.getElementById("char-desc").value.trim();

    try {
        const charCollectionRef = collection(db, "users", currentUser.uid, "projects", currentProjectId, "characters");

        if (charId) {
            const charDocRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "characters", charId);
            await updateDoc(charDocRef, {
                name, role, race, affiliation, ability, description,
                updatedAt: serverTimestamp()
            });
        } else {
            await addDoc(charCollectionRef, {
                name, role, race, affiliation, ability, description,
                relationships: [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            const projectDocRef = doc(db, "users", currentUser.uid, "projects", currentProjectId);
            await updateDoc(projectDocRef, {
                characterCount: increment(1),
                updatedAt: serverTimestamp()
            });
        }

        closeCharModal();
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการบันทึกตัวละคร: " + error.message);
    }
});

async function deleteCharacter(charId, charName) {
    if (!confirm(`คุณต้องการลบตัวละคร "${charName}" ใช่หรือไม่?`)) return;

    try {
        const charDocRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "characters", charId);
        await deleteDoc(charDocRef);

        const otherCharsWithRel = rawCharacters.filter(c => 
            c.id !== charId && c.relationships && c.relationships.some(r => r.targetId === charId)
        );

        for (const otherChar of otherCharsWithRel) {
            const cleanedRels = otherChar.relationships.filter(r => r.targetId !== charId);
            const otherDocRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "characters", otherChar.id);
            await updateDoc(otherDocRef, { relationships: cleanedRels });
        }

        const projectDocRef = doc(db, "users", currentUser.uid, "projects", currentProjectId);
        await updateDoc(projectDocRef, {
            characterCount: increment(-1),
            updatedAt: serverTimestamp()
        });

    } catch (error) {
        alert("เกิดข้อผิดพลาดในการลบตัวละคร: " + error.message);
    }
}

// --- 6. จัดการความสัมพันธ์ (Relationships) ---

function openRelModal(sourceChar) {
    relForm.reset();
    document.getElementById("rel-source-id").value = sourceChar.id;
    document.getElementById("rel-source-name").value = sourceChar.name;

    relTargetSelect.innerHTML = `<option value="">-- เลือกตัวละครเป้าหมาย --</option>`;
    const otherChars = rawCharacters.filter(c => c.id !== sourceChar.id);

    if (otherChars.length === 0) {
        alert("คุณต้องมีตัวละครอย่างน้อย 2 ตัวในโปรเจกต์จึงจะสร้างความสัมพันธ์ได้");
        return;
    }

    otherChars.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.role})`;
        relTargetSelect.appendChild(opt);
    });

    relModal.classList.add("active");
}

function closeRelModal() {
    relModal.classList.remove("active");
    relForm.reset();
}

btnCloseRelModal.addEventListener("click", closeRelModal);
btnCancelRelModal.addEventListener("click", closeRelModal);

relForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sourceId = document.getElementById("rel-source-id").value;
    const targetId = relTargetSelect.value;
    const relType = document.getElementById("rel-type").value.trim();

    if (!targetId || !relType) return;

    const targetChar = rawCharacters.find(c => c.id === targetId);
    if (!targetChar) return;

    try {
        const sourceChar = rawCharacters.find(c => c.id === sourceId);
        const currentRels = sourceChar.relationships || [];

        const updatedRels = [...currentRels, {
            targetId: targetChar.id,
            targetName: targetChar.name,
            relationType: relType
        }];

        const charDocRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "characters", sourceId);
        await updateDoc(charDocRef, {
            relationships: updatedRels,
            updatedAt: serverTimestamp()
        });

        closeRelModal();
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการเพิ่มความสัมพันธ์: " + error.message);
    }
});

async function removeRelationship(charId, indexToRemove) {
    try {
        const char = rawCharacters.find(c => c.id === charId);
        if (!char || !char.relationships) return;

        const updatedRels = char.relationships.filter((_, idx) => idx !== indexToRemove);

        const charDocRef = doc(db, "users", currentUser.uid, "projects", currentProjectId, "characters", charId);
        await updateDoc(charDocRef, {
            relationships: updatedRels,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        alert("เกิดข้อผิดพลาดในการลบความสัมพันธ์: " + error.message);
    }
}

// --- 7. Event Listeners เพิ่มเติม ---

filterContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-filter");
    if (!btn) return;

    filterContainer.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    activeRoleFilter = btn.getAttribute("data-role");
    renderCharacters();
});

searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderCharacters();
});

[charModal, relModal].forEach(modal => {
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeCharModal();
            closeRelModal();
        }
    });
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeCharModal();
        closeRelModal();
    }
});

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