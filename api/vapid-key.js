export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: "VAPID not configured" });
  }
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}
