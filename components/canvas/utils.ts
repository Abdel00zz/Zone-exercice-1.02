import { Point, Stroke } from './types';

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

export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function strokeIntersectsPoint(stroke: Stroke, x: number, y: number, radius: number) {
  if (!stroke.points || stroke.points.length === 0) return false;
  const threshold = Math.max(radius + (stroke.width || 3) / 2, 8);
  
  if (stroke.isImage && stroke.points.length >= 2) {
    const p1 = stroke.points[0];
    const p2 = stroke.points[1];
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    return x >= minX - threshold && x <= maxX + threshold && y >= minY - threshold && y <= maxY + threshold;
  }

  if (stroke.shapeType) {
    const p1 = stroke.points[0];
    const p2 = stroke.points[stroke.points.length - 1];
    return distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= threshold;
  }

  if (stroke.points.length === 1) {
    return Math.hypot(x - stroke.points[0].x, y - stroke.points[0].y) <= threshold;
  }

  for (let i = 1; i < stroke.points.length; i++) {
    const p1 = stroke.points[i - 1];
    const p2 = stroke.points[i];
    if (distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= threshold) {
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
