// api/gemini.js — Vercel, Node 20

export const config = { runtime: 'nodejs' };

/* ---- CORS ---- */

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400'
};

const MODELS = [
  'gemini-1.5-pro-latest',  
  'gemini-1.5-flash-latest'
];

/* ---- handler ---- */

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'No prompt' });

    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const g = await fetch(url, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      });

      if (g.ok) {
        const j = await g.json();
        const reply = j.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const debug_raw_response = JSON.stringify(j, null, 2);

        return res.status(200).json({ 
          reply: reply, 
          model: model,
          debug_raw_response: `--- RAW AI RESPONSE ---\n${debug_raw_response}`
        });
      }

      if ([429, 403].includes(g.status)) continue;
      return res.status(g.status).json({ error: await g.text() });
    }

    return res.status(503).json({ error: 'All models exhausted' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
