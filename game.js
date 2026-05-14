/* ============================================================
   PREMIUM CYBERPUNK ROCK CLICKER — FIRESTORE + FS1 MODULES
   ============================================================ */

/* -------------------- FIREBASE IMPORTS -------------------- */

import { 
    getFirestore, doc, setDoc, getDoc, updateDoc,
    collection, query, orderBy, limit, getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getAuth, signInAnonymously, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* -------------------- FIREBASE CONFIG -------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyBtEIDdaZQAy7iQpeCgDgV7W8Xo8feKALA",
  authDomain: "rocket-clicker-64f24.firebaseapp.com",
  projectId: "rocket-clicker-64f24",
  storageBucket: "rocket-clicker-64f24.firebasestorage.app",
  messagingSenderId: "614772464568",
  appId: "1:614772464568:web:3b5e43733863ef358b0d4d",
  measurementId: "G-HMZJ48QKPW"
};

/* -------------------- INIT FIREBASE -------------------- */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

let uid = null;
let authReady = false;

/* -------------------- AUTH -------------------- */
onAuthStateChanged(auth, user => {
    if (user) {
        uid = user.uid;
        authReady = true;
        setTimeout(loadCloudSave, 200);
    } else {
        signInAnonymously(auth);
    }
});

/* ============================================================
   GAME STATE
   ============================================================ */
let player = {
    name: "",
    rocks: 0,
    goldenRocks: 0,
    perClick: 1,
    perSecond: 0,
    combo: 0,
    prestige: 0,
    totalAllTime: 0
};

/* ============================================================
   DOM ELEMENTS
   ============================================================ */
const rock = document.getElementById("rock");
const goldenRock = document.getElementById("goldenRock");
const rockCount = document.getElementById("rockCount");
const goldenCount = document.getElementById("goldenCount");
const perClick = document.getElementById("perClick");
const perSecond = document.getElementById("perSecond");
const comboDisplay = document.getElementById("comboDisplay");
const shop = document.getElementById("shop");
const achievements = document.getElementById("achievements");
const leaderboard = document.getElementById("leaderboard");
const prestigeBtn = document.getElementById("prestigeBtn");

const nameScreen = document.getElementById("nameScreen");
const nameInput = document.getElementById("nameInput");
const saveNameBtn = document.getElementById("saveNameBtn");

/* ============================================================
   SHOP ITEMS
   ============================================================ */
const shopItems = [
    { id: 1, name: "Stronger Clicks", baseCost: 50, amount: 0, effect: 1 },
    { id: 2, name: "Auto Miner", baseCost: 200, amount: 0, effect: 1 },
    { id: 3, name: "Laser Drill", baseCost: 1000, amount: 0, effect: 5 }
];

/* ============================================================
   NAME SCREEN
   ============================================================ */
saveNameBtn.onclick = async () => {
    if (!nameInput.value.trim()) return;
    player.name = nameInput.value.trim();
    nameScreen.style.display = "none";
    await saveCloud();
    loadLeaderboard();
};

/* ============================================================
   CLICK HANDLING
   ============================================================ */
rock.onclick = async () => {
    player.rocks += player.perClick;
    player.totalAllTime += player.perClick;
    player.combo++;
    updateUI();
    await saveCloud();
};

goldenRock.onclick = async () => {
    player.goldenRocks++;
    player.rocks += 100 * (player.prestige + 1);
    player.totalAllTime += 100;
    goldenRock.style.display = "none";
    updateUI();
    await saveCloud();
};

/* ============================================================
   GOLDEN ROCK SPAWN
   ============================================================ */
setInterval(() => {
    if (Math.random() < 0.05) {
        goldenRock.style.display = "block";
        setTimeout(() => goldenRock.style.display = "none", 5000);
    }
}, 3000);

/* ============================================================
   AUTO MINING
   ============================================================ */
setInterval(async () => {
    player.rocks += player.perSecond;
    player.totalAllTime += player.perSecond;
    updateUI();
    await saveCloud();
}, 1000);

/* ============================================================
   SHOP SYSTEM
   ============================================================ */
function loadShop() {
    shop.innerHTML = "";
    shopItems.forEach(item => {
        const cost = Math.floor(item.baseCost * Math.pow(1.2, item.amount));
        const div = document.createElement("div");
        div.className = "shop-item";
        div.innerHTML = `${item.name} — Cost: ${cost}`;
        div.onclick = () => buyItem(item);
        shop.appendChild(div);
    });
}

async function buyItem(item) {
    const cost = Math.floor(item.baseCost * Math.pow(1.2, item.amount));
    if (player.rocks >= cost) {
        player.rocks -= cost;
        item.amount++;

        if (item.id === 1) player.perClick += item.effect;
        if (item.id === 2) player.perSecond += item.effect;
        if (item.id === 3) player.perSecond += item.effect;

        updateUI();
        loadShop();
        await saveCloud();
    }
}

/* ============================================================
   PRESTIGE
   ============================================================ */
prestigeBtn.onclick = async () => {
    if (player.rocks < 10000) return alert("You need 10,000 rocks to prestige!");

    player.prestige++;
    player.rocks = 0;
    player.perClick = 1 + player.prestige;
    player.perSecond = 0;

    updateUI();
    await saveCloud();
};

/* ============================================================
   FIRESTORE SAVE
   ============================================================ */
async function saveCloud() {
    if (!uid || !authReady) return;

    const ref = doc(db, "players", uid);

    await setDoc(ref, {
        name: player.name || "Guest",
        rocks: player.rocks,
        goldenRocks: player.goldenRocks,
        perClick: player.perClick,
        perSecond: player.perSecond,
        combo: player.combo,
        prestige: player.prestige,
        totalAllTime: player.totalAllTime,
        updatedAt: Date.now()
    }, { merge: true });
}

/* ============================================================
   FIRESTORE LOAD
   ============================================================ */
async function loadCloudSave() {
    if (!uid) return;

    const ref = doc(db, "players", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        nameScreen.style.display = "flex";
        return;
    }

    Object.assign(player, snap.data());

    nameScreen.style.display = "none";
    updateUI();
    loadShop();
    loadLeaderboard();
}

/* ============================================================
   LEADERBOARD (TOP 100 ROCKS)
   ============================================================ */
async function loadLeaderboard() {
    leaderboard.innerHTML = "Loading...";

    const q = query(
        collection(db, "players"),
        orderBy("rocks", "desc"),
        limit(100)
    );

    const snap = await getDocs(q);

    leaderboard.innerHTML = "";

    snap.forEach(doc => {
        const p = doc.data();
        const div = document.createElement("div");
        div.innerHTML = `${p.name}: ${Math.floor(p.rocks)}`;
        leaderboard.appendChild(div);
    });
}

/* ============================================================
   UI UPDATE
   ============================================================ */
function updateUI() {
    rockCount.textContent = player.rocks;
    goldenCount.textContent = player.goldenRocks;
    perClick.textContent = player.perClick;
    perSecond.textContent = player.perSecond;
    comboDisplay.textContent = `Combo: ${player.combo}`;
}

/* ============================================================
   INIT
   ============================================================ */
loadShop();
updateUI();
