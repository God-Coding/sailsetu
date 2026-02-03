"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { useRouter } from "next/navigation";
import { UserSearch } from "@/components/user-search";
import { Loader2, Play, FileJson } from "lucide-react";

export default function WorkflowAccessPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [result, setResult] = useState<any>(null);
    const [executing, setExecuting] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.push("/");
    }, [isLoading, isAuthenticated, router]);

    const launchWorkflow = async () => {
        if (!selectedUser) return;
        setExecuting(true);
        setResult(null);

        try {
            const { url, username, password } = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");
            // Launch "Get Identity Access"
            console.log("Launching for user:", selectedUser);
            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url,
                    username,
                    password,
                    workflowName: "GetIdentityAccess",
                    input: { identityName: selectedUser.userName }
                }),
            });
            const data = await res.json();

            if (data.success) {
                // If workflow returns 'attributes' with 'accessList', show it.
                // Otherwise show the raw launch result.
                setResult(data.launchResult);
            } else {
                setResult({ error: data.error, details: data.details });
            }
        } catch (e: any) {
            setResult({ error: e.message });
        } finally {
            setExecuting(false);
        }
    };

    if (isLoading) return null;
    if (!isAuthenticated) return null;

    return (
        <main className="min-h-screen bg-slate-950 p-8 text-slate-100 flex flex-col">
            <div className="max-w-4xl mx-auto w-full space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">Workflow Launcher</h1>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 space-y-6">
                    <div className="max-w-md">
                        <UserSearch
                            label="Select Identity to Scan"
                            onSelect={setSelectedUser}
                        />
                    </div>

                    <div className="flex items-center gap-4 border-t border-slate-800 pt-6">
                        <button
                            onClick={launchWorkflow}
                            disabled={!selectedUser || executing}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md font-medium transition-colors shadow-lg shadow-blue-900/20"
                        >
                            {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                            Launch Analysis
                        </button>
                        <div className="text-sm text-slate-500">
                            Invokes <code>Get Identity Access</code> workflow
                        </div>
                    </div>
                </div>

                {result && (
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2">
                            <FileJson className="h-4 w-4 text-purple-400" />
                            <h3 className="font-semibold text-slate-200">Workflow Result</h3>
                        </div>
                        <div className="p-6">
                            {/* Try to render nice list if accessList exists */}
                            {result.attributes?.accessList ? (
                                <div className="space-y-2">
                                    {result.attributes.accessList.map((item: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-950 rounded border border-slate-800">
                                            <span className="font-medium text-slate-200">{item.name}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-500 font-mono">{item.value}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${item.type === 'Assigned Role' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                    {item.type}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <pre className="font-mono text-xs text-slate-400 overflow-auto max-h-96">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
