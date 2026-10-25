import { Point, Stroke } from './types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type CachedBounds = Bounds & {
  length: number;
  firstX: number;
  firstY: number;
  middleX: number;
  middleY: number;
  lastX: number;
  lastY: number;
  text?: string;
  fontSize?: number;
};

const strokeBoundsCache = new WeakMap<Stroke, CachedBounds>();

export function getPointsBounds(points: Point[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Boîte englobante mémoïsée d'un trait. Les traits finalisés sont immuables
 * hors déplacement de sélection ; la signature détecte aussi ce cas sans
 * rescanner des centaines de points à chaque passage de la gomme.
 */
export function getStrokeBounds(stroke: Stroke): Bounds | null {
  const points = stroke.points;
  if (points.length === 0) return null;
  const first = points[0];
  const middle = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];
  const cached = strokeBoundsCache.get(stroke);
  if (
    cached
    && cached.length === points.length
    && cached.firstX === first.x && cached.firstY === first.y
    && cached.middleX === middle.x && cached.middleY === middle.y
    && cached.lastX === last.x && cached.lastY === last.y
    && cached.text === stroke.text && cached.fontSize === stroke.fontSize
  ) {
    return cached;
  }

  const bounds = getPointsBounds(points)!;
  if (stroke.isText && stroke.text) {
    const lines = stroke.text.split('\n');
    const fontSize = stroke.fontSize || 24;
    let maxLength = 0;
    for (const line of lines) maxLength = Math.max(maxLength, line.length);
    bounds.maxX = Math.max(bounds.maxX, first.x + maxLength * fontSize * 0.6);
    bounds.maxY = Math.max(bounds.maxY, first.y + lines.length * fontSize * 1.2);
  }

  const next: CachedBounds = {
    ...bounds,
    length: points.length,
    firstX: first.x,
    firstY: first.y,
    middleX: middle.x,
    middleY: middle.y,
    lastX: last.x,
    lastY: last.y,
    text: stroke.text,
    fontSize: stroke.fontSize,
  };
  strokeBoundsCache.set(stroke, next);
  return next;
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY;
}

export function pointInPolygon(point: Point, polygon: Point[]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].x, yi = polygon[i].y;
    let xj = polygon[j].x, yj = polygon[j].y;
    
    let intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

function distToSegmentSquared(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return (px - x1) ** 2 + (py - y1) ** 2;
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (x1 + t * (x2 - x1));
  const dy = py - (y1 + t * (y2 - y1));
  return dx * dx + dy * dy;
}

export function strokeIntersectsPoint(stroke: Stroke, x: number, y: number, radius: number) {
  if (!stroke.points || stroke.points.length === 0) return false;
  const threshold = Math.max(radius + (stroke.width || 3) / 2, 8);
  const thresholdSquared = threshold * threshold;
  const bounds = getStrokeBounds(stroke);
  if (!bounds || x < bounds.minX - threshold || x > bounds.maxX + threshold || y < bounds.minY - threshold || y > bounds.maxY + threshold) {
    return false;
  }
  
  if (stroke.isImage && stroke.points.length >= 2) {
    const p1 = stroke.points[0];
    const p2 = stroke.points[1];
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    return x >= minX - threshold && x <= maxX + threshold && y >= minY - threshold && y <= maxY + threshold;
  }

  if (stroke.isText && stroke.text && stroke.points.length >= 1) {
    const p1 = stroke.points[0];
    const lines = stroke.text.split('\n');
    const lineHeight = (stroke.fontSize || 24) * 1.2;
    // Just a rough estimation for text width (half of font size per char roughly)
    let maxLen = 0;
    lines.forEach(l => { if (l.length > maxLen) maxLen = l.length; });
    const approxWidth = maxLen * (stroke.fontSize || 24) * 0.6;
    const approxHeight = lines.length * lineHeight;
    return x >= p1.x - threshold && x <= p1.x + approxWidth + threshold && 
           y >= p1.y - threshold && y <= p1.y + approxHeight + threshold;
  }

  if (stroke.shapeType) {
    const p1 = stroke.points[0];
    const p2 = stroke.points[stroke.points.length - 1];
    if (stroke.shapeType === 'freeform') {
      for (let i = 1; i < stroke.points.length; i++) {
        const a = stroke.points[i - 1];
        const b = stroke.points[i];
        if (distToSegmentSquared(x, y, a.x, a.y, b.x, b.y) <= thresholdSquared) return true;
      }
      return false;
    }
    if (stroke.shapeType === 'angle') {
      return distToSegmentSquared(x, y, p1.x, p1.y, p2.x, p2.y) <= thresholdSquared
        || distToSegmentSquared(x, y, p1.x, p1.y, p2.x, p1.y) <= thresholdSquared;
    }
    if (stroke.shapeType === 'axes') {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return distToSegmentSquared(x, y, minX, cy, maxX, cy) <= thresholdSquared
        || distToSegmentSquared(x, y, cx, minY, cx, maxY) <= thresholdSquared;
    }
    if (['rectangle', 'circle', 'triangle', 'right-triangle', 'diamond', 'parallelogram', 'pentagon', 'hexagon'].includes(stroke.shapeType)) {
      const minX = Math.min(p1.x, p2.x) - threshold;
      const maxX = Math.max(p1.x, p2.x) + threshold;
      const minY = Math.min(p1.y, p2.y) - threshold;
      const maxY = Math.max(p1.y, p2.y) + threshold;
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
    return distToSegmentSquared(x, y, p1.x, p1.y, p2.x, p2.y) <= thresholdSquared;
  }

  if (stroke.points.length === 1) {
    return (x - stroke.points[0].x) ** 2 + (y - stroke.points[0].y) ** 2 <= thresholdSquared;
  }

  for (let i = 1; i < stroke.points.length; i++) {
    const p1 = stroke.points[i - 1];
    const p2 = stroke.points[i];
    if (distToSegmentSquared(x, y, p1.x, p1.y, p2.x, p2.y) <= thresholdSquared) {
      return true;
    }
  }
  return false;
}

export function drawArrowhead(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, strokeWidth: number) {
  const headlen = Math.max(10, strokeWidth * 3.5);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.restore();
}

export const isPointInImage = (x: number, y: number, stroke: Stroke) => {
  if (!stroke.isImage || stroke.points.length < 2) return false;
  const p1 = stroke.points[0];
  const p2 = stroke.points[1];
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
};

export const isPointOnImageResizeHandle = (x: number, y: number, stroke: Stroke) => {
  if (!stroke.isImage || stroke.points.length < 2) return false;
  const p1 = stroke.points[0];
  const p2 = stroke.points[1];
  
  // Actually we need to check all 4 corners or just the bottom-right corner.
  // The bounding box is based on minX, maxX.
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  
  // Check the 4 corners:
  const handles = [
    {x: minX, y: minY, type: 'tl'},
    {x: maxX, y: minY, type: 'tr'},
    {x: minX, y: maxY, type: 'bl'},
    {x: maxX, y: maxY, type: 'br'}
  ];
  
  for (const handle of handles) {
    if (Math.hypot(x - handle.x, y - handle.y) <= 15) {
      return handle.type;
    }
  }
  return false;
};
