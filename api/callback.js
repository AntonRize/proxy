import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code } = req.query;
  const id  = process.env.GITHUB_CLIENT_ID;
  const sec = process.env.GITHUB_CLIENT_SECRET;
  if (!code || !id || !sec) return res.status(400).json({ error: 'Missing data' });

  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
