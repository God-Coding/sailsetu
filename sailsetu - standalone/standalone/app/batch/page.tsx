"use client";

import { useState } from "react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileText, Play, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function BatchRequestPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const [csvContent, setCsvContent] = useState<string>("");
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [createWorkitems, setCreateWorkitems] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
    const [logs, setLogs] = useState<string[]>([]);

    if (isLoading) return null;
    if (!isAuthenticated) {
        router.push("/");
        return null;
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setCsvContent(text);
            parseCSV(text);
        };
        reader.readAsText(file);
    };

    const parseCSV = (text: string) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length < 2) return;

        const header = lines[0].toLowerCase();
        let mode = 'unknown';

        if (header.includes("attributename") && header.includes("application")) {
            mode = 'entitlement';
        } else if (header.includes("roles") && header.includes("identityname")) {
            mode = 'role';
        } else if (header.includes("identity")) {
            mode = 'legacy';
        } else {
            console.warn("Unknown CSV format");
            return;
        }

        const data = lines.slice(1).map((line, index) => {
            const parts = line.split(",").map(p => p.trim());

            if (mode === 'entitlement') {
                if (parts.length < 5) return null;
                return {
                    id: index,
                    mode: 'entitlement',
                    type: 'Entitlement',
                    op: parts[0],
                    application: parts[1],
                    attrName: parts[2],
                    value: parts[3],
                    identity: parts[4],
                    name: `${parts[1]} : ${parts[2]}`,
                    status: 'pending'
                };
            } else if (mode === 'role') {
                if (parts.length < 3) return null;
                return {
                    id: index,
                    mode: 'role',
                    type: 'Role',
                    op: parts[0],
                    value: parts[1],
                    name: parts[1],
                    identity: parts[2],
                    status: 'pending'
                };
            } else {
                if (parts.length < 3) return null;
                return {
                    id: index,
                    mode: 'legacy',
                    type: parts[1],
                    identity: parts[0],
                    name: parts[2],
                    value: parts[3] || parts[2],
                    status: 'pending'
                };
            }
        }).filter(item => item !== null);

        setParsedData(data);
    };

    const processBatch = async () => {
        setProcessing(true);
        const total = parsedData.length;
        setProgress({ current: 0, total, success: 0, fail: 0 });
        setLogs([]);

        const { url, username, password } = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");

        // Group by Identity
        const groupedMap = new Map();
        parsedData.forEach(row => {
            if (!groupedMap.has(row.identity)) {
                groupedMap.set(row.identity, []);
            }
            groupedMap.get(row.identity).push(row);
        });

        const groups = Array.from(groupedMap.entries());

        // Progress Counters (Need ref refs for atomic updates across async closures if we want to be super precise, 
        // but state setter callbacks are fine for visual progress)
        let processedCount = 0;
        let successCount = 0;
        let failCount = 0;

        const CONCURRENCY_LIMIT = 5;
        let groupIndex = 0;

        const processGroup = async (identityName: string, items: any[]) => {
            try {
                // Prepare accessItems
                const accessItems = items.map((item: any) => {
                    let type = "entitlement";
                    let application = item.application || "IIQ";
                    let name = item.name;
                    let value = item.value;
                    let op = "Add";

                    if (item.op && item.op.toLowerCase().includes("remove")) {
                        op = "Remove";
                    }

                    if (item.mode === 'role') {
                        type = "role";
                        name = "assignedRoles";
                        value = item.value;
                    } else if (item.mode === 'entitlement') {
                        type = "entitlement";
                        application = item.application;
                        name = item.attrName;
                        value = item.value;
                    } else {
                        // Legacy
                        if (item.type && item.type.toLowerCase().includes("role")) {
                            type = "role";
                            name = "assignedRoles";
                        } else {
                            const parts = item.name ? item.name.split(":") : [];
                            if (parts.length >= 2) {
                                application = parts[0].trim();
                                name = parts[1].trim();
                            }
                        }
                    }

                    return {
                        application: application,
                        name: name,
                        value: value,
                        type: type,
                        op: op
                    };
                });

                const inputList = [
                    { key: "identityName", value: identityName },
                    { key: "accessItems", value: JSON.stringify(accessItems) }
                ];

                if (!createWorkitems) {
                    inputList.push({ key: "approvalScheme", value: "none" });
                }

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

                    let reqId = "N/A";
                    const result = data.launchResult;

                    if (result) {
                        // Check for id field directly (task result id)
                        if (result.id && !reqId.match(/^[a-z0-9]{32}$/i)) {
                            reqId = result.id;
                        }

                        // Check workflow schema for request ID
                        const workflowSchema = result["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow"];
                        if (workflowSchema && workflowSchema.identityRequestId) {
                            reqId = workflowSchema.identityRequestId;
                        }

                        // Check attributes
                        if (result.attributes) {
                            const attrs = result.attributes;
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
                    }

                    setLogs(prev => [`[SUCCESS] ${identityName}: Submitted batch (${items.length} items). Request ID: ${reqId}`, ...prev].slice(0, 50));
                    setParsedData(prev => prev.map(p => p.identity === identityName ? { ...p, status: 'success' } : p));
                } else {
                    throw new Error(data.error || "Unknown error");
                }

            } catch (e: any) {
                failCount += items.length;
                setLogs(prev => [`[ERROR] ${identityName}: ${e.message}`, ...prev].slice(0, 50));
                setParsedData(prev => prev.map(p => p.identity === identityName ? { ...p, status: 'error' } : p));
            }

            processedCount += items.length;
            setProgress(prev => ({
                current: processedCount,
                total,
                success: successCount,
                fail: failCount
            }));
        };

        // Worker Loop
        const worker = async () => {
            while (groupIndex < groups.length) {
                const idx = groupIndex++;
                if (idx >= groups.length) break;
                const [identityName, items] = groups[idx];
                await processGroup(identityName, items);
            }
        };

        const workers = Array(Math.min(CONCURRENCY_LIMIT, groups.length))
            .fill(null)
            .map(() => worker());

        await Promise.all(workers);
        setProcessing(false);
    };

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto p-6 relative z-10">
                {/* Header */}
                {/* Header */}
                <div className="mb-8 border-b border-white/5 pb-6">
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                        Batch Provisioning
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Upload CSV requests and process via LCM Workflows.</p>
                </div>

                {/* Progress Bar */}
                {(processing || progress.total > 0) && (
                    <div className="mb-8 bg-slate-900/40 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-300 font-medium">Batch Progress: <span className="text-white">{progress.current}</span> / {progress.total} requests processed</span>
                            <span className="text-indigo-400 font-bold">{Math.round(progress.total > 0 ? (progress.current / progress.total) * 100 : 0)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner border border-slate-700">
                            <div
                                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                            ></div>
                        </div>
                        <div className="flex gap-6 mt-4 text-sm font-medium">
                            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 px-3 py-1 rounded-lg border border-emerald-500/20">
                                <CheckCircle className="h-4 w-4" /> {progress.success} Success
                            </div>
                            <div className="flex items-center gap-2 text-rose-400 bg-rose-950/30 px-3 py-1 rounded-lg border border-rose-500/20">
                                <AlertCircle className="h-4 w-4" /> {progress.fail} Failed
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Upload & Config */}
                    <div className="space-y-6">
                        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Upload className="h-5 w-5 text-indigo-400" />
                                Upload CSV
                            </h3>

                            {processing && (
                                <div className="flex items-center gap-3 text-slate-400 mb-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                                    <span>Processing batch request...</span>
                                </div>
                            )}

                            <label className="block w-full cursor-pointer group">
                                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                                <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/5 transition-all">
                                    <div className="p-3 bg-slate-800 rounded-full group-hover:scale-110 transition-transform">
                                        <FileText className="h-6 w-6 text-slate-400 group-hover:text-indigo-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-slate-300 group-hover:text-white">Click to upload CSV</p>
                                        <p className="text-xs text-slate-500 mt-1">Format: Identity, Type, Name, Value</p>
                                    </div>
                                </div>
                            </label>

                            <div className="mt-6 space-y-4">
                                <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-lg border border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-200">Create Workitems</span>
                                        <span className="text-xs text-slate-500">Enable approvals for requests</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={createWorkitems}
                                        onChange={(e) => setCreateWorkitems(e.target.checked)}
                                        className="h-5 w-5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={processBatch}
                                disabled={parsedData.length === 0 || processing}
                                className={`w-full mt-6 py-3 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-xs tracking-wider transition-all ${parsedData.length > 0 && !processing
                                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                                    }`}
                            >
                                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                {processing ? "Processing..." : "Run Batch"}
                            </button>
                        </div>

                        {/* Logs */}
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 h-[300px] flex flex-col">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Execution Logs</h3>
                            <div className="flex-1 overflow-auto space-y-2 custom-scrollbar font-mono text-xs">
                                {logs.length === 0 && <span className="text-slate-600 italic">Waiting to start...</span>}
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

                    {/* Right Column: Preview Table */}
                    <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[700px]">
                        <div className="p-4 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
                            <h3 className="font-bold text-white">Preview Data</h3>
                            <span className="text-xs font-mono text-slate-400 bg-black/30 px-2 py-1 rounded">
                                {parsedData.length} Records
                            </span>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-slate-950 text-xs uppercase font-medium text-slate-500 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4">Identity</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Access Name</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {parsedData.slice(0, 100).map((row, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-200">{row.identity}</td>
                                            <td className="px-6 py-3">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase border ${row.type.toLowerCase().includes("role")
                                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                    }`}>
                                                    {row.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">{row.name}</td>
                                            <td className="px-6 py-3">
                                                {row.status === 'success' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                                                {row.status === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
                                                {row.status === 'pending' && <span className="h-2 w-2 rounded-full bg-slate-600 block" />}
                                            </td>
                                        </tr>
                                    ))}
                                    {parsedData.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-600">
                                                No data loaded. Upload a CSV file to begin.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
