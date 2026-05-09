# Research Consolidation Console

A local-first TypeScript console that turns a rough research idea into a rigorously reviewed decision by:

1. **enriching** the idea into a structured research prompt,
2. helping you **run that prompt unchanged across five frontier model UIs** (ChatGPT, Claude, Gemini, DeepSeek, Kimi),
3. **collecting** the pasted markdown answers,
4. running an **adversarial review pipeline** (source audit → 3 independent critics → synthesis → decision draft → red-team → final decision) via the local `claude` CLI,
5. exporting the result as **Markdown, PDF, and ZIP**.

Everything is files on disk — `run.json` is the index, every artifact is editable, every stage is rerunnable.

```
┌──────────────────────────── Pipeline ────────────────────────────┐
│                                                                  │
│  rough idea                                                      │
│      │                                                           │
│      ▼                                                           │
│  prompt enricher (claude)                                        │
│      │                                                           │
│      ▼                                                           │
│  5 frontier model UIs (operator runs by hand, pastes back)       │
│      │                                                           │
│      ▼                                                           │
│  source audit (claude)                                           │
│      │                                                           │
│      ├── evidence critic ──┐                                     │
│      ├── decision critic   ├── critique synthesis ──┐            │
│      └── contrarian critic ┘                        │            │
│                                                     ▼            │
│                                          decision draft          │
│                                                     │            │
│                                                     ▼            │
│                                           final red-team         │
│                                                     │            │
│                                                     ▼            │
│                                           final decision         │
│                                                     │            │
│                                                     ▼            │
│                                          export (md/pdf/zip)     │
└──────────────────────────────────────────────────────────────────┘
```

## Why this exists

A single LLM answering a research question is a sample of one. Five of them, audited independently and put through three adversarial critics with different attack surfaces (evidence quality, decision quality, contrarian alternatives), give you signal you can actually trust. The console makes that workflow:

- **reproducible** — every run is a folder with prompts, sources, critiques, and the final decision; `run.json` records every CLI invocation and timing,
- **operator-driven** — you copy prompts into the model UIs yourself (no API keys for the source models, no rate-limit risk), the console only orchestrates the local-CLI critic pipeline,
- **adversarial by default** — three critics with different prompts attack the same source set; a red-team passes the consolidated draft before a final decision is written,
- **inspectable** — nothing is hidden in a database; every artifact is a markdown file you can open, edit, or version-control.

## Quick start

Requires Node 22+, pnpm 11+, and the `claude` CLI on your `$PATH`.

```sh
pnpm install
pnpm dev
```

- Web UI: http://127.0.0.1:5173
- API: http://127.0.0.1:3001/api/health
- Default run output root: `~/research-runs/` (override with `RCC_OUTPUT_ROOT`)

Optional: enable PDF export.

```sh
pnpm --filter @rcc/server exec playwright install chromium
```

## The six screens

| # | Screen   | What it does                                                                    | Primary artifact written                       |
|---|----------|---------------------------------------------------------------------------------|-----------------------------------------------|
| ① | Define   | Capture the rough idea, slug, output root, decision type                       | `00-original-idea.md`, `run.json`, folder layout |
| ② | Enrich   | Turn the idea into a rigorous research prompt; copy buttons per model           | `01-enriched-research-prompt.md`, `02-model-run-instructions.md` |
| ③ | Collect  | Five source slots (paste or file path), inline validation, source audit trigger | `sources/<model>-research.md`, `review/10-source-audit.md` |
| ④ | Review   | Run the seven-stage review pipeline; live SSE log tail per stage                | `review/{evidence,decision,contrarian}-critic.md`, `review/24-critique-synthesis.md`, `decision/30-consolidated-decision-draft.md`, `decision/40-final-red-team-check.md`, `decision/50-consolidated-decision.md` |
| ⑤ | Decide   | Side-by-side final + red-team review; rerun final / red-team / full review     | (re-writes the same artifacts above)          |
| ⑥ | Export   | Markdown, PDF, ZIP, Open Folder                                                 | `exports/{consolidated-decision.md,consolidated-decision.pdf,full-run.zip}` |

## Pipeline stages

Each stage shells out to `claude --print --output-format text --tools "" --disable-slash-commands --model sonnet` with the stage's prompt template plus the prior artifacts as `# INPUTS`.

