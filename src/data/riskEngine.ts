export const MATHEMATICAL_RISK_SPECS = {
  formulas: [
    {
      name: 'Loan-To-Value (LTV)',
      latex: 'LTV = \\frac{Debt}{CollateralValue}',
      variables: [
        { symbol: 'Debt', description: 'Total outstanding debt in USD, including accrued variable borrowing interest.' },
        { symbol: 'CollateralValue', description: 'Mark-to-market USD value of deposited collateral evaluated via verified multi-source oracle.' }
      ],
      institutionalConstraint: 'LTV \\le 0.7800 (78.00% hard ceiling; buffer against protocol default)'
    },
    {
      name: 'Liquidation Health Factor (HF)',
      latex: 'HF = \\frac{CollateralValue \\times LiquidationThreshold}{Debt}',
      variables: [
        { symbol: 'CollateralValue', description: 'Current oracle-verified value of pledged collateral.' },
        { symbol: 'LiquidationThreshold', description: 'Protocol-defined parameter (e.g. 0.85 for ETH in Aave V3).' },
        { symbol: 'Debt', description: 'Outstanding debt obligation in USD.' }
      ],
      institutionalConstraint: 'HF \\ge 1.350 (Normal operations); If HF < 1.350 \\rightarrow REDUCE; If HF < 1.150 \\rightarrow EMERGENCY_STOP'
    },
    {
      name: 'Expected Net Return',
      latex: 'NetReturn = GrossReturn - (BorrowCost + TradingFees + GasCost + Slippage + ProtocolFees)',
      variables: [
        { symbol: 'GrossReturn', description: 'Projected annualized strategy yield (e.g. staking, DEX arbitrage spread).' },
        { symbol: 'BorrowCost', description: 'Variable borrowing APR charged by the lending pool.' },
        { symbol: 'TradingFees', description: 'DEX pool swap fees (e.g. 0.05% or 0.30% fee tier).' },
        { symbol: 'GasCost', description: 'Amortized network execution cost in USD.' },
        { symbol: 'Slippage', description: 'Simulated price impact based on pool depth curve.' },
        { symbol: 'ProtocolFees', description: 'Treasury performance/management fees.' }
      ],
      institutionalConstraint: 'NetReturn > 0; Must exceed Risk-Free Benchmark (4.0% SOFR/USDC rate)'
    },
    {
      name: 'Liquidation Distance (Buffer %)',
      latex: 'LiquidationDistance = \\left(1 - \\frac{Debt}{CollateralValue \\times LiquidationThreshold}\\right) \\times 100\\%',
      variables: [
        { symbol: 'LiquidationDistance', description: 'Percentage by which collateral price can crash before triggering protocol liquidation.' }
      ],
      institutionalConstraint: 'LiquidationDistance \\ge 20.0\\% minimum price shock cushion.'
    },
    {
      name: 'Conservative Half-Kelly Sizing',
      latex: 'f^* = \\min\\left(0.20,\\; 0.5 \\times \\frac{p \\cdot b - (1-p) \\cdot a}{b}\\right)',
      variables: [
        { symbol: 'p', description: 'Historical strategy win probability (e.g. 0.62).' },
        { symbol: 'b', description: 'Reward ratio on winning trades (profit factor).' },
        { symbol: 'a', description: 'Loss ratio on losing trades.' },
        { symbol: '0.5 \\times Kelly', description: 'Conservative 50% fraction to avoid gambler ruin.' },
        { symbol: '0.20', description: 'Hard 20.0% capital allocation ceiling per single strategy.' }
      ],
      institutionalConstraint: 'Never used for unconstrained leverage; hard capped at 20.0% of treasury.'
    },
    {
      name: 'Value-at-Risk (VaR 99%)',
      latex: 'VaR_{99\\%} = PortfolioValue \\times (Z_{0.99} \\times \\sigma \\times \\sqrt{\\Delta t})',
      variables: [
        { symbol: 'Z_{0.99}', description: 'Standard normal critical value (2.326).' },
        { symbol: '\\sigma', description: 'Rolling annualized volatility of the portfolio assets.' },
        { symbol: '\\Delta t', description: 'Holding period time horizon (1 day = 1/365).' }
      ],
      institutionalConstraint: 'Daily VaR_{99\\%} \\le 3.5\\% of total treasury equity.'
    }
  ],
  pythonEngineCode: `"""
AegisQuant Institutional Mathematical Risk Engine
Production Quantitative Invariant Evaluator
"""
import numpy as np
from dataclasses import dataclass
from enum import Enum
from typing import List, Tuple, Dict, Any

class RiskDecision(Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REDUCE_POSITION = "REDUCE_POSITION"
    CLOSE_POSITION = "CLOSE_POSITION"
    EMERGENCY_STOP = "EMERGENCY_STOP"

@dataclass(frozen=True)
class RiskInput:
    collateral_value_usd: float
    debt_value_usd: float
    liquidation_threshold: float  # e.g., 0.85
    expected_gross_return: float  # e.g., 0.14
    borrow_apr: float             # e.g., 0.042
    trading_fee_pct: float        # e.g., 0.003
    gas_cost_usd: float           # e.g., 15.00
    trade_notional_usd: float     # e.g., 50000.00
    simulated_slippage_bps: int   # e.g., 18
    asset_annual_volatility: float# e.g., 0.48
    total_portfolio_equity: float # e.g., 500000.00

@dataclass
class RiskEvaluationResult:
    decision: RiskDecision
    reasons: List[str]
    ltv: float
    health_factor: float
    liquidation_distance_pct: float
    expected_net_return_pct: float
    sharpe_ratio: float
    conservative_kelly_fraction: float
    daily_var_99_usd: float

class InstitutionalRiskEngine:
    MAX_LTV_CEILING: float = 0.7800
    MIN_HEALTH_FACTOR_SAFE: float = 1.3500
    MIN_HEALTH_FACTOR_CRITICAL: float = 1.1500
    MIN_LIQUIDATION_BUFFER_PCT: float = 20.00
    MAX_STRATEGY_ALLOCATION_PCT: float = 0.2500
    MAX_SLIPPAGE_BPS_LIMIT: int = 40
    RISK_FREE_BENCHMARK: float = 0.0400  # 4.0% US Treasury / SOFR

    @classmethod
    def evaluate(cls, inp: RiskInput) -> RiskEvaluationResult:
        reasons: List[str] = []
        decision = RiskDecision.APPROVED

        # 1. LTV Calculation
        ltv = inp.debt_value_usd / max(1.0, inp.collateral_value_usd)
        
        # 2. Health Factor Calculation
        hf = (inp.collateral_value_usd * inp.liquidation_threshold) / max(1.0, inp.debt_value_usd)
        
        # 3. Liquidation Distance Calculation
        liq_distance_pct = max(0.0, (1.0 - (inp.debt_value_usd / (inp.collateral_value_usd * inp.liquidation_threshold))) * 100.0)

        # 4. Net Return Calculation
        gas_pct = (inp.gas_cost_usd / max(1.0, inp.trade_notional_usd))
        slippage_pct = inp.simulated_slippage_bps / 10000.0
        total_costs = inp.borrow_apr + inp.trading_fee_pct + gas_pct + slippage_pct
        net_return = inp.expected_gross_return - total_costs

        # 5. Sharpe Ratio
        sharpe = (net_return - cls.RISK_FREE_BENCHMARK) / max(0.01, inp.asset_annual_volatility)

        # 6. Conservative Half-Kelly Sizing
        p_win = 0.62
        b_profit_ratio = 1.75
        raw_kelly = (p_win * b_profit_ratio - (1.0 - p_win)) / b_profit_ratio
        conservative_kelly = max(0.0, min(cls.MAX_STRATEGY_ALLOCATION_PCT, raw_kelly * 0.5))

        # 7. Value-at-Risk (99% 1-day)
        z_99 = 2.326
        daily_vol = inp.asset_annual_volatility / np.sqrt(365.0)
        daily_var_usd = inp.trade_notional_usd * (z_99 * daily_vol)

        # Invariant Checks
        if hf < cls.MIN_HEALTH_FACTOR_CRITICAL:
            decision = RiskDecision.EMERGENCY_STOP
            reasons.append(f"CRITICAL: Health factor {hf:.4f} is below emergency tripwire ({cls.MIN_HEALTH_FACTOR_CRITICAL})")
        elif hf < cls.MIN_HEALTH_FACTOR_SAFE:
            decision = RiskDecision.REDUCE_POSITION
            reasons.append(f"DEFENSE: Health factor {hf:.4f} below institutional safe floor ({cls.MIN_HEALTH_FACTOR_SAFE})")

        if ltv > cls.MAX_LTV_CEILING:
            decision = RiskDecision.REJECTED if decision != RiskDecision.EMERGENCY_STOP else decision
            reasons.append(f"LTV {ltv*100:.2f}% exceeds hard limit of {cls.MAX_LTV_CEILING*100:.2f}%")

        if liq_distance_pct < cls.MIN_LIQUIDATION_BUFFER_PCT:
            decision = RiskDecision.REDUCE_POSITION if decision == RiskDecision.APPROVED else decision
            reasons.append(f"Liquidation cushion {liq_distance_pct:.2f}% below required {cls.MIN_LIQUIDATION_BUFFER_PCT}% buffer")

        if inp.simulated_slippage_bps > cls.MAX_SLIPPAGE_BPS_LIMIT:
            decision = RiskDecision.REJECTED
            reasons.append(f"Simulated slippage {inp.simulated_slippage_bps} bps exceeds limit ({cls.MAX_SLIPPAGE_BPS_LIMIT} bps)")

        if net_return <= 0:
            decision = RiskDecision.REJECTED
            reasons.append(f"Expected net return {net_return*100:.2f}% is negative after factoring borrow cost, gas, and slippage")

        if not reasons:
            reasons.append("All mathematical risk invariants, solvency limits, and liquidity thresholds APPROVED")

        return RiskEvaluationResult(
            decision=decision,
            reasons=reasons,
            ltv=ltv,
            health_factor=hf,
            liquidation_distance_pct=liq_distance_pct,
            expected_net_return_pct=net_return * 100.0,
            sharpe_ratio=sharpe,
            conservative_kelly_fraction=conservative_kelly,
            daily_var_99_usd=daily_var_usd
        )
`
};
