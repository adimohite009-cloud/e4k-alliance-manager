import React, { useState, useEffect, useCallback } from 'react';

const fmt = (n) => Number(n || 0).toLocaleString();
const today = () => new Date().toISOString().split('T')[0];

// ── Score Modal ───────────────────────────────────────────────
function ScoreModal({ players, editScore, onClose, onSave, showToast }) {
  const isEdit = !!editScore?.id;
  const [form, setForm] = useState(() => {
    const base = {
      player_id: '',
      event_name: '',
      event_date: today(),
      event_points: '',
      glory_points: '',
      event_rank: '',
      quota: '',
      notes: '',
    };
    if (editScore) Object.assign(base, editScore);
    base.player_id = editScore?.player_id ?? '';
    return base;
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.player_id || !form.event_name.trim()) {
      showToast('Player and event name are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/events/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          player_id: Number(form.player_id),
          event_points: Number(form.event_points) || 0,
          glory_points: Number(form.glory_points) || 0,
          event_rank: Number(form.event_rank) || 0,
          quota: Number(form.quota) || 0,
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSave();
      showToast('Score saved!');
      onClose();
    } catch (e) {
      showToast(e.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isEdit ? '✏️ Edit Score' : '➕ Log Event Score'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Player *</label>
            <select className="form-select" value={form.player_id} onChange={e => set('player_id', e.target.value)}>
              <option value="">— Select player —</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.rank})</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Event Name *</label>
              <input className="form-input" value={form.event_name} onChange={e => set('event_name', e.target.value)} placeholder="e.g. War of the Realms" list="event-suggestions" />
              <datalist id="event-suggestions">
                <option value="War of the Realms" />
                <option value="Nomads" />
                <option value="Khan's Revenge" />
                <option value="Bloodcrow Invasion" />
                <option value="Samurai Invasion" />
                <option value="Grand Tournament" />
              </datalist>
            </div>
            <div className="form-group">
              <label>Event Date</label>
              <input className="form-input" type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Event Points / Score</label>
              <input className="form-input" type="number" value={form.event_points} onChange={e => set('event_points', e.target.value)} placeholder="e.g. 1500000" />
            </div>
            <div className="form-group">
              <label>Glory Points</label>
              <input className="form-input" type="number" value={form.glory_points} onChange={e => set('glory_points', e.target.value)} placeholder="e.g. 250000" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Event Rank (leaderboard position)</label>
              <input className="form-input" type="number" value={form.event_rank} onChange={e => set('event_rank', e.target.value)} placeholder="e.g. 1" min="0" />
            </div>
            <div className="form-group">
              <label>Quota / Target Points</label>
              <input className="form-input" type="number" value={form.quota} onChange={e => set('quota', e.target.value)} placeholder="e.g. 500000" />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes for this event..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Score'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete ─────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal confirm-modal">
        <div className="confirm-body">
          <div className="confirm-icon">⚠️</div>
          <h3>Delete Score?</h3>
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

// ── Main Event Scores Component ────────────────────────────────
export default function EventScores({ showToast }) {
  const [players, setPlayers]        = useState([]);
  const [events, setEvents]          = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [scores, setScores]          = useState([]);
  const [loading, setLoading]        = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [editScore, setEditScore]    = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Load players + event list on mount
  useEffect(() => {
    fetch('/api/players?sortBy=name&sortOrder=asc').then(r => r.json()).then(setPlayers).catch(() => {});
    fetch('/api/events').then(r => r.json()).then(data => {
      setEvents(data);
      if (data.length > 0) setSelectedEvent(data[0].event_name);
    }).catch(() => {});
  }, []);

  // Load scores when event changes
  const loadScores = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(selectedEvent)}/scores`);
      setScores(await res.json());
    } catch { showToast('Failed to load scores', 'error'); }
    finally { setLoading(false); }
  }, [selectedEvent]);

  useEffect(() => { loadScores(); }, [loadScores]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/events/score/${deleteTarget.id}`, { method: 'DELETE' });
      setScores(prev => prev.filter(s => s.id !== deleteTarget.id));
      showToast('Score deleted');
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleteTarget(null); }
  };

  // Quota progress
  const quotaBar = (points, quota) => {
    if (!quota) return null;
    const pct = Math.min(100, Math.round((points / quota) * 100));
    const color = pct >= 100 ? '#4ade80' : pct >= 75 ? '#facc15' : '#f87171';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, minWidth: 60 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontSize: '0.75rem', color, fontWeight: 700, whiteSpace: 'nowrap' }}>{pct}%</span>
      </div>
    );
  };

  const medalFor = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank > 0 ? `#${rank}` : '—';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📊 Event Scores</div>
          <div className="page-subtitle">Track event performance, glory points & leaderboard ranks</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditScore(null); setScoreModalOpen(true); }}>
          + Log Score
        </button>
      </div>

      {/* Event Selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Event:
          </label>
          <select
            className="form-select"
            style={{ width: 280 }}
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
          >
            {events.length === 0 && <option value="">No events yet</option>}
            {events.map(ev => (
              <option key={ev.event_name} value={ev.event_name}>{ev.event_name}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setEditScore(null); setScoreModalOpen(true); }}>
            + New Event
          </button>
        </div>
      </div>

      {/* Scores Table */}
      <div className="card">
        {loading ? (
          <div className="loading-wrap"><div className="loading-spinner" /></div>
        ) : scores.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No scores logged for this event yet. Click "+ Log Score" to add one.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Alliance Rank</th>
                  <th>Event Points</th>
                  <th>Quota Progress</th>
                  <th>Glory Points</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700, fontSize: '1rem', textAlign: 'center' }}>
                      {medalFor(s.event_rank || (i + 1))}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{s.name}</td>
                    <td>
                      {(() => {
                        const map = { Leader: 'leader', 'Co-Leader': 'coleader', Officer: 'officer', Member: 'member', Recruit: 'recruit' };
                        return <span className={`badge badge-${map[s.rank] || 'recruit'}`}>{s.rank}</span>;
                      })()}
                    </td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 700 }}>
                      {fmt(s.event_points)}
                    </td>
                    <td style={{ minWidth: 140 }}>{quotaBar(s.event_points, s.quota)}</td>
                    <td style={{ color: 'var(--teal)' }}>{fmt(s.glory_points)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{s.event_date}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 150 }}>
                      <span title={s.notes}>{s.notes ? s.notes.slice(0, 40) + (s.notes.length > 40 ? '…' : '') : '—'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" title="Edit" onClick={() => { setEditScore(s); setScoreModalOpen(true); }}>✏️</button>
                        <button className="btn-icon" title="Delete" onClick={() => setDeleteTarget(s)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {scores.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 16 }}>
          {[
            { label: 'Total Event Points', value: fmt(scores.reduce((a, s) => a + (s.event_points || 0), 0)), color: 'var(--gold)' },
            { label: 'Total Glory', value: fmt(scores.reduce((a, s) => a + (s.glory_points || 0), 0)), color: 'var(--teal)' },
            { label: 'Players Scored', value: scores.length, color: 'var(--text)' },
            { label: 'Met Quota', value: scores.filter(s => s.quota && s.event_points >= s.quota).length, color: '#4ade80' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {scoreModalOpen && (
        <ScoreModal
          players={players}
          editScore={editScore}
          onClose={() => { setScoreModalOpen(false); setEditScore(null); }}
          onSave={loadScores}
          showToast={showToast}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          message={`Delete score entry for "${deleteTarget.name}" in "${selectedEvent}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
