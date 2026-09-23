# Community feed request isolation

Each feed view owns an abort controller. Changing the QT passage, category, account or feed scope, refreshing after moderation actions, or leaving the view invalidates both its initial load and pending pagination. Responses from that invalidated view cannot append posts or overwrite the current error/loading state.

Pagination also locks before React rerenders, so rapid repeated clicks produce one request. A refresh clears the previous list and starts a new view; a late page cannot restore content absent from the refreshed results. Existing server RLS, moderation and block policies remain authoritative. This is not a replacement for those policies and does not guarantee instant removal of content already displayed before a later server action.

Three React tests first reproduced cross-passage leakage, stale pagination after refresh and duplicate page requests, then passed after the fix. All 199 tests in 38 files and the production build pass as of 2026-09-24 KST. In the actual browser, the real SharedFeed component loaded 30 simulated posts, held the next page, switched to another QT passage, and completed the old request. Only the new passage's post remained. A 390px mobile viewport displayed the 350px post card with no horizontal overflow.

The local harness used no production credentials or public posts. Real signed-in multi-user moderation, reporting, blocking and translation still require operational integration testing. The earlier chat checks are recorded in `friends-chat.md`.
