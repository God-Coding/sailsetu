"use client";

import { useState } from "react";
import { useAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";
import { Terminal, Play, Save, Code, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import Editor, { useMonaco } from "@monaco-editor/react";

import { SAILPOINT_TYPES } from "@/components/editor/sailpoint-types";

export default function RuleRunnerPage() {
    const { isAuthenticated, url, username, password, isLoading } = useAuth();
    const router = useRouter();

    const [script, setScript] = useState(`// Write your BeanShell code here
// Context variables: context, log
// Example:

import sailpoint.object.Identity;

Identity myself = context.getObjectByName(Identity.class, "spadmin");
if (myself != null) {
  return "Hello " + myself.getDisplayName();
}
return "User not found";`);

    const [ruleName, setRuleName] = useState("");
    const [ruleType, setRuleType] = useState(""); // Default to Generic (No Type)
    const [output, setOutput] = useState("");
    const [loading, setLoading] = useState(false);

    // SailPoint Type Definitions and Autocomplete Logic
    const handleEditorDidMount = (editor: any, monaco: any) => {
        // Parse the raw TS definitions into a usable structure
        // Map<ClassName, Method[]>
        const classDefinitions: Record<string, any[]> = {};

        // Manual parsing of the simplified "declare class" format
        const lines = SAILPOINT_TYPES.split('\n');
        let currentClass = "";

        lines.forEach(line => {
            line = line.trim();
            if (line.startsWith("declare class ")) {
                currentClass = line.replace("declare class ", "").replace(" {", "").trim();
                classDefinitions[currentClass] = [];
            } else if (line.startsWith("}") || line === "") {
                // end of class or empty
            } else if (currentClass && line.includes("(") && line.includes("):")) {
                // Parse method: name(args): ReturnType;
                // Example: getDisplayName(): String;
                const match = line.match(/^(\w+)\((.*)\): (.*);$/);
                if (match) {
                    const [_, name, args, ret] = match;
                    classDefinitions[currentClass].push({
                        label: name,
                        kind: monaco.languages.CompletionItemKind.Method,
                        insertText: name, // generic insert
                        detail: `(${args}) : ${ret}`,
                        documentation: `Returns ${ret}`
                    });
                }
            }
        });

        // Register the Completion Provider for 'java'
        monaco.languages.registerCompletionItemProvider('java', {
            triggerCharacters: ['.'],
            provideCompletionItems: (model: any, position: any) => {
                const textUntilPosition = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                // Check if the last character is a dot
                if (!textUntilPosition.endsWith('.')) {
                    return { suggestions: [] };
                }

                // Extract the variable name before the dot
                const match = textUntilPosition.match(/([a-zA-Z0-9_]+)\.$/);
                if (!match) return { suggestions: [] };

                const variableName = match[1];
                let className = null;

                // 1. Check Keywords
                if (variableName === 'context') className = "SailPointContext";
                if (variableName === 'log') className = "Log"; // We didn't define Log class in definitions but we can mockup if needed, mostly used for simple logging

                // 2. Scan code to find declaration "Type variableName"
                // Simple regex scan of the whole file (fast enough for small scripts)
                if (!className) {
                    const code = model.getValue();
                    // Regex to find "Type variable =" or "Type variable;" or "Type variable "
                    // Matches "Identity myself" or "sailpoint.object.Identity myself"
                    const declRegex = new RegExp(`(?:[\\w.]+\\.)?(\\w+)\\s+${variableName}\\b`);
                    const found = code.match(declRegex);
                    if (found) {
                        className = found[1]; // The captured Type name
                    }
                }

                // 3. Inference from assignement? (Too complex for simple regex, start with declaring Ref)

                if (className && classDefinitions[className]) {
                    return {
                        suggestions: classDefinitions[className].map((m: any) => ({
                            ...m,
                            range: {
                                startLineNumber: position.lineNumber,
                                endLineNumber: position.lineNumber,
                                startColumn: position.column,
                                endColumn: position.column
                            },
                            // Logic to add '()' if needed? 
                            // for now just method name
                            insertText: m.label
                        }))
                    };
                }

                // Default suggestions (e.g. methods on Object? or standard snippets)
                return { suggestions: [] };
            }
        });
    };


    const execute = async (action: "execute" | "save") => {
        setLoading(true);
        setOutput("");

        try {
            const inputList = [
                { key: "source", value: script },
                { key: "action", value: action },
                { key: "ruleName", value: ruleName },
                { key: "ruleType", value: ruleType }
            ];

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url, username, password,
                    workflowName: "ExecuteRule",
                    input: inputList
                }),
            });

            const data = await res.json();

            if (data.success) {
                let msg = "Job Launched.";
                if (data.launchResult && data.launchResult.attributes) {
                    const r = data.launchResult.attributes.find((a: any) => a.key === "result");
                    if (r) msg = r.value;
                }
                setOutput(msg);
            } else {
                setOutput("Error: " + (data.error || "Unknown API Error"));
            }

        } catch (e: any) {
            setOutput("Exception: " + e.message);
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

            <div className="max-w-6xl mx-auto p-6 relative z-10 flex flex-col h-screen">
                <div className="mb-6 border-b border-white/5 pb-4 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
                            <Terminal className="h-8 w-8 text-indigo-400" />
                            Rule Runner
                        </h1>
                        <p className="text-slate-400 text-sm mt-2">Execute BeanShell snippets directly or save as Rules.</p>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                    {/* Left: Editor */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-[#1e1e1e] border border-slate-700 rounded-xl overflow-hidden shadow-xl flex flex-col flex-1 min-h-[400px]">
                            <Editor
                                height="100%"
                                defaultLanguage="java" // Using java syntax highlighting usually works best for BeanShell
                                theme="vs-dark"
                                value={script}
                                onChange={(val: string | undefined) => setScript(val || "")}
                                onMount={handleEditorDidMount}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    wordWrap: "on",
                                    padding: { top: 16, bottom: 16 }
                                }}
                            />
                        </div>

                        {/* Controls */}
                        {/* Controls */}
                        <div className="flex flex-col lg:flex-row gap-4 justify-between bg-slate-900/40 p-4 rounded-xl border border-white/5">

                            {/* Inputs Group - Flexes to fill width, stacks on very small screens */}
                            <div className="flex flex-1 gap-3 min-w-0 flex-wrap">
                                <input
                                    type="text"
                                    placeholder="Rule Name (for saving)"
                                    value={ruleName}
                                    onChange={(e) => setRuleName(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white flex-[2] focus:ring-1 focus:ring-emerald-500 outline-none min-w-[150px]"
                                />

                                <select
                                    value={ruleType}
                                    onChange={(e) => setRuleType(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none w-[160px]"
                                >
                                    <option value="">Generic (No Type)</option>
                                    <option value="IdentityAttribute">IdentityAttribute</option>
                                    <option value="BuildMap">BuildMap</option>
                                    <option value="Correlation">Correlation</option>
                                    <option value="Validation">Validation</option>
                                    <option value="Workflow">Workflow</option>
                                    <option value="FieldValue">FieldValue</option>
                                    <option value="Listener">Listener</option>
                                </select>
                            </div>

                            {/* Buttons Group - Stacks below on mobile, inline on desktop */}
                            <div className="flex gap-3 shrink-0">
                                <button
                                    onClick={() => execute("execute")}
                                    disabled={loading}
                                    className="flex-1 lg:flex-none px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 shadow-indigo-500/20 whitespace-nowrap min-w-[120px]"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                                    Execute
                                </button>

                                <button
                                    onClick={() => execute("save")}
                                    disabled={loading || !ruleName}
                                    className="flex-1 lg:flex-none px-6 py-2 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/20 whitespace-nowrap min-w-[120px]"
                                >
                                    <Save className="h-4 w-4" />
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Output */}
                    <div className="flex flex-col gap-2">
                        <h2 className="text-sm font-medium text-slate-400 ml-1">Output Console</h2>
                        <div className="bg-black/80 border border-slate-800 rounded-xl p-4 font-mono text-sm text-green-400 flex-1 overflow-auto whitespace-pre-wrap shadow-inner min-h-[200px]">
                            {output || <span className="text-slate-600 italic">No output yet. Run the script to see results.</span>}
                        </div>
                    </div>
                </div>
            </div>
        </main >
    );
}
