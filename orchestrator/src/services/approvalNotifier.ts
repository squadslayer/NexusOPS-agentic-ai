/**
 * approvalNotifier.ts — SNS notification publisher.
 *
 * Publishes approval-required notifications via SNS.
 * Falls back to console logging when APPROVAL_TOPIC_ARN is not set.
 *
 * RULES:
 *   ✅ Fire-and-forget (non-blocking)
 *   ✅ Mock fallback for local dev
 *   ❌ No retry
 *   ❌ No PII in message
 */

import "dotenv/config";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const region = process.env.AWS_REGION ?? "us-east-1";
const topicArn = process.env.APPROVAL_TOPIC_ARN;

const sns = new SNSClient({ region });

export interface ApprovalNotification {
    approval_id: string;
    execution_id: string;
    risk: string;
    expires_at: number;
}

/**
 * Publishes an approval-required notification.
 * If APPROVAL_TOPIC_ARN is not set, logs to console (mock mode).
 */
export async function publishApprovalNotification(data: ApprovalNotification): Promise<void> {
    const message = JSON.stringify({
        event: "APPROVAL_REQUIRED",
        ...data,
    });

    if (!topicArn) {
        console.log(`[SNS MOCK] ${message}`);
        return;
    }

    try {
        await sns.send(new PublishCommand({
            TopicArn: topicArn,
            Subject: `NexusOPS Approval Required — Risk: ${data.risk}`,
            Message: message,
        }));

        console.log(JSON.stringify({
            event: "APPROVAL_NOTIFICATION_SENT",
            approval_id: data.approval_id,
            topic: topicArn,
        }));
    } catch (err) {
        // Non-blocking — log but don't fail execution
        console.warn(`[SNS ERROR] Failed to publish notification:`, err);
    }
}
