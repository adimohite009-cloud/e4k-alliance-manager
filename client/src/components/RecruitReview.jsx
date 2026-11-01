import React, { useCallback, useEffect, useState } from 'react';

const fmt = n => Number(n || 0).toLocaleString();
const profile = id => `https://gge-tracker.com/player/${encodeURIComponent(id)}?server=E4K_INT2`;

export default function RecruitReview() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/performance-review');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load GGE Tracker activity.');
      setReport(data);
    } catch (e) {
      setError(e.message || 'Could not reach the alliance API.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <div>
    <div className="page-header">
      <div><div className="page-title">📈 Player Performance</div>
        <div className="page-subtitle">Review recent event participation and loot across your active alliance roster.</div></div>
      <button className="btn btn-primary" onClick={refresh} disabled={loading}>{loading ? 'Updating…' : '↻ Refresh Tracker'}</button>
    </div>

    <div className="card" style={{marginBottom:16}}>
      <strong>14-day activity review</strong>
      <p style={{color:'var(--text-muted)',marginTop:5}}>Scores compare each member with the rest of the alliance across tracked event categories and loot. A low score is a prompt to check in and understand the context.</p>
    </div>

    {error && <div className="card" role="alert" style={{color:'#f87171',marginBottom:16}}>{error}</div>}
    {loading && !report && <div className="card loading-wrap"><div className="loading-spinner" /><span style={{marginLeft:12,color:'var(--text-muted)'}}>Loading recent alliance tracker history…</span></div>}

    {report && <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:12,marginBottom:16}}>
        {[
          {label:'Active members',value:report.activeMembers},
          {label:'Linked to GGE Tracker',value:report.linkedMembers},
          {label:'Enough data to compare',value:report.rankedMembers}
        ].map(item=><div className="card" key={item.label}><div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--gold)'}}>{item.value}</div><div style={{color:'var(--text-muted)',fontSize:'.8rem'}}>{item.label}</div></div>)}
      </div>

      <div className="card" style={{marginBottom:16,borderColor:'rgba(200,168,75,.45)'}}>
        <h2 style={{fontSize:'1.05rem',marginBottom:10}}>Lowest activity to review</h2>
        {report.lowestPerforming ? <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div><strong style={{fontSize:'1.15rem'}}>{report.lowestPerforming.name}</strong> <span style={{color:'var(--text-muted)'}}>({report.lowestPerforming.rank})</span>
            <div style={{color:'var(--text-muted)'}}>Relative activity score {report.lowestPerforming.score}/100 · gains in {report.lowestPerforming.events} event categories · loot gained {fmt(report.lowestPerforming.loot)}</div>
            <div style={{marginTop:5}}>{report.lowestPerforming.reason}</div></div>
          <a className="btn btn-ghost" href={profile(report.lowestPerforming.ggePlayerId)} target="_blank" rel="noreferrer">View GGE profile ↗</a>
        </div> : <p style={{color:'var(--text-muted)'}}>There isn’t enough recent tracker history to fairly compare members yet.</p>}
        <p style={{fontSize:'.82rem',color:'var(--text-muted)',marginTop:12}}>{report.note}</p>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <h2 style={{fontSize:'1.05rem',marginBottom:10}}>Members to check in with</h2>
        {report.needsFollowUp.length ? <div className="table-wrap"><table><thead><tr><th>Member</th><th>Rank</th><th>Relative score</th><th>Event categories</th><th>Loot gained</th><th>Data confidence</th><th>Reason</th><th>Profile</th></tr></thead>
          <tbody>{report.needsFollowUp.map((p,i)=><tr key={p.playerId}><td>{i===0?'⚠️ ':''}{p.name}</td><td>{p.rank}</td><td>{p.score}/100</td><td>{p.events}/6</td><td>{fmt(p.loot)}</td><td>{p.confidence}</td><td>{p.reason}</td><td><a href={profile(p.ggePlayerId)} target="_blank" rel="noreferrer">Open ↗</a></td></tr>)}</tbody>
        </table></div> : <p style={{color:'var(--text-muted)'}}>No member has enough recent history for a comparison.</p>}
      </div>

      {report.insufficientData.length > 0 && <details className="card" style={{marginBottom:16}}>
        <summary style={{cursor:'pointer',fontWeight:700}}>Members with insufficient tracker data ({report.insufficientData.length})</summary>
        <p style={{color:'var(--text-muted)',margin:'8px 0'}}>These members are left out of the ranking so missing data is not treated as inactivity.</p>
        <div className="table-wrap"><table><thead><tr><th>Member</th><th>Rank</th><th>Reason</th></tr></thead><tbody>
          {report.insufficientData.map(p=><tr key={p.playerId}><td>{p.name}</td><td>{p.rank}</td><td>{p.reason}</td></tr>)}
        </tbody></table></div>
      </details>}

      <p style={{color:'var(--text-muted)',fontSize:'.8rem'}}>Tracker checked {new Date(report.generatedAt).toLocaleString()} · Report covers the last {report.periodDays} days.</p>
    </>}
  </div>;
}
