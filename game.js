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

// -------------------- TOKEN-BASED ACCOUNT --------------------
let playerToken = localStorage.getItem("rockPlayerToken");
if (!playerToken) {
  playerToken = "tok_" + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  localStorage.setItem("rockPlayerToken", playerToken);
}

let currentPlayerName = null;

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

// Anti-cheat sanity clamp
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
  document.getElementById("clickPowerCost").innerText = upgrades.clickPower.cost;
  document.getElementById("autoMinerCost").innerText = upgrades.autoMiner.cost;
  document.getElementById("drillCost").innerText = upgrades.drill.cost;
  document.getElementById("factoryCost").innerText = upgrades.factory.cost;
  document.getElementById("quarryCost").innerText = upgrades.quarry.cost;
  document.getElementById("robotCost").innerText = upgrades.robot.cost;
  document.getElementById("volcanoCost").innerText = upgrades.volcano.cost;
}

// -------------------- PARTICLES --------------------
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

// -------------------- ACHIEVEMENTS --------------------
function renderAchievements() {
  const container = document.getElementById("achList");
  container.innerHTML = "";
  achievements.forEach(a => {
    const div = document.createElement("div");
    div.className = "ach" + (a.unlocked ? " unlocked" : "");
    const t = document.createElement("span");
    t.className = "title";
    t.textContent = a.title;
    const d = document.createElement("span");
    d.className = "desc";
    d.textContent = a.desc;
    div.appendChild(t);
    div.appendChild(d);
    container.appendChild(div);
  });
}

function checkAchievements() {
  let changed = false;
  achievements.forEach(a => {
    if (!a.unlocked && a.condition()) {
      a.unlocked = true;
      changed = true;
      // small popup particle at top center
      spawnParticle(window.innerWidth / 2, 60, "Achievement: " + a.title, "#22c55e");
    }
  });
  if (changed) renderAchievements();
}

// -------------------- SHOP / UPGRADES --------------------
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

