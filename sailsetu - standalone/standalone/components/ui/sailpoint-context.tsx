'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SailPointContextType {
    url: string;
    username: string;
    password: string;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (url: string, username: string, password: string) => void;
    logout: () => void;
}

const SailPointContext = createContext<SailPointContextType>({
    url: '',
    username: '',
    password: '',
    isAuthenticated: false,
    isLoading: true,
    login: () => { },
    logout: () => { },
});

export const useSailPoint = () => useContext(SailPointContext);

// Keep old useAuth hook for backward compatibility with existing pages
export const useAuth = () => useContext(SailPointContext);

export function SailPointProvider({ children }: { children: ReactNode }) {
    const [url, setUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved connection from localStorage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('sailpoint_connection');
        if (savedData) {
            try {
                const { url, username, password } = JSON.parse(savedData);
                setUrl(url || '');
                setUsername(username || '');
                setPassword(password || '');
                setIsAuthenticated(true);
            } catch (e) {
                console.error('Error loading saved connection:', e);
            }
        }
        setIsLoading(false);
    }, []);

    const login = (newUrl: string, newUsername: string, newPassword: string) => {
        setUrl(newUrl);
        setUsername(newUsername);
        setPassword(newPassword);
        setIsAuthenticated(true);

        // Save to localStorage for persistence
        localStorage.setItem('sailpoint_connection', JSON.stringify({
            url: newUrl,
            username: newUsername,
            password: newPassword,
        }));
    };

    const logout = () => {
        setUrl('');
        setUsername('');
        setPassword('');
        setIsAuthenticated(false);
        localStorage.removeItem('sailpoint_connection');
    };

    return (
        <SailPointContext.Provider
            value={{
                url,
                username,
                password,
                isAuthenticated,
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </SailPointContext.Provider>
    );
}
