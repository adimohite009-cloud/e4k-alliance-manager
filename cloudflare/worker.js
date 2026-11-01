const ALLIANCE_ID = '18696186';
const GGE_SERVER = 'E4K_INT2';
const GGE_API = 'https://api.gge-tracker.com/api/v1';
const GGE_HEADERS = { Accept: 'application/json', 'gge-server': GGE_SERVER };
const ALLOWED_SORT = { name: 'name', rank: 'rank', power: 'power', last_active: 'last_active', status: 'status' };
const RANKS = ['Recruit', 'Member', 'Officer', 'Co-Leader', 'Leader'];

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = new Set([
    'https://e4k-alliance-maanger.netlify.app',
    'http://localhost:5173',
    env.APP_ORIGIN || ''
  ]);
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Alliance-Password',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function reply(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) }
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

async function bodyJson(request) {
  try { return await request.json(); } catch { return {}; }
}


const PLAYER_COLUMNS = ['id','name','rank','power','kingdom','last_active','contributions','notes','joined_date','status','gge_player_id'];
const SCORE_COLUMNS = ['id','player_id','event_name','event_date','event_points','glory_points','event_rank','quota','notes'];
const VAULT_COLUMNS = ['id','castle_name','account_name','password','realm','sitter','notes','created_at','updated_at'];

async function recordActivity(env, entry) {
  const historyValue = value => {
    if (entry.entity_type !== 'vault' || !value || typeof value !== 'object') return value;
    const safe = { ...value };
    delete safe.password;
    return safe;
  };
  const before = historyValue(entry.before);
  const after = historyValue(entry.after);
  await env.DB.prepare('INSERT INTO activity_log (entity_type,entity_id,action,description,before_json,after_json,is_undoable) VALUES (?,?,?,?,?,?,?)')
    .bind(entry.entity_type, entry.entity_id || null, entry.action, entry.description,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
      entry.undoable === false ? 0 : 1).run();
}

async function replaceRow(env, table, columns, row) {
  const names = columns.join(',');
  const placeholders = columns.map(() => '?').join(',');
  await env.DB.prepare('INSERT OR REPLACE INTO ' + table + ' (' + names + ') VALUES (' + placeholders + ')')
    .bind(...columns.map(column => row[column] ?? null)).run();
}

async function syncFromGGE(env) {
  const response = await fetch(`${GGE_API}/updates/alliances/${ALLIANCE_ID}/players`, { headers: GGE_HEADERS });
  if (!response.ok) throw new Error(`GGE Tracker returned HTTP ${response.status}`);
  const data = await response.json();
  const latest = new Map();
  for (const update of (data.updates || [])) {
    const old = latest.get(String(update.player_id));
    if (!old || new Date(update.created_at) > new Date(old.created_at)) latest.set(String(update.player_id), update);
  }
  const members = [...latest.values()].filter(update => String(update.new_alliance_id) === ALLIANCE_ID);
  let updated = 0;
  for (const member of members) {
    const player = await env.DB.prepare('SELECT id FROM players WHERE gge_player_id = ?').bind(String(member.player_id)).first();
    if (!player) continue;
    const lastActive = member.created_at ? String(member.created_at).slice(0, 10) : today();
    const notes = `Level ${member.level} · Legendary ${member.legendary_level}`;
    await env.DB.prepare('UPDATE players SET power = ?, last_active = ?, notes = ? WHERE id = ?')
      .bind(num(member.might_current), lastActive, notes, player.id).run();
    updated++;
  }
  const syncedAt = new Date().toISOString();
  await env.DB.prepare('INSERT INTO sync_state (id,last_sync_time,last_sync_status) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET last_sync_time=excluded.last_sync_time,last_sync_status=excluded.last_sync_status')
    .bind(syncedAt, `OK — updated ${updated} players`).run();
  return { success: true, updated, total: members.length, syncedAt };
}

