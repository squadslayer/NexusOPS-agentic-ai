/**
 * riskRegistryRepository.ts — Risk record store (Phase-9).
 *
 * Tracks previously observed execution plan fingerprints.
 * Enables recurrence detection and automatic blocking of repeated high-risk plans.
 *
 * DESIGN:
 *   ✅ In-memory store for local validation (same pattern as LocalMemoryRepository)
 *   ✅ DynamoDB-ready via IRiskRegistry interface
 *   ✅ Append-only occurrence counter — no deletions
 *   ✅ Explicit block flag — blocking is a deliberate governance action
 *
 * DynamoDB Table (production): RiskRegistry
 *   PK: risk_hash (String)
 *   GSI: risk_level-index (risk_level attribute) — allows querying all high-risk hashes
 *   TTL: none — risk records are permanent governance audit entries
 *
 * RECURRENCE RULE (from Phase-9 spec):
 *   occurrence_count > 5 AND risk_level === "high" → execution blocked
 */

export type RiskLevel = "low" | "medium" | "high";

export interface RiskRecord {
    /** SHA-256 fingerprint of the execution plan. */
    risk_hash: string;
    /** ISO-8601 timestamp of first observation. */
    first_seen: string;
    /** Total number of times this plan has been submitted. */
    occurrence_count: number;
    /** Risk level calculated by the constraint engine. */
    risk_level: RiskLevel;
    /** Whether this plan hash is explicitly blocked from executing. */
    blocked: boolean;
}

// ── RECURRENCE THRESHOLD ─────────────────────────────────────────────

/** From Phase-9 spec: block execution when both conditions are true. */
export const RECURRENCE_THRESHOLD = {
    max_occurrences: 5,
    risk_level: "high" as RiskLevel,
};

/**
 * Returns true if this record exceeds the recurrence threshold.
 * Used by constraintStage to enforce blocking.
 */
export function isRecurrenceBlocked(record: RiskRecord): boolean {
    return (
        record.blocked ||
        (record.occurrence_count > RECURRENCE_THRESHOLD.max_occurrences &&
            record.risk_level === RECURRENCE_THRESHOLD.risk_level)
    );
}

// ── INTERFACE ────────────────────────────────────────────────────────

export interface IRiskRegistry {
    getRisk(hash: string): Promise<RiskRecord | null>;
    recordRisk(hash: string, riskLevel: RiskLevel): Promise<RiskRecord>;
    incrementOccurrence(hash: string): Promise<RiskRecord>;
    blockRisk(hash: string): Promise<RiskRecord>;
}

// ── IN-MEMORY IMPLEMENTATION ─────────────────────────────────────────

export class LocalMemoryRiskRegistry implements IRiskRegistry {
    private store: Map<string, RiskRecord> = new Map();

    /**
     * Returns the risk record for a given hash, or null if not seen before.
     */
    async getRisk(hash: string): Promise<RiskRecord | null> {
        return this.store.get(hash) ?? null;
    }

    /**
     * Creates a new risk record for a previously unseen plan fingerprint.
     * Throws if the hash already exists — caller should check getRisk first.
     */
    async recordRisk(hash: string, riskLevel: RiskLevel): Promise<RiskRecord> {
        if (this.store.has(hash)) {
            throw new Error(`Risk record already exists for hash: ${hash.slice(0, 12)}...`);
        }

        const record: RiskRecord = {
            risk_hash: hash,
            first_seen: new Date().toISOString(),
            occurrence_count: 1,
            risk_level: riskLevel,
            blocked: false,
        };

        this.store.set(hash, record);

        console.log(JSON.stringify({
            event: "RISK_RECORDED",
            risk_hash: hash.slice(0, 12),
            risk_level: riskLevel,
            occurrence_count: 1,
        }));

        return { ...record };
    }

    /**
     * Increments the occurrence counter for an existing risk record.
     * Throws if the hash is not found — caller must ensure existence.
     */
    async incrementOccurrence(hash: string): Promise<RiskRecord> {
        const existing = this.store.get(hash);
        if (!existing) {
            throw new Error(`Risk record not found for hash: ${hash.slice(0, 12)}...`);
        }

        const updated: RiskRecord = {
            ...existing,
            occurrence_count: existing.occurrence_count + 1,
        };

        this.store.set(hash, updated);

        console.log(JSON.stringify({
            event: "RISK_OCCURRENCE_INCREMENTED",
            risk_hash: hash.slice(0, 12),
            risk_level: updated.risk_level,
            occurrence_count: updated.occurrence_count,
            blocked: isRecurrenceBlocked(updated),
        }));

        return { ...updated };
    }

    /**
     * Explicitly blocks a risk hash from executing.
     * Can be called independently of the recurrence threshold.
     */
    async blockRisk(hash: string): Promise<RiskRecord> {
        const existing = this.store.get(hash);
        if (!existing) {
            throw new Error(`Risk record not found for hash: ${hash.slice(0, 12)}...`);
        }

        const updated: RiskRecord = { ...existing, blocked: true };
        this.store.set(hash, updated);

        console.log(JSON.stringify({
            event: "RISK_BLOCKED",
            risk_hash: hash.slice(0, 12),
            risk_level: updated.risk_level,
            occurrence_count: updated.occurrence_count,
        }));

        return { ...updated };
    }
}

/**
 * Singleton instance shared across constraintStage invocations.
 * In production, replace with a DynamoDB-backed implementation.
 */
export const riskRegistry = new LocalMemoryRiskRegistry();
