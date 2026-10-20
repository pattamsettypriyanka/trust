import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { DocumentMetadata } from '../types.js';
import { DocumentCard } from '../components/DocumentCard.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import {
  FolderLock,
  Share2,
  UploadCloud,
  ShieldCheck,
  FileText,
  AlertCircle,
  Database,
  ArrowRight,
  Lock
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [myDocs, setMyDocs] = useState<DocumentMetadata[]>([]);
  const [sharedDocs, setSharedDocs] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [docToDelete, setDocToDelete] = useState<DocumentMetadata | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [myRes, sharedRes] = await Promise.all([
        api.listDocuments({ tab: 'my', limit: 6 }),
        api.listDocuments({ tab: 'shared', limit: 6 })
      ]);
      setMyDocs(myRes.documents);
      setSharedDocs(sharedRes.documents);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await api.deleteDocument(docToDelete.id);
      setDocToDelete(null);
      await loadData();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="relative rounded-3xl p-8 glass-panel border border-blue-900/40 bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-slate-900/60 overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>Zero-Trust Enterprise Vault</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Welcome back, {user?.displayName || 'User'}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            All document binaries are strictly stored in Firestore bytes fields. Every read, preview, download, and permission change is dynamically authorized on the backend.
          </p>
          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload New Document</span>
            </button>
            <button
              onClick={() => navigate('/admin/audit')}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>View Audit Trail</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Documents</span>
            <div className="text-2xl font-black text-white">{myDocs.length}</div>
            <p className="text-[11px] text-slate-400">Owned by your account</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-950/50 border border-amber-800/40 flex items-center justify-center text-amber-400">
            <FolderLock className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shared With Me</span>
            <div className="text-2xl font-black text-white">{sharedDocs.length}</div>
            <p className="text-[11px] text-slate-400">Active READ / EDIT grants</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-950/50 border border-blue-800/40 flex items-center justify-center text-blue-400">
            <Share2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit Integrity</span>
            <div className="text-2xl font-black text-emerald-400">SHA-256</div>
            <p className="text-[11px] text-slate-400">Cryptographically Chained</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* My Documents Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">My Confidential Documents</h2>
            <p className="text-xs text-slate-400">Documents you own and can grant permissions for</p>
          </div>
          <button
            onClick={() => navigate('/my-documents')}
            className="flex items-center space-x-1 text-xs font-bold text-blue-400 hover:text-blue-300"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-48 rounded-2xl bg-slate-900/60 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : myDocs.length === 0 ? (
          <div className="rounded-2xl glass-panel p-8 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">No documents uploaded yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Upload your first confidential document to Firestore to initiate secure sharing.
            </p>
            <button
              onClick={() => navigate('/upload')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-block"
            >
              Upload Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {myDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                isOwner={true}
                onRefresh={loadData}
                onDeleteRequest={(d) => setDocToDelete(d)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Shared With Me Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Shared Documents</h2>
            <p className="text-xs text-slate-400">Documents other users have granted you access to read or edit</p>
          </div>
          <button
            onClick={() => navigate('/shared-with-me')}
            className="flex items-center space-x-1 text-xs font-bold text-blue-400 hover:text-blue-300"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-48 rounded-2xl bg-slate-900/60 animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : sharedDocs.length === 0 ? (
          <div className="rounded-2xl glass-panel p-8 text-center space-y-3">
            <Share2 className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">No documents shared with you yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              When other document owners grant you READ or EDIT permissions, they will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {sharedDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                isOwner={false}
                userGrant="READ"
                onRefresh={loadData}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!docToDelete}
        title="Delete Document"
        message={`Are you sure you want to soft-delete "${docToDelete?.title}"? It will become inaccessible to all granted viewers immediately.`}
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
