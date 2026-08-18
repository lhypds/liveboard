#!/bin/bash
set -e
bash pull.sh
# No --include=dev here: that is an npm flag. pnpm parses it as a package name and installs the
# unrelated npm package `dev`, rewriting package.json and pnpm-lock.yaml on every restart. pnpm
# ignores NODE_ENV=production and installs devDependencies anyway, so the build gets typescript/vite.
pnpm install
pnpm run build
pnpm pm2 restart ecosystem.config.cjs --update-env

# Every pnpm command here rewrites pnpm-lock.yaml — install, run, even a bare `pnpm exec` — because
# src/modules/* are workspace packages and pnpm resyncs the lockfile's `importers:` block to the
# module dirs actually on disk. This deploy's board.config.json selects fewer module repos than the
# machine the lockfile was committed from, so the entries for the missing ones get dropped every
# time. That is why this has to be the last thing in the script rather than sitting after the
# install: the build and the pm2 restart would each put it straight back.
# node_modules is built and the service is up by now, so the rewrite has served its purpose. Drop
# it, so `git status` stays clean and the next `git pull` has nothing to trip over. Same rule as
# pull.sh: only when it is the sole local change, so a machine with real work stays untouched.
if ! git diff --quiet HEAD -- pnpm-lock.yaml \
  && [ -z "$(git diff --name-only HEAD | grep -v '^pnpm-lock\.yaml$')" ]; then
  git checkout HEAD -- pnpm-lock.yaml
fi
