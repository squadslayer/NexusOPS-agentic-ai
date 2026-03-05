/**
 * promptBuilder.ts — Deterministic planner prompt construction.
 *
 * Builds a strict system+user prompt that forces JSON-only output.
 * The prompt is NEVER stored in the database.
 *
 * RULES:
 *   ✅ JSON-only output format
 *   ✅ Tool whitelist enforced in prompt
 *   ✅ Max 10 steps enforced in prompt
 *   ❌ No free-text allowed
 *   ❌ No markdown allowed
 *   ❌ No explanations allowed
 */

import { ALLOWED_TOOLS, MAX_PLAN_STEPS } from "../schemas/plannerSchema";

export function buildPlannerPrompt(
    userIntent: string,
    contextRefs: string[],
    contextSummaries: string[]
): string {
    return `SYSTEM:
You are a deterministic execution planner for NexusOPS.
You MUST output valid JSON only.
No explanations.
No markdown.
No code fences.
No text before or after the JSON.

Schema:
{
  "execution_plan": {
    "objective": string,
    "steps": [
      {
        "step_id": number,
        "tool": string,
        "action": string,
        "parameters": object,
        "expected_output": string,
        "risk_level": "low" | "medium" | "high"
      }
    ],
    "estimated_risk": "low" | "medium" | "high"
  }
}

Only allowed tools:
${JSON.stringify([...ALLOWED_TOOLS])}

Max ${MAX_PLAN_STEPS} steps.

USER:
Intent:
${userIntent}

Context References:
${JSON.stringify(contextRefs)}

Context Summaries:
${contextSummaries.map((s, i) => `[${i + 1}] ${s}`).join("\n")}
`;
}
