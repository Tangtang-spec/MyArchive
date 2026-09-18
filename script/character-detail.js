import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Display Elements
const charNameEl = document.getElementById("char-name");
const charRoleBadge = document.getElementById("char-role-badge");
const charAvatar = document.getElementById("char-avatar-container");

const infoAge = document.getElementById("info-age");
const infoGender = document.getElementById("info-gender");
const infoRace = document.getElementById("info-race");
const infoOccupation = document.getElementById("info-occupation");
const infoFaction = document.getElementById("info-faction");

const charPersonality = document.getElementById("char-personality");
const charMotivation = document.getElementById("char-motivation");
const charFear = document.getElementById("char-fear");

const charBackstory = document.getElementById("char-backstory");
const charAbilities = document.getElementById("char-abilities");
const charRelationships = document.getElementById("char-relationships");

const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// Modal & Form Elements
const modalOverview = document.getElementById("modal-edit-overview");
const modalPsychology = document.getElementById("modal-edit-psychology");
const modalBackstory = document.getElementById("modal-edit-backstory");
const modalAbilities = document.getElementById("modal-edit-abilities");

const formOverview = document.getElementById("form-edit-overview");
const formPsychology = document.getElementById("form-edit-psychology");
const formBackstory = document.getElementById("form-edit-backstory");
const formAbilities = document.getElementById("form-edit-abilities");

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

// Global State
let currentUser = null;
let charId = null;
let projectId = null;
let charData = {};

// Auth Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const name = user.displayName || user.email.split("@")[0];
        if (userNameEl) userNameEl.textContent = name;
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
        
        loadCharacterDetail();
    } else {
        window.location.href = "login.html";
    }
});

// โหลดข้อมูลตัวละครจาก Firestore
async function loadCharacterDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    charId = urlParams.get("id");
    projectId = urlParams.get("projectId");

    if (!charId || !projectId) {
        window.location.href = "characters.html";
        return;
    }

    try {
        const charRef = doc(db, "users", currentUser.uid, "projects", projectId, "characters", charId);
        const charSnap = await getDoc(charRef);

        if (!charSnap.exists()) {
            alert("ไม่พบข้อมูลตัวละครนี้");
            window.location.href = "characters.html";
            return;
        }

        charData = charSnap.data();
        renderCharacterUI();

    } catch (error) {
        console.error("Error loading character details:", error);
    }
}

// แสดงผลข้อมูลลงใน HTML
function renderCharacterUI() {
    charNameEl.textContent = charData.name || "ไม่มีชื่อ";
    charAvatar.textContent = (charData.name || "?").charAt(0).toUpperCase();

    const role = charData.role || "Main";
    charRoleBadge.textContent = role === "Main" ? "ตัวละครเอก" : role === "Supporting" ? "ตัวละครสมทบ" : "ฝ่ายตรงข้าม";
    charRoleBadge.className = `char-role-badge badge-${role.toLowerCase()}`;

    infoAge.textContent = charData.age || "-";
    infoGender.textContent = charData.gender || "-";
    infoRace.textContent = charData.race || "-";
    infoOccupation.textContent = charData.occupation || "-";
    infoFaction.textContent = charData.faction || charData.affiliation || "-";

    charPersonality.textContent = charData.personality || "ไม่ได้ระบุ";
    charMotivation.textContent = charData.motivation || "ไม่ได้ระบุ";
    charFear.textContent = charData.fear || "ไม่ได้ระบุ";

    charBackstory.textContent = charData.backstory || charData.description || "ไม่มีข้อมูลประวัติความเป็นมา";
    charAbilities.textContent = charData.abilities || charData.ability || "ไม่มีข้อมูลทักษะพิเศษ";

    renderRelationships(charData.relationships, projectId);
}

// โหลดข้อมูลความสัมพันธ์
async function renderRelationships(relationships, projId) {
    if (!relationships || !Array.isArray(relationships) || relationships.length === 0) {
        charRelationships.innerHTML = `<p style="color: #657e85; font-size: 0.85rem;">ยังไม่มีการเชื่อมโยงความสัมพันธ์</p>`;
        return;
    }

    try {
        const charColRef = collection(db, "users", currentUser.uid, "projects", projId, "characters");
        const allCharsSnap = await getDocs(charColRef);
        const charMap = {};
        
        allCharsSnap.forEach(docSnap => {
            charMap[docSnap.id] = docSnap.data().name;
        });

        charRelationships.innerHTML = "";
        relationships.forEach(rel => {
            const targetName = charMap[rel.targetId] || rel.targetName || "ตัวละครที่ไม่ทราบชื่อ";
            const relItem = document.createElement("div");
            relItem.className = "rel-item";
            relItem.innerHTML = `
                <span class="rel-target">🔗 ${targetName}</span>
                <span class="rel-type">${rel.relationType || "มีความสัมพันธ์"}</span>
            `;
            charRelationships.appendChild(relItem);
        });
    } catch (err) {
        console.error("Error rendering relationships:", err);
    }
}

