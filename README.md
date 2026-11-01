# ⚔️ E4K Alliance Management Hub

A focused admin dashboard for managing your Empire Four Kingdoms alliance — built with React + Node.js + SQLite.

---

## 🚀 How to Run

### Step 1 — Start the Backend (Port 3001)
Open a terminal:
```powershell
cd "C:\Users\Aditya Mohite\.gemini\antigravity\scratch\e4k-alliance-tracker\server"
npm.cmd start
```

### Step 2 — Start the Frontend (Port 5173)
Open a **second** terminal:
```powershell
cd "C:\Users\Aditya Mohite\.gemini\antigravity\scratch\e4k-alliance-tracker\client"
npm.cmd run dev
```

### Step 3 — Open in Browser
👉 **http://localhost:5173**

---

## 📋 Features

### 👥 Alliance Roster
- Add, edit, delete players
- Promote / Demote (Recruit → Member → Officer → Co-Leader → Leader)
- Track: Power/Might, Kingdom, Last Active, Contributions, Status, GGE Player ID
- Search by name · Filter by Rank & Status · Sort any column
- **🔄 Live GGE Tracker sync** — fetches real data from `https://api.gge-tracker.com/api/v1/alliances/18696186`

### 📊 Event Scores
- Log scores per player per event (War of the Realms, Nomads, Bloodcrow, etc.)
- Tracks: Event Points, Glory Points, Leaderboard Rank, Quota progress
- Visual progress bar showing % of quota met
- 🥇🥈🥉 medal icons for top 3
- Summary stats: total points, total glory, players who met quota
- Edit or delete any score entry

### 🔐 Password Vault
- Secure card-based layout for alt castle accounts
- Store: Castle Name, Account/Username, Password, Realm, Sitter, Notes
- 👁️ Show/hide password toggle
- 📋 1-click copy username or password to clipboard
- Search by castle name, account, or sitter name
- Add / Edit / Delete entries with confirmation

---

## 🛠️ Tech Stack
| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | SQLite via better-sqlite3 |
| Styling | Custom CSS (dark military theme) |
| Fonts | Rajdhani (Google Fonts) |

---

## 📁 Project Structure
```
e4k-alliance-tracker/
├── server/
│   ├── server.js        ← Express API server (port 3001)
│   ├── database.js      ← SQLite schema + seed data
│   ├── alliance.db      ← SQLite database file (auto-created)
│   └── package.json
└── client/
    ├── src/
    │   ├── App.jsx              ← Root component + routing
    │   ├── App.css              ← Layout + shared styles
    │   ├── index.css            ← CSS variables + global reset
    │   └── components/
    │       ├── Sidebar.jsx/css  ← Navigation sidebar
    │       ├── PlayerRoster.jsx ← Players view + GGE sync
    │       ├── EventScores.jsx  ← Event scoring view
    │       └── CastleVault.jsx/css ← Password vault view
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🌐 API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/players` | List all players (search, filter, sort) |
| POST | `/api/players` | Add new player |
| PUT | `/api/players/:id` | Update player |
| DELETE | `/api/players/:id` | Remove player |
| PUT | `/api/players/:id/promote` | Promote rank |
| PUT | `/api/players/:id/demote` | Demote rank |
| GET | `/api/events` | List all event names |
| GET | `/api/events/:name/scores` | Get scores for an event |
| POST | `/api/events/score` | Add/update a score |
| DELETE | `/api/events/score/:id` | Delete a score |
| GET | `/api/vault` | List vault entries |
| POST | `/api/vault` | Add vault entry |
| PUT | `/api/vault/:id` | Update vault entry |
| DELETE | `/api/vault/:id` | Delete vault entry |
| GET | `/api/gge/alliance/:id` | Proxy: GGE Tracker alliance data |
| GET | `/api/gge/alliance/:id/members` | Proxy: GGE Tracker member list |

---

## 🎨 Theme Colors
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0c10` | Page background |
| `--card-bg` | `#12151c` | Card/panel background |
| `--gold` | `#c8a84b` | Primary accent |
| `--teal` | `#4a7c6f` | Secondary accent |
| `--danger` | `#c0392b` | Delete/danger actions |
| `--text` | `#e8e4d9` | Primary text |
| `--border` | `#2a2d35` | Borders |