| Stage              | Inputs                                                  | Output artifact                              |
|--------------------|---------------------------------------------------------|----------------------------------------------|
| `prompt_enrichment`| original idea + decision type + constraints             | `01-enriched-research-prompt.md`             |
| `source_audit`     | enriched prompt + 5 sources                             | `review/10-source-audit.md`                  |
| `evidence_critic`  | enriched prompt + 5 sources                             | `review/20-evidence-critic.md`               |
| `decision_critic`  | enriched prompt + 5 sources                             | `review/21-decision-critic.md`               |
| `contrarian_critic`| enriched prompt + 5 sources                             | `review/22-contrarian-critic.md`             |
| `critique_synthesis`| enriched prompt + 3 critic outputs                     | `review/24-critique-synthesis.md`            |
| `decision_draft`   | enriched prompt + 5 sources + critique synthesis        | `decision/30-consolidated-decision-draft.md` |
| `final_red_team`   | enriched prompt + 5 sources + synthesis + draft         | `decision/40-final-red-team-check.md`        |
| `final_decision`   | enriched prompt + draft + red-team                      | `decision/50-consolidated-decision.md`       |

The three critics run in parallel; everything else is sequential. A representative full-pipeline wall time is **20–25 min** on Claude Sonnet for a non-trivial topic.

Stages are config-driven — add or reorder stages in `apps/server/src/pipeline/stageConfigs.ts`, drop the matching template in `prompts/`, and the orchestrator picks it up.

## Repo layout

```
apps/
  web/            React 19 + Vite 6 + Tailwind v3 + Preline UI v2
    src/
      app/             # router, providers, app shell
      components/      # layout, ui primitives
      features/        # one folder per screen (define, enrich, ...)
      lib/             # API clients, formatters, Preline init
  server/         Fastify 5 + Pino + execa + fs-extra
    src/
      routes/          # health, runs, files, sources, pipeline, export
      services/        # runStore, runRegistry, fileStore,
                       # cliCapabilities, cliRunner,
                       # promptEnricher, stageRunner, pipelineRunner,
                       # sourceStore, sourceValidator, exporter
      pipeline/        # stage configurations
      utils/           # path safety, slug, error envelope
packages/
  shared/         Zod schemas + types (the API contract both apps import)
prompts/          # Markdown prompt templates, one per pipeline stage
```

## Run folder layout

Every run gets its own directory under `<outputRoot>/<slug>-<YYYY-MM-DD>/`:

```
local-research-consolidation-console-2026-05-09/
├── 00-original-idea.md
├── 01-enriched-research-prompt.md
├── 02-model-run-instructions.md
├── README.md                          # human-readable run index
├── sources/
│   ├── chatgpt-research.md
│   ├── claude-research.md
│   ├── gemini-research.md
│   ├── deepseek-research.md
│   └── kimi-research.md
├── review/
│   ├── 10-source-audit.md
│   ├── 20-evidence-critic.md
│   ├── 21-decision-critic.md
│   ├── 22-contrarian-critic.md
│   └── 24-critique-synthesis.md
├── decision/
│   ├── 30-consolidated-decision-draft.md
│   ├── 40-final-red-team-check.md
│   └── 50-consolidated-decision.md
├── exports/
│   ├── consolidated-decision.md
│   ├── consolidated-decision.pdf      # only after `playwright install chromium`
│   └── full-run.zip
└── run.json                           # machine-readable index of everything
```

`run.json` follows a versioned schema (`schemaVersion: 1`) defined in `packages/shared/src/run.ts`. Every CLI invocation records its provider, model, args, exit code, duration, and stderr tail.

## CLI runner notes

