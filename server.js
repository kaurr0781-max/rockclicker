const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory game state (in production, use a database)
const gameStates = {};

// Initialize game state for a player
function initializePlayer(playerId) {
  if (!gameStates[playerId]) {
    gameStates[playerId] = {
      rocks: 0,
      rockPerClick: 1,
      totalRocksEarned: 0,
      buildings: {
        miner: { owned: 0, cost: 15, income: 0.1 },
        excavator: { owned: 0, cost: 100, income: 1 },
        quarry: { owned: 0, cost: 500, income: 10 },
        mine: { owned: 0, cost: 5000, income: 100 }
      },
      upgrades: {
        betterpickaxe: { purchased: false, cost: 100, boost: 2 },
        diamondpickaxe: { purchased: false, cost: 1000, boost: 5 },
        mythicpickaxe: { purchased: false, cost: 10000, boost: 20 }
      },
      clickCount: 0,
      startTime: Date.now()
    };
  }
  return gameStates[playerId];
}

// Get current game state
app.get('/api/game/:playerId', (req, res) => {
  const { playerId } = req.params;
  const state = initializePlayer(playerId);
  res.json(state);
});

// Click rock
app.post('/api/game/:playerId/click', (req, res) => {
  const { playerId } = req.params;
  const state = initializePlayer(playerId);
  
  state.rocks += state.rockPerClick;
  state.totalRocksEarned += state.rockPerClick;
  state.clickCount++;
  
  res.json({ success: true, state });
});

// Generate passive income
app.post('/api/game/:playerId/tick', (req, res) => {
  const { playerId } = req.params;
  const state = initializePlayer(playerId);
  
  let income = 0;
  for (const building in state.buildings) {
    const b = state.buildings[building];
    income += b.owned * b.income;
  }
  
  state.rocks += income / 10; // Tick every 100ms, so divide by 10 for per-second rate
  state.totalRocksEarned += income / 10;
  
  res.json({ success: true, state });
});

// Buy building
app.post('/api/game/:playerId/buy-building', (req, res) => {
  const { playerId } = req.params;
  const { buildingType } = req.body;
  const state = initializePlayer(playerId);
  
  if (!state.buildings[buildingType]) {
    return res.status(400).json({ success: false, error: 'Invalid building' });
  }
  
  const building = state.buildings[buildingType];
  const cost = building.cost * Math.pow(1.15, building.owned); // Scale cost
  
  if (state.rocks < cost) {
    return res.status(400).json({ success: false, error: 'Not enough rocks' });
  }
  
  state.rocks -= cost;
  building.owned++;
  
  res.json({ success: true, state });
});

// Buy upgrade
app.post('/api/game/:playerId/buy-upgrade', (req, res) => {
  const { playerId } = req.params;
  const { upgradeType } = req.body;
  const state = initializePlayer(playerId);
  
  if (!state.upgrades[upgradeType]) {
    return res.status(400).json({ success: false, error: 'Invalid upgrade' });
  }
  
  const upgrade = state.upgrades[upgradeType];
  
  if (upgrade.purchased) {
    return res.status(400).json({ success: false, error: 'Already purchased' });
  }
  
  if (state.rocks < upgrade.cost) {
    return res.status(400).json({ success: false, error: 'Not enough rocks' });
  }
  
  state.rocks -= upgrade.cost;
  upgrade.purchased = true;
  state.rockPerClick *= upgrade.boost;
  
  res.json({ success: true, state });
});

// Save game state (optional endpoint for explicit saves)
app.post('/api/game/:playerId/save', (req, res) => {
  const { playerId } = req.params;
  // In production, save to database here
  res.json({ success: true, message: 'Game saved' });
});

app.listen(PORT, () => {
  console.log(`Rock Clicker server running at http://localhost:${PORT}`);
});
