const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

const RANK_ORDER = ['Recruit', 'Member', 'Officer', 'Co-Leader', 'Leader'];
const getTodayISO = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────
// GGE TRACKER PROXY — fetch live data
// ─────────────────────────────────────────────
const GGE_API_BASE   = 'https://api.gge-tracker.com/api/v1';
const GGE_SERVER     = 'E4K_INT2';
const GGE_ALLIANCE_ID = '18696186';
const GGE_HEADERS    = { 'Accept': 'application/json', 'gge-server': GGE_SERVER };

/**
 * GET /api/gge/alliance/:id
 * Proxy: fetch alliance + members from GGE-Tracker API
 */
app.get('/api/gge/alliance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${GGE_API_BASE}/alliances/${id}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `GGE Tracker API returned ${response.status}`,
        detail: await response.text()
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('GGE API error:', err.message);
    res.status(502).json({ error: 'Failed to reach GGE Tracker API', detail: err.message });
  }
});

/**
 * GET /api/gge/alliance/:id/members
 * Proxy: fetch alliance member list from GGE-Tracker
 */
app.get('/api/gge/alliance/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${GGE_API_BASE}/alliances/${id}/members`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `GGE Tracker API returned ${response.status}`,
        detail: await response.text()
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('GGE API members error:', err.message);
    res.status(502).json({ error: 'Failed to reach GGE Tracker API', detail: err.message });
  }
});

/**
 * GET /api/gge/player/:id
 * Proxy: fetch individual player/castle data from GGE-Tracker
 */
app.get('/api/gge/player/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${GGE_API_BASE}/players/${id}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `GGE Tracker API returned ${response.status}`,
        detail: await response.text()
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('GGE API player error:', err.message);
    res.status(502).json({ error: 'Failed to reach GGE Tracker API', detail: err.message });
  }
});

