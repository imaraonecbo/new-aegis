import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Lock, 
  AlertTriangle, 
  ShieldCheck, 
  DollarSign, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { ARCHITECTURE_SPEC } from '../data/architectureDocs';

export const DeploymentGatesView: React.FC = () => {
  const [activeGateIndex, setActiveGateIndex] = useState<number>(3); // Gate 4 active

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">Production Deployment Readiness & Capital Scaling Gates</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Strict 7-gate capital deployment framework ensuring no automated component risks real capital without explicit test passes and human multisig signoff.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-semibold flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <span>CURRENT STAGE: GATE 4 (Testnet Sandbox)</span>
        </div>
      </div>

      {/* Capital Scaling Progression Ramp */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <h3 className="font-bold text-white text-sm mb-4 border-b border-slate-800 pb-3">
          Conservative Capital Escalation Schedule
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-lg bg-slate-950/60 border border-emerald-900/40">
            <div className="text-slate-400 mb-1">Gates 1 - 3: Sandbox</div>
            <div className="text-xl font-bold text-emerald-400">$0 USD</div>
            <div className="text-[11px] text-slate-500 mt-1">Local Anvil EVM Fork & Pytest</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/60 border border-amber-900/40">
            <div className="text-slate-400 mb-1">Gate 4: Testnet Active</div>
            <div className="text-xl font-bold text-amber-400">$1,000 USD Cap</div>
            <div className="text-[11px] text-slate-500 mt-1">Sepolia / Arbitrum Testnet</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 opacity-60">
            <div className="text-slate-400 mb-1">Gate 5 - 6: Staging</div>
            <div className="text-xl font-bold text-slate-300">$10k - $50k USD</div>
            <div className="text-[11px] text-slate-500 mt-1">Audit & Multi-Node Cluster</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 opacity-60">
            <div className="text-slate-400 mb-1">Gate 7: Institutional</div>
            <div className="text-xl font-bold text-cyan-400">$250,000+ USD</div>
            <div className="text-[11px] text-slate-500 mt-1">3-of-5 Multisig Governance</div>
          </div>
        </div>
      </div>

      {/* 7 Gates Breakdown List */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="font-bold text-white text-sm mb-4 border-b border-slate-800 pb-3">
          7-Gate Verification Audit Checklist
        </h3>

        <div className="space-y-3">
          {ARCHITECTURE_SPEC.productionGates.map((gate) => (
            <div
              key={gate.number}
              className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                gate.status === 'PASSED'
                  ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                  : gate.status === 'IN_PROGRESS'
                  ? 'bg-amber-950/30 border-amber-600/50 text-slate-100'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-400 opacity-75'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${
                  gate.status === 'PASSED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : gate.status === 'IN_PROGRESS'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {gate.status === 'PASSED' ? '✓' : gate.number}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">GATE {gate.number}: {gate.name}</span>
                    <span className="text-xs font-mono text-cyan-400">
                      [Max Capital: ${gate.capUsd.toLocaleString()} USD]
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{gate.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs self-end sm:self-center">
                <span className={`px-2.5 py-1 rounded font-bold ${
                  gate.status === 'PASSED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : gate.status === 'IN_PROGRESS'
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {gate.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
