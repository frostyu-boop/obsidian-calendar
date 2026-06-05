# Obsidian Calendar

A free, minimalist personal calendar that lives on your phone's home screen — no App Store, no account, no ads.

**→ Use it now: [obsidian-calendar.vercel.app](https://obsidian-calendar.vercel.app)**

---

## Features

- **Month & Week views** with smooth navigation
- **6 color-coded categories** — Work, Personal, Gym/Sport, Social, Travel, Other
- **Recurring events** — daily, weekly, monthly, or yearly, with automatic expansion across views
- **Notifications** — from "at event time" up to 1 day before (fires while the app is open)
- **Duplicate events** in one tap
- **All-day events**, location field, and notes
- **Cloud sync** — your events are saved to the cloud and survive app reinstalls
- **Multi-device sync** — share your calendar across your phone and computer using a single ID
- **Offline support** — works without internet, syncs automatically when reconnected
- **iPhone home screen widget** via the free Scriptable app
- **AI assistant** — share your calendar with Claude to add, edit, or reschedule events in plain language

---

## Install on iPhone

> ⚠️ You must use **Safari**. Chrome and other browsers do not support Add to Home Screen on iOS.

1. Open **Safari** and go to [obsidian-calendar.vercel.app](https://obsidian-calendar.vercel.app)
2. Tap the **Share button** (the square with an arrow, at the bottom of the screen)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right corner
5. The Obsidian icon appears on your home screen — it opens fullscreen with no browser bar

---

## Install on Android

1. Open **Chrome** and go to [obsidian-calendar.vercel.app](https://obsidian-calendar.vercel.app)
2. Tap the **three-dot menu** (top right)
3. Tap **"Add to Home screen"** or **"Install app"**
4. Tap **"Add"** or **"Install"** to confirm

Works with Chrome, Samsung Internet, and most modern Android browsers.

---

## Sync Your Calendar Across Devices

Each device gets its own private ID automatically on first launch. To use the same calendar on multiple devices:

1. On your **main device** — open the app → tap **⚙** (bottom right) → copy your **User ID**
2. On your **other device** — open the app → tap **⚙** → find **"Sync With Another Device"** → paste the ID → tap **Switch to this ID** → confirm
3. Both devices now share the same calendar and sync in real time

---

## iPhone Home Screen Widget

Show your upcoming events on the home screen using the free **Scriptable** app:

1. Download [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) from the App Store (free)
2. Open Scriptable → tap **+** (top right) → paste the entire contents of [`scriptable-widget.js`](./scriptable-widget.js)
3. At the top of the script, fill in your app URL and your User ID (found in ⚙ Settings)
4. Tap the **▶ Play** button to test — you should see your upcoming events
5. Name the script (e.g. "Obsidian Calendar") → tap **Done**
6. Long press your home screen → tap **+** → search **Scriptable** → choose **Medium** size → tap **Add Widget**
7. Long press the new widget → **Edit Widget** → select your script → done

---

## AI Assistant (Claude)

Use [Claude](https://claude.ai) as a natural language assistant for your calendar:

1. Open the app → **⚙** → tap **"Copy events for Claude"**
2. Paste in Claude and ask anything:
   - *"Add gym on Monday at 7am"*
   - *"What do I have this week?"*
   - *"Move my Tuesday meeting to Thursday afternoon"*
   - *"Find me a free hour on Friday"*
3. Claude replies with updated events
4. Go back to the app → **⚙** → **"Import Claude's changes"** → paste the reply → **Apply changes**

---

## Privacy

- Your events are stored under your private User ID in an [Upstash](https://upstash.com) Redis database
- No one can read your calendar without your ID
- No accounts, no email address, no tracking, no ads
- You can switch to a brand new ID at any time to start fresh

---

## Self-Hosting (Deploy Your Own Instance)

Want your own private version? Free, takes about 10 minutes.

### What you need
- A [GitHub](https://github.com) account (free)
- A [Vercel](https://vercel.com) account (free)

### Steps

**1 — Fork this repo**
Click **Fork** at the top right of this page.

**2 — Deploy to Vercel**
- Go to [vercel.com](https://vercel.com) → **New Project** → import your fork
- Click **Deploy** (Vercel detects Vite + React automatically)
- Wait ~30 seconds

**3 — Connect the database**
- In your Vercel project → **Storage** tab → **Create Database** → choose **Upstash**
- Name it anything → pick the region closest to you → **Create**
- Click **Connect Project** → select your repo → **Connect**
- Go to **Deployments** → three dots on the latest → **Redeploy**

**4 — Install on your phone**
Follow the iPhone or Android steps above using your new Vercel URL.

### Tech stack
- **Frontend** — React + Vite
- **API** — Vercel Serverless Functions
- **Database** — Upstash Redis (via Vercel integration)
- **Widget** — Scriptable (iOS)

---

*Open source. Built with React, Vercel, and Upstash.*
