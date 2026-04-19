# Progress

## 2026-04-19

- Removed the local agent instruction blocking XMPP/Jabber work so section 6 can be executed in this repo.
- Fixed Prosody startup under `docker compose up` by switching to the image-supported startup flow, preserving bridge-user bootstrap, and adding a wrapper that repairs old root-owned Prosody volumes before launch.
- Updated both MUC configs to disable room locking and default new rooms to public so XMPP users can join seeded chat rooms immediately.
- Verified end-to-end XMPP-to-app delivery:
  `alice@a.chat.local` joined `general@conference.a.chat.local`, sent `Hello from XMPP test bot!`, the bridge received it, and the app inserted message `e7b3d2b3-abc9-48c5-ae24-622222c02796` into the `general` room.
