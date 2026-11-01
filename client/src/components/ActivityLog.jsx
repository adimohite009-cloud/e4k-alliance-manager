import React, { useCallback, useEffect, useState } from 'react';
import './ActivityLog.css';

const entityLabel = type => ({ player: 'Roster', score: 'Event score', vault: 'Vault' }[type] || type);

export default function ActivityLog({ showToast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/activity?limit=100');
      if (!response.ok) throw new Error('Could not load activity history');
      setEntries(await response.json());
    } catch (error) {
      showToast(error.message || 'Could not load activity history', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const undo = async entry => {
    if (!window.confirm('Undo this change? The action will be recorded in the history.')) return;
    setBusyId(entry.id);
    try {
      const response = await fetch(`/api/activity/${entry.id}/undo`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not undo this change');
      showToast('Change undone');
      await load();
    } catch (error) {
      showToast(error.message || 'Undo failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="activity-page">
      <div className="page-header">
        <div>
          <div className="page-title">🕘 Activity History</div>
          <div className="page-subtitle">Recent roster, event-score, and vault changes. The latest 100 actions are shown.</div>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>↻ Refresh</button>
      </div>

      <div className="activity-note">
        Changes are recorded from the time this feature goes live. The shared password doesn’t identify which member made a change.
        Vault password values are never kept in the history.
      </div>

      {loading ? <div className="loading-wrap"><div className="loading-spinner" /></div> : entries.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🗒️</div><p>No changes recorded yet.</p></div>
      ) : (
        <div className="activity-list">
          {entries.map(entry => {
            const canUndo = Boolean(entry.is_undoable) && !entry.undone_at && entry.action !== 'undo';
            return (
              <article className="activity-item" key={entry.id}>
                <div className="activity-mark" aria-hidden="true">{entry.action === 'deleted' ? '🗑️' : entry.action === 'undo' ? '↶' : '✎'}</div>
                <div className="activity-copy">
                  <div className="activity-meta">
                    <span className="activity-type">{entityLabel(entry.entity_type)}</span>
                    <time dateTime={entry.occurred_at}>{new Date(entry.occurred_at).toLocaleString()}</time>
                  </div>
                  <p>{entry.description}</p>
                  {entry.undone_at && <span className="activity-undone">Undone</span>}
                </div>
                {canUndo && (
                  <button className="btn btn-ghost btn-sm activity-undo" onClick={() => undo(entry)} disabled={busyId === entry.id}>
                    {busyId === entry.id ? 'Undoing…' : '↶ Undo'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
