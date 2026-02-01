"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { Send, Bot, FileText, Loader2, Download, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function AIReportsPage() {
    const { isAuthenticated, url, username, password } = useAuth();
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState<any[]>([
        { role: "assistant", content: "Hello! I can help you run IdentityIQ reports. Try asking:\n- \"Members of 'Admins' group\"\n- \"Access for user 'James.Smith'\"" }
    ]);
    const [loading, setLoading] = useState(false);
    const [reports, setReports] = useState<any[]>([]);

    // Load Report Catalog on Mount
    useEffect(() => {
        if (isAuthenticated) {
            fetchReportCatalog();
        }
    }, [isAuthenticated]);

    const fetchReportCatalog = async () => {
        try {
            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url, username, password,
                    workflowName: "GetAllReports",
                    input: []
                }),
            });
            const data = await res.json();
            if (data.success && data.launchResult?.attributes) {
                const listStr = data.launchResult.attributes.find((a: any) => a.key === "reportList")?.value;
                if (listStr) {
                    setReports(JSON.parse(listStr));
                }
            }
        } catch (e) {
            console.error("Failed to load reports", e);
        }
    };

    const handleSend = async () => {
        if (!query.trim()) return;

        const userMsg = { role: "user", content: query };
        setMessages(prev => [...prev, userMsg]);
        setQuery("");
        setLoading(true);

        try {
            // Call AI Router directly
            // The Registry and LLM logic are now handled server-side in /api/ai-reports

            setMessages(prev => [...prev, { role: "assistant", content: "Thinking..." }]);

            const res = await fetch("/api/ai-reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: userMsg.content,
                    url, username, password
                }),
            });

            const data = await res.json();

            if (data.success || data.launchResult) {
                // Show debug information if available
                if (data.debug) {
                    const debugMsg = `🔍 **AI Debug Info**
**Query:** ${data.debug.query}
**Registry:** ${data.debug.registryCount} reports loaded
**Sample Reports:** ${data.debug.registrySample?.map((r: any) => r.name).join(', ')}
**AI Decision:**
- Report: ${data.debug.aiDecision?.reportName}
- Arguments: ${JSON.stringify(data.debug.aiDecision?.reportArgs, null, 2)}`;

                    setMessages(prev => {
                        const newMsgs = [...prev];
                        if (newMsgs[newMsgs.length - 1].content === "Thinking...") newMsgs.pop();
                        return [...newMsgs, {
                            role: "assistant",
                            content: debugMsg,
                            isDebug: true,
                            collapsed: true
                        }];
                    });
                }

                // Success! The AI chose a report and it launched.
                // Re-use logic to parse generic launchResult
                await handleLaunchResult(data, "AI Selected Report");
            } else {
                // Remove "Thinking..." and show error
                setMessages(prev => {
                    const newMsgs = [...prev];
                    if (newMsgs[newMsgs.length - 1].content === "Thinking...") newMsgs.pop();
                    return [...newMsgs, { role: "assistant", content: data.error || data.message || "I couldn't process that request." }];
                });
            }

        } catch (err: any) {
            setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    // Helper to handle the result (refactored from launchReport)
    const handleLaunchResult = async (data: any, reportName: string) => {
        // Remove "Thinking..." message
        setMessages(prev => {
            const newMsgs = [...prev];
            if (newMsgs[newMsgs.length - 1].content === "Thinking...") newMsgs.pop();
            return newMsgs;
        });

        let resultJson = null;
        // Parse generic output
        if (data.launchResult?.attributes) {
            const resStr = data.launchResult.attributes.find((a: any) => a.key === "launchResult")?.value;
            if (resStr) resultJson = JSON.parse(resStr);
        } else if (data.launchResult && typeof data.launchResult === 'string') {
            // Sometimes it comes directly as string depending on how workflow returns it
            try { resultJson = JSON.parse(data.launchResult); } catch (e) { }
        }

        if (resultJson) {
            const status = resultJson.completionStatus;
            const msgs = resultJson.messages || [];

            // Format messages properly (handle objects)
            let msgText = "";
            if (msgs.length > 0) {
                const formattedMsgs = msgs.map((m: any) => {
                    if (typeof m === 'string') return m;
                    if (m && typeof m === 'object') return JSON.stringify(m);
                    return String(m);
                });
                msgText = "\n**Messages:** " + formattedMsgs.join(", ");
            }

            const finalName = resultJson.fileName || "report.csv";

            // Handle File Download
            if (resultJson.fileContent) {
                try {
                    const byteCharacters = atob(resultJson.fileContent);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: resultJson.contentType || "application/octet-stream" });

                    const url = window.URL.createObjectURL(blob);
                    const fileSizeKB = Math.round(blob.size / 1024);

                    setMessages(prev => [...prev, {
                        role: "assistant",
                        content: `✅ **Report Generated Successfully!**\n\n**File:** ${finalName}\n**Size:** ${fileSizeKB} KB\n**Status:** ${status}`,
                        downloadUrl: url,
                        fileName: finalName
                    }]);
                } catch (e) {
                    setMessages(prev => [...prev, {
                        role: "assistant",
                        content: `Report completed but failed to process file: ${e}`
                    }]);
                }
            } else {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: `Report finished with status: **${status}**${msgText}.\n(No content returned - maybe no matches?)`
                }]);
            }
        } else {
            setMessages(prev => [...prev, { role: "assistant", content: "Workflow launched, but no immediate result returned." }]);
        }
    };

    return (
        <main className="min-h-screen bg-[#020617] text-slate-100 font-sans p-6 flex flex-col items-center">
            <div className="w-full max-w-4xl flex-1 flex flex-col bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-white/10 bg-slate-950/50 flex items-center gap-3">
                    <Bot className="h-6 w-6 text-indigo-400" />
                    <h1 className="font-bold text-lg">AI Report Assistant</h1>
                    <span className="text-xs text-slate-500 ml-auto">{reports.length} reports loaded</span>
                </div>

                {/* Messages Area */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl ${m.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'
                                }`}>
                                {m.isDebug ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                setMessages(prev => prev.map((msg, idx) =>
                                                    idx === i ? { ...msg, collapsed: !msg.collapsed } : msg
                                                ));
                                            }}
                                            className="flex items-center gap-2 text-sm font-medium text-indigo-300 hover:text-indigo-200 w-full text-left"
                                        >
                                            {m.collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                            🔍 AI Debug Info
                                        </button>
                                        {!m.collapsed && (
                                            <div className="mt-3 whitespace-pre-wrap text-xs text-slate-300 bg-slate-900/50 p-3 rounded border border-white/5">
                                                {m.content}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="whitespace-pre-wrap">{m.content}</div>
                                )}
                                {m.downloadUrl && (
                                    <button
                                        onClick={() => {
                                            const a = document.createElement("a");
                                            a.href = m.downloadUrl;
                                            a.download = m.fileName || "report.csv";
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                        }}
                                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Download className="h-4 w-4" />
                                        Download {m.fileName}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-800 p-4 rounded-2xl rounded-bl-none border border-white/5 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                <span className="text-xs text-slate-400">Processing...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-950/50 border-t border-white/10">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Describe the report you want..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !query.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
