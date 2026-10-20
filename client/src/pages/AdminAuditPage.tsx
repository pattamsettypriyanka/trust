import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { AuditEvent, AuditIntegrityResult, SecurityStats } from '../types.js';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  Download,
  Share2,
  UserX,
  FileUp,
  Lock,
  Clock,
  User,
  Fingerprint
} from 'lucide-react';

export const AdminAuditPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [integrityResult, setIntegrityResult] = useState<AuditIntegrityResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [auditRes, statsRes] = await Promise.all([
        api.listAdminAudit({
          action: actionFilter || undefined,
          outcome: outcomeFilter || undefined,
          actorId: actorFilter || undefined,
          limit: 100
        }),
        api.getSecurityStats()
      ]);
      setEvents(auditRes.events);
      setStats(statsRes.stats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [actionFilter, outcomeFilter, actorFilter]);

  const handleVerifyIntegrity = async () => {
    try {
      setIsVerifying(true);
      const res = await api.verifyAuditIntegrity();
      setIntegrityResult(res.integrity);
    } catch (err) {
      alert(`Integrity verification error: ${(err as Error).message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'DOCUMENT_UPLOAD':
        return 'bg-blue-950/60 text-blue-300 border-blue-700/50';
      case 'DOCUMENT_DOWNLOAD':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50';
      case 'PERMISSION_GRANT':
        return 'bg-amber-950/60 text-amber-300 border-amber-700/50';
      case 'PERMISSION_REVOKE':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/50';
      case 'ACCESS_DENIED':
        return 'bg-rose-950 text-rose-300 border-rose-600 font-extrabold';
      case 'UPLOAD_REJECTED':
        return 'bg-amber-950 text-amber-300 border-amber-600';
      case 'ROLE_CHANGE':
        return 'bg-purple-950/60 text-purple-300 border-purple-700/50';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Administrative Governance & Compliance</span>
          </div>
          <h1 className="text-2xl font-black text-white">Security Audit Trail</h1>
          <p className="text-xs text-slate-400">
            Immutable, SHA-256 hash-chained security event log. Inspect access attempts, policy violations, and chain integrity.
          </p>
        </div>

        <button
          onClick={handleVerifyIntegrity}
          disabled={isVerifying}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
          <span>{isVerifying ? 'Verifying Chain...' : 'Verify Cryptographic Integrity'}</span>
        </button>
      </div>

      {/* Cryptographic Integrity Result Card (if verified) */}
      {integrityResult && (
        <div
          className={`p-6 rounded-3xl glass-panel border ${
            integrityResult.isValid
              ? 'border-emerald-500/50 bg-emerald-950/20'
              : 'border-rose-500/50 bg-rose-950/20'
          } space-y-3 animate-in zoom-in-95 duration-200`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {integrityResult.isValid ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-700/60 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  {integrityResult.isValid
                    ? 'Audit Trail Cryptographically Intact'
                    : 'Tamper Alert: Hash Chain Verification Failed'}
                </h3>
                <p className="text-xs text-slate-300">
                  Verified {integrityResult.totalEvents} sequential events from genesis block.
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                integrityResult.isValid
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                  : 'bg-rose-950 text-rose-300 border-rose-600'
              }`}
            >
              {integrityResult.isValid ? 'PASSED' : 'TAMPER DETECTED'}
            </span>
          </div>

          {!integrityResult.isValid && integrityResult.error && (
            <div className="p-3.5 rounded-xl bg-rose-900/40 border border-rose-700 text-xs text-rose-200 font-mono">
              {integrityResult.error}
            </div>
          )}

          {integrityResult.lastHash && (
            <div className="text-[11px] font-mono text-slate-400 pt-1">
              Latest Head Hash: <span className="text-emerald-400">{integrityResult.lastHash}</span> (Seq #{integrityResult.lastSequence})
            </div>
          )}
        </div>
      )}

      {/* Security Metrics Strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
              <Download className="w-3 h-3 text-emerald-400" />
              <span>Downloads</span>
            </span>
            <div className="text-xl font-black text-white">{stats.downloadsCount}</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
              <Share2 className="w-3 h-3 text-blue-400" />
              <span>ACL Grants/Revokes</span>
            </span>
            <div className="text-xl font-black text-white">{stats.permissionChangesCount}</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Denied Access</span>
            </span>
            <div className="text-xl font-black text-rose-400">{stats.deniedAttemptsCount}</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
              <FileUp className="w-3 h-3 text-amber-400" />
              <span>Rejected Uploads</span>
            </span>
            <div className="text-xl font-black text-amber-400">{stats.failedUploadsCount}</div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-1 col-span-2 md:col-span-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
              <Lock className="w-3 h-3 text-purple-400" />
              <span>Total Audit Events</span>
            </span>
            <div className="text-xl font-black text-purple-400">{stats.totalEvents}</div>
          </div>
        </div>
      )}

      {/* Filter Strip */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Filter by Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
          >
            <option value="">All Actions</option>
            <option value="DOCUMENT_UPLOAD">DOCUMENT_UPLOAD</option>
            <option value="DOCUMENT_DOWNLOAD">DOCUMENT_DOWNLOAD</option>
            <option value="PERMISSION_GRANT">PERMISSION_GRANT</option>
            <option value="PERMISSION_REVOKE">PERMISSION_REVOKE</option>
            <option value="ACCESS_DENIED">ACCESS_DENIED</option>
            <option value="UPLOAD_REJECTED">UPLOAD_REJECTED</option>
            <option value="ROLE_CHANGE">ROLE_CHANGE</option>
            <option value="AUDIT_INTEGRITY_CHECK">AUDIT_INTEGRITY_CHECK</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Filter by Outcome</label>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
          >
            <option value="">All Outcomes</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="DENIED">DENIED</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Filter by Actor</label>
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Search by actor email or ID..."
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500"
          />
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="glass-panel rounded-3xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400 font-mono">
          <span>Displaying {events.length} security events</span>
          <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Canonical Hash Chaining Active</span>
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Querying audit trail from Firestore...
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No audit records found matching the filter criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {events.map((ev) => (
              <div key={ev.id} className="py-4 space-y-2 hover:bg-slate-900/30 px-3 rounded-xl transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
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

                  <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{new Date(ev.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 pl-6">
                  <div className="flex items-center space-x-2">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-200">{ev.actorEmail || ev.actorId}</span>
                    {ev.actorRole && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-bold border border-slate-700">
                        {ev.actorRole}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">ID: {ev.id}</span>
                </div>

                {ev.details && Object.keys(ev.details).length > 0 && (
                  <div className="pl-6 text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                    {JSON.stringify(ev.details)}
                  </div>
                )}

                <div className="pl-6 text-[10px] font-mono text-slate-500 flex items-center space-x-2 truncate">
                  <Fingerprint className="w-3 h-3 text-slate-600 shrink-0" />
                  <span className="truncate">Prev: {ev.prevHash.substring(0, 16)}... | Hash: {ev.hash}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
