import React, { useCallback, useEffect, useState } from 'react';

const fmt = n => Number(n || 0).toLocaleString();
const profile = id => `https://gge-tracker.com/player/${encodeURIComponent(id)}?server=E4K_INT2`;
const ratingColor = rating => rating === 'Promotion consideration' ? '#c8a84b'
  : rating === 'Strong contribution' ? '#4ade80'
  : rating === 'Steady contribution' ? '#60a5fa'
  : rating === 'Building contribution' ? '#facc15' : 'var(--text-muted)';

export default function RecruitReview() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('activity');
  const [trendPlayerId, setTrendPlayerId] = useState('');
  const [trendMetric, setTrendMetric] = useState('events');
  const [trendRange, setTrendRange] = useState(13);

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

  const ratings = report?.allMemberRatings || [];
  const rated = ratings.filter(p => p.score !== null && p.score !== undefined);
  const currentMember = p => !['Inactive','Kicked','Former'].includes(p.status);
  const top = rated.filter(currentMember).slice(0, 5);
  const trendMembers = ratings.filter(p => p.weeklyTrend?.length);
  const trendPlayer = trendMembers.find(p => String(p.playerId) === String(trendPlayerId)) || trendMembers[0];
  const visibleTrend = (trendPlayer?.weeklyTrend || []).slice(-trendRange);
  const trendMax = trendMetric === 'events' ? 6 : Math.max(1,...visibleTrend.map(w => w.lootGained || 0));
  const csvCell = value => {
    let text = String(value ?? '');
    if (/^[\t\r ]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g,'""') + '"';
  };
  const downloadCsv = () => {
    const columns = ['Member','Status','Current rank','Position','Contribution score','Rating','Event categories','Loot gained','Confidence','Joined','Left roster','Reason','GGE Tracker profile','Weekly dates (oldest first)','Event categories by week','Loot gained by week'];
    const body = ratings.map(p => [
      p.name,p.status,p.rank,p.position ? '#' + p.position : '',p.score ?? '',p.rating,
      (p.events ?? 0) + '/6',p.loot ?? 0,p.confidence,p.joinedDate,p.departedAt,p.reason,
      p.ggePlayerId ? profile(p.ggePlayerId) : '',
      (p.weeklyTrend || []).map(w => w.start.slice(0,10)).join('|'),
      (p.weeklyTrend || []).map(w => w.eventCategories).join('|'),
      (p.weeklyTrend || []).map(w => w.lootGained).join('|')
    ]);
    const csv = '\uFEFF' + [columns,...body].map(row=>row.map(csvCell).join(',')).join('\r\n');
    const objectUrl = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'e4k-alliance-performance-' + new Date().toISOString().slice(0,10) + '.csv';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),0);
  };
  const switchButton = (value, label) => <button type="button" onClick={() => setMode(value)}
    aria-pressed={mode === value} className={mode === value ? 'btn btn-primary' : 'btn btn-ghost'}>{label}</button>;

  return <div>
    <div className="page-header">
      <div><div className="page-title">📈 Player Performance</div>
        <div className="page-subtitle">Review recent event participation, loot, and contributions across your active alliance roster.</div></div>
      <div className="no-print" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button className="btn btn-ghost" onClick={downloadCsv} disabled={!report || !ratings.length}>↓ Download CSV</button>
        <button className="btn btn-ghost" onClick={() => window.print()} disabled={!report}>⎙ Print / Save PDF</button>
        <button className="btn btn-primary" onClick={refresh} disabled={loading}>{loading ? 'Updating…' : '↻ Refresh Tracker'}</button>
      </div>
    </div>

    <div className="card" style={{marginBottom:16}}>
      <strong>14-day activity review</strong>
      <p style={{color:'var(--text-muted)',marginTop:5}}>Scores compare each member with the rest of the alliance across tracked event categories and loot. Use ratings as a starting point for a conversation, with context from the player.</p>
    </div>

    <div className="toolbar" role="tablist" aria-label="Performance views">
      {switchButton('activity','Activity review')}
      {switchButton('contribution','Promotion & Contribution')}
    </div>

    {error && <div className="card" role="alert" style={{color:'#f87171',marginBottom:16}}>{error}</div>}
    {loading && !report && <div className="card loading-wrap"><div className="loading-spinner" /><span style={{marginLeft:12,color:'var(--text-muted)'}}>Loading recent alliance tracker history…</span></div>}

    {report && <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',gap:12,marginBottom:16}}>
        {[
          {label:'Current members',value:report.activeMembers},
          {label:'Former members',value:report.formerMembers ?? 0},
          {label:'Linked to GGE Tracker',value:report.linkedMembers},
          {label:'Enough data to compare',value:report.rankedMembers}
        ].map(item=><div className="card" key={item.label}><div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--gold)'}}>{item.value}</div><div style={{color:'var(--text-muted)',fontSize:'.8rem'}}>{item.label}</div></div>)}
      </div>

      {mode === 'activity' ? <>
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
          {report.needsFollowUp.length ? <div className="table-wrap"><table><thead><tr><th>Member</th><th>Rank</th><th>Relative score</th><th>Event categories</th><th>Loot gained</th><th>Data confidence</th><th>Reason</th><th>Joined</th><th>Left roster</th><th>Profile</th></tr></thead>
            <tbody>{report.needsFollowUp.map((p,i)=><tr key={p.playerId}><td>{i===0?'⚠️ ':''}{p.name}</td><td>{p.rank}</td><td>{p.score}/100</td><td>{p.events}/6</td><td>{fmt(p.loot)}</td><td>{p.confidence}</td><td>{p.reason}</td><td><a href={profile(p.ggePlayerId)} target="_blank" rel="noreferrer">Open ↗</a></td></tr>)}</tbody>
          </table></div> : <p style={{color:'var(--text-muted)'}}>No member has enough recent history for a comparison.</p>}
        </div>
      </> : <>
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
            <div>
              <h2 style={{fontSize:'1.05rem',margin:'0 0 6px'}}>Performance trends</h2>
              <p style={{color:'var(--text-muted)',fontSize:'.82rem',margin:0}}>Weekly tracker activity over the last 13 weeks. Former members’ weeks end on their recorded departure date.</p>
            </div>
            <div className="no-print" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <select className="form-select" aria-label="Choose player for trend chart" value={trendPlayer?.playerId || ''} onChange={e=>setTrendPlayerId(e.target.value)} style={{width:'auto',minWidth:180}}>
                {trendMembers.map(p=><option key={p.playerId} value={p.playerId}>{p.name} · {p.status}</option>)}
              </select>
              <button type="button" className={trendRange===4?'btn btn-primary':'btn btn-ghost'} aria-pressed={trendRange===4} onClick={()=>setTrendRange(4)}>30 days</button>
              <button type="button" className={trendRange===13?'btn btn-primary':'btn btn-ghost'} aria-pressed={trendRange===13} onClick={()=>setTrendRange(13)}>90 days</button>
              <button type="button" className={trendMetric==='events'?'btn btn-primary':'btn btn-ghost'} aria-pressed={trendMetric==='events'} onClick={()=>setTrendMetric('events')}>Event categories</button>
              <button type="button" className={trendMetric==='loot'?'btn btn-primary':'btn btn-ghost'} aria-pressed={trendMetric==='loot'} onClick={()=>setTrendMetric('loot')}>Loot gained</button>
            </div>
          </div>
          {trendPlayer ? <>
            <div style={{marginTop:14,fontWeight:700}}>{trendPlayer.name} <span style={{color:'var(--text-muted)',fontWeight:400}}>· {trendPlayer.status} · {trendMetric==='events'?'event categories with recorded gains (out of 6)':'loot gained per week'}</span></div>
            <div role="img" aria-label={`Weekly ${trendMetric==='events'?'event participation':'loot'} trend for ${trendPlayer.name}`} style={{display:'grid',gridTemplateColumns:`repeat(${visibleTrend.length}, minmax(18px,1fr))`,gap:6,alignItems:'end',height:190,padding:'12px 4px 0',borderBottom:'1px solid var(--border)'}}>
              {visibleTrend.map(week=>{
                const value=trendMetric==='events'?week.eventCategories:week.lootGained;
                const percent=trendMetric==='events'?value/6*100:value/trendMax*100;
                const rangeLabel=new Date(week.start).toLocaleDateString([], {month:'short',day:'numeric'});
                const endLabel=new Date(week.end).toLocaleDateString([], {month:'short',day:'numeric'});
                return <div key={week.start} title={`${rangeLabel}–${endLabel}: ${week.eventCategories}/6 event categories, ${fmt(week.lootGained)} loot`} style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'flex-end',alignItems:'center',gap:5,minWidth:0}}>
                  <div style={{height:`${Math.max(value>0?3:0,percent)}%`,width:'72%',maxWidth:34,background:'linear-gradient(180deg,var(--gold),rgba(200,168,75,.42))',borderRadius:'5px 5px 0 0'}} />
                  <span style={{fontSize:'.65rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{rangeLabel}</span>
                </div>;
              })}
            </div>
            <div style={{color:'var(--text-muted)',fontSize:'.78rem',marginTop:8}}>Hover a bar to see the week’s event-category and loot totals.</div>
          </> : <p style={{color:'var(--text-muted)',marginTop:14}}>No weekly tracker history is available for the roster yet.</p>}
        </div>

        <div className="card" style={{marginBottom:16,borderColor:'rgba(200,168,75,.45)'}}>
          <h2 style={{fontSize:'1.05rem',marginBottom:8}}>Top measured contributors</h2>
          <p style={{color:'var(--text-muted)',margin:'0 0 14px'}}>These members have the strongest relative event and loot activity in the last 14 days. “Promotion consideration” is a prompt for the leader to review their wider contribution, not an automatic promotion recommendation.</p>
          {top.length ? <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
            {top.map((p,i)=><div className="card" key={p.playerId} style={{padding:14}}>
              <div style={{color:'var(--gold)',fontWeight:800,fontSize:'.78rem'}}>#{i+1} · {p.rating}</div>
              <strong style={{display:'block',marginTop:5}}>{p.name}</strong>
              <span style={{color:'var(--text-muted)',fontSize:'.82rem'}}>{p.rank} · {p.score}/100 · {p.events}/6 event categories</span>
            </div>)}
          </div> : <p style={{color:'var(--text-muted)'}}>There isn’t enough recent tracker history to compare members yet.</p>}
        </div>

        <div className="card" style={{marginBottom:16}}>
          <h2 style={{fontSize:'1.05rem',marginBottom:4}}>Current and former member contribution ratings</h2>
          <p style={{color:'var(--text-muted)',fontSize:'.82rem',marginTop:0}}>Relative score combines each player’s percentile in tracked event gains and loot over the last 14 days. Current members appear first; former members are shown below for history. It does not measure leadership, mentoring, reliability, or teamwork.</p>
          <div className="table-wrap"><table><thead><tr><th>Position</th><th>Member</th><th>Status</th><th>Rank</th><th>Contribution score</th><th>Rating</th><th>Event categories</th><th>Loot gained</th><th>Data confidence</th><th>Reason</th><th>Joined</th><th>Left roster</th><th>Profile</th></tr></thead>
            <tbody>{ratings.map(p=><tr key={p.playerId}>
              <td>{p.position ? `#${p.position}` : '—'}</td><td>{p.name}</td><td>{p.status || 'Active'}</td><td>{p.rank}</td>
              <td>{p.score === null || p.score === undefined ? '—' : `${p.score}/100`}</td>
              <td><span style={{fontWeight:700,color:ratingColor(p.rating)}}>{p.rating}</span></td>
              <td>{p.events ?? 0}/6</td><td>{fmt(p.loot)}</td><td>{p.confidence}</td><td>{p.reason}</td><td>{p.joinedDate || '—'}</td><td>{p.departedAt ? new Date(p.departedAt).toLocaleDateString() : '—'}</td>
              <td>{p.ggePlayerId ? <a href={profile(p.ggePlayerId)} target="_blank" rel="noreferrer">Open ↗</a> : '—'}</td>
            </tr>)}</tbody>
          </table></div>
        </div>
      </>}

      {report.insufficientData.length > 0 && mode === 'activity' && <details className="card" style={{marginBottom:16}}>
        <summary style={{cursor:'pointer',fontWeight:700}}>Members with insufficient tracker data ({report.insufficientData.length})</summary>
        <p style={{color:'var(--text-muted)',margin:'8px 0'}}>These members are left out of the activity ranking so missing data is not treated as inactivity.</p>
        <div className="table-wrap"><table><thead><tr><th>Member</th><th>Rank</th><th>Reason</th></tr></thead><tbody>
          {report.insufficientData.map(p=><tr key={p.playerId}><td>{p.name}</td><td>{p.rank}</td><td>{p.reason}</td></tr>)}
        </tbody></table></div>
      </details>}

      <p style={{color:'var(--text-muted)',fontSize:'.8rem'}}>Tracker checked {new Date(report.generatedAt).toLocaleString()} · Report covers the last {report.periodDays} days.</p>
    </>}
  </div>;
}
