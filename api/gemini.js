// api/gemini.js  – Vercel Node 18 runtime

// ---------- CORS ----------
const cors = {
  'Access-Control-Allow-Origin':  '*',               // можешь сузить до 'https://antonrize.github.io'
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400',           // кэшируем preflight сутки
};

export default async function handler(req, res) {
  // —- Preflight
  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  // —- Разрешаем только POST
  if (req.method !== 'POST') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // —- Общие CORS-заголовки к основному ответу
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  // —- Основная логика
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'No prompt' });

const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const gRes  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
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
