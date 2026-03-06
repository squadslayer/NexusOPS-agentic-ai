import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Execution {
    execution_id: string;
    repo_id: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'APPROVAL_PENDING';
    created_at: string;
}

interface ExecutionListProps {
    executions: Execution[];
}

export default function ExecutionList({ executions }: ExecutionListProps) {
    if (!executions || executions.length === 0) {
        return (
            <div className="card p-8 text-center text-gray-400">
                <h3 className="text-xl font-semibold mb-2 text-white">No Executions Found</h3>
                <p>You haven't run any agentic flows yet.</p>
                <div className="mt-6">
                    <Link href="/dashboard" className="btn-primary">
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return <span className="badge-pass bg-green-900/40 text-green-400 px-2 py-1 rounded text-xs font-mono">COMPLETED</span>;
            case 'FAILED':
                return <span className="badge-fail bg-red-900/40 text-red-400 px-2 py-1 rounded text-xs font-mono">FAILED</span>;
            case 'RUNNING':
                return <span className="badge-warn bg-amber-900/40 text-amber-400 px-2 py-1 rounded text-xs font-mono">RUNNING</span>;
            case 'APPROVAL_PENDING':
                return <span className="badge-warn animate-pulse bg-amber-900/40 text-amber-400 px-2 py-1 rounded text-xs font-mono">APPROVAL PENDING</span>;
            default:
                return <span className="badge-neutral bg-gray-800 text-gray-400 px-2 py-1 rounded text-xs font-mono">{status}</span>;
        }
    };

    return (
        <div className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#111318] border-b border-[#2A2E35] text-gray-400">
                        <tr>
                            <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Execution ID</th>
                            <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Repository</th>
                            <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Status</th>
                            <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Age</th>
                            <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2E35]">
                        {executions.map((exec) => (
                            <tr key={exec.execution_id} className="hover:bg-[#1a1d24] transition-colors">
                                <td className="px-6 py-4 font-mono text-gray-300">
                                    {exec.execution_id.substring(0, 8)}...
                                </td>
                                <td className="px-6 py-4 text-gray-300">{exec.repo_id}</td>
                                <td className="px-6 py-4">{getStatusBadge(exec.status)}</td>
                                <td className="px-6 py-4 text-gray-400 text-xs">
                                    {formatDistanceToNow(new Date(exec.created_at), { addSuffix: true })}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <Link
                                        href={`/executions/${exec.execution_id}`}
                                        className="text-[#FF9900] hover:text-[#FFB347] font-medium text-sm transition-colors"
                                    >
                                        View Details →
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
