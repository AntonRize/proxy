// api/gemini.js - Vercel proxy with manual model selection + automatic fallback
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

  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set' });
  }

  // If user forces MiniMax, go directly to it
  if (forceModel === 'minimax') {
    if (!OPENROUTER_KEY) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured' });
    }

    console.log('🔧 [MANUAL] User forced MiniMax M2.5 (free)');

    const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://willrg.com',
        'X-Title': 'WILL-AI'
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.5:free',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!openrouterRes.ok) {
      const errText = await openrouterRes.text();
      return res.status(openrouterRes.status).json({ error: errText });
    }

    const orData = await openrouterRes.json();
    const reply = orData.choices?.[0]?.message?.content ?? '';

    console.log('✅ [MINIMAX M2.5 FREE] Manual mode');
    return res.status(200).json({ 
      reply, 
      model: 'minimax-m2.5-free',
      mode: 'manual' 
    });
  }

  // Default behavior: Try Gemini first, fallback to MiniMax on quota error
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

    const errorText = await geminiRes.text();
    const isQuotaError = 
      geminiRes.status === 429 ||
      errorText.includes('RESOURCE_EXHAUSTED') ||
      errorText.includes('quota') ||
      errorText.includes('exceeded') ||
      errorText.includes('free_tier_requests');

    if (!isQuotaError) {
      return res.status(geminiRes.status).json({ error: errorText });
    }

    // Automatic fallback
    if (!OPENROUTER_KEY) {
      return res.status(429).json({ error: 'Gemini quota exceeded and no OpenRouter key configured.' });
    }

    console.log('🔄 [AUTO FALLBACK] Gemini quota → MiniMax M2.5 free');

    const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'https://willrg.com',
        'X-Title': 'WILL-AI'
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.5:free',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!openrouterRes.ok) {
      const errText = await openrouterRes.text();
      return res.status(openrouterRes.status).json({ error: errText });
    }

    const orData = await openrouterRes.json();
    const reply = orData.choices?.[0]?.message?.content ?? '';

    console.log('✅ [MINIMAX M2.5 FREE] Auto fallback');
    return res.status(200).json({ 
      reply, 
      model: 'minimax-m2.5-free',
      mode: 'fallback' 
    });

  } catch (e) {
    console.error('Proxy error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
