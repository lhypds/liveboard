#!/bin/bash
set -e
pm2 reload ecosystem.config.cjs --update-env
