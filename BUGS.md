## Known issues (fix in Monday polish pass)

- Private rooms "+" button only invites to current existing rooms, but looks like it's for creating a new private room
- Top navigation bar layout doesnt make sense
- Reply quote doesn't update in real-time when the replied-to message is edited (nice-to-have)
- it shouldn't show join button if i'm already a member (nice-to-have)
- Right-click context menu on members (using dropdown instead — acceptable)
- No eager client-side unread counter update from socket events (uses refetch)
- No integration tests for friend request/accept/ban flows
- No dedicated friend management screen
- DM read-only enforcement needs end-to-end manual verification
- when I remove a friend, it's not shown on their side until the page refresh and no alert shown (need to check the spec)
- the invite icon (UserPlus) appears on each private room row on hover, but changes it's position depending on unread messages, need to stabilize the position
