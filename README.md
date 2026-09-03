# LunaDesk

A fullstack **React + Next.js** recreation of the LunaDesk multi-agent chat app,
packaged as a **macOS `.dmg`** desktop app via Electron, with an agentic backend
built on the **Pi coding-agent stack** (`@earendil-works/pi-ai` +
`@earendil-works/pi-coding-agent`).

> Ported from the original native macOS SwiftUI app (preserved under [`legacy/`](./legacy)).

## Highlights

- **Auth-first desktop onboarding** with ChatGPT/Codex browser sign-in or an OpenAI API key.
- **Multi-agent chat** with a dark, native-feeling UI, sidebar navigation, chat pane, composer, and compact agent-creation window.
- **One clean starting agent** — a new workspace contains only Default Agent, which you can rename and customize with your own prompt after sign-in.
- **Real spawn and delegate** — tell a solo agent to `spawn 3 agents to ...` (or use `/delegate`). A planner creates distinct named agents with separate roles, personas, and assignments, adds each one to the sidebar, then opens a shared group where they respond to one another in turn.
- **Group chats** where bots actually converse with one another (multi-agent turn-taking), mirroring the original "Offsite crew".
- **Pluggable agent runtime** — the real Pi-backed runtime (`PiAgentRuntime`) when a provider is configured, with a credential-free `LocalAgentRuntime` fallback so the whole product is demonstrable offline.
- **LLM provider screen** with **Codex (ChatGPT) SSO sign-in** and API-key providers, using Pi's unified provider/auth layer.
- **Default model: "Luna Max · High"** = the Codex `gpt-5.6-luna` model at `high` reasoning (see [Interpretations](#interpretations)).

## Quick start

```sh
npm install
npm run dev          # http://localhost:3000
```

Other commands:

```sh
npm run build        # production build (Next.js "standalone" output)
npm run typecheck    # tsc --noEmit
npm test             # vitest unit tests
npm run electron:dev # run the Electron desktop shell against `next dev`
```

## Architecture

```
src/
  app/
    page.tsx                # main client app (workspace)
    api/chat/route.ts       # SSE streaming of a single bot reply
    api/delegate/route.ts   # plans distinct agents for a spawn/delegate request
    api/providers/route.ts  # provider status + API-key set/clear
    api/auth/codex/route.ts # Codex OAuth (SSO) login, streamed over SSE
  components/               # Sidebar, ChatPane, Composer, AgentPicker, ProviderSettings, BotMark, MessageRow
  lib/
    config.ts               # DEFAULT_MODEL ("Luna Max"), featured providers
    types.ts                # Bot, ChatMessage, AgentRuntime interface (the adapter seam)
    useWorkspace.ts         # client store (bots, onboarding, group orchestration)
    agents/
      models.ts             # pi-ai Models collection + credential store
      pi-runtime.ts         # PiAgentRuntime — the real Pi integration
      local-runtime.ts      # LocalAgentRuntime — offline fallback
      runtime.ts            # picks pi vs local based on available auth
      credential-store.ts   # file-backed pi-ai CredentialStore (0600, gitignored)
      codex-login.ts        # Codex OAuth orchestration
electron/                   # Electron main + preload (desktop shell)
scripts/prepare-standalone.mjs  # assembles the standalone bundle for packaging
legacy/                     # the original SwiftUI app, preserved
```

### Agent runtime seam

`AgentRuntime` (in `src/lib/types.ts`) is the clean seam for swapping backends.
`PiAgentRuntime` maps a bot + transcript onto a `pi-ai` `Context` and streams the
reply through Pi's unified LLM API (the same provider/model/auth layer the Pi
coding agent uses). To drop in the full Pi *coding agent* SDK
(`createAgentSession` from `@earendil-works/pi-coding-agent`, already a
dependency) for tool-using agents, implement a new `AgentRuntime` and register it
in `runtime.ts` — no UI changes required.

## Interpretations

Because parts of the request were ambiguous, the following decisions were made
and are easy to change:

- **`pi-coding-agents`** → resolved to the [Pi agent harness](https://github.com/earendil-works/pi) by earendil-works. We depend on `@earendil-works/pi-ai` (the unified multi-provider LLM API, used for chat) and `@earendil-works/pi-coding-agent` (the coding-agent SDK, wired as an available adapter). These are real, installed dependencies.
- **"Default luna max high something something"** → the Codex catalog ships a model literally named **GPT-5.6 Luna** (`gpt-5.6-luna`). We default to that model at **`high`** reasoning, branded **"Luna Max · High"**. The single source of truth is `DEFAULT_MODEL` in `src/lib/config.ts`.
- **Agent navigation** → agents live in the sidebar; the redundant top tab strip and its close controls are intentionally removed. Groups remain first-class bots with `members[]`.

## Codex (ChatGPT) SSO / auth

On first launch, choose **Continue with ChatGPT** or enter an **OpenAI API key**.
The ChatGPT option starts
Pi's OAuth login for the `openai-codex` provider and streams the auth URL / device
code back to the UI. On success the OAuth token is persisted in the local
credential store and auto-refreshed by Pi on every request. No API key is needed
for the Codex subscription path. Provider settings remain available from the
gear in the sidebar after onboarding.

- **Credentials are never hardcoded.** API keys/tokens live only in the file-backed credential store (default `~/.lunadesk/credentials.json`, mode `0600`, gitignored) or in provider env vars (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
- Codex SSO end-to-end requires a real **ChatGPT Plus/Pro subscription** to complete; it could not be fully exercised in CI (no subscription available). The flow, event streaming, and token persistence are implemented and wired.

## macOS `.dmg` packaging

Packaging is wired with `electron-builder` (config in `package.json` → `build`).

```sh
# On a macOS runner:
npm run dist:mac      # == npm run build && prepare-standalone && electron-builder --mac dmg
# → release/LunaDesk-<version>-arm64.dmg  and  -x64.dmg
```

`npm run build` produces the Next.js **standalone** server bundle;
`scripts/prepare-standalone.mjs` assembles it (server + static + public) into
`dist-electron/app`, which Electron packages as `resources/app` and launches via
`server.js` on a free port. In dev, `electron:dev` attaches to `next dev`.

**Producing/signing the real `.dmg` requires macOS and cannot be done on Linux.**
On Linux you can smoke-test packaging with `npm run dist:linux` (an unpacked
Electron `dir` build). For a signed/notarized `.dmg`, set `CSC_LINK` /
`CSC_KEY_PASSWORD` (Developer ID cert) and Apple notarization credentials on the
macOS runner.

## Tests

`npm test` runs vitest unit tests covering the offline runtime, the transcript
mapping, and the credential store. The Next.js API routes were verified
end-to-end (single chat, group turn-taking, provider set/clear, and a real —
correctly failing — live Pi request).
