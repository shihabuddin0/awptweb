/* ============ AWPT — shared project helpers ============
   Used by index.html (public viewer) and admin.html (project manager).
   Keep this file next to index.html and admin.html (same folder). */

/* ⬇️⬇️⬇️ এখানে তোমার Worker URL বসাও (deploy এর পর পাবে) ⬇️⬇️⬇️
   Example: 'https://awpt-api.tomar-account.workers.dev'
   NOTE: শেষে / থাকবে না, /api অংশও দেবে না — শুধু Worker URL. */
const API_BASE = 'https://base.sf-shihabuddin0.workers.dev';

const PROJECTS_KEY = 'awpt-projects-v1';

const FALLBACK_IMG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">' +
      '<rect width="100%" height="100%" fill="#e5e9f0"/>' +
      '<text x="50%" y="52%" font-size="34" text-anchor="middle" fill="#6b7280" font-family="sans-serif">ছবি পাওয়া যায়নি</text>' +
      '</svg>'
  );

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Sample projects shown when no projects.json exists yet.
   The owner replaces these with real projects via admin.html. */
function defaultProjects() {
  return [
    { id: uid(), title: 'বাসাবো রেসিডেন্স', location: 'ঢাকা', status: 'completed', images: ['service-roof.jpg'] },
    { id: uid(), title: 'উত্তরা কমার্শিয়াল ভবন', location: 'ঢাকা', status: 'ongoing', images: ['service-wall.jpg', 'service-heat.jpg'] },
    { id: uid(), title: 'সাভার ইন্ডাস্ট্রিয়াল ইউনিট', location: 'সাভার', status: 'completed', images: ['service-basement.jpg', 'service-roof.jpg'] },
  ];
}

/* "one link per line" (commas also work) -> clean array of URLs */
function parseImageLinks(text) {
  return String(text)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* wrap-around index for gallery navigation */
function stepIndex(i, n, dir) {
  return ((i + dir) % n + n) % n;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* swap broken images for a neutral placeholder (once) */
function guardImg(img) {
  img.addEventListener('error', function handler() {
    img.removeEventListener('error', handler);
    if (img.src !== FALLBACK_IMG) img.src = FALLBACK_IMG;
  });
}