// ─────────────────────────────────────────────
// PLAYERS
// ─────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  try {
    const { totalPlayers, totalPower, avgPower } = db.prepare(
      'SELECT COUNT(*) as totalPlayers, COALESCE(SUM(power),0) as totalPower, COALESCE(AVG(power),0) as avgPower FROM players'
    ).get();
    const { activePlayers } = db.prepare(
      "SELECT COUNT(*) as activePlayers FROM players WHERE status = 'Active'"
    ).get();
    res.json({
      totalPlayers: Number(totalPlayers),
      activePlayers: Number(activePlayers),
      totalPower: Number(totalPower),
      avgPower: Math.round(Number(avgPower))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/players', (req, res) => {
  try {
    const { search, rank, status, sortBy = 'power', sortOrder = 'desc' } = req.query;
    const conditions = [];
    const params = {};

    if (search && search.trim()) {
      conditions.push('(name LIKE @search OR notes LIKE @search)');
      params.search = `%${search.trim()}%`;
    }
    if (rank && rank !== 'All') { conditions.push('rank = @rank'); params.rank = rank; }
    if (status && status !== 'All') { conditions.push('status = @status'); params.status = status; }

    const allowedSort = { name: 'name', rank: 'rank', power: 'power', last_active: 'last_active', status: 'status' };
    const sortCol = allowedSort[sortBy] || 'power';
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const players = db.prepare(
      `SELECT * FROM players ${where} ORDER BY ${sortCol} ${dir}`
    ).all(params);
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

app.get('/api/players/:id', (req, res) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  res.json(player);
});

app.post('/api/players', (req, res) => {
  try {
    const { name, rank = 'Member', power = 0, kingdom = 1, last_active, contributions = 0, notes = '', joined_date, status = 'Active', gge_player_id = '' } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Player name is required' });

    const result = db.prepare(`
      INSERT INTO players (name, rank, power, kingdom, last_active, contributions, notes, joined_date, status, gge_player_id)
      VALUES (@name, @rank, @power, @kingdom, @last_active, @contributions, @notes, @joined_date, @status, @gge_player_id)
    `).run({
      name: name.trim(),
      rank: RANK_ORDER.includes(rank) ? rank : 'Member',
      power: Number(power) || 0,
      kingdom: Number(kingdom) || 1,
      last_active: last_active ? String(last_active).slice(0, 10) : getTodayISO(),
      contributions: Number(contributions) || 0,
      notes: notes || '',
      joined_date: joined_date ? String(joined_date).slice(0, 10) : getTodayISO(),
      status: ['Active', 'Inactive', 'Warning', 'Kicked'].includes(status) ? status : 'Active',
      gge_player_id: gge_player_id || ''
    });

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(player);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create player' });
  }
});

app.put('/api/players/:id', (req, res) => {
  try {
    const { name, rank, power, kingdom, last_active, contributions, notes, joined_date, status, gge_player_id } = req.body;
    const existing = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Player not found' });

    db.prepare(`
      UPDATE players SET name=@name, rank=@rank, power=@power, kingdom=@kingdom,
        last_active=@last_active, contributions=@contributions, notes=@notes,
        joined_date=@joined_date, status=@status, gge_player_id=@gge_player_id
      WHERE id=@id
    `).run({
      id: Number(req.params.id),
      name: (name || existing.name).trim(),
      rank: RANK_ORDER.includes(rank) ? rank : existing.rank,
      power: power !== undefined ? Number(power) : existing.power,
      kingdom: kingdom !== undefined ? Number(kingdom) : existing.kingdom,
      last_active: last_active ? String(last_active).slice(0, 10) : existing.last_active,
      contributions: contributions !== undefined ? Number(contributions) : existing.contributions,
      notes: notes !== undefined ? notes : existing.notes,
      joined_date: joined_date ? String(joined_date).slice(0, 10) : existing.joined_date,
      status: ['Active', 'Inactive', 'Warning', 'Kicked'].includes(status) ? status : existing.status,
      gge_player_id: gge_player_id !== undefined ? gge_player_id : (existing.gge_player_id || '')
    });

    res.json(db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update player' });
  }
});

app.delete('/api/players/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM players WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Player not found' });
    db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Player removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

app.put('/api/players/:id/promote', (req, res) => {
  try {
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const idx = RANK_ORDER.indexOf(player.rank);
    if (idx >= RANK_ORDER.length - 1) return res.status(400).json({ error: 'Already at highest rank' });
    const newRank = RANK_ORDER[idx + 1];
    db.prepare('UPDATE players SET rank = ? WHERE id = ?').run(newRank, req.params.id);
    res.json({ ...player, rank: newRank });
  } catch (err) {
    res.status(500).json({ error: 'Failed to promote player' });
  }
});

app.put('/api/players/:id/demote', (req, res) => {
  try {
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    const idx = RANK_ORDER.indexOf(player.rank);
    if (idx <= 0) return res.status(400).json({ error: 'Already at lowest rank' });
    const newRank = RANK_ORDER[idx - 1];
    db.prepare('UPDATE players SET rank = ? WHERE id = ?').run(newRank, req.params.id);
    res.json({ ...player, rank: newRank });
  } catch (err) {
    res.status(500).json({ error: 'Failed to demote player' });
  }
});

// ─────────────────────────────────────────────
// EVENT SCORES
// ─────────────────────────────────────────────

/**
 * GET /api/events
 * Get all distinct event names
 */
app.get('/api/events', (req, res) => {
  try {
    const events = db.prepare(
      'SELECT DISTINCT event_name, MAX(event_date) as latest FROM event_scores GROUP BY event_name ORDER BY latest DESC'
    ).all();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/events/:eventName/scores
 * Get all player scores for a specific event
 */
app.get('/api/events/:eventName/scores', (req, res) => {
  try {
    const { eventName } = req.params;
    const scores = db.prepare(`
      SELECT es.*, p.name, p.rank, p.power, p.status
      FROM event_scores es
      JOIN players p ON es.player_id = p.id
      WHERE es.event_name = ?
      ORDER BY es.event_points DESC
    `).all(decodeURIComponent(eventName));
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event scores' });
  }
});

/**
 * GET /api/players/:id/events
 * Get all event history for a player
 */
app.get('/api/players/:id/events', (req, res) => {
  try {
    const scores = db.prepare(`
      SELECT * FROM event_scores WHERE player_id = ? ORDER BY event_date DESC
    `).all(req.params.id);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch player event history' });
  }
});

/**
 * POST /api/events/score
 * Add or update an event score for a player
 */
app.post('/api/events/score', (req, res) => {
  try {
    const {
      player_id,
      event_name,
      event_date,
      event_points = 0,
      glory_points = 0,
      event_rank = 0,
      quota = 0,
      notes = ''
    } = req.body;

    if (!player_id || !event_name) {
      return res.status(400).json({ error: 'player_id and event_name are required' });
    }

    const date = event_date ? String(event_date).slice(0, 10) : getTodayISO();

    // Check if score already exists for this player+event+date
    const existing = db.prepare(
      'SELECT id FROM event_scores WHERE player_id = ? AND event_name = ? AND event_date = ?'
    ).get(player_id, event_name, date);

    if (existing) {
      db.prepare(`
        UPDATE event_scores SET event_points=?, glory_points=?, event_rank=?, quota=?, notes=?
        WHERE id=?
      `).run(Number(event_points), Number(glory_points), Number(event_rank), Number(quota), notes, existing.id);
    } else {
      db.prepare(`
        INSERT INTO event_scores (player_id, event_name, event_date, event_points, glory_points, event_rank, quota, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(player_id, event_name, date, Number(event_points), Number(glory_points), Number(event_rank), Number(quota), notes);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save event score' });
  }
});

/**
 * DELETE /api/events/score/:id
 */
app.delete('/api/events/score/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM event_scores WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

// ─────────────────────────────────────────────
// CASTLE PASSWORD VAULT
// ─────────────────────────────────────────────

app.get('/api/vault', (req, res) => {
  try {
    const { search } = req.query;
    let accounts;
    if (search && search.trim()) {
      accounts = db.prepare(
        `SELECT * FROM castle_accounts WHERE castle_name LIKE @s OR account_name LIKE @s OR sitter LIKE @s ORDER BY castle_name`
      ).all({ s: `%${search.trim()}%` });
    } else {
      accounts = db.prepare('SELECT * FROM castle_accounts ORDER BY castle_name').all();
    }
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vault' });
  }
});

app.post('/api/vault', (req, res) => {
  try {
    const { castle_name, account_name, password, realm = '', sitter = '', notes = '' } = req.body;
    if (!castle_name || !account_name || !password) {
      return res.status(400).json({ error: 'castle_name, account_name, and password are required' });
    }
    const now = getTodayISO();
    const result = db.prepare(`
      INSERT INTO castle_accounts (castle_name, account_name, password, realm, sitter, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(castle_name.trim(), account_name.trim(), password, realm, sitter, notes, now, now);

    res.status(201).json(db.prepare('SELECT * FROM castle_accounts WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: 'Failed to add vault entry' });
  }
});

app.put('/api/vault/:id', (req, res) => {
  try {
    const { castle_name, account_name, password, realm, sitter, notes } = req.body;
    const existing = db.prepare('SELECT * FROM castle_accounts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    db.prepare(`
      UPDATE castle_accounts SET castle_name=?, account_name=?, password=?, realm=?, sitter=?, notes=?, updated_at=?
      WHERE id=?
    `).run(
      castle_name || existing.castle_name,
      account_name || existing.account_name,
      password || existing.password,
      realm !== undefined ? realm : existing.realm,
      sitter !== undefined ? sitter : existing.sitter,
      notes !== undefined ? notes : existing.notes,
      getTodayISO(),
      req.params.id
    );

    res.json(db.prepare('SELECT * FROM castle_accounts WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vault entry' });
  }
});

app.delete('/api/vault/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM castle_accounts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM castle_accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vault entry' });
  }
});

// ─────────────────────────────────────────────
// SYNC STATUS & AUTO-SYNC ENGINE
// ─────────────────────────────────────────────

let lastSyncTime   = null;
let lastSyncStatus = 'Never synced';
let syncInProgress = false;

/** Returns the GGE Tracker player profile URL */
function ggePlayerUrl(ggePlayerId) {
  return ggePlayerId
    ? `https://gge-tracker.com/player/${ggePlayerId}?server=${GGE_SERVER}`
    : null;
}

/**
 * Core sync: fetch latest member data from GGE Tracker alliance update feed,
 * update existing players' power and last_active in the DB.
 */
async function syncFromGGE() {
  if (syncInProgress) return { skipped: true, reason: 'Sync already running' };
  syncInProgress = true;

  try {
    console.log('🔄 [AutoSync] Fetching GGE Tracker data...');
    const res = await fetch(
      `${GGE_API_BASE}/updates/alliances/${GGE_ALLIANCE_ID}/players`,
      { headers: GGE_HEADERS }
    );
    if (!res.ok) throw new Error(`GGE API ${res.status}`);
    const data = await res.json();
    const updates = data.updates || [];

    // Build latest snapshot per player (most recent update whose new_alliance = us)
    const latestJoined = new Map();
    for (const u of updates) {
      const existing = latestJoined.get(u.player_id);
      if (!existing || new Date(u.created_at) > new Date(existing.created_at)) {
        latestJoined.set(u.player_id, u);
      }
    }

    // Only keep players currently in Dark Lords
    const currentMembers = [...latestJoined.values()].filter(
      u => u.new_alliance_id === GGE_ALLIANCE_ID
    );

    let updated = 0;
    const updateStmt = db.prepare(
      'UPDATE players SET power = ?, last_active = ?, notes = ? WHERE gge_player_id = ?'
    );

    const doUpdates = db.transaction((members) => {
      for (const m of members) {
        const player = db.prepare('SELECT id, notes FROM players WHERE gge_player_id = ?').get(m.player_id);
        if (player) {
          const lastActive = m.created_at ? m.created_at.split('T')[0] : getTodayISO();
          const notes = `Level ${m.level} · Legendary ${m.legendary_level}`;
          updateStmt.run(Number(m.might_current) || 0, lastActive, notes, m.player_id);
          updated++;
        }
      }
    });
    doUpdates(currentMembers);

    lastSyncTime   = new Date().toISOString();
    lastSyncStatus = `OK — updated ${updated} players`;
    console.log(`✅ [AutoSync] ${lastSyncStatus}`);
    return { success: true, updated, total: currentMembers.length, syncedAt: lastSyncTime };
  } catch (err) {
    lastSyncStatus = `Error: ${err.message}`;
    console.error('❌ [AutoSync] Failed:', err.message);
    return { success: false, error: err.message };
  } finally {
    syncInProgress = false;
  }
}

/** GET /api/sync/status — returns last sync time and status */
app.get('/api/sync/status', (req, res) => {
  res.json({
    lastSyncTime,
    lastSyncStatus,
    syncInProgress,
    ggeAllianceId:  GGE_ALLIANCE_ID,
    ggeServer:      GGE_SERVER,
    ggeAllianceUrl: `https://gge-tracker.com/alliance/${GGE_ALLIANCE_ID}?server=${GGE_SERVER}`,
  });
});

/** POST /api/sync/now — trigger a manual sync immediately */
app.post('/api/sync/now', async (req, res) => {
  const result = await syncFromGGE();
  res.json(result);
});

/** GET /api/players/:id/gge-link — return the GGE Tracker URL for a player */
app.get('/api/players/:id/gge-link', (req, res) => {
  const player = db.prepare('SELECT gge_player_id, name FROM players WHERE id = ?').get(req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  const url = ggePlayerUrl(player.gge_player_id);
  res.json({ url, player_name: player.name, gge_player_id: player.gge_player_id });
});

// ── Auto-sync on startup + every 30 minutes ──────────────────
syncFromGGE().then(() => {
  console.log('✅ Initial sync complete');
});

setInterval(() => {
  syncFromGGE();
}, 30 * 60 * 1000); // every 30 minutes

// Serve static client build
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚔️  E4K Alliance Server running on http://localhost:${PORT}`);
  console.log(`🔄 Auto-sync: every 30 minutes from GGE Tracker (E4K_INT2)`);
});
