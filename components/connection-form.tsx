"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/ui/auth-context";
import { useRouter } from "next/navigation";

export function ConnectionForm() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const { login } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState({
        url: "http://localhost:8080/identityiq",
        username: "spadmin",
        password: "admin"
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            const response = await fetch("/api/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            setResult(data);

            if (data.success) {
                // Login and redirect
                login(formData.url, formData.username, formData.password);
                setTimeout(() => {
                    router.push("/dashboard");
                }, 1000);
            }

        } catch (error: any) {
            setResult({ success: false, error: error.message || "Failed to contact server" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto space-y-8">
            <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tighter text-white">
                    SailPoint Connector
                </h1>
                <p className="text-slate-400">
                    Enter your IdentityIQ instance details to verify connectivity.
                </p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-xl p-6 shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                            Instance URL
                        </label>
                        <input
                            type="text"
                            placeholder="http://localhost:8080/identityiq"
                            required
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                            Username
                        </label>
                        <input
                            type="text"
                            placeholder="spadmin"
                            required
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="•••••"
                            required
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={cn(
                            "w-full flex items-center justify-center py-2.5 rounded-md font-medium transition-all duration-200",
                            loading
                                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_-5px_#2563eb]"
                        )}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            "Connect"
                        )}
                    </button>
                </form>
            </div>

            {result && (
                <div className={cn(
                    "rounded-xl border p-4 transition-all animate-in fade-in slide-in-from-bottom-4",
                    result.success
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                )}>
                    <div className="flex items-center gap-3 mb-2">
                        {result.success ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <h3 className="font-semibold">
                            {result.success ? "Connection Successful" : "Connection Failed"}
                        </h3>
                    </div>

                    <pre className="mt-2 p-3 bg-slate-950/50 rounded-lg text-xs font-mono overflow-auto max-h-40 text-slate-300">
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
