"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { Smartphone, CheckCircle, RefreshCw, AlertCircle, Shield } from "lucide-react";
import Image from "next/image";

export default function WhatsAppPage() {
    const { url, username, password, isAuthenticated } = useAuth();
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("disconnected");
    const [loading, setLoading] = useState(true);

    // Sync credentials to backend
    useEffect(() => {
        if (isAuthenticated && url) {
            fetch('/api/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_config',
                    config: { url, username, password }
                })
            }).catch(console.error);
        }
    }, [isAuthenticated, url, username, password]);

    // Connect to SSE stream
    useEffect(() => {
        const evtSource = new EventSource('/api/whatsapp?mode=stream');

        evtSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setStatus(data.status);
                setQrCode(data.qrCode);
                setLoading(false);
            } catch (e) {
                console.error("Parse error", e);
            }
        };

        evtSource.onerror = () => {
            console.log("SSE Connection lost. Retrying...");
            // EventSource auto-retries, but we can set loading
            // setLoading(true);
        };

        return () => {
            evtSource.close();
        };
    }, []);

    return (
        <div className="container mx-auto py-10 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Smartphone className="h-8 w-8 text-green-600" />
                WhatsApp Integration
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Connection Status & QR */}
                <div className="rounded-xl border bg-card text-card-foreground shadow">
                    <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold leading-none tracking-tight">Link Device</h3>
                        <p className="text-sm text-muted-foreground">Scan the QR code with WhatsApp on your phone</p>
                    </div>
                    <div className="p-6 pt-0 flex flex-col items-center justify-center min-h-[300px]">
                        {loading && <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />}

                        {!loading && status === 'ready' && (
                            <div className="text-center space-y-4">
                                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                                <h3 className="text-xl font-semibold text-green-600">Connected!</h3>
                                <p className="text-gray-500">
                                    SailSetu is now linked to your WhatsApp.
                                    <br />
                                    Try sending <strong>!tools</strong> to the bot.
                                </p>
                            </div>
                        )}

                        {!loading && status !== 'ready' && qrCode && (
                            <div className="bg-white p-4 rounded-lg shadow-inner border">
                                {/* Next.js Image might be tricky with data URL if domains not configured, use img tag */}
                                <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                            </div>
                        )}

                        {!loading && status !== 'ready' && !qrCode && (
                            <div className="text-center text-gray-500">
                                <p>Waiting for QR Code...</p>
                                <p className="text-xs mt-2 text-indigo-400">Booting WhatsApp Engine (takes ~20-30s)...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Instructions */}
                <div className="rounded-xl border bg-card text-card-foreground shadow">
                    <div className="flex flex-col space-y-1.5 p-6">
                        <h3 className="font-semibold leading-none tracking-tight">How to use</h3>
                    </div>
                    <div className="p-6 pt-0 space-y-4">
                        <div className="space-y-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                <Shield className="h-4 w-4" /> Setup
                            </h4>
                            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                                <li>Open WhatsApp on your phone</li>
                                <li><strong>Menu</strong> (or Settings) {'>'} <strong>Linked Devices</strong></li>
                                <li>Tap <strong>Link a Device</strong></li>
                                <li>Scan the QR code shown here</li>
                                <li className="font-semibold text-indigo-600 mt-2">
                                    Finally, open your own chat ("You" or "Note to Self") and message <code>!tools</code>
                                </li>
                            </ol>
                        </div>

                        <div className="border-t pt-4 space-y-2">
                            <h4 className="font-semibold">Available Commands</h4>
                            <ul className="text-sm space-y-2">
                                <li className="bg-slate-100 p-2 rounded">
                                    <code className="font-bold text-blue-600">!tools</code>
                                    <div className="text-xs text-gray-500">Show available tools menu</div>
                                </li>
                                <li className="bg-slate-100 p-2 rounded">
                                    <code className="font-bold text-blue-600">!status</code>
                                    <div className="text-xs text-gray-500">Check connection</div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
