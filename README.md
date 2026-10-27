# weekly-engineering-journal

Pulls your commits and pull requests from the last N days across every repo GitHub will let your token see, and drafts a structured weekly engineering journal entry — optionally turned into prose by Claude if you give it an API key.

Zero runtime dependencies. Node 18+, built-in `fetch` only.

## Why this exists

Standups, performance-review write-ups, and "what did I actually do this week" all draw from the same source of truth: your git activity. This pulls it once, structured, so you're editing a draft instead of reconstructing the week from memory.

## Usage

```bash
GITHUB_TOKEN=<your token> npx weekly-engineering-journal
```

```
Usage:
  GITHUB_TOKEN=<token> npx weekly-engineering-journal [--user <username>] [--days <n>] [--output <file>]

Options:
  --user     GitHub username to report on (defaults to the token's own account)
  --days     How many days back to look (default: 7)
  --output   Write the journal to a file instead of stdout
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | Yes | A token with public read access, or a PAT that can read each private repository you want included |
| `ANTHROPIC_API_KEY` | No | If set, the structured activity is rewritten as a short narrative journal entry + highlights. If unset, you get the structured markdown as-is — the tool is fully useful without an LLM key. |

## Example output (structured mode, no LLM key)

```markdown
# Weekly Engineering Journal — dani-aisystems

Activity since 2026-07-06

## dani-aisystems/hiring-signal-skills

**Commits:**
- [`cb19f13`](...) feat: initial release — six hiring-signal skills for Claude Code
```

## Running it on a schedule

This repository deliberately does **not** run a scheduled journal job: its CI only checks the offline formatting and grouping logic. To schedule your own journal, copy [`examples/weekly-journal.yml`](examples/weekly-journal.yml) to `.github/workflows/weekly-journal.yml` in the repository where you want entries committed.

The example checks out a reviewed revision of this tool into a separate folder instead of assuming the package exists on npm. Update its pinned `ref` deliberately when you want a newer tool version.

The copied workflow needs these repository secrets:

- `JOURNAL_GH_PAT` — a personal access token that can read every repository you want searched. The default Actions token cannot search across your other repositories; private activity is included only where this PAT has access.
- `ANTHROPIC_API_KEY` — optional, same as above

Third-party actions in the workflow are pinned to commit SHA, not just a version tag, since the job has write access and secret access.

## Development

```bash
npm test
```

The tests are offline and exercise argument validation, activity grouping, and Markdown output. They do not call GitHub or Anthropic.

## License

MIT — see [LICENSE](./LICENSE).
