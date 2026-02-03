"use client";

import { useState } from "react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { useRouter } from "next/navigation";
import {
    FileText, Search, Loader2, CheckCircle,
    XCircle, AlertCircle, Calendar, User, Shield, Download
} from "lucide-react";

export default function CertificationReportPage() {
    const { isAuthenticated, url, username, password, isLoading } = useAuth();
    const router = useRouter();

    // State
    const [inputNames, setInputNames] = useState("");
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    if (isLoading) return null;
    if (!isAuthenticated) {
        router.push("/");
        return null;
    }

    const generateReport = async () => {
        const names = inputNames.split('\n').map(s => s.trim()).filter(Boolean);
        if (names.length === 0) return;

        setLoading(true);
        setReports([]);
        setProgress({ current: 0, total: names.length });

        const results = [];

        for (let i = 0; i < names.length; i++) {
            const identityName = names[i];

            try {
                const res = await fetch("/api/workflow/launch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        url, username, password,
                        workflowName: "GetCertificationReport",
                        input: [{ key: "identityName", value: identityName }]
                    }),
                });

                const data = await res.json();

                if (data.success) {
                    let outputAttr = null;

                    // 1. Check TaskResult Attributes (Most reliable for synchronous tasks)
                    if (data.launchResult?.attributes) {
                        outputAttr = data.launchResult.attributes.find((o: any) => o.key === "reportData");
                    }

                    // 2. Check LaunchedWorkflow Schema Output
                    if (!outputAttr && data.launchResult?.["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow"]?.output) {
                        outputAttr = data.launchResult["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow"].output.find((o: any) => o.key === "reportData");
                    }

                    // 3. Check Top-Level Output (Fallback)
                    if (!outputAttr && data.launchResult?.output) {
                        outputAttr = data.launchResult.output.find((o: any) => o.key === "reportData");
                    }

                    if (outputAttr && outputAttr.value) {
                        try {
                            const parsed = JSON.parse(outputAttr.value);
                            results.push({
                                identity: identityName,
                                found: parsed.length > 0,
                                data: parsed.length > 0 ? parsed[0] : null
                            });
                        } catch (e) {
                            results.push({ identity: identityName, error: "Failed to parse JSON" });
                        }
                    } else {
                        results.push({ identity: identityName, error: "No report data returned" });
                    }
                } else {
                    results.push({ identity: identityName, error: data.error || "Workflow failed" });
                }

            } catch (err: any) {
                results.push({ identity: identityName, error: err.message });
            }

            setProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setReports(results);
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto p-6 relative z-10">
                <div className="mb-8 border-b border-white/5 pb-6">
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
                        <FileText className="h-8 w-8 text-indigo-400" />
                        Certification Impact Report
                    </h1>
                    <p className="text-slate-400 text-sm mt-2">
                        Analyze "Before vs. After" states of identity access reviews.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
                    {/* Input Panel */}
                    <div className="space-y-4">
                        <div className="bg-slate-900/40 border border-white/10 p-6 rounded-2xl shadow-xl">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Identities (One per line)</label>
                            <textarea
                                value={inputNames}
                                onChange={(e) => setInputNames(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 min-h-[300px] font-mono text-sm"
                                placeholder="Aaron.Nichols&#10;James.Smith&#10;..."
                            />
                            <div className="mt-4">
                                <button
                                    onClick={generateReport}
                                    disabled={loading || !inputNames.trim()}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                    {loading ? "Analyzing..." : "Generate Report"}
                                </button>
                            </div>

                            {loading && (
                                <div className="mt-4 text-center text-xs text-slate-400">
                                    Processed {progress.current} of {progress.total}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Report Output */}
                    <div className="space-y-6">
                        {reports.length === 0 && !loading && (
                            <div className="h-full flex flex-col items-center justify-center bg-slate-900/20 border border-white/5 rounded-2xl p-12 text-slate-500">
                                <FileText className="h-16 w-16 mb-4 opacity-20" />
                                <p>Enter identities and generate a report to see details.</p>
                            </div>
                        )}

                        {reports.map((r, i) => (
                            <div key={i} className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                {/* Identity Header */}
                                <div className="bg-slate-950/50 p-4 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{r.identity}</h3>
                                            {r.data && <p className="text-xs text-slate-400">{r.data.certName}</p>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {r.found ? (
                                            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-500/20">
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Review Found</span>
                                            </div>
                                        ) : r.error ? (
                                            <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-950/30 px-3 py-1 rounded-full border border-rose-500/20">
                                                <XCircle className="h-4 w-4" />
                                                <span>{r.error}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-950/30 px-3 py-1 rounded-full border border-amber-500/20">
                                                <AlertCircle className="h-4 w-4" />
                                                <span>No Review History</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Certification Details */}
                                {r.found && r.data && (
                                    <ReportCard report={r} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}

function ReportCard({ report }: { report: any }) {
    const [activeTab, setActiveTab] = useState("Summary");

    if (!report.found || !report.data) return null;

    const items = report.data.items || [];

    // Derived Lists
    const beforeList = items.filter((i: any) => i.before === "Present");
    const afterList = items.filter((i: any) => !i.after.includes("Revoked"));
    const removedList = items.filter((i: any) => i.after.includes("Revoked"));
    const approvedList = items.filter((i: any) => i.decision === "Approved");

    const downloadCSV = () => {
        if (!report.found || !report.data || !report.data.items) return;

        const headers = ["Identity", "Access Item", "Type", "Decision", "Actor", "Before State", "After State"];
        const rows = report.data.items.map((item: any) => [
            report.identity,
            item.name,
            item.type,
            item.decision,
            item.actor,
            item.before,
            item.after
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row: any[]) => row.map(field => `"${String(field || "").replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Certification_Report_${report.identity}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-0">
            {/* Tabs Header */}
            <div className="flex items-center justify-between p-2 border-b border-white/5 bg-slate-900/50">
                <div className="flex items-center gap-1 overflow-x-auto">
                    {["Summary", "Before Access", "After Access", "Removed", "Approved"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab
                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                                }`}
                        >
                            {tab}
                            {tab === "Before Access" && <span className="ml-2 opacity-50">{beforeList.length}</span>}
                            {tab === "After Access" && <span className="ml-2 opacity-50">{afterList.length}</span>}
                            {tab === "Removed" && <span className="ml-2 opacity-50">{removedList.length}</span>}
                            {tab === "Approved" && <span className="ml-2 opacity-50">{approvedList.length}</span>}
                        </button>
                    ))}
                </div>
                <button
                    onClick={downloadCSV}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-2"
                    title="Download CSV"
                >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">CSV</span>
                </button>
            </div>

            {/* Tab Content */}
            <div className="p-0">
                {activeTab === "Summary" && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-slate-200 mb-1">{beforeList.length}</span>
                            <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Pre-Cert</span>
                        </div>
                        <div className="bg-emerald-950/10 p-4 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-emerald-400 mb-1">{afterList.length}</span>
                            <span className="text-xs text-emerald-500/60 uppercase font-bold tracking-widest">Post-Cert</span>
                        </div>
                        <div className="bg-rose-950/10 p-4 rounded-xl border border-rose-500/20 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-rose-400 mb-1">{removedList.length}</span>
                            <span className="text-xs text-rose-500/60 uppercase font-bold tracking-widest">Revoked</span>
                        </div>
                        <div className="bg-indigo-950/10 p-4 rounded-xl border border-indigo-500/20 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-bold text-indigo-400 mb-1">{approvedList.length}</span>
                            <span className="text-xs text-indigo-500/60 uppercase font-bold tracking-widest">Approved</span>
                        </div>
                    </div>
                )}

                {activeTab !== "Summary" && (
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-950 text-xs uppercase font-medium text-slate-500 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Access Item</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Review Outcome</th>
                                    <th className="px-6 py-3">Reviewer</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {(activeTab === "Before Access" ? beforeList :
                                    activeTab === "After Access" ? afterList :
                                        activeTab === "Removed" ? removedList : approvedList
                                ).map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-3 font-medium text-slate-300 group-hover:text-white transition-colors">
                                            {item.name}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase border ${item.type === 'Role' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                }`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            {item.after.includes("Revoked") ? (
                                                <span className="text-rose-400 inline-flex items-center gap-1.5 bg-rose-950/20 px-2 py-0.5 rounded text-xs border border-rose-500/20">
                                                    <XCircle className="h-3 w-3" /> Revoked
                                                </span>
                                            ) : item.decision === "Approved" ? (
                                                <span className="text-emerald-400 inline-flex items-center gap-1.5 bg-emerald-950/20 px-2 py-0.5 rounded text-xs border border-emerald-500/20">
                                                    <CheckCircle className="h-3 w-3" /> Approved
                                                </span>
                                            ) : (
                                                <span className="text-slate-500 text-xs italic">Retained (No Action)</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-xs font-mono text-slate-500">
                                            {item.actor !== "Pending" && item.actor !== "N/A" ? item.actor : "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {(activeTab === "Before Access" ? beforeList :
                            activeTab === "After Access" ? afterList :
                                activeTab === "Removed" ? removedList : approvedList
                        ).length === 0 && (
                                <div className="p-8 text-center text-slate-500 text-sm italic">
                                    No items found in this category.
                                </div>
                            )}
                    </div>
                )}
            </div>
        </div>
    );
}
