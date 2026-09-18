import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const wbTitle = document.getElementById("wb-title");
const wbCategoryBadge = document.getElementById("wb-category-badge");
const wbTags = document.getElementById("wb-tags");
const wbDesc = document.getElementById("wb-desc");
const wbContent = document.getElementById("wb-content");
const wbIconContainer = document.getElementById("wb-icon-container");

const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// Modals
const modalOverview = document.getElementById("modal-overview");
const modalCategory = document.getElementById("modal-category");
const modalContent = document.getElementById("modal-content");

const formOverview = document.getElementById("form-overview");
const formCategory = document.getElementById("form-category");
const formContent = document.getElementById("form-content");

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

// State
let currentUser = null;
let wbId = null;
let projectId = null;
let wbData = {};

const catMap = {
    location: { label: "🏰 สถานที่ / เมือง", icon: "🏰", class: "badge-main" },
    power: { label: "✨ ระบบพลังวิเศษ", icon: "✨", class: "badge-supporting" },
    race: { label: "🧝 เผ่าพันธุ์ / สิ่งมีชีวิต", icon: "🧝", class: "badge-main" },
    faction: { label: "🛡️ กลุ่ม / องค์กร / หน่วยงาน", icon: "🛡️", class: "badge-supporting" },
    culture: { label: "📜 วัฒนธรรม / ศาสนา", icon: "📜", class: "badge-supporting" },
    tech: { label: "⚙️ เทคโนโลยี / ระบบเงิน", icon: "⚙️", class: "badge-antagonist" },
    history: { label: "🏛️ ประวัติศาสตร์", icon: "🏛️", class: "badge-antagonist" }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if (userNameEl) userNameEl.textContent = user.displayName || user.email.split("@")[0];
        if (userAvatarEl) userAvatarEl.textContent = (user.displayName || user.email).charAt(0).toUpperCase();
        loadWbDetail();
    } else {
        window.location.href = "login.html";
    }
});

async function loadWbDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    wbId = urlParams.get("id");
    projectId = urlParams.get("projectId");

    if (!wbId || !projectId) {
        window.location.href = "worldbuilding.html";
        return;
    }

    try {
        const docRef = doc(db, "users", currentUser.uid, "projects", projectId, "worldbuilding", wbId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("ไม่พบข้อมูล Worldbuilding นี้");
            window.location.href = "worldbuilding.html";
            return;
        }

        wbData = docSnap.data();
        renderUI();
    } catch (error) {
        console.error("Error loading WB details:", error);
    }
}

