import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, FileUp, Download, Code, Save, AlertCircle, CheckCircle2, AlignLeft, AlignJustify, HelpCircle, BookOpen, UploadCloud, Terminal } from 'lucide-react';
import type { WorksheetContent, Worksheet } from '../types';

// [NOTE: Ported from original JSONEditorModal for editor functionality]
const BRACKET_PAIRS: Record<string, string> = { '{': '}', '[': ']', '"': '"' };
const CLOSING_BRACKETS = new Set(['}', ']', '"']);

function getErrorLine(code: string, errorMsg: string): number | null {
  const posMatch = errorMsg.match(/position\s+(\d+)/i);
  if (posMatch) {
    const before = code.substring(0, parseInt(posMatch[1], 10));
    return before.split('\n').length;
  }
  return null;
}

interface JSONManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    worksheets: Worksheet[];
    onRestoreBackup: (backupWorksheets: Worksheet[]) => void;
    onSaveWorksheet: (content: WorksheetContent) => void;
    initialValue?: WorksheetContent;
    mode: 'create' | 'edit';
}

const JSONManagerModal: React.FC<JSONManagerModalProps> = ({
    isOpen,
    onClose,
    worksheets,
    onRestoreBackup,
    onSaveWorksheet,
    initialValue,
    mode
}) => {
    // Editor State
    const [code, setCode] = useState('');
    const [isValid, setIsValid] = useState(true);
    const [error, setError] = useState<{ message: string; line: number | null }>({ message: '', line: null });
    
    useEffect(() => {
        if (isOpen) {
            const content = initialValue || { chapter: "Nouveau Chapitre", exercises: [] };
            setCode(JSON.stringify(content, null, 2));
        }
    }, [isOpen, initialValue]);

    const validate = useCallback((value: string) => {
      try {
        const parsed = JSON.parse(value);
        if (!parsed.chapter || !Array.isArray(parsed.exercises)) {
            setIsValid(false);
            setError({ message: "La structure doit contenir un 'chapter' et un tableau 'exercises'.", line: null });
            return;
        }
        setIsValid(true);
        setError({ message: '', line: null });
      } catch (e: any) {
        setIsValid(false);
        setError({ message: e.message, line: getErrorLine(value, e.message) });
      }
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const newCode = code.substring(0, start) + '  ' + code.substring(end);
            setCode(newCode);
            // We need a timeout to update the cursor position after React re-renders
            setTimeout(() => {
                const textarea = document.getElementById('json-manager-textarea') as HTMLTextAreaElement;
                if (textarea) {
                    textarea.selectionStart = textarea.selectionEnd = start + 2;
                }
            }, 0);
        }
    };

    const handleSave = () => {
        try {
            const parsed = JSON.parse(code);
            onSaveWorksheet(parsed);
            onClose();
        } catch (e) { alert("JSON invalide"); }
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(worksheets, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = `backup_fiches_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target?.result as string);
                if (Array.isArray(jsonData)) onRestoreBackup(jsonData);
                else onSaveWorksheet(jsonData);
                onClose();
            } catch (err) { alert("Erreur importation"); }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-[900px] h-[85vh] max-h-[700px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                <header className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                             <Code className="h-6 w-6" />
                        </div>
                        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 font-display truncate">Éditeur & Gestion JSON</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"><X className="h-6 w-6" /></button>
                    </div>
                </header>
                
                <div className="flex-1 flex flex-col p-4 sm:p-8 bg-slate-50 overflow-hidden">
                    <textarea 
                        id="json-manager-textarea"
                        value={code} 
                        onChange={(e) => {setCode(e.target.value); validate(e.target.value);}} 
                        onKeyDown={handleKeyDown}
                        className="flex-1 w-full p-6 font-mono text-sm bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner" 
                        placeholder="Collez votre JSON ici..."
                        spellCheck={false}
                    />
                    {!isValid && <p className="text-rose-600 text-sm mt-3 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">{error.message}</p>}
                </div>

                <footer className="px-4 sm:px-8 py-4 sm:py-6 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-white">
                    <div className="flex gap-2">
                        <label className="cursor-pointer flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition">
                            <FileUp className="h-5 w-5" /> Importer
                            <input type="file" onChange={handleImportFile} className="hidden" />
                        </label>
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition">
                            <Download className="h-5 w-5" /> Exporter
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-slate-600 hover:bg-slate-100 font-semibold transition">Annuler</button>
                        <button onClick={handleSave} disabled={!isValid} className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-2xl bg-blue-600 text-white font-semibold transition shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50">Enregistrer</button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default JSONManagerModal;
