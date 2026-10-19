# AWPT Website — Cloudflare Deploy Guide (ধাপে ধাপে)

**সিস্টেম:** 🌐 Website → **Cloudflare Pages** (static) | 🔧 API → **Worker** (`awpt-api`) | 🖼️ ছবি → **R2** | 🗄️ ডাটা → **D1**

> ⚠️ **মনে রেখো:** Binding শুধু **Worker**-এ যোগ করা যায়। "Worker that only has static assets" পেজে binding যোগ করা যায় না — তাই API-র জন্য **আলাদা Worker** বানাতে হবে (ধাপ ৪)।

## ধাপ ১ — Cloudflare অ্যাকাউন্ট
[dash.cloudflare.com](https://dash.cloudflare.com) → **Sign up** (ফ্রি)।

## ধাপ ২ — R2 বাকেট (ছবির স্টোরেজ)
1. Dashboard → **R2 Object Storage** → **Create bucket** → নাম: `awpt-images`
2. বাকেট খুলে → **Settings** → **Public access** → **Allow Access** (r2.dev)
3. Public URL কপি রাখো (যেমন `https://pub-abc123.r2.dev`)

## ধাপ ৩ — D1 ডাটাবেজ
1. **Workers & Pages** → বাম মেনু → **D1 SQL Database** → **Create** → নাম: `awpt-db`
2. ডাটাবেজ খুলে → **Console** → `schema.sql` ফাইলের কোড পেস্ট → **Execute**

## ধাপ ৪ — API Worker বানানো ⭐ (সবচেয়ে জরুরি)
1. **Workers & Pages** → **Create** → **Workers** ট্যাব → **Create Worker**
2. নাম দাও: `awpt-api` → **Deploy**
3. **Edit code** → ভেতরের সব কোড মুছে এই প্রজেক্টের **`worker.js`** ফাইলের পুরো কোড পেস্ট করো → **Save and deploy**
4. Worker URL নোট করো (উপরে দেখাবে): `https://awpt-api.<tomar-account>.workers.dev`
5. Worker → **Settings** → **Bindings**:
   - **R2 bucket bindings** → Add → Variable: `R2` → Bucket: `awpt-images`
   - **D1 database bindings** → Add → Variable: `DB` → Database: `awpt-db`
6. **Settings** → **Variables** → Add variable (২টি):
   - `ADMIN_TOKEN` = গোপন কোড (যেমন `awpt-secret-2026`)
   - `R2_PUBLIC_URL` = ধাপ ২-এর public URL

## ধাপ ৫ — Website ফাইলে Worker URL বসানো
1. `projects.js` ফাইল খুলে একদম উপরে `API_BASE` লাইনে ধাপ ৪-এর Worker URL বসাও:
   ```js
   const API_BASE = 'https://awpt-api.tomar-account.workers.dev';
   ```
2. সেভ করো।

## ধাপ ৬ — Pages-এ ওয়েবসাইট আপলোড (static only — binding লাগবে না)
1. **Workers & Pages** → **Create** → **Pages** ট্যাব → **Upload assets**
2. নাম: `awpt` → এই ফাইলগুলো আপলোড করো: `index.html`, `style.css`, `script.js`, `projects.js`, `admin.html`, `logo.jpg`, `service-*.jpg`, `schema.sql`, `DEPLOY-BN.md`
   (`worker.js` আপলোড করা লাগবে না — ওটা ধাপ ৪-এ আলাদা গেছে)
3. **Deploy** → সাইট লাইভ: `https://awpt.pages.dev` ✅

## ধাপ ৭ — Admin থেকে প্রজেক্ট যোগ
1. `https://awpt.pages.dev/admin.html` খুলো (লিংক সাইটে কোথাও নেই)
2. ধাপ ৪-এর **ADMIN_TOKEN** দাও → প্রবেশ
3. ছবি সিলেক্ট করে প্রজেক্ট যোগ করো → ছবি **R2**-তে, তথ্য **D1**-তে → সাইটে সাথে সাথে দেখা যাবে ✅
4. প্রজেক্ট তালিকায় প্রতিটি কার্ডে **✏️ এডিট** বাটন আছে — নাম, লোকেশন, স্ট্যাটাস, ছবি বদলানো/বাদ দেওয়া/নতুন ছবি যোগ করা যায়। বাদ দেওয়া ছবি R2 থেকেও মুছে যায়।
5. **⚙️ হেডিং সেটিংস** কার্ড থেকে "চলমান/সম্পন্ন প্রজেক্ট" হেডিং-এর লেখা বদলানো যায় (সেটিংস D1-তে সেভ থাকে, টেবিল নিজে নিজে তৈরি হয়ে যায়)।

## ফাইল পরিচিতি
| ফাইল | কাজ |
|---|---|
| `index.html` / `style.css` / `script.js` | পাবলিক ওয়েবসাইট |
| `projects.js` | শেয়ার্ড হেল্পার + **API_BASE** (Worker URL এখানে) |
| `admin.html` | প্রজেক্ট ম্যানেজার (গোপন) |
| `worker.js` | API Worker-এর কোড (Cloudflare-এ পেস্ট করতে হবে) |
| `schema.sql` | D1 টেবিল তৈরির কোড |

## সমস্যা হলে
- **ছবি দেখা না গেলে:** R2 → Public access চালু আছে কিনা দেখো।
- **401 error:** ADMIN_TOKEN ভুল / Worker-এ variable সেট হয়নি।
- **CORS error:** Worker-এ `ALLOWED_ORIGINS` variable যোগ করো (তোমার Pages URL)।
- **প্রজেক্ট লোড না হলে:** `projects.js`-এ API_BASE ঠিক আছে কিনা দেখো।
