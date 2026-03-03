/**
 * test-bedrock.ts — Standalone Bedrock InvokeModel verification.
 *
 * Tests the real Bedrock planner call in isolation, without running
 * the full orchestrator lifecycle.
 *
 * Usage:
 *   npx ts-node src/test-bedrock.ts
 *
 * Prerequisites:
 *   1. aws configure (credentials set)
 *   2. BEDROCK_MODEL_ID uncommented in .env
 *   3. Model access granted in AWS Console
 */

import "dotenv/config";
import { buildPlannerPrompt } from "./utils/promptBuilder";
import { invokePlanner } from "./utils/bedrockClient";
import { validatePlannerOutput } from "./utils/validator";

async function testBedrock() {
    const modelId = process.env.BEDROCK_MODEL_ID;
    console.log("=== Bedrock Planner Verification ===\n");
    console.log(`Mode: ${modelId ? `LIVE (${modelId})` : "MOCK (no BEDROCK_MODEL_ID)"}\n`);

    const prompt = buildPlannerPrompt(
        "Update the deployment pipeline to add staging environment validation",
        ["chunk-test-001", "chunk-test-002"],
        [
            "Infrastructure provisioning best practices for cloud-native deployments",
            "CI/CD pipeline configuration standards",
        ]
    );

    console.log("─── PROMPT ───");
    console.log(prompt);
    console.log("─── END PROMPT ───\n");

    console.log("Invoking planner...\n");
    const startTime = Date.now();

    try {
        const rawText = await invokePlanner(prompt);
        const latencyMs = Date.now() - startTime;

        console.log(`Latency: ${latencyMs}ms\n`);
        console.log("─── RAW RESPONSE ───");
        console.log(rawText);
        console.log("─── END RESPONSE ───\n");

        const parsed = JSON.parse(rawText);
        console.log("✅ JSON parse: PASSED\n");

        validatePlannerOutput(parsed);
        console.log("✅ Schema validation: PASSED");
        console.log(`✅ Steps: ${parsed.execution_plan.steps.length}`);
        console.log(`✅ Risk: ${parsed.execution_plan.estimated_risk}`);
        console.log(`✅ Tools: ${parsed.execution_plan.steps.map((s: any) => s.tool).join(", ")}`);

        console.log("\n🟢 BEDROCK VERIFICATION COMPLETE — All checks passed.");
    } catch (err: any) {
        console.error("\n🔴 VERIFICATION FAILED:", err.message);
        if (err.name === "AccessDeniedException") {
            console.error("\n→ You need to request model access in AWS Console:");
            console.error("  Bedrock → Model access → Request access → Claude 3 Sonnet");
        }
        if (err.name === "AbortError") {
            console.error("\n→ Request timed out (>10s). Check network or region.");
        }
        process.exit(1);
    }
}

testBedrock();
