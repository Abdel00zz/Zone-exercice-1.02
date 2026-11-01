import type { Worksheet } from '../types';

/**
 * Formate proprement les titres de parties :
 * - Capitalise "partie" -> "Partie"
 * - Remplace les numéros par des lettres (ex: "Partie 1" -> "Partie A", "Partie 2" -> "Partie B")
 * - Capitalise les lettres de parties (ex: "Partie a" -> "Partie A")
 */
export function formatPartieTitle(title: string): string {
  if (!title) return title;
  
  let formatted = title.trim();

  // "partie" -> "Partie"
  formatted = formatted.replace(/^partie\b/i, 'Partie');

  // Remplace "Partie 1", "Partie 2", "Partie 3" par "Partie A", "Partie B", "Partie C"
  formatted = formatted.replace(/\bPartie\s+([1-9]\d*)\b/gi, (_, numStr) => {
    const num = parseInt(numStr, 10);
    if (num >= 1 && num <= 26) {
      return `Partie ${String.fromCharCode(64 + num)}`;
    }
    return `Partie ${numStr}`;
  });

  // Remplace "Partie a", "Partie b" par "Partie A", "Partie B"
  formatted = formatted.replace(/\bPartie\s+([a-z])\b/gi, (_, letter) => {
    return `Partie ${letter.toUpperCase()}`;
  });

  return formatted;
}

export type TreeFilter = 
    | { type: 'class'; className: string } 
    | { type: 'chapter'; className: string; chapterName: string } 
    | { type: 'worksheet'; worksheetId: string } 
    | null;

export interface WorksheetTreeChapter {
    chapterName: string;
    worksheets: Worksheet[];
}

export interface WorksheetTreeClass {
    className: string;
    worksheetCount: number;
    chapters: WorksheetTreeChapter[];
}

export const DEFAULT_OFFICIAL_CLASSES = [
    'Tronc Commun Scientifique',
    'Tronc Commun Lettres et Sciences Humaines',
    '1ère Bac Sciences Expérimentales',
    '1ère Bac Sciences Mathématiques',
    '1ère Bac Lettres et Sciences Humaines',
    'Terminale PC/SVT',
    'Terminale Sciences Mathématiques A/B',
    '2ème Bac Sciences Expérimentales',
    '2ème Bac Sciences Mathématiques',
];

export const getWorksheetClassName = (worksheet: Worksheet): string => {
    return worksheet.content?.settings?.className?.trim() || 'Non classé';
};

export const getWorksheetChapterName = (worksheet: Worksheet): string => {
    return worksheet.content?.chapter?.trim() || worksheet.name || 'Sans chapitre';
};

export const buildWorksheetTree = (
    worksheets: Worksheet[],
    worksheetClasses: string[] = DEFAULT_OFFICIAL_CLASSES
): WorksheetTreeClass[] => {
    const activeClasses = worksheetClasses.length > 0 ? worksheetClasses : DEFAULT_OFFICIAL_CLASSES;
    const classesMap = new Map<string, Map<string, Worksheet[]>>();
    
    // Initialise les classes dans l'ordre de la liste officielle/configurée
    activeClasses.forEach((className) => {
        const normalizedName = className.trim();
        if (normalizedName && !classesMap.has(normalizedName)) {
            classesMap.set(normalizedName, new Map());
        }
    });

    [...worksheets]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .forEach((worksheet) => {
            const className = getWorksheetClassName(worksheet);
            const chapterName = getWorksheetChapterName(worksheet);

            if (!classesMap.has(className)) {
                classesMap.set(className, new Map());
            }

            const chapters = classesMap.get(className)!;
            const chapterWorksheets = chapters.get(chapterName) || [];
            chapterWorksheets.push(worksheet);
            chapters.set(chapterName, chapterWorksheets);
        });

    const tree = Array.from(classesMap, ([className, chapters]) => ({
        className,
        worksheetCount: Array.from(chapters.values()).reduce((sum, list) => sum + list.length, 0),
        chapters: Array.from(chapters, ([chapterName, chapterWorksheets]) => ({ chapterName, worksheets: chapterWorksheets })),
    }));

    // Trie pour placer 'Non classé' en dernier s'il est présent
    return tree.sort((a, b) => {
        if (a.className === 'Non classé') return 1;
        if (b.className === 'Non classé') return -1;
        return 0; // Conserve l'ordre configuré de activeClasses
    });
};

export const generateDynamicSubtitle = (
    searchQuery: string,
    treeFilter: TreeFilter,
    sortedWorksheetsCount: number,
    worksheets: Worksheet[]
): string => {
    if (searchQuery.trim()) {
        return `Recherche : « ${searchQuery.trim()} » · ${sortedWorksheetsCount} fiche${sortedWorksheetsCount > 1 ? 's' : ''}`;
    }

    if (treeFilter) {
        if (treeFilter.type === 'class') {
            return `Classe : ${treeFilter.className} · ${sortedWorksheetsCount} fiche${sortedWorksheetsCount > 1 ? 's' : ''}`;
        }
        if (treeFilter.type === 'chapter') {
            return `${treeFilter.className} › ${treeFilter.chapterName} · ${sortedWorksheetsCount} fiche${sortedWorksheetsCount > 1 ? 's' : ''}`;
        }
        if (treeFilter.type === 'worksheet') {
            const ws = worksheets.find((item) => item.id === treeFilter.worksheetId);
            return ws ? `Aperçu : ${ws.name}` : 'Fiche sélectionnée';
        }
    }
    
    const total = worksheets.length;
    const classes = Array.from(new Set(worksheets.map(getWorksheetClassName))).filter(c => c && c !== 'Non classé');
    const chapters = Array.from(new Set(worksheets.map(getWorksheetChapterName))).filter(c => c && c !== 'Général');

    if (classes.length > 0) {
        const classListStr = classes.slice(0, 3).join(', ') + (classes.length > 3 ? ` +${classes.length - 3}` : '');
        return `${total} fiches · ${classListStr}`;
    }
    
    if (chapters.length > 0) {
        const chapListStr = chapters.slice(0, 3).join(', ') + (chapters.length > 3 ? ` +${chapters.length - 3}` : '');
        return `${total} fiches · ${chapListStr}`;
    }

    return `${total} fiche${total > 1 ? 's' : ''} disponible${total > 1 ? 's' : ''}`;
};
