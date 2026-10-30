# DEN 01.1 — chat-led hardening review

**Base:** `4082ce3e42da94a2b3654fb2e06aa6991251f692` (draft PR #216), isolated successor only.  
**Scope:** `den/` only. No production integration, token changes, collector calls, payments, or deployment.

## Changed
- Close the unscoped `GET /api/runs/:id` read: missing session returns 400; foreign session returns 404; owner still reads own run. Added API regression assertions.
- Replace "signed payload" and "VERIFIED" receipt assertions with accurate SHA-256 digest-match terminology. Recompute is a consistency check, not a digital signature or independent authentication. Updated Playwright expectations.
- Reword reported 565 → 1,607 prior-launch count as a change in a **provider-reported cumulative index value**. The UI no longer claims those 1,042 launches occurred between captures; indexing changes/backfills can change the value.
- Make the Pile reveal only 12 scraps initially, with an in-app "show more" button; reset on lens/search changes. Added mobile browser assertions for 12 → 24.
- Condense repetitive Front Desk warnings, retaining visible interest-only, no-payment boundaries.

## Verification authority
- The source transforms were checked against the exact base SHA with unique-pattern assertions.
- **No local Node/Playwright tests were run by this chat:** the remote GitHub connector supports source changes but not executing the repository or accessing the owner's localhost. Root `ci.yml` may pass without exercising this isolated `den/` package.
- Run `cd den && pnpm install --ignore-workspace && pnpm check && pnpm test:e2e && pnpm shots` on the owner's machine before owner approval. Review 390px Pile and receipt screenshots after regeneration.
- A digest match proves only byte-level consistency against the supplied digest; independent source truth and signatory identity remain outside this app.

## Known boundaries
- `den/` remains a **recorded-replay-only** demo with no new evidence collection or delivery.
- Local header-based session IDs are appropriate only for this localhost review; a public deployment requires real authentication, secure cookie/session semantics, CSRF/origin controls, rate limiting and threat modeling.
- This changes **presentation**, **one session-isolation guard**, and tests. It does not bridge the production canonical Case read plane; that is a separate integration gate.
- Do not merge into production or claim commercial readiness based on this patch.
