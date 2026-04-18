# SPEC — Online Chat Server

## What we're building

A classic web-based chat application: rooms (public/private), personal
messaging, contacts/friends, file sharing, moderation, persistent history.
Up to 300 concurrent users. Must run entirely via `docker compose up`
with zero external dependencies (Mars rule).

## Technical decisions (locked)

- Auth: better-auth with database-backed sessions. NO JWT.
  Session revocation takes effect immediately (delete row, disconnect socket).
- Real-time: Socket.io via custom Next.js server (server.ts).
  REST (API routes) for all CRUD. Socket.io for real-time pushes only:
  message broadcast, presence heartbeat, typing, notifications.
  Never implement CRUD over sockets.
- Presence architecture:
  - Client: listen for mousemove, mousedown, keydown, scroll, touchstart,
    pointerdown, focus on document. Debounce to 2-3s. Emit one "heartbeat"
    socket event per debounce window. No high-frequency traffic.
  - Server: track lastHeartbeat per socket. Derive per-user presence:
    any socket heartbeat <60s → online; all sockets stale >60s → afk;
    no sockets connected → offline.
  - Multi-tab: each tab = one socket. Server aggregates across sockets.
    No client-side cross-tab communication needed.
  - Tab hibernation: handled by Socket.io ping/pong timeout (~25s).
    Socket disconnects server-side. Tab wake → auto-reconnect → heartbeat
    resumes. No special code needed.
- Rooms model: public, private, and direct (personal chat).
  Direct = Room with type="direct", exactly 2 members, no admins.
- Room name uniqueness: single unique index across ALL room types.
- File storage: local disk via Docker volume (./uploads).
  Access control enforced via API route, not static serving.
- Invitations and friend requests: in-app only, by username. No email.
- No external runtime dependencies. No CDN fonts. No external APIs.
- Database-backed sessions store IP + user-agent for active sessions UI.

## Triage (47-hour budget)

### Must ship (demo-critical, core spec)

- R2.1.1 Registration: email + password + unique username
- R2.1.2 Registration rules: email unique, username unique + immutable
- R2.1.3 Auth: sign in, sign out (current session only), persistent login
- R2.1.4 Password change for logged-in users
- R2.2.1 Presence states: online / AFK / offline
- R2.2.2 AFK rule: no interaction >1 min across all tabs
- R2.2.3 Multi-tab support: online if any tab active, AFK if all idle
- R2.2.4 Active sessions: list with browser/IP, kill selected session
- R2.3.1 Friend list
- R2.3.2 Send friend request by username or from room member list
- R2.3.3 Friendship requires confirmation
- R2.3.4 Remove friend
- R2.3.5 User-to-user ban (blocks contact, freezes PM history)
- R2.3.6 Personal messaging only between friends, no bans active
- R2.4.1 Any user can create a room
- R2.4.2 Room properties: name, description, visibility, owner, admins, members, bans
- R2.4.3 Public room catalog with name/description/member count + search
- R2.4.4 Private rooms: not in catalog, join by invitation only
- R2.4.5 Join/leave: free join public unless banned, owner cannot leave
- R2.4.6 Room deletion: all messages + attachments deleted permanently
- R2.4.7 Owner/admin roles with full moderation actions
- R2.4.8 Room ban: removed + cannot rejoin + loses access to messages/files
- R2.4.9 Room invitations for private rooms
- R2.5.1 Personal chats = rooms with 2 participants, same features
- R2.5.2 Message content: text, multiline, emoji, attachments, reply. 3KB max, UTF-8
- R2.5.3 Message replies with visual quote
- R2.5.4 Message editing with "edited" indicator
- R2.5.5 Message deletion by author or room admin
- R2.5.6 Persistent history, chronological, infinite scroll, offline delivery
- R2.6.1 Attachments: images + arbitrary files
- R2.6.2 Upload via button + copy-paste
- R2.6.3 Preserve original filename, optional comment
- R2.6.4 Access control: only current members can download
- R2.6.5 Files persist after uploader loses access, until room deleted
- R2.7.1 Unread indicators on rooms and contacts, cleared on open
- R2.7.2 Low-latency presence updates
- R3.1 300 concurrent users, 1000 per room, unlimited rooms per user
- R3.2 Message delivery <3s, presence <2s, usable at 10k messages
- R3.3 Persistent storage, infinite scroll
- R3.4 Local filesystem, 20MB file max, 3MB image max
- R3.5 No auto-logout, persistent login, multi-tab correct
- R4.x UI: top menu, center messages, bottom input, side rooms/contacts,
  accordion room list, member list with status, auto-scroll behavior,
  admin modals per wireframes
- Docker compose up works from clean clone
- Seed data: 3+ users, 2+ public rooms with 50+ messages, 1 private room

### Should ship (time permitting)

- R2.1.4b Password reset (in-app flow, no email server)
- R2.1.5 Account deletion with cascade (owned rooms deleted, membership removed)
- R2.4.7b Admin can remove admin status from other admins (except owner)
- Banned users list UI with "banned by" column and timestamp
- Room settings modal: edit name, description, visibility
- Emoji picker component
- Typing indicator ("alice is typing...")

### Nice to have (polish)

- Keyboard shortcuts (Ctrl+Enter to send, Escape to cancel reply)
- Message text formatting (bold, italic, code)
- Drag-and-drop file upload
- Sound notification for new messages
- Dark mode toggle
- Mobile-responsive layout

### Skip entirely

- Section 6: Jabber / XMPP protocol support
- Section 6: Federation between servers
- Section 6: Load testing for federation
- Section 6: Jabber admin UI screens

## Open questions (decided)

- Q: Session storage? A: Database rows, not JWT. (Denis recommended)
- Q: Invite non-registered users? A: No. Registered only. (Denis confirmed)
- Q: Room names unique scope? A: Global across public + private. (Denis confirmed)
- Q: How to detect AFK? A: Multi-signal activity detection (mousemove, keydown,
  scroll, touch, etc.), debounced heartbeat, server-side timeout. (Denis hint + improved)
- Q: Tab hibernation? A: Socket.io ping/pong timeout handles it. Server detects
  absence of heartbeat. No client-side "inactive" signal needed. (Denis guidance)
