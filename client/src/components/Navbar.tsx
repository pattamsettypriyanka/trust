import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Shield, ShieldAlert, User, LogOut, ChevronDown, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { user, switchDemoRole, logout, isLoading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-900/60 text-purple-300 border-purple-500/50';
      case 'OWNER':
        return 'bg-amber-900/60 text-amber-300 border-amber-500/50';
      case 'VIEWER':
        return 'bg-blue-900/60 text-blue-300 border-blue-500/50';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0E1526]/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              TrustVault
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/60">
              Enterprise Zero-Trust
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Server-Authorized Document Compartment</p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        {/* Demo Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition-colors"
            title="Switch demo role for hiring evaluation"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Role Switcher:</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadge(user?.role)}`}>
              {user?.role || 'Loading...'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-1.5 z-50">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
                Switch Demo Persona
              </div>
              <button
                onClick={() => {
                  switchDemoRole('admin');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-purple-950/40 transition-colors ${
                  user?.role === 'ADMIN' ? 'bg-purple-950/60 text-purple-200' : 'text-slate-300'
                }`}
              >
                <span>Admin Account</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700/40">
                  ADMIN
                </span>
              </button>
              <button
                onClick={() => {
                  switchDemoRole('owner');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-amber-950/40 transition-colors ${
                  user?.role === 'OWNER' ? 'bg-amber-950/60 text-amber-200' : 'text-slate-300'
                }`}
              >
                <span>Elena (Owner)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/40">
                  OWNER
                </span>
              </button>
              <button
                onClick={() => {
                  switchDemoRole('viewer');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-blue-950/40 transition-colors ${
                  user?.role === 'VIEWER' ? 'bg-blue-950/60 text-blue-200' : 'text-slate-300'
                }`}
              >
                <span>Marcus (Auditor)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/40">
                  VIEWER
                </span>
              </button>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        {user && (
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-slate-200">{user.displayName}</div>
              <div className="text-[10px] text-slate-400">{user.email}</div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
