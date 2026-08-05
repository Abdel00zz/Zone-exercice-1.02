import React, { useState } from 'react';
import { Menu } from 'lucide-react';

interface WorksheetHeaderProps {
  worksheetName: string;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

const WorksheetHeader: React.FC<WorksheetHeaderProps> = ({
  worksheetName,
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

  return (
    <header className="fixed top-2.5 left-0 right-0 z-50 no-print print:hidden px-3 sm:px-6 transition-all duration-300 pointer-events-none">
      <div className={`max-w-5xl landscape:max-w-6xl xl:landscape:max-w-7xl mx-auto flex ${isCollapsed ? 'justify-start' : 'justify-center'}`}>
        {isCollapsed ? (
          /* Reduced / Collapsed Mode: 50% transparent trigger button with Menu icon - Style iOS sans arrondi */
          <button
            onClick={toggleCollapse}
            className="pointer-events-auto p-2 bg-white/40 hover:bg-white/60 text-slate-700 hover:text-slate-900 border border-slate-300/40 hover:border-slate-400/60 opacity-50 hover:opacity-100 backdrop-blur-md rounded-none transition-all active:scale-95 shrink-0 flex items-center justify-center hover:shadow-sm"
            title="Afficher la barre d'outils"
            aria-label="Afficher la barre"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : (
          /* Full / Compact Header Bar - Style iOS sans arrondi, bordure douce */
          <div className="pointer-events-auto w-full bg-white/80 backdrop-blur-md border-b border-gray-900/20 rounded-none shadow-sm px-3.5 sm:px-5 py-2.5 flex items-center gap-3 transition-all duration-300">
            {/* Title Section */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={toggleCollapse}
                className="p-1.5 bg-transparent hover:bg-gray-100/80 text-slate-600 hover:text-slate-900 rounded-none transition-all active:scale-95 shrink-0"
                title="Réduire la barre"
                aria-label="Réduire la barre"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1
                className="text-xs sm:text-sm md:text-base font-semibold font-display text-slate-900 truncate"
                title={worksheetName}
              >
                {worksheetName}
              </h1>
            </div>

          </div>
        )}
      </div>
    </header>
  );
};

export default WorksheetHeader;
