import { Hero } from '@/components/Hero';
import { Integrations } from '@/components/Integrations';
import { Workflow } from '@/components/Workflow';
import { Features } from '@/components/Features';
import { DashboardPreview } from '@/components/DashboardPreview';
import { Security } from '@/components/Security';
import { CTA } from '@/components/CTA';

export default function Home() {
  return (
    <>
      <Hero />
      <Integrations />
      <Workflow />
      <DashboardPreview />
      <Features />
      <Security />
      <CTA />
    </>
  );
}
