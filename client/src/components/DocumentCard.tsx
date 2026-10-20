import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentMetadata } from '../types.js';
import { api } from '../services/api.js';
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  Download,
  Share2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  User,
  Clock
} from 'lucide-react';

interface DocumentCardProps {
  document: DocumentMetadata;
  isOwner?: boolean;
  userGrant?: string | null;
  onRefresh?: () => void;
  onDeleteRequest?: (doc: DocumentMetadata) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  isOwner,
  userGrant,
  onRefresh,
  onDeleteRequest
}) => {
  const navigate = useNavigate();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="w-5 h-5 text-rose-400" />;
    if (mime.includes('image')) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    return <FileCode className="w-5 h-5 text-blue-400" />;
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'FINANCIAL':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50';
      case 'LEGAL':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/50';
      case 'ENGINEERING':
        return 'bg-indigo-950/60 text-indigo-400 border-indigo-800/50';
      case 'CONFIDENTIAL':
        return 'bg-rose-950/60 text-rose-400 border-rose-800/50';
      default:
        return 'bg-slate-800/60 text-slate-300 border-slate-700';
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.downloadDocument(document.id, document.filename);
    } catch (err) {
      alert(`Download failed: ${(err as Error).message}`);
    }
  };

  return (
    <div
      onClick={() => navigate(`/documents/${document.id}`)}
      className="group relative glass-panel rounded-2xl p-5 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer flex flex-col justify-between space-y-4"
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getCategoryColor(
              document.category
            )}`}
          >
            {document.category}
          </span>
          <div className="flex items-center space-x-1.5">
            {isOwner ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-700/50">
                OWNER
              </span>
            ) : userGrant ? (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  userGrant === 'EDIT'
                    ? 'bg-purple-950/60 text-purple-300 border-purple-700/50'
                    : 'bg-blue-950/60 text-blue-300 border-blue-700/50'
                }`}
              >
                {userGrant} ACCESS
              </span>
            ) : null}
            <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
              v{document.version}
            </span>
          </div>
        </div>

        {/* Title & Icon */}
        <div className="flex items-start space-x-3">
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 group-hover:border-blue-500/30 transition-colors shrink-0">
            {getFileIcon(document.mimeType)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors truncate">
              {document.title}
            </h3>
            <p className="text-xs font-mono text-slate-400 truncate mt-0.5">{document.filename}</p>
          </div>
        </div>

        {/* Description */}
        {document.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mt-3 leading-relaxed">
            {document.description}
          </p>
        )}
      </div>

      {/* Metadata & Actions */}
      <div className="pt-3 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>{formatBytes(document.size)}</span>
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{new Date(document.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white border border-blue-500/30 transition-all"
            title="Download authorized document bytes"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          <div className="flex items-center space-x-1.5">
            {isOwner && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/documents/${document.id}/permissions`);
                  }}
                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Manage Access Grants"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {onDeleteRequest && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRequest(document);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Soft Delete Document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => navigate(`/documents/${document.id}`)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="View Document Details"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
