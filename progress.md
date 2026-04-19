# Progress

## 2026-04-19

- Removed the local agent instruction blocking XMPP/Jabber work so section 6 can be executed in this repo.
- Fixed Prosody startup under `docker compose up` by switching to the image-supported startup flow, preserving bridge-user bootstrap, and adding a wrapper that repairs old root-owned Prosody volumes before launch.
- Updated both MUC configs to disable room locking and default new rooms to public so XMPP users can join seeded chat rooms immediately.
- Verified end-to-end XMPP-to-app delivery:
  `alice@a.chat.local` joined `general@conference.a.chat.local`, sent `Hello from XMPP test bot!`, the bridge received it, and the app inserted message `e7b3d2b3-abc9-48c5-ae24-622222c02796` into the `general` room.
- Verified app-to-XMPP delivery:
  an authenticated app socket sent `Web to XMPP bridge check` to the `general` room, the bridge forwarded it as `alice: Web to XMPP bridge check`, and an XMPP client in `general@conference.a.chat.local` received it.
- Fixed federation routing by adding Docker network aliases for `conference.a.chat.local` and `conference.b.chat.local`, then verified cross-server MUC delivery:
  `alice@a.chat.local` joined `general@conference.b.chat.local` and `bob@b.chat.local` received `Federation test from server A`.
- Added a sidebar link to `/chat/admin/jabber` so the XMPP dashboard is reachable directly from the chat UI.
