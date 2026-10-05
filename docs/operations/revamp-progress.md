# Revamp progress

Started 5 October 2026. Spec: the 10-feature build note. Branch: `edition-look`.

## Pull requests

No open pull requests on `wilfgrainger/gov-pulse`. Latest closed request is #196, already closed. Nothing to merge.

## Features

| # | Feature | Status |
|---|---|---|
| 1 | Edition look: grey page, white cards, no shadow, display face not Arial | In progress on `edition-look` |
| 2 | Enable debt only, from the ONS generator CSV | Not started |
| 3 | Machine feeds, bulletin as a check | Not started |
| 4 | Lead card and history card | Not started |
| 5 | Six topic cards | Not started |
| 6 | Contract dossier | Not started |
| 7 | Look up a place | Not started |
| 8 | Compare, one indicator | Not started |
| 9 | Polling table, no average, no odds | Not started |
| 10 | Edition page and read API | Not started |

## This slice

`app/edition-look.css` overrides the warm paper theme. The display stack no longer starts with Arial. Familjen Grotesk is named first and still needs a self-hosted file before it can be the computed face. Publications stay disabled.

## Next

1. Vendor the display face and wire it in `app/layout.tsx`.
2. Open this branch as a pull request after the font file lands.
3. Do not enable publications until debt reconciles.
