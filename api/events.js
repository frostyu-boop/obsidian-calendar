import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return res.status(503).json({
      error: "Upstash Redis not connected. Go to Vercel → Storage → Upstash → Connect to project → Redeploy.",
    });
  }

  const uid = req.query?.uid;
  if (!uid || typeof uid !== "string" || uid.length < 8 || uid.length > 128) {
    return res.status(400).json({ error: "Missing or invalid uid" });
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(uid)) {
    return res.status(400).json({ error: "uid contains invalid characters" });
  }

  const key = `cal:${uid}`;

  try {
    if (req.method === "GET") {
      const events = await redis.get(key);
      return res.status(200).json({ events: events || [] });
    }

    if (req.method === "POST") {
      const events = req.body?.events;
      if (!Array.isArray(events))
        return res.status(400).json({ error: "Body must be { events: [...] }" });
      if (events.length > 5000)
        return res.status(400).json({ error: "Too many events (max 5000)" });
      await redis.set(key, events);
      return res.status(200).json({ ok: true, saved: events.length });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Redis error:", err.message);
    return res.status(500).json({ error: "Storage error — check Upstash is connected" });
  }
}
