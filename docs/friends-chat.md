# Friends and chat validation

The service uses friend-code requests and recipient acceptance before messaging. Server checks in the membership migration enforce friendship, active account status and blocks in both directions. Moderation and reporting remain on the server; a UI change must not bypass them.

## Conversation request handling

- Sending locks synchronously, before React rerenders, so rapid repeated form submissions start only one request.
- The draft has an edit revision. A successful send clears only the unchanged submitted draft; text written during the request remains in the input.
- Failed sends retain the draft and show the server-appropriate error. The client does not automatically resend uncertain messages.
- Each conversation read cancels the preceding read and ignores its late response. Leaving the conversation cancels its read; each friend gets a separate mounted conversation.
- A failed initial read does not claim that the conversation is empty. A successful refresh clears the load error while preserving any separate send error.
- Friend-action errors, including failed blocking, remain visible while a conversation is open. Failure is not reported as a successful block.

## Verified on 2026-09-24 KST

Five regression cases failed against the preceding UI, then passed with the fix. A sixth test confirms failed sends retain the draft and are not retried by the polling timer. The complete suite passes 196 tests in 37 files, and the production build passes. jsdom is a development-only dependency for actual React form input events in these tests.

The real `Friends` component was also rendered in a local browser harness with a simulated server and no production credentials. A send was held pending, a new draft was typed, then the response was completed: the first message appeared once and the new draft remained. Desktop 1292px and mobile 390px had no horizontal overflow. The mobile error and text input were visually checked. The harness is in ignored `tmp/chat-preview` and is not part of production build inputs or published assets.

These checks do not constitute end-to-end production chat validation. Google/SMTP configuration, real account sign-in, two-user request/accept/message/block/report flows and connected chat translation remain operational checks. No real messages, reports, blocks, email deliveries or new accounts were created by this validation.

## Friend lookup and list refresh (2026-09-24 KST)

Changing the friend code immediately removes the previous request target, cancels its pending lookup and clears its lookup error. Repeated submit events start one lookup. Failed lookups never retain a previous target or claim that the service returned no matching member. A successful lookup still shows the member’s name, nationality and language before the user sends a request.

Friend-list refresh cancels the previous read and ignores a response arriving after the newer refresh. Loading and failed reads do not masquerade as an empty friends, requests or blocked list; refresh remains available and successful recovery clears the load error. Server authorization, acceptance and moderation rules are unchanged.

All six new regressions failed before these fixes and pass afterward. The complete suite now passes 205 tests in 39 files; production build and the 746-message ko/en/es catalogue check pass. The existing build warning about large chunks remains.

Browser validation used the actual Friends component with a simulated server: pending lookup → edit code → resolve old lookup leaves no old target, and the next lookup returns only the current target. A subsequent failed lookup removes the prior target and displays its error. Desktop 1292px and mobile 390px have no horizontal overflow; the mobile form and error were visually checked. These are local component checks, not real two-member production integration or proof of connected translation.

## Chat translation ordering (2026-09-24 KST)

Late translation JSON cannot replace the current target language or restore a translation after returning to the original language. When message publication status changes, translation status is cleared and controls are hidden for messages awaiting review or restricted from publication. Three regressions failed before the fix and pass afterward; 214 tests in 40 files and the production build now pass. The combined simulated browser check is documented in `community-feed.md`. Actual provider connection and two-account production chat checks remain incomplete.
