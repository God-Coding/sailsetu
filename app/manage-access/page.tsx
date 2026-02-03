"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { useRouter } from "next/navigation";
import { UserSearch } from "@/components/user-search";
import { Loader2, ShieldAlert, ShieldCheck, Plus, Trash2, CheckCircle2, History } from "lucide-react";

export default function ManageAccessPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [currentAccess, setCurrentAccess] = useState<any[]>([]);
    const [loadingAccess, setLoadingAccess] = useState(false);

    // Tabs: 'add' | 'remove'
    const [activeTab, setActiveTab] = useState<'add' | 'remove'>('remove');

    // Add Form State
    const [addType, setAddType] = useState<'Role' | 'Entitlement'>('Role');
    const [addApp, setAddApp] = useState("IIQ");
    const [addAttr, setAddAttr] = useState("assignedRoles"); // Default for Role
    const [addVal, setAddVal] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.push("/");
    }, [isLoading, isAuthenticated, router]);

    // Fetch Access when User Selected
    useEffect(() => {
        if (selectedUser) {
            fetchCurrentAccess(selectedUser.userName);
        } else {
            setCurrentAccess([]);
        }
    }, [selectedUser]);

    const fetchCurrentAccess = async (username: string) => {
        setLoadingAccess(true);
        try {
            const { url, username: apiUser, password } = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");
            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url, username: apiUser, password,
                    workflowName: "GetIdentityAccess",
                    input: { identityName: username }
                }),
            });

            const data = await res.json();

            if (data.success && Array.isArray(data.launchResult?.attributes)) {
                const accessAttr = data.launchResult.attributes.find((a: any) => a.key === 'accessList');
                if (accessAttr && accessAttr.value) {
                    let accessData = accessAttr.value;
                    if (typeof accessData === 'string') {
                        try {
                            accessData = JSON.parse(accessData);
                        } catch (e) {
                            console.error("Failed to parse accessList JSON", e);
                            accessData = [];
                        }
                    }
                    setCurrentAccess(Array.isArray(accessData) ? accessData : []);
                }
            }
        } catch (e) {
            console.error("Error fetching access", e);
        } finally {
            setLoadingAccess(false);
        }
    };

    const handleSubmit = async (op: 'Add' | 'Remove', item: any) => {
        setSubmitting(true);
        setResult(null);

        try {
            const { url, username, password } = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");

            // Construct Access Item
            const accessItem = {
                type: item.type === 'Role' || item.type === 'Assigned Role' ? 'role' : 'entitlement',
                application: item.application || (item.type === 'Role' ? 'IIQ' : ''),
                name: item.name,
                value: item.value,
                op: op
            };

            // Fix for Roles (Standardize)
            if (accessItem.type === 'role') {
                accessItem.application = 'IIQ';
                accessItem.name = 'assignedRoles';
                accessItem.value = item.value || item.name; // Depending on input source
            }

            const payload = {
                url, username, password,
                workflowName: "ProvisionAccess",
                input: {
                    identityName: selectedUser.userName,
                    accessItems: JSON.stringify([accessItem]),
                    approvalScheme: "manager" // Force Workitem creation
                }
            };

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (data.success) {
                // Extract Request ID
                let reqId = data.launchResult?.id;
                // Try XML extract if generic
                const planXml = data.launchResult?.attributes?.find((a: any) => a.key === 'plan' || a.key === 'project')?.value;
                if (planXml) {
                    const match = planXml.match(/key="identityRequestId"\s+value="([^"]+)"/);
                    if (match && match[1]) reqId = match[1];
                }

                setResult({ success: true, id: reqId });
                // Refresh list if Remove
                if (op === 'Remove') {
                    setTimeout(() => fetchCurrentAccess(selectedUser.userName), 2000);
                }
            } else {
                setResult({ success: false, error: data.error || "Workflow failed" });
            }

        } catch (e: any) {
            setResult({ success: false, error: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) return null;

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-slate-100 flex flex-col">
            <div className="max-w-5xl mx-auto w-full space-y-8">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Manage User Access
                </h1>

                {/* SEARCH */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <UserSearch label="Select Identity" onSelect={setSelectedUser} />
                </div>

                {selectedUser && (
                    <div className="space-y-6">
                        {/* TABS */}
                        <div className="flex gap-4 border-b border-slate-800">
                            <button
                                onClick={() => setActiveTab('remove')}
                                className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'remove' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Revoke Access ({currentAccess.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('add')}
                                className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'add' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Request Access
                            </button>
                        </div>

                        {/* RESULT ALERT */}
                        {result && (
                            <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                                {result.success ? (
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span>Request Submitted! ID: <strong>{result.id}</strong> (Workitem Created)</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="h-5 w-5" />
                                        <span>Error: {result.error}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* REVOKE TAB */}
                        {activeTab === 'remove' && (
                            <div className="space-y-4">
                                {loadingAccess ? (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Fetching access...
                                    </div>
                                ) : currentAccess.length === 0 ? (
                                    <p className="text-slate-500 italic">No existing access found.</p>
                                ) : (
                                    <div className="grid gap-3">
                                        {currentAccess.map((item, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-slate-900 rounded-lg border border-slate-800 group hover:border-slate-700 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-lg ${item.type?.toLowerCase().includes('role') ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                        <ShieldCheck className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-200">{item.name}</p>
                                                        <p className="text-sm text-slate-500 font-mono">
                                                            {item.type} • {item.application || 'IIQ'} {item.value ? `• ${item.value}` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleSubmit('Remove', item)}
                                                    disabled={submitting}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-900/30 hover:bg-red-900/50 text-red-400 px-3 py-1.5 rounded-md text-sm flex items-center gap-2"
                                                >
                                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    Revoke
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ADD TAB */}
                        {activeTab === 'add' && (
                            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6 max-w-2xl">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">Type</label>
                                        <select
                                            value={addType}
                                            onChange={(e) => {
                                                const t = e.target.value as any;
                                                setAddType(t);
                                                if (t === 'Role') {
                                                    setAddApp("IIQ");
                                                    setAddAttr("assignedRoles");
                                                } else {
                                                    setAddApp("");
                                                    setAddAttr("");
                                                }
                                            }}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 outline-none focus:border-blue-500"
                                        >
                                            <option value="Role">Role</option>
                                            <option value="Entitlement">Entitlement</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">Application Name</label>
                                        <input
                                            type="text"
                                            value={addApp}
                                            disabled={addType === 'Role'}
                                            onChange={(e) => setAddApp(e.target.value)}
                                            placeholder={addType === 'Role' ? "IIQ" : "e.g. TRAKK"}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">Value (Name)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={addVal}
                                                onChange={(e) => setAddVal(e.target.value)}
                                                placeholder={addType === 'Role' ? "Role Name" : "Entitlement Value"}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {addType === 'Entitlement' && (
                                    <div className="flex justify-end -mt-4">
                                        <button
                                            onClick={async () => {
                                                if (!addApp || !addVal) return;
                                                const btn = document.getElementById('verify-btn');
                                                if (btn) btn.innerHTML = 'Verifying...';
                                                try {
                                                    const { url, username, password } = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");
                                                    const res = await fetch("/api/entitlement/search", {
                                                        method: "POST",
                                                        body: JSON.stringify({ application: addApp, value: addVal, url, username, password })
                                                    });
                                                    const d = await res.json();
                                                    if (d.success && d.found) {
                                                        setAddAttr(d.attribute || "");
                                                        alert(`Verified! Attribute: ${d.attribute}`);
                                                    } else {
                                                        alert("Entitlement not found in catalog.");
                                                    }
                                                } catch (e) { console.error(e); }
                                                if (btn) btn.innerHTML = '✨ Smart Verify';
                                            }}
                                            id="verify-btn"
                                            type="button"
                                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            ✨ Smart Verify
                                        </button>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400">Attribute Name</label>
                                        <input
                                            type="text"
                                            value={addAttr}
                                            disabled={addType === 'Role'}
                                            onChange={(e) => setAddAttr(e.target.value)}
                                            placeholder="e.g. memberOf, group"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSubmit('Add', {
                                        type: addType,
                                        application: addApp,
                                        name: addAttr,
                                        value: addVal
                                    })}
                                    disabled={submitting || !addVal}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Submit Request (Create Workitem)
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
