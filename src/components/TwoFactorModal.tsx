import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, X, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const TwoFactorModal: React.FC = () => {
  const { pending2FA, close2FAModal, user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!pending2FA) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit numeric TOTP code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      await pending2FA.onVerified(code);
      close2FAModal();
    } catch (err: any) {
      setError(err.message || '2FA Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuickCode = (sampleCode: string) => {
    setCode(sampleCode);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={close2FAModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">2FA Security Authorization</h3>
            <p className="text-xs text-slate-400">High-Assurance Action Verification</p>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 mb-4 text-xs text-slate-300">
          <div className="font-semibold text-cyan-300">Action: {pending2FA.actionName}</div>
          <div className="text-slate-400 mt-0.5">Authorizer: {user?.fullName} ({user?.role})</div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Enter 6-Digit TOTP / Hardware Token Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 text-center text-2xl tracking-[0.5em] font-mono text-white rounded-lg py-2.5 outline-none transition-colors"
            />
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Demo hardware key:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleQuickCode('123456')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono rounded"
              >
                123456
              </button>
              <button
                type="button"
                onClick={() => handleQuickCode('849201')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono rounded"
              >
                849201
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={close2FAModal}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authorize Action</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
