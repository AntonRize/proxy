// api/gemini.js   — Vercel Node 18 runtime

// ---------- CORS ----------
const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',               // при желании укажи свой домен
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400'            // кэшируем pre-flight на сутки
};

export default async function handler(req, res) {
  /* ---------- pre-flight OPTIONS ---------- */
  if (req.method === 'OPTIONS') {
    for (const [k, v] of Object.entries(corsHeaders)) res.setHeader(k, v);
    return res.status(200).end();
  }

  /* ---------- разрешаем только POST ---------- */
  if (req.method !== 'POST') {
    for (const [k, v] of Object.entries(corsHeaders)) res.setHeader(k, v);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  /* ---------- CORS для основного ответа ---------- */
  for (const [k, v] of Object.entries(corsHeaders)) res.setHeader(k, v);

  /* ---------- основная логика ---------- */
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'No prompt' });

    // v1-endpoint + актуальная модель
    const url =
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const gRes = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    });

    const gJson = await gRes.json();
    if (!gRes.ok) throw new Error(gJson.error?.message || 'Gemini API error');

    const reply = gJson.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
