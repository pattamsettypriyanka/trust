import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Role, UserProfile } from '../types.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  UserCog
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Role change modal state
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<Role>('VIEWER');

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.listAdminUsers();
      setUsers(res.users);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChangeConfirm = async () => {
    if (!pendingUser) return;
    try {
      setError(null);
      await api.updateAdminUserRole(pendingUser.id, newRole);
      setSuccess(`User ${pendingUser.email} role updated to ${newRole}!`);
      setTimeout(() => setSuccess(null), 3000);
      setPendingUser(null);
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-950/80 text-purple-300 border-purple-700/60 font-bold';
      case 'OWNER':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/60 font-bold';
      case 'VIEWER':
        return 'bg-blue-950/80 text-blue-300 border-blue-700/60 font-bold';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
          <Users className="w-4 h-4" />
          <span>IAM Identity & Access Governance</span>
        </div>
        <h1 className="text-2xl font-black text-white">User & Role Management</h1>
        <p className="text-xs text-slate-400">
          Manage system identity assignments. Only authenticated administrators may alter server-side roles.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* User Table Card */}
      <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400 font-mono">
          <span>Registered System Accounts ({users.length})</span>
          <span className="flex items-center space-x-1.5 text-purple-400 font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Server-Side Controlled Roles</span>
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading user profiles...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {u.displayName} {isSelf && <span className="text-[10px] text-blue-400">(You)</span>}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${getRoleBadge(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isSelf ? (
                          <span className="text-[10px] text-slate-500 italic">Protected (Self)</span>
                        ) : (
                          <div className="inline-flex items-center space-x-1">
                            <select
                              defaultValue={u.role}
                              onChange={(e) => {
                                setPendingUser(u);
                                setNewRole(e.target.value as Role);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500"
                            >
                              <option value="VIEWER">VIEWER</option>
                              <option value="OWNER">OWNER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!pendingUser}
        title="Confirm Role Change"
        message={`Are you sure you want to change ${pendingUser?.displayName}'s role from ${pendingUser?.role} to ${newRole}? This directly impacts their authorization boundaries across all system documents.`}
        confirmLabel="Update Role"
        onConfirm={handleRoleChangeConfirm}
        onCancel={() => setPendingUser(null)}
      />
    </div>
  );
};
