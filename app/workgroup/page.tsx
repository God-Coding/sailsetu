"use client";

import { useState } from "react";
import { useAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Save, AlertCircle, CheckCircle, Loader2, FileSpreadsheet } from "lucide-react";

export default function CreateWorkgroupPage() {
    const { isAuthenticated, user, url, username, password, isLoading } = useAuth();
    const router = useRouter();

    const [form, setForm] = useState({
        name: "",
        description: "",
        owner: "",
        email: "",
        capabilities: "",
        members: ""
    });
    const [result, setResult] = useState<{ success: boolean, message: string } | null>(null);
    const [mode, setMode] = useState<"single" | "batch">("single");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [batchProgress, setBatchProgress] = useState<{ total: number, current: number, success: number, fail: number } | null>(null);
    const [batchLogs, setBatchLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCapDropdownOpen, setIsCapDropdownOpen] = useState(false);

    const ALL_CAPABILITIES = [
        "SystemAdministrator", "ApplicationAdministrator", "IdentityAdministrator", "RoleAdministrator",
        "AccessManager", "Auditor", "BatchRequestAdministrator", "BusinessRoleAdministrator",
        "CertificationAdministrator", "ComplianceOfficer", "ManagedAttributeProvisioningAdmin",
        "ManagedAttributePropertyAdmin", "EntitlementRoleAdministrator", "FormAdministrator",
        "FullAccessAdminConsole", "HelpDesk", "IdentityCorrelationAdministrator",
        "IdentityRequestAdministrator", "ITRoleAdministrator", "OrganizationalRoleAdministrator",
        "PasswordAdministrator", "PluginAdministrator", "PolicyAdministrator", "RuleAdministrator",
        "SCIMExecutor", "SignOffAdministrator", "SyslogAdministrator", "TaskResultsViewer",
        "ViewAdminConsole", "WebServicesExecutor", "WorkgroupAdministrator", "WorkItemAdministrator"
    ].sort();

    const handleCapabilityToggle = (cap: string) => {
        const current = form.capabilities ? form.capabilities.split(",").map(s => s.trim()).filter(Boolean) : [];
        let newCaps;
        if (current.includes(cap)) {
            newCaps = current.filter(c => c !== cap);
        } else {
            newCaps = [...current, cap];
        }
        setForm({ ...form, capabilities: newCaps.join(",") });
    };

    const selectedCapsList = form.capabilities ? form.capabilities.split(",").map(s => s.trim()).filter(Boolean) : [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            const inputList = [
                { key: "workgroupName", value: form.name },
                { key: "description", value: form.description },
                { key: "ownerName", value: form.owner },
                { key: "email", value: form.email },
                { key: "capabilities", value: form.capabilities },
                { key: "members", value: form.members }
            ];

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url, username, password,
                    workflowName: "CreateWorkgroup",
                    input: inputList
                }),
            });

            const data = await res.json();

            if (data.success) {
                // Check task result
                // The workflow returns "result" variable. It is mapped to task result attributes?
                // Our workflow explicitly set output="true" for "result". 
                // However, standard TaskResult usually dumps output variables into attributes map.
                let msg = "Workflow launched successfully.";
                if (data.launchResult && data.launchResult.attributes) {
                    const attrs = data.launchResult.attributes;
                    const resAttr = attrs.find((a: any) => a.key === "result");
                    if (resAttr) msg = resAttr.value;
                }

                if (msg.startsWith("Error")) {
                    setResult({ success: false, message: msg });
                } else {
                    setResult({ success: true, message: msg });
                    // Clear form on success
                    setForm({ name: "", description: "", owner: "", email: "", capabilities: "", members: "" });
                    setIsCapDropdownOpen(false);
                }
            } else {
                setResult({ success: false, message: data.error || "API Error" });
            }

        } catch (e: any) {
            setResult({ success: false, message: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCsvFile(e.target.files[0]);
        }
    };

    const parseCSV = async (file: File): Promise<any[]> => {
        const text = await file.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            // Handle CSV parsing: Split by comma, but ignore commas inside double-quotes
            const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

            if (row && row.length > 0) {
                const obj: any = {};
                headers.forEach((h, index) => {
                    let val = row[index] ? row[index].trim() : "";
                    // Remove surrounding quotes if present (standard CSV)
                    if (val.startsWith('"') && val.endsWith('"')) {
                        val = val.slice(1, -1);
                        // Handle escaped quotes ("") -> (")
                        val = val.replace(/""/g, '"');
                    }
                    obj[h] = val;
                });
                data.push(obj);
            }
        }
        return data;
    };

    const processBatch = async () => {
        if (!csvFile) return;
        setLoading(true);
        setBatchLogs([]);
        setBatchProgress({ total: 0, current: 0, success: 0, fail: 0 });

        try {
            const data = await parseCSV(csvFile);
            setBatchProgress({ total: data.length, current: 0, success: 0, fail: 0 });

            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const itemName = item.name || item.workgroupName || "Unknown";

                // Map CSV headers to input keys
                // Expected Headers: name, description, owner, email, capabilities, members
                const inputList = [
                    { key: "workgroupName", value: item.name || item.workgroupName },
                    { key: "description", value: item.description },
                    { key: "ownerName", value: item.owner || item.ownerName },
                    { key: "email", value: item.email },
                    { key: "capabilities", value: item.capabilities }, // comma separated string
                    { key: "members", value: item.members } // comma separated string
                ];

                try {
                    const res = await fetch("/api/workflow/launch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            url, username, password,
                            workflowName: "CreateWorkgroup",
                            input: inputList
                        }),
                    });
                    const resData = await res.json();

                    if (resData.success) {
                        let msg = "Success";
                        // Extract result message if possible
                        if (resData.launchResult && resData.launchResult.attributes) {
                            const r = resData.launchResult.attributes.find((a: any) => a.key === "result");
                            if (r) msg = r.value;
                        }

                        if (msg.startsWith("Error")) {
                            setBatchLogs(prev => [`[FAIL] ${itemName}: ${msg}`, ...prev]);
                            setBatchProgress(prev => prev ? ({ ...prev, fail: prev.fail + 1, current: prev.current + 1 }) : null);
                        } else {
                            setBatchLogs(prev => [`[OK] ${itemName}: ${msg}`, ...prev]);
                            setBatchProgress(prev => prev ? ({ ...prev, success: prev.success + 1, current: prev.current + 1 }) : null);
                        }
                    } else {
                        throw new Error(resData.error || "Unknown API Error");
                    }
                } catch (err: any) {
                    setBatchLogs(prev => [`[FAIL] ${itemName}: ${err.message}`, ...prev]);
                    setBatchProgress(prev => prev ? ({ ...prev, fail: prev.fail + 1, current: prev.current + 1 }) : null);
                }
            }

        } catch (e: any) {
            setBatchLogs(prev => [`[FATAL] Batch failed: ${e.message}`, ...prev]);
        } finally {
            setLoading(false);
        }
    };

    if (isLoading) {
        return (
            <main className="min-h-screen bg-[#020617] flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            </main>
        );
    }

    if (!isAuthenticated) {
        router.push("/");
        return null;
    }

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />

            <div className="max-w-4xl mx-auto p-6 relative z-10">
                <div className="mb-8 border-b border-white/5 pb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
                            <Users className="h-8 w-8 text-indigo-400" />
                            {mode === "single" ? "Create Workgroup" : "Batch Create Workgroups"}
                        </h1>
                        <p className="text-slate-400 text-sm mt-2">
                            {mode === "single" ? "Create new Workgroups and assign initial members." : "Upload CSV to create multiple workgroups."}
                        </p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="bg-slate-900 border border-slate-700 p-1 rounded-lg flex">
                        <button
                            onClick={() => setMode("single")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === "single" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
                        >Single</button>
                        <button
                            onClick={() => setMode("batch")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === "batch" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
                        >Batch CSV</button>
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-xl">
                    {mode === "single" ? (
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Workgroup Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                                    placeholder="e.g., AD-Admins-WG"
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 min-h-[80px]"
                                    placeholder="Purpose of this workgroup..."
                                />
                            </div>

                            {/* Owner & Email Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Owner Identity Name</label>
                                    <input
                                        type="text"
                                        value={form.owner}
                                        onChange={e => setForm({ ...form, owner: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                                        placeholder="e.g., spadmin"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Group Email</label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                                        placeholder="group@example.com"
                                    />
                                </div>
                            </div>

                            {/* Capabilities Multi-Select */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-300 mb-2">Capabilities (Rights)</label>

                                {/* Selected Tags */}
                                {selectedCapsList.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {selectedCapsList.map(cap => (
                                            <span key={cap} className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded text-xs flex items-center gap-1">
                                                {cap}
                                                <button type="button" onClick={() => handleCapabilityToggle(cap)} className="hover:text-white">&times;</button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Dropdown Trigger */}
                                <button
                                    type="button"
                                    onClick={() => setIsCapDropdownOpen(!isCapDropdownOpen)}
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-left text-slate-300 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all flex justify-between items-center"
                                >
                                    <span>{selectedCapsList.length === 0 ? "Select Capabilities..." : `Selected ${selectedCapsList.length} capabilities`}</span>
                                    <span className="text-slate-500">▼</span>
                                </button>

                                {/* Dropdown List */}
                                {isCapDropdownOpen && (
                                    <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                                        {ALL_CAPABILITIES.map(cap => (
                                            <div
                                                key={cap}
                                                onClick={() => handleCapabilityToggle(cap)}
                                                className={`px-4 py-2 cursor-pointer text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors ${selectedCapsList.includes(cap) ? "bg-indigo-900/30 text-indigo-300" : "text-slate-300"}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedCapsList.includes(cap) ? "bg-indigo-500 border-indigo-500" : "border-slate-600"}`}>
                                                    {selectedCapsList.includes(cap) && <CheckCircle className="w-3 h-3 text-white" />}
                                                </div>
                                                {cap}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Members */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Members (Native Identity Names)</label>
                                <div className="relative">
                                    <textarea
                                        value={form.members}
                                        onChange={e => setForm({ ...form, members: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 min-h-[100px]"
                                        placeholder="e.g., James.Smith, Linda.Johnson"
                                    />
                                    <UserPlus className="absolute top-3 right-3 h-5 w-5 text-slate-600" />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Check comma-separated list of identity names.</p>
                            </div>

                            {/* Result Message */}
                            {result && (
                                <div className={`p-4 rounded-lg flex items-start gap-3 ${result.success ? "bg-emerald-950/30 border border-emerald-500/20 text-emerald-400" : "bg-rose-950/30 border border-rose-500/20 text-rose-400"}`}>
                                    {result.success ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                                    <div>
                                        <p className="font-medium">{result.success ? "Success" : "Error"}</p>
                                        <p className="text-sm opacity-90">{result.message}</p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" /> Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-5 w-5" /> Create Workgroup
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Batch Mode UI */
                        <div className="space-y-6">
                            <div className="p-6 bg-slate-950/30 border border-dashed border-slate-700 rounded-xl text-center">
                                <label className="block cursor-pointer">
                                    <span className="text-indigo-400 font-medium">Click to Upload CSV</span>
                                    <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
                                    <p className="text-xs text-slate-500 mt-2">Format: name, description, owner, email, capabilities, members</p>
                                </label>
                                {csvFile && <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400 bg-emerald-950/20 py-2 px-4 rounded-full text-sm font-mono"><FileSpreadsheet className="h-4 w-4" /> {csvFile.name}</div>}
                            </div>

                            {/* Progress & Logs */}
                            {batchProgress && (
                                <div className="bg-slate-950/50 rounded-xl p-6 border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center text-sm mb-2">
                                        <span className="text-slate-300 font-medium">Batch Progress</span>
                                        <span className="text-indigo-400">{batchProgress.current} / {batchProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2.5 rounded-full transition-all duration-300"
                                            style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span className="text-emerald-400">Success: {batchProgress.success}</span>
                                        <span className="text-rose-400">Failed: {batchProgress.fail}</span>
                                    </div>
                                </div>
                            )}

                            {batchLogs.length > 0 && (
                                <div className="max-h-60 overflow-y-auto bg-black/40 rounded-lg p-4 font-mono text-xs space-y-1 border border-white/5">
                                    {batchLogs.map((log, i) => (
                                        <div key={i} className={log.includes("[FAIL]") ? "text-rose-400" : "text-emerald-400/80"}>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    onClick={processBatch}
                                    disabled={loading || !csvFile}
                                    className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" /> Processing Batch...
                                        </>
                                    ) : (
                                        <>
                                            <FileSpreadsheet className="h-5 w-5" /> Start Batch Creation
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
