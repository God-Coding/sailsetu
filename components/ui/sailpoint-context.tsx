'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SailPointContextType {
    url: string;
    username: string;
    password: string;
    telegramToken: string;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (url: string, username: string, password: string) => void;
    updateTelegramToken: (token: string) => void;
    logout: () => void;
}

const SailPointContext = createContext<SailPointContextType>({
    url: '',
    username: '',
    password: '',
    telegramToken: '',
    isAuthenticated: false,
    isLoading: true,
    login: () => { },
    updateTelegramToken: () => { },
    logout: () => { },
});

export const useSailPoint = () => useContext(SailPointContext);

// Keep old useAuth hook for backward compatibility with existing pages
export const useAuth = () => useContext(SailPointContext);

export function SailPointProvider({ children }: { children: ReactNode }) {
    const [url, setUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [telegramToken, setTelegramToken] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load saved connection from localStorage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('sailpoint_connection');
        if (savedData) {
            try {
                const { url, username, password, telegramToken } = JSON.parse(savedData);
                setUrl(url || '');
                setUsername(username || '');
                setPassword(password || '');
                setTelegramToken(telegramToken || '');
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
        // We no longer set telegramToken here as it's handled separately
        setIsAuthenticated(true);

        // Save to localStorage for persistence
        localStorage.setItem('sailpoint_connection', JSON.stringify({
            url: newUrl,
            username: newUsername,
            password: newPassword,
            telegramToken: telegramToken, // Keep existing if any
        }));
    };

    const updateTelegramTokenValue = (newToken: string) => {
        setTelegramToken(newToken);

        // Update localStorage as well
        const savedData = localStorage.getItem('sailpoint_connection');
        if (savedData) {
            const data = JSON.parse(savedData);
            data.telegramToken = newToken;
            localStorage.setItem('sailpoint_connection', JSON.stringify(data));
        }
    };

    const logout = () => {
        setUrl('');
        setUsername('');
        setPassword('');
        setTelegramToken('');
        setIsAuthenticated(false);
        localStorage.removeItem('sailpoint_connection');
    };

    return (
        <SailPointContext.Provider
            value={{
                url,
                username,
                password,
                telegramToken,
                isAuthenticated,
                isLoading,
                login,
                updateTelegramToken: updateTelegramTokenValue,
                logout,
            }}
        >
            {children}
        </SailPointContext.Provider>
    );
}
