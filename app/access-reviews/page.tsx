"use client";

import { useState, useEffect } from 'react';
import {
    CheckCircle2, XCircle, Loader2,
    FileText, ArrowRight, UserCheck, Shield
} from 'lucide-react';
import Link from 'next/link';

export default function AccessReviewsPage() {
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState<any[]>([]);
    const [selectedReview, setSelectedReview] = useState<any | null>(null);
    const [items, setItems] = useState<any[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Decisions: { [itemId]: 'Approved' | 'Revoked' }
    const [decisions, setDecisions] = useState<{ [key: string]: string }>({});
    const [saving, setSaving] = useState(false);

    // Load Reviews on Mount
    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            // Default to 'spadmin' or use session user
            const auth = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");
            const reviewer = auth.username || "spadmin";

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: auth.url,
                    username: auth.username,
                    password: auth.password,
                    workflowName: "GetPendingReviews",
                    input: { reviewerName: reviewer }
                }),
            });

            const data = await res.json();

            if (data.success && data.launchResult) {
                let attrs = data.launchResult.attributes;
                let list = [];

                if (Array.isArray(attrs)) {
                    // Standard SCIM: attributes is Array of {key, value}
                    const reviewAttr = attrs.find((a: any) => a.key === 'reviews');
                    if (reviewAttr) {
                        try {
                            list = JSON.parse(reviewAttr.value);
                        } catch (e) { console.error("JSON parse error for reviews:", e); }
                    }
                } else if (attrs && typeof attrs === 'object') {
                    // Fallback
                    if (attrs.reviews) {
                        try {
                            list = typeof attrs.reviews === 'string' ? JSON.parse(attrs.reviews) : attrs.reviews;
                        } catch (e) { console.error("JSON parse error fallback:", e); }
                    }
                }

                setReviews(list || []);
            }
        } catch (e) {
            console.error("Fetch Execution Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectReview = async (review: any) => {
        setSelectedReview(review);
        setLoadingItems(true);
        setDecisions({}); // Reset decisions
        try {
            const auth = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");
            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: auth.url,
                    username: auth.username,
                    password: auth.password,
                    workflowName: "GetReviewItems",
                    input: { workItemId: review.id } // Reverted to use workItemId (review.id in older xml)
                }),
            });

            const data = await res.json();
            if (data.success && data.launchResult?.attributes) {
                let list = [];
                const itemsAttr = data.launchResult.attributes.find((a: any) => a.key === 'items');
                if (itemsAttr && itemsAttr.value) {
                    try {
                        list = JSON.parse(itemsAttr.value);
                    } catch (e) { console.error("Parse error", e); }
                }
                setItems(list);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleDecision = (itemId: string, decision: string) => {
        setDecisions(prev => ({
            ...prev,
            [itemId]: decision
        }));
    };

    const saveDecisions = async () => {
        if (!selectedReview) return;
        setSaving(true);
        try {
            // Construct payload
            const payload = Object.keys(decisions).map(itemId => ({
                itemId,
                decision: decisions[itemId]
            }));

            if (payload.length === 0) return;

            const auth = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");
            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: auth.url,
                    username: auth.username,
                    password: auth.password,
                    workflowName: "MakeReviewDecision",
                    input: {
                        workItemId: selectedReview.id,
                        items: JSON.stringify(payload)
                    }
                }),
            });

            const data = await res.json();
            if (data.success) {
                // Refresh items
                handleSelectReview(selectedReview);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        Access Certifications
                    </h1>
                    <p className="text-slate-400 mt-2">Review and approve access for your team.</p>
                </div>
                <Link href="/" className="px-4 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
                    Back to Dashboard
                </Link>
            </header>

            {!selectedReview ? (
                // LIST VIEW
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        <div className="col-span-3 flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="col-span-3 text-center py-20 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                            <UserCheck className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                            <h3 className="text-lg font-medium text-slate-300">All Caught Up!</h3>
                            <p className="text-slate-500">You have no pending access reviews.</p>
                        </div>
                    ) : (
                        reviews.map((r) => (
                            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-blue-500/50 transition-colors group relative cursor-pointer" onClick={() => handleSelectReview(r)}>
                                <div className="absolute top-4 right-4">
                                    <span className="px-2 py-1 text-xs font-mono bg-blue-900/30 text-blue-400 rounded border border-blue-900/50">
                                        {r.type || 'Review'}
                                    </span>
                                </div>
                                <div className="mb-4">
                                    <div className="p-3 bg-slate-950 rounded-lg w-fit mb-3 border border-slate-800 group-hover:border-blue-500/30">
                                        <FileText className="h-6 w-6 text-blue-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-100 mb-1">{r.target || r.name}</h3>
                                    <p className="text-sm text-slate-500">Created: {r.created?.split(' ')[0]}</p>
                                </div>
                                <div className="flex items-center text-sm text-blue-400 font-medium group-hover:text-blue-300">
                                    Review Items <ArrowRight className="ml-2 h-4 w-4" />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                // DETAIL VIEW
                <div className="space-y-6">
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={() => setSelectedReview(null)}
                            className="text-slate-400 hover:text-white flex items-center gap-2"
                        >
                            &larr; Back
                        </button>
                        <h2 className="text-2xl font-semibold border-l-2 border-slate-700 pl-4">
                            Review for: <span className="text-blue-400">{selectedReview.target || selectedReview.name}</span>
                        </h2>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        {loadingItems ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">No items found in this review.</div>
                        ) : (
                            <div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-medium">
                                            <tr>
                                                <th className="px-6 py-4">Identity</th>
                                                <th className="px-6 py-4">Item Type</th>
                                                <th className="px-6 py-4">Value</th>
                                                <th className="px-6 py-4">Current Status</th>
                                                <th className="px-6 py-4 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {items.map((item) => {
                                                const currentDec = decisions[item.id] || item.decision || 'Open';
                                                const isFinal = item.decision === 'Approved' || item.decision === 'Remediated' || item.decision === 'Revoked';

                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-slate-200">{item.identity}</td>
                                                        <td className="px-6 py-4 text-slate-400 font-mono">{item.attribute}</td>
                                                        <td className="px-6 py-4 text-slate-300">{item.value}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${currentDec === 'Approved' ? 'bg-green-900/20 text-green-400 border-green-900/50' :
                                                                currentDec === 'Revoked' || currentDec === 'Remediated' ? 'bg-red-900/20 text-red-400 border-red-900/50' :
                                                                    'bg-yellow-900/20 text-yellow-400 border-yellow-900/50'
                                                                }`}>
                                                                {currentDec}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex justify-center gap-2">
                                                                <button
                                                                    onClick={() => handleDecision(item.id, 'Approved')}
                                                                    disabled={isFinal}
                                                                    className={`p-2 rounded-lg transition-all ${currentDec === 'Approved' ? 'bg-green-500 text-white shadow-lg shadow-green-900/20' :
                                                                        isFinal ? 'opacity-20 cursor-not-allowed' :
                                                                            'bg-slate-800 text-slate-400 hover:bg-green-900/30 hover:text-green-400'
                                                                        }`}
                                                                    title="Approve"
                                                                >
                                                                    <CheckCircle2 className="h-5 w-5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDecision(item.id, 'Revoked')}
                                                                    disabled={isFinal}
                                                                    className={`p-2 rounded-lg transition-all ${currentDec === 'Revoked' ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' :
                                                                        isFinal ? 'opacity-20 cursor-not-allowed' :
                                                                            'bg-slate-800 text-slate-400 hover:bg-red-900/30 hover:text-red-400'
                                                                        }`}
                                                                    title="Revoke"
                                                                >
                                                                    <XCircle className="h-5 w-5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* FOOTER ACTION */}
                                <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3 sticky bottom-0">
                                    <div className="flex items-center text-sm text-slate-500 mr-auto">
                                        {Object.keys(decisions).length} decisions pending save
                                    </div>
                                    <button
                                        onClick={saveDecisions}
                                        disabled={saving || Object.keys(decisions).length === 0}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                                        Save Decisions
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm("Are you sure you want to Sign Off this review? This will complete the certification.")) {
                                                const auth = JSON.parse(sessionStorage.getItem("sp_auth") || "{}");
                                                setSaving(true);

                                                // Construct complete payload: Include pending, existing, or default to Approved
                                                const payload = items.map(item => ({
                                                    itemId: item.id,
                                                    decision: decisions[item.id] || item.decision || 'Approved'
                                                }));

                                                fetch("/api/workflow/launch", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({
                                                        url: auth.url,
                                                        username: auth.username,
                                                        password: auth.password,
                                                        workflowName: "MakeReviewDecision",
                                                        input: {
                                                            workItemId: selectedReview.id,
                                                            signOff: "true",
                                                            items: JSON.stringify(payload)
                                                        }
                                                    }),
                                                })
                                                    .then(res => res.json())
                                                    .then(data => {
                                                        console.log("SignOff Response:", data);
                                                        if (data.success) {
                                                            alert("Certification Signed Off!");
                                                            setSelectedReview(null);
                                                            fetchReviews();
                                                        }
                                                    })
                                                    .finally(() => setSaving(false));
                                            }
                                        }}
                                        disabled={saving}
                                        className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Sign Off
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
