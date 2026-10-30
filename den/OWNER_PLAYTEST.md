# OWNER PLAYTEST — BINRAT: THE DEN

Estimated time: **8–10 minutes**. Everything below runs locally; nothing leaves the machine.

## 0. Start

```bash
cd /home/swirky/Documents/deepseek-harness/default-workspace/binrat-den-01/den
pnpm install --ignore-workspace     # first time only
pnpm build && pnpm start            # → http://127.0.0.1:4178
```

For hot-reload development: `pnpm dev` (API `:4178`, UI `:5178`).

Reset the board with `Ctrl-C`, then `pnpm reset`, then `pnpm start` (local pins, runs, receipts and
work orders only; evidence is untouched). To reproduce the review screenshots: `pnpm shots` → `docs/receipts/den-01/`.

## 1. The 10-second test (desktop, 1440)

Open `/`.

- [ ] You can say what BINRAT is after ten seconds: *a rat that remembers recorded launches, with
      receipts.*
- [ ] The headline is a **finding**, not a slogan: "THE SAME ADDRESS CAME BACK." and 565 → 1,607.
- [ ] The camera strip says `DEN CAM 03 · RECORDED STILL` and `ILLUSTRATION · NOT EVIDENCE`.
- [ ] Two actions are obvious and both work: `OPEN THE FILE` and `SNIFF THE PILE`.
- [ ] The page never claims a live feed. The top chip says `RECORDED REPLAY`.

Expected look: `docs/receipts/den-01/home-1440x900.png`.

## 2. Inspect a source-backed file

Click `OPEN THE FILE` (file 83,539,339, rat handle THE RETURNER).

- [ ] "What happened", "What the record does not say", "Receipts" are all readable without a legend.
- [ ] The movement block names both capture read times (08 OCT 19:00 → 09 OCT 16:32 UTC).
- [ ] `VERIFY CASE DIGEST` recomputes in this browser and turns green.
- [ ] The right rail shows `CAP-01 · 20 REC`, `DIGEST VERIFIED`, `SOURCE PUBLIC GET`, `2/6 WINDOWS`.
- [ ] The four unknowns are explicit, including "Recurrence is not a verdict."

## 3. Employ the Rat (the magic moment)

Click `EMPLOY THE RAT`.

- [ ] Four steps appear with real values (fact id, position 6 of 20, 120 records, 84 addresses).
- [ ] The progress bar reaches `4 / 4` and the panel says `FILE WRITTEN · NEW RUN`.
- [ ] The note under it says the animation is presentation-only and the run was computed first.
- [ ] The receipt digest is shown. Click `VERIFY IN THIS BROWSER` → `VERIFIED · RECOMPUTED HERE`.
- [ ] Expand `SHOW THE SIGNED PAYLOAD` — `networkCalls: 0`, `liveCollector: false`.
- [ ] Close the dialog; click `EMPLOY THE RAT` again. It returns instantly and says
      `REUSED FROM THIS SESSION`; `RUN FRESH AGAIN` produces a different digest.

## 4. Leave a tripwire

In the right rail: `LEAVE A TRIPWIRE`, type a note, `PIN THE FILE`.

- [ ] The toast confirms; the rail button becomes `PINNED ✓`.
- [ ] Go to `/tripwire` (or the bottom `WIRE` tab on phone). The pin is on the board with a red pin
      head, your note in serif, the baseline capture and `RECORDED AGAIN`.
- [ ] A dashed `NOTHING ELSE PINNED` slot links to the pile.

## 5. Return: replay recorded windows

Click `REPLAY RECORDED WINDOWS`.

- [ ] A tape shows six captures in checkpoint order: baseline amber, `C06` acid (same address
      recorded), the rest muted.
- [ ] The movement repeats 565 → 1,607 with `+1,042 LAUNCHES` and `757,547 blocks and 22 hours`.
- [ ] The honesty line: "No collector ran, nothing was fetched, and no alert was delivered."
- [ ] `VERIFY IN THIS BROWSER` on the replay receipt passes.
- [ ] Close, then `DROP`. The card leaves the board, `DROPPED PINS` appears with `PIN AGAIN`.

## 6. Restart semantics

Stop the server (`Ctrl-C`) and start it again (`pnpm start`). Reload `/tripwire`.

- [ ] Any pin you left (before dropping) is still there after the restart.
      This is asserted automatically in `pnpm test:e2e` (server is killed and restarted mid-journey).
- [ ] `pnpm reset` clears it; the evidence set is untouched.

## 7. The economic wedge

Open `/front-desk`.

- [ ] `NO PAYMENT EXISTS`, `$0.00`, `PRICE: NOT SET`.
- [ ] Pick `ADDRESS TRAIL`, add a note, `RECORD INTEREST · $0`.
- [ ] A paper ticket appears with `DEN-WO-0001`, `PAYMENT TAKEN · FALSE · CHECKOUT EXISTS · FALSE`,
      and a verifiable interest receipt.
- [ ] Nothing was charged and nothing was emailed.

## 8. Phone pass (390 px)

Open the same URL at 390 px (or use devtools). The bottom HUD has DEN / PILE / WIRE / DESK / MANUAL.

- [ ] Every room completes without horizontal scrolling.
- [ ] `OPEN THE FILE` is a full-width thumb target.
- [ ] The dossier is readable; the movement figures fit; the stamp shrinks.
- [ ] `EMPLOY` works and the terminal fits the viewport.
- [ ] The HUD never covers the last control (pages carry bottom padding).
- [ ] With `prefers-reduced-motion: reduce`, steps appear instantly and scanlines stop pulsing.

## 9. Truth checks the owner should actually try to break

- [ ] Rename a value in `evidence/snapshots/*.json` → `pnpm verify:evidence` fails and the server
      refuses to boot (`EVIDENCE_INVALID`).
- [ ] `curl -s localhost:4178/api/den | jq '.lead.handle, .lead.movement'` → THE RETURNER, 565/1607.
- [ ] Open `/manual` → capability table marks the live collector `NOT RUN`, Telegram `NOT CONNECTED`,
      payments `NOT CONNECTED`, `$BINRAT` `NOT LAUNCHED`.
- [ ] The capture table shows `cap-06` as `READ ONLY D1` (not a public HTTP read).
- [ ] Search the pile for `zzz` → designed empty state, not an error.
- [ ] Open `/case/not-a-case` → "NOT IN THIS DEN", with the partial-coverage caveat.
- [ ] Stop the server and reload → the browser shows a local error, not a fake page.

## 10. Owner verdict

| Criterion | Question | Pass? |
|---|---|---|
| Comprehension | Could a stranger state BINRAT's value in 10 s? | ☐ |
| Task success | Did they inspect a source-backed case and choose a next action? | ☐ |
| Return hook | Did they save/reopen something valuable? | ☐ |
| Truth | Is every status defensible against the receipts? | ☐ |
| Identity | Does it feel like a place/game, not dashboard slop? | ☐ |
| Engineering | One command to run, one to test, one to roll back? | ☐ |

Rollback: delete `den/` (or close the draft PR). Nothing outside the directory was touched.

## Known limits (please judge them as intended, not as misses)

1. The evidence is 08–09 OCT 2026 and will not update: there is no collector.
2. The replay is a diff between packaged windows, never an alert, email or Telegram message.
3. `$0.00` and `PRICE: NOT SET` are deliberate: no billing exists in this experiment.
4. The lead uses a **read-only D1 capture** for the 1,607 figure; the UI labels that provenance.
5. `priorLaunchCount` is provider-reported; the receipt re-verifies the feed digest, not the index.
