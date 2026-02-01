'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth';
import {
    doc,
    setDoc,
    deleteDoc,
    query,
    where,
    collection,
    onSnapshot,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    signOut: async () => { },
});

export const useFirebaseAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const router = useRouter();

    // Generate unique session ID
    const generateSessionId = () => {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    };

    // Create session in Firestore
    const createSession = async (userId: string, email: string) => {
        const newSessionId = generateSessionId();
        const sessionRef = doc(db, 'sessions', newSessionId);

        try {
            // First, delete all existing sessions for this user
            const sessionsQuery = query(
                collection(db, 'sessions'),
                where('userId', '==', userId)
            );
            const existingSessions = await getDocs(sessionsQuery);

            // Delete old sessions (this will trigger logout on other devices)
            const deletePromises = existingSessions.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);

            // Create new session
            await setDoc(sessionRef, {
                userId,
                email,
                sessionId: newSessionId,
                createdAt: Timestamp.now(),
                lastActive: Timestamp.now(),
            });

            setSessionId(newSessionId);
            return newSessionId;
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    };

    // Delete session from Firestore
    const deleteSession = async (sessionIdToDelete: string) => {
        if (!sessionIdToDelete) return;

        try {
            await deleteDoc(doc(db, 'sessions', sessionIdToDelete));
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    };

    // Monitor session for changes (detect if deleted from another login)
    useEffect(() => {
        if (!sessionId || !user) return;

        const sessionRef = doc(db, 'sessions', sessionId);
        const unsubscribe = onSnapshot(sessionRef, async (snapshot) => {
            if (!snapshot.exists()) {
                // Session was deleted (user logged in elsewhere)
                console.log('Session terminated from another device');
                setSessionId(null);
                // Sign out from Firebase - this will clear auth state properly
                try {
                    await firebaseSignOut(auth);
                } catch (e) {
                    console.error('Error signing out:', e);
                }
                setUser(null);
            }
        }, (error) => {
            console.error('Session listener error:', error);
        });

        return () => unsubscribe();
    }, [sessionId, user]);

    // Handle auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);

                // Only create session if we don't have one yet
                if (!sessionId) {
                    try {
                        await createSession(firebaseUser.uid, firebaseUser.email || '');
                    } catch (error) {
                        console.error('Failed to create session:', error);
                    }
                }
            } else {
                setUser(null);
                if (sessionId) {
                    await deleteSession(sessionId);
                    setSessionId(null);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [sessionId]);

    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            // Session will be created by onAuthStateChanged
            // Don't redirect - RouteGuard will handle navigation
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            if (sessionId) {
                await deleteSession(sessionId);
                setSessionId(null);
            }
            await firebaseSignOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    const value = {
        user,
        loading,
        signInWithGoogle,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
