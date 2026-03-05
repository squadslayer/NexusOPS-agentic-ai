import React from 'react';
import {
    ShieldAlert, Home, LayoutDashboard, AlertTriangle, Cloud, Eye, LayoutGrid,
    Layers, ShieldCheck, Activity, Bell, User, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export function DashboardPreview() {
    return (
        <section className="py-24 border-b border-white/5 bg-background relative z-10">
            <div className="layout-container md:max-w-7xl">

                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
                        Unified Security Posture
                    </h2>
                    <p className="text-lg text-text-secondary">
                        Your single pane of glass for cloud governance, compliance, and multi-account cost management.
                    </p>
                </div>

                {/* Dashboard Window Mockup */}
                <div className="w-full bg-[#111317] border border-white/10 rounded-xl overflow-hidden flex shadow-2xl shadow-black h-[750px] text-sm text-gray-300 mx-auto font-sans ring-1 ring-white/5 transform scale-100 origin-top">

                    {/* Sidebar */}
                    <div className="w-64 bg-[#16191D] border-r border-white/5 flex flex-col flex-shrink-0 relative z-20">
                        {/* Logo */}
                        <div className="h-16 flex items-center px-6 border-b border-white/5 gap-2">
                            <ShieldAlert className="w-6 h-6 text-[#f97316]" />
                            <span className="font-semibold text-white text-lg tracking-tight">CloudControl</span>
                        </div>

                        <div className="flex-1 overflow-y-auto py-6 space-y-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <SidebarSection title="OVERVIEW">
                                <SidebarItem icon={<Home size={18} />} label="Home" active={false} />
                                <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={true} />
                            </SidebarSection>

                            <SidebarSection title="GOVERNANCE">
                                <SidebarItem icon={<AlertTriangle size={18} />} label="Problem Statement" />
                                <SidebarItem icon={<Cloud size={18} />} label="AWS Resources" />
                                <SidebarItem icon={<Eye size={18} />} label="Vision" />
                                <SidebarItem icon={<LayoutGrid size={18} />} label="Use Cases" />
                            </SidebarSection>

                            <SidebarSection title="INVENTORY">
                                <SidebarItem icon={<Layers size={18} />} label="Resources" />
                            </SidebarSection>

                            <SidebarSection title="COMPLIANCE & COSTS">
                                <SidebarItem icon={<ShieldCheck size={18} />} label="Policy Violations" />
                                <SidebarItem icon={<Activity size={18} />} label="Cost Anomalies" />
                            </SidebarSection>
                        </div>

                        <div className="p-4 border-t border-white/5 mt-auto">
                            <div className="text-[10px] text-gray-600 flex items-center justify-between">
                                <span>localhost:3001</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500/80"></span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#0F1115]">
                        {/* Topbar */}
                        <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between flex-shrink-0 bg-[#0F1115]">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 text-sm">CloudControl</span>
                                <span className="text-gray-600 text-xs text-center">&gt;</span>
                                <span className="text-gray-200 text-sm font-medium tracking-wide">Dashboard</span>
                            </div>

                            <div className="flex items-center gap-4">
                                <button className="relative text-gray-400 hover:text-white transition-colors">
                                    <Bell size={20} />
                                    <span className="absolute -top-0.5 -right-0.5 w-[7px] h-[7px] bg-red-500 rounded-full"></span>
                                </button>
                                <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                                    <div className="w-8 h-8 rounded-full border border-gray-600 flex items-center justify-center">
                                        <User size={16} className="text-gray-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-white leading-tight">Admin</span>
                                        <span className="text-[11px] text-gray-500 leading-none">us-east-1</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dashboard Content */}
                        <div className="p-8 overflow-y-auto">

                            <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
                                <div>
                                    <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Dashboard</h1>
                                    <p className="text-[15px] text-gray-400">Real-time overview of your cloud governance posture across all AWS accounts.</p>
                                </div>
                                <button className="bg-[#f97316] hover:bg-[#ea580c] text-white px-5 py-2.5 rounded-md font-semibold text-[13px] transition-colors shadow-lg shadow-[#f97316]/20">
                                    Export Report
                                </button>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <StatCard
                                    title="TOTAL AWS RESOURCES"
                                    value="4,821"
                                    trend="+3.2% from last 7d"
                                    trendType="positive"
                                    icon={<Cloud size={16} className="text-gray-600" />}
                                />
                                <StatCard
                                    title="POLICY VIOLATIONS"
                                    value="128"
                                    trend="-12% from last 7d"
                                    trendType="negative_but_good"
                                    icon={<AlertTriangle size={16} className="text-gray-600" />}
                                />
                                <StatCard
                                    title="COMPLIANT ACCOUNTS"
                                    value="97.4%"
                                    trend="+0.8% from last 7d"
                                    trendType="positive"
                                    icon={<ShieldCheck size={16} className="text-gray-600" />}
                                />
                                <StatCard
                                    title="COST ANOMALIES"
                                    value="7"
                                    trend="+2 from last 7d"
                                    trendType="negative"
                                    icon={<Activity size={16} className="text-gray-600" />}
                                />
                            </div>

                            {/* Charts & Lists Row */}
                            <div className="grid grid-cols-12 gap-4 h-[380px]">

                                {/* Line Chart Area */}
                                <div className="col-span-12 xl:col-span-8 bg-[#16191D] border border-white/5 rounded-lg p-6 flex flex-col relative overflow-hidden">
                                    <div className="mb-8 z-10 flex flex-col">
                                        <h3 className="text-white font-medium text-[15px] mb-1">Resource Inventory Trend</h3>
                                        <p className="text-[13px] text-gray-400">Total AWS resources — last 7 days</p>
                                    </div>

                                    {/* Fake Chart SVG Container */}
                                    <div className="flex-1 relative w-full h-full">
                                        {/* Y Axis Labels */}
                                        <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-[11px] text-gray-500 font-sans text-right pr-2">
                                            <span>4830</span>
                                            <span>4780</span>
                                            <span>4690</span>
                                            <span>4620</span>
                                            <span>4550</span>
                                        </div>

                                        {/* Chart Core Area */}
                                        <div className="absolute left-12 right-0 top-1 bottom-8 flex flex-col justify-between">
                                            {/* Grid Lines */}
                                            <div className="border-b border-white/[0.04] w-full h-0 border-dashed"></div>
                                            <div className="border-b border-white/[0.04] w-full h-0 border-dashed"></div>
                                            <div className="border-b border-white/[0.04] w-full h-0 border-dashed"></div>
                                            <div className="border-b border-white/[0.04] w-full h-0 border-dashed"></div>
                                            <div className="border-b border-white/[0.04] w-full h-0 border-dashed"></div>

                                            {/* The SVG Line */}
                                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full z-10 -ml-1 overflow-visible">
                                                <path
                                                    d="M 0 85 Q 20 70 50 40 T 100 15"
                                                    fill="none"
                                                    stroke="#f97316"
                                                    strokeWidth="2"
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            </svg>
                                        </div>

                                        {/* X Axis Labels */}
                                        <div className="absolute left-12 right-0 bottom-0 h-6 flex justify-between text-[11px] text-gray-500 pt-3">
                                            <span>Feb 23</span>
                                            <span>Feb 24</span>
                                            <span>Feb 25</span>
                                            <span>Feb 26</span>
                                            <span>Feb 27</span>
                                            <span>Feb 28</span>
                                            <span>Mar 01</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Top Policy Violations Area */}
                                <div className="col-span-12 xl:col-span-4 bg-[#16191D] border border-white/5 rounded-lg p-6 flex flex-col">
                                    <div className="mb-6 border-b border-white/5 pb-4">
                                        <h3 className="text-white font-medium text-[15px] mb-1">Top Policy Violations</h3>
                                        <p className="text-[13px] text-gray-400">Most recent open findings</p>
                                    </div>

                                    <div className="flex text-[10px] text-gray-500 font-bold mb-3 uppercase tracking-wider">
                                        <div className="w-20">SEVERITY</div>
                                        <div className="flex-1 pl-2 text-left">RULE / RESOURCE</div>
                                        <div className="w-[52px] text-right">DETECT</div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-5 pr-1 pt-1 mt-1">
                                        <ViolationRow
                                            severity="CRITICAL"
                                            rule="S3 bucket public access enabled"
                                            resource="s3://prod-data-lake-raw"
                                            date="Mar 1, 20"
                                        />
                                        <ViolationRow
                                            severity="CRITICAL"
                                            rule="IAM root account has active access key"
                                            resource="arn:aws:iam::123456789012..."
                                            date="Mar 1, 20"
                                        />
                                        <ViolationRow
                                            severity="HIGH"
                                            rule="EC2 instance with unrestricted SSH (0.0.0.0/0)"
                                            resource="i-0a1b2c3d4e5f67890"
                                            date="Mar 1, 20"
                                        />
                                        <ViolationRow
                                            severity="HIGH"
                                            rule="CloudTrail logging disabled in region"
                                            resource="ap-southeast-1"
                                            date="Mar 1, 20"
                                        />
                                    </div>
                                </div>

                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// Helpers

function SidebarSection({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="mb-6">
            <div className="px-6 text-[11px] font-bold tracking-widest text-gray-600 mb-3 uppercase">{title}</div>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
    if (active) {
        return (
            <button className="w-full relative flex items-center gap-3 px-6 py-2.5 bg-[#1B1E22] text-[#f97316] font-medium text-[13px] transition-colors text-left group hover:bg-[#1B1E22]/80">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#f97316]"></div>
                <div className="text-[#f97316]/90 group-hover:text-[#f97316] transition-colors">{icon}</div>
                <span>{label}</span>
            </button>
        );
    }
    return (
        <button className="w-full flex items-center gap-3 px-6 py-2.5 text-gray-400 hover:text-white font-medium text-[13px] transition-colors text-left group">
            <div className="text-gray-500 group-hover:text-gray-300 transition-colors">{icon}</div>
            <span>{label}</span>
        </button>
    );
}

function StatCard({ title, value, trend, trendType, icon }: { title: string, value: string, trend: string, trendType: 'positive' | 'negative' | 'negative_but_good', icon: React.ReactNode }) {

    // Logic for color and icon based on trendType
    let isGoodTrendText = false;
    let isArrowUp = true;

    if (trendType === 'positive') {
        isGoodTrendText = true;
        isArrowUp = true;
    } else if (trendType === 'negative') {
        isGoodTrendText = false;
        isArrowUp = true; // Still goes up (anomalies increased = bad)
    } else if (trendType === 'negative_but_good') {
        // Violations down = good!
        isGoodTrendText = true;
        isArrowUp = false;
    }

    const trendColorClass = isGoodTrendText ? 'text-green-500' : 'text-red-500';
    const IconComponent = isArrowUp ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="bg-[#16191D] border border-white/5 rounded-lg p-5 flex flex-col justify-between hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-6">
                <h4 className="text-[11px] font-medium text-gray-500 tracking-wider uppercase">{title}</h4>
                <div className="">{icon}</div>
            </div>
            <div>
                <div className="text-3xl font-bold text-white mb-2">{value}</div>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${trendColorClass}`}>
                    <IconComponent size={14} strokeWidth={2.5} />
                    <span>{trend}</span>
                </div>
            </div>
        </div>
    );
}

function ViolationRow({ severity, rule, resource, date }: { severity: string, rule: string, resource: string, date: string }) {
    const isCritical = severity === 'CRITICAL';

    const badgeColor = isCritical
        ? 'bg-red-500/10 text-red-500 border-red-500/20'
        : 'bg-orange-500/10 text-[#f97316] border-[#f97316]/20';

    return (
        <div className="flex gap-4 items-start">
            <div className="w-20 mt-[3px]">
                <span className={`inline-flex items-center justify-center px-2 py-[2px] rounded uppercase border text-[9px] font-bold tracking-widest ${badgeColor}`}>
                    {severity}
                </span>
            </div>
            <div className="flex-1 min-w-0 pl-2">
                <div className="text-[13px] text-gray-200 font-medium mb-1 leading-snug">{rule}</div>
                <div className="text-[12px] text-gray-500 font-mono truncate">{resource}</div>
            </div>
            <div className="w-[52px] text-right text-[11px] text-gray-500 mt-[3px]">
                {date}
            </div>
        </div>
    );
}
