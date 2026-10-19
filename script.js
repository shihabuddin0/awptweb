/* ============ ADVANCED WATERPROOF TECHNOLOGY — site interactions ============ */

/* ---- Editable price list (BDT per square foot). Update these to your real rates. ---- */
const RATES = {
  roof:     { standard: 60, premium: 70 },
  wall:     { standard: 25, premium: 35 },
  heat:     { standard: 60, premium: 70 },
  basement: { standard: 60, premium: 70 },
};

const SERVICE_NAMES = {
  roof: 'রুফ ওয়াটারপ্রুফিং',
  wall: 'ওয়াল ড্যাম্প প্রুফিং',
  heat: 'হিট প্রুফিং',
  basement: 'বেসমেন্ট ওয়াটারপ্রুফিং',
};

const WHATSAPP_NUMBER = '8801724281865'; // 01724-281865

/* ---------- pure helpers (testable) ---------- */

function calculateEstimate(service, areaSqft, quality) {
  const area = Number(areaSqft);
  if (!RATES[service] || !RATES[service][quality] || !(area > 0)) return null;
  return Math.round(area * RATES[service][quality]);
}

function formatBDT(amount) {
  return '৳ ' + Number(amount).toLocaleString('en-IN');
}

function buildWhatsAppLink(number, message) {
  return 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
}

function buildQuoteMessage(service, area, quality, amount) {
  const qualityBn = quality === 'premium' ? 'প্রিমিয়াম' : 'স্ট্যান্ডার্ড';
  return (
    'আসসালামু আলাইকুম, আমি ওয়াটারপ্রুফিং সার্ভিসের জন্য খরচ জানতে চাই।\n' +
    'সার্ভিস: ' + service + '\n' +
    'এলাকা: ' + area + ' বর্গফুট\n' +
    'উপকরণ: ' + qualityBn + '\n' +
    'আনুমানিক খরচ: ' + formatBDT(amount)
  );
}

function validateContact(name, phone) {
  if (!String(name).trim()) return 'আপনার নাম লিখুন।';
  if (!/^01[3-9]\d{8}$/.test(String(phone).trim())) return 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (01XXXXXXXXX)।';
  return null;
}

function buildContactMessage(name, phone, service, message) {
  let text = 'আসসালামু আলাইকুম, আমি ' + name.trim() + ' (' + phone.trim() + ')।\n';
  text += 'সার্ভিস: ' + service + '\n';
  if (String(message).trim()) text += 'বিস্তারিত: ' + message.trim();
  return text;
}

/* ---------- DOM wiring ---------- */

const $ = (id) => document.getElementById(id);

function initMenu() {
  const toggle = $('nav-toggle');
  const menu = $('nav-menu');
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    menu.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
  menu.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  return { setOpen };
}

