import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { TwoFactorModal } from './context/../components/TwoFactorModal';
import { Navbar } from './components/Navbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { CollateralLoanEngine } from './components/CollateralLoanEngine';
import { StrategyBacktester } from './components/StrategyBacktester';
import { ExecutionPipelineView } from './components/ExecutionPipelineView';
import { TreasuryManager } from './components/TreasuryManager';
import { SmartContractsView } from './components/SmartContractsView';
import { DatabaseSchemaView } from './components/DatabaseSchemaView';
import { SecurityCircuitBreakers } from './components/SecurityCircuitBreakers';
import { AuditTrailView } from './components/AuditTrailView';
import { DeploymentGatesView } from './components/DeploymentGatesView';
import { ApiExplorer } from './components/ApiExplorer';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isEmergencyPaused, setIsEmergencyPaused] = useState<boolean>(false);

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* 2FA Modal for High-Assurance Actions */}
        <TwoFactorModal />

        {/* Top Institutional Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isEmergencyPaused={isEmergencyPaused}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'overview' && (
            <OverviewDashboard
              onNavigateTab={setActiveTab}
              isEmergencyPaused={isEmergencyPaused}
            />
          )}

          {activeTab === 'treasury' && (
            <TreasuryManager />
          )}

          {activeTab === 'collateral' && (
            <CollateralLoanEngine />
          )}

          {(activeTab === 'backtest' || activeTab === 'quant') && (
            <StrategyBacktester />
          )}

          {activeTab === 'execution' && (
            <ExecutionPipelineView />
          )}

          {activeTab === 'security' && (
            <SecurityCircuitBreakers
              isEmergencyPaused={isEmergencyPaused}
              setIsEmergencyPaused={setIsEmergencyPaused}
            />
          )}

          {activeTab === 'audit' && (
            <AuditTrailView />
          )}

          {activeTab === 'contracts' && (
            <SmartContractsView />
          )}

          {activeTab === 'database' && (
            <DatabaseSchemaView />
          )}

          {(activeTab === 'docs' || activeTab === 'api') && (
            <ApiExplorer />
          )}

          {activeTab === 'gates' && (
            <DeploymentGatesView />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/80 py-6 px-4 sm:px-8 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">AegisQuant Production Platform</span>
            <span>•</span>
            <span>PostgreSQL & TypeScript Real-Time Engine</span>
            <span>•</span>
            <span>HMAC-SHA256 Chained Auditing</span>
          </div>

          <div className="font-mono text-[11px] text-slate-400">
            Environment: Production-Hardened Node.js | Port: 3000 | SOC-2 Invariants Active
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
