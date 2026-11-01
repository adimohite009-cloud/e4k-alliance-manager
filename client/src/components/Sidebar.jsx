import React from 'react';
import './Sidebar.css';

const NAV = [
  { id: 'roster', icon: '👥', label: 'Alliance Roster' },
  { id: 'events', icon: '📊', label: 'Event Scores' },
  { id: 'vault',  icon: '🔐', label: 'Password Vault' },
];

export default function Sidebar({ currentView, onNavigate, isOpen }) {
  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-icon">⚔️</span>
        <div>
          <div className="brand-name">E4K Alliance</div>
          <div className="brand-sub">Admin Panel</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'nav-item--active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <a
          href="https://gge-tracker.com/alliance/18696186"
          target="_blank"
          rel="noreferrer"
          className="gge-link"
        >
          🌐 GGE-Tracker ↗
        </a>
      </div>
    </aside>
  );
}
