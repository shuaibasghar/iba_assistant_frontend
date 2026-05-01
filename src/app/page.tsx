"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (isAuthenticated) {
                router.push("/chat");
            } else {
                router.push("/login");
            }
        }
    }, [isAuthenticated, isLoading, router]);

    return (
        <div className="min-h-screen gradient-bg flex items-center justify-center">
            <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 pulse-glow">
                    <img
                        src="/iba_.png"
                        alt="IBA Logo"
                        className="w-12 h-12 object-contain bg-white rounded-lg"
                    />
                </div>
                <h1 className="text-2xl font-bold gradient-text mb-2">
                    IBA Sukkur Portal
                </h1>
                <p className="text-gray-400">Loading...</p>
            </div>
        </div>
    );
}
