import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code } = req.query;
  const id  = process.env.GITHUB_CLIENT_ID;
  const sec = process.env.GITHUB_CLIENT_SECRET;
  if (!code || !id || !sec) return res.status(400).json({ error: 'Missing data' });

  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: id, client_secret: sec, code })
  }).then(x => x.json());

  if (!r.access_token) return res.status(500).json({ error: r.error_description || 'No token' });

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`<!doctype html><html><body><script>
      window.opener && window.opener.postMessage('authorization:github:${r.access_token}','*');
      window.close();
  </script></body></html>`);
}
