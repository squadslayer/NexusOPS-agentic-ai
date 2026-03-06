'use client';

import React, { useEffect, useState } from 'react';
import ExecutionList from '@/components/executions/ExecutionList';

interface Execution {
  execution_id: string;
  repo_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'APPROVAL_PENDING';
  created_at: string;
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExecutions() {
      try {
        const res = await fetch('http://localhost:8000/executions', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('nexusops_token') || ''}`
          }
        });

        if (!res.ok) {
          throw new Error('Failed to fetch executions');
        }

        const json = await res.json();
        setExecutions(json.data || []);
      } catch (err: any) {
        console.error('Failed to load executions', err);
        setError('Could not load executions. Please make sure the BFF backend is running locally.');

        // Mock data fallback
        setExecutions([
          {
            execution_id: 'exec-8b4e1012-mock',
            repo_id: 'sample-org/demo-repo',
            status: 'APPROVAL_PENDING',
            created_at: new Date(Date.now() - 600000).toISOString()
          },
          {
            execution_id: 'exec-a1b2c3d4-mock',
            repo_id: 'sample-org/demo-repo',
            status: 'COMPLETED',
            created_at: new Date(Date.now() - 86400000).toISOString()
          }
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchExecutions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Agentic Executions</h1>
          <p className="text-gray-400">Monitor and approve automated governance workflows across your connected repositories.</p>
        </div>
      </div>

      {error && !loading && (
        <div className="bg-red-900/40 text-red-200 p-4 rounded-lg flex gap-3 border border-red-900/60 font-mono text-sm max-w-4xl">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>{error} (Showing mock data instead)</p>
        </div>
      )}

      {loading ? (
        <div className="card p-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF9900]"></div>
        </div>
      ) : (
        <ExecutionList executions={executions} />
      )}
    </div>
  );
}