import React, { useState } from 'react';

const fmt = n => Number(n || 0).toLocaleString();
const profile = id => `https://gge-tracker.com/player/${encodeURIComponent(id)}?server=E4K_INT2`;

export default function RecruitReview() {
  const [playerId, setPlayerId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function analyze(event) {
    event.preventDefault();
    setLoading(true); setError(''); setReport(null);
    try {
      const response = await fetch(`/api/recruit-review?playerId=${encodeURIComponent(playerId.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not analyze tracker history.');
      setReport(data);
    } catch (e) {
      setError(e.message || 'Could not reach the alliance API.');
    } finally { setLoading(false); }
  }

  return <div>
    <div className="page-header">
      <div><div className="page-title">🧭 Applicant Review</div>
        <div className="page-subtitle">Compare a recruit’s recent event and loot activity with active alliance members.</div></div>
    </div>

    <form className="card" onSubmit={analyze} style={{marginBottom:16}}>
      <h2 style={{fontSize:'1.05rem',marginBottom:6}}>Review a GGE Tracker player</h2>
      <p style={{color:'var(--text-muted)',marginBottom:16}}>Paste the applicant’s numeric player ID from their GGE Tracker profile. Analysis uses the last 14 days.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <input className="form-input" inputMode="numeric" value={playerId} onChange={e=>setPlayerId(e.target.value)} placeholder="GGE Tracker player ID" aria-label="GGE Tracker player ID" style={{flex:'1 1 240px',maxWidth:480}} />
        <button className="btn btn-primary" disabled={loading || !playerId.trim()}>{loading?'Analyzing…':'Analyze activity'}</button>
      </div>
      {error && <p role="alert" style={{color:'#f87171',marginTop:12}}>{error}</p>}
    </form>

    {!report && !loading && <div className="card" style={{color:'var(--text-muted)'}}>
      <strong style={{color:'var(--text)'}}>How this helps</strong>
      <p style={{marginTop:6}}>The report compares activity across event types and loot, then shows the lowest scoring active member eligible for review. It does not remove anyone automatically.</p>
    </div>}

    {loading && <div className="card loading-wrap"><div className="loading-spinner" /><span style={{marginLeft:12,color:'var(--text-muted)'}}>Loading recent tracker history…</span></div>}

    {report && <>
      <div className="card" style={{marginBottom:16,borderColor:'rgba(200,168,75,.45)'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <div><div style={{fontSize:'1.15rem',fontWeight:800}}>Applicant activity score: {report.candidate.score == null ? 'Not enough data' : `${report.candidate.score}/100`}</div>
            <div style={{color:'var(--text-muted)',marginTop:4}}>Events with tracker history: {report.candidate.eventSeries}/6 · Loot gained: {fmt(report.candidate.loot)} · Confidence: {report.confidence}</div></div>
          <a className="btn btn-ghost" href={profile(report.candidate.ggePlayerId)} target="_blank" rel="noreferrer">Open GGE Tracker ↗</a>
        </div>
        <p style={{marginTop:12,color:'var(--text-muted)'}}>Compared with {report.trackedMembers} active roster members with linked tracker IDs over {report.periodDays} days. Generated {new Date(report.generatedAt).toLocaleString()}.</p>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <h2 style={{fontSize:'1.05rem',marginBottom:10}}>Suggested member to review</h2>
        {report.recommendedReview ? <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div><strong style={{fontSize:'1.05rem'}}>{report.recommendedReview.name}</strong> <span style={{color:'var(--text-muted)'}}>({report.recommendedReview.rank})</span>
            <div style={{color:'var(--text-muted)'}}>Activity score {report.recommendedReview.score}/100 · {report.recommendedReview.events} event categories · loot gained {fmt(report.recommendedReview.loot)}</div></div>
          <a className="btn btn-ghost btn-sm" href={profile(report.recommendedReview.ggePlayerId)} target="_blank" rel="noreferrer">View profile ↗</a>
        </div> : <p style={{color:'var(--text-muted)'}}>No eligible linked member had enough tracker history to compare. Link member GGE IDs and try again.</p>}
        <p style={{fontSize:'.82rem',color:'var(--text-muted)',marginTop:12}}>{report.note}</p>
      </div>

      <div className="card">
        <h2 style={{fontSize:'1.05rem',marginBottom:10}}>Lowest activity comparisons</h2>
        {report.alternatives.length ? <div className="table-wrap"><table><thead><tr><th>Member</th><th>Rank</th><th>Score</th><th>Event categories</th><th>Loot gained</th><th>Tracker</th></tr></thead>
          <tbody>{report.alternatives.map((p,i)=><tr key={p.ggePlayerId}><td>{i===0?'⚠️ ':''}{p.name}</td><td>{p.rank}</td><td>{p.score}/100</td><td>{p.events}</td><td>{fmt(p.loot)}</td><td><a href={profile(p.ggePlayerId)} target="_blank" rel="noreferrer">Open ↗</a></td></tr>)}</tbody>
        </table></div> : <p style={{color:'var(--text-muted)'}}>No comparison data available yet.</p>}
      </div>
    </>}
  </div>;
}
