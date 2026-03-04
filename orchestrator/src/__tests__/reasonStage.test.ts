import { reasonStage } from "../stages/reasonStage";
import { Execution, ExecutionStatus } from "../models/execution";
import { Stage } from "../models/stages";
import * as bedrockClient from "../utils/bedrockClient";

jest.mock("../utils/bedrockClient", () => ({
    invokePlanner: jest.fn()
}));

// Mock costMonitor to avoid testing actual cost-limit logic failures in the core reasoning stage
jest.mock("../services/costMonitor", () => ({
    enforceCostLimits: jest.fn(),
    getCostReport: jest.fn().mockReturnValue({ estimated_cost_usd: 0.001 }),
    CostLimitExceeded: class extends Error { }
}));

describe("REASON Stage", () => {
    let mockExecution: Execution;

    beforeEach(() => {
        mockExecution = {
            execution_id: "exec-123",
            user_id: "user-123",
            repo_id: "owner/repo",
            stage: Stage.REASON,
            status: ExecutionStatus.RUNNING,
            version: 1,
            input: { query: "Add staging environment" },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        jest.clearAllMocks();
    });

    it("should successfully reason and transition to CONSTRAINT", async () => {
        const mockPlan = {
            execution_plan: {
                objective: "Add staging environment",
                estimated_risk: "medium",
                steps: [
                    {
                        step_id: 1,
                        tool: "update_file",
                        action: "Modify deploy config",
                        parameters: { file: "config.json" },
                        expected_output: "Deploy points to staging",
                        risk_level: "low"
                    }
                ]
            }
        };

        (bedrockClient.invokePlanner as jest.Mock).mockResolvedValue({
            text: JSON.stringify(mockPlan),
            input_tokens: 100,
            output_tokens: 50
        });

        const result = await reasonStage(mockExecution);

        expect(result.nextStage).toBe(Stage.CONSTRAINT);
        expect(result.output?.planner_output).toBeDefined();
    });

    it("should fail gracefully if Bedrock returns invalid JSON schema", async () => {
        (bedrockClient.invokePlanner as jest.Mock).mockResolvedValue({
            text: `{ "bad_json": true }`,
            input_tokens: 100,
            output_tokens: 50
        });

        const result = await reasonStage(mockExecution);

        expect(result.nextStage).toBe(Stage.FAILED);
        expect(result.status).toBe(ExecutionStatus.FAILED);
        expect(result.output?.message).toContain("Planner validation failed");
    });
});
