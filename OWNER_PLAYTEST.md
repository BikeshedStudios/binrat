# BINRAT Night Desk — owner playtest

Open **http://127.0.0.1:4194** on this machine. The running server is the isolated successor, not production. To start it yourself:

```sh
cd /home/swirky/DevHub/experiments/binrat-unleashed-01-20261030
node unleashed/server.mjs
```

Use desktop 1440×900, then a 390×844 phone viewport. A desktop browser's responsive mode is sufficient for this local test; a separate phone cannot reach this machine's loopback address.

## Five-minute journey

1. **First ten seconds.** Read the front door. Before clicking, say what you think BINRAT does and whether the data is live. Expected: inspect recorded crypto evidence, give a Rat a Case to remember; this is a local historical replay.
2. **Find → understand.** Select **Follow a real trail**. Explain the Case in one sentence. Expected: two recorded Pons launches report the same creator address; this is not proof of a common person, intent or safety.
3. **Check the source.** Read **What the Rat doesn’t know**. Follow both recorded transaction identifiers. Expand **Inspect exact source identifiers**, then download the original source JSON. It should identify chain 4663, checkpoint `84274428`, captured `2026-10-09T15:50:03.572Z`, partial coverage and the digest below.
4. **Employ.** Select **Employ Moxie**, add a question such as “What would make this trail worth following next?”, then **Save Case & employ Moxie**. Refresh before replay. The Case and your note must still be present.
5. **Leave → return.** Select **Run recorded trail**, then leave for **The alley**. Return through **My den → Open memory**. Expected: nine later recorded rows checked; one later recorded launch with the same reported creator. The result must say this event was already in the historical capture.
6. **Remember.** Edit and save your note. Refresh, reopen, and download the replay receipt. The note persists, the exact matched Case is clickable, and delivery is `LOCAL_RECEIPT_ONLY`. Running it again gives the same evidence receipt ID and a new local run count.
7. **Cancel.** Cancel the assignment and refresh. It remains canceled; old notes and receipts remain accessible. To test pending cancellation, employ again, start replay, then immediately cancel. No result may be manufactured after cancellation.
8. **Economic wedge.** Open **Rat capacity**. Save interest in more memory or one bounded investigation. It must say **Draft saved locally. Nothing sent.** Refresh and download the request. No charge, checkout, email, wallet, capacity activation or service order occurs.

## Score the successor against REBIRTH 01.1

| Question | Owner score / notes |
|---|---|
| Can a stranger explain the value and historical context in ten seconds? | /5 |
| Can they inspect the Case, identify its limits and choose a next action? | /5 |
| Does saving a question and reopening a receipt feel useful enough to return? | /5 |
| Do all evidence, replay, delivery and pricing claims feel honest? | /5 |
| Does the Rat feel like a memorable companion rather than decoration? | /5 |
| Can the whole phone journey finish without sideways scrolling or lost input? | /5 |

Baseline: [desktop](docs/receipts/unleashed-01/baseline-desktop.png), [phone](docs/receipts/unleashed-01/baseline-mobile.png). Successor: [desktop](docs/receipts/unleashed-01/desktop-home.png), [phone](docs/receipts/unleashed-01/mobile-home.png), [Case](docs/receipts/unleashed-01/desktop-case.png), [returned memory](docs/receipts/unleashed-01/mobile-memory.png).

## Exact expected evidence

- Starting Case: `7a3be3d57a9d7db7c155945751a1e7d455a99ed6b249b6309065ff2c3eb0f568`.
- Starting token: `0x649d1359062905fc7940b875686c64ec57b3ce36`, block `84271870`.
- Reported creator: `0xc7e62201fdd5df2627144b771cf2b375d3bc706d`.
- Later recorded Case: `960c47640f24aee5f16b8de6a75db151517fb5e669ca90579ddad8ae50576d1b`, block `84273942`.
- Feed SHA-256: `7d922050fab3da48fb8a0ee4067f616de91f6441497b506058d07eb294904fe9`.
- Deterministic replay receipt: `replay:441518e3f858d5789ad8df9b99846a0b9346b7c30f2d1ad45e4799d10cbbd511`.

## Reality and remaining decision

Source validation, local saves, notes, replay work, downloads, cancellation and restart recovery are real. Replay timing is a local demonstration over historical rows. There is no live collector, future event, Telegram delivery, payment or activated paid capacity.

The largest remaining product gap is a qualified fresh source and a separately authorized real watch/delivery return loop. This experiment does not prove retention, willingness to pay, or live workforce readiness.

**Owner action:** play the desktop and phone journey and accept or reject the product direction. The draft PR is for review; do not merge or deploy as part of this playtest.
