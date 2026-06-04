[README.md](https://github.com/user-attachments/files/28603750/README.md)
# Obsidian Calendar v2 — Setup Guide

## What's new in v2
- ☁️ Cloud sync via Vercel KV (your events live in the cloud)
- 🤖 Claude can read & edit your events directly
- 📱 Scriptable widget for your iPhone home screen

---

## Step 1 — Upload to GitHub (replace old files)

1. Go to your `obsidian-calendar` repository on GitHub
2. For each file below, click it → Edit (pencil icon) → paste new content → Commit:
   - `src/App.jsx`
   - `package.json`
3. For the new file `api/events.js`:
   - Click **Add file → Create new file**
   - Name: `api/events.js`
   - Paste the content → Commit
4. Vercel will auto-redeploy (wait ~30 seconds)

---

## Step 2 — Set up Vercel KV (free database)

1. Go to [vercel.com](https://vercel.com) → open your `obsidian-calendar` project
2. Click the **Storage** tab
3. Click **Create Database** → choose **KV**
4. Name it anything (e.g. `calendar-db`) → click **Create & Continue**
5. On the next screen click **Connect Project** → select `obsidian-calendar` → **Connect**
6. Go to the **Deployments** tab → click the three dots on the latest deployment → **Redeploy**

That's it — Vercel automatically injects the KV credentials. No API keys to copy.

---

## Step 3 — Get your User ID

1. Open your calendar app in Safari on iPhone
2. Tap **⚙** (bottom right)
3. Tap **Copy** next to your User ID
4. Save it somewhere safe — you'll need it for Claude and for the widget

---

## Step 4 — Let Claude manage your calendar

1. Open [claude.ai](https://claude.ai)
2. Say: *"My Obsidian Calendar UID is [paste your UID here]"*
3. Claude will save it and can now:
   - Read all your events
   - Add new events
   - Edit or delete existing ones
   - Find free time slots
   - Do anything you'd ask a personal assistant

---

## Step 5 — Set up the Scriptable widget

1. Download **Scriptable** from the App Store (free)
2. Open Scriptable → tap **+** (top right) → paste the entire content of `scriptable-widget.js`
3. At the top of the script, fill in:
   ```
   const APP_URL = "https://your-app.vercel.app";   // your real Vercel URL
   const USER_ID = "paste-your-uid-here";            // from Step 3
   ```
4. Tap the **Play ▶** button to test — you should see your upcoming events
5. Name the script (e.g. "Obsidian Calendar") → tap **Done**

**Add widget to home screen:**
1. Long press your iPhone home screen → tap **+** (top left)
2. Search for **Scriptable**
3. Choose **Medium** size → tap **Add Widget**
4. Long press the new widget → **Edit Widget**
5. Under Script, select **Obsidian Calendar**
6. Tap anywhere to save

---

## Privacy notes

- Your User ID is your only credential — treat it like a password
- Vercel KV stores your events as encrypted data at rest
- Only someone with your UID can read your events
- To revoke access: go to app ⚙ → generate a new UID (coming in a future update)
- Vercel KV free tier: 30,000 requests/day — far more than you'll ever use
