import { Redis } from "@upstash/redis";
import webpush from "web-push";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ─── helpers ────────────────────────────────────────────────
const pad = n => String(n).padStart(2, "0");

function fmtDateInTZ(utcMs, tzOffsetMinutes) {
  const local = new Date(utcMs + tzOffsetMinutes * 60000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

function nowMinutesInTZ(utcMs, tzOffsetMinutes) {
  const local = new Date(utcMs + tzOffsetMinutes * 60000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

// ─── handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verify the call is from our cron-job.org job
  const auth = req.headers["authorization"] || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: "VAPID not configured" });
  }

  const nowUtc = Date.now();
  let sent = 0, errors = 0;

  try {
    // Get all subscriber UIDs
    const uids = await redis.smembers("subscribers");
    if (!uids || uids.length === 0) return res.status(200).json({ ok: true, sent: 0 });

    for (const uid of uids) {
      try {
        // Load subscription + timezone
        const subRaw = await redis.get(`sub:${uid}`);
        if (!subRaw) continue;
        const { subscription, timezone } = typeof subRaw === "string"
          ? JSON.parse(subRaw) : subRaw;

        // Load events
        const events = await redis.get(`cal:${uid}`);
        if (!events || !Array.isArray(events)) continue;

        const todayStr = fmtDateInTZ(nowUtc, timezone);
        const nowMin   = nowMinutesInTZ(nowUtc, timezone);

        for (const evt of events) {
          // Only timed events on today's date with a valid notification setting
          if (evt.allDay || !evt.startTime || !evt.startDate) continue;
          if (evt.notification == null || evt.notification < 0)  continue;
          if (evt.startDate !== todayStr) continue;

          const [eh, em] = evt.startTime.split(":").map(Number);
          const evtMin   = eh * 60 + em;
          const diff     = evtMin - nowMin;

          if (diff !== evt.notification) continue;

          // Build notification payload
          const timeStr = fmtTime(evt.startTime);
          const body = evt.notification === 0
            ? `Starting now${evt.location ? ` · ${evt.location}` : ""}`
            : `At ${timeStr}${evt.location ? ` · ${evt.location}` : ""}`;

          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: `📅 ${evt.title}`,
              body,
              tag:   `${uid}-${evt.id}-${evt.startDate}`,
            })
          );
          sent++;
        }
      } catch (err) {
        // 410 = subscription expired / user unsubscribed → clean up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await redis.del(`sub:${uid}`);
          await redis.srem("subscribers", uid);
        } else {
          console.error(`uid ${uid}:`, err.message);
          errors++;
        }
      }
    }
  } catch (err) {
    console.error("cron error:", err.message);
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ ok: true, sent, errors, ts: new Date().toISOString() });
}
