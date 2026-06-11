#!/bin/bash
set -e
bash pull.sh
npm install
npm run build
pm2 reload ecosystem.config.cjs --update-env
