import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Layers, 
  TrendingUp, 
  Sliders, 
  FileText, 
  Code2, 
  Database, 
  Lock,
  ChevronDown,
  User,
  Zap,
  CheckCircle,
  KeyRound,
  FileCheck2
} from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isEmergencyPaused: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isEmergencyPaused
}) => {
  const { user, role, switchRole, logout } = useAuth();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Treasury & Risk Overview', icon: Layers },
    { id: 'treasury', label: 'Profit Routing & Ledger', icon: Lock },
    { id: 'collateral', label: 'Collateral & Loan Optimizer', icon: Sliders },
    { id: 'backtest', label: 'Strategy Lab & Backtest', icon: TrendingUp },
    { id: 'execution', label: 'Execution Pipeline', icon: Zap },
    { id: 'security', label: 'Cybersecurity & Breakers', icon: ShieldCheck },
    { id: 'audit', label: 'Audit Trail & Compliance', icon: FileCheck2 },
    { id: 'contracts', label: 'Smart Contracts Spec', icon: Code2 },
    { id: 'database', label: 'PostgreSQL Schema', icon: Database },
    { id: 'docs', label: 'Security Architecture', icon: FileText },
  ];

  const roles: { role: UserRole; title: string; desc: string }[] = [
    { role: 'ADMIN', title: 'Admin / Principal Architect', desc: 'Full permissions: killswitch, profit routing, users' },
    { role: 'RISK_MANAGER', title: 'Risk Manager / Quant Lead', desc: 'Can trip breakers, rebalance reserves, adjust risk' },
    { role: 'OPERATOR', title: 'Execution Operator', desc: 'Can trigger trade simulations & pipeline traces' },
    { role: 'AUDITOR', title: 'External Compliance Auditor', desc: 'Read-only access with cryptographic proof verification' },
    { role: 'VIEWER', title: 'Institutional LP Viewer', desc: 'Telemetry viewing without execution privileges' }
  ];

  return (
    <header className="bg-slate-950 border-b border-slate-800/80 sticky top-0 z-40">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold text-base">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white font-mono">
                  AEGIS<span className="text-cyan-400">QUANT</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                  PROD v1.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Institutional DeFi Treasury & Algorithmic Risk Engine</p>
            </div>
          </div>

          {/* Right Session / RBAC Controls */}
          <div className="flex items-center gap-3">
            {/* Killswitch status pill */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold ${
              isEmergencyPaused
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 animate-pulse'
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isEmergencyPaused ? 'bg-rose-400' : 'bg-emerald-400'}`} />
              <span>{isEmergencyPaused ? 'KILLSWITCH ACTIVE' : 'SYSTEM ARMED'}</span>
            </div>

            {/* RBAC Role Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 transition-colors shadow-sm"
              >
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="font-mono font-bold text-cyan-300">{role}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <div className="text-[11px] font-bold text-white flex items-center justify-between">
                      <span>Switch RBAC Role (Testing)</span>
                      <KeyRound className="w-3 h-3 text-cyan-400" />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Current User: {user?.email}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {roles.map((r) => (
                      <button
                        key={r.role}
                        onClick={() => {
                          switchRole(r.role);
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col ${
                          role === r.role
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{r.title}</span>
                          {role === r.role && <CheckCircle className="w-3 h-3 text-cyan-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-cyan-300 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
