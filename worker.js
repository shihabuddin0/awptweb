/* ============================================================
   AWPT API Worker — single-file Cloudflare Worker
   ------------------------------------------------------------
   Deploy (dashboard only, no CLI needed):
   1. dash.cloudflare.com → Workers & Pages → Create → Workers tab
      → Create Worker → name it `awpt-api` → Deploy
   2. Click "Edit code" → delete everything → paste THIS file
      → Save and deploy
   3. Worker → Settings → Bindings:
        - R2 bucket binding:  Variable name `R2` → your bucket
        - D1 database binding: Variable name `DB` → your database
      Settings → Variables:
        - ADMIN_TOKEN   = your secret admin token
        - R2_PUBLIC_URL = your bucket's public r2.dev URL
        - ALLOWED_ORIGINS (optional) = https://awpt.pages.dev,https://example.com
   4. Your Worker URL will look like:
        https://awpt-api.<your-account>.workers.dev
      Put that URL in projects.js (API_BASE) on the website.
   ============================================================ */

const MAX_UPLOAD_SIZE = 8 * 1024 * 1024; // 8 MB per image

function isAdmin(request, env) {
  const token = request.headers.get('x-admin-token');
  return !!token && !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

/* CORS: the website (Pages / any host) talks to this Worker cross-origin */
function corsHeaders(request, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Max-Age': '86400',
  };
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin || allowed.length === 0 || allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
    if (origin) headers['Vary'] = 'Origin';
  } else {
    headers['Access-Control-Allow-Origin'] = 'null';
  }
  return headers;
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      corsHeaders(request, env)
    ),
  });
}

/* delete R2 objects that belong to this project (keys under projects/) */
async function deleteOwnR2(env, urls) {
  const base = String(env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (!base) return;
  for (const url of urls || []) {
    if (typeof url === 'string' && url.startsWith(base + '/')) {
      const key = decodeURIComponent(url.slice(base.length + 1));
      if (key.startsWith('projects/')) {
        try { await env.R2.delete(key); } catch (e) { /* ignore */ }
      }
    }
  }
}

function toPublic(row) {
  let images = [];
  try {
    const parsed = JSON.parse(row.images || '[]');
    if (Array.isArray(parsed)) images = parsed;
  } catch (e) { /* keep empty */ }
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    status: row.status,
    images,
  };
}

async function handleGetProjects(request, env) {
  const { results } = await env.DB.prepare(
    'SELECT id, title, location, status, images FROM projects ORDER BY created_at DESC'
  ).all();
  return json((results || []).map(toPublic), 200, request, env);
}

async function handleCreateProject(request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401, request, env);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400, request, env);
  }
  const title = String(body.title || '').trim();
  const location = String(body.location || '').trim();
  const status = body.status === 'completed' ? 'completed' : 'ongoing';
  const images = Array.isArray(body.images)
    ? body.images.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 20)
    : [];
  if (!title || !location || !images.length) {
    return json({ error: 'title, location and at least one image are required' }, 400, request, env);
  }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  await env.DB.prepare(
    'INSERT INTO projects (id, title, location, status, images, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, title, location, status, JSON.stringify(images), Date.now())
    .run();
  return json({ id, title, location, status, images }, 201, request, env);
}

async function handleDeleteProject(id, request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401, request, env);

  /* fetch the project's images first, so we can clean up R2 */
  let images = [];
  try {
    const row = await env.DB.prepare('SELECT images FROM projects WHERE id = ?')
      .bind(id)
      .first();
    if (row && row.images) {
      const parsed = JSON.parse(row.images);
      if (Array.isArray(parsed)) images = parsed;
    }
  } catch (e) { /* continue with delete anyway */ }

  await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();

  await deleteOwnR2(env, images);
  return json({ ok: true }, 200, request, env);
}

/* PUT /api/projects/:id — edit title/location/status/images.
   Removed images that live in our R2 bucket are deleted automatically. */
async function handleUpdateProject(id, request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401, request, env);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400, request, env);
  }
  const title = String(body.title || '').trim();
  const location = String(body.location || '').trim();
  const status = body.status === 'completed' ? 'completed' : 'ongoing';
  const images = Array.isArray(body.images)
    ? body.images.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 20)
    : [];
  if (!title || !location || !images.length) {
    return json({ error: 'title, location and at least one image are required' }, 400, request, env);
  }

  const row = await env.DB.prepare('SELECT images FROM projects WHERE id = ?')
    .bind(id)
    .first();
  if (!row) return json({ error: 'Not found' }, 404, request, env);
  let oldImages = [];
  try {
    const parsed = JSON.parse(row.images || '[]');
    if (Array.isArray(parsed)) oldImages = parsed;
  } catch (e) { /* keep empty */ }

  await env.DB.prepare(
    'UPDATE projects SET title = ?, location = ?, status = ?, images = ? WHERE id = ?'
  )
    .bind(title, location, status, JSON.stringify(images), id)
    .run();

  const removed = oldImages.filter((u) => !images.includes(u));
  await deleteOwnR2(env, removed);

  return json({ id, title, location, status, images }, 200, request, env);
}

async function handleUpload(request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401, request, env);
  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return json({ error: 'Invalid form data' }, 400, request, env);
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return json({ error: 'No file uploaded' }, 400, request, env);
  }
  if (!String(file.type || '').startsWith('image/')) {
    return json({ error: 'Only image files are allowed' }, 400, request, env);
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return json({ error: 'File too large (max 8MB)' }, 413, request, env);
  }
  const rawExt = String(file.name || '').split('.').pop() || 'jpg';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const key = 'projects/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;

  await env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  const base = String(env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  const url = base ? base + '/' + key : key;
  return json({ url, key }, 201, request, env);
}

