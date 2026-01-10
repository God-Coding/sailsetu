"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface AuthState {
    url: string;
    username: string;
    password: string;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface AuthContextType extends AuthState {
    login: (url: string, username: string, password: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [auth, setAuth] = useState<AuthState>({
        url: "",
        username: "",
        password: "",
        isAuthenticated: false,
        isLoading: true, // Start loading
    });
    const router = useRouter();

    const login = (url: string, username: string, password: string) => {
        setAuth({ url, username, password, isAuthenticated: true, isLoading: false });
        // basic persistence for dev convenience (optional, can remove for security)
        sessionStorage.setItem("sp_auth", JSON.stringify({ url, username, password }));
    };

    const logout = () => {
        setAuth({ url: "", username: "", password: "", isAuthenticated: false, isLoading: false });
        sessionStorage.removeItem("sp_auth");
        router.push("/");
    };

    // Restore session on load
    useEffect(() => {
        const stored = sessionStorage.getItem("sp_auth");
        if (stored) {
            try {
                const { url, username, password } = JSON.parse(stored);
                if (url && username && password) {
                    setAuth({ url, username, password, isAuthenticated: true, isLoading: false });
                } else {
                    setAuth(prev => ({ ...prev, isLoading: false }));
                }
            } catch (e) {
                // invalid storage
                setAuth(prev => ({ ...prev, isLoading: false }));
            }
        } else {
            setAuth(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    return (
        <AuthContext.Provider value={{ ...auth, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
