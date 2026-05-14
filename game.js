// -------------------- FIREBASE INIT --------------------
const firebaseConfig = {
  apiKey: "AIzaSyBtEIDdaZQAy7iQpeCgDgV7W8Xo8feKALA",
  authDomain: "rocket-clicker-64f24.firebaseapp.com",
  databaseURL: "https://rocket-clicker-64f24-default-rtdb.firebaseio.com",
  projectId: "rocket-clicker-64f24",
  storageBucket: "rocket-clicker-64f24.firebasestorage.app",
  messagingSenderId: "614772464568",
  appId: "1:614772464568:web:3b5e43733863ef358b0d4d",
  measurementId: "G-HMZJ48QKPW"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -------------------- AUTH (ANONYMOUS) --------------------
let playerUid = null;
let authReady = false;

firebase.auth().onAuthStateChanged(user => {
  if (user) {
    playerUid = user.uid;
    authReady = true;

    // Only load game AFTER auth is ready
    loadGame();
  } else {
    firebase.auth().signInAnonymously().catch(console.error);
  }
});


// -------------------- GAME STATE --------------------
let score = 0;
let perClickBase = 1;
let perSecondBase = 0;
let prestigeMultiplier = 1;
let totalRocksAllTime = 0;

let combo = 0;
let comboMultiplier = 1;
let lastClickTime = 0;

const BASE_UPGRADE_COSTS = {
  clickPower: 10,
  autoMiner: 50,
  drill: 200,
  factory: 1000,
  quarry: 5000,
  robot: 20000,
  volcano: 100000
};

let upgrades = {
  clickPower: { cost: BASE_UPGRADE_COSTS.clickPower, increase: 1, type: "click" },
  autoMiner: { cost: BASE_UPGRADE_COSTS.autoMiner, increase: 1, type: "passive" },
  drill: { cost: BASE_UPGRADE_COSTS.drill, increase: 5, type: "passive" },
  factory: { cost: BASE_UPGRADE_COSTS.factory, increase: 20, type: "passive" },
  quarry: { cost: BASE_UPGRADE_COSTS.quarry, increase: 75, type: "passive" },
  robot: { cost: BASE_UPGRADE_COSTS.robot, increase: 250, type: "passive" },
  volcano: { cost: BASE_UPGRADE_COSTS.volcano, increase: 1000, type: "passive" }
};

let achievements = [
  { id: "a1", title: "First Pebble", desc: "Reach 10 rocks.", condition: () => totalRocksAllTime >= 10, unlocked: false },
  { id: "a2", title: "Stone Collector", desc: "Reach 1,000 rocks.", condition: () => totalRocksAllTime >= 1000, unlocked: false },
  { id: "a3", title: "Rock Tycoon", desc: "Reach 100,000 rocks.", condition: () => totalRocksAllTime >= 100000, unlocked: false },
  { id: "a4", title: "Click Master", desc: "Have 50 per click.", condition: () => getPerClick() >= 50, unlocked: false },
  { id: "a5", title: "Engine of Stone", desc: "Reach 5,000 rocks/sec.", condition: () => getPerSecond() >= 5000, unlocked: false },
  { id: "a6", title: "Prestiged", desc: "Prestige at least once.", condition: () => prestigeMultiplier > 1, unlocked: false }
];

// -------------------- DOM ELEMENTS --------------------
const rockImg = document.getElementById("rock");
const goldenRock = document.getElementById("goldenRock");
const startBtn = document.getElementById("startBtn");
const nameInput = document.getElementById("playerNameInput");
const currentPlayerLabel = document.getElementById("currentPlayerLabel");
const leaderboardList = document.getElementById("leaderboardList");

// -------------------- HELPERS --------------------
function getPerClick() {
  return perClickBase * prestigeMultiplier;
}

function getPerSecond() {
  return perSecondBase * prestigeMultiplier;
}

function clampState() {
  const maxVal = 1e15;
  const maxRate = 1e9;

  score = Math.max(0, Math.min(score, maxVal));
  totalRocksAllTime = Math.max(0, Math.min(totalRocksAllTime, maxVal));
  perClickBase = Math.max(1, Math.min(perClickBase, maxRate));
  perSecondBase = Math.max(0, Math.min(perSecondBase, maxRate));
  prestigeMultiplier = Math.max(1, Math.min(prestigeMultiplier, 1e6));
}

// -------------------- UI UPDATES --------------------
function updateStats() {
  document.getElementById("score").innerText = "Rocks: " + Math.floor(score);
  document.getElementById("perClick").innerText = "Per Click: " + getPerClick();
  document.getElementById("perSecond").innerText = "Per Second: " + getPerSecond();
  document.getElementById("prestige").innerText = "Prestige Multiplier: x" + prestigeMultiplier;
  document.getElementById("combo").innerText = "Combo: " + combo + " (x" + comboMultiplier + ")";
}

function updateShop() {
  for (const key in upgrades) {
    const el = document.getElementById(key + "Cost");
    if (el) el.innerText = upgrades[key].cost;
  }
}
/* -------------------- PARTICLES -------------------- */
function spawnParticle(x, y, text, color = "#facc15") {
  const rect = document.body.getBoundingClientRect();
  const particle = document.createElement("div");
  particle.className = "particle";
  particle.style.left = (x - rect.left - 20) + "px";
  particle.style.top = (y - rect.top - 20) + "px";
  particle.style.color = color;
  particle.textContent = text;
  document.body.appendChild(particle);
  setTimeout(() => particle.remove(), 600);
}

/* -------------------- ACHIEVEMENTS -------------------- */
function renderAchievements() {
  const container = document.getElementById("achList");
  container.innerHTML = "";
  achievements.forEach(a => {
    const div = document.createElement("div");
    div.className = "ach" + (a.unlocked ? " unlocked" : "");
    div.innerHTML = `<span class="title">${a.title}</span><span class="desc">${a.desc}</span>`;
    container.appendChild(div);
  });
}

function checkAchievements() {
  let changed = false;
  achievements.forEach(a => {
    if (!a.unlocked && a.condition()) {
      a.unlocked = true;
      changed = true;
      spawnParticle(window.innerWidth / 2, 60, "Achievement: " + a.title, "#22c55e");
    }
  });
  if (changed) renderAchievements();
}

/* -------------------- SHOP -------------------- */
function buyUpgrade(type) {
  const upgrade = upgrades[type];
  if (!upgrade) return;

  if (score >= upgrade.cost) {
    score -= upgrade.cost;

    if (upgrade.type === "click") {
      perClickBase += upgrade.increase;
    } else {
      perSecondBase += upgrade.increase;
    }

    upgrade.cost = Math.floor(upgrade.cost * 1.5);
    clampState();
    updateShop();
    updateStats();
    saveGame();
  }
}
window.buyUpgrade = buyUpgrade;

/* -------------------- CLICK HANDLERS -------------------- */
function handleClick(e, gain, isGolden = false) {
  const now = Date.now();
  combo = now - lastClickTime < 600 ? combo + 1 : 1;
  lastClickTime = now;

  comboMultiplier = 1 + Math.floor(combo / 10);
  const totalGain = gain * comboMultiplier;

  score += totalGain;
  totalRocksAllTime += totalGain;

  clampState();
  spawnParticle(e.clientX, e.clientY, "+" + totalGain, isGolden ? "#fde047" : "#facc15");
  updateStats();
  checkAchievements();
}

rockImg.addEventListener("click", (e) => handleClick(e, getPerClick()));
goldenRock.addEventListener("click", (e) => {
  handleClick(e, getPerClick() * 100, true);
  goldenRock.style.display = "none";
});

/* -------------------- PRESTIGE -------------------- */
function doPrestige() {
  if (totalRocksAllTime < 10000) return;
  const bonus = Math.floor(totalRocksAllTime / 10000);
  if (bonus <= 0) return;

  prestigeMultiplier += bonus;
  score = 0;
  perClickBase = 1;
  perSecondBase = 0;
  totalRocksAllTime = 0;

  for (const key in upgrades) {
    upgrades[key].cost = BASE_UPGRADE_COSTS[key];
  }

  const ach = achievements.find(a => a.id === "a6");
  if (ach) ach.unlocked = true;

  clampState();
  updateShop();
  updateStats();
  renderAchievements();
  saveGame();
}
document.getElementById("prestigeBtn").addEventListener("click", doPrestige);

/* -------------------- GOLDEN ROCK -------------------- */
setInterval(() => {
  if (Math.random() < 0.15) {
    goldenRock.style.display = "block";
    setTimeout(() => goldenRock.style.display = "none", 5000);
  }
}, 30000);
/* -------------------- TICK LOOP -------------------- */
setInterval(() => {
  const gain = getPerSecond();
  if (gain > 0) {
    score += gain;
    totalRocksAllTime += gain;
    clampState();
    updateStats();
    checkAchievements();
  }

  if (Date.now() - lastClickTime > 1500) {
    combo = 0;
    comboMultiplier = 1;
    document.getElementById("combo").innerText = "Combo: 0 (x1)";
  }
}, 1000);

/* -------------------- SAVE GAME (AUTH-SECURE) -------------------- */
function saveGame() {
  if (!playerUid) return;

  clampState();

  const data = {
    name: currentPlayerName || "Guest",
    score: score,
    perClickBase: perClickBase,
    perSecondBase: perSecondBase,
    prestigeMultiplier: prestigeMultiplier,
    totalRocksAllTime: totalRocksAllTime,
    upgrades: upgrades,
    achievements: achievements.map(a => ({
      id: a.id,
      unlocked: a.unlocked
    })),
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };

  db.ref("players/" + playerUid).set(data).catch(() => {});
}

/* -------------------- LOAD GAME (AUTH-SECURE) -------------------- */
function loadGame() {
  if (!playerUid) return;

  db.ref("players/" + playerUid).once("value").then(snapshot => {
    if (!snapshot.exists()) {
      // No save yet → show name screen
      document.getElementById("nameScreen").style.display = "flex";
      document.getElementById("gameContainer").classList.remove("show");
      return;
    }

    const data = snapshot.val();

    score = data.score || 0;
    perClickBase = data.perClickBase || 1;
    perSecondBase = data.perSecondBase || 0;
    prestigeMultiplier = data.prestigeMultiplier || 1;
    totalRocksAllTime = data.totalRocksAllTime || 0;

    if (data.upgrades) {
      for (const key in upgrades) {
        if (data.upgrades[key]) {
          upgrades[key].cost = data.upgrades[key].cost;
        }
      }
    }

    if (data.achievements) {
      data.achievements.forEach(saved => {
        const a = achievements.find(x => x.id === saved.id);
        if (a) a.unlocked = !!saved.unlocked;
      });
    }

    clampState();
    updateShop();
    updateStats();
    renderAchievements();
    loadLeaderboards();
  });
}

/* -------------------- LEADERBOARD -------------------- */
function loadLeaderboards() {
  db.ref("players").once("value").then(snapshot => {
    if (!snapshot.exists()) {
      leaderboardList.textContent = "No players yet.";
      return;
    }

    const players = Object.entries(snapshot.val()).map(([uid, p]) => ({
      name: p.name || "Player",
      score: Number(p.score) || 0,
      totalRocksAllTime: Number(p.totalRocksAllTime) || 0,
      prestigeMultiplier: Number(p.prestigeMultiplier) || 1
    }));

    const topN = arr => arr.slice(0, 10);

    const byScore = topN([...players].sort((a, b) => b.score - a.score));
    const byAllTime = topN([...players].sort((a, b) => b.totalRocksAllTime - a.totalRocksAllTime));
    const byPrestige = topN([...players].sort((a, b) => b.prestigeMultiplier - a.prestigeMultiplier));

    let out = [];

    out.push("=== Top Score ===");
    byScore.forEach((p, i) => out.push(`${i + 1}. ${p.name} — ${Math.floor(p.score)}`));

    out.push("\n=== Top All-Time ===");
    byAllTime.forEach((p, i) => out.push(`${i + 1}. ${p.name} — ${Math.floor(p.totalRocksAllTime)}`));

    out.push("\n=== Top Prestige ===");
    byPrestige.forEach((p, i) => out.push(`${i + 1}. ${p.name} — x${p.prestigeMultiplier}`));

    leaderboardList.textContent = out.join("\n");
  });
}

/* -------------------- NAME SCREEN -------------------- */
startBtn.addEventListener("click", () => {
  if (!authReady) return; // Prevent clicking before auth is ready

  let name = nameInput.value.trim();
  if (!name) name = "Guest";

  currentPlayerName = name;
  localStorage.setItem("rockPlayerName", name);

  currentPlayerLabel.innerText = "Player: " + currentPlayerName;

  document.getElementById("nameScreen").style.display = "none";
  document.getElementById("gameContainer").classList.add("show");

  saveGame();
});

/* -------------------- AUTO-SAVE -------------------- */
setInterval(saveGame, 5000);
