import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  ShieldAlert, 
  ShieldCheck, 
  DollarSign, 
  Percent, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  RefreshCw,
  Zap,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { MATHEMATICAL_RISK_SPECS } from '../data/riskEngine';
import { CollateralPosition } from '../types';

export const CollateralLoanEngine: React.FC = () => {
  // Input parameters
  const [collateralValue, setCollateralValue] = useState<number>(296012.50);
  const [debt, setDebt] = useState<number>(165000.00);
  const [liquidationThreshold, setLiquidationThreshold] = useState<number>(0.85);
  const [expectedGrossReturn, setExpectedGrossReturn] = useState<number>(0.12);
  const [borrowApr, setBorrowApr] = useState<number>(0.0412);
  const [tradingFee, setTradingFee] = useState<number>(0.003);
  const [gasCostUsd, setGasCostUsd] = useState<number>(15.00);
  const [slippageBps, setSlippageBps] = useState<number>(18);
  const [assetVolatility, setAssetVolatility] = useState<number>(0.45);
  const [capitalAtRisk, setCapitalAtRisk] = useState<number>(50000);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(250000);

  // Live evaluated state
  const [evalResult, setEvalResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activePositions, setActivePositions] = useState<CollateralPosition[]>([]);

  const fetchLivePositions = async () => {
    try {
      const res = await fetch('/api/risk/positions');
      if (res.ok) {
        const data = await res.json();
        setActivePositions(data.positions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const runRiskEvaluation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/risk/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collateralValue,
          debt,
          liquidationThreshold,
          expectedGrossReturn,
          borrowingCost: borrowApr,
          tradingFees: tradingFee,
          gasCost: gasCostUsd / (capitalAtRisk || 1),
          slippage: slippageBps / 10000,
          protocolFees: 0.001,
          volatility: assetVolatility,
          capitalAtRisk,
          totalPortfolioValue
        })
      });
      const data = await res.json();
      setEvalResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLivePositions();
    runRiskEvaluation();
  }, []);

  useEffect(() => {
    runRiskEvaluation();
  }, [
    collateralValue,
    debt,
    liquidationThreshold,
    expectedGrossReturn,
    borrowApr,
    tradingFee,
    gasCostUsd,
    slippageBps,
    assetVolatility,
    capitalAtRisk,
    totalPortfolioValue
  ]);

  const loadPositionIntoEngine = (pos: CollateralPosition) => {
    setCollateralValue(pos.collateralValueUsd);
    setDebt(pos.borrowedDebtUsd);
    setLiquidationThreshold(pos.liquidationThreshold);
    setBorrowApr(pos.borrowAprPct / 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">Collateralized Borrowing & Liquidation Risk Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Real-time quantitative risk evaluator: Solvency checks, LTV bounds, dynamic liquidation cushions, Sharpe optimization, and Half-Kelly sizing.
          </p>
        </div>

        <button
          onClick={runRiskEvaluation}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Re-Evaluate Risk Bounds</span>
        </button>
      </div>

      {/* Select active position template */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
        <div className="text-xs font-semibold text-slate-400 mb-2">Load Real Position from Database:</div>
        <div className="flex flex-wrap gap-2">
          {activePositions.map((pos) => (
            <button
              key={pos.id}
              onClick={() => loadPositionIntoEngine(pos)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-2 border border-slate-700 transition-colors"
            >
              <span className="font-bold text-cyan-400">{pos.id}</span>
              <span>({pos.collateralAsset} / {pos.borrowedAsset})</span>
              <span className="text-emerald-400 font-bold">HF: {pos.healthFactor.toFixed(3)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-white border-b border-slate-800 pb-2">
            Position & Market Parameters
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Collateral Value ($)</label>
              <input
                type="number"
                value={collateralValue}
                onChange={(e) => setCollateralValue(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Debt Value ($)</label>
              <input
                type="number"
                value={debt}
                onChange={(e) => setDebt(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Liquidation Threshold</label>
              <input
                type="number"
                step="0.01"
                value={liquidationThreshold}
                onChange={(e) => setLiquidationThreshold(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Borrowing APR (e.g. 0.042)</label>
              <input
                type="number"
                step="0.001"
                value={borrowApr}
                onChange={(e) => setBorrowApr(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Expected Gross Return</label>
              <input
                type="number"
                step="0.01"
                value={expectedGrossReturn}
                onChange={(e) => setExpectedGrossReturn(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Asset Volatility (σ)</label>
              <input
                type="number"
                step="0.05"
                value={assetVolatility}
                onChange={(e) => setAssetVolatility(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Slippage (bps)</label>
              <input
                type="number"
                value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Gas Cost ($ USD)</label>
              <input
                type="number"
                value={gasCostUsd}
                onChange={(e) => setGasCostUsd(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Output: Decision Matrix & Mathematical Invariants (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Decision Banner */}
          {evalResult && (
            <div className={`p-5 rounded-xl border flex items-start gap-3.5 shadow-md ${
              evalResult.decision === 'APPROVED'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : evalResult.decision === 'REDUCE_POSITION'
                ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}>
              <div className="mt-0.5">
                {evalResult.decision === 'APPROVED' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {evalResult.decision === 'REDUCE_POSITION' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {(evalResult.decision === 'REJECTED' || evalResult.decision === 'EMERGENCY_STOP') && <ShieldAlert className="w-5 h-5 text-rose-400" />}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base tracking-wide font-mono">
                    STATUS: {evalResult.decision}
                  </span>
                  <span className="text-[10px] font-mono opacity-70">{evalResult.evaluation_id}</span>
                </div>

                <div className="mt-2 space-y-1 text-xs">
                  {evalResult.reasons.map((r: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 opacity-90">
                      <span>•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metric KPI cards */}
          {evalResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Current LTV</div>
                <div className="text-lg font-bold text-white mt-1">
                  {(evalResult.metrics.ltv * 100).toFixed(2)}%
                </div>
                <div className="text-[10px] text-slate-500">Ceiling: 78.00%</div>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Health Factor</div>
                <div className={`text-lg font-bold mt-1 ${evalResult.metrics.healthFactor >= 1.35 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {evalResult.metrics.healthFactor.toFixed(4)}
                </div>
                <div className="text-[10px] text-slate-500">Floor: 1.350</div>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Price Drop Buffer</div>
                <div className="text-lg font-bold text-cyan-400 mt-1">
                  {evalResult.metrics.liquidationPriceDropPct.toFixed(2)}%
                </div>
                <div className="text-[10px] text-slate-500">To Liquidation</div>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Net Return (APY)</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  +{(evalResult.metrics.expectedNetReturn * 100).toFixed(2)}%
                </div>
                <div className="text-[10px] text-slate-500">Net of All Fees</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
