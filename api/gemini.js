// api/gemini.js  – Vercel Node 18 runtime

/* ---------- CORS ---------- */
const cors = {
  'Access-Control-Allow-Origin':  '*',               // при желании укажи точный домен
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400'
};

/* ---------- список моделей по приоритету ---------- */
const MODELS = [
  'gemini-1.5-pro-latest',   // умнее, но 50 request/day
  'gemini-1.0-pro'           // fallback без дневного потолка
];

/* ---------- обработчик ---------- */
export default async function handler(req, res) {
  /* -- preflight CORS -- */
  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  /* -- разрешаем только POST -- */
  if (req.method !== 'POST') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  /* ---------- основная логика ---------- */
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'No prompt' });

    for (const model of MODELS) {
      const url =
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const gRes = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      });

      /* --- если успешно, возвращаем ответ и модель --- */
      if (gRes.ok) {
        const gJson = await gRes.json();
        const reply = gJson.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return res.status(200).json({ reply, model });
      }

      /* --- ловим исчерпание квоты / запрет --- */
      if ([429, 403].includes(gRes.status)) {
        // переходим к следующей модели в списке
        continue;
      }

      /* --- остальные ошибки проксируем как есть --- */
      const errText = await gRes.text();
      return res.status(gRes.status).json({ error: errText });
    }

    /* --- если все модели отказали по квоте --- */
    return res.status(503).json({ error: 'All free-tier model quotas exhausted' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