// -------------------- CLICK HANDLERS --------------------
function handleClick(e, gain, isGolden = false) {
  const now = Date.now();
  if (now - lastClickTime < 600) {
    combo++;
  } else {
    combo = 1;
  }
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

rockImg.addEventListener("click", (e) => {
  handleClick(e, getPerClick(), false);
});

goldenRock.addEventListener("click", (e) => {
  handleClick(e, getPerClick() * 100, true);
  goldenRock.style.display = "none";
});

// -------------------- PRESTIGE --------------------
function doPrestige() {
  if (totalRocksAllTime < 10000) return;
  const bonus = Math.floor(totalRocksAllTime / 10000);
  if (bonus <= 0) return;

  prestigeMultiplier += bonus;
  score = 0;
  perClickBase = 1;
  perSecondBase = 0;
  totalRocksAllTime = 0;

  Object.keys(upgrades).forEach(k => {
    upgrades[k].cost = BASE_UPGRADE_COSTS[k];
  });

  const ach = achievements.find(a => a.id === "a6");
  if (ach) ach.unlocked = true;

  clampState();
  updateShop();
  updateStats();
  renderAchievements();
  saveGame();
}
document.getElementById("prestigeBtn").addEventListener("click", doPrestige);

// -------------------- GOLDEN ROCK EVENT --------------------
function spawnGoldenRock() {
  if (Math.random() < 0.15) {
    goldenRock.style.display = "block";
    setTimeout(() => {
      goldenRock.style.display = "none";
    }, 5000);
  }
}
setInterval(spawnGoldenRock, 30000);

// -------------------- TICK LOOP --------------------
function tick() {
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
}
setInterval(tick, 1000);

// -------------------- FIREBASE SAVE / LOAD --------------------
function saveGame() {
  if (!playerToken) return;

  clampState();

  const data = {
    name: currentPlayerName || "Guest",
    score,
    perClickBase,
    perSecondBase,
    prestigeMultiplier,
    totalRocksAllTime,
    upgrades,
    achievements: achievements.map(a => ({ id: a.id, unlocked: a.unlocked })),
    updatedAt: firebase.database.ServerValue.TIMESTAMP
  };

  db.ref("players/" + playerToken).set(data)
    .then(() => updateGlobalLeaderboards())
    .catch(() => {});
}

function loadGame() {
  if (!playerToken) return;

  db.ref("players/" + playerToken).once("value").then(snapshot => {
   if (!snapshot.exists() || snapshot.val() === null) {
    document.getElementById("nameScreen").style.display = "flex";
    document.getElementById("gameContainer").style.display = "none";
    updateShop();
    updateStats();
    renderAchievements();
    loadLeaderboards();
    return;
}

      updateShop();
      updateStats();
      renderAchievements();
      loadLeaderboards();
      return;
    }

    const data = snapshot.val();
    score = data.score || 0;
    perClickBase = data.perClickBase || 1;
    perSecondBase = data.perSecondBase || 0;
    prestigeMultiplier = data.prestigeMultiplier || 1;
    totalRocksAllTime = data.totalRocksAllTime || 0;

    if (data.upgrades) {
      Object.keys(upgrades).forEach(k => {
        if (data.upgrades[k]) {
          upgrades[k].cost = data.upgrades[k].cost || upgrades[k].cost;
        }
      });
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

// -------------------- GLOBAL LEADERBOARDS --------------------
function updateGlobalLeaderboards() {
  loadLeaderboards();
}

function loadLeaderboards() {
  db.ref("players").once("value").then(snapshot => {
    if (!snapshot.exists()) {
      leaderboardList.textContent = "No players yet.";
      return;
    }

    const players = Object.entries(snapshot.val()).map(([token, p]) => ({
      token,
      name: p.name || "Player",
      score: Number(p.score) || 0,
      totalRocksAllTime: Number(p.totalRocksAllTime) || 0,
      prestigeMultiplier: Number(p.prestigeMultiplier) || 1
    }));

    const topN = (arr, n = 10) => arr.slice(0, n);

    const byCurrentScore = topN([...players].sort((a, b) => b.score - a.score));
    const byAllTime = topN([...players].sort((a, b) => b.totalRocksAllTime - a.totalRocksAllTime));
    const byPrestige = topN([...players].sort((a, b) => b.prestigeMultiplier - a.prestigeMultiplier));
    const byCombined = topN([...players].sort((a, b) => (b.score * b.prestigeMultiplier) - (a.score * a.prestigeMultiplier)));

    let lines = [];

    lines.push("=== Top Current Score ===");
    byCurrentScore.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name} — ${Math.floor(p.score)} score`);
    });

    lines.push("");
    lines.push("=== Top All-Time Rocks ===");
    byAllTime.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name} — ${Math.floor(p.totalRocksAllTime)} rocks`);
    });

    lines.push("");
    lines.push("=== Top Prestige Multiplier ===");
    byPrestige.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name} — x${p.prestigeMultiplier}`);
    });

    lines.push("");
    lines.push("=== Top Combined (Score × Prestige) ===");
    byCombined.forEach((p, i) => {
      const combined = Math.floor(p.score * p.prestigeMultiplier);
      lines.push(`${i + 1}. ${p.name} — ${combined} power`);
    });

    leaderboardList.textContent = lines.join("\n");
  });
}

// -------------------- NAME SCREEN --------------------
startBtn.addEventListener("click", () => {
  let name = nameInput.value.trim();
  if (!name) name = "Guest";
  currentPlayerName = name;

  currentPlayerLabel.innerText = "Player: " + currentPlayerName;

  document.getElementById("nameScreen").style.display = "none";
  document.getElementById("gameContainer").style.display = "flex";

  loadGame();
});

// -------------------- AUTO-SAVE --------------------
setInterval(saveGame, 5000);
