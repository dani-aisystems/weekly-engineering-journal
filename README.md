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
| `GITHUB_TOKEN` | Yes | A PAT with `repo` scope (needed for search across private repos, not just public ones) |
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

`.github/workflows/weekly-journal.yml` runs this every Monday and commits the output to `journal/YYYY-MM-DD.md` in whatever repo you drop it into. It needs two repo secrets:

- `JOURNAL_GH_PAT` — a personal access token with `repo` scope (the default Actions token can't search across your other repos, so this has to be a real PAT you create yourself in Settings → Developer settings → Personal access tokens)
- `ANTHROPIC_API_KEY` — optional, same as above

Third-party actions in the workflow are pinned to commit SHA, not just a version tag, since the job has write access and secret access.

## License

MIT — see [LICENSE](./LICENSE).
