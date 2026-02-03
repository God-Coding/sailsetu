"use client";

import { useEffect, useState } from "react";
import { useFirebaseAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, User, Mail, Briefcase, UserCheck, XCircle, GitCompare, GitBranch, Plus, FileText, Hammer, Terminal, Share2, Wrench, Flame, ClipboardCheck, Bot, ShieldAlert, Copy, Paintbrush, Smartphone, Shield } from "lucide-react";
// ... imports ...

// ... inside Tools Section grid ...

{/* Access Map Card */ }
<Link href="/visualizer" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10">
    <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors">
            <Share2 className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-slate-200">Access Lineage Map</h3>
    </div>
    <p className="text-xs text-slate-400">Visualize identity entitlements and roles in an interactive graph.</p>
</Link>

{/* Request Repair Card */ }
<Link href="/request-maintenance" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10">
    <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-colors">
            <Wrench className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-slate-200">Request Repair</h3>
    </div>
    <p className="text-xs text-slate-400">Diagnose and fix stuck IdentityIQ requests and workflows.</p>
</Link>

{/* Firefighter Card */ }
<Link href="/firefighter" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10">
    <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20 group-hover:text-red-300 transition-colors">
            <Flame className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-slate-200">Firefighter Access</h3>
    </div>
    <p className="text-xs text-slate-400">Emergency "Break-Glass" access provisioning with auto-expiry.</p>
</Link>

export default function Dashboard() {
    const { user, loading } = useFirebaseAuth();

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </main>
        );
    }

    // RouteGuard handles auth redirect, so we just check if user exists
    if (!user) return null;

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
                        <p className="text-slate-400 mt-1">Manage your identity access and workflows</p>
                    </div>
                    <div className="text-sm text-slate-500 font-mono px-3 py-1 bg-slate-900 rounded-full border border-slate-800">{user?.email}</div>
                </div>

                <div className="space-y-8">
                    {/* Tools Section */}
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-blue-400" />
                            Tools & Utilities
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {/* Manage Access Card */}
                            <Link href="/manage-access" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-teal-500/50 hover:shadow-lg hover:shadow-teal-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 group-hover:bg-teal-500/20 group-hover:text-teal-300 transition-colors">
                                        <UserCheck className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Manage Access</h3>
                                </div>
                                <p className="text-xs text-slate-400">Request permissions or revoke existing access for users.</p>
                            </Link>

                            {/* Access Reviews Card */}
                            <Link href="/access-reviews" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-400/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-blue-400/10 text-blue-400 group-hover:bg-blue-400/20 group-hover:text-blue-300 transition-colors">
                                        <Shield className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Access Reviews</h3>
                                </div>
                                <p className="text-xs text-slate-400">View and approve pending access certifications.</p>
                            </Link>

                            {/* Compare Tool Card */}
                            <Link href="/compare" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                        <GitCompare className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Compare & Provision</h3>
                                </div>
                                <p className="text-xs text-slate-400">Compare access between identities and provision missing entitlements.</p>
                            </Link>

                            {/* Workflow Tool Card */}
                            <Link href="/workflow-access" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors">
                                        <GitBranch className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Workflow Manager</h3>
                                </div>
                                <p className="text-xs text-slate-400">Launch and monitor SCIM workflows and tasks.</p>
                            </Link>

                            {/* Batch Request Card */}
                            <Link href="/batch" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Batch Provisioning</h3>
                                </div>
                                <p className="text-xs text-slate-400">Upload CSV to bulk provision access. Support for standard LCM.</p>
                            </Link>

                            {/* Workgroups Card */}
                            <Link href="/workgroup" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 group-hover:text-orange-300 transition-colors">
                                        <Hammer className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Workgroup Manager</h3>
                                </div>
                                <p className="text-xs text-slate-400">Create and manage Workgroups, assign capabilities, and bulk import.</p>
                            </Link>

                            {/* Rule Runner Card */}
                            <Link href="/rule-runner" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 group-hover:text-pink-300 transition-colors">
                                        <Terminal className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Rule Runner</h3>
                                </div>
                                <p className="text-xs text-slate-400">Interactive sandbox to execute BeanShell rules and debug logic.</p>
                            </Link>

                            {/* Leaver Cleanup Card */}
                            <Link href="/leaver-cleanup" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-rose-500/50 hover:shadow-lg hover:shadow-rose-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20 group-hover:text-rose-300 transition-colors">
                                        <ShieldAlert className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Leaver Cleanup</h3>
                                </div>
                                <p className="text-xs text-slate-400">Scan for inactive identities with residual access and revoke them.</p>
                            </Link>

                            {/* Application Cloner Card */}
                            <Link href="/app-cloner" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors">
                                        <Copy className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Application Cloner</h3>
                                </div>
                                <p className="text-xs text-slate-400">Deep copy existing applications to create new templates.</p>
                            </Link>


                            {/* Access Map Card */}
                            <Link href="/visualizer" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors">
                                        <Share2 className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Access Lineage Map</h3>
                                </div>
                                <p className="text-xs text-slate-400">Visualize identity entitlements and roles in an interactive graph.</p>
                            </Link>

                            {/* Request Repair Card */}
                            <Link href="/request-maintenance" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-colors">
                                        <Wrench className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Request Repair</h3>
                                </div>
                                <p className="text-xs text-slate-400">Diagnose and fix stuck IdentityIQ requests and workflows.</p>
                            </Link>

                            {/* Firefighter Card */}
                            <Link href="/firefighter" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20 group-hover:text-red-300 transition-colors">
                                        <Flame className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Firefighter Access</h3>
                                </div>
                                <p className="text-xs text-slate-400">Emergency "Break-Glass" access provisioning with auto-expiry.</p>
                            </Link>

                            {/* Certification Report Card */}
                            <Link href="/certification-report" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 group-hover:text-violet-300 transition-colors">
                                        <ClipboardCheck className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Cert Impact Report</h3>
                                </div>
                                <p className="text-xs text-slate-400">Analyze "Before vs After" outcomes of Access Certifications.</p>
                            </Link>

                            {/* Product Customizer Card */}
                            <Link href="/product-customization" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 group-hover:text-pink-300 transition-colors">
                                        <Paintbrush className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">Product Customizer</h3>
                                </div>
                                <p className="text-xs text-slate-400">Customize the look and feel of your SailSetu instance.</p>
                            </Link>

                            {/* WhatsApp Integration Card */}
                            <Link href="/whatsapp" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500/20 group-hover:text-green-300 transition-colors">
                                        <Smartphone className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">WhatsApp Integration</h3>
                                </div>
                                <p className="text-xs text-slate-400">Control SailSetu directly from WhatsApp.</p>
                            </Link>

                            {/* AI Report Assistant Card */}
                            <Link href="/ai-reports" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900 transition-all hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                                        <Bot className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-semibold text-slate-200">AI Report Assistant</h3>
                                </div>
                                <p className="text-xs text-slate-400">Natural language queries to generate SailPoint reports with AI.</p>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
