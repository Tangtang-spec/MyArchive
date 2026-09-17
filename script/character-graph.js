import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, orderBy, onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const selectProject = document.getElementById("select-project");
const searchInput = document.getElementById("search-input");
const container = document.getElementById("network-container");

// Side Info Panel
const nodePanel = document.getElementById("node-panel");
const panelName = document.getElementById("panel-name");
const panelRole = document.getElementById("panel-role");
const panelDesc = document.getElementById("panel-desc");
const btnClosePanel = document.getElementById("btn-close-panel");

// Graph Control Buttons
const btnResetZoom = document.getElementById("btn-reset-zoom");
const btnRelayout = document.getElementById("btn-relayout");

// User Elements
const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");
const btnLogout = document.getElementById("btn-logout");

// App State
let currentUser = null;
let currentProjectId = null;
let rawCharacters = [];
let network = null;
let nodesDataSet = null;
let edgesDataSet = null;
let unsubscribeCharListener = null;

// สีสำหรับแยกตามบทบาท
const ROLE_COLORS = {
    Main: { background: "#08383a", border: "#0EF1F1", highlight: { background: "#0e5a5d", border: "#0EF1F1" } },
    Supporting: { background: "#2e1548", border: "#c084fc", highlight: { background: "#482070", border: "#c084fc" } },
    Antagonist: { background: "#441414", border: "#f87171", highlight: { background: "#691e1e", border: "#f87171" } }
};

// --- 1. Authentication Check ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const name = user.displayName || user.email.split("@")[0];
        if (userNameEl) userNameEl.textContent = name;
        if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
        loadUserProjects();
    } else {
        window.location.href = "login.html";
    }
});

// --- 2. Load Projects ---
async function loadUserProjects() {
    try {
        const projectsRef = collection(db, "users", currentUser.uid, "projects");
        const q = query(projectsRef, orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);

        selectProject.innerHTML = "";

        if (snapshot.empty) {
            selectProject.innerHTML = `<option value="">-- ไม่พบโปรเจกต์ --</option>`;
            container.innerHTML = `<div style="color: #657e85; text-align: center; padding-top: 100px;">ไม่พบโปรเจกต์</div>`;
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

selectProject.addEventListener("change", (e) => {
    currentProjectId = e.target.value;
    if (currentProjectId) listenToCharacters(currentProjectId);
});

// --- 3. Real-time Characters Listener ---
function listenToCharacters(projectId) {
    if (unsubscribeCharListener) unsubscribeCharListener();

    const charRef = collection(db, "users", currentUser.uid, "projects", projectId, "characters");
    const q = query(charRef, orderBy("createdAt", "desc"));

    unsubscribeCharListener = onSnapshot(q, (snapshot) => {
        rawCharacters = [];
        snapshot.forEach((docSnap) => {
            rawCharacters.push({ id: docSnap.id, ...docSnap.data() });
        });
        buildGraphData();
    });
}

// --- 4. Build & Render Visual Graph ---
function buildGraphData() {
    const nodes = [];
    const edges = [];
    const edgeSet = new Set(); // ป้องกันเส้นซ้ำ

    rawCharacters.forEach(char => {
        const colorConfig = ROLE_COLORS[char.role] || ROLE_COLORS.Main;

        nodes.push({
            id: char.id,
            label: char.name,
            shape: "dot",
            size: char.role === "Main" ? 24 : 18,
            color: colorConfig,
            font: { color: "#ffffff", face: "Sarabun", size: 14 },
            borderWidth: 2,
            charData: char
        });

        // สร้างเส้นเชื่อมโยงจาก Relationships
        if (char.relationships && Array.isArray(char.relationships)) {
            char.relationships.forEach(rel => {
                if (rel.targetId) {
                    const edgeKey = [char.id, rel.targetId].sort().join("-");
                    
                    edges.push({
                        from: char.id,
                        to: rel.targetId,
                        label: rel.relationType || "",
                        font: { color: "#0EF1F1", size: 11, align: "horizontal", background: "#0b1114" },
                        color: { color: "#142126", highlight: "#0EF1F1", hover: "#0EF1F1" },
                        arrows: "to",
                        smooth: { type: "curvedCW", roundness: 0.2 }
                    });
                    
                    edgeSet.add(edgeKey);
                }
            });
        }
    });

    nodesDataSet = new vis.DataSet(nodes);
    edgesDataSet = new vis.DataSet(edges);

    const data = { nodes: nodesDataSet, edges: edgesDataSet };
    const options = {
        nodes: {
            shadow: true
        },
        edges: {
            width: 2,
            shadow: true
        },
        physics: {
            solver: "forceAtlas2Based",
            forceAtlas2Based: {
                gravitationalConstant: -50,
                centralGravity: 0.01,
                springLength: 100,
                springConstant: 0.08
            },
            stabilization: { iterations: 150 }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            zoomView: true
        }
    };

    if (network) network.destroy();
    network = new vis.Network(container, data, options);

    // Node Select Event
    network.on("selectNode", (params) => {
        const nodeId = params.nodes[0];
        const selectedNode = nodesDataSet.get(nodeId);
        if (selectedNode && selectedNode.charData) {
            showNodePanel(selectedNode.charData);
        }
    });

    network.on("deselectNode", () => {
        nodePanel.classList.remove("active");
    });
}

function showNodePanel(char) {
    panelName.textContent = char.name;
    panelRole.textContent = `บทบาท: ${char.role || "ไม่ระบุ"} | เผ่าพันธุ์: ${char.race || "-"}`;
    panelDesc.textContent = char.description || "ไม่มีคำอธิบายเพิ่มเติม";
    nodePanel.classList.add("active");
}

btnClosePanel.addEventListener("click", () => {
    nodePanel.classList.remove("active");
});

// Reset Zoom & Relayout Controls
btnResetZoom.addEventListener("click", () => {
    if (network) network.fit({ animation: { duration: 500 } });
});

btnRelayout.addEventListener("click", () => {
    if (network) {
        network.stabilize();
    }
});

// Search node
searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term || !nodesDataSet) return;

    const matchedNode = nodesDataSet.get().find(n => n.label.toLowerCase().includes(term));
    if (matchedNode && network) {
        network.selectNodes([matchedNode.id]);
        network.focus(matchedNode.id, { scale: 1.2, animation: { duration: 500 } });
        showNodePanel(matchedNode.charData);
    }
});

if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
        e.preventDefault();
        signOut(auth).then(() => window.location.href = "login.html");
    });
}