function initNavbar() {
  const navbar = $('navbar');
  if (!navbar) return;
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || !els.length) {
    els.forEach((el) => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

function initCalculator() {
  const serviceEl = $('calc-service');
  const areaEl = $('calc-area');
  const qualityEl = $('calc-quality');
  const btn = $('calc-btn');
  const resultEl = $('calc-result');
  const amountEl = $('calc-amount');
  const waLink = $('calc-whatsapp');
  if (!serviceEl || !areaEl || !qualityEl || !btn || !resultEl || !amountEl || !waLink) return;

  btn.addEventListener('click', () => {
    const service = serviceEl.value;
    const area = areaEl.value;
    const quality = qualityEl.value;
    const amount = calculateEstimate(service, area, quality);
    if (amount === null) {
      amountEl.textContent = 'সঠিক তথ্য দিন';
      resultEl.hidden = false;
      return;
    }
    amountEl.textContent = formatBDT(amount);
    waLink.href = buildWhatsAppLink(
      WHATSAPP_NUMBER,
      buildQuoteMessage(SERVICE_NAMES[service] || service, area, quality, amount)
    );
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function initContactForm() {
  const form = $('contact-form');
  if (!form) return;
  const nameEl = $('cf-name');
  const phoneEl = $('cf-phone');
  const serviceEl = $('cf-service');
  const messageEl = $('cf-message');
  const errorEl = $('form-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const error = validateContact(nameEl.value, phoneEl.value);
    if (error) {
      errorEl.textContent = error;
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    const link = buildWhatsAppLink(
      WHATSAPP_NUMBER,
      buildContactMessage(nameEl.value, phoneEl.value, serviceEl.value, messageEl.value)
    );
    window.open(link, '_blank', 'noopener');
  });
}

function initYear() {
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

/* ---------- init ---------- */
initMenu();
initNavbar();
initReveal();
initCalculator();
initContactForm();
initYear();

/* ================= Projects viewer + swipe gallery ================= */
/* Shared helpers (uid, defaultProjects, parseImageLinks, stepIndex,
   escapeHtml, guardImg, FALLBACK_IMG) come from projects.js */

let projects = [];
let lbImages = [];
let lbIndex = 0;
let lbTitle = '';

/* Load the project list from the Cloudflare Worker API (D1 database).
   Set your Worker URL in API_BASE (projects.js).
   Falls back to built-in samples when the API is unreachable. */
async function loadProjectsRemote() {
  try {
    const res = await fetch(API_BASE + '/api/projects', { cache: 'no-store' });
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    projects = Array.isArray(data) ? data : defaultProjects();
  } catch (err) {
    projects = defaultProjects();
  }
  renderProjects();
}

function projectCardHTML(p) {
  const images = Array.isArray(p.images) ? p.images : [];
  const cover = images[0] || FALLBACK_IMG;
  const badge =
    p.status === 'ongoing'
      ? '<span class="project-badge ongoing">🔨 চলমান</span>'
      : '<span class="project-badge completed">✅ সম্পন্ন</span>';
  return (
    '<article class="project-card" data-id="' + escapeHtml(p.id) + '">' +
      '<div class="project-cover">' +
        '<img src="' + escapeHtml(cover) + '" alt="' + escapeHtml(p.title) + '" loading="lazy">' +
        badge +
      '</div>' +
      '<div class="project-body">' +
        '<h3>' + escapeHtml(p.title) + '</h3>' +
        '<p class="project-loc">📍 ' + escapeHtml(p.location) + '</p>' +
        '<p class="project-count">🖼️ ' + images.length + 'টি ছবি</p>' +
        '<button type="button" class="btn btn-primary project-view" data-view="' + escapeHtml(p.id) + '">সব ছবি দেখুন</button>' +
      '</div>' +
    '</article>'
  );
}

function renderProjects() {
  renderCarousel('ongoing', $('pcar-ongoing'), $('empty-ongoing'), $('pcount-ongoing'));
  renderCarousel('completed', $('pcar-completed'), $('empty-completed'), $('pcount-completed'));
}

function renderCarousel(status, track, emptyEl, badgeEl) {
  if (!track) return;
  const list = projects.filter((p) => p.status === status);
  track.innerHTML = list.map(projectCardHTML).join('');
  track.querySelectorAll('img').forEach(guardImg);
  if (emptyEl) emptyEl.hidden = list.length > 0;
  if (badgeEl) badgeEl.textContent = toBn(list.length) + 'টি';
}

/* Count-up animation for stat numbers: 0 -> target with easing.
   Reads the current text (supports suffixes like +/%, Bengali digits),
   runs once when the stats panel scrolls into view. */
function animateCount(el) {
  const raw = (el.textContent || '').trim();
  const bnDigits = /[০-৯]/.test(raw);
  const norm = raw.replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const m = norm.match(/^(\d+)(.*)$/);
  if (!m) return;
  const target = parseInt(m[1], 10);
  const suffix = m[2] || '';
  const fmt = (n) => (bnDigits ? toBn(n) : String(n)) + suffix;
  if (typeof requestAnimationFrame !== 'function') { el.textContent = raw; return; }
  const dur = 1600;
  let start = null;
  const step = (now) => {
    if (start === null) start = now;
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = raw;
  };
  requestAnimationFrame(step);
}

function initStatCountUp() {
  if (!('IntersectionObserver' in window)) return;
  const panel = document.querySelector('.stats-grid');
  if (!panel) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      if (reduce) return;
      panel.querySelectorAll('[data-count]').forEach(animateCount);
    });
  }, { threshold: 0.25 });
  io.observe(panel);
}

/* Section headings (চলমান/সম্পন্ন) are editable from the admin panel.
   Falls back to the built-in defaults when the API is unreachable. */
async function loadSettingsRemote() {
  try {
    const res = await fetch(API_BASE + '/api/settings', { cache: 'no-store' });
    if (!res.ok) return;
    const s = await res.json();
    if (s.ongoing_title && $('ptitle-ongoing')) $('ptitle-ongoing').textContent = s.ongoing_title;
    if (s.completed_title && $('ptitle-completed')) $('ptitle-completed').textContent = s.completed_title;
    for (let i = 1; i <= 4; i++) {
      const vEl = $('stat' + i + '-value'), lEl = $('stat' + i + '-label');
      if (s['stat' + i + '_value'] && vEl) vEl.textContent = s['stat' + i + '_value'];
      if (s['stat' + i + '_label'] && lEl) lEl.textContent = s['stat' + i + '_label'];
    }
  } catch (e) { /* keep defaults */ }
}

/* ---------- lightbox gallery ---------- */

function openLightbox(project, startIndex) {
  const lb = $('lightbox');
  if (!lb || !project || !Array.isArray(project.images) || !project.images.length) return;
  lbImages = project.images.slice();
  lbTitle = project.title;
  lbIndex = startIndex || 0;
  lb.hidden = false;
  void lb.offsetWidth; /* restart fade transition */
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  const titleEl = $('lb-title');
  if (titleEl) titleEl.textContent = lbTitle;
  renderLbDots();
  showLbImage(1);
}

function renderLbDots() {
  const dots = $('lb-dots');
  if (!dots) return;
  dots.innerHTML = '';
  lbImages.forEach((_, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('aria-label', 'ছবি ' + (i + 1));
    d.addEventListener('click', () => {
      const dir = i === lbIndex ? 0 : i > lbIndex ? 1 : -1;
      lbIndex = i;
      showLbImage(dir || 1);
    });
    dots.appendChild(d);
  });
}

function setLbLoading(show) {
  const l = $('lb-loading');
  if (l) l.hidden = !show;
}

function showLbImage(dir) {
  const img = $('lb-img');
  if (!img || !lbImages.length) return;
  img.classList.remove('slide-l', 'slide-r');
  void img.offsetWidth; /* restart slide animation */
  img.classList.add(dir < 0 ? 'slide-l' : 'slide-r');
  guardImg(img);
  const src = lbImages[lbIndex];
  img.alt = lbTitle + ' — ছবি ' + (lbIndex + 1);
  const counter = $('lb-counter');
  if (counter) counter.textContent = lbIndex + 1 + ' / ' + lbImages.length;
  const dots = document.querySelectorAll('#lb-dots button');
  dots.forEach((d, i) => d.classList.toggle('is-active', i === lbIndex));
  /* load through a preloader: spinner until the NEW photo actually arrives,
     so fast swipes never leave a stale photo on screen */
  setLbLoading(true);
  const apply = () => {
    if (lbImages[lbIndex] === src) {
      img.src = src;
      setLbLoading(false);
    }
  };
  try {
    if (typeof Image === 'undefined') throw new Error('no Image');
    const pre = new Image();
    pre.onload = apply;
    pre.onerror = apply;
    pre.src = src;
  } catch (e) { apply(); }
  /* preload neighbours: the next swipe is instant */
  [1, -1].forEach((d) => {
    try {
      const n = stepIndex(lbIndex, lbImages.length, d);
      if (n !== lbIndex && typeof Image !== 'undefined') {
        const im = new Image();
        im.src = lbImages[n];
      }
    } catch (e) {}
  });
}

function lbGo(dir) {
  if (lbImages.length < 2) return;
  lbIndex = stepIndex(lbIndex, lbImages.length, dir);
  showLbImage(dir);
}

function closeLightbox() {
  const lb = $('lightbox');
  if (!lb) return;
  setLbLoading(false);
  lb.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { lb.hidden = true; }, 300);
  lbImages = [];
}

function initProjects() {
  /* carousel arrow buttons: slide one card at a time */
  document.querySelectorAll('.pcar-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const track = document.getElementById(btn.dataset.car);
      if (!track) return;
      const card = track.querySelector('.project-card');
      const step = card ? card.offsetWidth + 20 : 320;
      track.scrollBy({ left: step * Number(btn.dataset.dir), behavior: 'smooth' });
    });
  });

  /* "view all photos" on any card, in either carousel */
  ['pcar-ongoing', 'pcar-completed'].forEach((id) => {
    const track = $(id);
    if (track) {
      track.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('[data-view]');
        if (viewBtn) {
          const p = projects.find((x) => String(x.id) === viewBtn.dataset.view);
          if (p) openLightbox(p, 0);
        }
      });
    }
  });

  const lb = $('lightbox');
  if (lb) {
    $('lb-close').addEventListener('click', closeLightbox);
    $('lb-prev').addEventListener('click', () => lbGo(-1));
    $('lb-next').addEventListener('click', () => lbGo(1));
    lb.addEventListener('click', (e) => {
      if (e.target === lb) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') lbGo(-1);
      else if (e.key === 'ArrowRight') lbGo(1);
    });

    /* finger swipe */
    const stage = $('lb-stage');
    let touchX = null;
    stage.addEventListener('touchstart', (e) => {
      touchX = e.touches[0].clientX;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) lbGo(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  loadProjectsRemote();
  loadSettingsRemote();
  initStatCountUp();
}

/* ---------- YouTube videos ---------- */
function videoCardHTML(v) {
  let dateStr = '';
  if (v.published) {
    const d = new Date(v.published);
    if (!isNaN(d)) {
      try { dateStr = d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }); }
      catch (e) { dateStr = v.published.slice(0, 10); }
    } else {
      dateStr = v.published; /* relative label like "3 days ago" */
    }
  }
  return '<button type="button" class="vcard" data-video="' + escapeHtml(v.id) +
    '" data-vtitle="' + escapeHtml(v.title) + '">' +
    '<span class="vthumb"><img src="' + escapeHtml(v.thumb) + '" alt="" loading="lazy">' +
    '<span class="vplay"></span></span>' +
    '<span class="vtitle">' + escapeHtml(v.title) + '</span>' +
    (dateStr ? '<span class="vdate">' + escapeHtml(dateStr) + '</span>' : '') +
    '</button>';
}

