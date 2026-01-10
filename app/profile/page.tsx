"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";
import { Loader2, User, UserCheck, XCircle } from "lucide-react";

export default function Profile() {
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
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Your Profile</h1>
                        <p className="text-slate-400 mt-1">Manage your identity information</p>
                    </div>
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
                    <div className="space-y-6">
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

                        <div className="grid gap-6 md:grid-cols-2">
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
                ) : null}
            </div>
        </main>
    );
}
