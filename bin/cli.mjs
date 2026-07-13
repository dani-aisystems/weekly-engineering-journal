#!/usr/bin/env node
// Weekly Engineering Journal Generator
// Pulls a GitHub user's commits and pull requests from the last N days and
// drafts a structured weekly journal entry — optionally polished into prose
// by Claude if ANTHROPIC_API_KEY is set.

const GITHUB_API = "https://api.github.com";

function parseArgs(argv) {
  const args = { days: 7, output: null, user: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--user") args.user = argv[++i];
    else if (arg === "--days") args.days = Number(argv[++i]);
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`weekly-engineering-journal

Usage:
  GITHUB_TOKEN=<token> npx weekly-engineering-journal [--user <username>] [--days <n>] [--output <file>]

Options:
  --user     GitHub username to report on (defaults to the token's own account)
  --days     How many days back to look (default: 7)
  --output   Write the journal to a file instead of stdout

Env vars:
  GITHUB_TOKEN        Required. A PAT with at least public read access (repo scope for private activity).
  ANTHROPIC_API_KEY   Optional. If set, the structured activity is turned into prose via Claude.
                       If unset, the tool prints the structured data as-is.
`);
}

async function githubRequest(path, token) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "weekly-engineering-journal",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${path} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function resolveUsername(token, explicitUser) {
  if (explicitUser) return explicitUser;
  const me = await githubRequest("/user", token);
  return me.login;
}

async function fetchWeeklyActivity(token, username, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [commits, prs] = await Promise.all([
    githubRequest(
      `/search/commits?q=${encodeURIComponent(`author:${username} committer-date:>=${since}`)}&sort=committer-date&order=desc&per_page=100`,
      token
    ),
    githubRequest(
      `/search/issues?q=${encodeURIComponent(`type:pr author:${username} updated:>=${since}`)}&sort=updated&order=desc&per_page=100`,
      token
    ),
  ]);

  return { since, commits: commits.items ?? [], prs: prs.items ?? [] };
}

function groupByRepo(commits, prs) {
  const repos = new Map();

  for (const c of commits) {
    const repo = c.repository.full_name;
    if (!repos.has(repo)) repos.set(repo, { commits: [], prs: [] });
    repos.get(repo).commits.push({
      message: c.commit.message.split("\n")[0],
      sha: c.sha.slice(0, 7),
      url: c.html_url,
    });
  }

  for (const p of prs) {
    const repo = p.repository_url.replace(`${GITHUB_API}/repos/`, "");
    if (!repos.has(repo)) repos.set(repo, { commits: [], prs: [] });
    repos.get(repo).prs.push({
      title: p.title,
      number: p.number,
      state: p.pull_request?.merged_at ? "merged" : p.state,
      url: p.html_url,
    });
  }

  return repos;
}

function renderStructuredMarkdown(username, since, repos) {
  const lines = [`# Weekly Engineering Journal — ${username}`, "", `Activity since ${since}`, ""];

  if (repos.size === 0) {
    lines.push("No commits or pull requests found in this window.");
    return lines.join("\n");
  }

  for (const [repo, activity] of repos) {
    lines.push(`## ${repo}`, "");
    if (activity.prs.length) {
      lines.push("**Pull requests:**");
      for (const pr of activity.prs) {
        lines.push(`- [#${pr.number}](${pr.url}) (${pr.state}) — ${pr.title}`);
      }
      lines.push("");
    }
    if (activity.commits.length) {
      lines.push("**Commits:**");
      for (const c of activity.commits) {
        lines.push(`- [\`${c.sha}\`](${c.url}) ${c.message}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function narrateWithClaude(apiKey, structuredMarkdown) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Turn this structured weekly git activity into a short, first-person engineering journal entry (3-5 sentences of narrative, then a bulleted "Highlights" list). Be factual — don't invent work that isn't listed. Keep it suitable for a standup update or a LinkedIn draft.\n\n${structuredMarkdown}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API failed: ${res.status} ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.content.map((block) => block.text ?? "").join("");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Error: GITHUB_TOKEN environment variable is required.");
    process.exitCode = 1;
    return;
  }

  const username = await resolveUsername(token, args.user);
  const { since, commits, prs } = await fetchWeeklyActivity(token, username, args.days);
  const repos = groupByRepo(commits, prs);
  const structured = renderStructuredMarkdown(username, since, repos);

  let output = structured;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && repos.size > 0) {
    const narrative = await narrateWithClaude(anthropicKey, structured);
    output = `${narrative}\n\n---\n\n<details><summary>Raw activity</summary>\n\n${structured}\n\n</details>\n`;
  }

  if (args.output) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(args.output, output, "utf8");
    console.error(`Journal written to ${args.output}`);
  } else {
    console.log(output);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
