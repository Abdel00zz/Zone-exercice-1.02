import { Stroke, Point } from './types';
import { drawArrowhead } from './utils';

export const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke, isSelected: boolean = false) => {
  if (stroke.points.length === 0) return;
  
  if (stroke.isImage && stroke.imgSrc) {
     if (!stroke.imgElement) {
       const img = new window.Image();
       img.src = stroke.imgSrc;
       img.onload = () => {
         stroke.imgElement = img;
         // Note: relies on an external redraw trigger if it wasn't loaded
       };
       stroke.imgElement = img; 
     }
     const imgEl = stroke.imgElement;
     if (imgEl && imgEl.complete && imgEl.naturalHeight !== 0) {
       const p1 = stroke.points[0];
       const p2 = stroke.points[1];
       if (p1 && p2) {
         const minX = Math.min(p1.x, p2.x);
         const minY = Math.min(p1.y, p2.y);
         const w = Math.abs(p2.x - p1.x);
         const h = Math.abs(p2.y - p1.y);
         ctx.drawImage(imgEl, minX, minY, w, h);
       }
     }
     return;
  }

  ctx.save();
  
  if (stroke.isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else if (stroke.isHighlighter) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = stroke.highlighterType === 'straight' ? 'butt' : 'round';
    ctx.lineJoin = stroke.highlighterType === 'straight' ? 'bevel' : 'round';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  if (isSelected) {
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
  }

  // Shapes rendering
  if (stroke.shapeType) {
    const p1 = stroke.points[0];
    const p2 = stroke.points[stroke.points.length - 1];
    ctx.lineWidth = stroke.width;
    
    if (stroke.shapeType === 'line') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (stroke.shapeType === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      drawArrowhead(ctx, p1.x, p1.y, p2.x, p2.y, stroke.width);
    } else if (stroke.shapeType === 'double-arrow') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      drawArrowhead(ctx, p1.x, p1.y, p2.x, p2.y, stroke.width);
      drawArrowhead(ctx, p2.x, p2.y, p1.x, p1.y, stroke.width);
    } else if (stroke.shapeType === 'rectangle') {
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      ctx.strokeRect(x, y, w, h);
    } else if (stroke.shapeType === 'circle') {
      const rx = (p2.x - p1.x) / 2;
      const ry = (p2.y - p1.y) / 2;
      const cx = p1.x + rx;
      const cy = p1.y + ry;
      const r = Math.hypot(rx, ry);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
      ctx.stroke();
    } else if (stroke.shapeType === 'triangle') {
      const topX = (p1.x + p2.x) / 2;
      const topY = p1.y;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p1.x, p2.y);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (stroke.points.length === 1) {
    ctx.beginPath();
    const p = stroke.points[0];
    const pressure = p.pressure > 0 ? p.pressure : 0.5;
    let r = stroke.width / 2;
    
    if (!stroke.isHighlighter && !stroke.isEraser) {
       if (stroke.penType === 'fountain') r = (stroke.width * (0.5 + pressure * 1.5)) / 2;
       if (stroke.penType === 'fine') r = (stroke.width * 0.4) / 2;
    }
    ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Freehand stroke
  if (!stroke.isHighlighter && !stroke.isEraser && stroke.penType === 'fountain') {
     // Draw variable width segments for fountain pen
     let prevPressure = stroke.points[0].pressure > 0 ? stroke.points[0].pressure : 0.5;
     for (let i = 1; i < stroke.points.length; i++) {
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];
        
        let pressure = p2.pressure > 0 ? p2.pressure : 0.5;
        // If default pressure (e.g. mouse or basic touch), simulate pressure via velocity
        if (Math.abs(pressure - 0.5) < 0.01) {
           const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
           const velocity = Math.min(1, dist / 20); // dist per event roughly
           // faster = thinner (less pressure)
           const simulatedPressure = Math.max(0.1, 1 - velocity * 0.8);
           // smooth pressure
           pressure = prevPressure * 0.6 + simulatedPressure * 0.4;
        }
        
        ctx.beginPath();
        ctx.lineWidth = Math.max(1, stroke.width * (0.2 + pressure * 1.8));
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        prevPressure = pressure;
     }
  } else {
     // Smooth curve for uniform width tools
     let dynamicWidth = stroke.width;
     if (!stroke.isHighlighter && !stroke.isEraser) {
        if (stroke.penType === 'fine') {
           // Ballpoint Pen (Stylo à bille): Crisp, smooth, high-quality ink line
           dynamicWidth = stroke.width * 0.8;
           ctx.globalAlpha = 0.95;
           ctx.lineCap = 'round';
           ctx.lineJoin = 'round';
        } else if (stroke.penType === 'marker') {
           dynamicWidth = stroke.width;
        }
     }
     
     ctx.beginPath();
     ctx.lineWidth = Math.max(1, dynamicWidth);
     ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
     
     for (let i = 1; i < stroke.points.length - 1; i++) {
       const p1 = stroke.points[i];
       const p2 = stroke.points[i + 1];
       const midX = (p1.x + p2.x) / 2;
       const midY = (p1.y + p2.y) / 2;
       ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
     }
     
     if (stroke.points.length > 1) {
       const last = stroke.points[stroke.points.length - 1];
       ctx.lineTo(last.x, last.y);
     }
     ctx.stroke();
  }
  
  ctx.restore();
};
