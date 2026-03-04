import { Features } from '@/components/Features';
import { DashboardPreview } from '@/components/DashboardPreview';

export default function FeaturesPage() {
    return (
        <div className="pt-24 lg:pt-32 pb-16">
            <div className="layout-container text-center mb-16">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary mb-6">
                    Platform Features
                </h1>
                <p className="text-xl text-text-secondary max-w-3xl mx-auto">
                    Built for enterprise scale. Engineered for absolute determinism.
                </p>
            </div>
            <Features />
            <DashboardPreview />
        </div>
    );
}
