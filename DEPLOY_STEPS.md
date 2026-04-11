# Deploy Daiva Automobiles App — Step by Step

## ✅ App is fully built — just follow these 4 steps to go live

---

## STEP 1 — Set up Supabase Database (10 minutes)

1. Go to **https://supabase.com** → Sign in with GitHub
2. Click **New Project**
   - Name: `daiva-auto`
   - Region: **Southeast Asia (Singapore)** ← closest to India
   - Set a password and save it
3. Wait ~2 minutes for the project to start
4. Go to **SQL Editor** (left sidebar)
5. Open the file `src/lib/schema.sql` from this folder
6. Copy the entire contents → paste into SQL Editor → click **Run**
7. Go to **Project Settings → API**
8. Copy and save these 2 values:
   - **Project URL** (e.g. https://xxxx.supabase.co)
   - **anon public key** (long string starting with eyJ...)

---

## STEP 2 — Add logo images (2 minutes)

Copy your Daiva Automobiles logo files into the `public/assets/` folder:
- Dark logo → `public/assets/logo-dark.png`
- White logo → `public/assets/logo-white.png`

---

## STEP 3 — Install & run locally (5 minutes)

Open terminal in this `daiva-auto` folder:

```bash
npm install
```

Then edit `.env.local` and replace the placeholders with your Supabase values:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

Run the app locally:
```bash
npm run dev
```

Open http://localhost:5173 → you should see the PIN screen!

---

## STEP 4 — Deploy to Vercel (5 minutes)

```bash
# Initialize git and push to GitHub
git init
git add .
git commit -m "Daiva Automobiles POS - initial build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/daiva-auto.git
git push -u origin main
```

Then:
1. Go to **https://vercel.com** → Sign in with GitHub
2. Click **Add New Project** → Import `daiva-auto` repository
3. Add **Environment Variables**:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**
5. Your app is live at `https://daiva-auto.vercel.app`

---

## 📱 Add to Mobile (Android)

1. Open Chrome on your Android phone
2. Go to your Vercel URL
3. Tap ⋮ (three dots) → **Add to Home Screen**
4. The app installs like an app icon!

---

## 🔑 Default PIN: 6206

Change it in **Settings** after first login.

---

## What's built and working:
- ✅ PIN login (default: 6206)
- ✅ Inventory — add/edit/search parts (5 sample parts seeded)
- ✅ POS — search, cart, discount rules, tax toggle, Complete Sale
- ✅ Bill printing (A4 + 80mm thermal)
- ✅ Mechanic commission tracking + ledger
- ✅ Customer profiles + dues
- ✅ Expenses + Investment tracking
- ✅ Capital Recovery dashboard
- ✅ Reports dashboard (PIN protected, 7-day chart)
- ✅ Settings — change PIN, UPI ID, shop info
- ✅ UPI QR + WhatsApp share
- ✅ Works on mobile browser (PWA)