// Function อัปเดตข้อมูลลง Firestore
async function updateCharacterData(updatedFields, targetModal) {
    try {
        const charRef = doc(db, "users", currentUser.uid, "projects", projectId, "characters", charId);
        const payload = {
            ...updatedFields,
            updatedAt: serverTimestamp()
        };

        await updateDoc(charRef, payload);

        // อัปเดต charData ใน memory และ render ใหม่ทันที
        Object.assign(charData, updatedFields);
        renderCharacterUI();
        closeModal(targetModal);

    } catch (error) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + error.message);
    }
}

// Modal Toggle Helpers
function openModal(modalEl) { modalEl.classList.add("active"); }
function closeModal(modalEl) { modalEl.classList.remove("active"); }

// Event Listeners เปิด Modal ต่างๆ
document.getElementById("btn-open-edit-overview").addEventListener("click", () => {
    document.getElementById("input-edit-name").value = charData.name || "";
    document.getElementById("input-edit-role").value = charData.role || "Main";
    document.getElementById("input-edit-age").value = charData.age || "";
    document.getElementById("input-edit-gender").value = charData.gender || "";
    document.getElementById("input-edit-race").value = charData.race || "";
    document.getElementById("input-edit-occupation").value = charData.occupation || "";
    document.getElementById("input-edit-faction").value = charData.faction || charData.affiliation || "";
    openModal(modalOverview);
});

document.getElementById("btn-open-edit-psychology").addEventListener("click", () => {
    document.getElementById("input-edit-personality").value = charData.personality || "";
    document.getElementById("input-edit-motivation").value = charData.motivation || "";
    document.getElementById("input-edit-fear").value = charData.fear || "";
    openModal(modalPsychology);
});

document.getElementById("btn-open-edit-backstory").addEventListener("click", () => {
    document.getElementById("input-edit-backstory").value = charData.backstory || charData.description || "";
    openModal(modalBackstory);
});

document.getElementById("btn-open-edit-abilities").addEventListener("click", () => {
    document.getElementById("input-edit-abilities").value = charData.abilities || charData.ability || "";
    openModal(modalAbilities);
});

// Event Listeners บันทึกการแก้ไข (Form Submit)
formOverview.addEventListener("submit", (e) => {
    e.preventDefault();
    updateCharacterData({
        name: document.getElementById("input-edit-name").value.trim(),
        role: document.getElementById("input-edit-role").value,
        age: document.getElementById("input-edit-age").value.trim(),
        gender: document.getElementById("input-edit-gender").value.trim(),
        race: document.getElementById("input-edit-race").value.trim(),
        occupation: document.getElementById("input-edit-occupation").value.trim(),
        faction: document.getElementById("input-edit-faction").value.trim(),
        affiliation: document.getElementById("input-edit-faction").value.trim()
    }, modalOverview);
});

formPsychology.addEventListener("submit", (e) => {
    e.preventDefault();
    updateCharacterData({
        personality: document.getElementById("input-edit-personality").value.trim(),
        motivation: document.getElementById("input-edit-motivation").value.trim(),
        fear: document.getElementById("input-edit-fear").value.trim()
    }, modalPsychology);
});

formBackstory.addEventListener("submit", (e) => {
    e.preventDefault();
    updateCharacterData({
        backstory: document.getElementById("input-edit-backstory").value.trim(),
        description: document.getElementById("input-edit-backstory").value.trim()
    }, modalBackstory);
});

formAbilities.addEventListener("submit", (e) => {
    e.preventDefault();
    updateCharacterData({
        abilities: document.getElementById("input-edit-abilities").value.trim(),
        ability: document.getElementById("input-edit-abilities").value.trim()
    }, modalAbilities);
});

// Event handling สำหรับการปิด Modal
document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", () => {
        [modalOverview, modalPsychology, modalBackstory, modalAbilities].forEach(closeModal);
    });
});

[modalOverview, modalPsychology, modalBackstory, modalAbilities].forEach(modal => {
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal(modal);
    });
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        [modalOverview, modalPsychology, modalBackstory, modalAbilities].forEach(closeModal);
    }
});

// Logout
if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
        e.preventDefault();
        signOut(auth).then(() => window.location.href = "login.html");
    });
}