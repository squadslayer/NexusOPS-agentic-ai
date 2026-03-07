'use client';

import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { apiFetch } from "@/lib/api";

interface ApprovalRecord {
    approval_id: string;
    execution_id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    risk: string;
    expires_at: number;
}

interface ExecutionDetailProps {
    executionId: string;
}

export default function ExecutionDetail({ executionId }: ExecutionDetailProps) {
    const [execution, setExecution] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [approval, setApproval] = useState<ApprovalRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetails = async () => {
        try {
            const [execRes, logsRes, approvalRes] = await Promise.all([
                apiFetch(`/executions/${executionId}`),
                apiFetch(`/executions/${executionId}/logs`),
                apiFetch(`/executions/${executionId}/approval`)
            ]);

            if (!execRes.ok) throw new Error('Failed to fetch execution details');

            const execData = await execRes.json();
            setExecution(execData.data);

            if (logsRes.ok) {
                const logsData = await logsRes.json();
                setLogs(logsData.data?.logs || []);
            }

            if (approvalRes.ok) {
                const approvalData = await approvalRes.json();
                setApproval(approvalData.data);
            }
        } catch (err: any) {
            console.error(err);
            const bffUrl = process.env.NEXT_PUBLIC_BFF_URL || 'http://localhost:8000';
            setError(`Failed to load execution details. Checked: ${bffUrl}/executions/${executionId}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();

        // Poll for updates if it's running or pending approval
        const interval = setInterval(() => {
            fetchDetails();
        }, 8000);

        return () => clearInterval(interval);
    }, [executionId]);

    const handleApproval = async (decision: 'approve' | 'reject') => {
        setActionLoading(true);
        try {
            const res = await apiFetch(`/executions/${executionId}/${decision}`, {
                method: 'POST'
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `Failed to ${decision} execution`);
            }

            // Refresh state
            await fetchDetails();
        } catch (err: any) {
            console.error(err);
            alert(`Error: ${err.message || 'Something went wrong processing your decision.'}`);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="card p-12 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF9900]"></div>
            </div>
        );
    }

    if (error && !execution) {
        return (
            <div className="card p-8 bg-red-900/20 text-red-200 border border-red-900">
                <h3 className="text-xl font-bold mb-2">Error Loading Execution</h3>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Info */}
            <div className="card p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1 tracking-tight">Execution Details</h2>
                        <p className="font-mono text-sm text-gray-400">{execution.execution_id}</p>
                    </div>
                    <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold font-mono tracking-widest ${execution.status === 'COMPLETED' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                            execution.status === 'FAILED' ? 'bg-red-900/50 text-red-400 border border-red-800' :
                                execution.status === 'APPROVAL_PENDING' ? 'bg-amber-900/50 text-amber-400 border border-amber-800 animate-pulse' :
                                    'bg-[#1a1d24] text-gray-300 border border-[#2A2E35]'
                            }`}>
                            {execution.status}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                    <div>
                        <p className="text-gray-500 mb-1">Repository</p>
                        <p className="font-medium text-gray-200">{execution.repo_id}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 mb-1">Started</p>
                        <p className="font-medium text-gray-200">
                            {formatDistanceToNow(new Date(execution.created_at), { addSuffix: true })}
                        </p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-gray-500 mb-1">Intent Prompt</p>
                        <p className="font-medium text-gray-200 italic">"{execution.prompt || 'No intent prompt provided'}"</p>
                    </div>
                </div>
            </div>

            {/* Approval Overlay - Visible ONLY if approval is pending */}
            {execution.status === 'APPROVAL_PENDING' && approval && approval.status === 'PENDING' && (
                <div className="card p-6 border border-amber-600/50 bg-amber-900/10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h3 className="text-amber-400 font-bold mb-2 flex items-center gap-2">
                                <ExclamationTriangleIcon className="w-5 h-5" />
                                Action Required: Plan Approval
                            </h3>
                            <p className="text-gray-300 text-sm mb-2">
                                The AI generated a plan for this execution but flagged it as
                                <span className="font-bold text-amber-500 ml-1 bg-amber-900/40 px-2 py-0.5 rounded">
                                    {approval.risk}
                                </span> risk.
                            </p>
                            <p className="text-gray-400 text-xs">
                                Review the plan below. You must approve or reject this execution before it continues.
                                Expires in {Math.max(0, Math.floor(approval.expires_at - Date.now() / 1000))} seconds.
                            </p>
                        </div>
                        <div className="flex gap-4 shrink-0">
                            <button
                                onClick={() => handleApproval('reject')}
                                disabled={actionLoading}
                                className="btn-danger flex items-center gap-2 whitespace-nowrap"
                            >
                                <XCircleIcon className="w-5 h-5" />
                                Reject Plan
                            </button>
                            <button
                                onClick={() => handleApproval('approve')}
                                disabled={actionLoading}
                                className="btn-primary flex items-center gap-2 whitespace-nowrap"
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                Approve Execution
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Execution Logs / Plan output */}
            <div className="card p-0 overflow-hidden">
                <div className="bg-[#111318] px-6 py-4 border-b border-[#2A2E35]">
                    <h3 className="font-semibold text-gray-300">Execution Timeline</h3>
                </div>
                <div className="p-6">
                    {logs.length === 0 ? (
                        <p className="text-gray-500 italic text-sm text-center">No logs generated yet.</p>
                    ) : (
                        <div className="font-mono text-xs space-y-2">
                            {logs.map((log, idx) => (
                                <div key={idx} className="flex gap-4 text-gray-400 border-l border-[#2A2E35] pl-4 py-1">
                                    <span className="text-gray-600 shrink-0">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className={log.level === 'ERROR' ? 'text-red-400' : 'text-gray-300'}>
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Inline Icon to save import hell for the component above if heroicons missing Exclamation
function ExclamationTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    );
}