function parseGgeTime(value) {
  if (typeof value !== 'string') return NaN;
  const dmy = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T](.*))?$/);
  if (dmy) return Date.parse(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}T${dmy[4] || '00:00:00'}Z`);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function trackerRows(payload) {
  const rows = [];
  const points = payload?.points;
  if (!points || typeof points !== 'object') return rows;
  for (const [series, values] of Object.entries(points)) {
    if (!Array.isArray(values)) continue;
    for (const row of values) {
      const playerId = row?.player_id ?? row?.playerId ?? payload?.player_id ?? payload?.playerId;
      const time = parseGgeTime(String(row?.date ?? row?.created_at ?? row?.timestamp ?? ''));
      const point = Number(row?.point ?? row?.value ?? row?.score);
      if (playerId != null && Number.isFinite(time) && Number.isFinite(point)) rows.push({ series, playerId: String(playerId), time, point });
    }
  }
  return rows;
}

function trackerGains(rows, ids, since) {
  const bySeries = new Map();
  for (const row of rows) {
    if (!ids.has(row.playerId) || row.time < since) continue;
    const key = row.series + ':' + row.playerId;
    if (!bySeries.has(key)) bySeries.set(key, []);
    bySeries.get(key).push(row);
  }
  const result = new Map();
  for (const [key, values] of bySeries) {
    values.sort((a,b) => a.time-b.time);
    let gain = 0, participated = false, previous;
    for (const row of values) {
      if (previous !== undefined) {
        const delta = row.point - previous;
        if (delta > 0) { gain += delta; participated = true; }
      }
      previous = row.point;
    }
    if (!participated && values.some(row => row.point > 0)) participated = true;
    const split = key.lastIndexOf(':');
    result.set(key, { series: key.slice(0, split), playerId: key.slice(split + 1), gain, participated, samples: values.length });
  }
  return result;
}

async function fetchTrackerStats(path) {
  const response = await fetch(`${GGE_API}${path}`, { headers: GGE_HEADERS });
  if (!response.ok) throw new Error(`GGE Tracker statistics returned HTTP ${response.status}`);
  return response.json();
}

async function recruitReview(env, candidateId) {
  const roster = await env.DB.prepare("SELECT id,name,rank,status,gge_player_id,joined_date FROM players WHERE status='Active'").all();
  const members = (roster.results || []).filter(p => p.gge_player_id && String(p.gge_player_id) !== candidateId);
  if (!members.length) throw new Error('No active roster members have linked GGE Tracker IDs.');
  const eventSeries = [
    'player_event_berimond_invasion_history','player_event_berimond_kingdom_history',
    'player_event_bloodcrow_history','player_event_nomad_history','player_event_samurai_history',
    'player_event_war_realms_history'
  ];
  const series = [...eventSeries, 'player_loot_history'];
  const params = new URLSearchParams({ events: series.join(','), limit: '20000' });
  const since = Date.now() - 14 * 86400000;
  const [allianceData, candidateData] = await Promise.all([
    fetchTrackerStats(`/statistics/alliance/${ALLIANCE_ID}?${params}`),
    fetchTrackerStats(`/statistics/player/${encodeURIComponent(candidateId)}?${new URLSearchParams({events:series.join(','),since:'14',dedup:'true'})}`)
  ]);
  const memberIds = new Set(members.map(p => String(p.gge_player_id)));
  const memberGains = trackerGains(trackerRows(allianceData), memberIds, since);
  const candidateRows = trackerRows(candidateData);
  // Some player-stat responses omit player_id because the requested ID is the series owner.
  const candidateIdSet = new Set([candidateId]);
  const candidateGains = trackerGains(candidateRows.map(r => ({...r,playerId:candidateId})), candidateIdSet, since);
  const allIds = [...members.map(p=>String(p.gge_player_id)), candidateId];
  const byPlayer = new Map(allIds.map(id => [id, {id,events:0,eventSeries:0,loot:0,samples:0,percentiles:[]}]));
  for (const event of eventSeries) {
    const values = allIds.map(id => ({id, stat: id===candidateId ? candidateGains.get(event+':'+id) : memberGains.get(event+':'+id)}));
    const observed = values.filter(x=>x.stat && x.stat.samples>0);
    if (!observed.length) continue;
    const ranked = [...observed].sort((a,b)=>a.stat.gain-b.stat.gain);
    for (const item of observed) {
      const p = byPlayer.get(item.id);
      p.eventSeries++;
      p.samples += item.stat.samples;
      if (item.stat.participated) p.events++;
      const rank = ranked.filter(x=>x.stat.gain<=item.stat.gain).length;
      p.percentiles.push(Math.round(rank / ranked.length * 100));
    }
  }
  const lootValues=allIds.map(id=>({id,stat:id===candidateId?candidateGains.get('player_loot_history:'+id):memberGains.get('player_loot_history:'+id)})).filter(x=>x.stat);
  if (lootValues.length) {
    for(const item of lootValues) {
      const p=byPlayer.get(item.id); p.loot=item.stat.gain; p.samples+=item.stat.samples;
      const rank=lootValues.filter(x=>x.stat.gain<=item.stat.gain).length;
      p.percentiles.push(Math.round(rank/lootValues.length*100));
    }
  }
  const scored = [...byPlayer.values()].map(p=>({...p,score:p.percentiles.length?Math.round(p.percentiles.reduce((a,b)=>a+b,0)/p.percentiles.length):null}));
  const memberByGge=new Map(members.map(p=>[String(p.gge_player_id),p]));
  const candidate=scored.find(p=>p.id===candidateId);
  const replaceable=scored.filter(p=>{
    const player=memberByGge.get(p.id);
    return player && !['Leader','Co-Leader','Officer'].includes(player.rank) && p.score!==null;
  }).sort((a,b)=>a.score-b.score);
  const details=p=>({...p,name:p.id===candidateId?'Applicant':memberByGge.get(p.id)?.name||'Member',rank:memberByGge.get(p.id)?.rank||'Applicant',ggePlayerId:p.id});
  const eligible=replaceable.map(details);
  return {
    periodDays:14, generatedAt:new Date().toISOString(), candidate:details(candidate||{id:candidateId,score:null,events:0,eventSeries:0,loot:0,samples:0}),
    recommendedReview:eligible[0]||null, alternatives:eligible.slice(0,5),
    eligibleMembers:eligible.length, trackedMembers:members.length,
    confidence: candidate?.eventSeries>=3 && candidate?.samples>=4 ? 'moderate' : 'low',
    note:'This is an activity comparison for officer review, not an automatic removal. Missing tracker data is not treated as inactivity; leadership ranks are excluded from replacement suggestions.'
  };
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

  if (path === '/api/auth/verify' && method === 'POST') {
    const body = await bodyJson(request);
    if (!env.APP_PASSWORD) return reply(request, env, { error: 'App password is not configured' }, 503);
    if ((body.password || request.headers.get('X-Alliance-Password') || '') !== env.APP_PASSWORD)
      return reply(request, env, { error: 'Incorrect password' }, 401);
    return reply(request, env, { success: true });
  }

  if (!env.APP_PASSWORD) return reply(request, env, { error: 'App password is not configured' }, 503);
  if (request.headers.get('X-Alliance-Password') !== env.APP_PASSWORD)
    return reply(request, env, { error: 'Password required' }, 401);

  try {
    let match;
    if (path === '/api/activity' && method === 'GET') {
      const limit = Math.min(100, Math.max(1, num(url.searchParams.get('limit'), 50)));
      const result = await env.DB.prepare('SELECT id,occurred_at,entity_type,entity_id,action,description,undone_at,is_undoable FROM activity_log ORDER BY id DESC LIMIT ?').bind(limit).all();
      return reply(request, env, result.results || []);
    }
    match = path.match(/^\/api\/activity\/(\d+)\/undo$/);
    if (match && method === 'POST') {
      const entry = await env.DB.prepare('SELECT * FROM activity_log WHERE id=?').bind(Number(match[1])).first();
      if (!entry) return reply(request, env, { error: 'Activity entry not found' }, 404);
      if (!entry.is_undoable || entry.undone_at) return reply(request, env, { error: 'This change can no longer be undone' }, 409);
      const later = await env.DB.prepare('SELECT COUNT(*) AS count FROM activity_log WHERE entity_type=? AND entity_id=? AND id>? AND undone_at IS NULL').bind(entry.entity_type, entry.entity_id, entry.id).first();
      if (num(later?.count) > 0) return reply(request, env, { error: 'Undo newer changes to this record first' }, 409);
      if (entry.entity_type === 'player' && entry.action === 'created') {
        const linked = await env.DB.prepare('SELECT COUNT(*) AS count FROM event_scores WHERE player_id=?').bind(entry.entity_id).first();
        if (num(linked?.count) > 0) return reply(request, env, { error: 'Undo this player’s event scores first' }, 409);
      }
      const before = entry.before_json ? JSON.parse(entry.before_json) : null;
      const after = entry.after_json ? JSON.parse(entry.after_json) : null;
      const current = after;
      if (entry.entity_type === 'player') {
        if (entry.action === 'created') await env.DB.prepare('DELETE FROM players WHERE id=?').bind(entry.entity_id).run();
        else if (entry.action === 'deleted') {
          await replaceRow(env, 'players', PLAYER_COLUMNS, before.player);
          for (const score of before.event_scores || []) await replaceRow(env, 'event_scores', SCORE_COLUMNS, score);
        } else if (before) await replaceRow(env, 'players', PLAYER_COLUMNS, before);
      } else if (entry.entity_type === 'score') {
        if (entry.action === 'created') await env.DB.prepare('DELETE FROM event_scores WHERE id=?').bind(entry.entity_id).run();
        else if (before) await replaceRow(env, 'event_scores', SCORE_COLUMNS, before);
      } else if (entry.entity_type === 'vault') {
        if (entry.action === 'created') await env.DB.prepare('UPDATE castle_accounts SET deleted_at=? WHERE id=?').bind(new Date().toISOString(), entry.entity_id).run();
        else if (entry.action === 'deleted') await env.DB.prepare('UPDATE castle_accounts SET deleted_at=NULL WHERE id=?').bind(entry.entity_id).run();
        else if (before) {
          const current = await env.DB.prepare('SELECT password FROM castle_accounts WHERE id=?').bind(entry.entity_id).first();
          if (!current) return reply(request, env, { error: 'Vault record no longer exists' }, 409);
          await replaceRow(env, 'castle_accounts', VAULT_COLUMNS, { ...before, password: current.password });
        }
      }
      await env.DB.prepare('UPDATE activity_log SET undone_at=?,is_undoable=0 WHERE id=?').bind(new Date().toISOString(), entry.id).run();
      await recordActivity(env, { entity_type: entry.entity_type, entity_id: entry.entity_id, action: 'undo', description: 'Undid: ' + entry.description, before: current, after: before, undoable: false });
      return reply(request, env, { success: true });
    }

    if (path === '/api/recruit-review' && method === 'GET') {
      const candidateId = (url.searchParams.get('playerId') || '').trim();
      if (!/^\\d{5,20}$/.test(candidateId)) return reply(request, env, { error: 'Enter a valid GGE Tracker player ID (5–20 digits).' }, 400);
      return reply(request, env, await recruitReview(env, candidateId));
    }

    if (path === '/api/stats' && method === 'GET') {
      const totals = await env.DB.prepare('SELECT COUNT(*) AS totalPlayers, COALESCE(SUM(power),0) AS totalPower, COALESCE(AVG(power),0) AS avgPower FROM players').first();
      const active = await env.DB.prepare("SELECT COUNT(*) AS activePlayers FROM players WHERE status = 'Active'").first();
      return reply(request, env, { totalPlayers: num(totals.totalPlayers), activePlayers: num(active.activePlayers), totalPower: num(totals.totalPower), avgPower: Math.round(num(totals.avgPower)) });
    }

    if (path === '/api/players' && method === 'GET') {
      const search = (url.searchParams.get('search') || '').trim();
      const rank = url.searchParams.get('rank');
      const status = url.searchParams.get('status');
      const sortBy = ALLOWED_SORT[url.searchParams.get('sortBy')] || 'power';
      const direction = url.searchParams.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';
      const where = [], bindings = [];
      if (search) { where.push('(name LIKE ? OR notes LIKE ?)'); bindings.push(`%${search}%`, `%${search}%`); }
      if (rank && rank !== 'All') { where.push('rank = ?'); bindings.push(rank); }
      if (status && status !== 'All') { where.push('status = ?'); bindings.push(status); }
      const sql = `SELECT * FROM players ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${sortBy} ${direction}`;
      const result = await env.DB.prepare(sql).bind(...bindings).all();
      return reply(request, env, result.results || []);
    }

    match = path.match(/^\/api\/players\/(\d+)(?:\/(promote|demote|gge-link|events))?$/);
    if (match) {
      const id = Number(match[1]), action = match[2];
      if (action === 'events' && method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM event_scores WHERE player_id = ? ORDER BY event_date DESC').bind(id).all();
        return reply(request, env, rows.results || []);
      }
      if (action === 'gge-link' && method === 'GET') {
        const player = await env.DB.prepare('SELECT gge_player_id, name FROM players WHERE id = ?').bind(id).first();
        if (!player) return reply(request, env, { error: 'Player not found' }, 404);
        return reply(request, env, { url: player.gge_player_id ? `https://gge-tracker.com/player/${player.gge_player_id}?server=${GGE_SERVER}` : null, player_name: player.name, gge_player_id: player.gge_player_id });
      }
      if ((action === 'promote' || action === 'demote') && method === 'PUT') {
        const player = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
        if (!player) return reply(request, env, { error: 'Player not found' }, 404);
        const next = RANKS.indexOf(player.rank) + (action === 'promote' ? 1 : -1);
        if (next < 0 || next >= RANKS.length) return reply(request, env, { error: action === 'promote' ? 'Already at highest rank' : 'Already at lowest rank' }, 400);
        const updated = { ...player, rank: RANKS[next] };
        await env.DB.prepare('UPDATE players SET rank = ? WHERE id = ?').bind(RANKS[next], id).run();
        await recordActivity(env, { entity_type: 'player', entity_id: id, action: action === 'promote' ? 'promoted' : 'demoted', description: player.name + ' ' + action + 'd from ' + player.rank + ' to ' + updated.rank, before: player, after: updated });
        return reply(request, env, updated);
      }
      if (!action && method === 'GET') {
        const player = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
        return player ? reply(request, env, player) : reply(request, env, { error: 'Player not found' }, 404);
      }
      if (!action && method === 'PUT') {
        const body = await bodyJson(request);
        const old = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
        if (!old) return reply(request, env, { error: 'Player not found' }, 404);
        const value = (key, fallback) => body[key] !== undefined ? body[key] : fallback;
        await env.DB.prepare('UPDATE players SET name=?,rank=?,power=?,kingdom=?,last_active=?,contributions=?,notes=?,joined_date=?,status=?,gge_player_id=? WHERE id=?')
          .bind(String(value('name', old.name) || old.name).trim(), RANKS.includes(body.rank) ? body.rank : old.rank, num(value('power', old.power)), num(value('kingdom', old.kingdom), 1), value('last_active', old.last_active), num(value('contributions', old.contributions)), value('notes', old.notes), value('joined_date', old.joined_date), ['Active','Inactive','Warning','Kicked'].includes(body.status) ? body.status : old.status, value('gge_player_id', old.gge_player_id || ''), id).run();
        const updated = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
        await recordActivity(env, { entity_type: 'player', entity_id: id, action: 'updated', description: 'Updated player: ' + updated.name, before: old, after: updated });
        return reply(request, env, updated);
      }
      if (!action && method === 'DELETE') {
        const player = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
        if (!player) return reply(request, env, { error: 'Player not found' }, 404);
        const scores = await env.DB.prepare('SELECT * FROM event_scores WHERE player_id=?').bind(id).all();
        await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run();
        await recordActivity(env, { entity_type: 'player', entity_id: id, action: 'deleted', description: 'Removed player: ' + player.name, before: { player, event_scores: scores.results || [] }, after: null });
        return reply(request, env, { success: true, message: 'Player removed' });
      }
    }

    if (path === '/api/players' && method === 'POST') {
      const b = await bodyJson(request);
      if (!String(b.name || '').trim()) return reply(request, env, { error: 'Player name is required' }, 400);
      const inserted = await env.DB.prepare('INSERT INTO players (name,rank,power,kingdom,last_active,contributions,notes,joined_date,status,gge_player_id) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(String(b.name).trim(), RANKS.includes(b.rank) ? b.rank : 'Member', num(b.power), num(b.kingdom,1), b.last_active || today(), num(b.contributions), b.notes || '', b.joined_date || today(), ['Active','Inactive','Warning','Kicked'].includes(b.status) ? b.status : 'Active', b.gge_player_id || '').run();
      const player = await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(inserted.meta.last_row_id).first();
      await recordActivity(env, { entity_type: 'player', entity_id: player.id, action: 'created', description: 'Added player: ' + player.name, before: null, after: player });
      return reply(request, env, player, 201);
    }

    if (path === '/api/events' && method === 'GET') {
      const result = await env.DB.prepare('SELECT event_name, MAX(event_date) AS latest FROM event_scores GROUP BY event_name ORDER BY latest DESC').all();
      return reply(request, env, result.results || []);
    }
    match = path.match(/^\/api\/events\/([^/]+)\/scores$/);
    if (match && method === 'GET') {
      const event = decodeURIComponent(match[1]);
      const rows = await env.DB.prepare('SELECT es.*,p.name,p.rank,p.power,p.status FROM event_scores es JOIN players p ON es.player_id=p.id WHERE es.event_name=? ORDER BY es.event_points DESC').bind(event).all();
      return reply(request, env, rows.results || []);
    }
    if (path === '/api/events/score' && method === 'POST') {
      const b = await bodyJson(request);
      if (!b.player_id || !b.event_name) return reply(request, env, { error: 'player_id and event_name are required' }, 400);
      const date = b.event_date ? String(b.event_date).slice(0,10) : today();
      const old = await env.DB.prepare('SELECT * FROM event_scores WHERE player_id=? AND event_name=? AND event_date=?').bind(b.player_id,b.event_name,date).first();
      let scoreId;
      if (old) {
        scoreId = old.id;
        await env.DB.prepare('UPDATE event_scores SET event_points=?,glory_points=?,event_rank=?,quota=?,notes=? WHERE id=?')
          .bind(num(b.event_points),num(b.glory_points),num(b.event_rank),num(b.quota),b.notes || '',old.id).run();
      } else {
        const inserted = await env.DB.prepare('INSERT INTO event_scores (player_id,event_name,event_date,event_points,glory_points,event_rank,quota,notes) VALUES (?,?,?,?,?,?,?,?)')
          .bind(b.player_id,b.event_name,date,num(b.event_points),num(b.glory_points),num(b.event_rank),num(b.quota),b.notes || '').run();
        scoreId = inserted.meta.last_row_id;
      }
      const score = await env.DB.prepare('SELECT * FROM event_scores WHERE id=?').bind(scoreId).first();
      await recordActivity(env, { entity_type: 'score', entity_id: scoreId, action: old ? 'updated' : 'created', description: (old ? 'Updated score for ' : 'Logged score for ') + b.event_name + ' (' + date + ')', before: old, after: score });
      return reply(request, env, { success: true });
    }
    match = path.match(/^\/api\/events\/score\/(\d+)$/);
    if (match && method === 'DELETE') {
      const id = Number(match[1]);
      const score = await env.DB.prepare('SELECT * FROM event_scores WHERE id=?').bind(id).first();
      if (!score) return reply(request, env, { error: 'Score not found' }, 404);
      await env.DB.prepare('DELETE FROM event_scores WHERE id=?').bind(id).run();
      await recordActivity(env, { entity_type: 'score', entity_id: id, action: 'deleted', description: 'Deleted score for ' + score.event_name + ' (' + score.event_date + ')', before: score, after: null });
      return reply(request, env, { success: true });
    }

    if (path === '/api/vault' && method === 'GET') {
      const search = (url.searchParams.get('search') || '').trim();
      const result = search
        ? await env.DB.prepare('SELECT * FROM castle_accounts WHERE deleted_at IS NULL AND (castle_name LIKE ? OR account_name LIKE ? OR sitter LIKE ?) ORDER BY castle_name').bind(`%${search}%`,`%${search}%`,`%${search}%`).all()
        : await env.DB.prepare('SELECT * FROM castle_accounts WHERE deleted_at IS NULL ORDER BY castle_name').all();
      return reply(request, env, result.results || []);
    }
    if (path === '/api/vault' && method === 'POST') {
      const b = await bodyJson(request);
      if (!b.castle_name || !b.account_name || !b.password) return reply(request, env, { error: 'castle_name, account_name, and password are required' }, 400);
      const now = today();
      const result = await env.DB.prepare('INSERT INTO castle_accounts (castle_name,account_name,password,realm,sitter,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(String(b.castle_name).trim(),String(b.account_name).trim(),b.password,b.realm || '',b.sitter || '',b.notes || '',now,now).run();
      const account = await env.DB.prepare('SELECT * FROM castle_accounts WHERE id=?').bind(result.meta.last_row_id).first();
      await recordActivity(env, { entity_type: 'vault', entity_id: account.id, action: 'created', description: 'Added vault account: ' + account.castle_name, before: null, after: account });
      return reply(request, env, account, 201);
    }
    match = path.match(/^\/api\/vault\/(\d+)$/);
    if (match && method === 'PUT') {
      const id = Number(match[1]), b = await bodyJson(request);
      const old = await env.DB.prepare('SELECT * FROM castle_accounts WHERE id=?').bind(id).first();
      if (!old) return reply(request, env, { error: 'Not found' }, 404);
      await env.DB.prepare('UPDATE castle_accounts SET castle_name=?,account_name=?,password=?,realm=?,sitter=?,notes=?,updated_at=? WHERE id=?')
        .bind(b.castle_name || old.castle_name,b.account_name || old.account_name,b.password || old.password,b.realm !== undefined ? b.realm : old.realm,b.sitter !== undefined ? b.sitter : old.sitter,b.notes !== undefined ? b.notes : old.notes,today(),id).run();
      const account = await env.DB.prepare('SELECT * FROM castle_accounts WHERE id=?').bind(id).first();
      const passwordChanged = b.password !== undefined && b.password !== old.password;
      const detail = 'Updated vault account: ' + account.castle_name + (passwordChanged ? ' (password changed; value excluded from history)' : '');
      await recordActivity(env, { entity_type: 'vault', entity_id: id, action: 'updated', description: detail, before: old, after: account, undoable: !passwordChanged });
      return reply(request, env, account);
    }
    if (match && method === 'DELETE') {
      const id = Number(match[1]);
      const account = await env.DB.prepare('SELECT * FROM castle_accounts WHERE id=?').bind(id).first();
      if (!account) return reply(request, env, { error: 'Vault entry not found' }, 404);
      await env.DB.prepare('UPDATE castle_accounts SET deleted_at=? WHERE id=?').bind(new Date().toISOString(), id).run();
      await recordActivity(env, { entity_type: 'vault', entity_id: id, action: 'deleted', description: 'Removed vault account: ' + account.castle_name, before: account, after: null });
      return reply(request, env, { success: true });
    }

    match = path.match(/^\/api\/gge\/(alliance|player)\/(\d+)(?:\/(members))?$/);
    if (match && method === 'GET') {
      const target = match[1] === 'player' ? `players/${match[2]}` : `alliances/${match[2]}${match[3] ? '/members' : ''}`;
      const response = await fetch(`${GGE_API}/${target}`, { headers: GGE_HEADERS });
      const payload = await response.text();
      return new Response(payload, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json', ...corsHeaders(request, env) } });
    }

    if (path === '/api/sync/status' && method === 'GET') {
      const row = await env.DB.prepare('SELECT last_sync_time,last_sync_status FROM sync_state WHERE id=1').first();
      return reply(request, env, { lastSyncTime: row?.last_sync_time || null, lastSyncStatus: row?.last_sync_status || 'Never synced', syncInProgress: false, ggeAllianceId: ALLIANCE_ID, ggeServer: GGE_SERVER, ggeAllianceUrl: `https://gge-tracker.com/alliance/${ALLIANCE_ID}?server=${GGE_SERVER}` });
    }
    if (path === '/api/sync/now' && method === 'POST') {
      try { return reply(request, env, await syncFromGGE(env)); }
      catch (error) { await env.DB.prepare('INSERT INTO sync_state (id,last_sync_time,last_sync_status) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET last_sync_time=excluded.last_sync_time,last_sync_status=excluded.last_sync_status').bind(new Date().toISOString(), `Error: ${error.message}`).run(); return reply(request, env, { success: false, error: error.message }, 502); }
    }

    return reply(request, env, { error: 'API route not found' }, 404);
  } catch (error) {
    return reply(request, env, { error: 'Server error', detail: error.message }, 500);
  }
}

export default {
  fetch(request, env, ctx) { return route(request, env, ctx); },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(syncFromGGE(env).catch(async error => {
      await env.DB.prepare('INSERT INTO sync_state (id,last_sync_time,last_sync_status) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET last_sync_time=excluded.last_sync_time,last_sync_status=excluded.last_sync_status')
        .bind(new Date().toISOString(), `Error: ${error.message}`).run();
    }));
  }
};
