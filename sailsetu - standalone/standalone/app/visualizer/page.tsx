"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    ConnectionLineType,
    Position,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Search, Share2, User, Shield, Box, Layers, Key, Download } from 'lucide-react';
import { useAuth } from '@/components/ui/sailpoint-context';
import { useRouter } from 'next/navigation';

// --- Dagre Layout Helper ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'LR') => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = isHorizontal ? Position.Left : Position.Top;
        node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

        // We are shifting the dagre node position (anchor=center center) to the top left
        // so it matches the React Flow node anchor point (top left).
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes, edges };
};

const AccessVisualizer = () => {
    const { url, username, password, isAuthenticated } = useAuth();
    const router = useRouter();

    const [targetIdentity, setTargetIdentity] = useState("");
    const [loading, setLoading] = useState(false);
    const [csvData, setCsvData] = useState<any[]>([]);

    // ReactFlow State
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Auth Check
    useEffect(() => {
        if (!isAuthenticated) router.push("/");
    }, [isAuthenticated, router]);

    const downloadCSV = () => {
        if (csvData.length === 0) return;

        const headers = ["Type", "Application", "Name", "Value"];
        const rows = csvData.map(row =>
            `"${row.Type}","${row.Application}","${row.Name}","${row.Value}"`
        );
        const csvContent = [headers.join(","), ...rows].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${targetIdentity}_access_export.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const fetchGraph = async () => {
        if (!targetIdentity) return;
        setLoading(true);
        setCsvData([]); // Reset CSV data

        try {
            const inputList = [{ key: "identityName", value: targetIdentity }];

            const res = await fetch("/api/workflow/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url, username, password,
                    workflowName: "GetIdentityGraph",
                    input: inputList
                }),
            });
            const data = await res.json();

            if (data.success && data.launchResult && data.launchResult.attributes) {
                // 1. Process Graph Data
                const gData = data.launchResult.attributes.find((a: any) => a.key === "graphData");
                if (gData && gData.value) {
                    // Backend returns a JSON string, so we must parse it
                    let parsedData = { nodes: [], edges: [] };
                    try {
                        parsedData = JSON.parse(gData.value);
                    } catch (e) {
                        // Fallback if backend sent map string (unlikely after fix, but good for safety)
                        console.error("Failed to parse graph JSON", e);
                    }

                    const rawNodes = parsedData.nodes || [];
                    const rawEdges = parsedData.edges || [];

                    // Transform to ReactFlow format
                    const rfNodes = rawNodes.map((n: any) => {
                        let style: any = { background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '8px', padding: '10px' };
                        let icon = <User size={16} />;

                        if (n.type === 'identity') {
                            style = { background: '#4f46e5', color: '#fff', border: '1px solid #6366f1', borderRadius: '50%', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' };
                        } else if (n.type === 'role') {
                            style = { ...style, background: '#0ea5e9', borderColor: '#38bdf8' };
                        } else if (n.type === 'account') {
                            style = { ...style, background: '#475569' };
                        } else if (n.type === 'entitlement') {
                            style = { ...style, background: '#10b981', borderColor: '#34d399', fontSize: '12px' };
                        } else if (n.type === 'entitlement_cluster') {
                            style = { ...style, background: '#1f2937', borderColor: '#10b981', borderStyle: 'dashed', borderWidth: '2px', fontSize: '12px' };
                            icon = <Layers size={16} />;
                        }

                        return {
                            id: n.id,
                            data: { label: n.label },
                            type: 'default', // Using default for simplicity, can create custom
                            style: style,
                            position: { x: 0, y: 0 } // Computed by dagre later
                        };
                    });

                    const rfEdges = rawEdges.map((e: any, i: number) => ({
                        id: `e-${i}`,
                        source: e.source,
                        target: e.target,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#64748b' }
                    }));

                    // Run Layout
                    const layouted = getLayoutedElements(rfNodes, rfEdges);
                    setNodes(layouted.nodes);
                    setEdges(layouted.edges);
                }

                // 2. Process CSV Details
                const cData = data.launchResult.attributes.find((a: any) => a.key === "accessDetails");
                if (cData && cData.value) {
                    try {
                        const parsedCsv = JSON.parse(cData.value);
                        setCsvData(parsedCsv);
                    } catch (e) {
                        console.error("Failed to parse CSV JSON", e);
                    }
                }

            } else {
                console.error("No graph data found", data);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) return null;

    return (
        <div className="h-screen w-full bg-slate-950 flex flex-col font-sans">
            {/* Header */}
            <div className="bg-slate-900 border-b border-white/10 p-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <Share2 className="text-indigo-400" />
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        Access Lineage Map
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            type="text"
                            className="bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Search Identity..."
                            value={targetIdentity}
                            onChange={e => setTargetIdentity(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchGraph()}
                        />
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    </div>
                    <button
                        onClick={fetchGraph}
                        disabled={loading || !targetIdentity}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {loading ? 'Mapping...' : 'Visualize'}
                    </button>

                    {csvData.length > 0 && (
                        <button
                            onClick={downloadCSV}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 bg-slate-950 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    attributionPosition="bottom-right"
                >
                    <MiniMap style={{ background: '#1e293b' }} nodeStrokeColor="#fff" nodeColor="#334155" />
                    <Controls />
                    <Background color="#334155" gap={16} />
                </ReactFlow>

                {nodes.length === 0 && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center text-slate-600">
                            <Share2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">Enter an Identity to generate their Access Graph</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccessVisualizer;
