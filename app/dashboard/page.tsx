"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, User, Mail, Briefcase, UserCheck, XCircle, GitCompare, GitBranch, Plus, FileText, Hammer, Terminal } from "lucide-react";

export default function Dashboard() {
    const { url, isAuthenticated } = useAuth();
    const router = useRouter();

    // Protected Route Check
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/");
        }
    }, [isAuthenticated, router]);

    if (!isAuthenticated) return null;

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
                        <p className="text-slate-400 mt-1">Manage your identity access and workflows</p>
                    </div>
                    <div className="text-sm text-slate-500 font-mono px-3 py-1 bg-slate-900 rounded-full border border-slate-800">{url}</div>
                </div>

                <div className="space-y-8">
                    {/* Tools Section */}
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-blue-400" />
                            Tools & Utilities
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

                            {/* Placeholder for future tools */}
                            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-4 flex flex-col items-center justify-center text-center">
                                <div className="p-2 rounded-lg bg-slate-800/50 text-slate-600 mb-2">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-500">More Coming Soon</h3>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
