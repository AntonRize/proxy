// api/gemini.js  —  Node 20, Vercel  ---------------------------------
export const config = { runtime: 'nodejs' };

import { readFileSync } from 'fs';
const { fetch } = globalThis;          // vite / vercel polyfill

/* ---------- SETTINGS ---------- */
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL      = 'gemini-1.5-flash'; // можешь сменить на pro, если есть quota

/* ---------- 1. Load WILL DB once ---------- */
const WILL_RAW = readFileSync(new URL('../will_db.txt', import.meta.url), 'utf8');
const PARAS    = WILL_RAW.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);

/* ---------- helpers ---------- */
const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age':       '86400'
};
const setCORS = res => Object.entries(cors).forEach(([k,v])=>res.setHeader(k,v));

const kwScore = (para, q) => {
  const words = q.toLowerCase().split(/[^a-zа-я0-9]+/);
  let k = 0; for (const w of words) if (w && para.toLowerCase().includes(w)) k++;
  return k;
};
const isRu = txt => /[А-Яа-я]/.test(txt);

/* ---------- main handler ---------- */
export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error:'POST only' });

  const { prompt = '' } = req.body || {};
  if (!prompt.trim()) return res.status(400).json({ error:'No prompt' });

  /* 2. choose top-6 by keyword overlap */
  const ranked = PARAS
    .map(p => [kwScore(p, prompt), p])
    .filter(([s])=>s>0)
    .sort((a,b)=>b[0]-a[0])
    .slice(0, 6)
    .map(([,p])=>p);

  /* 3. if >3, let Gemini sort them */
  let ctx = ranked.slice(0,3);
  if (ranked.length > 3) {
    try {
      const rankPrompt =
        `Sort the paragraphs by relevance to «${prompt}». ` +
        `Return the three best paragraphs in original form.\n\n` +
        ranked.map((p,i)=>`[${i}] ${p}`).join('\n\n');
      const sortResp = await callGemini(rankPrompt);
      const lines = sortResp.match(/\[(\d+)]/g)?.slice(0,3) || [];
      const idxs  = lines.map(s=>+s.replace(/\D/g,''));   // [2] → 2
      ctx = idxs.map(i=>ranked[i]).filter(Boolean);
    } catch { /* fall back to first 3 */ }
  }

  /* 4. build final prompt */
  const sys = isRu(prompt)
    ? 'Ты — строгий научный ассистент. Отвечай по-русски. Формулы в LaTeX.'
    : 'You are a rigorous scientific assistant. Answer in English. Formulas in LaTeX.';
  const cot = 'First think step-by-step. Then write final answer after ___END___.';
  const ctxBlock = ctx.map((p,i)=>`[CTX ${i+1}] ${p}`).join('\n\n');

  const fullPrompt = `${sys}\n\n${ctxBlock}\n\nQ: ${prompt}\n\n${cot}`;

  /* 5. call Gemini for final answer */
  const raw = await callGemini(fullPrompt);
  const final = raw.split('___END___').slice(-1)[0].trim() || raw;

  return res.status(200).json({ reply: final });
}

/* ---------- util: call Gemini REST ---------- */
async function callGemini(text) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const g = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ contents:[{ role:'user', parts:[{ text }] }] })
  });
  if (!g.ok) throw new Error(`Gemini error ${g.status}`);
  const j = await g.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
