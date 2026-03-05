import { retrieveStage } from "../stages/retrieveStage";
import { Execution, ExecutionStatus } from "../models/execution";
import { Stage } from "../models/stages";
import * as retrievalService from "../services/retrievalService";

jest.mock("../services/retrievalService", () => ({
    retrieveContext: jest.fn()
}));

describe("RETRIEVE Stage", () => {
    let mockExecution: Execution;

    beforeEach(() => {
        mockExecution = {
            execution_id: "exec-123",
            user_id: "user-123",
            repo_id: "owner/repo",
            stage: Stage.RETRIEVE,
            status: ExecutionStatus.RUNNING,
            version: 1,
            input: { query: "How to setup infra?" },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        jest.clearAllMocks();
    });

    it("should successfully pass repo_id into retrieval context and transition to REASON", async () => {
        (retrievalService.retrieveContext as jest.Mock).mockResolvedValue({
            query: "How to setup infra?",
            chunk_refs: ["chunk-1", "chunk-2"],
            retrieved_at: new Date().toISOString()
        });

        const result = await retrieveStage(mockExecution);

        // Verify it was correctly scoped
        expect(retrievalService.retrieveContext).toHaveBeenCalledWith("How to setup infra?", "owner/repo");

        // Verify stage transition
        expect(result.nextStage).toBe(Stage.REASON);
        expect(result.output?.context_refs).toEqual(["chunk-1", "chunk-2"]);
    });

    it("should fail gracefully when retrieval returns zero chunks", async () => {
        (retrievalService.retrieveContext as jest.Mock).mockResolvedValue({
            query: "How to setup infra?",
            chunk_refs: [],
            retrieved_at: new Date().toISOString()
        });

        const result = await retrieveStage(mockExecution);

        expect(result.nextStage).toBe(Stage.FAILED);
        expect(result.status).toBe(ExecutionStatus.FAILED);
        expect(result.output?.message).toContain("no context retrieved");
    });
});
