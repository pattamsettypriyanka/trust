import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  LayoutDashboard,
  FolderLock,
  Share2,
  UploadCloud,
  ShieldCheck,
  Users,
  Database,
  Lock,
  FileCheck
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
      isActive
        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`;

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#0A0E1A] flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        {/* Core Navigation */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
            Document Repository
          </div>
          <nav className="space-y-1">
            <NavLink to="/" className={linkClass} end>
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </NavLink>
            <NavLink to="/my-documents" className={linkClass}>
              <FolderLock className="w-4 h-4" />
              <span>My Documents</span>
            </NavLink>
            <NavLink to="/shared-with-me" className={linkClass}>
              <Share2 className="w-4 h-4" />
              <span>Shared With Me</span>
            </NavLink>
            <NavLink to="/upload" className={linkClass}>
              <UploadCloud className="w-4 h-4" />
              <span>Upload Document</span>
            </NavLink>
          </nav>
        </div>

        {/* Administration & Compliance */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2 flex items-center justify-between">
            <span>Governance & Audit</span>
            {isAdmin && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 border border-purple-700/40">
                ADMIN
              </span>
            )}
          </div>
          <nav className="space-y-1">
            <NavLink to="/admin/audit" className={linkClass}>
              <ShieldCheck className="w-4 h-4" />
              <span>Audit Trail & Integrity</span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin/users" className={linkClass}>
                <Users className="w-4 h-4" />
                <span>User & Role Governance</span>
              </NavLink>
            )}
          </nav>
        </div>
      </div>

      {/* Security Architecture Box */}
      <div className="rounded-xl border border-blue-900/30 bg-blue-950/20 p-3.5 space-y-2">
        <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold">
          <Database className="w-3.5 h-3.5" />
          <span>Storage Architecture</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Files are stored strictly in <strong className="text-slate-300">Firestore bytes</strong> fields. Direct client access is denied via security rules.
        </p>
        <div className="flex items-center space-x-1.5 text-[10px] font-mono text-emerald-400 pt-1">
          <Lock className="w-3 h-3" />
          <span>Zero-Trust Server Authorized</span>
        </div>
      </div>
    </aside>
  );
};
