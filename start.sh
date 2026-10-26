#!/bin/sh
set -e
# Fail fast with a readable message instead of running with unsafe or missing settings.
if [ "${#SESSION_SECRET}" -lt 32 ]; then
  echo "SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32" >&2
  exit 1
fi
if [ -z "$ORIGIN" ]; then
  echo "ORIGIN must be set to the public URL, e.g. https://budget.example.com" >&2
  exit 1
fi
node migrate.mjs
exec node build
