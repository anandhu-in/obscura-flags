const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'players.json');

// The real flags (only the server knows them)
const REAL_FLAGS = [
  "OBSCURA{layer1_shadow_9f3a21}",
  "OBSCURA{veil_broken_7dK91x}",
  "OBSCURA{the_hidden_layer_revealed_f82c1d}"
];

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: load / save players
function loadPlayers() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function savePlayers(players) {
  fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));
}

// ========== API ==========

// Register or Login
app.post('/api/auth', async (req, res) => {
  const { callsign, password } = req.body;
  if (!callsign || !password) {
    return res.status(400).json({ error: 'Callsign and password required' });
  }

  const players = loadPlayers();
  const existing = players.find(p => p.callsign.toLowerCase() === callsign.toLowerCase());

  if (existing) {
    // Login
    const match = await bcrypt.compare(password, existing.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    return res.json({
      success: true,
      callsign: existing.callsign,
      score: existing.score
    });
  } else {
    // Register
    const passwordHash = await bcrypt.hash(password, 10);
    const newPlayer = {
      callsign,
      passwordHash,
      score: 0,
      updated: new Date().toISOString()
    };
    players.push(newPlayer);
    savePlayers(players);
    return res.json({
      success: true,
      callsign,
      score: 0
    });
  }
});

// Submit flags
app.post('/api/submit', async (req, res) => {
  const { callsign, password, flags } = req.body; // flags = [flag1, flag2, flag3]

  if (!callsign || !password || !Array.isArray(flags)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const players = loadPlayers();
  const player = players.find(p => p.callsign.toLowerCase() === callsign.toLowerCase());
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const match = await bcrypt.compare(password, player.passwordHash);
  if (!match) return res.status(401).json({ error: 'Incorrect password' });

  let score = 0;
  const results = [];

  for (let i = 0; i < 3; i++) {
    if (flags[i] && flags[i].trim() === REAL_FLAGS[i]) {
      score++;
      results.push(true);
    } else {
      results.push(false);
    }
  }

  if (score > player.score) {
    player.score = score;
    player.updated = new Date().toISOString();
    savePlayers(players);
  }

  res.json({
    success: true,
    results,          // [true, false, true]
    score: player.score
  });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const players = loadPlayers()
    .map(p => ({
      callsign: p.callsign,
      score: p.score,
      updated: p.updated
    }))
    .sort((a, b) => b.score - a.score || new Date(a.updated) - new Date(b.updated));

  res.json(players);
});

// Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OBSCURA server running on http://localhost:${PORT}`);
});