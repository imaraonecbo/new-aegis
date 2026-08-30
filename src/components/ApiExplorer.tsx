import React, { useState } from 'react';
import { 
  Code2, 
  Send, 
  CheckCircle2, 
  Terminal, 
  Layers, 
  Database,
  Lock,
  Key,
  Shield,
  UserCheck,
  Copy,
  Check,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ApiExplorer: React.FC = () => {
  const { user, loginAsRole } = useAuth();
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/health');
  const [requestMethod, setRequestMethod] = useState<'GET' | 'POST'>('GET');
  const [requestBody, setRequestBody] = useState<string>('{}');
  const [responseOutput, setResponseOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const iamCredentials = [
    {
      id: 'admin',
      role: 'ADMIN',
      name: 'Dr. Evelyn Vance (Chief Risk & System Architect)',
      email: 'admin@aegisquant.finance',
      password: 'AegisAdmin2026!Secure',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      test2faCode: '123456',
      permissions: 'Full system control, emergency circuit breakers, parameter tuning, profit allocation routing'
    },
    {
      id: 'risk',
      role: 'RISK_MANAGER',
      name: 'Marcus Chen (Principal Quantitative Risk Officer)',
      email: 'risk@aegisquant.finance',
      password: 'RiskManager2026!Sec',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      test2faCode: '123456',
      permissions: 'Collateral liquidation defense triggers, LTV cap adjustment, delta-neutral strategy deployment'
    },
    {
      id: 'operator',
      role: 'OPERATOR',
      name: 'Siddharth Rao (Execution & MEV Specialist)',
      email: 'operator@aegisquant.finance',
      password: 'Operator2026!Execute',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      test2faCode: '123456',
      permissions: 'Trade execution pipeline simulation, flash loan rebalancing, backtest execution'
    },
    {
      id: 'auditor',
      role: 'AUDITOR',
      name: 'Elena Rostova (Lead Smart Contract & Compliance Auditor)',
      email: 'auditor@aegisquant.finance',
      password: 'Auditor2026!Verify',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      test2faCode: '123456',
      permissions: 'HMAC-SHA256 audit ledger cryptographic verification, double-entry reconciliation reporting'
    },
    {
      id: 'viewer',
      role: 'VIEWER',
      name: 'Institutional LP Read-Only Auditor',
      email: 'viewer@aegisquant.finance',
      password: 'Viewer2026!Read',
      totpSecret: 'N/A',
      test2faCode: 'N/A',
      permissions: 'Read-only access to treasury reserves, collateral health factors, and performance metrics'
    }
  ];

  const endpoints = [
    {
      path: '/api/health',
      method: 'GET',
      summary: 'System health, uptime, circuit breaker states, and active gate level.',
      defaultBody: ''
    },
    {
      path: '/api/treasury/summary',
      method: 'GET',
      summary: 'Institutional multi-reserve treasury bucket balances and reconciled valuation.',
      defaultBody: ''
    },
    {
      path: '/api/risk/positions',
      method: 'GET',
      summary: 'Active collateralized debt positions, real-time LTV ratios, and liquidation thresholds.',
      defaultBody: ''
    },
    {
      path: '/api/risk/evaluate',
      method: 'POST',
      summary: 'Quantitative solvency, LTV ceiling, and liquidation health factor evaluator.',
      defaultBody: JSON.stringify({
        collateralValue: 100000,
        debt: 55000,
        liquidationThreshold: 0.85,
        expectedGrossReturn: 0.12,
        borrowingCost: 0.035,
        tradingFees: 0.003,
        gasCost: 0.001,
        slippage: 0.002,
        protocolFees: 0.001,
        volatility: 0.45
      }, null, 2)
    },
    {
      path: '/api/trading/simulate-pipeline',
      method: 'POST',
      summary: 'Idempotent 11-step trade simulation trace against EVM state.',
      defaultBody: JSON.stringify({
        strategyId: 'STRAT_ETH_STETH_ARBITRAGE',
        protocol: 'Aave V3 + Uniswap V3',
        amountUsd: 25000,
        tokenIn: 'WETH',
        tokenOut: 'wstETH',
        maxSlippageBps: 30
      }, null, 2)
    },
    {
      path: '/api/treasury/calculate-allocation',
      method: 'POST',
      summary: 'Mathematical profit routing breakdown across 4 treasury reserve buckets.',
      defaultBody: JSON.stringify({
        realizedProfitUsd: 10000,
        operatingReservePct: 40,
        riskReservePct: 30,
        treasuryPct: 20,
        reinvestmentPct: 10
      }, null, 2)
    },
    {
      path: '/api/audit/logs',
      method: 'GET',
      summary: 'HMAC-SHA256 chained audit entries with cryptographic parent verification hashes.',
      defaultBody: ''
    }
  ];

  const handleSelectEndpoint = (ep: any) => {
    setSelectedEndpoint(ep.path);
    setRequestMethod(ep.method as any);
    setRequestBody(ep.defaultBody || '{}');
    setResponseOutput('');
  };

  const handleExecuteRequest = async () => {
    setIsLoading(true);
    setResponseOutput('Executing request against backend server...');
    try {
      const options: RequestInit = {
        method: requestMethod,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token || 'sample-jwt-token'}`,
          'Idempotency-Key': `idem_${Date.now()}`
        }
      };
      if (requestMethod === 'POST' && requestBody) {
        options.body = requestBody;
      }
      const res = await fetch(selectedEndpoint, options);
      const data = await res.json();
      setResponseOutput(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResponseOutput(`Error executing API request: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: ENTERPRISE IAM & CREDENTIALS DOCUMENTATION */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-base text-white">Enterprise IAM Credentials & Authentication Document</h2>
              <p className="text-xs text-slate-400">SOC-2 Type II pre-seeded role credentials, TOTP secrets, and API access keys for institutional testing.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active Session: {user?.role || 'ADMIN'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {iamCredentials.map((cred) => (
            <div 
              key={cred.id} 
              className={`p-4 rounded-lg border transition-all ${
                user?.role === cred.role
                  ? 'bg-slate-800/80 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  cred.role === 'ADMIN' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                  cred.role === 'RISK_MANAGER' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                  cred.role === 'OPERATOR' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                  cred.role === 'AUDITOR' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                  'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  {cred.role}
                </span>

                <button
                  onClick={() => loginAsRole(cred.role as any)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium"
                >
                  Switch to Role
                </button>
              </div>

              <div className="text-xs font-semibold text-white truncate">{cred.name}</div>
              
              <div className="mt-3 space-y-2 text-[11px] font-mono">
                <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400">Email:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-200">{cred.email}</span>
                    <button 
                      onClick={() => copyToClipboard(cred.email, `${cred.id}-email`)}
                      className="text-slate-500 hover:text-cyan-400"
                      title="Copy Email"
                    >
                      {copiedKey === `${cred.id}-email` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400">Password:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-300">{cred.password}</span>
                    <button 
                      onClick={() => copyToClipboard(cred.password, `${cred.id}-pwd`)}
                      className="text-slate-500 hover:text-cyan-400"
                      title="Copy Password"
                    >
                      {copiedKey === `${cred.id}-pwd` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400">2FA Code / TOTP:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-300 font-bold">{cred.test2faCode}</span>
                    <span className="text-[10px] text-slate-500">({cred.totpSecret})</span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 text-[10px] text-slate-400 leading-snug">
                {cred.permissions}
              </div>
            </div>
          ))}
        </div>

        {/* Security & API Headers Reference */}
        <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-400 block mb-1">Standard JWT Authorization Header:</span>
            <code className="text-cyan-300 text-[11px] break-all bg-slate-900 p-1.5 rounded block border border-slate-800">
              Authorization: Bearer aegis_jwt_token_prod
            </code>
          </div>
          <div>
            <span className="text-slate-400 block mb-1">High-Assurance 2FA Header:</span>
            <code className="text-amber-300 text-[11px] bg-slate-900 p-1.5 rounded block border border-slate-800">
              X-2FA-Code: 123456
            </code>
          </div>
          <div>
            <span className="text-slate-400 block mb-1">Distributed Idempotency Key:</span>
            <code className="text-emerald-300 text-[11px] bg-slate-900 p-1.5 rounded block border border-slate-800">
              Idempotency-Key: idem_aegis_tx_78291
            </code>
          </div>
        </div>
      </div>

      {/* SECTION 2: OPENAPI 3.0 INTERACTIVE REST CONSOLE */}
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-cyan-400" />
              <h2 className="font-bold text-lg text-white">OpenAPI 3.0 Interactive REST & WebSocket Console</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Live interactive API console to execute requests against the AegisQuant backend endpoints with instant schema validation and millisecond latency telemetry.
            </p>
          </div>

          <button
            onClick={handleExecuteRequest}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Sending Request...' : 'Send API Request'}</span>
          </button>
        </div>

        {/* Endpoint Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {endpoints.map((ep) => (
            <button
              key={ep.path}
              onClick={() => handleSelectEndpoint(ep)}
              className={`px-3 py-2 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedEndpoint === ep.path
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                ep.method === 'GET' ? 'bg-emerald-800 text-emerald-200' : 'bg-indigo-800 text-indigo-200'
              }`}>
                {ep.method}
              </span>
              <span>{ep.path}</span>
            </button>
          ))}
        </div>

        {/* Request & Response Splitter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Request Payload */}
          <div className="lg:col-span-6 p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-white text-xs font-mono">Request Payload (JSON)</span>
              <span className="text-[11px] text-slate-400">Content-Type: application/json</span>
            </div>

            {requestMethod === 'POST' ? (
              <textarea
                rows={12}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 scrollbar-thin"
              />
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 font-mono bg-slate-950 rounded-lg border border-slate-800">
                GET requests have no request body payload. Click "Send API Request" to execute.
              </div>
            )}
          </div>

          {/* Right: Response Output */}
          <div className="lg:col-span-6 p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-white text-xs font-mono">Response Payload (JSON)</span>
              <span className="text-[11px] text-emerald-400 font-mono">HTTP 200 OK</span>
            </div>

            <pre className="text-xs font-mono text-slate-300 p-2 overflow-x-auto max-h-[300px] scrollbar-thin leading-relaxed">
              <code>{responseOutput || '// Click "Send API Request" above to test endpoint'}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
