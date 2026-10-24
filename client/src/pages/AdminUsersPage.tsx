import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { DocumentMetadata, Role, UserProfile } from '../types.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  UserCog,
  Share2,
  FileText,
  Trash2,
  X,
  Search,
  ExternalLink,
  Shield,
  KeyRound,
  Eye,
  Edit3,
  Calendar,
  Check
} from 'lucide-react';

interface UserWithCount extends UserProfile {
  sharedDocumentsCount?: number;
}

interface UserGrantDetail {
  id: string;
  documentId: string;
  permission: 'READ' | 'EDIT';
  grantedBy: string;
  grantedByEmail?: string;
  createdAt: string;
  documentTitle: string;
  documentFilename: string;
  documentCategory: string;
  documentSize: number;
}

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [allDocuments, setAllDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Role change modal state
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<Role>('VIEWER');

  // User Details modal state
  const [inspectingUser, setInspectingUser] = useState<UserProfile | null>(null);
  const [inspectingDetails, setInspectingDetails] = useState<{
    grants: UserGrantDetail[];
    ownedDocuments: DocumentMetadata[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Direct Share Document modal state
  const [sharingUser, setSharingUser] = useState<UserProfile | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<'READ' | 'EDIT'>('READ');
  const [isSharing, setIsSharing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersRes, docsRes] = await Promise.all([
        api.listAdminUsers(),
        api.listDocuments({ tab: 'all', limit: 100 })
      ]);
      setUsers(usersRes.users);
      setAllDocuments(docsRes.documents);
      if (docsRes.documents.length > 0) {
        setSelectedDocId(docsRes.documents[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRoleChangeConfirm = async () => {
    if (!pendingUser) return;
    try {
      setError(null);
      await api.updateAdminUserRole(pendingUser.id, newRole);
      setSuccess(`User ${pendingUser.email} role updated to ${newRole}!`);
      setTimeout(() => setSuccess(null), 3000);
      setPendingUser(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleInspectUser = async (u: UserProfile) => {
    setInspectingUser(u);
    setLoadingDetails(true);
    try {
      const details = await api.getAdminUserDetails(u.id);
      setInspectingDetails({
        grants: details.grants,
        ownedDocuments: details.ownedDocuments
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenShareModal = (u: UserProfile) => {
    setSharingUser(u);
    if (allDocuments.length > 0) {
      // Find first document not owned by this user
      const candidate = allDocuments.find((d) => d.ownerId !== u.id);
      setSelectedDocId(candidate ? candidate.id : allDocuments[0].id);
    }
    setSelectedPermission('READ');
  };

  const handleDirectShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingUser || !selectedDocId) return;

    try {
      setIsSharing(true);
      setError(null);
      const res = await api.adminShareDocumentWithUser(sharingUser.id, selectedDocId, selectedPermission);
      setSuccess(res.message);
      setTimeout(() => setSuccess(null), 4000);
      setSharingUser(null);
      await loadData();
      if (inspectingUser && inspectingUser.id === sharingUser.id) {
        await handleInspectUser(sharingUser);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeGrant = async (userId: string, documentId: string) => {
    try {
      setError(null);
      const res = await api.adminRevokeDocumentForUser(userId, documentId);
      setSuccess(res.message);
      setTimeout(() => setSuccess(null), 4000);
      await loadData();
      if (inspectingUser && inspectingUser.id === userId) {
        const details = await api.getAdminUserDetails(userId);
        setInspectingDetails({
          grants: details.grants,
          ownedDocuments: details.ownedDocuments
        });
      }
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

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>IAM Identity & Access Governance</span>
          </div>
          <h1 className="text-2xl font-black text-white">Registered Users & Document Access</h1>
          <p className="text-xs text-slate-400">
            View registered user profiles, inspect granted document compartment permissions, and share documents with specific users.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
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

      {/* User Table Card */}
      <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400 font-mono">
          <span>Registered System Accounts ({filteredUsers.length})</span>
          <span className="flex items-center space-x-1.5 text-purple-400 font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Server-Side Authorization Enforced</span>
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading user profiles and document grant mappings...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No registered users match your search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">System Role</th>
                  <th className="py-3 px-4">Shared Docs</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-300">
                            {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span>{u.displayName}</span>
                            {isSelf && <span className="text-[10px] text-blue-400 ml-1.5 font-normal">(You)</span>}
                            <span className="block text-[10px] font-mono text-slate-500 truncate max-w-[120px]">{u.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${getRoleBadge(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                          {u.sharedDocumentsCount || 0} docs
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-2">
                          {/* Details & Grants Button */}
                          <button
                            onClick={() => handleInspectUser(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors flex items-center space-x-1"
                            title="Inspect user profile & shared documents"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          {/* Share Document with User Button */}
                          <button
                            onClick={() => handleOpenShareModal(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 text-[11px] font-semibold transition-colors flex items-center space-x-1"
                            title="Share a document specifically with this user"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share Document</span>
                          </button>

                          {/* Role Selector */}
                          {!isSelf && (
                            <select
                              defaultValue={u.role}
                              onChange={(e) => {
                                setPendingUser(u);
                                setNewRole(e.target.value as Role);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-300 focus:outline-none focus:border-purple-500"
                            >
                              <option value="VIEWER">VIEWER</option>
                              <option value="OWNER">OWNER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Details & Active Grants Modal */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-[#0E1526] border border-slate-800 p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-700/60 flex items-center justify-center text-purple-300">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{inspectingUser.displayName}</h2>
                  <span className="text-xs text-slate-400 font-mono">{inspectingUser.email}</span>
                </div>
              </div>
              <button
                onClick={() => setInspectingUser(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">System Role</span>
                <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded border ${getRoleBadge(inspectingUser.role)}`}>
                  {inspectingUser.role}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">UID</span>
                <span className="font-mono text-slate-300 text-[10px] truncate block mt-1">{inspectingUser.id}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Joined</span>
                <span className="text-slate-300 text-[11px] block mt-1">{new Date(inspectingUser.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Active Grants</span>
                <span className="text-blue-400 font-bold text-[13px] block mt-1">
                  {inspectingDetails?.grants.length || 0} Compartments
                </span>
              </div>
            </div>

            {/* Documents Shared With User Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                  <Share2 className="w-4 h-4 text-blue-400" />
                  <span>Documents Shared Specifically with this User</span>
                </div>
                <button
                  onClick={() => {
                    handleOpenShareModal(inspectingUser);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-colors"
                >
                  + Share New Document
                </button>
              </div>

              {loadingDetails ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Loading user's document grants...
                </div>
              ) : !inspectingDetails?.grants || inspectingDetails.grants.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 text-xs">
                  No documents have been shared with this user yet. Only particular documents granted by an administrator or owner will be accessible to them.
                </div>
              ) : (
                <div className="space-y-2">
                  {inspectingDetails.grants.map((grant) => (
                    <div
                      key={grant.id}
                      className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span className="text-xs font-bold text-slate-100">{grant.documentTitle}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                            {grant.permission}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {grant.documentFilename} • {grant.documentCategory} • Shared: {new Date(grant.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeGrant(inspectingUser.id, grant.documentId)}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 text-[11px] font-semibold transition-colors flex items-center space-x-1"
                        title="Immediately revoke this user's access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke Access</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Document with Particular User Modal */}
      {sharingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[#0E1526] border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-950 border border-blue-700/60 flex items-center justify-center text-blue-300">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Share Document with Particular User</h2>
                  <span className="text-[11px] text-slate-400">Target: <strong className="text-white">{sharingUser.displayName}</strong> ({sharingUser.email})</span>
                </div>
              </div>
              <button
                onClick={() => setSharingUser(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDirectShare} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Select Document Compartment
                </label>
                {allDocuments.length === 0 ? (
                  <p className="text-xs text-slate-500">No documents exist in the repository yet. Upload a document first.</p>
                ) : (
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {allDocuments
                      .filter((d) => d.ownerId !== sharingUser.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} ({d.filename} • {d.category})
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Access Level Permission
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPermission('READ')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPermission === 'READ'
                        ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>READ (View & Download)</span>
                      {selectedPermission === 'READ' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Can inspect metadata and download binary payload bytes.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPermission('EDIT')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPermission === 'EDIT'
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center justify-between">
                      <span>EDIT (Update Content)</span>
                      {selectedPermission === 'EDIT' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Can upload updated file revisions and bump version numbers.</p>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-[11px] text-slate-300 space-y-1">
                <span className="font-bold text-blue-300 block">Strict Zero-Trust Enforcement:</span>
                <p className="text-slate-400 leading-relaxed">
                  Only <strong>{sharingUser.email}</strong> will be granted access. All other users without explicit grants remain locked out.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSharingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSharing || !selectedDocId}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSharing ? 'Granting...' : `Grant Access to ${sharingUser.displayName}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Role Promotion */}
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
