# Design assets

The React components, component gallery, and repository README use the assets in this directory.

| Directory | Contents | Attribution and usage |
| --- | --- | --- |
| `brand/` | Six ChatGPT SVG variants for buttons, connection cards, callouts, dialogs, and usage UI. | Follow the [OpenAI brand guidelines](https://openai.com/brand/). |
| `icons/` | Three external-link SVG variants. | These were exported with the component designs. |
| `readme/` | Black and white Sign in with ChatGPT SVG buttons, a composer design example, and a screenshot of the local component preview. | Follow the [OpenAI brand guidelines](https://openai.com/brand/). |
| `fonts/` | Inter and Open Sans WOFF2 fonts and their SIL Open Font License files. | Preserve the corresponding OFL files when distributing the fonts. |

## Font provenance

The bundled fonts are unchanged Latin-subset downloads from the versioned Google Fonts CDN: Inter 4.001 (`git-66647c0bb`, weights 100–900) and Open Sans 3.003 (weights 300–800), downloaded on 2026-09-28. Both cover the components' normal-style weights 400–600. The local filenames match the existing CSS imports; the fonts continue to load locally.

[The provenance record](fonts/provenance.json) contains the exact download URLs, SHA-256 hashes, internal font versions, download date, CSS request and selected Unicode ranges. The [saved Latin CSS selection](fonts/google-fonts-latin.css) records the API's corresponding font-face rules. Each OFL licence and family metadata URL pins Google Fonts repository commit `23e54b51ddffbc7713c583748e3bd86f62b1fa4a`. The CDN distribution versions (`v20` and `v44`) differ from the fonts' internal version numbers.

Run `npm run licenses:check` to verify the committed fonts, licence files, CSS selection, and generated notices against the recorded hashes. Before replacing a font, verify the new upstream bytes and update its provenance record, then run `npm run licenses:generate`. The generated dependency inventory and third-party notices retain the source URLs and hashes in builds. These records establish the source of the bundled files; they do not grant Design or Legal approval for the release.

The code licence does not grant rights to OpenAI trademarks or permission to imply endorsement. Consult the OpenAI brand guidelines when adapting the name, marks, or presentation of your integration.

The component gallery contains simulated connection and usage states. Its sample balances, limits, and messages do not establish a user's actual subscription, eligibility, or available usage. Connect production UI to the state returned by your integration.

The repository contains exported SVGs, not the original Figma design file. Optional comparison screenshots used during development are excluded from builds. See [third-party notices](../THIRD_PARTY_NOTICES.md) for font and dependency attribution.
