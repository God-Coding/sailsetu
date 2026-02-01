'use client';

import { ConnectionForm } from "@/components/connection-form";
import { useFirebaseAuth } from "@/components/ui/auth-context";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useFirebaseAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // RouteGuard handles redirect to /login if not authenticated
  if (!user) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <ConnectionForm />
      </div>
    </main>
  );
}
