#!/bin/bash
# Start Prosody in the background, register bridge user, then foreground it

# Start Prosody
prosody &
PROSODY_PID=$!

# Wait for Prosody to be ready
for i in $(seq 1 30); do
  if bash -c "echo > /dev/tcp/localhost/5222" 2>/dev/null; then
    break
  fi
  sleep 1
done

# Register bridge user (ignore error if already exists)
DOMAIN=$(grep 'VirtualHost' /etc/prosody/prosody.cfg.lua | head -1 | sed 's/VirtualHost "\(.*\)"/\1/')
prosodyctl register chatty-bridge "$DOMAIN" chatty-bridge-secret 2>/dev/null || true
echo "Bridge user chatty-bridge@$DOMAIN registered"

# Wait for Prosody process
wait $PROSODY_PID
