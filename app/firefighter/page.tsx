"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/ui/auth-context';
import { AlertTriangle, Clock, ShieldAlert, BadgeCheck, Flame } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FirefighterPage() {
    const { url, username, password, isAuthenticated } = useAuth();
    const router = useRouter();

    const [active, setActive] = useState(false);
    const [expiry, setExpiry] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);

    const [targetUser, setTargetUser] = useState(username);
    const [targetApp, setTargetApp] = useState("TRAKK");
    const [attrName, setAttrName] = useState("capability");
    const [attrValue, setAttrValue] = useState("super");

    useEffect(() => {
        if (!isAuthenticated) router.push("/");
    }, [isAuthenticated, router]);

    // Timer Logic
    useEffect(() => {
        if (!active || !expiry) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const diff = expiry - now;

            if (diff <= 0) {
                setActive(false);
                setExpiry(null);
                setTimeLeft("00:00:00");
                clearInterval(interval);
                // Ideally trigger auto-revoke here
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [active, expiry]);

    const activateEmergency = async () => {
        if (!reason || !targetUser || !targetApp) return;
        setLoading(true);
        try {
            // Call Workflow
            const inputList = [
                { key: "identityName", value: targetUser },
                { key: "durationMinutes", value: "60" },
                { key: "targetApp", value: targetApp },
                { key: "attributeName", value: attrName },
                { key: "attributeValue", value: attrValue }
            ];

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url, username, password,
                    workflowName: "SetEmergencyAccess",
                    input: inputList
                }),
            });
            const data = await res.json();

            if (data.success && data.launchResult && data.launchResult.attributes) {
                const expAttr = data.launchResult.attributes.find((a: any) => a.key === "expiryTimestamp");
                if (expAttr) {
                    setExpiry(Number(expAttr.value));
                    setActive(true);
                }
            } else {
                console.error("Failed to activate", data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const revokeAccess = async () => {
        if (!targetUser || !targetApp) return;
        setLoading(true);
        try {
            const inputList = [
                { key: "identityName", value: targetUser },
                { key: "targetApp", value: targetApp },
                { key: "attributeName", value: attrName },
                { key: "attributeValue", value: attrValue }
            ];

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url, username, password,
                    workflowName: "RevokeEmergencyAccess",
                    input: inputList
                }),
            });
            const data = await res.json();

            if (data.success) {
                setActive(false);
                setExpiry(null);
                alert("Access Revoked Successfully.");
            } else {
                alert("Failed to revoke access. Please check SailPoint logs.");
            }
        } catch (e) {
            console.error(e);
            alert("Error invoking revocation workflow.");
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden">

            {/* Background Ambience */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${active ? 'opacity-20' : 'opacity-5'}`}>
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-900 via-slate-900 to-slate-900 animate-pulse"></div>
            </div>

            <div className="z-10 max-w-2xl w-full">

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-full border border-slate-700 mb-6 shadow-2xl">
                        {active ? <Flame className="h-12 w-12 text-red-500 animate-bounce" /> : <ShieldAlert className="h-12 w-12 text-slate-400" />}
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">
                        {active ? <span className="text-red-500">EMERGENCY MODE ACTIVE</span> : "Firefighter Access"}
                    </h1>
                    <p className="text-slate-400">
                        {active ? "All actions are being logged. Access will automatically expire." : "Request temporary administrative privileges for emergency maintenance."}
                    </p>
                </div>

                {/* Main Card */}
                <div className={`bg-slate-900/80 backdrop-blur-xl border ${active ? 'border-red-500/50 shadow-red-900/20' : 'border-slate-800'} rounded-2xl p-8 shadow-2xl transition-all duration-500`}>

                    {active ? (
                        <div className="flex flex-col items-center">
                            <div className="text-8xl font-mono font-bold text-red-500 mb-8 tabular-nums tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                                {timeLeft}
                            </div>

                            <div className="w-full bg-slate-800 rounded-lg p-4 mb-8 border border-slate-700">
                                <div className="flex items-center gap-3 text-slate-300 mb-2">
                                    <BadgeCheck className="text-emerald-500" />
                                    <span>Privileges Granted to {targetUser}</span>
                                </div>
                                <div className="text-sm text-slate-500 pl-9 space-y-1">
                                    <p>Target: <span className="text-slate-300">{targetApp}</span></p>
                                    <p>Entitlement: <span className="text-slate-300">{attrName} = {attrValue}</span></p>
                                </div>
                            </div>

                            <button
                                onClick={revokeAccess}
                                className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold transition-all"
                            >
                                TERMINATE SESSION
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Target Identity</label>
                                    <input
                                        type="text"
                                        value={targetUser} onChange={e => setTargetUser(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Application</label>
                                    <input
                                        type="text"
                                        value={targetApp} onChange={e => setTargetApp(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Entitlement Name</label>
                                    <input
                                        type="text"
                                        value={attrName} onChange={e => setAttrName(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Entitlement Value</label>
                                    <input
                                        type="text"
                                        value={attrValue} onChange={e => setAttrValue(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Reason for Access</label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Database outage incident INC-2039..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none transition-all placeholder:text-slate-600"
                                />
                            </div>

                            <div className="flex items-center gap-4 mb-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                <AlertTriangle className="text-orange-500 shrink-0" />
                                <div className="text-sm text-orange-200">
                                    This action will trigger a security alert. Session limited to 60m.
                                </div>
                            </div>

                            <button
                                onClick={activateEmergency}
                                disabled={!reason || loading}
                                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all ${!reason || loading
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-orange-900/20 group'
                                    }`}
                            >
                                {loading ? (
                                    <Clock className="animate-spin" />
                                ) : (
                                    <>
                                        <Flame className={`${reason ? 'group-hover:animate-pulse' : ''}`} />
                                        ACTIVATE EMERGENCY ACCESS
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
}