function renderVideos(list) {
  const track = $('vcarousel');
  if (!track) return;
  track.innerHTML = list.map(videoCardHTML).join('');
  track.querySelectorAll('img').forEach(guardImg);
}

async function loadVideos() {
  const sec = $('videos');
  if (!sec) return;
  try {
    const res = await fetch(API_BASE + '/api/videos', { cache: 'no-store' });
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) return;
    renderVideos(list);
    sec.hidden = false;
  } catch (e) { /* section stays hidden */ }
}

let vdx = 0, vdy = 0;
let ytPlayer = null, ytApiPromise = null, seekTimer = null, currentVideoId = '';

/* Load the YouTube IFrame API once (lets us hide ALL YouTube UI) */
function ensureYTApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(true); return; }
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    try {
      window.onYouTubeIframeAPIReady = () => finish(true);
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => finish(false);
      document.head.appendChild(s);
    } catch (e) { finish(false); return; }
    setTimeout(() => finish(!!(window.YT && window.YT.Player)), 8000);
  });
  return ytApiPromise;
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

function setLoading(show) {
  const l = $('vloading');
  if (l) l.hidden = !show;
}

function setPPBtn(playing) {
  const b = $('vpp');
  if (b) { b.textContent = playing ? '⏸' : '▶'; b.setAttribute('aria-label', playing ? 'থামান' : 'চালান'); }
}

