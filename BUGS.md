## Known issues (prioritized)

### Must fix (demo-breaking or judge-testable)

- Top navigation bar layout doesn't make sense
- When I remove a friend, it's not shown on their side until page refresh and no alert shown
- DM read-only enforcement needs end-to-end manual verification
- No eager client-side unread counter update from socket events (uses refetch)

### Should fix (visible UX issues)

- Private rooms "+" button only invites to existing rooms, looks like it's for creating a new private room
- Invite icon (UserPlus) position shifts depending on unread badge — stabilize position
- Shouldn't show join button if already a member

### Nice to have (skip if behind)

- Reply quote doesn't update in real-time when replied-to message is edited
- Right-click context menu on members (dropdown is acceptable)
- No dedicated friend management screen
- No integration tests for friend request/accept/ban flows
