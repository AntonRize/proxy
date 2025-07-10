import querystring from 'node:querystring';

export default async function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Missing GITHUB_CLIENT_ID' });

  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const redirect = `${proto}://${host}/api/callback`;

  const qs = querystring.stringify({ client_id: clientId, redirect_uri: redirect, scope: 'repo' });
  res.writeHead(302, { Location: `https://github.com/login/oauth/authorize?${qs}` });
  res.end();
}
