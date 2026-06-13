# Thesara

A Chrome extension that overlays vocabulary tooltips on Netflix subtitles. Hover any word to see its definition, synonyms, and an AI-generated explanation of what it means in the current scene, without leaving the page.

Built with TypeScript and Manifest V3. No tracking, no account, one permission.

---

## Features

- **Instant definitions:** fetches from the [Free Dictionary API](https://dictionaryapi.dev) with no API key required
- **Synonyms:** displayed as pills directly in the tooltip
- **Scene-aware AI context:** uses Groq's `llama-3.3-70b-versatile` to explain what the word means *in this specific moment*, not just generically
- **Pause on hover:** video pauses while the tooltip is open, resumes on dismiss
- **Shared quota, zero setup:** a Cloudflare Worker proxy provides a shared Groq key for free; no sign-up required
- **Bring your own key:** when the shared daily quota is reached, users can supply their own free Groq key; the extension walks through a full disclosure before asking
- **In-memory cache:** each word is fetched once per session via a bounded LRU cache (max 500 entries) to prevent memory growth
- **No innerHTML anywhere:** all DOM construction uses typed element APIs; no XSS surface

---

## Installation

### Chrome Web Store

Install from the [Chrome Web Store](https://chromewebstore.google.com) by searching for **Thesara**.

### Build from source

```bash
git clone https://github.com/hitesh-ctrl/thesara.git
cd thesara
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

---

## How it works

### Subtitle detection

`SubtitleObserver` polls the Netflix DOM for the subtitle container every 500 ms, then attaches a `MutationObserver` once found. It listens for text changes, deduplicates identical lines, and emits typed `SubtitleUpdate` events.

Netflix is a single-page application; navigating between episodes changes the URL without reloading the page. The observer handles this via the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) (Chrome 102+), with a `popstate` + 5-second heartbeat fallback for older builds.

### Dictionary lookup

`DictionaryService` calls `api.dictionaryapi.dev`, a free and open dictionary API that requires no key. Results are cached in a `BoundedCache<string, DictionaryResult>` keyed by lowercase word, so each unique word is fetched at most once per session.

### AI context

`AIProxy` routes each request through a two-tier fallback:

1. **Shared proxy:** a Cloudflare Worker holding the developer's Groq key, rate-limited to 13,000 requests/day (below Groq's free ceiling of 14,400) to prevent unexpected charges
2. **User's own key:** if the shared quota is exhausted, the user can provide their own Groq key via a full-disclosure panel; the key is stored locally in `chrome.storage.local` and sent only to Groq's API directly

If neither is available, a `nva:quota_exceeded` custom event fires and `QuotaDisclosureUI` renders the prompt.

### Video pause

`VideoController` uses a depth counter rather than a boolean flag. Every hover increments the counter; every dismiss decrements it. The video resumes only when the counter reaches zero, preventing rapid hovers from leaving the video stuck paused. The controller only resumes if the extension initiated the pause; a pre-existing user pause is left alone.

---

## Project structure

```
src/
  content/index.ts                ← Content script entry point
  subtitle/
    SubtitleObserver.ts           ← MutationObserver + SPA navigation handling
    PhraseDetector.ts             ← Decides which words/phrases need AI lookup
    netflixSelectors.ts           ← Netflix DOM selectors
  context/
    AIProxy.ts                    ← Groq routing: proxy → user key → quota event
    ContextExplanationService.ts  ← Formats AI request/response
  dictionary/
    DictionaryService.ts          ← Free Dictionary API with in-session cache
  tooltip/
    TooltipRenderer.ts            ← Tooltip DOM (zero innerHTML)
    styles.ts                     ← Inline styles for the tooltip
  player/
    VideoController.ts            ← Pause depth counter
  quota/
    QuotaDisclosureUI.ts          ← Full-disclosure panel for own-key setup
  util/
    BoundedCache.ts               ← LRU cache, configurable max size
public/
  manifest.json                   ← MV3 manifest (single permission: storage)
  options.html                    ← Options page
docs/                             ← GitHub Pages site
```

---

## Development

```bash
npm run dev      # Build in watch mode (outputs to dist/)
npm run build    # Production build
npm run lint     # ESLint
npm run format   # Prettier
```

The extension is built with [Vite](https://vitejs.dev). The output is a single `content.js` file loaded as a content script on `netflix.com/watch/*`.

---

## Permissions

Thesara requests the minimum permissions needed:

| Permission | Why |
|---|---|
| `storage` | Stores the user's Groq API key and daily quota state locally |
| `https://www.netflix.com/*` | Content script injection |
| `https://api.dictionaryapi.dev/*` | Dictionary lookups |
| `https://api.groq.com/*` | Direct Groq calls when the user supplies their own key |
| `https://thesara-proxy.thesara.workers.dev/*` | Shared Cloudflare Worker proxy |

No `tabs`, no `history`, no `webRequest`, no broad host permissions.

---

## Privacy

- No analytics, telemetry, or tracking of any kind
- No words you hover are stored or logged
- When a word is looked up, the subtitle text and show name are sent to the Free Dictionary API and/or Groq's API to generate a response. Nothing else.
- If you add your own Groq key, it is stored only in your browser's local extension storage and sent only to Groq; it never reaches the developer or any other server
- The shared proxy receives a request body but no personally identifying information

Full privacy policy: [hitesh-ctrl.github.io/thesara/privacy.html](https://hitesh-ctrl.github.io/thesara/privacy.html)

---

## License

MIT. See [LICENSE](LICENSE) for details.