/* ---- site settings (editable section headings) ---- */
const DEFAULT_SETTINGS = {
  ongoing_title: '🔨 চলমান প্রজেক্ট',
  completed_title: '✅ সম্পন্ন প্রজেক্ট',
  stat1_value: '500+', stat1_label: 'সম্পন্ন প্রজেক্ট',
  stat2_value: '100%', stat2_label: 'সন্তুষ্ট গ্রাহক',
  stat3_value: '25+', stat3_label: 'বছরের ওয়ারেন্টি',
  stat4_value: '10+', stat4_label: 'বছরের অভিজ্ঞ টিম',
  yt_channel: 'https://www.youtube.com/@awptbd',
};
const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

async function ensureSettingsTable(env) {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  ).run();
}

async function handleGetSettings(request, env) {
  const out = Object.assign({}, DEFAULT_SETTINGS);
  try {
    const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
    for (const row of results || []) {
      if (SETTING_KEYS.includes(row.key) && typeof row.value === 'string') out[row.key] = row.value;
    }
  } catch (e) { /* table missing -> defaults */ }
  return json(out, 200, request, env);
}

async function handlePutSettings(request, env) {
  if (!isAdmin(request, env)) return json({ error: 'Unauthorized' }, 401, request, env);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400, request, env);
  }
  await ensureSettingsTable(env);
  for (const k of SETTING_KEYS) {
    if (typeof body[k] === 'string' && body[k].trim()) {
      await env.DB.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).bind(k, body[k].trim().slice(0, 60)).run();
    }
  }
  return await handleGetSettings(request, env);
}

/* ---- YouTube channel videos (no API key: public RSS feed) ---- */
const YT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}

async function resolveChannelId(channelUrl) {
  let m = String(channelUrl || '').match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (m) return m[1];
  const html = await (await fetch(channelUrl, { headers: { 'User-Agent': YT_UA } })).text();
  m = html.match(/"channelId":"(UC[\w-]{22})"/)
    || html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/);
  if (m) return m[1] || m[2];
  throw new Error('channel not found');
}

function parseRss(xml) {
  const videos = [];
  const entries = String(xml || '').match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const e of entries.slice(0, 20)) {
    const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    if (!id) continue;
    const title = (e.match(/<title>([^<]*)<\/title>/) || [])[1];
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
    videos.push({
      id: id.trim(),
      title: decodeXml(title || 'Untitled').trim() || 'Untitled',
      published: (published || '').trim(),
      thumb: 'https://i.ytimg.com/vi/' + id.trim() + '/hqdefault.jpg',
    });
  }
  return videos;
}

async function handleGetVideos(request, env) {
  try {
    let channelUrl = DEFAULT_SETTINGS.yt_channel;
    try {
      const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'yt_channel'").first();
      if (row && row.value) channelUrl = row.value;
    } catch (e) { /* settings table missing -> default */ }

    /* serve from cache when fresh */
    const cacheKey = 'https://awpt-video-cache/videos?c=' + encodeURIComponent(channelUrl);
    try {
      if (typeof caches !== 'undefined') {
        const hit = await caches.default.match(cacheKey);
        if (hit) return json(await hit.json(), 200, request, env);
      }
    } catch (e) { /* ignore cache errors */ }

    const channelId = await resolveChannelId(channelUrl);
    const rss = await (await fetch(
      'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId,
      { headers: { 'User-Agent': YT_UA } }
    )).text();
    const videos = parseRss(rss);

    const res = json(videos, 200, request, env);
    try {
      if (typeof caches !== 'undefined' && videos.length) {
        const toCache = new Response(JSON.stringify(videos), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
        });
        await caches.default.put(cacheKey, toCache);
      }
    } catch (e) { /* ignore cache errors */ }
    return res;
  } catch (err) {
    return json([], 200, request, env);
  }
}

export default {
  async fetch(request, env) {
    /* CORS preflight */
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/auth-check') {
        if (!isAdmin(request, env)) return json({ ok: false }, 401, request, env);
        return json({ ok: true }, 200, request, env);
      }
      if (path === '/api/projects' && request.method === 'GET') {
        return await handleGetProjects(request, env);
      }
      if (path === '/api/projects' && request.method === 'POST') {
        return await handleCreateProject(request, env);
      }
      const m = path.match(/^\/api\/projects\/([^/]+)$/);
      if (m && request.method === 'DELETE') {
        return await handleDeleteProject(decodeURIComponent(m[1]), request, env);
      }
      if (m && request.method === 'PUT') {
        return await handleUpdateProject(decodeURIComponent(m[1]), request, env);
      }
      if (path === '/api/upload' && request.method === 'POST') {
        return await handleUpload(request, env);
      }
      if (path === '/api/settings' && request.method === 'GET') {
        return await handleGetSettings(request, env);
      }
      if (path === '/api/settings' && request.method === 'PUT') {
        return await handlePutSettings(request, env);
      }
      if (path === '/api/videos' && request.method === 'GET') {
        return await handleGetVideos(request, env);
      }
      return json({ error: 'Not found' }, 404, request, env);
    } catch (err) {
      return json({ error: 'Server error' }, 500, request, env);
    }
  },
};
