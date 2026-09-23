# Bible reading and multilingual sources

## Reading interface

- Desktop: independent Book / Chapter / Verse scroll columns to the left of the reader.
- Mobile: the same three-column selector opens in a native dialog. Opening it reveals the active book, chapter and verse; choosing a verse closes the dialog and highlights it in the complete chapter.
- Next/previous chapter navigation loads the actual adjacent book's chapter list. Verse numbers and chapter counts come from the selected edition, not from an English template.
- Reader preferences and bookmarks stay on this device. Combined verses (e.g. 16–17) remain combined as published.

## Sources

1. The local World English Bible Protestant Edition (WEBP), public domain: 66 books, 1,189 chapters, 31,103 verse entries, with headings and notes.
2. Licensed YouVersion API editions when a server credential is configured.
3. eBible.org catalogue, imported from https://ebible.org/Scriptures/translations.csv on 2026-09-24 KST: 1,550 entries covering 1,242 distinct ISO 639-3 language codes. These are catalogue counts, **not a claim that all editions are readable in NCG or independently certified**.

The catalogue records source certification and redistribution flags. Editions marked non-redistributable open their official source. For in-app reading, the edition must also have a recognized public-domain or Creative Commons notice on its own copyright page. Other licences remain source-only pending review. Per-edition attribution and full licence text are displayed. Noncommercial / no-derivatives terms must remain respected in future monetization or content changes.

Korean NKRV (개역개정) remains the preferred Korean edition. Until licensed in-app access is connected, it opens the Korean Bible Society. The public-domain Korean 1910 edition is distinctly labelled and never presented as NKRV or KRV.

## Server adapter

`GET /api/bible-source?version=<catalogue-id>&file=<allowed-htm-name>` fetches a fixed eBible.org host. It rejects unknown/restricted editions, traversal, redirects, unexpected content types and oversized responses; concurrency, timeouts, memory-cache size and response size are bounded. Netlify also applies per-IP rate limiting. HTML is returned as JSON and parsed into plain verse text, source headings and separate notes; third-party HTML/scripts are never rendered directly in NCG.

Vite, the standalone Node server and Netlify Functions share this adapter. Direct browser-to-provider fetching is not used because provider CORS support is inconsistent.

Refresh the catalogue using `scripts/import-bible-catalogue.py` with the downloaded source CSV. Review changes to source permissions before deployment.

## Verification (2026-09-24)

- Real Spanish Reina Valera 1909 John 3: all 36 verse entries, original punctuation and verse 16 selection.
- Arabic Van Dyck John 3: all 36 verses; RTL direction and Arabic numerals retained.
- Desktop 1280px, mobile 390px: no horizontal overflow; current columns scroll into view after the native dialog opens.
- Build and 145 tests / 24 files passed at 02:28 KST. Tests cover source parsing, footnotes, merged verse selection, cross-book navigation, proxy restrictions and local complete-Bible integrity.

## English-source reference translation

When no edition is present in the connected catalogue, NCG shows the original English WEBP and offers an explicitly requested translation aid. A missing catalogue entry does not prove that no published Bible exists; a YouVersion directory link remains available. Known catalogue editions, including source-only editions, take priority. A provider outage or licence restriction does not trigger translation of an already catalogued edition.

- Every aid is marked **automatic / unreviewed**, distinct from a published or church-approved Bible. The English source remains visible with its original attribution and notes.
- Requests contain only an ISO language tag, chapter and one fixed block of at most six verse entries. The server loads its own public-domain WEBP source; it does not accept arbitrary prompts or source text.
- Live check at 02:31 KST: Irish John 3:1–6 returned six corresponding verse IDs with `reviewed: false`. Two repeat requests returned the same generation timestamp and content hash; the second took 490 ms. This verifies operation and cache reuse, not linguistic accuracy.
- The model must preserve each supplied verse ID exactly once and in order. Missing, duplicated, reordered, unchanged-English, malformed or truncated results fail closed. Textual-note-only verses are not sent to the model as empty text to be filled in.
- Known sign languages are not represented as machine-written translations. Unknown or unsupported languages show an honest message with continued access to the English original.
- Netlify AI Gateway provides server-only provider credentials; `gpt-4.1-mini` is the initial model. No credentials enter the browser or repository.
- Site-wide Netlify Blobs cache keys include source content, prompt revision, model and target tag. The shared daily preview budget uses a Supabase transaction and global row lock for 60 fresh provider calls, carrying the previous Blobs usage forward without resetting it; per-IP rate limit is six requests per 180 seconds. Cache hits do not use the generation budget. Two active provider requests per instance and a 25-second timeout bound runtime work. The standalone Node/Vite adapter uses an in-memory cache/counter for development. See [quota boundaries and verification](translation-quota.md).
- The cap is a launch safeguard, not a guarantee of indefinite free service. Increase only with measured usage and a funded hosting plan. No paid plan or automatic credit recharge was enabled for this change.
- Automated structural checks do not establish linguistic or theological accuracy. Native-language and church review are still needed.

References: [Netlify AI Gateway](https://docs.netlify.com/build/ai-gateway/overview/), [Netlify Blobs conditional writes](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Netlify rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/).

## Remaining source work

NKRV still needs a licensed in-app source. The full global published-version catalogue, automated translations in every language, and native-speaker review are not complete.

## Budget storage failure handling (2026-09-24 KST)

The installed Blobs SDK’s conditional-write branch can return `modified: true` after a failed HTTP response. The adapter now rejects failed PUT responses before the SDK sees them, while preserving 412 conflicts for a fresh read. A reported success without an ETag, corrupt/non-numeric/negative persisted usage, or an existing record without its comparison tag also fails closed. An uncertain reservation cannot start a model request. Normal cache hits remain readable; no quota records are reset or deleted by this change.

Eight new adapter cases (five failed before the fix), five transport cases (three failed with the previous pass-through transport), and a provider-not-called regression pass. The complete suite passes 228 tests in 42 files; production build passes. Tests simulate failure responses without sending private text, provider requests or real storage writes.

The above describes the earlier Blobs counter repair. Migration 011 subsequently moved reservations to a transactional Supabase store; the checked transport remains for cached-translation writes. The current adapter no longer performs conditional counter writes. This remains a preview request quota, not a financial spending limit. Netlify’s own guidance recommends a database for counters rather than read-modify-write Blobs. References: [Netlify Blobs guidance](https://github.com/netlify/context-and-tools/blob/main/cursor/rules/netlify-blobs.mdc), [conditional-write failure report](https://github.com/netlify/primitives/issues/741).
