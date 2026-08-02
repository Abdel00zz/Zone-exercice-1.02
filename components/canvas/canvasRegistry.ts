/**
 * Coordination entre les instances de DrawingCanvas d'une même fiche.
 *
 * Une fiche affiche un canvas par question : sur une fiche de 2 exercices on en
 * compte déjà 10. Sans coordination, chaque instance posait son propre écouteur
 * `scroll` sur window et son propre écouteur `keydown` global, ce qui provoquait
 * deux défauts visibles :
 *   - des à-coups au défilement (N mesures de layout par événement) ;
 *   - un Ctrl+Z qui annulait un trait dans TOUS les canvas à la fois.
 */

// ── Canvas actif ────────────────────────────────────────────────────────────
// Dernier canvas touché par l'utilisateur : seul celui-ci réagit aux raccourcis.

let activeCanvasId: string | null = null;

export const setActiveCanvas = (id: string) => {
  activeCanvasId = id;
};

export const isActiveCanvas = (id: string) => activeCanvasId === id;

export const clearActiveCanvas = (id: string) => {
  if (activeCanvasId === id) activeCanvasId = null;
};

/** Vrai si la frappe vise un champ de saisie : les raccourcis doivent alors être ignorés. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
};

// ── Défilement partagé ──────────────────────────────────────────────────────
// Un seul écouteur window pour toutes les instances, mesuré une fois par frame.

type Subscriber = () => void;

const subscribers = new Set<Subscriber>();
let frameHandle = 0;
let listening = false;

const flush = () => {
  frameHandle = 0;
  subscribers.forEach(fn => fn());
};

const schedule = () => {
  if (frameHandle) return;
  frameHandle = requestAnimationFrame(flush);
};

/**
 * Abonne un callback aux événements scroll/resize. Le callback est appelé au
 * plus une fois par frame, toutes instances confondues.
 */
export const subscribeToViewport = (fn: Subscriber): (() => void) => {
  subscribers.add(fn);

  if (!listening) {
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule, { passive: true });
    listening = true;
  }

  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && listening) {
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      if (frameHandle) cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      listening = false;
    }
  };
};
