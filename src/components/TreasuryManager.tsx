import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  DollarSign, 
  ShieldCheck, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  ArrowRightLeft, 
  Lock, 
  RefreshCw, 
  Zap, 
  CheckCircle2, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  ExternalLink, 
  Cpu, 
  Sparkles, 
  Send, 
  Wallet, 
  ShieldAlert 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AutonomousEngineStatus, AutonomousSettlementResult } from '../types';

export const TreasuryManager: React.FC = () => {
  const { user, permissions, prompt2FA } = useAuth();

  // State for live database telemetry
  const [treasurySummary, setTreasurySummary] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [autonomousStatus, setAutonomousStatus] = useState<AutonomousEngineStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Zero-Touch Autonomous Trigger State
  const [simYieldUsd, setSimYieldUsd] = useState<number>(5000);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('STRAT_ETH_STETH_ARBITRAGE');
  const [isExecutingAutonomous, setIsExecutingAutonomous] = useState<boolean>(false);
  const [lastAutonomousResult, setLastAutonomousResult] = useState<AutonomousSettlementResult | null>(null);

  // Zero-Friction Net Profit Withdrawal State
  const [withdrawAmountUsd, setWithdrawAmountUsd] = useState<number>(10000);
  const [destinationWallet, setDestinationWallet] = useState<string>('0x3c2a1b0e9f8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a');
  const [isExecutingWithdrawal, setIsExecutingWithdrawal] = useState<boolean>(false);
  const [lastWithdrawalResult, setLastWithdrawalResult] = useState<any>(null);

  // Manual Configurable Matrix State
  const [profitUsd, setProfitUsd] = useState<number>(10000);
  const [operatingPct, setOperatingPct] = useState<number>(20); // 20% of Gross (40% of 50%)
  const [riskReservePct, setRiskReservePct] = useState<number>(15); // 15% of Gross (30% of 50%)
  const [treasuryPct, setTreasuryPct] = useState<number>(60); // 50% Net Profit Sweep + 10% Cold Buffer = 60%
  const [reinvestPct, setReinvestPct] = useState<number>(5); // 5% of Gross (10% of 50%)
  const [allocationResult, setAllocationResult] = useState<any>(null);
  const [isExecutingManualRoute, setIsExecutingManualRoute] = useState<boolean>(false);

  const totalPct = operatingPct + riskReservePct + treasuryPct + reinvestPct;
  const isSumValid = Math.abs(totalPct - 100) < 0.01;

  const fetchLiveTreasuryData = async () => {
    try {
      setLoading(true);
      const [resSummary, resLedger, resEngine] = await Promise.all([
        fetch('/api/treasury/summary'),
        fetch('/api/treasury/ledger?limit=30'),
        fetch('/api/treasury/autonomous-engine')
      ]);

      if (resSummary.ok) setTreasurySummary(await resSummary.json());
      if (resLedger.ok) {
        const data = await resLedger.json();
        setLedgerEntries(data.ledger || []);
      }
      if (resEngine.ok) {
        setAutonomousStatus(await resEngine.json());
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateAllocation = async () => {
    if (!isSumValid) return;
    try {
      const res = await fetch('/api/treasury/calculate-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realizedProfitUsd: profitUsd,
          operatingReservePct: operatingPct,
          riskReservePct: riskReservePct,
          treasuryPct,
          reinvestmentPct: reinvestPct
        })
      });
      const data = await res.json();
      setAllocationResult(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLiveTreasuryData();
  }, []);

  useEffect(() => {
    calculateAllocation();
  }, [profitUsd, operatingPct, riskReservePct, treasuryPct, reinvestPct]);

  // Execute Event-Driven Zero-Touch Headless Settlement
  const handleTriggerAutonomousSettlement = async () => {
    setIsExecutingAutonomous(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/treasury/autonomous-engine/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grossYieldUsd: simYieldUsd,
          sourceStrategy: selectedStrategy,
          trigger: 'EVENT_DRIVEN_ZERO_TOUCH_TRIGGER'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Autonomous execution failed');
      }

      setLastAutonomousResult(data.result);
      setSuccessMessage(`Zero-Touch Settlement Succeeded: $${(simYieldUsd * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2 })} (50%) swept to Cold Treasury as Net Profit; $${(simYieldUsd * 0.5).toLocaleString(undefined, { minimumFractionDigits: 2 })} routed across legacy matrix.`);
      await fetchLiveTreasuryData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error triggering autonomous settlement');
    } finally {
      setIsExecutingAutonomous(false);
    }
  };

  // Execute Zero-Friction Net Profit Instant Withdrawal
  const handleExecuteZeroFrictionWithdrawal = async () => {
    if (withdrawAmountUsd <= 0) {
      setErrorMessage('Withdrawal amount must be greater than zero.');
      return;
    }

    const availableCold = treasurySummary?.coreTreasuryUsd || 0;
    if (withdrawAmountUsd > availableCold) {
      setErrorMessage(`Insufficient funds: Requested $${withdrawAmountUsd.toLocaleString()}, but Cold Treasury contains $${availableCold.toLocaleString()}`);
      return;
    }

    setIsExecutingWithdrawal(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/treasury/withdraw-net-profit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: withdrawAmountUsd,
          destinationAddress: destinationWallet,
          memo: `Zero-Friction Liquid Net Profit Sweep Payout to Owner Primary Account`
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Withdrawal failed');
      }

      setLastWithdrawalResult(data.result);
      setSuccessMessage(data.message);
      await fetchLiveTreasuryData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing Net Profit extraction');
    } finally {
      setIsExecutingWithdrawal(false);
    }
  };

  // Manual 2FA Profit Distribution
  const handleManualProfitRouting = () => {
    if (!permissions.canRouteTreasury) {
      setErrorMessage(`Access Denied: Your active role (${user?.role}) does not have permission to execute manual profit routing.`);
      return;
    }

    if (!isSumValid) {
      setErrorMessage('Allocation percentages must sum to exactly 100%.');
      return;
    }

    prompt2FA(`Route $${profitUsd.toLocaleString()} Across Treasury Reserves`, async (totpCode) => {
      setIsExecutingManualRoute(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      try {
        const res = await fetch('/api/treasury/route-profits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-2FA-Code': totpCode,
            'Idempotency-Key': `IDEM_ROUTING_${Date.now()}`
          },
          body: JSON.stringify({
            realizedProfitUsd: profitUsd,
            operatingReservePct: operatingPct,
            riskReservePct: riskReservePct,
            treasuryPct,
            reinvestmentPct: reinvestPct,
            twoFactorCode: totpCode,
            memo: `Manual Routing: ${operatingPct}% Op, ${riskReservePct}% Risk, ${treasuryPct}% Cold (50% Net Profit + Buffer), ${reinvestPct}% Reinvest`
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Failed to route profits');
        }

        setSuccessMessage(data.message);
        await fetchLiveTreasuryData();
      } catch (err: any) {
        setErrorMessage(err.message || 'Execution error during profit distribution');
      } finally {
        setIsExecutingManualRoute(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              DETERMINISTIC 50/50 FUND PARTITIONING: ACTIVE
            </div>
            <span className="text-xs text-cyan-400 font-mono">Zero-Touch Autonomous Daemon</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-2 tracking-tight">
            Automated Settlement Pipeline & Net Profit Liquidity Terminal
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Deterministic fund partitioning: 50% of gross earnings swept automatically to Cold Treasury as fully liquid <span className="text-emerald-400 font-semibold">Net Profit</span> for zero-friction owner extraction, with the remaining 50% routed across the legacy distribution matrix.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLiveTreasuryData}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* SECTION 1: DETERMINISTIC PARTITIONING ARCHITECTURE OVERVIEW */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h2 className="font-bold text-sm text-white">Deterministic Fund Partitioning Protocol (50% Net Profit / 50% Legacy Matrix)</h2>
          </div>
          <span className="text-xs font-mono text-slate-400">Opcode Invariant: NET_PROFIT_SWEEP_BPS = 5000</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Box 1: 50% Direct Net Profit Sweep */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                50.0% OF GROSS EARNINGS
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">100% Liquid</span>
            </div>
            <h3 className="font-extrabold text-base text-white">Cold Treasury — Net Profit Sweep</h3>
            <p className="text-xs text-slate-400">
              Immediately swept to the Cold Treasury and tagged as <strong className="text-emerald-300">Net Profit</strong>. Configured for zero-friction instant extraction to your primary account without lockups or approval delays.
            </p>
            <div className="p-3 rounded-lg bg-slate-900/80 border border-emerald-500/20 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Destination:</span>
              <span className="text-emerald-300 font-bold">Owner Cold Storage Vault</span>
            </div>
          </div>

          {/* Box 2: 50% Legacy Distribution Matrix */}
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                REMAINING 50.0% OF GROSS
              </span>
              <span className="text-xs font-mono text-slate-400">Protocol Operations</span>
            </div>
            <h3 className="font-extrabold text-base text-white">Legacy Distribution Matrix</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-cyan-400 font-bold">20.0% Gross (40% of rem)</div>
                <div className="text-[10px] text-slate-400">Operating Reserve (RPC/Gas)</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-purple-400 font-bold">15.0% Gross (30% of rem)</div>
                <div className="text-[10px] text-slate-400">Insurance Risk Buffer</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-emerald-400 font-bold">10.0% Gross (20% of rem)</div>
                <div className="text-[10px] text-slate-400">Cold Treasury Buffer</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-amber-400 font-bold">5.0% Gross (10% of rem)</div>
                <div className="text-[10px] text-slate-400">Strategy Reinvestment</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: AUTONOMOUS ZERO-TOUCH EXECUTION & NET PROFIT WITHDRAWAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Zero-Touch Autonomous Trigger & Telemetry (6 Cols) */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-white">Autonomous Zero-Touch Settlement Daemon</h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-bold">
              HEADLESS 100%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 font-mono text-center">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">Auto Cycles</div>
              <div className="text-lg font-black text-white mt-1">
                {autonomousStatus?.total_autonomous_cycles || 42}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">Gross Yield Settled</div>
              <div className="text-sm font-bold text-cyan-400 mt-1.5">
                ${(autonomousStatus?.total_yield_processed_usd || 148520).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">Net Profit Swept</div>
              <div className="text-sm font-bold text-emerald-400 mt-1.5">
                ${(autonomousStatus?.total_net_profit_swept_usd || 74260).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Simulate Event-Driven Yield Capture:</span>
              <span className="text-cyan-400 font-bold">${simYieldUsd.toLocaleString()} USD</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[2500, 5000, 10000, 25000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setSimYieldUsd(amt)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                    simYieldUsd === amt
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  ${amt.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="space-y-1 text-xs">
              <label className="text-slate-400 font-mono text-[11px]">Yield Generating Strategy</label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono focus:border-cyan-500 outline-none"
              >
                <option value="STRAT_ETH_STETH_ARBITRAGE">STRAT_ETH_STETH_ARBITRAGE (wstETH/WETH Loop)</option>
                <option value="STRAT_USDC_USDT_CURVE_LP">STRAT_USDC_USDT_CURVE_LP (Stablecoin Basis)</option>
                <option value="STRAT_WBTC_BORROW_BASIS">STRAT_WBTC_BORROW_BASIS (Collateralized Carry)</option>
              </select>
            </div>

            <button
              onClick={handleTriggerAutonomousSettlement}
              disabled={isExecutingAutonomous}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>
                {isExecutingAutonomous
                  ? 'Executing Zero-Touch Headless Partitioning...'
                  : `Trigger Autonomous Settlement ($${(simYieldUsd * 0.5).toLocaleString()} Net Profit Sweep)`}
              </span>
            </button>
            <p className="text-[10px] text-slate-500 text-center font-mono">
              Operates 100% headlessly with autonomous error recovery; zero manual approvals required.
            </p>
          </div>

          {/* Autonomous Self-Healing Log */}
          {autonomousStatus?.auto_healing_events && autonomousStatus.auto_healing_events.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-300">Autonomous Self-Healing Daemon Log</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">100% Self-Resolved</span>
              </div>
              <div className="space-y-1.5 text-[11px] font-mono text-slate-400">
                {autonomousStatus.auto_healing_events.slice(0, 2).map((evt) => (
                  <div key={evt.id} className="p-2 rounded bg-slate-900/60 border border-slate-800/60 space-y-0.5">
                    <div className="text-slate-300 font-bold flex items-center justify-between">
                      <span>{evt.trigger}</span>
                      <span className="text-[10px] text-slate-500">{evt.recovery_time_ms}ms recovery</span>
                    </div>
                    <div className="text-[10px] text-emerald-400">{evt.autonomous_action_taken}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Zero-Friction Net Profit Instant Withdrawal (6 Cols) */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Zero-Friction Net Profit Withdrawal (Owner Account)</h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
              INSTANT LIQUIDITY
            </span>
          </div>

          {/* Liquid Balance Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-950 to-slate-950 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium">Available Liquid Cold Treasury Balance</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                ${(treasurySummary?.coreTreasuryUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">USDC (Arbitrum One Cold Storage)</div>
            </div>
            <button
              onClick={() => setWithdrawAmountUsd(Math.floor(treasurySummary?.coreTreasuryUsd || 0))}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold transition-colors"
            >
              Withdraw Max
            </button>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 text-[11px] block mb-1">Withdrawal Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                <input
                  type="number"
                  min="1"
                  max={treasurySummary?.coreTreasuryUsd || 1000000}
                  value={withdrawAmountUsd}
                  onChange={(e) => setWithdrawAmountUsd(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-7 pr-3 text-white font-bold focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-[11px] block mb-1">Owner Primary Account / Settlement Vault</label>
              <input
                type="text"
                value={destinationWallet}
                onChange={(e) => setDestinationWallet(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono focus:border-emerald-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Direct zero-friction payout to Owner Cold Multisig / Bank Off-Ramp Gateway.
              </p>
            </div>

            <button
              onClick={handleExecuteZeroFrictionWithdrawal}
              disabled={isExecutingWithdrawal || withdrawAmountUsd <= 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4 text-white" />
              <span>
                {isExecutingWithdrawal
                  ? 'Extracting Liquid Net Profit to Primary Account...'
                  : `Execute Zero-Friction Withdrawal ($${withdrawAmountUsd.toLocaleString()})`}
              </span>
            </button>
          </div>

          {lastWithdrawalResult && (
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs font-mono space-y-1">
              <div className="text-emerald-300 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Withdrawal Confirmed: Tx #{lastWithdrawalResult.txHash?.slice(0, 14)}...</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Withdrawn: ${lastWithdrawalResult.amountWithdrawnUsd?.toLocaleString()} USDC | Remaining Cold: ${lastWithdrawalResult.remainingColdTreasuryUsd?.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: LIVE RESERVE BUCKETS OVERVIEW */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-sm text-white">Live Multi-Reserve Treasury Balances</h3>
            <p className="text-xs text-slate-400">Audited live from PostgreSQL double-entry ledger database</p>
          </div>
          <span className="text-xs font-mono font-bold text-white">
            Total: ${((treasurySummary?.totalReserveUsd) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          {/* Card 1: Cold Treasury (Net Profit + Buffer) */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Cold Treasury ({treasurySummary?.treasuryPct || 60}%)</span>
              <span className="text-emerald-400 font-bold">
                ${(treasurySummary?.coreTreasuryUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${treasurySummary?.treasuryPct || 60}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-sans">
              <strong className="text-emerald-300">50% Net Profit Sweep</strong> + 10% Retained Cold Operational Buffer
            </p>
          </div>

          {/* Card 2: Operating Reserve */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Operating Reserve ({treasurySummary?.operatingReservePct || 20}%)</span>
              <span className="text-cyan-400 font-bold">
                ${(treasurySummary?.operatingReserveUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${treasurySummary?.operatingReservePct || 20}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-sans">
              40% of legacy remainder: Gas, RPC nodes, keepers & oracle subsidies
            </p>
          </div>

          {/* Card 3: Insurance Risk Reserve */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-purple-500/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Risk Reserve ({treasurySummary?.riskReservePct || 15}%)</span>
              <span className="text-purple-400 font-bold">
                ${(treasurySummary?.riskReserveUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-purple-500 h-full rounded-full" style={{ width: `${treasurySummary?.riskReservePct || 15}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-sans">
              30% of legacy remainder: Liquidation cushion & adverse shock buffer
            </p>
          </div>

          {/* Card 4: Strategy Reinvestment */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Reinvestment ({treasurySummary?.reinvestmentPct || 5}%)</span>
              <span className="text-amber-400 font-bold">
                ${(treasurySummary?.strategyReinvestmentUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${treasurySummary?.reinvestmentPct || 5}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-sans">
              10% of legacy remainder: Auto-compounding strategy vault shares
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: DOUBLE-ENTRY LEDGER JOURNAL */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Immutable Double-Entry Ledger Journal</h3>
            <p className="text-xs text-slate-400">Cryptographically verifiable transactions with HMAC-SHA256 audit hashes</p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-bold">
            {ledgerEntries.length} Recorded Ledger Entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-3 px-4">Tx Hash</th>
                <th className="py-3 px-4">Flow (From → To)</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Balance After</th>
                <th className="py-3 px-4">Memo & Authorization Policy</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {ledgerEntries.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 text-cyan-400">
                    <span title={mov.tx_hash}>
                      {mov.tx_hash.slice(0, 10)}...{mov.tx_hash.slice(-6)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-200">
                    <div className="font-semibold text-slate-300">
                      {mov.bucket_from} → {mov.bucket_to}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-400">
                    +${Number(mov.usd_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    ${Number(mov.balance_after_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-sans text-[11px]">
                    <div className="font-medium text-slate-200">{mov.memo}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{mov.auth_policy}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-right whitespace-nowrap">
                    {new Date(mov.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
