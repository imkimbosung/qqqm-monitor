export async function onRequestPost({ request, env }) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME, SUPABASE_URL, SUPABASE_ANON_KEY } = env;

  // Auth check via Supabase JWT
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) return json({ error: 'Unauthorized' }, 401);

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return json({ error: 'Missing environment variables' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { stocks, sha } = body;
  if (!Array.isArray(stocks) || !sha) {
    return json({ error: 'Missing stocks or sha' }, 400);
  }

  for (const s of stocks) {
    if (!s.ticker || typeof s.ticker !== 'string') {
      return json({ error: `Invalid ticker: ${s.ticker}` }, 400);
    }
    if (!Array.isArray(s.alerts) || s.alerts.length === 0 || s.alerts.some(n => isNaN(n) || n <= 0)) {
      return json({ error: `Invalid alerts for ${s.ticker}` }, 400);
    }
  }

  const newContent = JSON.stringify({ stocks }, null, 2) + '\n';
  const encoded = btoa(newContent);
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/config.json`;

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'chore: update config via dashboard',
      content: encoded,
      sha,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return json({ error: text }, res.status);
  }

  const ghData = await res.json();
  return json({ success: true, sha: ghData.content.sha });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
