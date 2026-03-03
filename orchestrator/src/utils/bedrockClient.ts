/**
 * bedrockClient.ts — Bedrock Runtime InvokeModel wrapper.
 *
 * ONLY place in the orchestrator allowed to call Bedrock Runtime.
 * Falls back to deterministic mock when BEDROCK_MODEL_ID is not configured.
 *
 * CRITICAL SETTINGS:
 *   temperature:  0.05 (near-deterministic)
 *   top_p:        0.2  (narrow sampling)
 *   max_tokens:   1500
 *   streaming:    DISABLED
 *   timeout:      10s
 *   guardrail:    Applied when GUARDRAIL_ID is configured
 */

import "dotenv/config";

import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const INVOKE_TIMEOUT_MS = 10_000;

const region = process.env.AWS_REGION ?? "us-east-1";
const modelId = process.env.BEDROCK_MODEL_ID;
const guardrailId = process.env.GUARDRAIL_ID;
const guardrailVersion = process.env.GUARDRAIL_VERSION ?? "1";

const client = new BedrockRuntimeClient({ region });

/**
 * Invokes the planner model with a strict prompt.
 * Returns raw text from the model response.
 *
 * Falls back to mock when BEDROCK_MODEL_ID is not set.
 */
export async function invokePlanner(prompt: string): Promise<string> {
    const useMock = !modelId;

    if (useMock) {
        console.log("[BEDROCK] Using MOCK planner (no BEDROCK_MODEL_ID configured)");
        return mockPlannerResponse(prompt);
    }

    const useGuardrail = !!guardrailId;
    console.log(`[BEDROCK] Invoking model: ${modelId}${useGuardrail ? ` (guardrail: ${guardrailId} v${guardrailVersion})` : ""}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INVOKE_TIMEOUT_MS);

    try {
        const command = new InvokeModelCommand({
            modelId: modelId!,
            contentType: "application/json",
            accept: "application/json",
            ...(useGuardrail && {
                guardrailIdentifier: guardrailId,
                guardrailVersion: guardrailVersion,
            }),
            body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 1500,
                temperature: 0.05,
                top_p: 0.2,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            }),
        });

        const response = await client.send(command, {
            abortSignal: controller.signal,
        });

        const parsed = JSON.parse(Buffer.from(response.body).toString());
        return parsed.content[0].text;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Mock planner response for local dev without Bedrock.
 * Returns a deterministic, schema-compliant JSON plan.
 */
function mockPlannerResponse(_prompt: string): string {
    return JSON.stringify({
        execution_plan: {
            objective: "Execute infrastructure update based on retrieved context",
            steps: [
                {
                    step_id: 1,
                    tool: "update_file",
                    action: "Update infrastructure configuration",
                    parameters: {
                        file: "infra/config.yaml",
                        changes: "Update deployment settings",
                    },
                    expected_output: "Configuration file updated",
                    risk_level: "low",
                },
                {
                    step_id: 2,
                    tool: "run_ci",
                    action: "Validate configuration changes",
                    parameters: {
                        pipeline: "validate-infra",
                    },
                    expected_output: "CI pipeline passes",
                    risk_level: "low",
                },
                {
                    step_id: 3,
                    tool: "create_pr",
                    action: "Create pull request for review",
                    parameters: {
                        title: "Infrastructure update",
                        branch: "infra-update",
                    },
                    expected_output: "PR created and ready for review",
                    risk_level: "medium",
                },
            ],
            estimated_risk: "low",
        },
    });
}
