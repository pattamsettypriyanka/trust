import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { DocumentGrant, DocumentMetadata, UserProfile } from '../types.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import {
  Share2,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Lock,
  Plus
} from 'lucide-react';

export const ManagePermissionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [grants, setGrants] = useState<DocumentGrant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New grant form state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<'READ' | 'EDIT'>('READ');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Revoke state
  const [grantToRevoke, setGrantToRevoke] = useState<DocumentGrant | null>(null);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [docRes, grantsRes, usersRes] = await Promise.all([
        api.getDocumentMetadata(id),
        api.listGrants(id),
        api.listUsers()
      ]);
      setDocument(docRes.document);
      setGrants(grantsRes.grants);
      setUsers(usersRes.users);

      // Preselect first available non-owner user if none selected
      const available = usersRes.users.filter(
        (u) => u.id !== docRes.document.ownerId && !grantsRes.grants.some((g) => g.userId === u.id)
      );
      if (available.length > 0) {
        setSelectedUserId(available[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedUserId) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await api.createGrant(id, selectedUserId, selectedPermission);
      setSuccess(`Permission ${selectedPermission} granted successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokePermission = async () => {
    if (!id || !grantToRevoke) return;

    try {
      setError(null);
      await api.revokeGrant(id, grantToRevoke.userId);
      setSuccess(`Access revoked for ${grantToRevoke.userEmail}. Access terminated immediately.`);
      setTimeout(() => setSuccess(null), 3000);
      setGrantToRevoke(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-400">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs">Loading permission control list...</p>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-8 border border-rose-800 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Access Denied</h2>
        <p className="text-xs text-slate-400">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <button
        onClick={() => navigate(`/documents/${id}`)}
        className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Document</span>
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
          <Share2 className="w-4 h-4" />
          <span>Access Control List (ACL)</span>
        </div>
        <h1 className="text-2xl font-black text-white">Manage Permissions</h1>
        <p className="text-xs text-slate-400">
          Document: <strong className="text-slate-200">{document?.title}</strong> ({document?.filename})
        </p>
      </div>

      {/* Immediate Revocation Alert Banner */}
      <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/40 flex items-start space-x-3 text-xs text-slate-300">
        <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-amber-300">Immediate Access Revocation Invariant</span>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Revocation takes effect immediately on the very next protected request. The backend verifies real-time Firestore grants rather than cached frontend claims. Note that revocation cannot erase physical copies already downloaded to recipient hard drives.
          </p>
        </div>
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

      {/* Grant New Permission Card */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-white">
          <Plus className="w-4 h-4 text-blue-400" />
          <span>Grant Access to Named User</span>
        </div>

        <form onSubmit={handleGrantPermission} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Target User</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {users
                .filter((u) => u.id !== document?.ownerId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Permission Level</label>
            <select
              value={selectedPermission}
              onChange={(e: any) => setSelectedPermission(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="READ">READ — View metadata and download bytes</option>
              <option value="EDIT">EDIT — Read and upload replacement versions</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedUserId}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30"
            >
              {isSubmitting ? 'Granting...' : 'Grant Permission'}
            </button>
          </div>
        </form>
      </div>

      {/* Active Grants List */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Active Permission Grants ({grants.length})</span>
          </div>
        </div>

        {grants.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No external users have been granted access. Only you (the owner) can access this document.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {grants.map((grant) => (
              <div key={grant.id} className="py-3.5 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-100">{grant.userEmail}</div>
                  <div className="text-[10px] text-slate-400">
                    Granted on {new Date(grant.grantedAt).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      grant.permission === 'EDIT'
                        ? 'bg-purple-950/60 text-purple-300 border-purple-700/50'
                        : 'bg-blue-950/60 text-blue-300 border-blue-700/50'
                    }`}
                  >
                    {grant.permission} ACCESS
                  </span>

                  <button
                    onClick={() => setGrantToRevoke(grant)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Revoke</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoke Confirmation Dialog */}
      <ConfirmModal
        isOpen={!!grantToRevoke}
        title="Revoke User Access"
        message={`Are you sure you want to revoke ${grantToRevoke?.permission} access for "${grantToRevoke?.userEmail}"? Their access to read or download will be terminated immediately on their very next request.`}
        confirmLabel="Revoke Access Now"
        isDestructive={true}
        onConfirm={handleRevokePermission}
        onCancel={() => setGrantToRevoke(null)}
      />
    </div>
  );
};
