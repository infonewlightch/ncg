# Private video bookmarks

Church video bookmarks sync as private UUID references. The published video feed remains the authority for titles, URLs and visibility. Saving a reference does not grant access to a draft or withdrawn video.

Personally added videos and their bookmarks remain on the device. Their URLs, titles and descriptions are not uploaded by this sync. Existing local IDs are retained while merging remote church references. Visitors can explicitly import local records from My page after signing in; signing in alone does not copy them.

## Synchronization

- Add/remove deltas use a persisted operation UUID and revision, preserving edits made while a request is pending. An uncertain response retries the same operation instead of creating a second write.
- Account changes unmount the account store and abort old requests. Stale reads do not replace newer acknowledgments.
- Reconnection, page visibility and a one-minute visible-page timer trigger retries. My page distinguishes local, pending, saved and delayed states in Korean, English and Spanish.
- The server accepts at most 5,000 church references per account and 300 new operations/hour. Over-limit writes are rejected without discarding the device's bookmarks. The local storage loader accommodates 10,000 IDs; it no longer truncates a merged 5,000-reference cloud list plus personal bookmarks at 5,000.
- Withdrawn references are retained but not displayed as playable videos. Removing unavailable references individually is not yet exposed in the UI; the saved total can therefore include unavailable videos.

## Database and verification

`010_ncg_video_bookmarks.sql` was applied to the NCG Supabase project on 2026-09-24 KST. SHA256: `75ac5935c3514dff950f0a8622d8cd46e1c5756c8feb5d9a9fecff4b3e57f9d5`. Owner-only SELECT, no direct client writes or operation-ledger reads, and an active-user update RPC protect the data. Both new tables return anonymous HTTP 401 / PostgreSQL 42501. Do not rerun the migration or the new-project setup on the configured database.

190 tests in 36 files and the production build pass, including ten new video tests and two hosting preflight tests. Video tests cover concurrent device changes, final removal, late replay, payload conflicts, owner isolation, draft visibility, malformed inputs, limits, suspension, local-ID preservation and uncertain writes with in-flight removal.

Actual local browser checks covered a clearly labeled personal test video: bookmark, reload, retained saved list, remove, reload and empty list. No playback or public publishing occurred. My page was checked at 1280px and 390px without horizontal overflow. Real signed-in two-device synchronization remains unverified pending operational authentication.
