# NexusOPS Orchestrator

Deterministic lifecycle engine for the NexusOPS agentic AI platform.

## Phase-3 Scope

This module implements the **stage skeleton** — a deterministic lifecycle router that drives every execution through the NexusOPS agentic loop:

```
ASK → RETRIEVE → REASON → CONSTRAINT → APPROVAL_PENDING → ACT → VERIFY → COMPLETED
```

### What's Included

| Component | Purpose |
|---|---|
| `handler.ts` | Lambda entry point — receive, dispatch, persist, log, return |
| `stageDispatcher.ts` | Core lifecycle router — routes execution to the correct stage |
| `stages/askStage.ts` | Mock ASK stage for transition validation |
| `services/executionRepository.ts` | Abstract state persistence layer |
| `services/loggingService.ts` | Lifecycle transition log writer |
| `models/execution.ts` | Execution schema and TypeScript types |
| `models/stages.ts` | Single source of truth for lifecycle stages |
| `utils/response.ts` | Standardized API response format |
| `utils/errors.ts` | Controlled internal error types |

### Quick Start

```bash
npm install
npm run build
npm start
```

### Development

```bash
npm run watch   # auto-rebuild on change
```

## Architecture

```
Invocation → handler → stageDispatcher → stage → persist → log → response
```

No AI logic, no external integrations. Those belong to later phases.
