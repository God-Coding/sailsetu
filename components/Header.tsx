"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/ui/auth-context";
import { useState } from "react";
import { Hammer, LayoutDashboard, FileSpreadsheet, GitCompare, LogOut, Anchor, Terminal, ChevronDown, Info, Wrench, Share2, Flame, Bot, Paintbrush } from "lucide-react";

export default function Header() {
    const pathname = usePathname();
    const { isAuthenticated, logout, username } = useAuth();
    const [toolsOpen, setToolsOpen] = useState(false);

    // Don't show header on login page
    if (pathname === "/") return null;

    const toolsItems = [
        { name: "AI Report Assistant", href: "/ai-reports", icon: Bot },
        { name: "Compare Access", href: "/compare", icon: GitCompare },
        { name: "Batch Provision", href: "/batch", icon: FileSpreadsheet },
        { name: "Workgroups", href: "/workgroup", icon: Hammer },
        { name: "Request Repair", href: "/request-maintenance", icon: Wrench },
        { name: "Access Map", href: "/visualizer", icon: Share2 },
        { name: "Firefighter", href: "/firefighter", icon: Flame },
        { name: "Rule Runner", href: "/rule-runner", icon: Terminal },
        { name: "Product Customizer", href: "/product-customization", icon: Paintbrush },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo Section */}
                    <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <Anchor className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                SAILSETU
                            </h1>
                            <span className="text-[10px] text-slate-400 tracking-wide hidden sm:block">
                                Bridging functional gaps in SailPoint
                            </span>
                        </div>
                    </Link>

                    {/* Navigation - only if logged in */}
                    {isAuthenticated && (
                        <nav className="hidden md:flex items-center gap-6">

                            {/* Dashboard */}
                            <Link
                                href="/dashboard"
                                className={`flex items-center gap-2 text-sm font-medium transition-colors ${pathname === "/dashboard" ? "text-white" : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                Dashboard
                            </Link>

                            {/* Tools Dropdown */}
                            <div className="relative group">
                                <button
                                    onClick={() => setToolsOpen(!toolsOpen)}
                                    className={`flex items-center gap-2 text-sm font-medium transition-colors focus:outline-none ${toolsItems.some(t => t.href === pathname) ? "text-white" : "text-slate-400 hover:text-white"
                                        }`}
                                >
                                    Tools
                                    <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180" />
                                </button>

                                {/* Dropdown Menu (Hover based for desktop) */}
                                <div className="absolute top-full left-0 mt-2 w-56 rounded-xl border border-white/10 bg-slate-900 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0">
                                    <div className="p-1">
                                        {toolsItems.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm transition-colors ${pathname === item.href
                                                        ? "bg-indigo-500/10 text-indigo-400"
                                                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                                                        }`}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                    {item.name}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* About */}
                            <Link
                                href="/about"
                                className={`flex items-center gap-2 text-sm font-medium transition-colors ${pathname === "/about" ? "text-white" : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                <Info className="h-4 w-4" />
                                About
                            </Link>
                        </nav>
                    )}

                    {/* User Profile / Logout */}
                    {isAuthenticated && (
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:block">
                                <Link href="/profile" className="flex flex-col items-end group">
                                    <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Signed in as</p>
                                    <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{username || "Admin"}</p>
                                </Link>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                                title="Logout"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
