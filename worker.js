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
      return json({ error: 'Not found' }, 404, request, env);
    } catch (err) {
      return json({ error: 'Server error' }, 500, request, env);
    }
  },
};