function renderUI() {
    wbTitle.textContent = wbData.title || "ไม่มีชื่อ";
    wbTags.textContent = wbData.tags || "-";
    wbDesc.textContent = wbData.desc || "ไม่มีคำอธิบายย่อ";
    wbContent.textContent = wbData.content || "ไม่มีรายละเอียดเพิ่มเติม";

    const cat = wbData.category || "location";
    const info = catMap[cat] || { label: cat, icon: "🌍", class: "badge-main" };
    
    wbCategoryBadge.textContent = info.label;
    wbCategoryBadge.className = `char-role-badge ${info.class}`;
    wbIconContainer.textContent = info.icon;

    // ซ่อน Section ทั้งหมดก่อน แล้วแสดงเฉพาะ Section ที่ตรงกับหมวดหมู่
    document.querySelectorAll(".category-section").forEach(sec => sec.style.display = "none");

    if (cat === "location") {
        document.getElementById("section-location").style.display = "block";
        document.getElementById("wb-environment").textContent = wbData.environment || "ไม่มีข้อมูลสภาพแวดล้อม";
    } else if (cat === "power") {
        document.getElementById("section-power").style.display = "block";
        document.getElementById("wb-power-properties").textContent = wbData.powerProperties || "ไม่ได้ระบุ";
        document.getElementById("wb-power-source").textContent = wbData.powerSource || "ไม่ได้ระบุ";
        document.getElementById("wb-power-techniques").textContent = wbData.powerTechniques || "ไม่มีข้อมูลวิชาการใช้งาน";
    } else if (cat === "race") {
        document.getElementById("section-race").style.display = "block";
        document.getElementById("wb-race-physical").textContent = wbData.racePhysical || "ไม่ได้ระบุ";
        document.getElementById("wb-race-abilities").textContent = wbData.raceAbilities || "ไม่ได้ระบุ";
        document.getElementById("wb-race-subraces").textContent = wbData.raceSubraces || "ไม่มีข้อมูลเผ่าพันธุ์ย่อย";
    } else if (cat === "faction") {
        document.getElementById("section-faction").style.display = "block";
        document.getElementById("wb-faction-network").textContent = wbData.factionNetwork || "ไม่มีข้อมูลเครือข่ายองค์กร";
    } else if (cat === "culture") {
        document.getElementById("section-culture").style.display = "block";
        document.getElementById("wb-culture-beliefs").textContent = wbData.cultureBeliefs || "ไม่มีข้อมูลตำนานและความเชื่อ";
    } else if (cat === "tech") {
        document.getElementById("section-tech").style.display = "block";
        document.getElementById("wb-tech-usage").textContent = wbData.techUsage || "ไม่ได้ระบุ";
        document.getElementById("wb-tech-development").textContent = wbData.techDevelopment || "ไม่ได้ระบุ";
    } else if (cat === "history") {
        document.getElementById("section-history").style.display = "block";
        document.getElementById("wb-history-details").textContent = wbData.historyDetails || "ไม่มีข้อมูลประวัติศาสตร์";
        document.getElementById("btn-link-timeline").href = `timeline.html?projectId=${projectId}`;
    }
}

// Update Helper
async function updateWbData(fields, targetModal) {
    try {
        const docRef = doc(db, "users", currentUser.uid, "projects", projectId, "worldbuilding", wbId);
        await updateDoc(docRef, { ...fields, updatedAt: serverTimestamp() });
        Object.assign(wbData, fields);
        renderUI();
        closeModal(targetModal);
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    }
}

function openModal(el) { el.classList.add("active"); }
function closeModal(el) { el.classList.remove("active"); }

// Edit Overview Event
document.getElementById("btn-edit-overview").addEventListener("click", () => {
    document.getElementById("input-title").value = wbData.title || "";
    document.getElementById("input-tags").value = wbData.tags || "";
    document.getElementById("input-desc").value = wbData.desc || "";
    openModal(modalOverview);
});

formOverview.addEventListener("submit", (e) => {
    e.preventDefault();
    updateWbData({
        title: document.getElementById("input-title").value.trim(),
        tags: document.getElementById("input-tags").value.trim(),
        desc: document.getElementById("input-desc").value.trim()
    }, modalOverview);
});

