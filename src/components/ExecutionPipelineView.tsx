import React, { useState } from 'react';
import { 
  Zap, 
  Play, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  FileText, 
  Cpu, 
  Layers, 
  ArrowRight,
  Database,
  Lock
} from 'lucide-react';
import { ExecutionState, PipelineExecutionStep } from '../types';

export const ExecutionPipelineView: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [pipelineState, setPipelineState] = useState<ExecutionState>('CONFIRMED');
  const [activeStrategy, setActiveStrategy] = useState<string>('STRAT_ETH_STETH_ARBITRAGE');
  const [amountUsd, setAmountUsd] = useState<number>(25000);

  const [steps, setSteps] = useState<PipelineExecutionStep[]>([
    { step: '1', name: 'MARKET_DATA_INGESTION', status: 'CONFIRMED', durationMs: 18, detail: 'Oracle prices verified via Chainlink + Uniswap TWAP (<0.08% divergence)' },
    { step: '2', name: 'SIGNAL_GENERATION', status: 'CONFIRMED', durationMs: 12, detail: 'Disparity detected: wstETH/WETH trading at +0.38% spread vs Curve pool parity' },
    { step: '3', name: 'STRATEGY_VALIDATION', status: 'CONFIRMED', durationMs: 24, detail: 'Strategy allowlisted in StrategyRegistry.sol with active status' },
    { step: '4', name: 'RISK_EVALUATION', status: 'CONFIRMED', durationMs: 35, detail: 'LTV: 0.58 (Ceiling: 0.78), HF: 1.54, Net Return: +8.42% net of borrow APR' },
    { step: '5', name: 'TRANSACTION_SIMULATION', status: 'CONFIRMED', durationMs: 142, detail: 'Anvil EVM fork trace executed: Gas used 198,420; Reentrancy checks passed' },
    { step: '6', name: 'SLIPPAGE_CHECK', status: 'CONFIRMED', durationMs: 15, detail: 'Simulated price impact: 14 bps (Under limit of 30 bps)' },
    { step: '7', name: 'GAS_CHECK', status: 'CONFIRMED', durationMs: 10, detail: 'Gas cost $4.12 USD vs projected trade net gain $48.20 USD (11.7x ratio)' },
    { step: '8', name: 'EXECUTION_GATE', status: 'CONFIRMED', durationMs: 5, detail: 'GATE 4 Testnet Sandbox Mode: Cryptographic relayer signed' },
    { step: '9', name: 'CONFIRMATION_&_ACCOUNTING', status: 'CONFIRMED', durationMs: 52, detail: 'Receipt confirmed in block #18492042; Double-entry journal committed' },
    { step: '10', name: 'TREASURY_ALLOCATION', status: 'CONFIRMED', durationMs: 22, detail: 'Profit routed: 40% Operating | 30% Risk Buffer | 20% Treasury | 10% Reinvest' },
    { step: '11', name: 'AUDIT_LOG_COMMITTED', status: 'CONFIRMED', durationMs: 14, detail: 'Immutable SHA-256 state snapshot written to PostgreSQL audit_logs' }
  ]);

  const runSimulation = async () => {
    setIsRunning(true);
    setPipelineState('SIMULATING');
    
    // Reset steps to pending
    setSteps((prev) => prev.map(s => ({ ...s, status: 'PENDING' })));

    try {
      const res = await fetch('/api/trading/simulate-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: activeStrategy,
          amountUsd,
          maxSlippageBps: 30
        })
      });
      const data = await res.json();
      
      // Animate execution steps sequentially
      for (let i = 0; i < data.pipeline_steps.length; i++) {
        await new Promise(r => setTimeout(r, 120));
        setSteps(prev => prev.map((step, idx) => {
          if (idx === i) {
            return {
              ...step,
              status: 'CONFIRMED',
              durationMs: data.pipeline_steps[i].duration_ms,
              detail: data.pipeline_steps[i].detail
            };
          }
          return step;
        }));
      }

      setPipelineState('CONFIRMED');
    } catch (e) {
      console.error(e);
      setPipelineState('SIMULATION_FAILED');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">Event-Driven Execution & Simulation Pipeline</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Strict 11-step execution pipeline that never bypasses the mathematical risk engine, enforcing transaction simulation, slippage validation, and double-entry accounting.
          </p>
        </div>

        <button
          onClick={runSimulation}
          disabled={isRunning}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isRunning ? 'Tracing Pipeline Execution...' : 'Simulate Live Trade Trace'}</span>
        </button>
      </div>

      {/* Pipeline State Machine Status */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">Current Pipeline State:</span>
          <span className={`px-2.5 py-1 rounded font-bold ${
            pipelineState === 'CONFIRMED'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : pipelineState === 'SIMULATING'
              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 animate-pulse'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
          }`}>
            STATE: {pipelineState}
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <span>Idempotency Hash: <code className="text-cyan-300">0x7f4a...e829</code></span>
          <span>Simulation Fork: <code className="text-slate-200">Block #18492042</code></span>
        </div>
      </div>

      {/* 11-Step Interactive Execution Flow */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <h3 className="font-bold text-white text-sm mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <span>Sequential Verification Trace</span>
          <span className="text-xs text-slate-400 font-mono">11/11 Verified Steps</span>
        </h3>

        <div className="space-y-2.5">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                s.status === 'CONFIRMED'
                  ? 'bg-slate-950/60 border-slate-800'
                  : s.status === 'RUNNING'
                  ? 'bg-cyan-950/40 border-cyan-600/60 animate-pulse'
                  : 'bg-slate-950/30 border-slate-900 opacity-50'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 ${
                  s.status === 'CONFIRMED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {s.status === 'CONFIRMED' ? '✓' : idx + 1}
                </div>

                <div>
                  <div className="font-mono font-bold text-xs text-slate-200">{s.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{s.detail}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] self-end sm:self-center">
                {s.durationMs && (
                  <span className="text-slate-500">{s.durationMs} ms</span>
                )}
                <span className={`px-2 py-0.5 rounded font-medium ${
                  s.status === 'CONFIRMED'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
