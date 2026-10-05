# Revamp progress

Updated 5 October 2026. Branch: `edition-look`.

## Pull requests

No open pull requests were waiting. This branch is the work. A pull request form was shown and not submitted, so this is not on `main`.

## Features

| # | Feature | Status |
|---|---|---|
| 1 | Edition look | In progress. Display face vendored. Three doors on the masthead. Ticker removed from the masthead. Offline state uses the same shell. |
| 2 | Enable debt only | Not started. Publications stay disabled. |
| 3 | Machine feeds | Not started |
| 4 | Lead card and history card | Not started |
| 5 | Six topic cards | Not started |
| 6 | Contract dossier | Not started |
| 7 | Look up a place | Not started |
| 8 | Compare, one indicator | Not started |
| 9 | Polling table | Not started |
| 10 | Edition page and read API | Not started |

## This slice

- `public/fonts/familjen-grotesk-latin.woff2` is Familjen Grotesk, SIL Open Font License, wired through `next/font/local`.
- Masthead doors are Latest, Look up, Compare at every width.
- The dateline ticker is no longer rendered.
- Offline page is one card, no fake numbers.

## Next

1. Open the pull request and merge only after the quality check is green.
2. Enable debt only after the generator CSV reconciles.
3. Do not invent NHS figures.
