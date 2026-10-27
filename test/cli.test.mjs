import test from "node:test";
import assert from "node:assert/strict";

import { groupByRepo, parseArgs, renderStructuredMarkdown } from "../bin/cli.mjs";

test("parseArgs applies defaults and reads supported flags", () => {
  assert.deepEqual(parseArgs([]), { days: 7, output: null, user: null });
  assert.deepEqual(parseArgs(["--user", "dani", "--days", "14", "--output", "week.md"]), {
    days: 14,
    output: "week.md",
    user: "dani",
  });
});

test("parseArgs rejects unknown flags and invalid day windows", () => {
  assert.throws(() => parseArgs(["--wat"]), /Unknown argument/);
  assert.throws(() => parseArgs(["--days", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--days", "1.5"]), /positive integer/);
});

test("groupByRepo combines commits and pull requests by full repository name", () => {
  const commits = [{
    repository: { full_name: "dani/demo" },
    commit: { message: "feat: add report\n\nDetails" },
    sha: "1234567890",
    html_url: "https://github.com/dani/demo/commit/1234567890",
  }];
  const prs = [{
    repository_url: "https://api.github.com/repos/dani/demo",
    title: "Ship report",
    number: 7,
    state: "closed",
    pull_request: { merged_at: "2026-10-27T10:00:00Z" },
    html_url: "https://github.com/dani/demo/pull/7",
  }];

  assert.deepEqual(groupByRepo(commits, prs).get("dani/demo"), {
    commits: [{ message: "feat: add report", sha: "1234567", url: commits[0].html_url }],
    prs: [{ title: "Ship report", number: 7, state: "merged", url: prs[0].html_url }],
  });
});

test("renderStructuredMarkdown handles empty and populated activity", () => {
  const empty = renderStructuredMarkdown("dani", "2026-10-20", new Map());
  assert.match(empty, /No commits or pull requests found/);

  const repos = new Map([["dani/demo", {
    commits: [{ message: "docs: clarify setup", sha: "abcdef0", url: "https://example.test/commit" }],
    prs: [{ title: "Improve setup", number: 3, state: "open", url: "https://example.test/pr" }],
  }]]);
  const output = renderStructuredMarkdown("dani", "2026-10-20", repos);
  assert.match(output, /## dani\/demo/);
  assert.match(output, /\[#3\].*Improve setup/);
  assert.match(output, /`abcdef0`.*docs: clarify setup/);
});
