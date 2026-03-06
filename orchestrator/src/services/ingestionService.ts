/**
 * ingestionService.ts — Repository ingestion layer (Phase-Ingest).
 *
 * Handles cloning, crawling, and chunking repository content for grounded analysis.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const CONTEXT_CHUNKS_TABLE = "ContextChunks";
const CHUNK_TTL_SECONDS = 86_400; // 24 hours
const MAX_CHUNK_SIZE = 15000; // ~15KB

const region = process.env.AWS_REGION ?? "us-east-1";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

/**
 * Ingests a repository: clones, chunks, and stores in DynamoDB.
 */
export async function ingestRepository(repoUrl: string, repoId: string, userId: string): Promise<number> {
    console.log(`[INGESTION] Starting ingestion for ${repoUrl} (Repo: ${repoId}, User: ${userId})`);

    // 1. Fetch User's GitHub Token from DynamoDB
    let token: string | undefined;
    try {
        const tokenResponse = await dynamo.send(new QueryCommand({
            TableName: "GitHubTokens",
            KeyConditionExpression: "user_id = :uid",
            ExpressionAttributeValues: { ":uid": userId },
            Limit: 1
        }));

        if (tokenResponse.Items && tokenResponse.Items.length > 0) {
            token = tokenResponse.Items[0].access_token;
            console.log(`[INGESTION] Retrieved OAuth token for user ${userId}.`);
        }
    } catch (tokenErr) {
        console.warn(`[INGESTION] Could not fetch user token, falling back to environment PAT.`, tokenErr);
        token = process.env.GITHUB_API_TOKEN;
    }

    // 2. Check if already ingested for THIS USER (isolation check)
    try {
        console.log(`[INGESTION] Checking existence of chunks for repo ${repoId} (User: ${userId})...`);
        const existing = await dynamo.send(new QueryCommand({
            TableName: CONTEXT_CHUNKS_TABLE,
            IndexName: "RepoIndex",
            KeyConditionExpression: "repo_id = :rid",
            FilterExpression: "user_id = :uid", // Ensure this user has the context
            ExpressionAttributeValues: {
                ":rid": repoId,
                ":uid": userId
            },
            Limit: 1
        }));

        if (existing.Items && existing.Items.length > 0) {
            console.log(`[INGESTION] Repo ${repoId} already has context for user ${userId}. Skipping.`);
            return existing.Items.length;
        }
    } catch (queryError) {
        console.warn(`[INGESTION] Index query failed (might not exist yet), proceeding to ingestion.`, queryError);
    }

    const tempDir = path.join(os.tmpdir(), `nexusops-ingest-${repoId.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`);

    try {
        // 3. Clone Repository
        let authenticatedUrl = repoUrl;
        if (token && token !== "YOUR_GITHUB_PAT_HERE" && repoUrl.includes("github.com")) {
            authenticatedUrl = repoUrl.replace("https://", `https://${token}@`);
        }

        console.log(`[INGESTION] Cloning repo into ${tempDir}...`);

        const cloneOutput = execSync(`git clone --depth 1 "${authenticatedUrl}" "${tempDir}"`, {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        console.log(`[INGESTION] Clone complete.`);

        // 4. Crawl and Chunk
        const chunks = crawlAndChunk(tempDir);
        console.log(`[INGESTION] Found ${chunks.length} chunks.`);

        // 5. Store in DynamoDB
        let count = 0;
        for (const chunk of chunks) {
            const chunkId = `chunk-${repoId}-${Date.now()}-${count}`;
            const ttl = Math.floor(Date.now() / 1000) + CHUNK_TTL_SECONDS;

            await dynamo.send(new PutCommand({
                TableName: CONTEXT_CHUNKS_TABLE,
                Item: {
                    chunk_id: chunkId,
                    repo_id: repoId,
                    user_id: userId, // Multi-tenant tag
                    content: chunk.content,
                    source: chunk.source,
                    score: 1.0,
                    ttl
                }
            }));
            count++;
        }

        console.log(`[INGESTION] Successfully ingested ${count} chunks for user ${userId}.`);
        return count;

    } catch (error) {
        console.error(`[INGESTION] Failed:`, error);
        throw error;
    } finally {
        // 5. Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

/**
 * Recursively crawls directory and chunks relevant files.
 */
function crawlAndChunk(dir: string, baseDir: string = dir): Array<{ content: string; source: string }> {
    const results: Array<{ content: string; source: string }> = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file === ".git" || file === "node_modules") continue;
            results.push(...crawlAndChunk(fullPath, baseDir));
        } else if (stat.isFile()) {
            if (isRelevantFile(file)) {
                const content = fs.readFileSync(fullPath, "utf-8");
                const relativePath = path.relative(baseDir, fullPath);

                // Chunking logic: simple split for now
                const fileChunks = splitIntoChunks(content, MAX_CHUNK_SIZE);
                for (let i = 0; i < fileChunks.length; i++) {
                    results.push({
                        content: fileChunks[i],
                        source: `${relativePath}#part${i + 1}`
                    });
                }
            }
        }
    }

    return results;
}

function isRelevantFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const relevantExts = [".tf", ".yaml", ".yml", ".json", ".ts", ".js", ".md", ".py"];
    return relevantExts.includes(ext);
}

function splitIntoChunks(text: string, size: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        chunks.push(text.substring(start, start + size));
        start += size;
    }
    return chunks;
}
