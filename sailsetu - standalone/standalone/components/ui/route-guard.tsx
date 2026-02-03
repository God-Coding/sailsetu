'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useFirebaseAuth } from '@/components/ui/auth-context';
import { Loader2 } from 'lucide-react';

export function RouteGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useFirebaseAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Allow access to login page without auth
        if (pathname === '/login') {
            return;
        }

        // Redirect to login if not authenticated
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, pathname, router]);

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    // Allow login page to be accessed
    if (pathname === '/login') {
        return <>{children}</>;
    }

    // Protect all other routes
    if (!user) {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