function updateSeek() {
  if (!ytPlayer || !ytPlayer.getDuration) return;
  let dur = 0, cur = 0;
  try { dur = ytPlayer.getDuration() || 0; cur = ytPlayer.getCurrentTime() || 0; } catch (e) {}
  const seek = $('vseek'), time = $('vtime');
  if (seek && dur > 0 && document.activeElement !== seek) {
    seek.value = Math.round((cur / dur) * 1000);
  }
  if (time) time.textContent = fmtTime(cur) + ' / ' + fmtTime(dur);
}

function startSeekTimer() {
  stopSeekTimer();
  seekTimer = setInterval(updateSeek, 500);
}
function stopSeekTimer() {
  if (seekTimer) { clearInterval(seekTimer); seekTimer = null; }
}

function onPlayerState(e) {
  const st = e && e.data;
  const replay = $('vreplay');
  if (st === 1) { /* playing */
    setLoading(false);
    setPPBtn(true);
    if (replay) replay.hidden = true;
    startSeekTimer(); updateSeek();
  } else if (st === 2) { /* paused */
    setLoading(false);
    setPPBtn(false); stopSeekTimer(); updateSeek();
  } else if (st === 3) { /* buffering */
    setLoading(true);
  } else if (st === 0) { /* ended: show OUR replay, never YouTube's end screen */
    setLoading(false);
    setPPBtn(false); stopSeekTimer(); updateSeek();
    if (replay) replay.hidden = false;
  }
}

function closePlayerOnly() {
  stopSeekTimer();
  setLoading(false);
  try { if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy(); } catch (e) {}
  ytPlayer = null;
  const holder = $('vframe-holder');
  if (holder) holder.innerHTML = '<div id="vframe"></div>';
}

