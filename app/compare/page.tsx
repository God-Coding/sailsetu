"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";
import { UserSearch } from "@/components/user-search";
import { ArrowRightLeft, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

interface AccessItem {
    type: string;
    name: string; // Display Name (e.g. "Active Directory : Domain Users" or "Manager Role")
    value: string; // Technical ID/Value
}

export default function ComparePage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const [sourceUser, setSourceUser] = useState<any>(null);
    const [targetUser, setTargetUser] = useState<any>(null);

    const [sourceAccess, setSourceAccess] = useState<AccessItem[]>([]);
    const [targetAccess, setTargetAccess] = useState<AccessItem[]>([]);

    const [diff, setDiff] = useState<any>(null);
    const [loadingSource, setLoadingSource] = useState(false);
    const [loadingTarget, setLoadingTarget] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) router.push("/");
    }, [isLoading, isAuthenticated, router]);

    // Clear notification after 5 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Helper to parse Java ArrayList toString format like "[{key=val}, {key=val}]"
    const parseJavaArrayList = (javaString: string): any[] => {
        if (typeof javaString !== 'string') return javaString;

        // Remove outer brackets [ ]
        let content = javaString.trim();
        if (content.startsWith('[')) content = content.substring(1);
        if (content.endsWith(']')) content = content.substring(0, content.length - 1);

        // Split by "}, {" to get individual map strings
        const mapStrings = content.split(/\},\s*\{/);

        return mapStrings.map(mapStr => {
            // Add back the braces if they were removed
            let cleaned = mapStr.trim();
            if (!cleaned.startsWith('{')) cleaned = '{' + cleaned;
            if (!cleaned.endsWith('}')) cleaned = cleaned + '}';

            // Remove outer braces for parsing
            const inner = cleaned.substring(1, cleaned.length - 1);

            const obj: any = {};
            // Split by comma, looking ahead for key= pattern
            const pairs = inner.split(/,\s*(?=[a-zA-Z_]+\s*=)/);

            pairs.forEach(pair => {
                const equalIndex = pair.indexOf('=');
                if (equalIndex > 0) {
                    const key = pair.substring(0, equalIndex).trim();
                    const value = pair.substring(equalIndex + 1).trim();
                    obj[key] = value;
                }
            });

            return obj;
        });
    };

    // Fetch Access via Workflow
    const fetchAccess = async (userName: string, setter: (data: AccessItem[]) => void, setLoading: (l: boolean) => void) => {
        console.log(`[FetchAccess] Starting for user: ${userName}`);

        if (!userName) {
            setter([]);
            return;
        }

        setLoading(true);
        try {
            const authStr = sessionStorage.getItem("sp_auth");
            if (!authStr) {
                console.error("[FetchAccess] No auth found in session storage");
                setNotification({ type: 'error', message: "Session expired. Please log in again." });
                router.push("/");
                return;
            }

            const { url, username, password } = JSON.parse(authStr);
            if (!url || !username || !password) {
                console.error("[FetchAccess] Incomplete auth credentials");
                return;
            }

            // Add timeout to prevent infinite loading
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url,
                    username,
                    password,
                    workflowName: "GetIdentityAccess",
                    input: { identityName: userName }
                }),
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));

            if (!res.ok) {
                throw new Error(`Server returned ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            console.log("[FetchAccess] Response:", data);

            if (data.success && data.launchResult) {
                // SCIM response structure: output is in the URN schema
                const workflowData = data.launchResult["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow"];

                if (workflowData?.output) {
                    // Output is an array of {key, value} objects
                    const accessListItem = workflowData.output.find((item: any) => item.key === "accessList");

                    if (accessListItem?.value) {
                        let accessList = accessListItem.value;
                        console.log("Access list received (raw):", accessList);
                        console.log("Type of accessList:", typeof accessList);

                        // If it's a string, parse Java ArrayList format
                        if (typeof accessList === 'string') {
                            accessList = parseJavaArrayList(accessList);
                            console.log("Parsed access list:", accessList);
                            console.log("Parsed first item:", JSON.stringify(accessList[0]));
                        }

                        // Filter out accounts/applications as per requirements
                        const filteredList = Array.isArray(accessList) ? accessList.filter((item: any) => {
                            const t = item.type ? item.type.toLowerCase() : "";
                            return !t.includes('account') && !t.includes('link') && !t.includes('application');
                        }) : [];

                        setter(filteredList);
                    } else {
                        console.warn("No accessList found in workflow output:", workflowData.output);
                        setter([]);
                    }
                } else {
                    console.warn("No workflow output found:", data.launchResult);
                    setter([]);
                }
            } else {
                console.warn("Workflow did not return success:", data);
                setter([]);
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.error("Fetch access timed out");
                setNotification({ type: 'error', message: "Timeout: Unable to fetch access for " + userName });
            } else {
                console.error("Failed to fetch access", e);
            }
            setter([]);
        } finally {
            setLoading(false);
        }
    };

    // Trigger fetches when users change
    useEffect(() => {
        if (sourceUser?.userName) fetchAccess(sourceUser.userName, setSourceAccess, setLoadingSource);
        else setSourceAccess([]);
    }, [sourceUser]);

    useEffect(() => {
        if (targetUser?.userName) fetchAccess(targetUser.userName, setTargetAccess, setLoadingTarget);
        else setTargetAccess([]);
    }, [targetUser]);

    // Comparison Logic
    useEffect(() => {
        if (!sourceUser || !targetUser) {
            setDiff(null);
            return;
        }

        // Compare logic: We compare based on 'value' + 'type' to be unique
        const getKey = (item: AccessItem) => `${item.type}::${item.value}`;

        const uniqueToSource = sourceAccess.filter(src =>
            !targetAccess.some(tgt => getKey(src) === getKey(tgt))
        );

        const uniqueToTarget = targetAccess.filter(tgt =>
            !sourceAccess.some(src => getKey(src) === getKey(tgt))
        );

        setDiff({ uniqueToSource, uniqueToTarget });
    }, [sourceAccess, targetAccess, sourceUser, targetUser]);

    // Helper to render an access item badge
    const renderBadge = (type: string) => {
        let colors = "bg-slate-700 text-slate-300";
        if (type.includes("Assigned")) colors = "bg-purple-500/10 text-purple-400 border border-purple-500/20";
        else if (type.includes("Detected")) colors = "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
        else if (type.includes("Entitlement")) colors = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
        else if (type.includes("Account")) colors = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

        return (
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${colors}`}>
                {type}
            </span>
        );
    };

    // Helper to build ProvisioningPlan XML
    const buildProvisioningPlanXML = (targetIdentity: string, requester: string, items: AccessItem[]) => {
        let accountRequestsXML = "";

        items.forEach(item => {
            if (item.type.includes("Role") || item.type.includes("Bundle")) {
                accountRequestsXML += `
  <AccountRequest application="IIQ" op="Modify" nativeIdentity="${targetIdentity}">
    <AttributeRequest name="assignedRoles" op="Add" value="${item.value}"/>
  </AccountRequest>`;
            } else if (item.type.includes("Entitlement")) {
                // Name format: "AppName : AttrName"
                const parts = item.name.split(" : ");
                if (parts.length >= 2) {
                    const appName = parts[0];
                    const attrName = parts[1];
                    accountRequestsXML += `
  <AccountRequest application="${appName}" op="Modify" nativeIdentity="${targetIdentity}">
    <AttributeRequest name="${attrName}" op="Add" value="${item.value}"/>
  </AccountRequest>`;
                }
            }
        });

        return `<ProvisioningPlan>
${accountRequestsXML}
  <Attributes>
    <Map>
      <entry key="identityRequestId" value=""/>
      <entry key="requester" value="${requester}"/>
      <entry key="source" value="LCM"/>
    </Map>
  </Attributes>
  <Requesters>
    <Reference class="sailpoint.object.Identity" name="${requester}"/>
  </Requesters>
</ProvisioningPlan>`;
    };

    // Provisioning Logic
    const [provisioningItems, setProvisioningItems] = useState<AccessItem[] | null>(null);
    const [isProvisioning, setIsProvisioning] = useState(false);

    // Provisioning Trigger
    const confirmProvisioning = (targetIdentity: string, items: AccessItem[]) => {
        if (!targetIdentity || items.length === 0) return;
        setProvisioningItems(items);
    };

    // Actual Provisioning Logic (called after confirmation)
    const executeProvisioning = async () => {
        if (!targetUser || !provisioningItems) return;

        setIsProvisioning(true);
        // Close modal immediately but keep loading state

        try {
            const { url, username, password } = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");
            const targetIdentity = targetUser.userName;

            // Build the XML Plan
            const planXML = buildProvisioningPlanXML(targetIdentity, username, provisioningItems);

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url,
                    username,
                    password,
                    workflowName: "LCM Provisioning",
                    input: [
                        { key: "plan", value: planXML, type: "application/xml" },
                        { key: "targetName", value: targetIdentity },
                        { key: "targetClass", value: "Identity" },
                        { key: "identityName", value: targetIdentity },
                        { key: "flow", value: "AccessRequest" }
                    ]
                }),
            });


            const data = await res.json();
            if (data.success) {
                // Extract identityRequestId from the SCIM response (matching Python pattern)
                let requestId = "Unknown";

                const workflowData = data.launchResult?.["urn:ietf:params:scim:schemas:sailpoint:1.0:LaunchedWorkflow"];

                // 1. Try direct access in workflow URN
                if (workflowData?.identityRequestId) {
                    requestId = workflowData.identityRequestId;
                }

                // 2. Fallback: Check attributes array
                if (requestId === "Unknown" && data.launchResult?.attributes) {
                    const idItem = data.launchResult.attributes.find((item: any) => item.key === "identityRequestId");
                    if (idItem?.value) {
                        requestId = idItem.value;
                    }
                }

                // 3. Fallback: Check output array in workflow URN
                if (requestId === "Unknown" && workflowData?.output) {
                    const idItem = workflowData.output.find((item: any) => item.key === "identityRequestId");
                    if (idItem?.value) {
                        requestId = idItem.value;
                    }
                }

                console.log("Extracted Request ID:", requestId);
                console.log("Full response (JSON):", JSON.stringify(data.launchResult, null, 2));
                console.log("Attributes array:", data.launchResult?.attributes);
                console.log("Workflow URN data:", workflowData);
                if (requestId !== "Unknown") {
                    setNotification({ type: 'success', message: `Request ID: ${requestId}. Access request submitted successfully.` });
                } else {
                    setNotification({ type: 'success', message: `Workflow Launched (ID: ${data.launchResult?.id}). Request ID not found.` });
                }
            } else {
                setNotification({ type: 'error', message: "Error: " + data.error });
            }
        } catch (e: any) {
            setNotification({ type: 'error', message: "Failed: " + e.message });
        } finally {
            setIsProvisioning(false);
            setProvisioningItems(null);
        }
    };

    if (isLoading) return null;
    if (!isAuthenticated) return null;

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 flex flex-col relative overflow-hidden font-sans selection:bg-indigo-500/30">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-950/20 to-transparent pointer-events-none" />
            <div className="absolute -top-[200px] left-[20%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute top-[10%] right-[20%] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-7xl mx-auto w-full space-y-10 flex-1 flex flex-col p-6 z-10">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight pb-1 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                            Access Comparator
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Analyze and synchronize identity access with precision.</p>
                    </div>
                </div>

                {/* Input Section - Glass Card with Loading Overlay */}
                {/* Notification Toast */}
                {notification && (
                    <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right fade-in duration-300 ${notification.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        <div className="flex items-center gap-3">
                            {notification.type === 'success' ? (
                                <ShieldCheck className="h-5 w-5" />
                            ) : (
                                <ShieldAlert className="h-5 w-5" />
                            )}
                            <p className="text-sm font-medium">{notification.message}</p>
                        </div>
                    </div>
                )}

                {/* Input Section - Glass Card */}
                <div className="relative mb-8 bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-end group hover:border-white/15 transition-all duration-500">
                    <div className="relative">
                        <UserSearch
                            label="Source Identity (Template)"
                            placeholder="Search template user..."
                            onSelect={setSourceUser}
                            value={sourceUser?.displayName}
                            disabled={loadingSource}
                        />
                        {loadingSource && (
                            <div className="absolute right-2 top-8">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                            </div>
                        )}
                    </div>

                    {/* Action Area */}
                    <div className="flex flex-col items-center justify-end h-full pb-1 relative">
                        {/* Provision Button & Connector */}
                        {sourceUser && targetUser && (
                            <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-48 z-20">
                                <button
                                    onClick={() => confirmProvisioning(targetUser.userName, diff?.uniqueToSource || [])}
                                    disabled={!diff?.uniqueToSource?.length || loadingTarget || loadingSource}
                                    className={`w-full text-xs font-bold uppercase tracking-wider px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all duration-300 ${diff?.uniqueToSource?.length > 0 && !loadingTarget && !loadingSource
                                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1"
                                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                                        }`}
                                >
                                    {loadingTarget || loadingSource ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ArrowRightLeft className="h-4 w-4" />
                                    )}
                                    {loadingTarget || loadingSource ? "Processing..." : (diff?.uniqueToSource?.length > 0 ? "Copy Access" : "Matched")}
                                </button>
                            </div>
                        )}

                        <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-800/50 border border-white/10 text-slate-400 shadow-inner">
                            <ArrowRightLeft className="h-5 w-5 opacity-50" />
                        </div>
                    </div>

                    <div className="relative">
                        <UserSearch
                            label="Target Identity (To Check)"
                            placeholder="Search target user..."
                            onSelect={setTargetUser}
                            value={targetUser?.displayName}
                            disabled={loadingTarget}
                        />
                        {loadingTarget && (
                            <div className="absolute right-2 top-8">
                                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Section */}
                {diff && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700">

                        {/* Missing Access */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                                        <ShieldAlert className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-amber-200">Missing Access</h3>
                                        <p className="text-xs text-amber-400/60 font-medium tracking-wide uppercase">
                                            {diff.uniqueToSource.length} Items to Add
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-xl flex-1 min-h-[400px] flex flex-col">
                                {diff.uniqueToSource.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                                        <ShieldCheck className="h-10 w-10 opacity-20" />
                                        <span className="text-sm">Parties are identical</span>
                                    </div>
                                ) : (
                                    <div className="overflow-auto flex-1 p-2 custom-scrollbar">
                                        <ul className="space-y-2">
                                            {diff.uniqueToSource.map((item: AccessItem, i: number) => (
                                                <li key={i} className="group p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all duration-200 flex flex-col gap-2">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <span className="text-sm text-slate-200 font-semibold leading-snug group-hover:text-amber-200 transition-colors">
                                                            {item.name}
                                                        </span>
                                                        <div className="shrink-0">
                                                            {renderBadge(item.type)}
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono bg-black/20 p-1.5 rounded w-fit border border-white/5">
                                                        {item.value}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Extra Access */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-500">
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-emerald-200">Existing Access</h3>
                                        <p className="text-xs text-emerald-400/60 font-medium tracking-wide uppercase">
                                            {diff.uniqueToTarget.length} Extra Items
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-xl flex-1 min-h-[400px] flex flex-col">
                                {diff.uniqueToTarget.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                                        <span className="text-sm">Target has no extra access</span>
                                    </div>
                                ) : (
                                    <div className="overflow-auto flex-1 p-2 custom-scrollbar">
                                        <ul className="space-y-2">
                                            {diff.uniqueToTarget.map((item: AccessItem, i: number) => (
                                                <li key={i} className="group p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all duration-200 flex flex-col gap-2">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <span className="text-sm text-slate-200 font-semibold leading-snug group-hover:text-emerald-200 transition-colors">
                                                            {item.name}
                                                        </span>
                                                        <div className="shrink-0">
                                                            {renderBadge(item.type)}
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono bg-black/20 p-1.5 rounded w-fit border border-white/5">
                                                        {item.value}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Debug Toggle */}
            <div className="p-4 flex justify-center opacity-30 hover:opacity-100 transition-opacity">
                <button onClick={() => setShowDebug(!showDebug)} className="text-[10px] uppercase font-bold tracking-widest text-slate-500 hover:text-slate-300">
                    {showDebug ? "Hide Debug System" : "Show System Status"}
                </button>
            </div>

            {/* Debug Section */}
            {showDebug && (
                <div className="mx-auto max-w-7xl w-full p-6 border-t border-slate-800 bg-slate-950">
                    <h3 className="text-sm font-bold mb-4 text-slate-500 uppercase tracking-wider">Debug Data</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-black/40 p-4 rounded-lg border border-slate-800 overflow-auto max-h-48">
                            <h4 className="font-mono text-xs text-blue-400 mb-2">Source Raw ({sourceAccess.length})</h4>
                            <pre className="text-[10px] text-slate-500 font-mono">
                                {JSON.stringify(sourceAccess, null, 2)}
                            </pre>
                        </div>
                        <div className="bg-black/40 p-4 rounded-lg border border-slate-800 overflow-auto max-h-48">
                            <h4 className="font-mono text-xs text-amber-400 mb-2">Target Raw ({targetAccess.length})</h4>
                            <pre className="text-[10px] text-slate-500 font-mono">
                                {JSON.stringify(targetAccess, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {provisioningItems && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-300">
                        {isProvisioning ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <div className="h-16 w-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mb-6" />
                                <h3 className="text-xl font-bold text-white mb-2">Requesting Access...</h3>
                                <p className="text-slate-400 text-center text-sm">Initiating LCM Provisioning workflow in SailPoint.</p>
                                <p className="text-slate-500 text-xs mt-2">This may take a few moments.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                                        <ArrowRightLeft className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Confirm Provisioning</h3>
                                        <p className="text-slate-400 text-sm">Review the access to be added.</p>
                                    </div>
                                </div>

                                <div className="bg-slate-950/50 rounded-xl p-4 mb-6 border border-white/5 max-h-48 overflow-y-auto">
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Adding {provisioningItems.length} Items to {targetUser?.userName}</div>
                                    <div className="space-y-2">
                                        {provisioningItems.map((item, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setProvisioningItems(null)}
                                        className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={executeProvisioning}
                                        className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-all"
                                    >
                                        Confirm & Provision
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
