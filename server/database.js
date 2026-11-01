const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'alliance.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────
db.exec(`
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
`);

// ── Seed Players ────────────────────────────────────────────
const { count: playerCount } = db.prepare('SELECT COUNT(*) as count FROM players').get();
if (playerCount === 0) {
  const players = [
    { name: 'Lord Ironclad',    rank: 'Leader',    power: 3450000, kingdom: 4, last_active: '2026-10-31', contributions: 1250000, notes: 'Alliance founder', joined_date: '2025-01-15', status: 'Active',   gge_player_id: '' },
    { name: 'Valeria_Storm',    rank: 'Co-Leader', power: 2890000, kingdom: 3, last_active: '2026-10-31', contributions: 980000,  notes: 'Event coordinator', joined_date: '2025-02-10', status: 'Active',   gge_player_id: '' },
    { name: 'ShadowStrike',     rank: 'Officer',   power: 2150000, kingdom: 4, last_active: '2026-10-30', contributions: 720000,  notes: 'Scout master', joined_date: '2025-03-01', status: 'Active',   gge_player_id: '' },
    { name: 'KaiserWilhelm',    rank: 'Officer',   power: 1820000, kingdom: 2, last_active: '2026-10-28', contributions: 610000,  notes: 'Handles recruits', joined_date: '2025-04-12', status: 'Active',   gge_player_id: '' },
    { name: 'DragonSlayer99',   rank: 'Member',    power: 1540000, kingdom: 3, last_active: '2026-10-29', contributions: 480000,  notes: 'Siege specialist', joined_date: '2025-05-20', status: 'Active',   gge_player_id: '' },
    { name: 'WolfgangTheBold',  rank: 'Member',    power: 1340000, kingdom: 1, last_active: '2026-10-25', contributions: 390000,  notes: 'Front line defender', joined_date: '2025-06-15', status: 'Active',   gge_player_id: '' },
    { name: 'RavenQueen',       rank: 'Member',    power: 1120000, kingdom: 2, last_active: '2026-10-18', contributions: 280000,  notes: 'Missed 2 war calls', joined_date: '2025-07-01', status: 'Warning',  gge_player_id: '' },
    { name: 'Galahad_Shield',   rank: 'Member',    power: 870000,  kingdom: 1, last_active: '2026-10-10', contributions: 195000,  notes: 'On leave', joined_date: '2025-08-05', status: 'Inactive', gge_player_id: '' },
    { name: 'ViperAssault',     rank: 'Recruit',   power: 540000,  kingdom: 1, last_active: '2026-10-30', contributions: 95000,   notes: 'Promising newcomer', joined_date: '2026-09-10', status: 'Active',   gge_player_id: '' },
    { name: 'NoviceRoland',     rank: 'Recruit',   power: 310000,  kingdom: 1, last_active: '2026-09-28', contributions: 12000,   notes: 'Inactive 1 month', joined_date: '2026-09-15', status: 'Kicked',   gge_player_id: '' },
  ];
  const ins = db.prepare(`INSERT INTO players (name,rank,power,kingdom,last_active,contributions,notes,joined_date,status,gge_player_id) VALUES (@name,@rank,@power,@kingdom,@last_active,@contributions,@notes,@joined_date,@status,@gge_player_id)`);
  db.transaction((rows) => rows.forEach(r => ins.run(r)))(players);
  console.log('✅ Seeded 10 sample players');
}

