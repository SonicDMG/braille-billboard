# ⠿ Braille Billboard

> ⠶ **Ask your documents a question. Watch the answer rendered in glowing dot-matrix braille — live, animated, on a black screen.** ⠶

![Braille Billboard in action](public/gifs/billboard-demo.gif)

Braille Billboard is a Next.js app that connects to an [OpenRAG](https://github.com/SonicDMG/openrag) knowledge base, queries it with natural language, and renders the result as an animated braille dot-matrix billboard ⠿ — complete with entrance animations (fly-in, dissolve, sparkle, typewriter), AI-generated sprites, and one-click GIF export.

---

## ⠼ Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | `node -v` to check |
| An OpenRAG instance | [Install guide](https://github.com/SonicDMG/openrag) |

---

## ⠲ Run in 3 steps

```bash
# 1. Clone and install
git clone https://github.com/SonicDMG/braille-billboard.git
cd braille-billboard
npm install

# 2. Configure
cp .env.local.example .env.local   # then edit with your values
```

```ini
# .env.local — required
OPENRAG_BASE_URL=http://localhost:3000   # your OpenRAG instance
OPENRAG_API_KEY=your_openrag_api_key

# Optional
EVERART_API_KEY=your_everart_key        # enables AI-generated sprites
NEXT_PUBLIC_BILLBOARD_DWELL_SECONDS=15  # seconds each answer stays on screen
NEXT_PUBLIC_BILLBOARD_RESUME_SECONDS=60 # seconds before auto-cycle resumes
NEXT_PUBLIC_BILLBOARD_FONT_SIZE=32      # braille character size in px
```

```bash
# 3. Start
npm run dev
```

⠦ Open [http://localhost:3001](http://localhost:3001) and start asking. ⠴

---

## ⠖ How it works

1. ⠿ **Ask** — type a question in the left panel (use `@sourcename` to scope to a specific document)
2. ⠶ **Watch** — the answer flies onto the dot-matrix billboard in braille
3. ⠾ **Save** — hit the GIF button on any billboard item to export it

⠤ `Esc` / `/` toggles the query panel · `←` `→` cycles through your query history ⠤

---

## ⠃ Built with

### ⠿ Unicode Braille rendering
Every character on the billboard is a real Unicode Braille cell (U+2800–U+28FF). Each cell packs an 8-dot grid into a single code point — 2 columns × 4 rows. The app ships a custom [`BrailleCanvas`](lib/braille.ts) engine that treats those cells as pixels: set a dot, clear a dot, run a Bresenham line, word-wrap text. The full-screen wave on the splash panel, the entrance animations, and the billboard copy are all just braille characters updating at 20 fps.

### ⠐ OpenRAG
[OpenRAG](https://github.com/SonicDMG/openrag) is the RAG backend that powers every query. It ingests your documents, indexes them, and exposes a streaming chat API. Braille Billboard sends a carefully crafted prompt that tells the LLM to respond as a billboard copywriter — punchy headline, one-sentence summary, bold tagline — and streams the JSON back token by token. Type `@filtername` in the query box to scope a question to a specific document source.

### ⠨ EverArt
[EverArt](https://everart.ai) generates the portrait image that appears beside each billboard answer. After the LLM responds, the app fires a `txt2img` request using the `visualDescription` field the LLM wrote for the subject. The resulting PNG is sampled pixel-by-pixel server-side, background-masked, and converted to a `SpriteData` map — a `"y,x" → "#rrggbb"` object the dot-matrix renderer repaints as colored braille dots. No EVERART_API_KEY, no sprites — everything else still works.

### ⠸ Bob
This app was built with [Bob](https://www.ibm.com/products/watsonx-code-assistant) — IBM's AI coding assistant. Bob planned the architecture, wrote the braille rendering engine, wired up the streaming pipeline, and authored every component from scratch. The `AGENTS.md` and `CLAUDE.md` files in the repo carry the agent rules Bob followed throughout development.

### ⠰ Next.js + SQLite
The frontend and API routes run in [Next.js](https://nextjs.org) 16. Query history is persisted locally in a [SQLite](https://www.sqlite.org) database via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) — no external database required. GIF export is handled entirely in the browser using [`gif.js`](https://jnordberg.github.io/gif.js/) with a Web Worker, so recorded animations never touch the server.
