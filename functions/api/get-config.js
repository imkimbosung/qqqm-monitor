export async function onRequestGet({ env }) {
  const { GITHUB_TOKEN, REPO_OWNER, REPO_NAME } = env;

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return json({ error: 'Missing environment variables' }, 500);
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/config.json`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) {
    return json({ error: 'GitHub API error', status: res.status }, res.status);
  }

  const ghData = await res.json();
  const config = JSON.parse(atob(ghData.content.replace(/\s/g, '')));

  return json({ stocks: config.stocks, sha: ghData.sha });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
