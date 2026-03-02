/**
 * retrievalService.ts — Context retrieval layer (Phase-4).
 *
 * ONLY place in the orchestrator allowed to retrieve grounding context.
 * Supports three retrieval modes (adapter pattern):
 *
 *   1. BEDROCK — Real Bedrock Knowledge Base (when KB_ID is set)
 *   2. S3      — Direct S3 document retrieval (when S3_BUCKET is set)
 *   3. MOCK    — Deterministic test data (fallback)
 *
 * Output shape is identical across all modes — upgrading from S3 → Bedrock
 * is a one-line env change, no code rewrite.
 *
 * GOVERNANCE RULES:
 *   ✅ Limit result count (K ≤ 5)
 *   ✅ Deterministic ordering (by score descending)
 *   ✅ Chunk size guard (truncate at 20KB)
 *   ✅ 5s retrieval timeout (AbortController)
 *   ✅ 24h TTL on stored chunks
 *   ✅ Retrieval metrics logging
 *   ❌ No generation models
 *   ❌ No summarization
 *   ❌ No retry loops
 */

import "dotenv/config";

import {
    BedrockAgentRuntimeClient,
    RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
} from "@aws-sdk/client-s3";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import { Readable } from "stream";
import { RetrievalResult } from "../models/retrieval";

const MAX_CHUNKS = 5;
const MAX_CONTENT_BYTES = 20_000;
const CONTEXT_CHUNKS_TABLE = "ContextChunks";
const CHUNK_TTL_SECONDS = 86_400;
const RETRIEVAL_TIMEOUT_MS = 5_000;

const region = process.env.AWS_REGION ?? "us-east-1";
const knowledgeBaseId = process.env.KB_ID;
const s3Bucket = process.env.S3_BUCKET;