// Dynamic Category Edit Events
const catEditBtns = ["btn-edit-location", "btn-edit-power", "btn-edit-race", "btn-edit-faction", "btn-edit-culture", "btn-edit-tech", "btn-edit-history"];
catEditBtns.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.addEventListener("click", () => {
            const cat = wbData.category || "location";
            const container = document.getElementById("modal-category-fields");
            container.innerHTML = "";

            if (cat === "location") {
                container.innerHTML = `
                    <div class="form-group">
                        <label>สภาพแวดล้อมและภูมิประเทศ</label>
                        <textarea id="field-environment" rows="5">${wbData.environment || ""}</textarea>
                    </div>`;
            } else if (cat === "power") {
                container.innerHTML = `
                    <div class="form-group"><label>คุณสมบัติ / ประเภทพลัง</label><input type="text" id="field-powerProperties" value="${wbData.powerProperties || ""}"></div>
                    <div class="form-group"><label>แหล่งที่มาของพลัง</label><input type="text" id="field-powerSource" value="${wbData.powerSource || ""}"></div>
                    <div class="form-group"><label>การใช้งาน / วิชา</label><textarea id="field-powerTechniques" rows="4">${wbData.powerTechniques || ""}</textarea></div>`;
            } else if (cat === "race") {
                container.innerHTML = `
                    <div class="form-group"><label>ลักษณะทางกายภาพ</label><input type="text" id="field-racePhysical" value="${wbData.racePhysical || ""}"></div>
                    <div class="form-group"><label>ความสามารถพิเศษประจำเผ่า</label><input type="text" id="field-raceAbilities" value="${wbData.raceAbilities || ""}"></div>
                    <div class="form-group"><label>เผ่าพันธุ์ย่อย / สายเลือด</label><textarea id="field-raceSubraces" rows="4">${wbData.raceSubraces || ""}</textarea></div>`;
            } else if (cat === "faction") {
                container.innerHTML = `
                    <div class="form-group"><label>เครือข่ายและโครงสร้างองค์กร</label><textarea id="field-factionNetwork" rows="5">${wbData.factionNetwork || ""}</textarea></div>`;
            } else if (cat === "culture") {
                container.innerHTML = `
                    <div class="form-group"><label>ตำนาน ความเชื่อ และพิธีกรรม</label><textarea id="field-cultureBeliefs" rows="5">${wbData.cultureBeliefs || ""}</textarea></div>`;
            } else if (cat === "tech") {
                container.innerHTML = `
                    <div class="form-group"><label>การใช้งาน / กลไก</label><textarea id="field-techUsage" rows="3">${wbData.techUsage || ""}</textarea></div>
                    <div class="form-group"><label>ประวัติการพัฒนา</label><textarea id="field-techDevelopment" rows="3">${wbData.techDevelopment || ""}</textarea></div>`;
            } else if (cat === "history") {
                container.innerHTML = `
                    <div class="form-group"><label>ประวัติศาสตร์และเหตุการณ์สำคัญ</label><textarea id="field-historyDetails" rows="5">${wbData.historyDetails || ""}</textarea></div>`;
            }

            openModal(modalCategory);
        });
    }
});

formCategory.addEventListener("submit", (e) => {
    e.preventDefault();
    const cat = wbData.category || "location";
    let payload = {};

    if (cat === "location") {
        payload.environment = document.getElementById("field-environment").value.trim();
    } else if (cat === "power") {
        payload.powerProperties = document.getElementById("field-powerProperties").value.trim();
        payload.powerSource = document.getElementById("field-powerSource").value.trim();
        payload.powerTechniques = document.getElementById("field-powerTechniques").value.trim();
    } else if (cat === "race") {
        payload.racePhysical = document.getElementById("field-racePhysical").value.trim();
        payload.raceAbilities = document.getElementById("field-raceAbilities").value.trim();
        payload.raceSubraces = document.getElementById("field-raceSubraces").value.trim();
    } else if (cat === "faction") {
        payload.factionNetwork = document.getElementById("field-factionNetwork").value.trim();
    } else if (cat === "culture") {
        payload.cultureBeliefs = document.getElementById("field-cultureBeliefs").value.trim();
    } else if (cat === "tech") {
        payload.techUsage = document.getElementById("field-techUsage").value.trim();
        payload.techDevelopment = document.getElementById("field-techDevelopment").value.trim();
    } else if (cat === "history") {
        payload.historyDetails = document.getElementById("field-historyDetails").value.trim();
    }

    updateWbData(payload, modalCategory);
});

// Edit Common Content Event
document.getElementById("btn-edit-content").addEventListener("click", () => {
    document.getElementById("input-content").value = wbData.content || "";
    openModal(modalContent);
});

formContent.addEventListener("submit", (e) => {
    e.preventDefault();
    updateWbData({
        content: document.getElementById("input-content").value.trim()
    }, modalContent);
});

// Modal Close Handlers
document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", () => {
        [modalOverview, modalCategory, modalContent].forEach(closeModal);
    });
});

[modalOverview, modalCategory, modalContent].forEach(m => {
    m.addEventListener("click", (e) => {
        if (e.target === m) closeModal(m);
    });
});

// Logout
if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
        e.preventDefault();
        signOut(auth).then(() => window.location.href = "login.html");
    });
}