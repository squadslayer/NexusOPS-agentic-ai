/**
 * retrieval.ts — Data model for context retrieval (Phase-4).
 *
 * Defines the shape of retrieval results returned by the retrieval service.
 * Only chunk references are stored on the execution record — full content
 * lives in the ContextChunks table.
 *
 * NO raw Bedrock payloads.
 * NO document text in execution records.
 */

export interface RetrievalChunk {
    chunk_id: string;
    source: string;
    score: number;
}

export interface RetrievalResult {
    query: string;
    chunk_refs: string[];
    retrieved_at: string;
}