const bedrock = new BedrockAgentRuntimeClient({ region });
const s3 = new S3Client({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

type RetrievalMode = "bedrock" | "s3" | "mock";

function resolveMode(): RetrievalMode {
    if (knowledgeBaseId && knowledgeBaseId !== "kb-xxxxx") return "bedrock";
    if (s3Bucket) return "s3";
    return "mock";
}

/**
 * Retrieves relevant context for a given query.
 *
 * Steps:
 *   1. Resolve retrieval mode (bedrock / s3 / mock)
 *   2. Fetch raw documents with 5s timeout
 *   3. Select top K results (K ≤ 5), deterministically ordered
 *   4. Normalize scores
 *   5. Truncate oversized chunks (> 20KB)
 *   6. Store chunks in ContextChunks (DynamoDB or in-memory) with 24h TTL
 *   7. Return chunk references + metrics
 */
export async function retrieveContext(query: string): Promise<RetrievalResult> {
    const mode = resolveMode();
    const startTime = Date.now();

    console.info(JSON.stringify({ event: "retrieval_mode_selected", mode }));

    let rawChunks: Array<{ content: string; source: string; score: number }>;

    switch (mode) {
        case "bedrock":
            rawChunks = await bedrockRetrieve(query);
            break;
        case "s3":
            rawChunks = await s3Retrieve(query);
            break;
        default:
            rawChunks = await mockRetrieve(query);
            break;
    }

    const topChunks = rawChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CHUNKS);

    const normalizedChunks = normalizeScores(topChunks);

    const chunkRefs: string[] = [];
    const useDynamo = mode === "bedrock" || mode === "s3";

    for (const chunk of normalizedChunks) {
        let content = chunk.content;

        if (Buffer.byteLength(content, "utf-8") > MAX_CONTENT_BYTES) {
            console.warn(`[RETRIEVAL] Chunk exceeds 20KB, truncating: ${chunk.source}`);
            content = content.slice(0, MAX_CONTENT_BYTES);
        }

        const chunkId = generateChunkId();
        const ttl = Math.floor(Date.now() / 1000) + CHUNK_TTL_SECONDS;

        if (useDynamo) {
            await dynamo.send(new PutCommand({
                TableName: CONTEXT_CHUNKS_TABLE,
                Item: { chunk_id: chunkId, content, source: chunk.source, score: chunk.score, ttl },
            }));
        } else {
            localChunkStore.set(chunkId, { content, source: chunk.source, score: chunk.score, ttl });
        }

        chunkRefs.push(chunkId);
    }

    const latencyMs = Date.now() - startTime;

    console.info(JSON.stringify({
        event: "RETRIEVAL_COMPLETE",
        mode,
        query,
        chunks: chunkRefs.length,
        latency_ms: latencyMs,
    }));

    return {
        query,
        chunk_refs: chunkRefs,
        retrieved_at: new Date().toISOString(),
    };
}

// ── BEDROCK ADAPTER ──────────────────────────────────────────────

async function bedrockRetrieve(
    query: string
): Promise<Array<{ content: string; source: string; score: number }>> {
    console.log(`[RETRIEVAL] Calling Bedrock KB: ${knowledgeBaseId}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RETRIEVAL_TIMEOUT_MS);

    try {
        const response = await bedrock.send(
            new RetrieveCommand({
                knowledgeBaseId: knowledgeBaseId!,
                retrievalQuery: { text: query },
            }),
            { abortSignal: controller.signal }
        );

        const results = response.retrievalResults ?? [];

        return results.map((r) => ({
            content: r.content?.text ?? "",
            source: r.location?.s3Location?.uri ?? "unknown",
            score: r.score ?? 0,
        }));
    } finally {
        clearTimeout(timeout);
    }
}

// ── S3 ADAPTER ───────────────────────────────────────────────────

async function s3Retrieve(
    _query: string
): Promise<Array<{ content: string; source: string; score: number }>> {
    console.log(`[RETRIEVAL] Fetching documents from S3: ${s3Bucket}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RETRIEVAL_TIMEOUT_MS);

    try {
        const list = await s3.send(
            new ListObjectsV2Command({ Bucket: s3Bucket! }),
            { abortSignal: controller.signal }
        );

        const docs: Array<{ content: string; source: string; score: number }> = [];

        for (const obj of list.Contents ?? []) {
            if (!obj.Key) continue;
            if (!obj.Key.endsWith(".md") && !obj.Key.endsWith(".pdf") && !obj.Key.endsWith(".txt")) continue;
            if (docs.length >= MAX_CHUNKS) break;

            const file = await s3.send(
                new GetObjectCommand({ Bucket: s3Bucket!, Key: obj.Key }),
                { abortSignal: controller.signal }
            );

            const content = await streamToString(file.Body as Readable);

            docs.push({
                content,
                source: obj.Key,
                score: 1.0,
            });
        }

        return docs;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Converts a readable stream to a UTF-8 string.
 */
async function streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
}

// ── MOCK ADAPTER ─────────────────────────────────────────────────

async function mockRetrieve(
    query: string
): Promise<Array<{ content: string; source: string; score: number }>> {
    console.log(`[RETRIEVAL] Using MOCK retrieval (no KB_ID or S3_BUCKET configured)`);

    return [
        {
            content: `Relevant context for query: "${query}" — Infrastructure provisioning best practices for cloud-native deployments.`,
            source: "infra-guide.pdf",
            score: 0.95,
        },
        {
            content: `Security policies and compliance requirements applicable to: "${query}".`,
            source: "security-policy.md",
            score: 0.88,
        },
        {
            content: `Historical incident analysis related to: "${query}" — past resolution patterns and root causes.`,
            source: "incident-log.json",
            score: 0.82,
        },
    ];
}

// ── SHARED UTILITIES ─────────────────────────────────────────────

function normalizeScores<T extends { score: number }>(chunks: T[]): T[] {
    if (chunks.length === 0) return chunks;

    const maxScore = Math.max(...chunks.map((c) => c.score));
    const minScore = Math.min(...chunks.map((c) => c.score));
    const range = maxScore - minScore;

    if (range === 0) {
        return chunks.map((c) => ({ ...c, score: 1.0 }));
    }

    return chunks.map((c) => ({
        ...c,
        score: parseFloat(((c.score - minScore) / range).toFixed(4)),
    }));
}

function generateChunkId(): string {
    return `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const localChunkStore: Map<string, { content: string; source: string; score: number; ttl: number }> = new Map();

export function getStoredChunks(): Map<string, { content: string; source: string; score: number; ttl: number }> {
    return new Map(localChunkStore);
}
