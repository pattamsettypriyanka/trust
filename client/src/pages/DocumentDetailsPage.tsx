import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { DocumentMetadata } from '../types.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import {
  FileText,
  Download,
  Share2,
  Trash2,
  Edit3,
  UploadCloud,
  ShieldCheck,
  Clock,
  User,
  Fingerprint,
  Database,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  History
} from 'lucide-react';

export const DocumentDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [userGrant, setUserGrant] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Metadata State
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<any>('GENERAL');
  const [editDescription, setEditDescription] = useState('');

  // Update Content State
  const [isUpdatingContent, setIsUpdatingContent] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // Delete State
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadDocument = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDocumentMetadata(id);
      setDocument(res.document);
      setIsOwner(res.isOwner);
      setUserGrant(res.userGrant);

      setEditTitle(res.document.title);
      setEditCategory(res.document.category);
      setEditDescription(res.document.description || '');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [id]);

  const handleDownload = async () => {
    if (!document) return;
    try {
      await api.downloadDocument(document.id, document.filename);
    } catch (err) {
      alert(`Download failed: ${(err as Error).message}`);
    }
  };

  const handleUpdateMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;
    try {
      await api.updateDocumentMetadata(document.id, {
        title: editTitle,
        category: editCategory,
        description: editDescription
      });
      setIsEditingMeta(false);
      await loadDocument();
    } catch (err) {
      alert(`Update metadata failed: ${(err as Error).message}`);
    }
  };

  const handleUpdateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document || !replacementFile) return;

    if (replacementFile.size > 1_000_000) {
      setContentError('File size exceeds the 1,000,000-byte strict limit.');
      return;
    }

    try {
      setContentError(null);
      const formData = new FormData();
      formData.append('file', replacementFile);
      await api.updateDocumentContent(document.id, formData);
      setIsUpdatingContent(false);
      setReplacementFile(null);
      await loadDocument();
    } catch (err) {
      setContentError((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!document) return;
    try {
      await api.deleteDocument(document.id);
      setShowDeleteModal(false);
      navigate('/my-documents');
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-400">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs">Authenticating and loading document record...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-8 border border-rose-800/60 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Access Denied or Document Not Found</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          {error || 'You do not have active authorization to view this document.'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
        >
          Return to Overview
        </button>
      </div>
    );
  }

  const canEdit = isOwner || userGrant === 'EDIT';

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      {/* Main Document Details Header */}
      <div className="glass-panel rounded-3xl p-8 border border-slate-800 bg-[#0E1526]/90 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/60">
                {document.category}
              </span>
              {isOwner ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-700/50">
                  DOCUMENT OWNER
                </span>
              ) : userGrant ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-700/50">
                  {userGrant} PERMISSION
                </span>
              ) : null}
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                Version {document.version}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">{document.title}</h1>
            <p className="text-xs font-mono text-slate-400">{document.filename}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>

            {isOwner && (
              <button
                onClick={() => navigate(`/documents/${document.id}/permissions`)}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                title="Manage user access grants"
              >
                <Share2 className="w-4 h-4 text-blue-400" />
                <span>Manage Permissions</span>
              </button>
            )}

            <button
              onClick={() => navigate(`/documents/${document.id}/activity`)}
              className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Inspect document audit history"
            >
              <History className="w-4 h-4 text-emerald-400" />
              <span>Activity</span>
            </button>

            {isOwner && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors border border-transparent hover:border-rose-900/40"
                title="Soft delete document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {document.description && (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Description & Notes
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">{document.description}</p>
          </div>
        )}

        {/* Technical Attributes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
              <Database className="w-3 h-3 text-blue-400" />
              <span>File Size</span>
            </span>
            <div className="text-xs font-mono font-bold text-slate-200">
              {(document.size / 1024).toFixed(1)} KB ({document.size.toLocaleString()} bytes)
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
              <User className="w-3 h-3 text-amber-400" />
              <span>Owner Account</span>
            </span>
            <div className="text-xs font-bold text-slate-200 truncate">{document.ownerEmail}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>Created Timestamp</span>
            </span>
            <div className="text-xs font-mono text-slate-200">
              {new Date(document.createdAt).toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
              <FileText className="w-3 h-3 text-indigo-400" />
              <span>MIME Type</span>
            </span>
            <div className="text-xs font-mono text-slate-200 truncate">{document.mimeType}</div>
          </div>
        </div>

        {/* Cryptographic SHA-256 Fingerprint */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1.5">
            <Fingerprint className="w-3.5 h-3.5 text-blue-400" />
            <span>Cryptographic Content Hash (SHA-256)</span>
          </span>
          <div className="font-mono text-xs text-blue-300 break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 select-all">
            {document.sha256}
          </div>
        </div>
      </div>

      {/* Editing & Management Section */}
      {canEdit && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Update Metadata Form */}
          <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Update Metadata</h3>
              </div>
            </div>

            <form onSubmit={handleUpdateMetadata} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e: any) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100"
                >
                  <option value="GENERAL">GENERAL</option>
                  <option value="FINANCIAL">FINANCIAL</option>
                  <option value="LEGAL">LEGAL</option>
                  <option value="ENGINEERING">ENGINEERING</option>
                  <option value="HR">HR</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                Save Metadata Changes
              </button>
            </form>
          </div>

          {/* Replace Binary Content Form */}
          <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2">
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Upload New Version</h3>
            </div>
            <p className="text-xs text-slate-400">
              Replace the stored binary content with a new version (increments version number and re-computes hash).
            </p>

            {contentError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {contentError}
              </div>
            )}

            <form onSubmit={handleUpdateContent} className="space-y-3">
              <input
                type="file"
                onChange={(e) => setReplacementFile(e.target.files?.[0] || null)}
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-blue-400 hover:file:bg-slate-700"
              />

              <button
                type="submit"
                disabled={!replacementFile}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors"
              >
                Commit New Version
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Soft Delete Document"
        message={`Are you sure you want to soft-delete "${document.title}"? Access will be immediately revoked for all users.`}
        confirmLabel="Delete Document"
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};
