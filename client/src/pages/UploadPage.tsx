import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Database
} from 'lucide-react';

const MAX_BYTES = 1_000_000;

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'FINANCIAL' | 'LEGAL' | 'ENGINEERING' | 'HR' | 'CONFIDENTIAL' | 'GENERAL'>('GENERAL');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!e.target.files || e.target.files.length === 0) {
      setSelectedFile(null);
      return;
    }

    const file = e.target.files[0];

    // Client-side pre-validation
    if (file.size > MAX_BYTES) {
      setError(`File size (${(file.size / 1024).toFixed(1)} KB) exceeds the strict 1,000,000 byte limit. Please select a smaller file.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!title) {
      // Auto-populate title from filename without extension
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(baseName.replace(/[_-]/g, ' '));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('file', selectedFile);

      const res = await api.uploadDocument(formData);
      setSuccess('Document successfully uploaded and secured in Firestore binary storage!');
      setTimeout(() => {
        navigate(`/documents/${res.document.id}`);
      }, 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
          <UploadCloud className="w-4 h-4" />
          <span>Encrypted Ingestion</span>
        </div>
        <h1 className="text-2xl font-black text-white">Upload Confidential Document</h1>
        <p className="text-xs text-slate-400">
          Upload binary assets directly into Firestore's isolated binary store. Strict 1,000,000-byte cap and MIME signature validation enforced.
        </p>
      </div>

      <div className="glass-panel rounded-3xl p-8 border border-slate-800 bg-[#0E1526]/90 shadow-2xl space-y-6">
        {/* Security Notice */}
        <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/40 flex items-start space-x-3 text-xs text-slate-300">
          <Database className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-blue-300">Storage Architecture Guarantee</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Binary contents are saved in a dedicated <code className="text-blue-300 font-mono">documentContents</code> collection as raw bytes. No Firebase Storage, no Supabase, and no external public URLs. Access requires dynamic server-side authorization on every request.
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* File Picker / Drop Zone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Document File (Max 1,000,000 Bytes)
            </label>
            <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-2xl p-6 text-center transition-colors bg-slate-900/50">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-2 pointer-events-none">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-blue-400">
                  <FileText className="w-6 h-6" />
                </div>
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-bold text-slate-100">{selectedFile.name}</p>
                    <p className="text-xs font-mono text-emerald-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB ({(selectedFile.size).toLocaleString()} bytes)
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-200">
                      Click to choose or drag & drop confidential file
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Allowed formats: PDF, PNG, JPG, JPEG, TXT
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Document Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 2026 Financial Balance Sheet"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Classification Category
            </label>
            <select
              value={category}
              onChange={(e: any) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="GENERAL">GENERAL — Standard Internal Documentation</option>
              <option value="FINANCIAL">FINANCIAL — Quarterly Audit & Financial Records</option>
              <option value="LEGAL">LEGAL — Contracts, NDAs, & Agreements</option>
              <option value="ENGINEERING">ENGINEERING — Blueprints & Security Specifications</option>
              <option value="HR">HR — Personnel & Compliance Records</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL — Strict Executive & Board Materials</option>
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context regarding document purpose, classification, or sensitivity..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Lock className="w-4 h-4" />
              <span>{isSubmitting ? 'Verifying & Ingesting...' : 'Upload & Secure Document'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
