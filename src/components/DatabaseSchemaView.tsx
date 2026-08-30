import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  Copy, 
  Check, 
  Key, 
  Link2, 
  FileCode2, 
  Layers,
  Table as TableIcon
} from 'lucide-react';
import { DATABASE_TABLES, RAW_SQL_MIGRATION } from '../data/databaseSchema';

export const DatabaseSchemaView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TABLES' | 'SQL_MIGRATION'>('TABLES');
  const [copied, setCopied] = useState<boolean>(false);

  const categories = [
    { id: 'ALL', label: 'All Tables (36)' },
    { id: 'IAM', label: 'IAM & RBAC (6)' },
    { id: 'MARKET_DATA', label: 'Market Data & Oracles (6)' },
    { id: 'PORTFOLIO', label: 'Portfolio & Collateral (4)' },
    { id: 'TRADING', label: 'Orders & Execution (6)' },
    { id: 'TREASURY', label: 'Treasury & Reserves (7)' },
    { id: 'RISK_AUDIT', label: 'Risk, Breakers & Audits (7)' }
  ];

  const filteredTables = DATABASE_TABLES.filter((t) => {
    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
    const matchesSearch = t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.columns.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleCopySql = () => {
    navigator.clipboard.writeText(RAW_SQL_MIGRATION);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-lg text-white">Production PostgreSQL Schema Architecture (36+ Tables)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Enterprise database schema featuring strict foreign key integrity, zero private-key retention, timestamp indexes, and audit logging for every financial state transition.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('TABLES')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'TABLES'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table Inspector</span>
          </button>
          <button
            onClick={() => setViewMode('SQL_MIGRATION')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'SQL_MIGRATION'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Raw SQL Migrations</span>
          </button>
        </div>
      </div>

      {viewMode === 'TABLES' ? (
        <>
          {/* Filter & Search Bar */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                    selectedCategory === c.id
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search table or column..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Table Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTables.map((t) => (
              <div key={t.tableName} className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-cyan-400" />
                      <span className="font-mono font-bold text-sm text-white">{t.tableName}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-300">
                      {t.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">{t.description}</p>

                  <div className="space-y-2 text-xs font-mono border-t border-slate-800/80 pt-3">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Key className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>PK: {t.primaryKey}</span>
                    </div>

                    {t.foreignKeys.length > 0 && (
                      <div className="flex items-start gap-2 text-slate-400">
                        <Link2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <div>
                          {t.foreignKeys.map((fk, idx) => (
                            <div key={idx} className="text-[11px] text-slate-400">FK: {fk}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>{t.columns.length} columns defined</span>
                  <span>{t.indexes.length} indexes</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* SQL Migration File View */
        <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 relative">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs font-mono">
            <span className="text-slate-400">migrations/V1.0.0__aegis_quant_core.sql</span>
            <button
              onClick={handleCopySql}
              className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-sans text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Migration SQL' : 'Copy Full SQL Migration'}</span>
            </button>
          </div>

          <pre className="text-xs font-mono text-slate-300 overflow-x-auto p-2 leading-relaxed max-h-[600px] scrollbar-thin">
            <code>{RAW_SQL_MIGRATION}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
