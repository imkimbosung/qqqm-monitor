const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER   = process.env.REPO_OWNER;
const REPO_NAME    = process.env.REPO_NAME;

exports.handler = async function(event, context) {
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing environment variables' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { stocks, sha } = body;

  if (!Array.isArray(stocks) || !sha) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing stocks or sha' }) };
  }

  for (const s of stocks) {
    if (!s.ticker || typeof s.ticker !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: `Invalid ticker: ${s.ticker}` }) };
    }
    if (!Array.isArray(s.alerts) || s.alerts.length === 0 || s.alerts.some(n => isNaN(n) || n <= 0)) {
      return { statusCode: 400, body: JSON.stringify({ error: `Invalid alerts for ${s.ticker}` }) };
    }
  }

  const newContent = JSON.stringify({ stocks }, null, 2) + '\n';
  const encoded    = Buffer.from(newContent).toString('base64');
  const apiUrl     = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/config.json`;

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
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
    return { statusCode: res.status, body: JSON.stringify({ error: text }) };
  }

  const ghData = await res.json();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, sha: ghData.content.sha }),
  };
};
