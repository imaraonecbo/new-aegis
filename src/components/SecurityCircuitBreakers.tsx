import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Server, 
  Cpu, 
  Layers,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SecurityCircuitBreakersProps {
  isEmergencyPaused: boolean;
  setIsEmergencyPaused: (paused: boolean) => void;
}

interface CircuitBreakerItem {
  id: string;
  name: string;
  trigger_condition: string;
  current_metric: string;
  is_tripped: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  last_tripped_at: string | null;
  last_checked_at: string;
}

export const SecurityCircuitBreakers: React.FC<SecurityCircuitBreakersProps> = ({
  isEmergencyPaused,
  setIsEmergencyPaused
}) => {
  const { user, permissions, prompt2FA } = useAuth();
  const [breakers, setBreakers] = useState<CircuitBreakerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchBreakers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/risk/circuit-breakers');
      if (res.ok) {
        const data = await res.json();
        setBreakers(data.breakers || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreakers();
  }, []);

  const handleToggleBreaker = (breaker: CircuitBreakerItem) => {
    if (!permissions.canModifyRisk) {
      setErrorMessage(`Access Denied: Your role (${user?.role}) cannot modify circuit breakers. Requires ADMIN or RISK_MANAGER.`);
      return;
    }

    prompt2FA(`${breaker.is_tripped ? 'Disarm' : 'Trip'} ${breaker.name}`, async (totpCode) => {
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const res = await fetch('/api/risk/circuit-breakers/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-2FA-Code': totpCode
          },
          body: JSON.stringify({
            id: breaker.id,
            twoFactorCode: totpCode
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error);

        setSuccessMessage(data.message);
        await fetchBreakers();
      } catch (e: any) {
        setErrorMessage(e.message);
      }
    });
  };

  const handleToggleEmergencyPause = () => {
    if (!permissions.canEmergencyPause) {
      setErrorMessage(`Access Denied: Your role (${user?.role}) cannot trigger emergency killswitch. Requires ADMIN.`);
      return;
    }

    const nextState = !isEmergencyPaused;
    prompt2FA(`${nextState ? 'ENGAGE' : 'DISARM'} System Global Killswitch`, async (totpCode) => {
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const res = await fetch('/api/risk/emergency-pause', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-2FA-Code': totpCode
          },
          body: JSON.stringify({
            paused: nextState,
            reason: nextState ? 'Manual security override triggered via Security Panel' : 'Resumed normal operations after security review',
            twoFactorCode: totpCode
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error);

        setIsEmergencyPaused(data.isEmergencyPaused);
        setSuccessMessage(data.message);
      } catch (e: any) {
        setErrorMessage(e.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">Institutional Cybersecurity & Circuit Breakers</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Multi-tiered defense matrix with zero-trust oracle sanity checks, flash loan attack inhibitors, MEV private mempool routing, and instant killswitches.
          </p>
        </div>

        <button
          onClick={handleToggleEmergencyPause}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition-all ${
            isEmergencyPaused
              ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
              : 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{isEmergencyPaused ? 'EMERGENCY PAUSE ENGAGED (CLICK TO DISARM)' : 'ACTIVATE GLOBAL KILLSWITCH'}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Breakers Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {breakers.map((breaker) => (
          <div
            key={breaker.id}
            className={`p-5 rounded-xl border transition-all ${
              breaker.is_tripped
                ? 'bg-rose-950/30 border-rose-800 text-rose-200'
                : 'bg-slate-900 border-slate-800 text-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="font-bold text-sm text-white">{breaker.name}</div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                breaker.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {breaker.severity}
              </span>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="text-slate-400">
                <span className="font-semibold text-slate-300">Trigger Rule: </span>
                {breaker.trigger_condition}
              </div>

              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 font-mono text-[11px] flex items-center justify-between">
                <span className="text-slate-400">Live Reading:</span>
                <span className={`font-bold ${breaker.is_tripped ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {breaker.current_metric}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className={`text-[11px] font-mono font-semibold flex items-center gap-1.5 ${
                breaker.is_tripped ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${breaker.is_tripped ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                {breaker.is_tripped ? 'CIRCUIT TRIPPED' : 'ARMED & MONITORING'}
              </span>

              <button
                onClick={() => handleToggleBreaker(breaker)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  breaker.is_tripped
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {breaker.is_tripped ? 'Reset Breaker' : 'Test Trip'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
