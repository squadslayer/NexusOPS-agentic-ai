/**
 * plannerSchema.ts — JSON Schema for structured planner output.
 *
 * Every planner response MUST validate against this schema.
 * Abort immediately on validation failure — no retries.
 *
 * This is the SINGLE SOURCE OF TRUTH for plan structure.
 */

export const ALLOWED_TOOLS = [
    "create_file",
    "update_file",
    "delete_file",
    "create_pr",
    "run_ci",
] as const;

export type AllowedTool = typeof ALLOWED_TOOLS[number];

export const MAX_PLAN_STEPS = 10;

export const plannerSchema = {
    type: "object",
    required: ["execution_plan"],
    additionalProperties: false,
    properties: {
        execution_plan: {
            type: "object",
            required: ["objective", "steps", "estimated_risk"],
            additionalProperties: false,
            properties: {
                objective: { type: "string", minLength: 1 },
                steps: {
                    type: "array",
                    minItems: 1,
                    maxItems: MAX_PLAN_STEPS,
                    items: {
                        type: "object",
                        required: ["step_id", "tool", "action", "parameters", "expected_output", "risk_level"],
                        additionalProperties: false,
                        properties: {
                            step_id: { type: "number" },
                            tool: { type: "string", enum: [...ALLOWED_TOOLS] },
                            action: { type: "string", minLength: 1 },
                            parameters: { type: "object" },
                            expected_output: { type: "string" },
                            risk_level: { type: "string", enum: ["low", "medium", "high"] },
                        },
                    },
                },
                estimated_risk: { type: "string", enum: ["low", "medium", "high"] },
            },
        },
    },
};
