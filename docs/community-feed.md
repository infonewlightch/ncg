# Community feed request isolation

Each feed view owns an abort controller. Changing the QT passage, category, account or feed scope, refreshing after moderation actions, or leaving the view invalidates both its initial load and pending pagination. Responses from that invalidated view cannot append posts or overwrite the current error/loading state.

Pagination also locks before React rerenders, so rapid repeated clicks produce one request. A refresh clears the previous list and starts a new view; a late page cannot restore content absent from the refreshed results. Existing server RLS, moderation and block policies remain authoritative. This is not a replacement for those policies and does not guarantee instant removal of content already displayed before a later server action.

Three React tests first reproduced cross-passage leakage, stale pagination after refresh and duplicate page requests, then passed after the fix. All 199 tests in 38 files and the production build pass as of 2026-09-24 KST. In the actual browser, the real SharedFeed component loaded 30 simulated posts, held the next page, switched to another QT passage, and completed the old request. Only the new passage's post remained. A 390px mobile viewport displayed the 350px post card with no horizontal overflow.

The local harness used no production credentials or public posts. Real signed-in multi-user moderation, reporting, blocking and translation still require operational integration testing. The earlier chat checks are recorded in `friends-chat.md`.

## Translation view isolation (2026-09-24 KST)

Changing the target language, source text/language, account or post publication state invalidates the previous translation request. Both HTTP errors and delayed JSON responses from an invalidated request are ignored. The small in-memory client cache is partitioned by source language, target language, post text/ID, local/remote scope and account. A remote reflection under review or restricted from publication shows its original without translation controls or a new translation request. Server access rules remain authoritative; this change does not provide instant withdrawal notifications.

Six SharedPost regressions and three chat regressions failed before the fix and pass afterward. The complete suite passes 214 tests in 40 files and the production build passes. The actual local browser rendered SharedPost and Friends with simulated translation responses: Spanish responses were held, French was selected, then old Spanish responses completed; both views retained the current result. Returning to the original language removed translation labels, and moving a reflection under review restored its original. Desktop 1292px and mobile 390px had no horizontal overflow, with mobile visual verification.

No user content was sent to a provider during this check. The deployed Netlify `/api/translate` remains an explicit 503 stub; the standalone Node gateway has authenticated/RLS-aware translation logic but still needs provider configuration and a shared quota store before serverless activation. Bible translation assistance uses a separate endpoint and is not evidence of connected community or chat translation.
