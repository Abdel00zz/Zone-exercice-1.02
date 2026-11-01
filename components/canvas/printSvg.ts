import type { Stroke } from './types';
import { drawStroke } from './renderUtils';
import { printInkColor } from './inkColors';
import { getStrokeBounds } from './utils';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;
type Attributes = Record<string, string | number>;
const number = (value: number) => Number(value.toFixed(4));

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Attributes = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

/**
 * Enregistre les mêmes commandes que le canvas dans des chemins SVG natifs.
 * Aucune capture d'écran : pression, courbes et formes gardent leur géométrie.
 */
class SvgStrokeContext {
  fillStyle = '#000000';
  strokeStyle = '#000000';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  lineWidth = 1;
  lineCap = 'round';
  lineJoin = 'round';
  private dash: number[] = [];
  private path = '';
  private stack: Attributes[] = [];

  constructor(private target: SVGGElement, private pencilFill: (data: string, color: string) => SVGGElement) {}

  save() {
    this.stack.push({ fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation, lineWidth: this.lineWidth,
      lineCap: this.lineCap, lineJoin: this.lineJoin, dash: this.dash.join(',') });
  }
  restore() {
    const state = this.stack.pop();
    if (!state) return;
    this.dash = String(state.dash).split(',').filter(Boolean).map(Number);
    const { dash: _dash, ...values } = state;
    Object.assign(this, values);
  }
  setLineDash(dash: number[]) { this.dash = dash; }
  beginPath() { this.path = ''; }
  moveTo(x: number, y: number) { this.path += `M${number(x)} ${number(y)} `; }
  lineTo(x: number, y: number) { this.path += `L${number(x)} ${number(y)} `; }
  quadraticCurveTo(x: number, y: number, endX: number, endY: number) {
    this.path += `Q${number(x)} ${number(y)} ${number(endX)} ${number(endY)} `;
  }
  closePath() { this.path += 'Z '; }
  ellipse(cx: number, cy: number, rx: number, ry: number, rotation: number, start: number, end: number) {
    const span = Math.min(TAU, Math.max(0, end - start));
    const point = (angle: number): [number, number] => [
      cx + rx * Math.cos(angle) * Math.cos(rotation) - ry * Math.sin(angle) * Math.sin(rotation),
      cy + rx * Math.cos(angle) * Math.sin(rotation) + ry * Math.sin(angle) * Math.cos(rotation),
    ];
    const first = point(start);
    if (this.path) this.lineTo(...first); else this.moveTo(...first);
    // Two arcs preserve complete circles; a single SVG arc with equal ends is empty.
    const parts = Math.max(1, Math.ceil(span / Math.PI));
    for (let part = 1; part <= parts; part++) {
      const [x, y] = point(start + span * part / parts);
      this.path += `A${number(rx)} ${number(ry)} ${number(rotation * 180 / Math.PI)} 0 1 ${number(x)} ${number(y)} `;
    }
  }
  arc(x: number, y: number, radius: number, start: number, end: number) { this.ellipse(x, y, radius, radius, 0, start, end); }
  strokeRect(x: number, y: number, width: number, height: number) {
    this.paint(`M${x} ${y} h${width} v${height} h${-width} Z`, false);
  }
  private paint(data: string, fill: boolean, pencilColor?: string) {
    const erasing = this.globalCompositeOperation === 'destination-out';
    if (fill && pencilColor && !erasing) {
      const grain = this.pencilFill(data, pencilColor);
      grain.setAttribute('opacity', String(this.globalAlpha));
      this.target.append(grain);
      return;
    }
    const element = svg('path', {
      d: data,
      fill: fill ? (erasing ? '#000000' : this.fillStyle) : 'none',
      stroke: fill ? 'none' : erasing ? '#000000' : this.strokeStyle,
      'stroke-width': this.lineWidth,
      'stroke-linecap': this.lineCap,
      'stroke-linejoin': this.lineJoin,
      opacity: erasing ? 1 : this.globalAlpha,
    });
    if (!fill && this.dash.length) element.setAttribute('stroke-dasharray', this.dash.join(' '));
    this.target.append(element);
  }
  stroke() { this.paint(this.path, false); }
  fill() { this.paint(this.path, true); }
  fillFreehandPath(data: string, pencilColor?: string) { this.paint(data, true, pencilColor); }
  drawImage(image: HTMLImageElement, x: number, y: number, width: number, height: number) {
    this.target.append(svg('image', { href: image.src, x, y, width, height, preserveAspectRatio: 'none', 'data-original-image': '' }));
  }
}

