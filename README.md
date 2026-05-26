# ASO Audit Agent

A TypeScript chat app that takes an Apple App Store URL and returns a full App Store Optimization audit. Built with the Mastra framework.

## Setup

```bash
npm run setup     # installs all dependencies (run once)
cp .env.example .env
# fill in your keys
npm run dev
```

Open `http://localhost:3000` for the chat UI, or `http://localhost:4111` for the Mastra Studio.

## Keys required

```env
ANTHROPIC_API_KEY=      # default provider
FIRECRAWL_API_KEY=      # scrapes App Store listing pages
```

## Switching models

The default model is `anthropic/claude-sonnet-4-5`. To use a different provider, set these two variables in `.env` — no code changes needed:

```env
MODEL=openai/gpt-4o
OPENAI_API_KEY=your-key
```

```env
MODEL=nvidia/meta/llama-3.1-70b-instruct
NVIDIA_API_KEY=your-key
```

Mastra's model router resolves the provider from the `MODEL` string automatically. Any `provider/model-name` format works — see [Mastra model docs](https://mastra.ai/models) for the full list.

| Provider  | Env key            | Install needed |
|-----------|--------------------|----------------|
| Anthropic | `ANTHROPIC_API_KEY`| No (default)   |
| OpenAI    | `OPENAI_API_KEY`   | No             |
| NVIDIA NIM| `NVIDIA_API_KEY`   | No             |
| Google    | `GOOGLE_API_KEY`   | No             |

## How it works

**Tools**
- `fetchAppMetadata` — iTunes Lookup API for surface-level metadata (name, developer, category, rating). Free, no key needed.
- `fetchFullAppPage` — Firecrawl scrape of the full listing page, returned as markdown for audit analysis.

**Workflow** (`auditWorkflow`)
Four steps: fetch metadata → suspend for user confirmation (HITL) → scrape full listing → return data. The workflow pauses after step 1 and waits for the user to confirm the right app before spending any scraping or LLM credits.

**Agent** (`asoAgent`)
Drives the conversation and generates the audit report. Has two tools — `startAuditWorkflow` and `resumeAuditWorkflow` — that bridge the chat interface to the workflow's suspend/resume lifecycle. Generates the report itself from the scraped listing content, keeping the SSE connection alive during the long generation.

**Skill** (`skills/aso-audit/SKILL.md`)
The ASO scoring framework — 10 dimensions with weights and evaluation criteria — packaged as a workspace skill and loaded as a TypeScript constant in the agent's instructions.

**Processor** (`AppStoreURLGuard`)
Input processor that aborts early if the user pastes a URL that looks like a URL but isn't a valid App Store link, before any tool call is made.

## Decisions

**iTunes API over Firecrawl for metadata** — the iTunes Lookup API returns clean structured JSON for the confirmation step. Firecrawl is reserved for the full listing scrape where markdown content matters for the audit.

**Agent generates the report, not the workflow** — running the LLM call inside a workflow step caused silent SSE timeouts (no events during a 3-minute tool call). Moving generation to the agent keeps the stream alive because Anthropic's token events flow continuously.

**One LLM call for the full audit** — 10 parallel dimension calls would multiply cost, latency, and failure surface with no meaningful quality gain.

**Confirmation at the workflow level** — the HITL suspend happens inside the workflow, not as conversational logic in the agent. The workflow graph in Mastra Studio shows the pause point visually, and the scrape only runs after explicit user confirmation.