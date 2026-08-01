import React, { useState } from 'react';
import { Printer, Sliders, Menu } from 'lucide-react';

interface WorksheetHeaderProps {
  worksheetName: string;
  onOpenSettings: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

const WorksheetHeader: React.FC<WorksheetHeaderProps> = ({
  worksheetName,
  onOpenSettings,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
}) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setInternalIsCollapsed(next);
    if (onToggleCollapse) {
      onToggleCollapse(next);
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-');
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const safeName = worksheetName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    document.title = `${safeName}_${dateStr}_${timeStr}`;
    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  return (
    <header className="fixed top-2.5 left-0 right-0 z-50 no-print print:hidden px-3 sm:px-6 transition-all duration-300 pointer-events-none">
      <div className={`max-w-5xl mx-auto flex ${isCollapsed ? 'justify-start' : 'justify-center'}`}>
        {isCollapsed ? (
          /* Reduced / Collapsed Mode: 50% transparent trigger button with Menu icon */
          <button
            onClick={toggleCollapse}
            className="pointer-events-auto p-2 bg-white/50 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/50 hover:border-slate-300 opacity-50 hover:opacity-100 backdrop-blur-xs rounded-xl transition-all active:scale-95 shrink-0 flex items-center justify-center hover:shadow-md"
            title="Afficher la barre d'outils"
            aria-label="Afficher la barre"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : (
          /* Full / Compact Header Bar */
          <div className="pointer-events-auto w-full bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-sm hover:shadow-md px-3.5 sm:px-5 py-2 flex items-center justify-between gap-3 transition-all duration-300">
            {/* Title Section */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={toggleCollapse}
                className="p-1.5 bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-all active:scale-95 shrink-0"
                title="Réduire la barre"
                aria-label="Réduire la barre"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1
                className="text-xs sm:text-sm md:text-base font-bold font-display text-slate-900 truncate"
                title={worksheetName}
              >
                {worksheetName}
              </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-200 rounded-lg transition-all active:scale-95 shadow-2xs"
                aria-label="Paramètres"
                title="Paramètres de la fiche"
              >
                <Sliders className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">Paramètres</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all active:scale-95 shadow-2xs hover:shadow-xs"
                aria-label="Imprimer la fiche"
                title="Imprimer (Ctrl+P)"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Imprimer</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default WorksheetHeader;

