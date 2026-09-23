# Private quiz progress

The quiz keeps personal practice totals: answered questions, correct answers, completed rounds, best score and longest streak. These are client-reported learning aids, not trusted exam results or public rankings. Individual answers and question text are not uploaded.

## Storage and synchronization

- Visitors keep totals in `ncg:v1`. Signing in mounts an account-specific store; visitor progress is not silently assigned to that account.
- My page offers an explicit guest import. A source ID travels with the guest record and the account's local import checkpoints prevent repeated imports from adding the same answers. Clearing the account's local storage also clears these import checkpoints; cross-device import deduplication is not yet implemented.
- Signed-in totals use an acknowledged baseline and a persisted pending operation UUID. Only new counter increments are sent; best score/streak use maxima. Another device's work is merged rather than overwritten.
- Lost responses retry the same operation. Answers made during a request survive its acknowledgment. Stale reads and responses from an unmounted account are ignored.
- The client retries on reconnection, returning to the page and every minute while visible. The UI distinguishes local, pending, saved and delayed states. No successful account save is claimed before the server responds.

## Database

Migration `009_ncg_quiz_progress.sql` adds owner-only SELECT policies and a constrained security-definer update RPC. Anonymous access and direct client writes are denied; suspended users cannot update. An operation ledger rejects changed payloads under a reused UUID and prevents double counting. New operations are limited to 300 per user/hour; accepted replays remain safe. Inputs are bounded integer fields with correct answers no greater than answered questions, best score at most 600 and streak at most 30.

Applied to the NCG project on 2026-09-24 KST. Migration SHA256: `4038eb4e21f406b4e3d9d0a92ddd6152df132bd56953f87e26ea7b82e69b2db0`. Both tables return anonymous HTTP 401 / PostgreSQL 42501. The all-in-one setup file is for a new empty project only; do not rerun it on the configured project.

## Verification

178 tests / 32 files and production build pass. Added database tests exercise two users, independent increments, replay/conflict, malformed inputs, rate limits and suspended users. React tests exercise uncertain writes, in-flight edits, account switches and rapid repeated answer/result clicks. Existing setup tests now compare migration names and hashes rather than a fixed migration count.

Local browser: a five-question round saved 5 answered, 5 correct, one round and a best score of 70. My page retained the counters after reloading. Desktop 1280px and mobile 390px were checked; the mobile record and save status wrap within the viewport.

Actual Google/email login and two real signed-in devices remain unverified. Passing the database and mocked-client tests does not demonstrate operational email delivery or OAuth configuration.
