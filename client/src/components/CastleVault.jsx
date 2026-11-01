import React, { useState, useEffect, useCallback } from 'react';
import './CastleVault.css';

const today = () => new Date().toISOString().split('T')[0];

// ── Vault Modal ───────────────────────────────────────────────
function VaultModal({ account, onClose, onSave, showToast }) {
  const isEdit = !!account?.id;
  const [form, setForm] = useState({
    castle_name: '', account_name: '', password: '',
    realm: '', sitter: '', notes: '',
    ...account
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.castle_name.trim() || !form.account_name.trim() || !form.password) {
      showToast('Castle name, account name and password are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/vault/${account.id}` : '/api/vault';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = await res.json();
      onSave(saved);
      showToast(isEdit ? 'Account updated!' : 'Account added!');
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
          <h2>{isEdit ? '✏️ Edit Castle Account' : '➕ Add Castle Account'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Castle Name *</label>
            <input className="form-input" value={form.castle_name} onChange={e => set('castle_name', e.target.value)} placeholder="e.g. Iron Bastion Central" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Account Name / Username *</label>
              <input className="form-input" value={form.account_name} onChange={e => set('account_name', e.target.value)} placeholder="e.g. Ironclad_WarAlt01" />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input className="form-input" type="text" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Enter password" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Realm / Kingdom</label>
              <input className="form-input" value={form.realm} onChange={e => set('realm', e.target.value)} placeholder="e.g. Kingdom 4: Fire Peaks" />
            </div>
            <div className="form-group">
              <label>Assigned Sitter</label>
              <input className="form-input" value={form.sitter} onChange={e => set('sitter', e.target.value)} placeholder="Who is sitting this castle?" />
            </div>
          </div>
          <div className="form-group">
            <label>Notes / Instructions</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Defence instructions, food reserves, special notes…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Account')}
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
          <h3>Delete Account?</h3>
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

// ── Vault Card ─────────────────────────────────────────────────
function VaultCard({ account, onEdit, onDelete, showToast }) {
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState('');

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      showToast(`${label} copied to clipboard!`);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      showToast('Copy failed — try manually', 'error');
    }
  };

  return (
    <div className="vault-card">
      <div className="vault-card-header">
        <div className="vault-castle-name">🏰 {account.castle_name}</div>
        <div className="vault-card-actions">
          <button className="btn-icon" title="Edit" onClick={() => onEdit(account)}>✏️</button>
          <button className="btn-icon" title="Delete" onClick={() => onDelete(account)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>🗑️</button>
        </div>
      </div>

      {account.realm && (
        <div className="vault-meta">📍 {account.realm}</div>
      )}

      <div className="vault-field">
        <span className="vault-field-label">Account</span>
        <div className="vault-field-row">
          <span className="vault-field-value">{account.account_name}</span>
          <button
            className={`btn btn-sm ${copied === 'Username' ? 'btn-teal' : 'btn-ghost'}`}
            onClick={() => copy(account.account_name, 'Username')}
          >
            {copied === 'Username' ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div className="vault-field">
        <span className="vault-field-label">Password</span>
        <div className="vault-field-row">
          <span className="vault-field-value vault-password">
            {showPw ? account.password : '•'.repeat(Math.min(account.password.length, 16))}
          </span>
          <button className="btn-icon" onClick={() => setShowPw(v => !v)} title={showPw ? 'Hide' : 'Show'}>
            {showPw ? '🙈' : '👁️'}
          </button>
          <button
            className={`btn btn-sm ${copied === 'Password' ? 'btn-teal' : 'btn-primary'}`}
            onClick={() => copy(account.password, 'Password')}
          >
            {copied === 'Password' ? '✓ Copied!' : '📋 Copy Password'}
          </button>
        </div>
      </div>

      {account.sitter && (
        <div className="vault-field">
          <span className="vault-field-label">Sitter</span>
          <span className="vault-field-value" style={{ color: 'var(--teal)' }}>👤 {account.sitter}</span>
        </div>
      )}

      {account.notes && (
        <div className="vault-notes">📝 {account.notes}</div>
      )}

      <div className="vault-updated">Updated: {account.updated_at || account.created_at}</div>
    </div>
  );
}

// ── Main Vault Component ───────────────────────────────────────
export default function CastleVault({ showToast }) {
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/vault${params}`);
      setAccounts(await res.json());
    } catch { showToast('Failed to load vault', 'error'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved) => {
    setAccounts(prev => {
      const idx = prev.findIndex(a => a.id === saved.id);
      return idx >= 0 ? prev.map(a => a.id === saved.id ? saved : a) : [saved, ...prev];
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/vault/${deleteTarget.id}`, { method: 'DELETE' });
      setAccounts(prev => prev.filter(a => a.id !== deleteTarget.id));
      showToast(`"${deleteTarget.castle_name}" removed from vault`);
    } catch { showToast('Delete failed', 'error'); }
    finally { setDeleteTarget(null); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🔐 Password Vault</div>
          <div className="page-subtitle">Secure storage for alt castle accounts & sitter credentials</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditAccount(null); setModalOpen(true); }}>
          + Add Castle Account
        </button>
      </div>

      {/* Warning banner */}
      <div className="vault-warning">
        ⚠️ <strong>Keep this tab private.</strong> This vault is shared with alliance members who enter the shared password. Only share it with trusted members.
      </div>

      {/* Search */}
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="search-wrap" style={{ maxWidth: 400 }}>
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search by castle, account, or sitter…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="loading-wrap"><div className="loading-spinner" /></div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔐</div>
          <p>No accounts in vault. Add one with the button above.</p>
        </div>
      ) : (
        <div className="vault-grid">
          {accounts.map(a => (
            <VaultCard
              key={a.id}
              account={a}
              onEdit={(acc) => { setEditAccount(acc); setModalOpen(true); }}
              onDelete={setDeleteTarget}
              showToast={showToast}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <VaultModal
          account={editAccount}
          onClose={() => { setModalOpen(false); setEditAccount(null); }}
          onSave={handleSaved}
          showToast={showToast}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          message={`Remove "${deleteTarget.castle_name}" (${deleteTarget.account_name}) from the vault?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
