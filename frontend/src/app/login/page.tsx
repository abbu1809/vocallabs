"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, AlertCircle, Zap, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbf9] flex flex-col items-center justify-center p-6 text-[#33332e]">
      {/* Brand Header */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2.5 bg-transparent border-none p-0 cursor-pointer mb-8"
      >
        <div className="w-10 h-10 rounded-full bg-[#e60023] flex items-center justify-center text-white font-black text-2xl shadow-xs">
          <Zap className="w-6 h-6 fill-current" />
        </div>
        <span className="font-extrabold text-2xl text-[#000000] tracking-tight">VocalLabs</span>
      </button>

      {/* 32px Modal Card */}
      <div className="modal-card max-w-md w-full border border-[#dadad3]">
        <div className="text-center mb-8">
          <h1 className="font-heading-lg text-[#000000] mb-2">Welcome to VocalLabs</h1>
          <p className="text-sm text-[#62625b]">
            Sign in to access your organization workflows
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#fde8e8] border border-[#fbd5d5] text-[#9e0a0a] text-xs mb-6 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Work Email</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-[#91918c] pointer-events-none z-10" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-input input-icon-left"
                placeholder="name@company.com"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-[#91918c] pointer-events-none z-10" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-input input-icon-left"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-pill w-full py-3 h-12 text-sm mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#62625b] mt-8 pt-6 border-t border-[#e5e5e0]">
          Don&apos;t have an account?{" "}
          <button
            onClick={() => router.push("/register")}
            className="font-bold text-[#000000] hover:underline"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