The runner detects what flags `claude` and `codex` actually support at runtime (parsing each binary's `--help` output) and only passes flags that exist. Two non-obvious choices baked into the default `claude` invocation:

- **Do not pass `--bare`** — it disables OAuth and only reads `ANTHROPIC_API_KEY`. Most local installs are OAuth, so `--bare` will exit with `Not logged in · Please run /login`.
- **Use `--tools ""` and `--disable-slash-commands`** — these give the same isolation as `--bare` (no MCP, no project CLAUDE.md leaking into the prompt, no `/foo` text being interpreted as a command) without breaking auth.

Codex is supported as a provider but defaults to Claude. Switch the provider per stage in `apps/server/src/pipeline/stageConfigs.ts`.

## Configuration

All env vars are optional.

| Variable                       | Default                              | Effect |
|--------------------------------|--------------------------------------|--------|
| `RCC_HOST`                     | `127.0.0.1`                          | Server bind host |
| `RCC_PORT`                     | `3001`                               | Server port |
| `RCC_LOG_LEVEL`                | `info`                               | Pino log level |
| `RCC_OUTPUT_ROOT`              | `~/research-runs`                    | Default run output directory |
| `RCC_SOURCE_MIN_WORDS`         | `500`                                | Minimum words before a source warns |
| `RCC_SOURCE_DUPLICATE_WARN`    | `0.90`                               | Bigram-Jaccard threshold for warning |
| `RCC_SOURCE_DUPLICATE_BLOCK`   | `0.97`                               | Bigram-Jaccard threshold for hard block |
| `RCC_STAGE_TIMEOUT_MS`         | `900000` (15 min)                    | Per-stage CLI timeout |

Persistent run index at `~/.config/rcc/runs-index.json` so runs in non-default output roots survive server restarts.

## API surface

```
POST   /api/runs                                       Create run
GET    /api/runs                                       List runs
GET    /api/runs/:runId                                Read run.json
PATCH  /api/runs/:runId                                Edit run metadata

GET    /api/runs/:runId/enrich                         Read enriched prompt + model instructions
POST   /api/runs/:runId/enrich                         Trigger enricher (or save manual edits)

GET    /api/runs/:runId/sources                        All five source states + content
POST   /api/runs/:runId/sources/:sourceName            Save one source (paste or file path)

POST   /api/runs/:runId/pipeline/run                   Kick off full review pipeline
POST   /api/runs/:runId/pipeline/stages/:stageName/run Run / rerun a single stage
POST   /api/runs/:runId/cancel                         Cancel an in-flight pipeline
GET    /api/runs/:runId/events                         SSE stream of stage events

GET    /api/runs/:runId/files/content?path=<rel>       Read any artifact in the run dir
PUT    /api/runs/:runId/files/content                  Write any artifact (run.json blocked)

POST   /api/runs/:runId/export/markdown                Write exports/consolidated-decision.md
POST   /api/runs/:runId/export/pdf                     Write exports/consolidated-decision.pdf
POST   /api/runs/:runId/export/zip                     Write exports/full-run.zip
POST   /api/runs/:runId/open-folder                    Open the run dir in Finder/Explorer

GET    /api/health                                     Health probe
```

All bodies and queries are validated with Zod schemas re-exported from `@rcc/shared`.

## Stack and rationale

| Layer            | Choice                              | Why                                                              |
|------------------|-------------------------------------|------------------------------------------------------------------|
| Workspaces       | pnpm                                | Lightweight, three packages, no bundling needed                  |
| Frontend runtime | React 19 + Vite 6                   | Fast HMR, broad ecosystem, Preline UI is React/Tailwind-friendly |
| UI components    | Tailwind v3 + Preline v2 + Lucide   | Spec-aligned; vanilla Preline JS auto-init on route change       |
| Server state     | TanStack Query v5                   | Polling + cache fits SSE-driven stage state cleanly              |
| Routing          | react-router-dom v6                 | Stable, well-known, supports React 19                            |
| Backend          | Fastify 5 + Pino                    | Typed routes, fast, ESM-native                                   |
| Subprocess       | execa 9                             | AbortSignal, stdin pipe, exit-code capture                       |
| Validation       | Zod 3                               | Single schema source of truth in `packages/shared`               |
| Storage          | filesystem only                     | The folder is the index; `run.json` is the manifest              |
| Exports          | archiver (zip), marked + Playwright (pdf) | Playwright is opt-in; markdown + zip have zero extra deps    |

## Known gaps

- `Cancel` aborts the next stage but doesn't kill the in-flight CLI subprocess (need to thread `AbortSignal` through `stageRunner` → `cliRunner`).
- The sidebar artifact tree is hardcoded; should reflect actual `run.json` stage state.
- No `Settings` screen yet (env vars cover everything for now).
- No theme switch UI (the app is dark-only by default — `<html class="dark">`).
- No "Rerun final with custom instruction" modal — the button reruns as-is.
- PDF export requires a one-time `playwright install chromium`.

## Roadmap

- Wire `Settings` screen to live config endpoints.
- Threaded cancel signal through the full CLI stack.
- Live artifact tree from filesystem state.
- "Custom instruction" modal for rerunning the final consolidator.
- Optional Tauri/Electron wrapper for a single-binary distribution (architectural choice deliberately deferred — see the spec's contrarian critic for the case for it).
- Persisted "accepted" status on `run.json` so accept-and-export survives reload.

## License

MIT.
