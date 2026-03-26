#!/usr/bin/env node
/* eslint-disable no-console */
import { execSync } from "node:child_process";

function run(cmd, opts = {}) {
  const { silent = false } = opts;
  if (!silent) console.log(`\n> ${cmd}`);
  return execSync(cmd, { stdio: silent ? ["ignore", "pipe", "pipe"] : "inherit" })
    ?.toString?.()
    ?.trim?.();
}

function ensureCleanWorktree() {
  const status = run("git status --porcelain", { silent: true });
  if (status && status.length > 0) {
    console.error(
      "\nERROR: Working tree is not clean. Commit/stash changes before running this."
    );
    process.exit(1);
  }
}

function currentBranch() {
  return run("git branch --show-current", { silent: true });
}

function remoteBranchExists(remote, branch) {
  const out = run(`git ls-remote --heads ${remote} ${branch}`, { silent: true });
  return Boolean(out && out.length > 0);
}

function main() {
  ensureCleanWorktree();

  const feature = currentBranch();
  if (!feature) {
    console.error("\nERROR: Could not determine current branch.");
    process.exit(1);
  }
  if (feature === "develop" || feature === "master") {
    console.error("\nERROR: Run this from a feature branch (not develop/master).");
    process.exit(1);
  }

  const remote = "origin";

  // 1) Update refs & develop
  run(`git fetch ${remote} --prune`);

  run("git checkout develop");
  run(`git pull --ff-only ${remote} develop`);

  // 2) Rebase feature onto latest develop (so develop is not ahead anymore)
  run(`git checkout ${feature}`);
  run("git rebase develop");

  // 3) Land feature into develop
  run("git checkout develop");
  run(`git rebase ${feature}`);

  // 4) Push develop
  run(`git push ${remote} HEAD`);

  // 5) Delete remote feature branch (keep local)
  if (remoteBranchExists(remote, feature)) {
    run(`git push -d ${remote} ${feature}`);
  } else {
    console.log(`\nINFO: Remote branch ${remote}/${feature} does not exist, skipping delete.`);
  }

  console.log(
    `\nDONE: Feature rebased onto latest develop, changes applied to develop and pushed. Remote feature deleted (if it existed). Local branch kept: ${feature}`
  );
}

main();