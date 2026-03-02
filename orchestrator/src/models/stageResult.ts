/**
 * stageResult.ts — Centralized stage output interface.
 *
 * Every stage handler returns a StageResult.
 * All stages MUST import this type — no local redefinitions allowed.
 */

import { Stage } from "./stages";
import { ExecutionStatus } from "./execution";

export interface StageResult {
    nextStage: Stage;
    status?: ExecutionStatus;
    output?: Record<string, unknown>;
}
