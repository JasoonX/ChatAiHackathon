## Known issues (prioritized)

### Should fix (visible UX issues)

### Nice to have (skip if behind)

- Room members panel and modal lack pagination. Spec allows up to 1000
  members per room, but at hackathon scale (300 concurrent users, demo
  with ~5 users) this won't be hit. Members modal has search filter
  which mitigates UX for larger lists. Adding cursor pagination to
  members, contacts, admins, and banned lists is significant work for
  zero demo impact. Revisit if productionizing.
