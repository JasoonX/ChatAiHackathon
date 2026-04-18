# AI Workflow Log

## Tools used

| Tool                     | Role                                            | When used                                                               |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Codex (GPT-5.x)          | Primary coding agent                            | Scaffolding, schema, API routes, business logic, tests                  |
| Claude Code (Sonnet 4.6) | UI polish, visual matching, adversarial review  | Design integration, pixel-matching against screenshots, security review |
| Claude Design            | Design system generation                        | Pre-hackathon: generated design language, exported as HTML              |
| Claude (claude.ai)       | Planning, spec analysis, architecture decisions | Pre-coding: grill-me on spec, triage, technical decisions               |

## Orchestration approach

- Single-agent primary driver (Codex) for all structural/backend work
- Claude Code for UI-specific tasks where vision + autoVerify matters
- Cross-model review on security-critical paths (auth, access control,
  file permissions): Codex writes, Claude Code reviews
- Spec-driven development: SPEC.md as authoritative source, AGENTS.md
  as behavioral guardrails, DEMO.md as prioritization anchor
- TDD on permissions and auth: red tests written first, agent implements
  to green
- Progress journaling: progress.md updated at every session clear

## Timeline

### Saturday

- [x] Scaffolding via Codex (stack, Docker, Socket.io, Drizzle, auth wiring)
- [x] Design system extraction from Claude Design export
- [x] Spec triage and technical decisions (claude.ai planning session)
- [ ] Testing harness setup
- [ ] Schema design
- [ ] Auth end-to-end
- [ ] Real-time messaging spine
- [ ] ...

### Sunday

- [ ] ...

### Monday

- [ ] ...

## What worked

- Codex Agent pushed back on adding 'owner' to room_member_role enum,
  correctly identifying dual-source-of-truth drift risk. Accepted
  the pushback. Good example of multi-provider review catching a design mistake
  before code was written.

## What didn't work

(fill in as you go — failures are more interesting to judges than successes)

## Approximate stats

- Total Codex sessions:
- Total Claude Code sessions:
- Estimated prompts:
- Session restarts / context clears:
- Estimated token spend:
- Lines of code (final):
- Lines of tests (final):
- % of code written by agent vs hand-edited:
