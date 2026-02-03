"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2, User } from "lucide-react";
import { useAuth } from "@/components/ui/sailpoint-context";
import { cn } from "@/lib/utils";

interface UserSearchProps {
    onSelect: (user: any) => void;
    label?: string;
    placeholder?: string;
    value?: string;
    defaultValue?: string;
    disabled?: boolean;
}

export function UserSearch({ onSelect, label = "Search User", placeholder = "Type name...", value, defaultValue, disabled }: UserSearchProps) {
    const { url, username, password } = useAuth();
    const [query, setQuery] = useState(value || defaultValue || "");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync value from parent if controlled
    useEffect(() => {
        if (value !== undefined) {
            setQuery(value);
        }
    }, [value]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                searchUsers(query);
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const searchUsers = async (term: string) => {
        setLoading(true);
        try {
            const res = await fetch("/api/users/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, username, password, term }),
            });
            const data = await res.json();
            if (data.success) {
                setResults(data.users);
                setOpen(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (user: any) => {
        setQuery(user.displayName || user.userName);
        setOpen(false);
        onSelect(user);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block uppercase tracking-wider">
                {label}
            </label>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                    type="text"
                    disabled={disabled}
                    className={cn(
                        "w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all",
                        disabled && "opacity-50 cursor-not-allowed text-slate-500"
                    )}
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => !disabled && query.length >= 2 && setOpen(true)}
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-blue-500" />
                )}
            </div>

            {open && results.length > 0 && (
                <div className="absolute z-50 mt-2 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <ul className="max-h-60 overflow-auto py-1">
                        {results.map((user) => (
                            <li
                                key={user.id}
                                className="px-4 py-2 hover:bg-slate-800 cursor-pointer flex items-center gap-3 transition-colors"
                                onClick={() => handleSelect(user)}
                            >
                                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                    <User className="h-4 w-4 text-slate-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-200">
                                        {user.displayName || user.userName}
                                    </span>
                                    <span className="text-xs text-slate-500">{user.userName}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {open && results.length === 0 && query.length >= 2 && !loading && (
                <div className="absolute z-50 mt-2 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-xl p-3 text-center">
                    <span className="text-xs text-slate-500">No users found</span>
                </div>
            )}
        </div>
    );
}
