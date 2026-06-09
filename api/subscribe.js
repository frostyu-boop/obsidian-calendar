import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { uid, subscription, timezone } = req.body || {};

  if (!uid || !subscription) {
    return res.status(400).json({ error: "Missing uid or subscription" });
  }

  try {
    if (req.method === "POST") {
      // Store subscription keyed by uid
      await redis.set(`sub:${uid}`, JSON.stringify({
        subscription,
        timezone: typeof timezone === "number" ? timezone : 0,
      }));
      // Keep a set of all subscriber UIDs so the cron can iterate them
      await redis.sadd("subscribers", uid);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await redis.del(`sub:${uid}`);
      await redis.srem("subscribers", uid);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error("subscribe error:", err.message);
    return res.status(500).json({ error: "Storage error" });
  }
}
