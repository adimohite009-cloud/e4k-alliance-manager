import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import PlayerRoster from './components/PlayerRoster';
import EventScores from './components/EventScores';
import CastleVault from './components/CastleVault';

export default function App() {
  const [view, setView] = useState('roster');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        currentView={view}
        onNavigate={(v) => { setView(v); setSidebarOpen(false); }}
        isOpen={sidebarOpen}
      />

      <div className="main-area">
        {/* Mobile header */}
        <div className="mobile-header">
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>
            ☰
          </button>
          <span className="mobile-title">⚔️ E4K Alliance</span>
        </div>

        <div className="view-content">
          {view === 'roster'  && <PlayerRoster showToast={showToast} />}
          {view === 'events'  && <EventScores showToast={showToast} />}
          {view === 'vault'   && <CastleVault showToast={showToast} />}
        </div>
      </div>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}
