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

    let match = path.match(/^\/api\/players\/(\d+)(?:\/(promote|demote|gge-link|events))?$/);
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
        await env.DB.prepare('UPDATE players SET rank = ? WHERE id = ?').bind(RANKS[next], id).run();
        return reply(request, env, { ...player, rank: RANKS[next] });
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
        return reply(request, env, await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first());
      }
      if (!action && method === 'DELETE') {
        await env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run();
        return reply(request, env, { success: true, message: 'Player removed' });
      }
    }

    if (path === '/api/players' && method === 'POST') {
      const b = await bodyJson(request);
      if (!String(b.name || '').trim()) return reply(request, env, { error: 'Player name is required' }, 400);
      const inserted = await env.DB.prepare('INSERT INTO players (name,rank,power,kingdom,last_active,contributions,notes,joined_date,status,gge_player_id) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(String(b.name).trim(), RANKS.includes(b.rank) ? b.rank : 'Member', num(b.power), num(b.kingdom,1), b.last_active || today(), num(b.contributions), b.notes || '', b.joined_date || today(), ['Active','Inactive','Warning','Kicked'].includes(b.status) ? b.status : 'Active', b.gge_player_id || '').run();
      return reply(request, env, await env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(inserted.meta.last_row_id).first(), 201);
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
      const old = await env.DB.prepare('SELECT id FROM event_scores WHERE player_id=? AND event_name=? AND event_date=?').bind(b.player_id,b.event_name,date).first();
      if (old) {
        await env.DB.prepare('UPDATE event_scores SET event_points=?,glory_points=?,event_rank=?,quota=?,notes=? WHERE id=?')
          .bind(num(b.event_points),num(b.glory_points),num(b.event_rank),num(b.quota),b.notes || '',old.id).run();
      } else {
        await env.DB.prepare('INSERT INTO event_scores (player_id,event_name,event_date,event_points,glory_points,event_rank,quota,notes) VALUES (?,?,?,?,?,?,?,?)')
          .bind(b.player_id,b.event_name,date,num(b.event_points),num(b.glory_points),num(b.event_rank),num(b.quota),b.notes || '').run();
      }
      return reply(request, env, { success: true });
    }
    match = path.match(/^\/api\/events\/score\/(\d+)$/);
    if (match && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM event_scores WHERE id=?').bind(Number(match[1])).run();
      return reply(request, env, { success: true });
    }

    if (path === '/api/vault' && method === 'GET') {
      const search = (url.searchParams.get('search') || '').trim();
      const result = search
        ? await env.DB.prepare('SELECT * FROM castle_accounts WHERE castle_name LIKE ? OR account_name LIKE ? OR sitter LIKE ? ORDER BY castle_name').bind(`%${search}%`,`%${search}%`,`%${search}%`).all()
        : await env.DB.prepare('SELECT * FROM castle_accounts ORDER BY castle_name').all();
      return reply(request, env, result.results || []);
    }
    if (path === '/api/vault' && method === 'POST') {
      const b = await bodyJson(request);
      if (!b.castle_name || !b.account_name || !b.password) return reply(request, env, { error: 'castle_name, account_name, and password are required' }, 400);
      const now = today();
      const result = await env.DB.prepare('INSERT INTO castle_accounts (castle_name,account_name,password,realm,sitter,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(String(b.castle_name).trim(),String(b.account_name).trim(),b.password,b.realm || '',b.sitter || '',b.notes || '',now,now).run();
      return reply(request, env, await env.DB.prepare('SELECT * FROM castle_accounts WHERE id=?').bind(result.meta.last_row_id).first(), 201);
    }
    match = path.match(/^\/api\/vault\/(\d+)$/);
    if (match && method === 'PUT') {
      const id = Number(match[1]), b = await bodyJson(request);
      const old = await env.DB.prepare('SELECT * FROM castle_accounts WHERE id=?').bind(id).first();
      if (!old) return reply(request, env, { error: 'Not found' }, 404);
      await env.DB.prepare('UPDATE castle_accounts SET castle_name=?,account_name=?,password=?,realm=?,sitter=?,notes=?,updated_at=? WHERE id=?')
        .bind(b.castle_name || old.castle_name,b.account_name || old.account_name,b.password || old.password,b.realm !== undefined ? b.realm : old.realm,b.sitter !== undefined ? b.sitter : old.sitter,b.notes !== undefined ? b.notes : old.notes,today(),id).run();
      return reply(request, env, await env.DB.prepare('SELECT * FROM castle_accounts WHERE id=?').bind(id).first());
    }
    if (match && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM castle_accounts WHERE id=?').bind(Number(match[1])).run();
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
