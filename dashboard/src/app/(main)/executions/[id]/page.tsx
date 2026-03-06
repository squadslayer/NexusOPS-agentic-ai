import ExecutionDetail from '@/components/executions/ExecutionDetail';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function ExecutionPage({ params }: { params: { id: string } }) {
    return (
        <div className="space-y-4">
            <Link href="/executions" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                <ArrowLeftIcon className="w-4 h-4" />
                Back to Executions
            </Link>

            <ExecutionDetail executionId={params.id} />
        </div>
    );
}
