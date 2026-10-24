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
  Check,
  Mail,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { firebaseConfig } from '../firebase.js';

export const LoginPage: React.FC = () => {
  const {
    switchDemoRole,
    loginWithToken,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail
  } = useAuth();
  const navigate = useNavigate();

  const [customToken, setCustomToken] = useState('');
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'demo' | 'firebase'>('firebase');
  const [firebaseTab, setFirebaseTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDemoSelect = async (role: 'admin' | 'owner' | 'viewer') => {
    setErrorMsg(null);
    setLoadingRole(role);
    try {
      await switchDemoRole(role);
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo sign-in failed');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToken.trim()) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginWithToken(customToken.trim());
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Custom token login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      if (firebaseTab === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName);
      }
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20 border border-blue-400/30 mx-auto">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">TrustVault</h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Enterprise Secure Document Compartment with server-enforced zero-trust authorization and cryptographic audit integrity.
          </p>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-700/40 text-[11px] text-blue-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Firebase Project: <strong className="font-mono text-white">{firebaseConfig.projectId}</strong></span>
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 bg-[#0E1526]/90 shadow-2xl space-y-6">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start space-x-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-800">
            <button
              onClick={() => { setAuthMode('firebase'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                authMode === 'firebase'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Firebase Auth</span>
            </button>
            <button
              onClick={() => { setAuthMode('demo'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-2 ${
                authMode === 'demo'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Demo Personas</span>
            </button>
          </div>

          {/* Firebase Authentication Mode */}
          {authMode === 'firebase' && (
            <div className="space-y-4">
              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-100 font-semibold text-xs transition-all shadow-lg hover:border-slate-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center space-x-3 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <div className="flex-1 h-px bg-slate-800" />
                <span>Or with Email</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Login / Register Subtabs */}
              <div className="flex border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setFirebaseTab('login')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors ${
                    firebaseTab === 'login'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setFirebaseTab('register')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors ${
                    firebaseTab === 'register'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {firebaseTab === 'register' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Processing...'
                    : firebaseTab === 'login'
                    ? 'Sign In to TrustVault'
                    : 'Create Account & Sign In'}
                </button>
              </form>
            </div>
          )}

          {/* Demo Personas Mode */}
          {authMode === 'demo' && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <h2 className="text-xs font-bold text-slate-200">Pre-configured Demo Personas</h2>
                <p className="text-[11px] text-slate-400">
                  Instant role evaluation without external auth requirements:
                </p>
              </div>

              <div className="space-y-3">
                {/* Admin */}
                <button
                  onClick={() => handleDemoSelect('admin')}
                  disabled={!!loadingRole}
                  className="w-full text-left p-3.5 rounded-2xl border border-purple-800/40 bg-purple-950/20 hover:bg-purple-950/40 hover:border-purple-600 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-700/60 flex items-center justify-center text-purple-300">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">Security Administrator</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 font-extrabold border border-purple-700/50">
                          ADMIN
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
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
                  className="w-full text-left p-3.5 rounded-2xl border border-amber-800/40 bg-amber-950/20 hover:bg-amber-950/40 hover:border-amber-600 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-950 border border-amber-700/60 flex items-center justify-center text-amber-300">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">Elena Rostova</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 font-extrabold border border-amber-700/50">
                          OWNER
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
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
                  className="w-full text-left p-3.5 rounded-2xl border border-blue-800/40 bg-blue-950/20 hover:bg-blue-950/40 hover:border-blue-600 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-950 border border-blue-700/60 flex items-center justify-center text-blue-300">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">Marcus Chen</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 font-extrabold border border-blue-700/50">
                          VIEWER
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Can read & download only explicitly granted documents; cannot delete or grant.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

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
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
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
