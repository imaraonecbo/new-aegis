import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Hash, 
  UserCheck, 
  CheckCircle2, 
  Eye, 
  X,
  Search,
  Lock
} from 'lucide-react';

interface AuditLogEntry {
  id: number;
  event_uuid: string;
  event_type: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string;
  ip_address: string;
  action: string;
  details_json: Record<string, any>;
  prev_hash: string;
  current_hash: string;
  created_at: string;
}

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [filterEventType, setFilterEventType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Verification State
  const [verificationResult, setVerificationResult] = useState<{
    status?: string;
    is_valid?: boolean;
    records_verified?: number;
    broken_at_id?: number | null;
    verified_at?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = filterEventType === 'ALL' 
        ? '/api/audit/logs?limit=50' 
        : `/api/audit/logs?limit=50&event_type=${filterEventType}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Error loading audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    try {
      setIsVerifying(true);
      const res = await fetch('/api/audit/verify-chain');
      const data = await res.json();
      setVerificationResult(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterEventType]);

  const filteredLogs = logs.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.event_type.toLowerCase().includes(q) ||
      (l.user_email && l.user_email.toLowerCase().includes(q)) ||
      l.current_hash.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">Immutable Hash-Chained Audit Trail</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Bank-grade non-repudiation ledger where every administrative action, parameter change, and financial settlement is SHA-256 hash-chained with tamper-evident cryptographic validation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Logs</span>
          </button>

          <button
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
          >
            <CheckCircle2 className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Verifying Hashes...' : 'Verify Cryptographic Chain'}</span>
          </button>
        </div>
      </div>

      {/* Verification Banner */}
      {verificationResult && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
          verificationResult.is_valid
            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
            : 'bg-rose-950/40 border-rose-800 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              verificationResult.is_valid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm">
                {verificationResult.is_valid
                  ? 'Cryptographic Hash-Chain Integrity 100% Verified'
                  : 'CRITICAL WARNING: Tampering Detected in Audit Log Chain'}
              </div>
              <div className="text-xs opacity-80">
                Verified {verificationResult.records_verified} consecutive cryptographic blocks from Genesis. Algorithm: HMAC-SHA256. Verified at: {new Date(verificationResult.verified_at || '').toLocaleTimeString()}
              </div>
            </div>
          </div>

          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs px-2.5 py-1 rounded bg-slate-900/60 hover:bg-slate-900 border border-current transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by action, user email, hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-xs text-slate-200 placeholder-slate-500 focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Filter Event:</span>
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs font-mono focus:outline-none"
          >
            <option value="ALL">All Event Types</option>
            <option value="TREASURY_PROFIT_ROUTED">TREASURY_PROFIT_ROUTED</option>
            <option value="TREASURY_DEPOSIT">TREASURY_DEPOSIT</option>
            <option value="CIRCUIT_BREAKER_TOGGLE">CIRCUIT_BREAKER_TOGGLE</option>
            <option value="EMERGENCY_KILLSWITCH_TRIGGER">EMERGENCY_KILLSWITCH_TRIGGER</option>
            <option value="AUTH_SUCCESS">AUTH_SUCCESS</option>
            <option value="AUTH_FAILED">AUTH_FAILED</option>
            <option value="UNAUTHORIZED_ACCESS_ATTEMPT">UNAUTHORIZED_ACCESS_ATTEMPT</option>
            <option value="RECONCILIATION_AUDIT_RUN">RECONCILIATION_AUDIT_RUN</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
            <span className="text-xs">Querying immutable audit chain from database...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
            <span className="text-xs">{error}</span>
            <button
              onClick={fetchLogs}
              className="mt-3 block mx-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs"
            >
              Retry
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No audit logs found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                  <th className="py-3 px-4">Seq #</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">User / Role</th>
                  <th className="py-3 px-4">Action Summary</th>
                  <th className="py-3 px-4">SHA-256 Hash</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredLogs.map((log) => {
                  const isAuthEvent = log.event_type.includes('AUTH');
                  const isSecurityEvent = log.event_type.includes('CIRCUIT') || log.event_type.includes('KILLSWITCH') || log.event_type.includes('UNAUTHORIZED');
                  const isTreasuryEvent = log.event_type.includes('TREASURY');

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-bold">#{log.id}</td>
                      <td className="py-3 px-4 text-slate-300 text-[11px] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isSecurityEvent 
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                            : isTreasuryEvent
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            : isAuthEvent
                            ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-semibold text-[11px]">{log.user_email || 'SYSTEM_DAEMON'}</div>
                        <div className="text-[10px] text-slate-500">{log.user_role} • {log.ip_address}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-200 text-[11px] font-sans">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-cyan-400 font-mono text-[10px]">
                        <span title={log.current_hash}>
                          {log.current_hash.slice(0, 10)}...{log.current_hash.slice(-8)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Audit Record #{selectedLog.id} Detail</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-slate-500 font-mono text-[10px]">EVENT UUID</div>
                  <div className="font-mono text-slate-200 mt-1">{selectedLog.event_uuid}</div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="text-slate-500 font-mono text-[10px]">TIMESTAMP (UTC)</div>
                  <div className="font-mono text-slate-200 mt-1">{selectedLog.created_at}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-slate-400 font-semibold">Cryptographic Hash Chain Proof:</div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1.5">
                  <div>
                    <span className="text-slate-500">PREV_HASH: </span>
                    <span className="text-amber-400 break-all">{selectedLog.prev_hash}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">CURRENT_HASH: </span>
                    <span className="text-cyan-400 break-all">{selectedLog.current_hash}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-slate-400 font-semibold">State Payload & Metadata Snapshot:</div>
                <pre className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                  {JSON.stringify(selectedLog.details_json, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
