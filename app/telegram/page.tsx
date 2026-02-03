"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { Send, CheckCircle, RefreshCw, AlertCircle, Shield, Bot } from "lucide-react";

export default function TelegramPage() {
    const { url, username, password, telegramToken, updateTelegramToken, isAuthenticated } = useAuth();
    const [status, setStatus] = useState<string>("disconnected");
    const [loading, setLoading] = useState(true);
    const [newToken, setNewToken] = useState(telegramToken || "");
    const [updating, setUpdating] = useState(false);

    // Sync credentials to backend (same as WhatsApp page logic, but specific to TG)
    useEffect(() => {
        if (isAuthenticated && url && telegramToken) {
            fetch('/api/whatsapp', { // We use the same endpoint but it handles TG token too
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_config',
                    config: { url, username, password },
                    telegramToken: telegramToken
                })
            }).then(r => r.json())
                .then(data => {
                    if (data.success) setStatus('connected');
                    setLoading(false);
                })
                .catch(e => {
                    console.error(e);
                    setStatus('error');
                    setLoading(false);
                });
        } else {
            setLoading(false);
            if (!telegramToken) setStatus('disconnected');
        }
    }, [isAuthenticated, url, username, password, telegramToken]);

    const handleTokenUpdate = async () => {
        setUpdating(true);
        try {
            // Update Context
            updateTelegramToken(newToken);

            // Immediately sync to backend
            const response = await fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_config',
                    config: { url, username, password },
                    telegramToken: newToken
                })
            });
            const data = await response.json();
            if (data.success) {
                setStatus('connected');
                alert("Telegram Token updated successfully!");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to update token.");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="container mx-auto py-10 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Send className="h-8 w-8 text-blue-500" />
                Telegram Integration
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Connection Status */}
                <div className="flex flex-col gap-8">
                    <div className="rounded-xl border bg-card text-card-foreground shadow">
                        <div className="flex flex-col space-y-1.5 p-6">
                            <h3 className="font-semibold leading-none tracking-tight">Bot Status</h3>
                            <p className="text-sm text-muted-foreground">Monitor the health of your Telegram Bot</p>
                        </div>
                        <div className="p-6 pt-0 flex flex-col items-center justify-center min-h-[250px]">
                            {loading && <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />}

                            {!loading && status === 'connected' && (
                                <div className="text-center space-y-4">
                                    <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
                                    <h3 className="text-xl font-semibold text-emerald-400">Bot Active</h3>
                                    <p className="text-gray-400">
                                        SailSetu is successfully polling Telegram.
                                        <br />
                                        Your bot is ready to process requests.
                                    </p>
                                </div>
                            )}

                            {!loading && status === 'disconnected' && (
                                <div className="text-center space-y-4">
                                    <AlertCircle className="h-16 w-16 text-amber-500 mx-auto" />
                                    <h3 className="text-xl font-semibold text-amber-400">No Token</h3>
                                    <p className="text-gray-400">
                                        Telegram token is missing or invalid.
                                        <br />
                                        Please enter your token below.
                                    </p>
                                </div>
                            )}

                            {!loading && status === 'error' && (
                                <div className="text-center space-y-4">
                                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
                                    <h3 className="text-xl font-semibold text-red-400">Connection Error</h3>
                                    <p className="text-gray-400">
                                        Failed to establish connection to Telegram API.
                                        <br />
                                        Check your server logs and token validity.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Token Configuration Card */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow">
                        <div className="flex flex-col space-y-1.5 p-6">
                            <h3 className="font-semibold leading-none tracking-tight">Configuration</h3>
                            <p className="text-sm text-muted-foreground">Update your Telegram Bot Token</p>
                        </div>
                        <div className="p-6 pt-0 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Bot Token</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        placeholder="123456789:ABCdef..."
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={newToken}
                                        onChange={(e) => setNewToken(e.target.value)}
                                    />
                                    <button
                                        onClick={handleTokenUpdate}
                                        disabled={updating}
                                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
                                    >
                                        {updating ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save"}
                                    </button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Get your token from <a href="https://t.me/botfather" target="_blank" className="text-blue-500 underline">@BotFather</a>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="rounded-xl border bg-card text-card-foreground shadow">
                    <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold leading-none tracking-tight">Telegram Features</h3>
                    </div>
                    <div className="p-6 pt-0 space-y-4">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <Bot className="h-4 w-4" /> Usage
                            </h4>
                            <ol className="list-decimal list-inside text-sm text-slate-400 space-y-1">
                                <li>Search for your bot username on Telegram</li>
                                <li>Tap <strong>Start</strong></li>
                                <li>If not linked, send your SailPoint username</li>
                                <li>Enter your password when prompted</li>
                                <li className="font-semibold text-blue-400 mt-2">
                                    Type <code>/start</code> or <code>!menu</code> anytime
                                </li>
                            </ol>
                        </div>

                        <div className="border-t border-slate-800 pt-4 space-y-2">
                            <h4 className="font-semibold">Security Note</h4>
                            <p className="text-xs text-slate-500">
                                Telegram IDs are mapped to SailPoint identities via the <code>phone</code> attribute.
                                Ensure your bot token is kept private and corresponds to a bot created via @BotFather.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
