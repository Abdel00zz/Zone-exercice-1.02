import React, { useState } from 'react';
import { X, Cloud, RefreshCw, Copy, Check } from 'lucide-react';
import type { CloudSyncState } from '../hooks/useCloudSync';

interface SyncPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sync: CloudSyncState;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const SyncPanel: React.FC<SyncPanelProps> = ({ isOpen, onClose, sync }) => {
  const [codeInput, setCodeInput] = useState(sync.code);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(sync.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const statusLabel: Record<typeof sync.status, string> = {
    disconnected: 'Non connecté',
    idle: 'Connecté, en attente',
    syncing: 'Synchronisation…',
    synced: sync.lastSyncAt ? `Synchronisé (${new Date(sync.lastSyncAt).toLocaleTimeString('fr-FR')})` : 'Synchronisé',
    error: sync.error || 'Erreur de synchronisation',
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold font-display text-slate-900 flex items-center gap-2">
            <Cloud className="h-5 w-5 text-sky-600" /> Synchronisation PC ↔ Tablette
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition" aria-label="Fermer">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </header>

        <main className="p-6 overflow-y-auto text-gray-900 custom-scrollbar space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Ce qu'est cet appareil</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => sync.setRole('source')}
                className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                  sync.role === 'source' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300 hover:border-sky-400'
                }`}
              >
                Source (PC)
              </button>
              <button
                onClick={() => sync.setRole('receiver')}
                className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                  sync.role === 'receiver' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300 hover:border-sky-400'
                }`}
              >
                Récepteur (tablette)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Code de session partagé</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
                onBlur={() => sync.setCode(codeInput)}
                placeholder="EX: A1B2C3"
                maxLength={6}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono tracking-widest text-center uppercase focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 outline-none"
              />
              {sync.role === 'source' && (
                <button
                  onClick={() => { const c = generateCode(); setCodeInput(c); sync.setCode(c); }}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  title="Générer un nouveau code"
                >
                  Générer
                </button>
              )}
              <button
                onClick={handleCopy}
                disabled={!sync.code}
                className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                title="Copier le code"
                aria-label="Copier le code"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Saisis le même code sur le PC (Source) et la tablette (Récepteur) pour les relier.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold text-slate-700">Statut : </span>
              <span className={sync.status === 'error' ? 'text-red-600' : 'text-slate-600'}>{statusLabel[sync.status]}</span>
            </div>
            <button
              onClick={sync.syncNow}
              disabled={!sync.role || !sync.code || sync.status === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sync.status === 'syncing' ? 'animate-spin' : ''}`} />
              Synchroniser
            </button>
          </div>

          <button
            onClick={() => { sync.setRole(null); setCodeInput(''); }}
            className="text-xs text-slate-500 hover:text-red-600 underline"
          >
            Désactiver la synchronisation sur cet appareil
          </button>
        </main>
      </div>
    </div>
  );
};

export default SyncPanel;
