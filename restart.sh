#!/bin/bash
set -e
bash pull.sh
npm install
npm run build
pm2 restart ecosystem.config.cjs --update-env
