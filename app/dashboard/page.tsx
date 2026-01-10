"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, User, Mail, Briefcase, UserCheck, XCircle, GitCompare, GitBranch, Plus, FileText, Hammer, Terminal } from "lucide-react";

export default function Dashboard() {
    const { url, username, password, isAuthenticated } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Protected Route Check
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/");
        }
    }, [isAuthenticated, router]);

    // Fetch Data
    useEffect(() => {
        if (isAuthenticated && url) {
            fetch("/api/me", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, username, password }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        setProfile(data.user);
                    } else {
                        setError(data.error || "Unknown error occurred");
                    }
                })
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [isAuthenticated, url, username, password]);

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

                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                ) : error ? (
                    <div className="p-8 text-center border border-red-500/20 rounded-xl bg-red-500/5">
                        <div className="inline-flex items-center justify-center p-4 rounded-full bg-red-500/10 mb-4">
                            <XCircle className="h-8 w-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Profile Load Failed</h3>
                        <p className="text-slate-400 max-w-md mx-auto">{error}</p>
                        <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm transition-colors">
                            Retry
                        </button>
                    </div>
                ) : profile ? (
                    <div className="space-y-8">
                        {/* Tools Section */}
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-blue-400" />
                                Tools & Utilities
                            </h2>
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {/* Compare Tool Card */}
                                <Link href="/compare" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:bg-slate-900 transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                                            <GitCompare className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-semibold text-slate-200">Compare & Provision</h3>
                                    </div>
                                    <p className="text-sm text-slate-400">Compare access between identities and provision missing entitlements.</p>
                                </Link>

                                {/* Workflow Tool Card */}
                                <Link href="/workflow-access" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:bg-slate-900 transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors">
                                            <GitBranch className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-semibold text-slate-200">Workflow Manager</h3>
                                    </div>
                                    <p className="text-sm text-slate-400">Launch and monitor SCIM workflows and tasks.</p>
                                </Link>

                                {/* Batch Request Card */}
                                <Link href="/batch" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:bg-slate-900 transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-semibold text-slate-200">Batch Provisioning</h3>
                                    </div>
                                    <p className="text-sm text-slate-400">Upload CSV to bulk provision access. Support for standard LCM.</p>
                                </Link>

                                {/* Workgroups Card */}
                                <Link href="/workgroup" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:bg-slate-900 transition-all hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="p-3 rounded-lg bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 group-hover:text-orange-300 transition-colors">
                                            <Hammer className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-semibold text-slate-200">Workgroup Manager</h3>
                                    </div>
                                    <p className="text-sm text-slate-400">Create and manage Workgroups, assign capabilities, and bulk import.</p>
                                </Link>

                                {/* Rule Runner Card */}
                                <Link href="/rule-runner" className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:bg-slate-900 transition-all hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/10">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="p-3 rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 group-hover:text-pink-300 transition-colors">
                                            <Terminal className="h-6 w-6" />
                                        </div>
                                        <h3 className="font-semibold text-slate-200">Rule Runner</h3>
                                    </div>
                                    <p className="text-sm text-slate-400">Interactive sandbox to execute BeanShell rules and debug logic.</p>
                                </Link>

                                {/* Placeholder for future tools */}
                                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-6 flex flex-col items-center justify-center text-center">
                                    <div className="p-3 rounded-lg bg-slate-800/50 text-slate-600 mb-3">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-semibold text-slate-500">More Coming Soon</h3>
                                </div>
                            </div>
                        </div>

                        {/* Profile Section */}
                        <div>
                            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                <User className="h-5 w-5 text-emerald-400" />
                                User Profile
                            </h2>
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Main Profile Card */}
                                <div className="col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-8">
                                    <div className="flex items-start gap-6">
                                        <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                            <User className="h-10 w-10 text-slate-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <h2 className="text-2xl font-bold text-white">{profile.displayName || profile.userName}</h2>
                                            <div className="flex items-center gap-3 text-slate-400">
                                                <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded text-xs font-mono border border-slate-800">
                                                    <UserCheck className="h-3 w-3" />
                                                    {profile.userName}
                                                </div>
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${profile.active ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20' : 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20'}`}>
                                                    {profile.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Contact Information</h3>
                                    <div className="space-y-3">
                                        {profile.emails?.map((e: any, i: number) => (
                                            <div key={i} className="flex justify-between text-sm group">
                                                <span className="text-slate-500">{e.type || 'Email'}</span>
                                                <span className="text-slate-200 font-mono">{e.value}</span>
                                            </div>
                                        ))}
                                        {!profile.emails && <p className="text-sm text-slate-500">No email found</p>}
                                    </div>
                                </div>

                                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Organization</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Department</span>
                                            <span className="text-slate-200">{profile['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User']?.department || '-'}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Manager</span>
                                            <span className="text-slate-200">{profile['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User']?.manager?.displayName || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </main>
    );
}
