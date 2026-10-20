import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { DocumentMetadata } from '../types.js';
import { DocumentCard } from '../components/DocumentCard.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import {
  FolderLock,
  Search,
  Filter,
  UploadCloud,
  FileText,
  AlertCircle
} from 'lucide-react';

const CATEGORIES = ['ALL', 'FINANCIAL', 'LEGAL', 'ENGINEERING', 'CONFIDENTIAL', 'GENERAL'];

export const MyDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [docToDelete, setDocToDelete] = useState<DocumentMetadata | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.listDocuments({
        tab: 'my',
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        search: searchQuery
      });
      setDocuments(res.documents);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedCategory, searchQuery]);

  const handleDelete = async () => {
    if (!docToDelete) return;
    try {
      await api.deleteDocument(docToDelete.id);
      setDocToDelete(null);
      await loadDocuments();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FolderLock className="w-4 h-4" />
            <span>Owner Compartment</span>
          </div>
          <h1 className="text-2xl font-black text-white">My Documents</h1>
          <p className="text-xs text-slate-400">
            Confidential documents owned by your account. You possess full grant and deletion authority.
          </p>
        </div>
        <button
          onClick={() => navigate('/upload')}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all shrink-0"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title or filename..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center space-x-1">
            <Filter className="w-3 h-3" />
            <span>Category:</span>
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Document Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-56 rounded-2xl bg-slate-900/60 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl glass-panel p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No matching documents found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No documents matched your filter criteria or you have not uploaded any files in this category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              isOwner={true}
              onRefresh={loadDocuments}
              onDeleteRequest={(d) => setDocToDelete(d)}
            />
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!docToDelete}
        title="Delete Document"
        message={`Are you sure you want to soft-delete "${docToDelete?.title}"? Granted viewers will instantly lose access.`}
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
