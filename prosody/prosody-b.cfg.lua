-- Prosody Configuration for server B (b.chat.local)

admins = {}

-- Network settings
interfaces = { "*" }
c2s_ports = { 5222 }
s2s_ports = { 5269 }

-- No TLS required (internal Docker network)
c2s_require_encryption = false
s2s_require_encryption = false
s2s_secure_auth = false

-- Logging
log = {
  info = "*console";
}

-- Modules
modules_enabled = {
  -- Core
  "roster";
  "saslauth";
  "disco";
  "carbons";
  "pep";
  "register";
  "admin_telnet";
  "bosh";
  "websocket";
  "mam";
  "dialback";

  -- S2S federation
  "s2s";

  -- HTTP for admin API
  "http";
}

modules_disabled = {
  "tls";
}

-- Allow in-band registration for testing
allow_registration = true

-- MAM (Message Archive Management)
default_archive_policy = true

-- HTTP settings for admin
http_ports = { 5280 }
http_interfaces = { "*" }

-- Component port binding (must be global)
component_ports = { 5347 }
component_interface = "0.0.0.0"

-- Virtual host
VirtualHost "b.chat.local"

-- MUC component for group chat
Component "conference.b.chat.local" "muc"
  modules_enabled = { "muc_mam" }
  restrict_room_creation = false
  muc_room_locking = false
  muc_room_default_public = true
