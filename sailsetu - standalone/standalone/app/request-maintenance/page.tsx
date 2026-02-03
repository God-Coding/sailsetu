"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { useRouter } from "next/navigation";
import { Wrench, Play, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function RequestMaintenance() {
    const { url, username, password, isAuthenticated } = useAuth();
    const router = useRouter();

    // Inputs
    const [requestId, setRequestId] = useState("");

    // State
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<any[]>([]);

    // Authentication Check
    useEffect(() => {
        if (!isAuthenticated) router.push("/");
    }, [isAuthenticated, router]);

    const runMaintenance = async () => {
        if (!requestId) return;

        setLoading(true);
        setLogs([]);
        setResults([]);

        const inputList = [
            { key: "requestId", value: requestId }
        ];

        try {
            setLogs(prev => [`Launching maintenance for Request #${requestId}...`, ...prev]);

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url, username, password,
                    workflowName: "RepairIdentityRequest", // New custom workflow
                    input: inputList
                }),
            });

            const data = await res.json();

            if (data.success) {
                setLogs(prev => ["Workflow completed.", ...prev]);

                // Parse attributes if any specific returns
                if (data.launchResult && data.launchResult.attributes) {
                    const outputLog = data.launchResult.attributes.find((a: any) => a.key === "maintenanceLog");
                    if (outputLog && outputLog.value) {
                        // Split log lines
                        const lines = outputLog.value.split("\n");
                        setLogs(prev => [...lines.reverse(), ...prev]);
                    }
                }
            } else {
                setLogs(prev => [`Error: ${data.error || "Workflow failed"}`, ...prev]);
            }

        } catch (e: any) {
            setLogs(prev => [`Exception: ${e.message}`, ...prev]);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) return null;

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-slate-100 font-sans selection:bg-indigo-500/30">
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />

            <div className="max-w-5xl mx-auto relative z-10">
                <div className="mb-8 border-b border-white/5 pb-6">
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-3">
                        <Wrench className="h-8 w-8 text-emerald-400" />
                        Request Maintenance (ID Scope)
                    </h1>
                    <p className="text-slate-400 text-sm mt-2">
                        Targeted repair for specific Access Requests. Enter the Request ID (e.g., '00000002') to inspect and repair.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Control Panel */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Access Request ID</label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                placeholder="e.g. 0000002"
                                value={requestId}
                                onChange={(e) => setRequestId(e.target.value)}
                            />

                            <button
                                onClick={runMaintenance}
                                disabled={loading || !requestId}
                                className="w-full mt-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                                Inspect & Repair
                            </button>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-300">
                            <h4 className="font-bold flex items-center gap-2 mb-2">
                                <RefreshCw className="h-4 w-4" />
                                What this does:
                            </h4>
                            <ul className="list-disc pl-4 space-y-1 opacity-80">
                                <li>Scans active Identity Requests for the user.</li>
                                <li>Checks underlying Provisioning Projects.</li>
                                <li>Attempts to advance stuck workflows.</li>
                                <li>Terminates hung requests if applicable.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Output Console */}
                    <div className="md:col-span-2">
                        <div className="bg-black/40 border border-white/10 rounded-2xl flex flex-col h-[500px]">
                            <div className="p-4 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <TerminalIcon className="h-4 w-4 text-slate-400" />
                                    Execution Logs
                                </h3>
                                {loading && <span className="text-xs text-emerald-400 animate-pulse">Running analysis...</span>}
                            </div>
                            <div className="flex-1 overflow-auto p-4 space-y-2 font-mono text-xs custom-scrollbar">
                                {logs.length === 0 && (
                                    <div className="text-slate-600 italic text-center mt-20">
                                        Ready to inspect. Enter an identity to begin.
                                    </div>
                                )}
                                {logs.map((log, i) => (
                                    <div key={i} className={`p-2 rounded border-l-2 ${log.toLowerCase().includes("error") || log.toLowerCase().includes("exception")
                                        ? "border-rose-500 bg-rose-500/5 text-rose-300"
                                        : log.toLowerCase().includes("success") || log.toLowerCase().includes("fixed")
                                            ? "border-emerald-500 bg-emerald-500/5 text-emerald-300"
                                            : "border-slate-700 text-slate-300"
                                        }`}>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

function TerminalIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11" />
            <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
    );
}
