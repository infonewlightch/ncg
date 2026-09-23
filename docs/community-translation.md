# Community and chat translation

The Netlify `/api/translate` adapter replaces the former 503 stub. It uses the existing Netlify AI Gateway environment, OpenAI-compatible chat completions (`gpt-4.1-mini`), and migration 011's transactional Supabase reservations. New provider credentials or account permissions are not created.

## Source and access boundary

- Requests carry `postId` or `messageId` and a target language. Browser-supplied source text/language cannot substitute the stored source. Invalid/ambiguous IDs, unknown fields and malformed/unregistered language tags are rejected.
- Published posts are read with the requester's Supabase bearer (or anonymous public access) under RLS. Pending/rejected/withdrawn/inaccessible posts are not translated, including an author's own draft.
- Private messages require a verified active member. The server reads the message under that token, confirms sender/recipient membership, approved delivery, and current `ncg_can_chat` friendship, active-account and bidirectional-block checks. An unrelated moderator cannot use moderation visibility to translate private messages through this endpoint.
- Raw text is disabled in the Netlify adapter. Device-only reflections remain on the device. The standalone Node gateway still accepts raw text from verified active members for its existing development use.
- Authorization and source reads happen before the in-memory translation cache is consulted. Private cache scope includes reader and message ID. Cached output is not an authorization bypass. Existing client views do not receive instant withdrawal/block notifications.

## Provider and limits

The client token, name and nationality are not sent to the translation provider. The source text and source/target language are sent through Netlify to OpenAI. Publication and chat screens disclose this in Korean, English and Spanish and provide original-text viewing. Do not put source text, tokens or provider responses into production logs.

Cache lifetime is 15 minutes, bounded to 300 results per function instance; private results are never saved to public Blobs. Cache keys include source content/language, target, model and resource scope. Source edits change the cache key. Each uncached provider call first reserves a shared request: community total 60 per UTC day, 20 per active member, and 20 for all guests together. Cache hits do not reserve again. These are preview limits and do not ensure unlimited availability or monetary spend caps; see [quota limitations](translation-quota.md).

Netlify limits each IP/domain to 30 requests per 180 seconds. The gateway also has bounded per-instance guards and uses the platform `context.ip`, never client-supplied forwarding headers. Body limit 12 KB, source text 1,800 characters, provider output 4,096 tokens, timeout 20 seconds and three provider requests per instance. Exhaustion, unavailable quotas, invalid credentials, failed providers, truncated output or unsupported languages preserve the original. Supported-language selection is not a claim that every language can be translated accurately.

## Validation and remaining work

259 tests across 46 files pass, including stored-source substitution, unknown/ambiguous resources, owner drafts, invalid sessions, unrelated/reviewed/blocked messages, secret-key/wrong-project rejection, quota failure, cache reservation reuse, ID-only UI requests, device-only non-transmission and outage wording. Production build passes. Server adapter tests use simulated auth/database/provider responses and real request/response streams.

A local browser exercised the actual Netlify adapter with simulated database/provider responses, actual SharedPost/Friends components, translated display and original toggles. Desktop 1292px and mobile 390px showed no horizontal overflow; mobile received visual review. No real private messages, accounts, moderation actions or provider requests were created in this validation.

Deployment guards can be checked without real users; actual signed-in two-account translation, two-device access revocation, provider delivery of a church-approved published reflection and language quality review remain outstanding. Google/SMTP configuration is still required for real account testing. No test post is published to the global community just to demonstrate success.

References: [Netlify function requests and context](https://docs.netlify.com/build/functions/api/), [Netlify AI Gateway](https://docs.netlify.com/build/ai-gateway/overview/).
