/**
 * approvalRepository.ts — Approval record management.
 *
 * Manages APPROVAL_PENDING lifecycle records using DynamoDB.
 * Requires ApprovalRecords table with conditional writes and
 * TTL configured on the expires_at field.
 *
 * RULES:
 *   ✅ Conditional write on create (no duplicates)
 *   ✅ 15-minute expiry TTL
 *   ✅ Conditional update on decision (must be PENDING)
 *   ✅ Orphan prevention (markExpired)
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION ?? "us-east-1";
const client = new DynamoDBClient({ region });
const dynamo = DynamoDBDocumentClient.from(client);

const APPROVAL_TTL_MS = 15 * 60 * 1000; // 15 minutes
const TABLE_NAME = "ApprovalRecords";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface ApprovalRecord {
    approval_id: string;
    execution_id: string;
    user_id: string;
    version: number;
    status: ApprovalStatus;
    risk: string;
    created_at: number;
    expires_at: number;
    decision_at?: number;
}

/**
 * Creates a new approval record in PENDING state.
 * Expected TTL handling via DynamoDB.
 */
export async function createApprovalRecord(
    executionId: string,
    userId: string,
    version: number,
    risk: string
): Promise<string> {
    const approvalId = randomUUID();
    const now = Date.now();
    const expiresAt = Math.floor((now + APPROVAL_TTL_MS) / 1000);

    const item: ApprovalRecord = {
        approval_id: approvalId,
        execution_id: executionId,
        user_id: userId,
        version,
        status: "PENDING",
        risk,
        created_at: Math.floor(now / 1000),
        expires_at: Math.floor((now + APPROVAL_TTL_MS) / 1000),
    };

    try {
        await dynamo.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: item,
            ConditionExpression: "attribute_not_exists(approval_id)"
        }));

        console.log(JSON.stringify({
            event: "APPROVAL_CREATED",
            approval_id: approvalId,
            execution_id: executionId,
            risk,
            expires_at: new Date(expiresAt * 1000).toISOString(),
        }));

        return approvalId;
    } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
            throw new Error("Approval record already exists");
        }
        throw err;
    }
}

/**
 * Retrieves an approval record by ID.
 */
export async function getApprovalRecord(approvalId: string): Promise<ApprovalRecord | null> {
    const { Item } = await dynamo.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { approval_id: approvalId }
    }));
    return (Item as ApprovalRecord) ?? null;
}

/**
 * Finds the PENDING approval record for an execution.
 * Assumes a GSI named 'ExecutionIdIndex' exists on execution_id.
 * If GSI does not exist, consider retrieving the approvalId directly from execution output.
 */
export async function findPendingApproval(executionId: string): Promise<ApprovalRecord | null> {
    // Attempt to query via GSI if available
    try {
        const { Items } = await dynamo.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: "ExecutionIdIndex",
            KeyConditionExpression: "execution_id = :execId",
            FilterExpression: "#status = :pending",
            ExpressionAttributeValues: {
                ":execId": executionId,
                ":pending": "PENDING"
            },
            ExpressionAttributeNames: {
                "#status": "status"
            }
        }));

        if (Items && Items.length > 0) {
            return Items[0] as ApprovalRecord;
        }
    } catch (err: any) {
        // If index is missing or error occurs, log it
        console.warn(`[DYNAMO] Failed to query ExecutionIdIndex block:`, err.message);
    }
    return null;
}

/**
 * Updates approval record with a decision (APPROVE or REJECT).
 * Enforces 15-minute logic timeout.
 */
export async function updateApprovalDecision(
    approvalId: string,
    decision: "APPROVED" | "REJECTED"
): Promise<ApprovalRecord> {
    // We must read first to check TTL expiry logic
    const record = await getApprovalRecord(approvalId);

    if (!record) {
        throw new Error(`Approval record not found: ${approvalId}`);
    }

    if (record.status !== "PENDING") {
        throw new Error(`Approval already resolved: ${record.status}`);
    }

    const now = Date.now();

    // ── TIMEOUT CHECK ──
    if (now > record.expires_at * 1000) {
        // Force expire it
        await markExpired(approvalId);
        throw new Error("Approval expired (15-minute timeout)");
    }

    // ── CONDITIONAL UPDATE ──
    try {
        await dynamo.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { approval_id: approvalId },
            UpdateExpression: "SET #status = :newStatus, decision_at = :now",
            ConditionExpression: "#status = :pending",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":newStatus": decision,
                ":pending": "PENDING",
                ":now": now
            }
        }));

        console.log(JSON.stringify({
            event: "APPROVAL_DECISION",
            approval_id: approvalId,
            execution_id: record.execution_id,
            decision,
        }));

        return { ...record, status: decision, decision_at: now };
    } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
            throw new Error(`Approval already resolved (race condition blocked)`);
        }
        throw err;
    }
}

/**
 * Marks an approval record as EXPIRED.
 * Used for orphan prevention — no silent PENDING states.
 */
export async function markExpired(approvalId: string): Promise<void> {
    try {
        await dynamo.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { approval_id: approvalId },
            UpdateExpression: "SET #status = :expired, decision_at = :now",
            ConditionExpression: "#status = :pending",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":expired": "EXPIRED",
                ":pending": "PENDING",
                ":now": Date.now()
            }
        }));
    } catch (err: any) {
        // Ignore ConditionalCheckFailedException - it means it's not PENDING anymore
        if (err.name !== "ConditionalCheckFailedException") {
            console.error(`[APPROVAL EXPIRE] Error expiring record:`, err.message);
        }
    }
}
