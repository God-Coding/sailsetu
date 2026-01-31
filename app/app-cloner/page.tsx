"use client";

import React, { useState, useEffect } from "react";
import { Copy, Loader2, Search, CheckCircle, AlertOctagon, ArrowRight } from "lucide-react";

export default function AppCloner() {
    const [apps, setApps] = useState<any[]>([]);
    const [loadingApps, setLoadingApps] = useState(true);
    const [sourceApp, setSourceApp] = useState("");
    const [newAppName, setNewAppName] = useState("");
    const [cloning, setCloning] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    useEffect(() => {
        console.log("UI: Fetching app list from /api/app/list...");
        fetch("/api/app/list")
            .then(res => {
                console.log("UI: Response status:", res.status);
                return res.json();
            })
            .then(data => {
                console.log("UI: Data received:", data);
                if (Array.isArray(data)) {
                    setApps(data);
                } else {
                    console.error("UI: Expected array, got:", data);
                }
                setLoadingApps(false);
            })
            .catch(err => {
                console.error("UI: Fetch Error:", err);
                setLoadingApps(false);
            });
    }, []);

    const handleClone = async () => {
        if (!sourceApp || !newAppName) return;

        setCloning(true);
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch("/api/app/clone", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceAppName: sourceApp,
                    newAppName: newAppName
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Check workflow message if available, or assume generic success
                // Usually the workflow logic inside the route returns simple success for this demo
                setStatus({ type: "success", message: `Successfully cloned '${sourceApp}' to '${newAppName}'.` });
                setNewAppName(""); // Reset input
            } else {
                setStatus({ type: "error", message: data.error || "Failed to clone application." });
            }
        } catch (e: any) {
            setStatus({ type: "error", message: e.message || "An unexpected error occurred." });
        } finally {
            setCloning(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 font-sans flex items-center justify-center p-4">
            <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-cyan-950/20 to-transparent pointer-events-none" />

            <div className="w-full max-w-2xl bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative z-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 bg-cyan-500/10 rounded-2xl text-cyan-400">
                        <Copy className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
                            Application Cloner
                        </h1>
                        <p className="text-slate-400">Deep copy existing applications to create new templates.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Source Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Source Application</label>
                        <div className="relative">
                            <select
                                value={sourceApp}
                                onChange={(e) => setSourceApp(e.target.value)}
                                disabled={loadingApps}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-cyan-500 outline-none appearance-none disabled:opacity-50"
                            >
                                <option value="">-- Select Application Template --</option>
                                {apps.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                            </select>
                            {loadingApps && <Loader2 className="absolute right-4 top-4 h-5 w-5 animate-spin text-cyan-500" />}
                        </div>
                    </div>

                    {/* Arrow Divider */}
                    <div className="flex justify-center">
                        <ArrowRight className="h-6 w-6 text-slate-600 rotate-90 md:rotate-0" />
                    </div>

                    {/* Target Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">New Application Name</label>
                        <input
                            type="text"
                            value={newAppName}
                            onChange={(e) => setNewAppName(e.target.value)}
                            placeholder="e.g. Active Directory - Corp (Clone)"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-cyan-500 outline-none placeholder:text-slate-600"
                        />
                        <p className="text-xs text-slate-500 mt-2">New name must be unique.</p>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleClone}
                        disabled={cloning || !sourceApp || !newAppName}
                        className="w-full py-4 mt-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cloning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />}
                        {cloning ? "Cloning Application..." : "Clone Application"}
                    </button>

                    {/* Feedback Status */}
                    {status.message && (
                        <div className={`p-4 rounded-xl flex items-start gap-3 border ${status.type === "success"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            }`}>
                            {status.type === "success" ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" /> : <AlertOctagon className="h-5 w-5 shrink-0 mt-0.5" />}
                            <div>
                                <p className="font-bold text-sm">{status.type === "success" ? "Success!" : "Error"}</p>
                                <p className="text-sm opacity-90">{status.message}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
