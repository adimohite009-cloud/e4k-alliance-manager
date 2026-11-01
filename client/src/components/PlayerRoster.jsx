import React, { useState, useEffect, useCallback } from 'react';

const RANKS      = ['Recruit', 'Member', 'Officer', 'Co-Leader', 'Leader'];
const STATUSES   = ['Active', 'Inactive', 'Warning', 'Kicked'];
const RANK_ORDER = ['Recruit', 'Member', 'Officer', 'Co-Leader', 'Leader'];
const GGE_ALLIANCE_ID = '18696186';
const GGE_SERVER      = 'E4K_INT2';

const fmt   = (n) => Number(n || 0).toLocaleString();
const today = () => new Date().toISOString().split('T')[0];

const ggePlayerUrl = (id) =>
  id ? `https://gge-tracker.com/player/${id}?server=${GGE_SERVER}` : null;

function rankBadge(rank) {
  const map = { Leader: 'leader', 'Co-Leader': 'coleader', Officer: 'officer', Member: 'member', Recruit: 'recruit' };
  return <span className={`badge badge-${map[rank] || 'recruit'}`}>{rank}</span>;
}
function statusBadge(status) {
  const map = { Active: 'active', Inactive: 'inactive', Warning: 'warning', Kicked: 'kicked' };
  return <span className={`badge badge-${map[status] || 'inactive'}`}>{status}</span>;
}

