// ─────────────────────────────────────────────────────────────
//  OBSIDIAN CALENDAR — Scriptable Widget
//  Paste this entire file into Scriptable on your iPhone.
//  Then edit the two lines below with your real values.
// ─────────────────────────────────────────────────────────────

const APP_URL = "https://obsidian-calendar.vercel.app";   // ← your Vercel URL
const USER_ID = "PASTE_YOUR_UID_HERE";                    // ← from app ⚙ → copy UID

// ─────────────────────────────────────────────────────────────
//  CONFIG  (change these if you want)
// ─────────────────────────────────────────────────────────────
const MAX_EVENTS   = 5;      // how many events to show
const BG_COLOR     = "0D0D0D";
const ACCENT       = "7C6AF7";
const TEXT_PRI     = "DEDEDE";
const TEXT_SEC     = "484848";
const TEXT_BRAND   = "2A2A2A";

const CATS = {
  "Work":        "4F8EF7",
  "Personal":    "B57BF7",
  "Gym/Sport":   "3DBA7E",
  "Social":      "F7A45A",
  "Travel":      "4DBCD4",
  "Other":       "8B8B8B",
};

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function pad(n)  { return String(n).padStart(2,"0"); }
function fmtDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function c(hex)  { return new Color("#"+hex); }

function fmtTime(t) {
  if (!t) return "";
  const [h,m] = t.split(":").map(Number);
  return `${h%12||12}:${pad(m)} ${h>=12?"PM":"AM"}`;
}

function relDate(dateStr) {
  const today = fmtDate(new Date());
  const tom   = fmtDate(addDays(new Date(),1));
  if (dateStr === today) return "Today";
  if (dateStr === tom)   return "Tomorrow";
  const [y,mo,d] = dateStr.split("-").map(Number);
  const months   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[mo-1]} ${d}`;
}

// ─────────────────────────────────────────────────────────────
//  FETCH EVENTS
// ─────────────────────────────────────────────────────────────
let events = [];
try {
  const req = new Request(`${APP_URL}/api/events?uid=${USER_ID}`);
  req.timeoutInterval = 10;
  const res = await req.loadJSON();
  events = Array.isArray(res.events) ? res.events : [];
} catch (e) {
  events = [];
}

// Filter to upcoming, sorted
const today = fmtDate(new Date());
const upcoming = events
  .filter(e => e.endDate >= today)
  .sort((a,b) => {
    if (a.startDate !== b.startDate) return a.startDate > b.startDate ? 1 : -1;
    return (a.startTime||"") > (b.startTime||"") ? 1 : -1;
  })
  .slice(0, MAX_EVENTS);

// ─────────────────────────────────────────────────────────────
//  BUILD WIDGET
// ─────────────────────────────────────────────────────────────
const widget = new ListWidget();
widget.backgroundColor = c(BG_COLOR);
widget.setPadding(14, 16, 14, 16);
widget.url = APP_URL;

// ── Header ──────────────────────────────────────────────────
const header = widget.addStack();
header.layoutHorizontally();
header.centerAlignContent();

const brand = header.addText("OBSIDIAN");
brand.font = new Font("AvenirNext-Heavy", 9);
brand.textColor = c(TEXT_BRAND);

header.addSpacer();

const now  = new Date();
const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const dateLabel = header.addText(`${days[now.getDay()]} ${mons[now.getMonth()]} ${now.getDate()}`);
dateLabel.font = new Font("AvenirNext-DemiBold", 10);
dateLabel.textColor = c("484848");

widget.addSpacer(6);

// ── Thin divider ─────────────────────────────────────────────
const div = widget.addStack();
div.size = new Size(0, 1);
div.backgroundColor = c("1E1E1E");
widget.addSpacer(8);

// ── Events ───────────────────────────────────────────────────
if (upcoming.length === 0) {
  const empty = widget.addText("No upcoming events");
  empty.font  = new Font("AvenirNext-Regular", 12);
  empty.textColor = c("303030");
} else {
  for (const evt of upcoming) {
    const catColor = CATS[evt.category] || CATS["Other"];

    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();

    // Color bar
    const bar = row.addStack();
    bar.size = new Size(3, 34);
    bar.backgroundColor = c(catColor);
    bar.cornerRadius = 2;
    row.addSpacer(10);

    // Info
    const info = row.addStack();
    info.layoutVertically();

    const titleEl = info.addText(evt.title);
    titleEl.font      = new Font("AvenirNext-DemiBold", 12);
    titleEl.textColor = c(TEXT_PRI);
    titleEl.lineLimit = 1;

    const sub = evt.allDay
      ? relDate(evt.startDate)
      : `${relDate(evt.startDate)}  ${fmtTime(evt.startTime)}`;

    const subEl = info.addText(sub);
    subEl.font      = new Font("AvenirNext-Regular", 10);
    subEl.textColor = c(TEXT_SEC);

    widget.addSpacer(6);
  }
}

widget.addSpacer();

// ── Footer ───────────────────────────────────────────────────
const footer = widget.addStack();
footer.layoutHorizontally();
footer.addSpacer();
const tapHint = footer.addText("tap to open");
tapHint.font = new Font("AvenirNext-Regular", 8);
tapHint.textColor = c("2A2A2A");

// ─────────────────────────────────────────────────────────────
//  PRESENT
// ─────────────────────────────────────────────────────────────
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
