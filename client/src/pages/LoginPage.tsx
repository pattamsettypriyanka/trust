import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  Shield,
  Lock,
  UserCheck,
  KeyRound,
  ArrowRight,
  Database,
  ShieldCheck,
  Check
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { switchDemoRole, loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [customToken, setCustomToken] = useState('');
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleDemoSelect = async (role: 'admin' | 'owner' | 'viewer') => {
    setLoadingRole(role);
    try {
      await switchDemoRole(role);
      navigate('/');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToken.trim()) return;
    await loginWithToken(customToken.trim());
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20 border border-blue-400/30 mx-auto">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">TrustVault</h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Enterprise Secure Document Compartment with server-enforced zero-trust authorization and cryptographic audit integrity.
          </p>
        </div>

        {/* Demo Persona Card */}
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 bg-[#0E1526]/90 shadow-2xl space-y-6">
          <div className="space-y-1 text-center">
            <h2 className="text-base font-bold text-slate-100">Hiring Challenge Evaluation Access</h2>
            <p className="text-xs text-slate-400">
              Select one of the 3 pre-configured demo personas to evaluate role enforcement:
            </p>
          </div>

          <div className="space-y-3">
            {/* Admin */}
            <button
              onClick={() => handleDemoSelect('admin')}
              disabled={!!loadingRole}
              className="w-full text-left p-4 rounded-2xl border border-purple-800/40 bg-purple-950/20 hover:bg-purple-950/40 hover:border-purple-600 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-700/60 flex items-center justify-center text-purple-300">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">Security Administrator</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 font-extrabold border border-purple-700/50">
                      ADMIN
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    User management, audit chain verification, security event metrics.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Owner */}
            <button
              onClick={() => handleDemoSelect('owner')}
              disabled={!!loadingRole}
              className="w-full text-left p-4 rounded-2xl border border-amber-800/40 bg-amber-950/20 hover:bg-amber-950/40 hover:border-amber-600 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-700/60 flex items-center justify-center text-amber-300">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">Elena Rostova (Document Owner)</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 font-extrabold border border-amber-700/50">
                      OWNER
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Uploads confidential docs, issues ACL grants, revokes access immediately.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Viewer */}
            <button
              onClick={() => handleDemoSelect('viewer')}
              disabled={!!loadingRole}
              className="w-full text-left p-4 rounded-2xl border border-blue-800/40 bg-blue-950/20 hover:bg-blue-950/40 hover:border-blue-600 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-700/60 flex items-center justify-center text-blue-300">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">Marcus Chen (Compliance Auditor)</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 font-extrabold border border-blue-700/50">
                      VIEWER
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Can read & download only explicitly granted documents; cannot delete or grant.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Custom Token Accordion */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 block text-center">
              Or Authenticate with Custom ID Token
            </span>
            <form onSubmit={handleCustomLogin} className="flex space-x-2">
              <input
                type="text"
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                placeholder="Paste Firebase ID token or dev token..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>

        {/* Security Pillars Footer */}
        <div className="grid grid-cols-3 gap-3 text-center text-[10px] text-slate-400">
          <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <strong className="text-slate-300 block">Firestore Bytes</strong>
            <span>Isolated binary containment</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <strong className="text-slate-300 block">Server-Side Authz</strong>
            <span>Checked on every request</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800/80">
            <strong className="text-slate-300 block">SHA-256 Audit</strong>
            <span>Tamper-evident hash chain</span>
          </div>
        </div>
      </div>
    </div>
  );
};