// ── Sync Status Bar ──────────────────────────────────────────────────────────
function SyncStatusBar({ onSynced, showToast }) {
  const [status, setStatus]   = useState(null);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/sync/status');
      setStatus(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 60000); // refresh status label every 60s
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r   = await fetch('/api/sync/now', { method: 'POST' });
      const res = await r.json();
      if (res.success) {
        showToast(`✅ Synced! Updated ${res.updated} players from GGE Tracker`);
        onSynced && onSynced();
      } else if (res.skipped) {
        showToast('Sync already running — please wait', 'info');
      } else {
        showToast('Sync failed: ' + (res.error || 'unknown'), 'error');
      }
      fetchStatus();
    } catch {
      showToast('Could not reach server', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
           ' · ' + d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  const isOK = status?.lastSyncStatus?.startsWith('OK');

  return (
    <div className="card" style={{ marginBottom: 16, padding: '12px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.9rem' }}>🔄 Auto-Sync</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 6 }}>every 30 min from GGE Tracker</span>
          </div>
          <div style={{ fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Last sync: </span>
            <span style={{ color: status?.lastSyncTime ? '#4ade80' : 'var(--text-muted)', fontWeight: 600 }}>
              {fmtTime(status?.lastSyncTime)}
            </span>
          </div>
          {status?.lastSyncStatus && (
            <div style={{ fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status: </span>
              <span style={{ color: isOK ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                {status.lastSyncStatus}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a
            href={`https://gge-tracker.com/alliance/${GGE_ALLIANCE_ID}?server=${GGE_SERVER}`}
            target="_blank" rel="noreferrer"
            style={{ fontSize: '0.8rem', color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }}
          >
            🌐 View Alliance on GGE Tracker ↗
          </a>
          <button className="btn btn-teal btn-sm" onClick={handleSync} disabled={syncing}>
            {syncing ? '⏳ Syncing…' : '⚡ Sync Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Player Modal ─────────────────────────────────────────────────────────────
function PlayerModal({ player, onClose, onSave, showToast }) {
  const isEdit = !!player?.id;
  const [form, setForm] = useState({
    name: '', rank: 'Member', power: '', kingdom: '1',
    last_active: today(), contributions: '', notes: '',
    joined_date: today(), status: 'Active', gge_player_id: '',
    ...player
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Player name is required', 'error'); return; }
    setSaving(true);
    try {
      const method = isEdit ? 'PUT' : 'POST';
      const url    = isEdit ? `/api/players/${player.id}` : '/api/players';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          power:         Number(form.power) || 0,
          kingdom:       Number(form.kingdom) || 1,
          contributions: Number(form.contributions) || 0,
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = await res.json();
      onSave(saved);
      showToast(isEdit ? 'Player updated!' : 'Player added!');
      onClose();
    } catch (e) {
      showToast(e.message || 'Failed to save player', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isEdit ? '✏️ Edit Player' : '➕ Add Player'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Player Name *</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Lord Ironclad" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rank</label>
              <select className="form-select" value={form.rank} onChange={e => set('rank', e.target.value)}>
                {RANKS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Power / Might</label>
              <input className="form-input" type="number" value={form.power} onChange={e => set('power', e.target.value)} placeholder="e.g. 150000000" />
            </div>
            <div className="form-group">
              <label>Kingdom</label>
              <input className="form-input" type="number" value={form.kingdom} onChange={e => set('kingdom', e.target.value)} min="1" max="4" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Last Active</label>
              <input className="form-input" type="date" value={form.last_active} onChange={e => set('last_active', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Joined Date</label>
              <input className="form-input" type="date" value={form.joined_date} onChange={e => set('joined_date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Contributions (Rubies/Gold)</label>
            <input className="form-input" type="number" value={form.contributions} onChange={e => set('contributions', e.target.value)} placeholder="e.g. 500000" />
          </div>
          <div className="form-group">
            <label>GGE Tracker Player ID</label>
            <input className="form-input" value={form.gge_player_id} onChange={e => set('gge_player_id', e.target.value)} placeholder="e.g. 1713457186" />
            {form.gge_player_id && (
              <div style={{ marginTop: 6, fontSize: '0.78rem' }}>
                <a href={ggePlayerUrl(form.gge_player_id)} target="_blank" rel="noreferrer"
                   style={{ color: 'var(--teal)' }}>
                  🔗 Preview GGE Tracker link ↗
                </a>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this player..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Player'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete ────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal confirm-modal">
        <div className="confirm-body">
          <div className="confirm-icon">⚠️</div>
          <h3>Are you sure?</h3>
          <p>{message}</p>
        </div>
        <div className="confirm-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Roster ───────────────────────────────────────────────────────────────
export default function PlayerRoster({ showToast }) {
  const [players, setPlayers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterRank, setFilterRank]     = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy]             = useState('power');
  const [sortOrder, setSortOrder]       = useState('desc');
  const [modalOpen, setModalOpen]       = useState(false);
  const [editPlayer, setEditPlayer]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ sortBy, sortOrder });
      if (search) params.set('search', search);
      if (filterRank   !== 'All') params.set('rank',   filterRank);
      if (filterStatus !== 'All') params.set('status', filterStatus);
      const res = await fetch(`/api/players?${params}`);
      setPlayers(await res.json());
    } catch {
      showToast('Failed to load players', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, filterRank, filterStatus, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh player data every 5 minutes (picks up backend auto-sync)
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const handleSort = (col) => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('desc'); }
  };

  const handleSaved = (saved) => {
    setPlayers(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev];
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/players/${deleteTarget.id}`, { method: 'DELETE' });
      setPlayers(prev => prev.filter(p => p.id !== deleteTarget.id));
      showToast(`${deleteTarget.name} removed`);
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleteTarget(null); }
  };

  const handlePromote = async (p) => {
    const idx = RANK_ORDER.indexOf(p.rank);
    if (idx >= RANK_ORDER.length - 1) { showToast('Already at highest rank', 'error'); return; }
    const res     = await fetch(`/api/players/${p.id}/promote`, { method: 'PUT' });
    const updated = await res.json();
    setPlayers(prev => prev.map(pl => pl.id === p.id ? updated : pl));
    showToast(`${p.name} promoted to ${updated.rank}! 🎉`);
  };

  const handleDemote = async (p) => {
    const idx = RANK_ORDER.indexOf(p.rank);
    if (idx <= 0) { showToast('Already at lowest rank', 'error'); return; }
    const res     = await fetch(`/api/players/${p.id}/demote`, { method: 'PUT' });
    const updated = await res.json();
    setPlayers(prev => prev.map(pl => pl.id === p.id ? updated : pl));
    showToast(`${p.name} demoted to ${updated.rank}`);
  };

  const SortArrow = ({ col }) => sortBy === col
    ? <span style={{ color: 'var(--gold)' }}>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
    : null;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">👥 Alliance Roster</div>
          <div className="page-subtitle">
            {players.length} players · Power updates automatically from GGE Tracker every 30 min
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditPlayer(null); setModalOpen(true); }}>
          + Add Player
        </button>
      </div>

      {/* Auto-Sync Bar */}
      <SyncStatusBar showToast={showToast} onSynced={load} />

      {/* Search + Filter Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ width: 130 }} value={filterRank} onChange={e => setFilterRank(e.target.value)}>
          <option value="All">All Ranks</option>
          {RANKS.map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="form-select" style={{ width: 130 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Player Table */}
      <div className="card">
        {loading ? (
          <div className="loading-wrap"><div className="loading-spinner" /></div>
        ) : players.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏰</div>
            <p>No players found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="sortable" onClick={() => handleSort('name')}>Name <SortArrow col="name" /></th>
                  <th className="sortable" onClick={() => handleSort('rank')}>Rank <SortArrow col="rank" /></th>
                  <th className="sortable" onClick={() => handleSort('power')}>Power <SortArrow col="power" /></th>
                  <th className="sortable" onClick={() => handleSort('last_active')}>Last Active <SortArrow col="last_active" /></th>
                  <th className="sortable" onClick={() => handleSort('contributions')}>Contributions <SortArrow col="contributions" /></th>
                  <th>Status</th>
                  <th>GGE Profile</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: 36 }}>{i + 1}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text)', minWidth: 120 }}>{p.name}</td>
                    <td>{rankBadge(p.rank)}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {fmt(p.power)}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {p.last_active || '—'}
                    </td>
                    <td style={{ color: 'var(--teal)', whiteSpace: 'nowrap' }}>
                      {p.contributions > 0 ? fmt(p.contributions) : '—'}
                    </td>
                    <td>{statusBadge(p.status)}</td>
                    <td>
                      {p.gge_player_id ? (
                        <a
                          href={ggePlayerUrl(p.gge_player_id)}
                          target="_blank"
                          rel="noreferrer"
                          title={`View ${p.name} on GGE Tracker`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'var(--teal)',
                            textDecoration: 'none',
                            padding: '4px 8px',
                            border: '1px solid var(--teal)',
                            borderRadius: 5,
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => { e.target.style.background = 'rgba(74,124,111,0.15)'; e.target.style.color = '#fff'; }}
                          onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--teal)'; }}
                        >
                          🔗 Profile ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--border)', fontSize: '0.75rem' }}>No ID</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button className="btn-icon" title="Edit"    onClick={() => { setEditPlayer(p); setModalOpen(true); }}>✏️</button>
                        <button className="btn-icon" title="Promote" onClick={() => handlePromote(p)}>⬆️</button>
                        <button className="btn-icon" title="Demote"  onClick={() => handleDemote(p)}>⬇️</button>
                        <button
                          className="btn-icon"
                          title="Delete"
                          onClick={() => setDeleteTarget(p)}
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {modalOpen && (
        <PlayerModal
          player={editPlayer}
          onClose={() => { setModalOpen(false); setEditPlayer(null); }}
          onSave={handleSaved}
          showToast={showToast}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          message={`Remove "${deleteTarget.name}" from the alliance? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
