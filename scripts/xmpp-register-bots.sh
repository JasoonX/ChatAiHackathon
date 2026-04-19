#!/usr/bin/env bash
# Register load test bots in both Prosody servers
set -e

BOT_COUNT=${BOT_COUNT:-50}

echo "Registering $BOT_COUNT bots on server A (a.chat.local)..."
for i in $(seq 0 $((BOT_COUNT - 1))); do
  docker compose exec -T prosody-a prosodyctl register "bota${i}" a.chat.local "pass${i}" 2>/dev/null || true
done

echo "Registering $BOT_COUNT bots on server B (b.chat.local)..."
for i in $(seq 0 $((BOT_COUNT - 1))); do
  docker compose exec -T prosody-b prosodyctl register "botb${i}" b.chat.local "pass${i}" 2>/dev/null || true
done

echo "Done. Registered $((BOT_COUNT * 2)) bots total."
