# Demo flow (3 min)

## Pre-seeded data (created by seed script)

- User **alice** (password: alice123) — owner of #general and #engineering
- User **bob** (password: bob123) — member of #general, admin of #engineering
- User **carol** (password: carol123) — member of #general
- #general: 50+ messages of realistic chat history, 2 image attachments
- #engineering: 30+ messages, private room
- alice and bob are friends with existing PM history

## Demo sequence

### 1. Registration + first login (30s)

- Open browser 1 (incognito), go to localhost:3000
- Register as "demo-user" / demo@test.com / password123
- Land on the main chat view — empty sidebar, no rooms yet

### 2. Public rooms + joining (30s)

- Click "Public Rooms" in top nav
- Room catalog shows #general (3 members) and other public rooms
- Type "gen" in search — filters to #general
- Click #general → join → lands in room
- Message history loads with infinite scroll
- Scroll up — older messages lazy-load

### 3. Real-time messaging (40s)

- Open browser 2 as alice (login with alice/alice123)
- Both browsers show #general
- alice sends "hey demo-user, welcome! 👋" → appears instantly in browser 1
- demo-user replies with "thanks!" → appears in browser 2
- demo-user clicks reply on alice's message → sends a reply
  → reply renders with quoted original message
- demo-user edits their message → "edited" indicator appears in both browsers

### 4. File sharing (20s)

- demo-user clicks attach button → uploads an image (< 3MB)
- Image renders inline with original filename visible
- alice clicks the image → downloads successfully
- (optional) demo-user pastes an image from clipboard → sends

### 5. Presence (20s)

- Both browsers show alice and demo-user as online (green dot)
- Close browser 2 (alice's tab) → alice goes offline within ~5s
- demo-user's member list updates — alice shows offline (gray dot)
- Reopen browser 2 as alice → alice goes back online

### 6. Private rooms + invitations (20s)

- In browser 2, alice invites demo-user to #engineering (private)
- Browser 1: demo-user sees invitation notification
- demo-user accepts → joins #engineering → sees message history
- #engineering not visible in public catalog (show catalog to prove)

### 7. Admin moderation (20s)

- alice (owner of #general) opens room management modal
- Kicks demo-user from #general → demo-user removed instantly
- Browser 1: demo-user loses access, #general disappears from sidebar
- demo-user tries to rejoin #general from catalog → blocked (banned)

### 8. Personal messaging + friends (20s)

- Browser 1: demo-user sends friend request to carol (by username)
- Switch to browser 3 or re-login as carol
- carol accepts friend request
- carol sends a personal message to demo-user
- demo-user sees unread indicator on carol's name → opens → reads

### 9. Session management (10s)

- demo-user opens Profile → Active Sessions
- Shows current session with browser info + IP
- (If time: show a second session, kill it)

## Backup demo (if features aren't ready)

If friends/PM isn't complete, extend sections 3-4 with:

- Message deletion (author deletes own message, admin deletes another's)
- More attachment types (PDF, document)
- AFK demonstration (stop interacting → status changes to AFK after 60s)

## What judges will likely test after demo

- Can a banned user rejoin? (must fail)
- Can a non-member download a room's files? (must fail)
- Does sign-out kill only the current session? (must work)
- Does the app survive a page refresh mid-chat? (must work)
- docker compose down && docker compose up — does data persist? (must work)
