/**
 * loggingService.ts — Lifecycle transition log writer.
 *
 * Every stage change MUST produce a log entry.
 * No silent transitions allowed.
 *
 * This service is async-safe: failures are observable via .catch()
 * but never block execution flow.
 */

import { Stage } from "../models/stages";
import { ISODateString } from "../models/execution";

export interface TransitionLog {
    request_id: string;
    execution_id: string;
    from_stage: Stage;
    to_stage: Stage;
    timestamp: ISODateString;
    status: "SUCCESS" | "FAILED";
}

export class LoggingService {
    private logs: TransitionLog[] = [];

    /**
     * Records a lifecycle stage transition.
     * Returns a promise so callers can use .catch() without blocking.
     */
    async logTransition(
        requestId: string,
        executionId: string,
        fromStage: Stage,
        toStage: Stage,
        status: "SUCCESS" | "FAILED"
    ): Promise<TransitionLog> {
        const entry: TransitionLog = {
            request_id: requestId,
            execution_id: executionId,
            from_stage: fromStage,
            to_stage: toStage,
            timestamp: new Date().toISOString(),
            status,
        };

        this.logs.push(entry);
        console.log(
            `[TRANSITION] ${entry.request_id} | ${entry.execution_id} | ${entry.from_stage} → ${entry.to_stage} | ${entry.status} | ${entry.timestamp}`
        );

        return entry;
    }

    /**
     * Returns all logged transitions for a given execution.
     */
    getLogsForExecution(executionId: string): TransitionLog[] {
        return this.logs.filter((log) => log.execution_id === executionId);
    }

    /**
     * Returns all recorded transition logs.
     */
    getAllLogs(): TransitionLog[] {
        return [...this.logs];
    }
}
