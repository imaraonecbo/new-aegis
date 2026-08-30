import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Play, 
  Sliders, 
  BarChart3, 
  ShieldCheck, 
  AlertCircle, 
  RotateCcw,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';

export const StrategyBacktester: React.FC = () => {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('STRAT_ETH_DELTA_NEUTRAL');
  const [periodDays, setPeriodDays] = useState<number>(180);
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<any>(null);

  const runBacktest = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/quant/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: selectedStrategy,
          periodDays,
          initialCapital,
          maxLtv: 0.70,
          slippageTolerance: 0.002
        })
      });
      const data = await res.json();
      setBacktestResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runBacktest();
  }, [selectedStrategy, periodDays, initialCapital]);

  return (
    <div className="space-y-6">
      {/* Strategy Selector Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">Quantitative Strategy Lab & Historical Backtesting</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Event-driven backtesting engine with explicit transaction costs, real lending borrow interest, DEX pool slippage curves, and zero look-ahead bias.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runBacktest}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Simulating Historical Data...' : 'Re-Run Backtest'}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Parameters */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="text-slate-400 font-medium block mb-1.5">Strategy Algorithm</label>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="STRAT_ETH_DELTA_NEUTRAL">ETH / wstETH Delta-Neutral Basis Staking</option>
            <option value="STRAT_CROSS_DEX_ARB">Uniswap V3 / Balancer Atomic Arbitrage</option>
            <option value="STRAT_LENDING_RATE_OPTIMIZER">Aave / Compound Dynamic Rate Rotation</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 font-medium block mb-1.5">Backtest Horizon (Days)</label>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value={30}>30 Days (Short-term Volatility)</option>
            <option value={90}>90 Days (Quarterly Cycle)</option>
            <option value={180}>180 Days (Semi-Annual)</option>
            <option value={365}>365 Days (Full Annual Multi-Regime)</option>
          </select>
        </div>

        <div>
          <label className="text-slate-400 font-medium block mb-1.5">Initial Capital Allocation ($ USD)</label>
          <select
            value={initialCapital}
            onChange={(e) => setInitialCapital(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value={50000}>$50,000 USD (Micro-Cap Sandbox)</option>
            <option value={100000}>$100,000 USD (Institutional Standard)</option>
            <option value={250000}>$250,000 USD (Scale Treasury)</option>
          </select>
        </div>
      </div>

      {/* Metrics Row */}
      {backtestResult && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-mono uppercase">Total Return</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              +{backtestResult.totalReturnPct}%
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Net of all fees</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-mono uppercase">Annualized APR</div>
            <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
              {backtestResult.annualizedReturnPct}%
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Compounded</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-mono uppercase">Max Drawdown</div>
            <div className="text-xl font-bold text-amber-400 font-mono mt-1">
              {backtestResult.maxDrawdownPct}%
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Peak to trough</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-mono uppercase">Sharpe Ratio</div>
            <div className="text-xl font-bold text-slate-100 font-mono mt-1">
              {backtestResult.sharpeRatio}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Sortino: {backtestResult.sortinoRatio}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-mono uppercase">Win Rate</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {backtestResult.winRatePct}%
            </div>
            <div className="text-[10px] text-slate-500 font-mono">{backtestResult.winningTrades} / {backtestResult.totalTrades} trades</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[11px] text-slate-400 font-mono uppercase">Gas & Fees Spent</div>
            <div className="text-xl font-bold text-slate-300 font-mono mt-1">
              ${(backtestResult.totalGasExpenditureUsd + backtestResult.totalFeesUsd).toFixed(0)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Gas: ${backtestResult.totalGasExpenditureUsd}</div>
          </div>
        </div>
      )}

      {/* Main Interactive Recharts Area Chart */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-white text-base">Historical Equity Growth vs Benchmark</h3>
            <p className="text-xs text-slate-400">Mark-to-market portfolio value trajectory including interest accruals and gas amortization</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-cyan-500" />
              <span className="text-slate-300">Aegis Delta-Neutral Strategy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-slate-600" />
              <span className="text-slate-400">Unhedged Benchmark</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          {backtestResult && backtestResult.equityCurve ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={backtestResult.equityCurve}>
                <defs>
                  <linearGradient id="colorStrategy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                  formatter={(val: any) => [`$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, '']}
                />
                <Area type="monotone" dataKey="portfolioValue" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorStrategy)" name="Aegis Strategy" />
                <Area type="monotone" dataKey="benchmarkEthHold" stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 3" fillOpacity={1} fill="url(#colorBenchmark)" name="Benchmark Hold" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              Loading simulation data...
            </div>
          )}
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="mt-4 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-300">Quantitative Safety Notice:</span> Historical backtested returns are strictly simulated for validation of solvency invariants and fee drag models. Past performance does not guarantee future results. Real capital allocation requires explicit Gate 7 Human Governance approval.
          </div>
        </div>
      </div>
    </div>
  );
};
