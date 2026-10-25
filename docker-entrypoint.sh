#!/bin/sh
set -eu
npm run migrate:deploy
node dist-seed/seed-mvp.js
exec node dist/main.js
