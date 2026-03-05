/**
 * executionRepository.ts — Abstract state persistence layer.
 *
 * The orchestrator depends ONLY on this interface.
 * Concrete implementations swap in without touching core logic:
 *   - LocalMemoryRepository  (Phase-3, in-memory)
 *   - DynamoRepository       (later phases)
 *
 * CONCURRENCY CONTRACT:
 *   updateExecutionConditional() is the ONLY place where version
 *   comparison and increment happen. Callers must NEVER mutate
 *   the version field directly.
 *
 * GOVERNANCE BOUNDARY:
 *   Repository validates VERSION ONLY — lifecycle transition rules
 *   belong in the handler layer.
 */

import { Execution, ExecutionRequest, createExecution } from "../models/execution";
import { ConcurrencyConflict, ExecutionNotFound } from "../utils/errors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand
} from "@aws-sdk/lib-dynamodb";

const EXECUTION_TABLE = "ExecutionRecords";
const region = process.env.AWS_REGION ?? "us-east-1";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));


/**
 * Fields that are immutable after creation — never passed in updates.
 */
type ImmutableFields = "execution_id" | "user_id" | "repo_id" | "created_at";

export interface IExecutionRepository {
    getExecution(userId: string, executionId: string): Promise<Execution>;
    createExecution(request: ExecutionRequest): Promise<Execution>;
    updateExecutionConditional(
        userId: string,
        executionId: string,
        expectedVersion: number,
        updates: Partial<Omit<Execution, ImmutableFields>>
    ): Promise<Execution>;
}


/**
 * In-memory implementation for Phase-3 validation.
 * Data lives only for the process lifetime.
 */
export class LocalMemoryRepository implements IExecutionRepository {
    private store: Map<string, Execution> = new Map();

    /**
     * Retrieves an execution record.
     * Throws ExecutionNotFound if the record does not exist.
     */
    async getExecution(userId: string, executionId: string): Promise<Execution> {
        const record = this.store.get(executionId);

        if (!record) {
            throw new ExecutionNotFound(executionId);
        }
        return { ...record };
    }

    /**
     * Creates a new execution record.
     */
    async createExecution(request: ExecutionRequest): Promise<Execution> {
        const execution = createExecution(request);
        this.store.set(execution.execution_id, execution);
        return { ...execution };
    }

    /**
     * Persists partial updates to an execution ONLY if the version matches
     * (optimistic lock). Version increment happens atomically inside this
     * method — callers never touch the version field.
     *
     * This method validates VERSION ONLY. Lifecycle stage transition rules
     * are enforced by the handler layer.
     */
    async updateExecutionConditional(
        userId: string,
        executionId: string,
        expectedVersion: number,
        updates: Partial<Omit<Execution, ImmutableFields>>
    ): Promise<Execution> {

        const existing = this.store.get(executionId);

        if (!existing) {
            throw new ExecutionNotFound(executionId);
        }

        if (existing.version !== expectedVersion) {
            throw new ConcurrencyConflict(executionId, expectedVersion);
        }

        const updated: Execution = {
            ...existing,
            ...updates,
            version: existing.version + 1,
            updated_at: new Date().toISOString(),
        };

        this.store.set(executionId, updated);
        return { ...updated };
    }
}

/**
 * DynamoDB implementation for production persistence.
 */
export class DynamoRepository implements IExecutionRepository {
    async getExecution(userId: string, executionId: string): Promise<Execution> {
        const result = await dynamo.send(new GetCommand({
            TableName: EXECUTION_TABLE,
            Key: { user_id: userId, execution_id: executionId }
        }));

        if (!result.Item) {
            throw new ExecutionNotFound(executionId);
        }

        return result.Item as Execution;
    }

    async createExecution(request: ExecutionRequest): Promise<Execution> {
        const execution = createExecution(request);

        await dynamo.send(new PutCommand({
            TableName: EXECUTION_TABLE,
            Item: { ...execution },
            // Ensure we don't overwrite if it somehow exists
            ConditionExpression: "attribute_not_exists(user_id) AND attribute_not_exists(execution_id)"
        }));

        return execution;
    }

    async updateExecutionConditional(
        userId: string,
        executionId: string,
        expectedVersion: number,
        updates: Partial<Omit<Execution, ImmutableFields>>
    ): Promise<Execution> {
        const now = new Date().toISOString();
        const nextVersion = expectedVersion + 1;

        // Construct UpdateExpression dynamically
        const updateKeys = Object.keys(updates);
        let updateExpression = "SET #version = :v, updated_at = :now";
        const expressionAttributeValues: Record<string, any> = {
            ":v": nextVersion,
            ":now": now,
            ":expected": expectedVersion
        };
        const expressionAttributeNames: Record<string, string> = {
            "#version": "version"
        };

        updateKeys.forEach(key => {
            const val = (updates as any)[key];
            if (val !== undefined) {
                let attrLabel = key;
                if (key === "status") {
                    attrLabel = "#status";
                    expressionAttributeNames["#status"] = "status";
                } else if (key === "input") {
                    attrLabel = "#input";
                    expressionAttributeNames["#input"] = "input";
                }
                updateExpression += `, ${attrLabel} = :${key}`;
                expressionAttributeValues[`:${key}`] = val;
            }
        });

        const updateParams = {
            TableName: EXECUTION_TABLE,
            Key: { user_id: userId, execution_id: executionId },
            UpdateExpression: updateExpression,
            ConditionExpression: "#version = :expected",
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: "ALL_NEW" as const
        };

        let result;
        try {
            result = await dynamo.send(new UpdateCommand(updateParams));
        } catch (e: any) {
            console.error("[DYNAMO VALIDATION ERROR]", e.name, e.message);
            throw e;
        }

        if (!result.Attributes) {
            throw new ConcurrencyConflict(executionId, expectedVersion);
        }

        return result.Attributes as Execution;
    }
}

// Use DynamoRepository for persistent execution state
export const repository = new DynamoRepository();


