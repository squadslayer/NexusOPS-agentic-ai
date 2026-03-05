# NexusOPS — Project Structure Reference

> **Last updated:** 2026-03-04 (Phase 8 complete)
> A concise, engineering-grade explanation of every directory and file in the repository.

---

## Repository Root

```
NexusOPS-agentic-ai/
├── orchestrator/       # TypeScript Lambda — core agentic lifecycle engine
├── bff/                # Python Flask — Backend-for-Frontend (API Gateway simulation)
├── Landing-page/       # Next.js — marketing / product landing page
├── IAM/                # AWS IAM policy stubs
├── docs/               # Project documentation assets
├── design.md           # Architecture & system design document
├── requirements.md     # Engineering requirements specification
├── requirements.txt    # Python dependency list (pip)
├── pyrightconfig.json  # Pyright (Python type-checker) configuration
├── .gitignore          # Git ignore rules
├── LICENSE             # Project license
└── README.md           # Project overview
```

| File | Purpose |
|---|---|
| `design.md` | High-level architecture decisions, component diagrams, and design rationale |
| `requirements.md` | Formal engineering requirements for all phases |
| `requirements.txt` | Python packages required by the BFF service |
| `pyrightconfig.json` | Static type-checking config for Python (Pyright LSP) |

---

## `/orchestrator` — TypeScript Agentic Engine

The core NexusOPS orchestrator — a **TypeScript AWS Lambda** that drives executions through a deterministic lifecycle loop. Each invocation advances the execution by exactly one stage.

```
orchestrator/
├── src/                # All TypeScript source files
├── dist/               # Compiled JavaScript output (generated)
├── package.json        # Node.js dependencies & npm scripts
├── tsconfig.json       # TypeScript compiler settings
├── .env                # Local environment variables (secrets, AWS config)
├── __init__.py         # Python namespace file (cross-lang tooling compatibility)
└── README.md           # Orchestrator-specific usage notes
```

---

### `/orchestrator/src` — Source Files

#### Top-level source files

| File | Role |
|---|---|
| `handler.ts` | **Lambda entry point.** Owns the full execution lifecycle: loads/creates the execution record, calls `stageDispatcher`, validates the transition (final governance gate), performs atomic version-checked updates, handles orphan approval prevention, and emits non-blocking transition logs. `main()` drives the Phase-8 full 7-step local validation loop. |
| `stageDispatcher.ts` | **Core routing engine (the "central nervous system").** Routes an execution to the correct stage function based on its current `Stage`. *Suggests* the next stage — the handler validates it. All 7 operational stages are now fully implemented (no placeholder stubs). |
| `approvalHandler.ts` | **Approval decision entry point.** Accepts APPROVE or REJECT decisions (via API Gateway / CLI / direct call). Validates the approval record is PENDING, enforces the 15-minute timeout, conditionally updates the approval record, and then transitions the execution with optimistic locking. |
| `test-bedrock.ts` | Standalone test script for validating AWS Bedrock connectivity and prompt responses during development. |

---

### `/orchestrator/src/stages`

Each file implements **one lifecycle stage**. Every stage function receives a read-only `Execution` and returns a `StageResult` with `nextStage` + output payload.

| File | Stage | Description |
|---|---|---|
| `askStage.ts` | `ASK` | Entry point — collects user intent and initial request data before passing to retrieval. |
| `retrieveStage.ts` | `RETRIEVE` | Fetches relevant repository context, file trees, and metadata needed by the reasoning stage. |
| `reasonStage.ts` | `REASON` | Calls AWS Bedrock (Claude) with the retrieved context to generate a structured `ExecutionPlan`. |
| `constraintStage.ts` | `CONSTRAINT` | Passes the LLM-generated plan through `constraintEngine.validateExecutionPlan()`. Blocks or flags plans that violate safety rules. Sets `requiresApproval` based on risk level. |
| `approvalStage.ts` | `APPROVAL_PENDING` | On first call: creates a DynamoDB approval record with a 15-minute TTL and publishes an SNS notification. On subsequent calls: checks if a decision has been made and transitions to `ACT` (approved) or `FAILED` (rejected/expired). Never auto-approves. |
| `actStage.ts` | `ACT` | **(Phase 8)** Loads the `validated_plan` from execution input, executes each step sequentially via `toolExecutor`, writes a per-step log to `executionLogRepository`, and fails fast on the first tool failure. Transitions to `VERIFY` on full plan success. |
| `verifyStage.ts` | `VERIFY` | **(Phase 8)** Reads all step logs from `executionLogRepository`, computes `success_rate`, `failure_count`, and `execution_duration_ms`. Transitions to `COMPLETED` if all steps succeeded, `FAILED` otherwise. |
| `actStage.test.ts` | — | **(Phase 8)** Vanilla ts-node unit tests for the ACT stage (27 assertions). Covers: valid plan success, missing plan, null input, tool failure/fail-fast, and log integrity. |

