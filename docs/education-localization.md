# NCG School content languages

2026-09-25 implementation: education now follows the selected written language and script. Korean, English and Thai retain their existing authored content. Other languages use fixed English source units, prepared static data first, then validated shared translations. Unsupported translation is an explicit state; it never silently substitutes English as if it were translated.

## Content and delivery

- Courses: four tracks, 28 lessons, 280 lesson questions. Translate catalogue before displaying it and each full lesson before opening its reading or quiz. Course downloads require all lessons to complete.
- Westminster Shorter Catechism: all 107 questions and answers; translated pages contain ten items with number search and group navigation. Original languages retain full-text search.
- Game: the complete English 3,004-question bank is the canonical source for new languages. Translate selected round questions, answers, hints and explanations before shuffling options or starting the timer. The Korean/Thai banks have different UUIDs and are not merged by array index.
- IDs, progress keys, answer indexes, option order, book categories and Scripture source references cannot be changed by the model. Generated Scripture quotations are educational reading aids, not certified editions. The lesson states that references identify the English source.
- Automatic translations are unreviewed. Scripture editions, church approval and language availability are separate from structural validation. ISO language selection does not guarantee that the model can translate every registered language reliably; sign languages are not represented by text translation.

## Server and cache

`/api/education-translation` accepts only registered language/script, source revision and fixed unit IDs. GET returns cached units without generating. POST resolves English sources on the server and generates missing units. No member content or arbitrary browser text is accepted.

The SHA-256 revision includes the exact three English source files and schema version. A regression test requires updating it when sources change. Per-unit caches include the revision, language/script and model. Local cache is bounded; prepared packs live under `public/education/<revision>/<language>.json` and do not inflate the mandatory offline shell.

Requests are limited to five units, 6,000 source characters, 120 fields, 6,000 output tokens and a 25-second model timeout. The browser groups at most 100 fields/5,000 source characters with two requests at once. A failed batch aborts sibling work and stops remaining dispatch. Language changes and navigation cancel UI work.

Netlify content store: `education-translations`. Generation **shares the existing `interface-translations` daily 300-call budget**; no budget increase or new credentials. Invalid/cut-off responses, missing IDs, wrong declared language and HTML are rejected. These structural checks do not replace linguistic or theological review.

## Preparation

```sh
node scripts/prepare-education-packs.mjs --ui --catalogue-only --plan
node scripts/prepare-education-packs.mjs pt zh es ar fa hi --plan
node scripts/prepare-education-packs.mjs pt zh es ar fa hi --max-requests=240
```

Preparation resumes already validated units and stops on the existing shared budget. A complete education core has 40 units and normally 34 generation requests per language. The full game bank adds 3,004 units; it is available through requested-round translation, not claimed as fully prepared in every language.

Initial validation: full suite 458 tests passed before final review fixes; build/typecheck passed. Final deployment, prepared counts and browser checks are recorded in the operations checkpoint after verification.
