import React, { useState } from 'react';
import { 
  Code2, 
  ShieldCheck, 
  Copy, 
  Check, 
  Lock, 
  Terminal, 
  FileCode2, 
  Layers,
  Sparkles
} from 'lucide-react';
import { SMART_CONTRACTS } from '../data/smartContracts';

export const SmartContractsView: React.FC = () => {
  const [selectedContractIndex, setSelectedContractIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const currentContract = SMART_CONTRACTS[selectedContractIndex];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentContract.solidityCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">Smart Contract Architecture & Invariant Specs</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Formal OpenZeppelin-secured Solidity contracts with ERC-4626 vault standards, granular RBAC, withdrawal timelocks, and zero unrestricted arbitrary withdrawal interfaces.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Foundry Invariant Fuzzing: 100,000 Runs Passed</span>
        </div>
      </div>

      {/* Contract Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {SMART_CONTRACTS.map((c, i) => (
          <button
            key={c.name}
            onClick={() => setSelectedContractIndex(i)}
            className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${
              selectedContractIndex === i
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Contract Details & Code View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Metadata & Security Guards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <h3 className="font-bold text-white text-base">{currentContract.name}</h3>
            <div className="text-xs text-cyan-400 font-mono mt-0.5">{currentContract.standard}</div>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              {currentContract.description}
            </p>
          </div>

          {/* Security Invariant Guards */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Formal Security Guards</span>
            </div>
            <ul className="space-y-2 text-xs">
              {currentContract.securityGuards.map((guard, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-300">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{guard}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Function Roles */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Key Interface Signatures & Roles</span>
            </div>
            <div className="space-y-3">
              {currentContract.keyFunctions.map((fn, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                    <span className="text-cyan-300 font-semibold">{fn.signature}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-[10px]">{fn.role}</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">{fn.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Solidity Source Code */}
        <div className="lg:col-span-7 p-6 rounded-xl bg-slate-950 border border-slate-800 relative">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs font-mono">
            <span className="text-slate-400">contracts/{currentContract.name}</span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-sans text-xs bg-slate-900 px-3 py-1 rounded-lg border border-slate-800"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Solidity Code'}</span>
            </button>
          </div>

          <pre className="text-xs font-mono text-slate-300 overflow-x-auto p-2 leading-relaxed max-h-[600px] scrollbar-thin">
            <code>{currentContract.solidityCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