---

### `/orchestrator/src/models`

TypeScript interfaces and enums shared across the entire orchestrator.

| File | Contents |
|---|---|
| `execution.ts` | `Execution` record shape, `ExecutionRequest`, `ExecutionStatus` enum (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), and the `LocalMemoryRepository` interface contract. |
| `stages.ts` | `Stage` enum (`ASK → RETRIEVE → REASON → CONSTRAINT → APPROVAL_PENDING → ACT → VERIFY → COMPLETED/FAILED`) and the `isValidTransition()` function — the single source of truth for allowed stage transitions. |
| `stageResult.ts` | `StageResult` interface returned by every stage function: `{ nextStage, output, status? }`. |
| `retrieval.ts` | Interfaces for the retrieval context payload used by `retrieveStage` and `reasonStage`. |

---

### `/orchestrator/src/services`

Stateless service modules responsible for I/O — DynamoDB, SNS, logging, and Bedrock retrieval.

| File | Responsibility |
|---|---|
| `executionRepository.ts` | CRUD for the `Executions` DynamoDB table. Key methods: `getExecution`, `createExecution`, `updateExecutionConditional` (implements optimistic locking via `version` attribute — prevents lost-update races). Also exports `LocalMemoryRepository` for local/test usage. |
| `approvalRepository.ts` | CRUD for the `ApprovalRecords` DynamoDB table. Implements: conditional `PutItem` (no duplicate approvals), `GetItem`, GSI-based `findPendingApproval`, conditional `UpdateItem` for decisions (PENDING-only gate + timeout enforcement), and `markExpired` for orphan prevention. |
| `approvalNotifier.ts` | Publishes approval-required SNS notifications. Sends a structured message containing `approval_id`, `execution_id`, risk level, and expiry timestamp so downstream subscribers (Slack bots, email handlers, etc.) can notify approvers. |
| `loggingService.ts` | In-memory transition log service. Records each stage transition (`previousStage → newStage`, status, timestamp) on a per-execution basis. Logs are non-blocking — failures are warned but never halt execution. |
| `retrievalService.ts` | Fetches GitHub repository content (file trees, file contents) using the GitHub API. Provides context to the Bedrock reasoning stage. |
| `executionLogRepository.ts` | **(Phase 8)** Append-only step log store (`LocalMemoryLogRepository`). Stores one `ExecutionStepLog` entry per plan step executed by the ACT stage. Read by VERIFY to compute metrics (`success_rate`, `execution_duration_ms`). DynamoDB-ready via `IExecutionLogRepository` interface. |
| `toolExecutor.ts` | **(Phase 8)** Tool dispatch engine. Routes each plan step to a named handler function based on `step.tool`. Supports all 5 `ALLOWED_TOOLS`: `create_file`, `update_file`, `delete_file`, `run_ci`, `create_pr`. Simulated for local dev; each handler body is independently replaceable with a real GitHub API call. Always returns `ToolResult` — never throws. |

---

### `/orchestrator/src/constraints`