/** Grain explicite : les pattern SVG seraient à nouveau rasterisés par Chromium. */
function pencilGeometry(defs: SVGDefsElement, id: string, data: string, color: string, stroke: Stroke): SVGGElement {
  const clip = svg('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
  clip.append(svg('path', { d: data }));
  defs.append(clip);
  const group = svg('g', { 'clip-path': `url(#${id})` });
  group.append(svg('path', { d: data, fill: color, opacity: 0.42 }));
  let seed = 2166136261;
  for (let index = 0; index < color.length; index++) seed = Math.imul(seed ^ color.charCodeAt(index), 16777619);
  const grain: Array<{ x: number; y: number; width: number; opacity: number }> = [];
  for (let index = 0; index < 80; index++) {
    seed = Math.imul(seed ^ (seed >>> 13), 1597334677);
    const x = (seed >>> 0) % 16;
    seed = Math.imul(seed ^ (seed >>> 11), 3812015801);
    grain.push({ x, y: (seed >>> 0) % 16, width: index % 5 === 0 ? 2 : 1, opacity: 0.18 + (seed >>> 24) / 255 * 0.52 });
  }
  const bounds = getStrokeBounds(stroke);
  const context = document.createElement('canvas').getContext('2d');
  if (!bounds || !context) return group;
  const outline = new Path2D(data);
  const minX = Math.floor((bounds.minX - stroke.width) / 16) * 16;
  const minY = Math.floor((bounds.minY - stroke.width) / 16) * 16;
  const maxX = bounds.maxX + stroke.width, maxY = bounds.maxY + stroke.width;
  // Borné pour les anciennes annotations géantes : le contour reste exact,
  // seule la densité du grain peut diminuer pour contenir le coût d'export.
  const stride = Math.max(1, Math.ceil(Math.sqrt((maxX - minX) * (maxY - minY) / (256 * 500))));
  for (let tileY = minY; tileY < maxY; tileY += 16 * stride) {
    for (let tileX = minX; tileX < maxX; tileX += 16 * stride) {
      for (const dot of grain) {
        const x = tileX + dot.x, y = tileY + dot.y;
        if (![[x, y], [x + dot.width, y], [x, y + 1], [x + dot.width, y + 1], [x + dot.width / 2, y + 0.5]]
          .some(([px, py]) => context.isPointInPath(outline, px, py))) continue;
        group.append(svg('rect', { x, y, width: dot.width, height: 1, fill: color, opacity: dot.opacity }));
      }
    }
  }
  return group;
}

export function renderPrintInk(target: SVGGElement, strokes: Stroke[], width: number, height: number, prefix: string): void {
  const defs = svg('defs');
  let pencilCount = 0;
  let scene = svg('g');
  let maskCount = 0;
  for (const stroke of strokes) {
    if (stroke.isText || !stroke.points.length) continue;
    let destination = scene;
    if (stroke.isEraser) {
      const id = `${prefix}-erase-${maskCount++}`;
      const mask = svg('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height, 'mask-type': 'luminance' });
      mask.append(svg('rect', { width, height, fill: '#ffffff' }));
      destination = svg('g');
      mask.append(destination);
      defs.append(mask);
      const masked = svg('g', { mask: `url(#${id})` });
      masked.append(scene);
      scene = svg('g');
      scene.append(masked);
    }
    const color = stroke.isHighlighter || stroke.isEraser ? stroke.color : printInkColor(stroke.color);
    // The adapter implements the canvas operations used by drawStroke. Sharing
    // this renderer prevents a second geometry implementation drifting over time.
    const context = new SvgStrokeContext(destination, (data, color) => pencilGeometry(defs, `${prefix}-pencil-${pencilCount++}`, data, color, stroke));
    drawStroke(context as unknown as CanvasRenderingContext2D, color === stroke.color ? stroke : { ...stroke, color });
  }
  target.replaceChildren(defs, scene);
}
