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
