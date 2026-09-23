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
- Build and 139 tests / 23 files passed at 02:16 KST. Tests cover source parsing, footnotes, merged verse selection, cross-book navigation, proxy restrictions and local complete-Bible integrity.

## Still pending

English-source automatic translation must be labelled as automatic and unreviewed, with the English original available. It is not an authorized published Bible version, and a missing catalogue entry does not establish that no translation exists. Provider outages or licence restrictions must not silently activate this fallback. The current reader does not yet generate automatic translations.
