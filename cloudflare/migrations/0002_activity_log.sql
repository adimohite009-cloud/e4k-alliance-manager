ALTER TABLE castle_accounts ADD COLUMN deleted_at TEXT;

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  undone_at TEXT,
  is_undoable INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_activity_log_occurred_at ON activity_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type,entity_id,id DESC);
