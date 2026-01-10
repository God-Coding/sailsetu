"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/ui/auth-context";
import { Hammer, LayoutDashboard, FileSpreadsheet, GitCompare, LogOut, Anchor } from "lucide-react";

export default function Header() {
    const pathname = usePathname();
    const { isAuthenticated, logout, username } = useAuth();

    // Don't show header on login page
    if (pathname === "/") return null;

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Compare Access", href: "/compare", icon: GitCompare },
        { name: "Batch Provision", href: "/batch", icon: FileSpreadsheet },
        { name: "Workgroups", href: "/workgroup", icon: Hammer },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo Section */}
                    <div className="flex items-center gap-3">
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
                    </div>

                    {/* Navigation - only if logged in */}
                    {isAuthenticated && (
                        <nav className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                            ? "bg-white/10 text-white shadow-sm border border-white/5"
                                            : "text-slate-400 hover:text-white hover:bg-white/5"
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    )}

                    {/* User Profile / Logout */}
                    {isAuthenticated && (
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs text-slate-400">Signed in as</p>
                                <p className="text-sm font-medium text-white">{username || "Admin"}</p>
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
