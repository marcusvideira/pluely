# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Pluely is a Tauri 2 desktop app: a privacy-first, always-on-top AI assistant overlay. Frontend is React 19 + TypeScript (Vite), backend is Rust. Users bring their own LLM/STT API keys (stored locally) OR activate a license to route through the hosted "Pluely API". License: GPL-3.0.

## Commands

```bash
npm run tauri dev      # Run the full app (Vite + Rust) in dev — use this, not `npm run dev`
npm run dev            # Vite frontend only (port 1420); won't have Tauri APIs
npm run build          # Type-check (tsc) + Vite build of the frontend
npm run tauri build    # Build production desktop binaries (.dmg/.msi/.exe/.deb/.rpm/.AppImage)
```

There is no test suite and no linter configured. `npm run build` runs `tsc` and is the de-facto correctness check for frontend changes. For Rust, use `cargo check`/`cargo build` from `src-tauri/`.

### Build-time environment variables

Several values are baked in at compile time via `option_env!` (see `src-tauri/build.rs` + `dotenv`). Without them the hosted-API and analytics features fail at runtime, but the app still builds:
- `APP_ENDPOINT` — base URL for the hosted Pluely API
- `API_ACCESS_KEY` — access key for that API
- `POSTHOG_API_KEY` — analytics (optional)

## Architecture

### Two windows
- **`main`** — the overlay (`tauri.conf.json`: 600×54, transparent, undecorated, `contentProtected: true` for screenshot/screen-share invisibility, `skipTaskbar`). Renders route `/`.
- **`dashboard`** — full settings/history UI, pre-created on startup (`window.rs`). Renders all routes under `DashboardLayout`.

Window creation/positioning/visibility logic lives in `src-tauri/src/window.rs`. The overlay auto-resizes its height from the frontend via the `set_window_height` command.

### Frontend structure
- Routing in `src/routes/` — `/` is the overlay `App`; dashboard pages (`/dashboard`, `/chats`, `/system-prompts`, `/settings`, `/audio`, `/screenshot`, `/responses`, `/shortcuts`, `/dev-space`) are nested under `DashboardLayout`. Pages live in `src/pages/`.
- **Global state**: `src/contexts/app.context.tsx` (`AppProvider` / `useContext`) holds providers, selected provider, audio devices, screenshot config, etc. `theme.context.tsx` handles theming.
- Import alias `@` → `src/` (e.g. `@/lib`, `@/config`, `@/pages`).
- UI is Tailwind CSS v4 + Radix primitives + shadcn-style components in `src/components/ui/`.

### Persistence — two layers
- **localStorage** for all config/settings. Keys are centralized in `src/config/constants.ts` (`STORAGE_KEYS`). Access through helpers in `src/lib/storage/` (use `safeLocalStorage`, never raw `localStorage` in new code). Note custom-provider keys are prefixed `curl_` because providers are stored as curl strings.
- **SQLite** via `tauri-plugin-sql` (`sqlite:pluely.db`) for chat history and system prompts. Migrations are SQL files in `src-tauri/src/db/migrations/` registered in `src-tauri/src/db/main.rs`. Frontend DB access goes through `src/lib/database/` (`getDatabase()` + `*.action.ts` files).

### The curl-template provider system (important)

This is the core abstraction for LLM/STT integration. Every provider — built-in or custom — is defined as a **curl command string with `{{VARIABLE}}` placeholders** (e.g. `{{API_KEY}}`, `{{MODEL}}`, `{{SYSTEM_PROMPT}}`, `{{TEXT}}`, `{{IMAGE}}`, `{{AUDIO}}`). Built-ins are in `src/config/ai-providers.constants.ts` and `src/config/stt.constants.ts`; each also declares a `responseContentPath` (e.g. `choices[0].message.content`) and a `streaming` flag.

At request time the curl is parsed with `@bany/curl-to-json`, variables are substituted (`src/lib/functions/common.function.ts` — `deepVariableReplacer`, `extractVariables`, `buildDynamicMessages`, `getByPath`), and the request is issued via `@tauri-apps/plugin-http`. Adding a provider = adding a curl template, not writing integration code. Custom providers are validated and persisted to localStorage.

### AI request path (BYO-only)
The app is fully open-source and local: there is no hosted/paid tier. `src/lib/functions/ai-response.function.ts` (`fetchAIResponse`) and `src/lib/functions/stt.function.ts` (`fetchSTT`) issue the HTTP request directly using the user's curl template (BYO API key) and stream the response themselves. There is no `shouldUsePluelyAPI`/license branch — a provider must always be selected.

System prompts are enhanced before sending: response length/language settings and silent markdown-formatting instructions are appended (`buildEnhancedSystemPrompt`). "Generate system prompt with AI" (`src/pages/system-prompts/Generate.tsx`) reuses `fetchAIResponse` with a JSON-returning meta-prompt — no backend call.

### Rust backend modules (`src-tauri/src/`)
- `lib.rs` — app entry; registers all plugins, managed state (`AudioState`, `CaptureState`, shortcut state), and the full `invoke_handler` command list. **New Rust commands must be added to the `generate_handler!` macro here.**
- `capture.rs` — screenshot capture (full screen + drag-to-select region), base64 encoding (`xcap`/`image`).
- `speaker/` — system-audio capture, **platform-split**: `windows.rs` (WASAPI), `macos.rs` (`cidre`/ScreenCaptureKit), `linux.rs` (PulseAudio). Common command surface + VAD config in `commands.rs`/`mod.rs`.
- `shortcuts.rs` — global keyboard shortcuts (toggle visibility, capture, dashboard, move window), registered via `tauri-plugin-global-shortcut`.
- `window.rs` — window setup, positioning, dashboard create/toggle, always-on-top, icon visibility.

Default shortcuts (frontend defaults in `src/config/shortcuts.ts`; per-OS): toggle `Cmd/Ctrl+\`, system audio `Cmd/Ctrl+Shift+M`, voice `Cmd/Ctrl+Shift+A`, screenshot `Cmd/Ctrl+Shift+S`, dashboard `Cmd/Ctrl+Shift+D`.

### Custom hooks
Feature logic is largely in `src/hooks/` (`useChatCompletion`, `useCompletion`, `useSystemAudio`, `useGlobalShortcuts`, `useCustomProvider`, `useHistory`, `useSettings`, etc.). Prefer extending these over inlining logic in pages/components.

## Conventions
- Cross-platform: when touching system audio, screenshots, or window behavior, remember macOS / Windows / Linux diverge in Rust (`#[cfg(target_os = ...)]`) and the frontend reads platform via `getPlatform()` (`src/lib/platform.ts`).
- Capabilities/permissions for Tauri commands are declared in `src-tauri/capabilities/` (`default.json`, `cross-platform.json`) — a new plugin/command may need an entry there or it will be blocked at runtime.
- Release/publish is automated via `.github/workflows/publish.yml`; the updater pulls from `https://pluely.com/api/update` (config in `tauri.conf.json`). Version lives in `package.json`, `src-tauri/Cargo.toml`, and `tauri.conf.json` — keep them in sync.
