"use client";

import { useState, useEffect } from "react";
import { Upload, Save, Search, Check, AlertCircle, Image as ImageIcon, Paintbrush } from "lucide-react";

const logoTypes = [
    { id: "loginLogo", label: "Login Page Logo", filename: "loginLogo.png" },
    { id: "TopLogo1", label: "Top Banner Logo", filename: "TopLogo1.png" },
    { id: "mobilelogo", label: "Mobile Logo", filename: "mobilelogo.png" },
    { id: "favicon", label: "Favicon", filename: "favicon.ico/png" },
];

export default function ProductCustomizationPage() {
    const [installPath, setInstallPath] = useState("");

    // Color State
    const [navbarColor, setNavbarColor] = useState("#003366");
    const [headingColor, setHeadingColor] = useState("#003366");
    const [quicklinkColor, setQuicklinkColor] = useState("#003366");
    const [hoverColor, setHoverColor] = useState("#004488");

    // File State (Multi-upload)
    const [files, setFiles] = useState<{ [key: string]: File }>({});
    const [previews, setPreviews] = useState<{ [key: string]: string }>({});

    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null, message: string }>({ type: null, message: "" });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        detectPath();
    }, []);

    const detectPath = async () => {
        setIsLoading(true);
        setStatus({ type: "info", message: "Detecting IdentityIQ installation..." });
        try {
            const res = await fetch("/api/detect-path");
            const data = await res.json();
            if (data.found && data.path) {
                setInstallPath(data.path);
                setStatus({ type: "success", message: "IdentityIQ installation detected!" });
            } else {
                setStatus({ type: "info", message: "Could not auto-detect. Please manually enter the path." });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Failed to run auto-detection." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleColorSubmit = async () => {
        if (!installPath) {
            setStatus({ type: "error", message: "Installation path is required." });
            return;
        }

        setIsLoading(true);
        setStatus({ type: "info", message: "Updating CSS..." });

        try {
            const res = await fetch("/api/customize-css", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    installPath,
                    navbarColor,
                    headingColor,
                    quicklinkColor,
                    hoverColor
                }),
            });
            const data = await res.json();

            if (res.ok) {
                setStatus({ type: "success", message: "Successfully updated UI colors!" });
            } else {
                setStatus({ type: "error", message: data.error || "Failed to update colors." });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error occurred." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (typeId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFiles(prev => ({ ...prev, [typeId]: selectedFile }));
            setPreviews(prev => ({ ...prev, [typeId]: URL.createObjectURL(selectedFile) }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const fileKeys = Object.keys(files);
        if (fileKeys.length === 0 || !installPath) {
            setStatus({ type: "error", message: "Please provide an installation path and select at least one image." });
            return;
        }

        setIsLoading(true);

        try {
            let successCount = 0;

            for (const typeId of fileKeys) {
                const fileToUpload = files[typeId];
                setStatus({ type: "info", message: `Uploading ${logoTypes.find(t => t.id === typeId)?.label}...` });

                const formData = new FormData();
                formData.append("file", fileToUpload);
                formData.append("logoType", typeId);
                formData.append("installPath", installPath);

                const res = await fetch("/api/customize-branding", {
                    method: "POST",
                    body: formData,
                });

                if (res.ok) {
                    successCount++;
                } else {
                    const data = await res.json();
                    throw new Error(data.error || `Failed to upload ${typeId}`);
                }
            }

            setStatus({ type: "success", message: `Successfully updated ${successCount} images!` });

            // Clear selections after success
            setFiles({});
            setPreviews({});

        } catch (error: any) {
            setStatus({ type: "error", message: error.message || "Network error occurred." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async () => {
        if (!installPath) {
            setStatus({ type: "error", message: "Installation path is required." });
            return;
        }
        if (!confirm("Are you sure you want to restore default colors? This will remove all customizations.")) return;

        setIsLoading(true);
        setStatus({ type: "info", message: "Restoring defaults..." });

        try {
            const res = await fetch("/api/customize-css", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ installPath, reset: true }),
            });
            const data = await res.json();

            if (res.ok) {
                setStatus({ type: "success", message: data.message });
            } else {
                setStatus({ type: "error", message: data.error || "Failed to reset." });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error occurred." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-8 pt-24">
            <div className="max-w-2xl mx-auto space-y-8">

                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Paintbrush className="h-8 w-8 text-indigo-400" />
                        Product Customization
                    </h1>
                    <p className="text-slate-400">
                        Customize SailPoint IdentityIQ logos and branding images locally.
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-6 shadow-xl backdrop-blur-sm">

                    {/* Path Configuration */}
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-300">
                            IdentityIQ Installation Path (Webapps Folder)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={installPath}
                                onChange={(e) => setInstallPath(e.target.value)}
                                placeholder="C:\Program Files\Apache Software Foundation\Tomcat 9.0\webapps\identityiq"
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                            />
                            <button
                                type="button"
                                onClick={detectPath}
                                disabled={isLoading}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border border-white/5"
                            >
                                <Search className="h-4 w-4" />
                                Auto-Detect
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Create a backup of your images before easier restoration.
                        </p>
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* Color Customization Section */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-white">Color Branding</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-300">
                                    Navbar Background
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={navbarColor}
                                        onChange={(e) => setNavbarColor(e.target.value)}
                                        className="h-10 w-10 rounded border border-slate-700 bg-slate-950 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={navbarColor}
                                        onChange={(e) => setNavbarColor(e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm uppercase font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-300">
                                    Headings Color (Access Reviews, etc.)
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={headingColor}
                                        onChange={(e) => setHeadingColor(e.target.value)}
                                        className="h-10 w-10 rounded border border-slate-700 bg-slate-950 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={headingColor}
                                        onChange={(e) => setHeadingColor(e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm uppercase font-mono"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-300">
                                    Quicklinks / Buttons Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={quicklinkColor}
                                        onChange={(e) => setQuicklinkColor(e.target.value)}
                                        className="h-10 w-10 rounded border border-slate-700 bg-slate-950 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={quicklinkColor}
                                        onChange={(e) => setQuicklinkColor(e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm uppercase font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-300">
                                    Hover / Highlighting Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={hoverColor}
                                        onChange={(e) => setHoverColor(e.target.value)}
                                        className="h-10 w-10 rounded border border-slate-700 bg-slate-950 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={hoverColor}
                                        onChange={(e) => setHoverColor(e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm uppercase font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={handleColorSubmit}
                                disabled={isLoading}
                                className="flex-1 py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                            >
                                <Paintbrush className="h-4 w-4" />
                                Apply Colors
                            </button>
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={isLoading}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-white rounded-lg font-medium transition-all border border-slate-700 hover:border-rose-700"
                            >
                                Restore Defaults
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Batch Image Selection Grid */}
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-300">
                                Target Images (Select multiple to batch update)
                            </label>
                            <div className="grid grid-cols-1 gap-3">
                                {logoTypes.map((type) => (
                                    <div key={type.id}
                                        className={`bg-slate-950 border rounded-lg p-4 flex items-center gap-4 transition-all ${files[type.id] ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-700'
                                            }`}>

                                        {/* Icon/Label */}
                                        <div className="flex-1">
                                            <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                                                {type.label}
                                                {files[type.id] && <Check className="h-3 w-3 text-emerald-400" />}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">{type.filename}</p>
                                        </div>

                                        {/* Upload Input / Preview */}
                                        <div className="relative group shrink-0">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileSelect(type.id, e)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            {previews[type.id] ? (
                                                <div className="relative group/preview">
                                                    <img
                                                        src={previews[type.id]}
                                                        alt={type.label}
                                                        className="h-10 w-auto max-w-[100px] object-contain rounded bg-slate-900 border border-indigo-500/30 p-1"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 group-hover/preview:bg-black/0 transition-colors rounded" />
                                                </div>
                                            ) : (
                                                <div className="h-9 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 rounded-md flex items-center justify-center gap-2 text-xs transition-colors whitespace-nowrap">
                                                    <Upload className="h-3 w-3" />
                                                    <span>Select File</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Status Message */}
                        {status.message && (
                            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                status.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}>
                                {status.type === 'success' ? <Check className="h-4 w-4" /> :
                                    status.type === 'error' ? <AlertCircle className="h-4 w-4" /> :
                                        <ImageIcon className="h-4 w-4" />}
                                {status.message}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || Object.keys(files).length === 0}
                            className={`w-full py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${isLoading || Object.keys(files).length === 0
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                }`}
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></div>
                                    Processing Batch...
                                </div>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Update Selected Images ({Object.keys(files).length})
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
