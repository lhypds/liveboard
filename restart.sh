#!/bin/bash
set -e
bash pull.sh
# --include=dev: the build needs typescript/vite/@types, which npm skips when the deploy shell has
# NODE_ENV=production (or omit=dev in .npmrc). Without it `npm run build` dies on TS2688.
pnpm install --include=dev
pnpm run build
pnpm pm2 restart ecosystem.config.cjs --update-env
