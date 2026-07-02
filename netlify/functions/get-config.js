const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER   = process.env.REPO_OWNER;
const REPO_NAME    = process.env.REPO_NAME;

exports.handler = async function(event, context) {
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing environment variables' }) };
  }

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/config.json`;

  const res = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    return { statusCode: res.status, body: JSON.stringify({ error: 'GitHub API error', status: res.status }) };
  }

  const ghData = await res.json();
  const config = JSON.parse(Buffer.from(ghData.content, 'base64').toString('utf-8'));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stocks: config.stocks, sha: ghData.sha }),
  };
};
