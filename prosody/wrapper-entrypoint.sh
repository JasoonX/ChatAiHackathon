#!/bin/sh
set -eu

# Recover from earlier root-owned volumes before delegating to the image entrypoint.
chown -R prosody:prosody /var/lib/prosody /var/run/prosody 2>/dev/null || true

exec /entrypoint.sh prosody -F
