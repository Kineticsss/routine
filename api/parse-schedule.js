// Vercel-style Node function. Set ANTHROPIC_API_KEY in your host's environment settings.
export const config = { api: { bodyParser: false } };

const PROMPT = `This image is a school class schedule table. Extract every course. Return ONLY a JSON array, each item: {"code":string,"name":string,"instructor":string,"slots":[{"day":"MON|TUE|WED|THU|FRI|SAT","start":"HH:MM" (24-hour),"end":"HH:MM" (24-hour),"room":string}]}. A course may have several slots. Convert AM/PM to 24-hour time. Room is the text after the "/" in the schedule line.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const buf = Buffer.concat(chunks);
  if (buf.length > 4_500_000) return res.status(413).json({ error: "Image too large" });
  const media = (req.headers["content-type"] || "image/png").split(";")[0];

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: media, data: buf.toString("base64") } },
        { type: "text", text: PROMPT },
      ] }],
    }),
  });
  const j = await r.json();
  if (!r.ok) return res.status(502).json({ error: j.error?.message || "Upstream error" });
  const text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  try {
    res.status(200).json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch {
    res.status(502).json({ error: "Couldn't parse the model's answer" });
  }
}