| File | Purpose |
|---|---|
| `constraintEngine.ts` | **Deterministic safety gate — no LLM, pure logic, stateless.** Validates an `ExecutionPlan` through six layers: empty-plan check → max-step limit (10) → tool whitelist enforcement → forbidden path detection (blocks `../`, `.env`, `node_modules`, `.git/`) → tool-specific rules (delete protection of critical files, single CI run limit, PR-requires-mutation guard) → risk recalculation (overrides planner's advisory risk). Returns a `ConstraintResult` with `allowed`, `finalRisk`, `requiresApproval`, and `violations`. |
| `constraintEngine.test.ts` | Unit tests for the constraint engine. Covers all rules and edge cases, including forbidden tools, path traversal attempts, delete-protected files, and risk escalation logic. |

---

### `/orchestrator/src/schemas`

| File | Purpose |
|---|---|
| `plannerSchema.ts` | Defines `ALLOWED_TOOLS` — the whitelist of tool names the LLM planner may produce (e.g., `update_file`, `create_file`, `delete_file`, `run_ci`, `create_pr`). Imported by the constraint engine as the tool whitelist authority. |

---

### `/orchestrator/src/utils`

Pure utility modules with no business logic dependency.

| File | Purpose |
|---|---|
| `bedrockClient.ts` | AWS Bedrock SDK client wrapper. Configures `BedrockRuntimeClient`, manages model invocation (Claude), and parses the response stream into structured output. |
| `promptBuilder.ts` | Constructs the structured LLM prompt from retrieval context + user intent. Keeps prompt engineering isolated from stage logic. |
| `response.ts` | `successResponse()` and `errorResponse()` — standardised `OrchestratorResponse` envelope used by the handler for all Lambda outputs. |
| `errors.ts` | Custom error classes: `OrchestratorError` (base), `InvalidStageTransition`, `InvalidStage`, `ExecutionNotFound`, `VersionConflict`. Each carries a typed `code` string for structured error handling. |
| `validator.ts` | Input validation helpers — validates `ExecutionRequest` fields before the handler proceeds. |

---

## `/bff` — Python Flask Backend-for-Frontend

A **Flask API** that simulates AWS API Gateway locally. All requests go through a standard response envelope with strict error masking. Acts as the intermediary between the Landing-page / external callers and the TypeScript orchestrator Lambda.

```
bff/
├── app.py              # Flask app factory & entry point
├── config.py           # Environment-based configuration (local vs. AWS)
├── handler.py          # AWS Lambda handler wrapper (production entrypoint)
├── __init__.py         # Package init
├── middleware/         # Cross-cutting concerns applied to all routes
├── models/             # Request/response data models
├── routes/             # Route blueprints (URL handlers)
├── services/           # External service integrations
└── utils/              # Shared utility functions
```

#### Root BFF Files

| File | Purpose |
|---|---|
| `app.py` | Flask application factory (`create_app`). Registers route blueprints (`execution`, `auth`, `repo`), attaches global error handlers, exposes the `/health` endpoint. Entry point for local `flask run`. |
| `config.py` | Reads the `ENV` env var (`local` / `aws`) and sets all environment-specific values: DynamoDB endpoint, log level, auth bypass flag, GitHub OAuth credentials, JWT config, encryption key, and orchestrator service URL. Validates that `ENV` is a known value. |
| `handler.py` | Thin AWS Lambda entry point — delegates to the Flask WSGI app for production Lambda deployments. |

---

### `/bff/middleware`

| File | Purpose |
|---|---|
| `auth_middleware.py` | JWT-based authentication middleware. Validates `Authorization: Bearer <token>` headers, decodes JWT, and attaches user identity to the request context. Supports `AUTH_BYPASS` flag for local development. |
| `error_handler.py` | Global Flask error handlers — maps Python exceptions to standardised `StandardResponseEnvelope` JSON responses with masked internal error details. Implements `governance_error_handler` decorator. |
| `rate_limit.py` | Per-IP and per-user request rate limiting. Prevents abuse of the orchestrator trigger endpoint. |
| `validation.py` | Request body validation middleware. Validates incoming JSON payloads against expected schemas before routing to handlers. |
| `__init__.py` | Exports `register_error_handlers`, `governance_error_handler`, and `generate_execution_id` for use in `app.py`. |

---

### `/bff/models`

| File | Purpose |
|---|---|
| `request_envelope.py` | `RequestEnvelope` dataclass — standard shape for all incoming API requests (execution_id, user_id, repo_id, intent, and optional metadata). |
| `__init__.py` | Package exports. |

---

### `/bff/routes`

Flask **Blueprint** modules — each file groups related URL endpoints.

| File | Endpoints | Description |
|---|---|---|
| `auth.py` | `/auth/github`, `/auth/github/callback`, `/auth/refresh`, `/auth/logout` | GitHub OAuth 2.0 flow: initiates OAuth redirect, handles the callback to exchange code for token, issues JWT, refreshes tokens, and revokes sessions. |
| `execution.py` | `/executions`, `/executions/<id>`, `/executions/<id>/status` | Creates new orchestrator executions, retrieves existing execution records, and polls execution status. Delegates to `orchestrator_client`. |
| `repo.py` | `/repos`, `/repos/<owner>/<repo>` | Lists user's GitHub repositories and fetches individual repository metadata via `github_service`. |
| `__init__.py` | — | Package exports for all blueprints. |

---

### `/bff/services`

| File | Purpose |
|---|---|
| `auth_service.py` | Implements the full GitHub OAuth token exchange, JWT minting, token refresh logic, encrypted token storage, and token revocation. |
| `github_service.py` | GitHub REST API client. Fetches user profile, repository list, repository metadata, file trees, and file contents. All calls are authenticated with the user's OAuth token. |
| `orchestrator_client.py` | HTTP client for triggering the TypeScript orchestrator (via local URL in dev or AWS Lambda invoke in production). Wraps Lambda / HTTP invocation, serialises requests, and deserialises lifecycle responses. |
| `__init__.py` | Package exports. |

---

### `/bff/utils`

| File | Purpose |
|---|---|
| `auth_utils.py` | JWT encode/decode helpers, token expiry calculation, and AES-based GitHub token encryption/decryption utilities. |
| `logger.py` | Structured logging setup — configures a named logger with the project format and exposes `get_logger(name)` for consistent log output across all modules. |
| `response_envelope.py` | `create_success_response()` and `create_error_response()` — builds the `StandardResponseEnvelope` JSON structure used uniformly across all BFF endpoints. |
| `__init__.py` | Package exports for `create_success_response`, `create_error_response`, and `get_logger`. |

---

## `/Landing-page` — Next.js Marketing Site

A **Next.js 14** (App Router) TypeScript application — the product landing page that explains NexusOPS features to prospective users.

```
Landing-page/
├── app/                # Next.js App Router pages
│   ├── page.tsx        # Home page (root "/")
│   ├── layout.tsx      # Root layout (fonts, metadata, Navbar/Footer)
│   ├── globals.css     # Global CSS styles
│   ├── architecture/   # "/architecture" — system diagram page
│   ├── dashboard/      # "/dashboard" — demo dashboard preview page
│   ├── deploy/         # "/deploy" — deployment guide page
│   ├── features/       # "/features" — feature breakdown page
│   ├── security/       # "/security" — security model page
│   └── use/            # "/use" — use cases page
├── components/
│   ├── Navbar.tsx      # Top navigation bar component (shared across all pages)
│   └── Footer.tsx      # Footer component (shared across all pages)
├── next.config.mjs     # Next.js configuration
├── tsconfig.json       # TypeScript configuration for Next.js
├── package.json        # Node.js dependencies
└── .eslintrc.json      # ESLint rules for the Next.js project
```

Each subdirectory under `app/` corresponds to a URL route and contains a `page.tsx` that renders that route's content.

---

## `/IAM` — IAM Policy Stubs

| File | Purpose |
|---|---|
| `__init__.py` | Placeholder / namespace file. Currently holds IAM policy JSON or Python utilities for generating/validating IAM policies needed by the orchestrator Lambda (DynamoDB, SNS, Bedrock permissions). |

---

## `/docs`

| Path | Purpose |
|---|---|
| `docs/images/` | Architecture diagrams, screenshots, and other image assets referenced in `design.md`, `README.md`, and other documentation. |

---

## Key Architectural Flows

### Execution Lifecycle (Orchestrator) — Phase 8 Complete
```
ASK → RETRIEVE → REASON → CONSTRAINT → APPROVAL_PENDING → ACT → VERIFY → COMPLETED
                                                  ↓                  ↓         ↓
                                               FAILED             FAILED   (terminal)
```

### ACT Stage — Tool Execution Flow
```
actStage
  ├── extract validated_plan from execution.input
  ├── for each step (sequential):
  │     ├── toolExecutor.executeTool(step, context)
  │     ├── executionLogRepository.writeStepLog()
  │     └── if failure → return FAILED immediately (fail-fast)
  └── return VERIFY
```

### VERIFY Stage — Metrics Computation
```
verifyStage
  ├── executionLogRepository.readExecutionLogs(execution_id)
  ├── compute: success_rate, failed_steps, execution_duration_ms
  └── success_rate == 100% → COMPLETED
      otherwise            → FAILED
```

### Approval Flow
```
constraintStage  →  [risk=high]  →  approvalStage creates record  →  SNS notification
                                           ↓                               ↓
                               approvalHandler receives APPROVE/REJECT   Approver notified
                                           ↓
                               execution advances to ACT or FAILED
```

### Governance Layers
1. **constraintEngine** — pure-logic safety gate (blocks dangerous plans before any I/O)
2. **isValidTransition** — state-machine enforcement (no illegal stage hops)
3. **updateExecutionConditional** — optimistic locking (no lost-update races)
4. **markExpired / orphan cleanup** — prevents ghost PENDING approval records

### Storage Reality (Phase 8)
| Store | Backend | DynamoDB Table |
|---|---|---|
| Execution records | In-memory (`LocalMemoryRepository`) | — |
| Execution step logs | In-memory (`LocalMemoryLogRepository`) | — |
| Approval records | **DynamoDB** (`DynamoDBDocumentClient`) | `ApprovalRecords` |

> Both in-memory stores expose DynamoDB-ready interfaces (`IExecutionRepository`, `IExecutionLogRepository`). Swapping to DynamoDB requires replacing the singleton instance in one line each in `handler.ts` and `executionLogRepository.ts` — no stage files change.

