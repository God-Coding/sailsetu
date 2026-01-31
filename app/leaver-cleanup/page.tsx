"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";
import { BarChart3, FileDown, Search, Filter, RefreshCw, Upload, FileText, CheckCircle, AlertCircle, Trash2, ArrowRight, ShieldCheck, Loader2, Users, UserX, Info } from "lucide-react";

interface LeaverReport {
    identityName: string;
    inactive: boolean;
    appCount: number;
    entitlementCount: number;
    applications: string[];
    accessItems?: any[];
}

export default function LeaverCleanupPage() {
    const { isAuthenticated, url, username, password, isLoading } = useAuth();
    const router = useRouter();

    const [mode, setMode] = useState<"auto" | "manual">("auto");
    const [apps, setApps] = useState<any[]>([]);
    const [attrs, setAttrs] = useState<string[]>([]);
    const [selectedApp, setSelectedApp] = useState("");
    const [config, setConfig] = useState({ mode: "auto", inactivityAttribute: "lastLogin", authoritativeSource: "" });
    const [selectedAttr, setSelectedAttr] = useState("inactive");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvPreview, setCsvPreview] = useState<string[]>([]);

    const [analyzing, setAnalyzing] = useState(false);
    const [report, setReport] = useState<any[] | null>(null);

    // Revocation State
    const [revoking, setRevoking] = useState(false);
    const [createWorkitems, setCreateWorkitems] = useState(false);
    const [revokeProgress, setRevokeProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
    const [logs, setLogs] = useState<string[]>([]);

    const processRevocation = async () => {
        setRevoking(true);
        setLogs([]);

        // Flatten items to process
        const itemsToProcess: any[] = [];
        report?.forEach(r => {
            r.accessItems?.forEach((item: any) => {
                // Map to ProvisionAccess format
                if (item.type === "Entitlement") {
                    itemsToProcess.push({
                        identity: r.identityName,
                        type: "entitlement",
                        application: item.application,
                        name: item.attribute || "unknown",
                        value: item.value,
                        op: "Remove"
                    });
                } else if (item.type === "Role" || item.type === "Bundle") {
                    itemsToProcess.push({
                        identity: r.identityName,
                        type: "role",
                        name: "assignedRoles",
                        value: item.value,
                        op: "Remove"
                    });
                }
            });
        });

        const total = itemsToProcess.length;
        if (total === 0) {
            setLogs(["No entitlements or roles found to revoke."]);
            setRevoking(false);
            return;
        }

        setRevokeProgress({ current: 0, total, success: 0, fail: 0 });

        // Group by Identity
        const groupedMap = new Map();
        itemsToProcess.forEach(row => {
            if (!groupedMap.has(row.identity)) {
                groupedMap.set(row.identity, []);
            }
            groupedMap.get(row.identity).push(row);
        });

        const groups = Array.from(groupedMap.entries());
        let processedCount = 0;
        let successCount = 0;
        let failCount = 0;
        let groupIndex = 0;
        const CONCURRENCY_LIMIT = 3;

        const processGroup = async (identityName: string, items: any[]) => {
            // Construct input list
            const accessItems = items.map((item: any) => ({
                type: item.type,
                application: item.application,
                name: item.name,
                value: item.value,
                op: item.op
            }));

            const inputList = [
                { key: "identityName", value: identityName },
                { key: "accessItems", value: JSON.stringify(accessItems) },
            ];

            if (!createWorkitems) {
                inputList.push({ key: "approvalScheme", value: "none" });
            }

            try {
                const res = await fetch("/api/workflow/launch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        url, username, password,
                        workflowName: "ProvisionAccess",
                        input: inputList
                    }),
                });
                const data = await res.json();

                if (data.success) {
                    successCount += items.length;

                    // Extract Request ID
                    let reqId = "N/A";
                    if (data.launchResult && data.launchResult.attributes) {
                        const attrs = data.launchResult.attributes;
                        const idAttr = attrs.find((a: any) => a.key === "identityRequestId");
                        if (idAttr) {
                            reqId = idAttr.value;
                        } else {
                            const planAttr = attrs.find((a: any) => a.key === "plan");
                            if (planAttr && planAttr.value) {
                                const match = planAttr.value.match(/key="identityRequestId" value="([^"]+)"/);
                                if (match && match[1]) reqId = match[1];
                            }
                        }
                    }

                    setLogs(prev => [`[SUCCESS] ${identityName}: Revoked ${items.length} items. Request ID: ${reqId}`, ...prev].slice(0, 50));
                } else {
                    throw new Error(data.error || "Unknown error");
                }
            } catch (e: any) {
                failCount += items.length;
                setLogs(prev => [`[ERROR] ${identityName}: ${e.message}`, ...prev].slice(0, 50));
            }

            processedCount += items.length;
            setRevokeProgress(prev => ({ ...prev, current: processedCount, success: successCount, fail: failCount }));
        };

        const worker = async () => {
            while (groupIndex < groups.length) {
                const idx = groupIndex++;
                if (idx >= groups.length) break;
                const [identity, items] = groups[idx];
                await processGroup(identity, items);
            }
        };

        const workers = Array(Math.min(CONCURRENCY_LIMIT, groups.length)).fill(null).map(() => worker());
        await Promise.all(workers);

        setRevoking(false);
        setLogs(prev => ["[DONE] Batch revocation complete.", ...prev]);
    };

    // Fetch apps & attrs on load
    useEffect(() => {
        if (!isAuthenticated) return;
        const initData = async () => {
            try {
                // Apps
                const resApps = await fetch("/api/leaver/search", {
                    method: "POST",
                    body: JSON.stringify({ url, username, password })
                });
                const dataApps = await resApps.json();
                if (dataApps.success) setApps(dataApps.apps || []);

                // Attrs
                const resAttrs = await fetch("/api/leaver/attributes", {
                    method: "POST",
                    body: JSON.stringify({ url, username, password })
                });
                const dataAttrs = await resAttrs.json();
                if (dataAttrs.success) setAttrs(dataAttrs.attributes || []);

            } catch (e) { console.error(e); }
        };
        initData();
    }, [isAuthenticated]);

    if (isLoading) return null;
    if (!isAuthenticated) { router.push("/"); return null; }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            // simple csv parse, assume first col is name or header
            const names = lines.map(l => l.split(",")[0].trim()).filter(n => n.toLowerCase() !== "identityname");
            setCsvPreview(names);
        };
        reader.readAsText(file);
    };

    const runAnalysis = async () => {
        setAnalyzing(true);
        setReport([]);


        try {
            const payload: any = {
                url, username, password,
                mode: mode === "auto" ? "scan" : "csv",
                inactiveAttr: selectedAttr
            };
            if (mode === "auto") {
                payload.source = selectedApp;
            } else {
                payload.identityList = csvPreview;
            }

            const res = await fetch("/api/leaver/analyze", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setReport(data.report || []);
            } else {
                alert("Analysis failed: " + data.error);
            }
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setAnalyzing(false);
        }
    };

    const confirmRevocation = async () => {
        if (!confirm("Are you sure you want to revoke access for ALL displayed users? This action creates provisioning requests.")) return;

        setRevoking(true);
        // We reuse the batch logic endpoint or similar. 
        // Logic: For each user in report, launch ProvisionAccess with op="Remove" for all their accessItems.
        // We can do this client-side loop or send to a bulk endpoint.
        // Let's do client-side loop for progress feedback as per Batch Page.

        // 1. Group items by identity
        let successCount = 0;
        let failCount = 0;

        for (const user of (report || [])) {
            if (user.accessItems && user.accessItems.length > 0) {
                try {
                    const inputList = [
                        { key: "identityName", value: user.identityName },
                        { key: "accessItems", value: JSON.stringify(user.accessItems) }, // These items already have op="Remove" from the Analysis workflow
                        { key: "approvalScheme", value: "none" }
                    ];

                    const res = await fetch("/api/workflow/launch", {
                        method: "POST",
                        body: JSON.stringify({ url, username, password, workflowName: "ProvisionAccess", input: inputList })
                    });
                    const d = await res.json();
                    if (d.success) successCount++; else failCount++;

                } catch (e) { failCount++; }
            }
        }

        setRevoking(false);
        alert(`Revocation Complete. Success: ${successCount}, Failed: ${failCount}`);
    };

    // Metrics
    const totalUsers = report ? report.length : 0;
    const totalEntitlements = report ? report.reduce((acc, r) => acc + (r.accessCount || 0), 0) : 0;
    const highRisk = report ? report.filter(r => r.riskLevel === "High").length : 0;

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 font-sans">
            <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-cyan-950/20 to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto p-8 relative z-10">
                <div className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
                            <ShieldCheck className="h-10 w-10 text-cyan-500" />
                            Leaver Access Cleanup
                        </h1>
                        <p className="text-slate-400 mt-2 text-lg">Identify and revoke residual access for inactive identities.</p>
                    </div>
                </div>

                {/* Configuration Panel */}
                <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-xl">
                    <div className="flex gap-4 border-b border-white/10 pb-4 mb-6">
                        <button
                            onClick={() => setMode("auto")}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === "auto" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}
                        >
                            Option A: Automated Fetch
                        </button>
                        <button
                            onClick={() => setMode("manual")}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === "manual" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}
                        >
                            Option B: Manual CSV
                        </button>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        {mode === "auto" ? (
                            <div className="flex-1 space-y-4 w-full">
                                <label className="block text-sm font-medium text-slate-300">Configuration</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Authoritative Source (Ignore access)</p>
                                        <select
                                            value={selectedApp}
                                            onChange={(e) => setSelectedApp(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                        >
                                            <option value="">-- Select Source --</option>
                                            {apps.map(a => <option key={a.id} value={a.name}>{a.name} {a.authoritative ? "(Auth)" : ""}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Inactivity Attribute</p>
                                        <select
                                            value={selectedAttr}
                                            onChange={(e) => setSelectedAttr(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                        >
                                            <option value="inactive">inactive (Default)</option>
                                            {attrs.filter(a => a !== "inactive").map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500">System will scan for users where <code>{selectedAttr}</code> is true/active.</p>
                            </div>
                        ) : (
                            <div className="flex-1 space-y-4 w-full">
                                <label className="block text-sm font-medium text-slate-300">Configuration</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Authoritative Source (Ignore access)</p>
                                        <select
                                            value={selectedApp}
                                            onChange={(e) => setSelectedApp(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                        >
                                            <option value="">-- No Filtering (Show All) --</option>
                                            {apps.map(a => <option key={a.id} value={a.name}>{a.name} {a.authoritative ? "(Auth)" : ""}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Inactivity Attribute</p>
                                        <select
                                            value={selectedAttr}
                                            onChange={(e) => setSelectedAttr(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                                        >
                                            <option value="inactive">inactive (Default)</option>
                                            {attrs.filter(a => a !== "inactive").map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <label className="block w-full border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
                                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                                    <Upload className="h-8 w-8 text-cyan-500 mx-auto mb-2" />
                                    <span className="text-slate-300 font-medium">Click to Upload CSV</span>
                                    <span className="block text-xs text-slate-500 mt-1">{csvFile ? csvFile.name : "Drag & Drop Identity List"}</span>
                                </label>
                                {csvPreview.length > 0 && <p className="text-xs text-emerald-400">{csvPreview.length} identities loaded.</p>}
                            </div>
                        )}

                        <button
                            onClick={runAnalysis}
                            disabled={analyzing || (mode === "auto" && !selectedApp) || (mode === "manual" && !csvFile)}
                            className="h-[80px] px-8 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 min-w-[200px]"
                        >
                            {analyzing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Search className="h-6 w-6" />}
                            <span>{analyzing ? "Analyzing..." : "Scan & Analyze"}</span>
                        </button>
                    </div>
                </div>

                {/* Report Area */}
                {report && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        {/* Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-900/60 border border-white/5 p-6 rounded-2xl flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-full text-blue-400"><Users className="h-6 w-6" /></div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase tracking-wider">Identities Found</p>
                                    <p className="text-2xl font-bold text-white">{totalUsers}</p>
                                </div>
                            </div>
                            <div className="bg-slate-900/60 border border-white/5 p-6 rounded-2xl flex items-center gap-4">
                                <div className="p-3 bg-purple-500/10 rounded-full text-purple-400"><FileText className="h-6 w-6" /></div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase tracking-wider">Items to Revoke</p>
                                    <p className="text-2xl font-bold text-white">{totalEntitlements}</p>
                                </div>
                            </div>
                            <div className="bg-slate-900/60 border border-white/5 p-6 rounded-2xl flex items-center gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-full text-amber-400"><Info className="h-6 w-6" /></div>
                                <div>
                                    <p className="text-slate-400 text-xs uppercase tracking-wider">High Risk</p>
                                    <p className="text-2xl font-bold text-white">{highRisk}</p>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden">
                            <div className="p-4 bg-white/5 flex justify-between items-center">
                                <h3 className="font-bold text-lg">Candidates for Revocation</h3>
                                <span className="text-xs text-slate-400">Review carefully before executing</span>
                            </div>
                            <div className="overflow-auto max-h-[500px]">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-slate-950 text-xs uppercase font-medium text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="px-6 py-4">UserName</th>
                                            <th className="px-6 py-4">Inactive</th>
                                            <th className="px-6 py-4">Applications</th>
                                            <th className="px-6 py-4">Entitlements still has access to</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {report.map((r, i) => {
                                            // Extract unique apps and format items
                                            const uniqueApps = Array.from(new Set(r.accessItems?.map((item: any) => item.application) || [])).filter(Boolean);

                                            return (
                                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-6 py-3 font-medium text-white align-top">
                                                        {r.identityName}
                                                        {r.employeeId && <span className="block text-xs text-slate-600 font-normal">ID: {r.employeeId}</span>}
                                                    </td>
                                                    <td className="px-6 py-3 align-top">
                                                        <span className="px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 font-mono">
                                                            true
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 align-top">
                                                        <div className="flex flex-wrap gap-1">
                                                            {uniqueApps.length > 0 ? uniqueApps.map((app: any, idx) => (
                                                                <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs text-white">
                                                                    {app}
                                                                </span>
                                                            )) : <span className="text-slate-600">-</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 align-top">
                                                        <div className="space-y-1 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
                                                            {r.accessItems && r.accessItems.length > 0 ? r.accessItems.map((item: any, idx: number) => (
                                                                <div key={idx} className="text-xs text-slate-300">
                                                                    {item.name || item.value} <span className="text-slate-600">({item.application})</span>
                                                                </div>
                                                            )) : <span className="text-slate-600">No residual access found</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Action Area */}
                        {/* Action Area - CSV Downloads */}
                        <div className="flex flex-col md:flex-row justify-between p-6 bg-slate-900/60 rounded-2xl border border-white/10 items-center gap-6">
                            <div className="text-left w-full md:w-auto">
                                <p className="text-white font-bold text-lg">Download Revocation Files</p>
                                <p className="text-slate-400 text-sm">Generate CSVs for bulk processing.</p>
                            </div>
                            <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
                                <button
                                    onClick={() => {
                                        const headers = ["operation", "roles", "identityName"];
                                        const rows: string[][] = [];
                                        report.forEach(r => {
                                            r.accessItems?.forEach((item: any) => {
                                                if (item.type === "Role") {
                                                    rows.push(["removeRole", item.name, r.identityName]);
                                                }
                                            });
                                        });
                                        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                                        const blob = new Blob([csvContent], { type: 'text/csv' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `remove_roles_${new Date().getTime()}.csv`;
                                        a.click();
                                    }}
                                    disabled={totalUsers === 0}
                                    className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <FileText className="h-4 w-4" /> Roles CSV
                                </button>

                                <button
                                    onClick={() => {
                                        const headers = ["operation", "application", "attributeName", "attributeValue", "identityName"];
                                        const rows: string[][] = [];
                                        report.forEach(r => {
                                            r.accessItems?.forEach((item: any) => {
                                                if (item.type === "Entitlement") {
                                                    rows.push(["removeEntitlement", item.application, item.attribute || "unknown", item.value, r.identityName]);
                                                }
                                            });
                                        });
                                        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                                        const blob = new Blob([csvContent], { type: 'text/csv' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `remove_entitlements_${new Date().getTime()}.csv`;
                                        a.click();
                                    }}
                                    disabled={totalUsers === 0}
                                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <FileText className="h-4 w-4" /> Entitlements CSV
                                </button>

                                <button
                                    onClick={() => {
                                        const headers = ["operation", "application", "identityName"];
                                        const rows: string[][] = [];
                                        report.forEach(r => {
                                            r.accessItems?.forEach((item: any) => {
                                                if (item.type === "Account") {
                                                    // User requested format: DisableAccount, AppName, IdentityName
                                                    rows.push(["DisableAccount", item.application, r.identityName]);
                                                }
                                            });
                                        });
                                        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                                        const blob = new Blob([csvContent], { type: 'text/csv' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `disable_accounts_${new Date().getTime()}.csv`;
                                        a.click();
                                    }}
                                    disabled={totalUsers === 0}
                                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <FileText className="h-4 w-4" /> Disable Accounts CSV
                                </button>
                            </div>
                        </div>

                        {/* Execution Controls */}
                        <div className="flex flex-col p-6 bg-slate-900/60 rounded-2xl border border-white/10 gap-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-xl font-extrabold bg-gradient-to-r from-cyan-400 to-blue-300 bg-clip-text text-transparent">Direct Revocation</p>
                                    <p className="text-slate-400 text-sm">Execute provisioning requests directly from this report.</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-slate-800/50 border border-white/5 px-3 py-2 rounded-lg">
                                        <input
                                            type="checkbox"
                                            checked={createWorkitems}
                                            onChange={(e) => setCreateWorkitems(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500/50"
                                        />
                                        <label className="text-xs font-medium text-slate-300">Create Workitems</label>
                                    </div>

                                    <button
                                        onClick={processRevocation}
                                        disabled={revoking || totalUsers === 0}
                                        className={`px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all flex items-center gap-2 ${revoking || totalUsers === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/20"
                                            }`}
                                    >
                                        {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                                        {revoking ? "Revoking..." : "Execute Revocation"}
                                    </button>
                                </div>
                            </div>

                            {(revoking || revokeProgress.total > 0) && (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-300 font-medium">Batch Progress: <span className="text-white">{revokeProgress.current}</span> / {revokeProgress.total} requests</span>
                                        <span className="text-cyan-400 font-bold">{Math.round(revokeProgress.total > 0 ? (revokeProgress.current / revokeProgress.total) * 100 : 0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner border border-slate-700">
                                        <div
                                            className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                                            style={{ width: `${revokeProgress.total > 0 ? (revokeProgress.current / revokeProgress.total) * 100 : 0}%` }}
                                        ></div>
                                    </div>

                                    <div className="bg-black/40 border border-white/10 rounded-xl p-4 h-[200px] flex flex-col">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Execution Logs</h3>
                                        <div className="flex-1 overflow-auto space-y-2 custom-scrollbar font-mono text-xs">
                                            {logs.length === 0 && <span className="text-slate-600 italic">Waiting...</span>}
                                            {logs.map((log, i) => (
                                                <div key={i} className={`p-2 rounded border ${log.includes("[SUCCESS]")
                                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                    : "bg-red-500/10 border-red-500/20 text-red-400"
                                                    }`}>
                                                    {log}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
