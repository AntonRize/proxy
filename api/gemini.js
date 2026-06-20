// api/gemini.js - Vercel proxy with Nemotron + reasoning + streaming
export const config = { runtime: 'nodejs' };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

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

  const { prompt, forceModel } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

  // ============================================
  // MANUAL MODE: Force Nemotron with reasoning
  // ============================================
  if (forceModel === 'qwen3.6') {
    if (!OPENROUTER_KEY) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured' });
    }

    console.log('🔧 [MANUAL] Using Nemotron 550B with reasoning');

    const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://willrg.com',
        'X-Title': 'WILL-AI'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        reasoning: {
          effort: 'high'
        }
      })
    });

    if (!openrouterRes.ok) {
      const errText = await openrouterRes.text();
      return res.status(openrouterRes.status).json({ error: errText });
    }

    const orData = await openrouterRes.json();
    const reply = orData.choices?.[0]?.message?.content ?? '';

    console.log('✅ [NEMOTRON 550B] Manual mode with reasoning');
    return res.status(200).json({
      reply,
      model: 'nemotron-3-ultra-550b',
      mode: 'manual'
    });
  }

  // ============================================
  // DEFAULT: Gemini first, fallback to Nemotron
  // ============================================
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set' });
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      console.log('✅ [GEMINI 2.5 FLASH] Request served');
      return res.status(200).json({
        reply,
        model: 'gemini-2.5-flash',
        mode: 'auto'
      });
    }

    // Check if we should fallback
    const errorText = await geminiRes.text();
    const shouldFallback =
      geminiRes.status === 429 ||
      geminiRes.status === 403 ||
      errorText.includes('RESOURCE_EXHAUSTED') ||
      errorText.includes('quota') ||
      errorText.includes('exceeded') ||
      errorText.includes('free_tier_requests') ||
      errorText.includes('PERMISSION_DENIED');

    if (!shouldFallback) {
      return res.status(geminiRes.status).json({ error: errorText });
    }

    // Fallback to Nemotron with reasoning
    if (!OPENROUTER_KEY) {
      return res.status(429).json({ error: 'Gemini failed and no OpenRouter key configured.' });
    }

    console.log('🔄 [AUTO FALLBACK] Gemini → Nemotron 550B with reasoning');

    const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://willrg.com',
        'X-Title': 'WILL-AI'
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        reasoning: {
          effort: 'high'
        }
      })
    });

    if (!openrouterRes.ok) {
      const errText = await openrouterRes.text();
      return res.status(openrouterRes.status).json({ error: errText });
    }

    const orData = await openrouterRes.json();
    const reply = orData.choices?.[0]?.message?.content ?? '';

    console.log('✅ [NEMOTRON 550B] Auto fallback with reasoning');
    return res.status(200).json({
      reply,
      model: 'nemotron-3-ultra-550b',
      mode: 'fallback'
    });

  } catch (e) {
    console.error('Proxy error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
