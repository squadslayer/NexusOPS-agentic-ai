/**
 * validator.ts — Schema validation + hard guards for planner output.
 *
 * Validates planner JSON against the canonical schema using AJV.
 * Enforces tool whitelist and step count limits as a second defense layer.
 *
 * RULES:
 *   ✅ AJV strict schema validation
 *   ✅ Tool whitelist enforcement
 *   ✅ Step count enforcement
 *   ❌ No retries on failure — abort immediately
 */

import Ajv from "ajv";
import { plannerSchema, ALLOWED_TOOLS, MAX_PLAN_STEPS } from "../schemas/plannerSchema";
import { OrchestratorError } from "./errors";

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(plannerSchema);

export class PlannerValidationError extends OrchestratorError {
    constructor(reason: string) {
        super(`Planner validation failed: ${reason}`, "PLANNER_VALIDATION_FAILED");
        this.name = "PlannerValidationError";
    }
}

/**
 * Validates planner output against schema and hard guards.
 * Throws PlannerValidationError on any failure.
 */
export function validatePlannerOutput(output: unknown): void {
    if (!validate(output)) {
        const errors = validate.errors?.map((e) => `${e.instancePath} ${e.message}`).join("; ");
        throw new PlannerValidationError(`Schema: ${errors}`);
    }

    const plan = (output as any).execution_plan;

    if (plan.steps.length > MAX_PLAN_STEPS) {
        throw new PlannerValidationError(`Too many steps: ${plan.steps.length} (max ${MAX_PLAN_STEPS})`);
    }

    for (const step of plan.steps) {
        if (!(ALLOWED_TOOLS as readonly string[]).includes(step.tool)) {
            throw new PlannerValidationError(`Invalid tool: "${step.tool}"`);
        }
    }
}
