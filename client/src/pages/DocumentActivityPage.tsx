import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { AuditEvent, DocumentMetadata } from '../types.js';
import {
  History,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Fingerprint,
  AlertCircle
} from 'lucide-react';

export const DocumentActivityPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [docRes, auditRes] = await Promise.all([
        api.getDocumentMetadata(id),
        api.getDocumentAudit(id)
      ]);
      setDocument(docRes.document);
      setEvents(auditRes.events);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [id]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DOCUMENT_UPLOAD':
        return 'bg-blue-950/60 text-blue-300 border-blue-700/50';
      case 'DOCUMENT_DOWNLOAD':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50';
      case 'DOCUMENT_UPDATE_CONTENT':
        return 'bg-purple-950/60 text-purple-300 border-purple-700/50';
      case 'PERMISSION_GRANT':
        return 'bg-amber-950/60 text-amber-300 border-amber-700/50';
      case 'PERMISSION_REVOKE':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/50';
      case 'ACCESS_DENIED':
        return 'bg-rose-950/80 text-rose-400 border-rose-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <button
        onClick={() => navigate(`/documents/${id}`)}
        className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Document</span>
      </button>

      <div>
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
          <History className="w-4 h-4" />
          <span>Non-Repudiation Audit Trail</span>
        </div>
        <h1 className="text-2xl font-black text-white">Document Activity</h1>
        <p className="text-xs text-slate-400">
          Document: <strong className="text-slate-200">{document?.title}</strong> ({document?.filename})
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading cryptographically chained activity logs...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="p-12 text-center glass-panel rounded-3xl border border-slate-800 text-slate-400 text-xs">
          No audit entries recorded for this document yet.
        </div>
      ) : (
        <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-2 border-b border-slate-800">
            <span>Total Logged Operations: {events.length}</span>
            <span className="flex items-center space-x-1 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>SHA-256 Chained</span>
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {events.map((ev) => (
              <div key={ev.id} className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    {ev.outcome === 'SUCCESS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getActionBadge(
                        ev.action
                      )}`}
                    >
                      {ev.action}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Seq #{ev.sequence}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(ev.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 pl-6">
                  <div className="flex items-center space-x-2">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold">{ev.actorEmail || ev.actorId}</span>
                    {ev.actorRole && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-bold border border-slate-700">
                        {ev.actorRole}
                      </span>
                    )}
                  </div>
                </div>

                {ev.details && Object.keys(ev.details).length > 0 && (
                  <div className="pl-6 text-[11px] font-mono text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                    {JSON.stringify(ev.details)}
                  </div>
                )}

                {/* Hashes */}
                <div className="pl-6 pt-1 text-[10px] font-mono text-slate-500 flex items-center space-x-2 truncate">
                  <Fingerprint className="w-3 h-3 text-slate-600 shrink-0" />
                  <span className="truncate">Hash: {ev.hash}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
