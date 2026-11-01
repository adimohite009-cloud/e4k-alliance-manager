CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rank TEXT DEFAULT 'Member',
  power INTEGER DEFAULT 0,
  kingdom INTEGER DEFAULT 1,
  last_active TEXT DEFAULT '',
  contributions INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  joined_date TEXT DEFAULT '',
  status TEXT DEFAULT 'Active',
  gge_player_id TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS castle_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  castle_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  password TEXT NOT NULL,
  realm TEXT DEFAULT '',
  sitter TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS event_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_points INTEGER DEFAULT 0,
  glory_points INTEGER DEFAULT 0,
  event_rank INTEGER DEFAULT 0,
  quota INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_sync_time TEXT,
  last_sync_status TEXT NOT NULL DEFAULT 'Never synced'
);
CREATE INDEX IF NOT EXISTS idx_players_gge_player_id ON players(gge_player_id);
CREATE INDEX IF NOT EXISTS idx_event_scores_event_name ON event_scores(event_name);
