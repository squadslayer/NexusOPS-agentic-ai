/**
 * local_server.ts — HTTP Bridge for local development.
 * Allows the BFF to invoke the Orchestrator handler via HTTP.
 */

import express from 'express';
import { handler } from './handler';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const port = 8001;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'NexusOPS Orchestrator Local Bridge' });
});

// Bridge to the Lambda handler
app.post('/invoke', async (req, res) => {
    console.log(`[LOCAL BRIDGE] Received invocation for execution: ${req.body.execution_id}`);

    let currentPayload = req.body;
    let iterations = 0;
    const MAX_ITERATIONS = 10;
    let lastResult: any;

    try {
        while (iterations < MAX_ITERATIONS) {
            console.log(`[LOCAL BRIDGE] Iteration ${iterations + 1} for stage: ${currentPayload.stage || 'START'}`);
            lastResult = await handler(currentPayload);

            const nextStage = lastResult.data?.execution?.stage;
            const status = lastResult.data?.execution?.status;

            // Terminal or blocking stages
            if (!nextStage ||
                nextStage === 'COMPLETED' ||
                nextStage === 'FAILED' ||
                nextStage === 'WAITING_FOR_APPROVAL' ||
                status === 'FAILED' ||
                status === 'COMPLETED') {
                break;
            }

            // Prepare next payload
            currentPayload = {
                ...currentPayload,
                stage: nextStage
            };
            iterations++;
        }

        res.json(lastResult);
    } catch (err: any) {
        console.error('[LOCAL BRIDGE ERROR]', err);
        res.status(500).json({
            success: false,
            error: err.message,
            code: 'BRIDGE_ERROR'
        });
    }
});

app.listen(port, () => {
    console.log(`\n🚀 Orchestrator Local Bridge running at http://localhost:${port}`);
    console.log(`Incoming invocations will be processed by the local handler.\n`);
});