// ── Seed Vault ──────────────────────────────────────────────
const { count: vaultCount } = db.prepare('SELECT COUNT(*) as count FROM castle_accounts').get();
if (vaultCount === 0) {
  const vault = [
    { castle_name: 'Iron Bastion Central', account_name: 'Ironclad_WarAlt01', password: 'k9#Vp!8$Zq@2mX', realm: 'Kingdom 4: Fire Peaks',      sitter: 'Valeria_Storm',  notes: '28k Heavy Royal Veterans. Primary catapult siege alt.', created_at: '2026-10-01', updated_at: '2026-10-30' },
    { castle_name: 'Winterfall Fortress',  account_name: 'Valeria_Garrison9',  password: 'W7*xL9&dP2#kQ8', realm: 'Kingdom 2: Everwinter',      sitter: 'ShadowStrike',   notes: 'Food hub. Keep 120k bread before Friday war.',          created_at: '2026-10-05', updated_at: '2026-10-29' },
    { castle_name: 'Sandstorm Citadel',    account_name: 'DesertVanguard_X',   password: 'b4$Tn!9#Yw@7rK', realm: 'Kingdom 3: Burning Sands',   sitter: 'Lord Ironclad',  notes: 'Scouting & sabotage outpost. Fast cavalry equipped.',   created_at: '2026-10-10', updated_at: '2026-10-31' },
    { castle_name: 'Dragon Nest Peak',     account_name: 'Dragon_Sitter44',    password: 'p3^Qx#8$Wm!2zL', realm: 'Kingdom 3: Burning Sands',   sitter: 'DragonSlayer99', notes: '35k rubies stockpile. Do not spend without Co-Leader.', created_at: '2026-10-12', updated_at: '2026-10-28' },
    { castle_name: 'Eagle Watch Redoubt',  account_name: 'EagleShield_Alt',    password: 'c8@Mj!3$Nk#9sT', realm: 'Kingdom 1: Great Empire',    sitter: 'WolfgangTheBold',notes: 'Reserve castle holding frontline defensive shields.',   created_at: '2026-10-15', updated_at: '2026-10-25' },
  ];
  const ins = db.prepare(`INSERT INTO castle_accounts (castle_name,account_name,password,realm,sitter,notes,created_at,updated_at) VALUES (@castle_name,@account_name,@password,@realm,@sitter,@notes,@created_at,@updated_at)`);
  db.transaction((rows) => rows.forEach(r => ins.run(r)))(vault);
  console.log('✅ Seeded 5 vault entries');
}

// ── Seed Event Scores ────────────────────────────────────────
const { count: evCount } = db.prepare('SELECT COUNT(*) as count FROM event_scores').get();
if (evCount === 0) {
  const allPlayers = db.prepare('SELECT id, name FROM players').all();
  const eventName = 'War of the Realms';
  const eventDate = '2026-10-26';

  const scoreMap = {
    'Lord Ironclad':   { points: 2850000, glory: 490000, rank: 1,  quota: 500000 },
    'Valeria_Storm':   { points: 2420000, glory: 410000, rank: 2,  quota: 500000 },
    'ShadowStrike':    { points: 1980000, glory: 340000, rank: 3,  quota: 500000 },
    'DragonSlayer99':  { points: 1720000, glory: 310000, rank: 4,  quota: 500000 },
    'KaiserWilhelm':   { points: 1450000, glory: 250000, rank: 5,  quota: 500000 },
    'WolfgangTheBold': { points: 1120000, glory: 190000, rank: 6,  quota: 500000 },
    'ViperAssault':    { points: 950000,  glory: 160000, rank: 7,  quota: 500000 },
    'RavenQueen':      { points: 320000,  glory: 45000,  rank: 8,  quota: 500000 },
    'Galahad_Shield':  { points: 180000,  glory: 20000,  rank: 9,  quota: 500000 },
    'NoviceRoland':    { points: 0,       glory: 0,      rank: 10, quota: 500000 },
  };

  const ins = db.prepare(`INSERT INTO event_scores (player_id,event_name,event_date,event_points,glory_points,event_rank,quota,notes) VALUES (?,?,?,?,?,?,?,?)`);
  db.transaction(() => {
    for (const p of allPlayers) {
      const s = scoreMap[p.name] || { points: 0, glory: 0, rank: 99, quota: 500000 };
      ins.run(p.id, eventName, eventDate, s.points, s.glory, s.rank, s.quota, '');
    }
  })();
  console.log('✅ Seeded event scores');
}

module.exports = db;