async function openVideo(id, title) {
  const modal = $('vmodal'), player = $('vplayer');
  if (!modal || !player || !id) return;
  closePlayerOnly();
  currentVideoId = id;
  $('vplayer-title').textContent = '▶ ' + (title || 'ভিডিও');
  const replay = $('vreplay');
  if (replay) replay.hidden = true;
  setLoading(true);
  setPPBtn(false);
  const seek = $('vseek');
  if (seek) seek.value = 0;
  const time = $('vtime');
  if (time) time.textContent = '0:00 / 0:00';
  vdx = 0; vdy = 0;
  player.style.transform = '';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  const ok = await ensureYTApi();
  if (!ok || modal.hidden || currentVideoId !== id || !window.YT || !window.YT.Player) {
    /* fallback: plain chromeless embed */
    const holder = $('vframe-holder');
    if (holder && !modal.hidden && currentVideoId === id) {
      holder.innerHTML = '<iframe title="ইউটিউব ভিডিও" frameborder="0" ' +
        'allow="accelerometer; autoplay; encrypted-media; picture-in-picture" ' +
        'src="https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&controls=0&disablekb=1&fs=0"></iframe>';
      const fr = holder.querySelector('iframe');
      if (fr) fr.addEventListener('load', () => setLoading(false));
    }
    return;
  }
  try {
    ytPlayer = new window.YT.Player('vframe', {
      videoId: id,
      playerVars: {
        autoplay: 1, controls: 0, disablekb: 1, fs: 0,
        iv_load_policy: 3, modestbranding: 1, rel: 0, playsinline: 1,
      },
      events: {
        onReady: (ev) => { try { ev.target.playVideo(); } catch (e) {} updateSeek(); },
        onStateChange: onPlayerState,
      },
    });
  } catch (e) { ytPlayer = null; }
}

function closeVideo() {
  const modal = $('vmodal');
  if (!modal) return;
  closePlayerOnly();
  currentVideoId = '';
  modal.hidden = true;
  document.body.style.overflow = '';
}

function initVideos() {
  const track = $('vcarousel');
  if (track) {
    track.addEventListener('click', (e) => {
      const card = e.target.closest('[data-video]');
      if (card) openVideo(card.dataset.video, card.dataset.vtitle);
    });
  }
  const modal = $('vmodal');
  if (modal) {
    const closeBtn = $('vclose');
    if (closeBtn) closeBtn.addEventListener('click', closeVideo);
    const bg = modal.querySelector('[data-vclose]');
    if (bg) bg.addEventListener('click', closeVideo);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeVideo();
    });
  }
  /* custom play/pause */
  const pp = $('vpp');
  if (pp) pp.addEventListener('click', () => {
    if (!ytPlayer) return;
    try {
      if (ytPlayer.getPlayerState() === 1) ytPlayer.pauseVideo();
      else ytPlayer.playVideo();
    } catch (e) {}
  });
  /* custom seek bar */
  const seek = $('vseek');
  if (seek) {
    const doSeek = () => {
      if (!ytPlayer || !ytPlayer.getDuration) return;
      try {
        const dur = ytPlayer.getDuration() || 0;
        if (dur > 0) ytPlayer.seekTo((Number(seek.value) / 1000) * dur, true);
      } catch (e) {}
      updateSeek();
    };
    seek.addEventListener('input', doSeek);
    seek.addEventListener('change', doSeek);
  }
  /* custom replay (instead of YouTube's end screen) */
  const replay = $('vreplay');
  if (replay) replay.addEventListener('click', () => {
    replay.hidden = true;
    if (ytPlayer) {
      try { ytPlayer.seekTo(0, true); ytPlayer.playVideo(); } catch (e) {}
    }
  });
  /* drag the player around by its header */
  const player = $('vplayer'), head = $('vplayer-head');
  if (player && head) {
    let dragging = false, sx = 0, sy = 0;
    head.addEventListener('pointerdown', (e) => {
      dragging = true; sx = e.clientX - vdx; sy = e.clientY - vdy;
      try { head.setPointerCapture(e.pointerId); } catch (err) {}
    });
    head.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const w = player.offsetWidth || 300, h = player.offsetHeight || 200;
      const vw = window.innerWidth, vh = window.innerHeight;
      let nx = e.clientX - sx, ny = e.clientY - sy;
      nx = Math.max(-(w - 90) - (vw - w) / 2, Math.min((vw - 90) - (vw - w) / 2, nx));
      ny = Math.max(-(h - 70) - (vh - h) / 2, Math.min((vh - 70) - (vh - h) / 2, ny));
      vdx = nx; vdy = ny;
      player.style.transform = 'translate(' + nx + 'px,' + ny + 'px)';
    });
    const stop = () => { dragging = false; };
    head.addEventListener('pointerup', stop);
    head.addEventListener('pointercancel', stop);
  }
}

/* ---------- init ---------- */
initProjects();
initVideos();
loadVideos();
