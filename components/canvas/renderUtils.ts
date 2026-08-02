import { Stroke, Point } from './types';
import { drawArrowhead } from './utils';

export const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke, isSelected: boolean = false) => {
  if (stroke.points.length === 0) return;
  
  if (stroke.isText && stroke.text) {
    ctx.save();
    ctx.font = `${stroke.fontSize || 24}px ${stroke.font || 'Caveat'}`;
    ctx.fillStyle = stroke.color || '#000000';
    ctx.textBaseline = 'top';
    const lines = stroke.text.split('\n');
    const lineHeight = (stroke.fontSize || 24) * 1.2;
    lines.forEach((line, i) => {
      ctx.fillText(line, stroke.points[0].x, stroke.points[0].y + i * lineHeight);
    });
    if (isSelected) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      let maxWidth = 0;
      lines.forEach(line => {
        const m = ctx.measureText(line);
        if (m.width > maxWidth) maxWidth = m.width;
      });
      ctx.strokeRect(stroke.points[0].x - 4, stroke.points[0].y - 4, maxWidth + 8, lines.length * lineHeight + 8);
    }
    ctx.restore();
    return;
  }
  
  if (stroke.isImage && stroke.imgSrc) {
     if (!stroke.imgElement) {
       const img = new window.Image();
       img.src = stroke.imgSrc;
       img.onload = () => {
         stroke.imgElement = img;
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
    ctx.globalAlpha = stroke.opacity !== undefined ? stroke.opacity : 0.45;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = stroke.highlighterType === 'chisel' ? 'butt' : 'round';
    ctx.lineJoin = stroke.highlighterType === 'chisel' ? 'bevel' : 'round';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Apply line style
    if (stroke.lineStyle === 'dashed') {
      ctx.setLineDash([stroke.width * 2.5, stroke.width * 1.8]);
    } else if (stroke.lineStyle === 'dotted') {
      ctx.setLineDash([0, Math.max(4, stroke.width * 2.2)]);
      ctx.lineCap = 'round';
    } else {
      ctx.setLineDash([]);
    }
    
    // Pen specifics
    if (stroke.opacity !== undefined) {
      ctx.globalAlpha = stroke.opacity;
    } else if (stroke.penType === 'pencil') {
      ctx.globalAlpha = 0.75;
    } else if (stroke.penType === 'brush') {
      ctx.globalAlpha = 0.6;
    } else if (stroke.penType === 'marker') {
      ctx.globalAlpha = 1.0;
    } else if (stroke.penType === 'fountain') {
      ctx.globalAlpha = 0.95;
    } else {
      ctx.globalAlpha = 1.0;
    }
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

    // Apply line style to shapes
    if (stroke.lineStyle === 'dashed') {
      ctx.setLineDash([Math.max(6, stroke.width * 2.5), Math.max(4, stroke.width * 1.8)]);
    } else if (stroke.lineStyle === 'dotted') {
      ctx.setLineDash([0, Math.max(5, stroke.width * 2.2)]);
      ctx.lineCap = 'round';
    } else {
      ctx.setLineDash([]);
    }
    
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
    } else if (stroke.shapeType === 'angle') {
      const radius = Math.min(22, Math.max(8, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.22));
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      ctx.beginPath();
      ctx.moveTo(p1.x + Math.cos(angle) * Math.max(radius * 2.2, 34), p1.y + Math.sin(angle) * Math.max(radius * 2.2, 34));
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x + Math.max(radius * 2.2, 34), p1.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, radius, Math.min(0, angle), Math.max(0, angle));
      ctx.stroke();
    } else if (stroke.shapeType === 'axes') {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      ctx.beginPath();
      ctx.moveTo(minX, cy); ctx.lineTo(maxX, cy);
      ctx.moveTo(cx, maxY); ctx.lineTo(cx, minY);
      ctx.stroke();
      drawArrowhead(ctx, minX, cy, maxX, cy, stroke.width);
      drawArrowhead(ctx, cx, maxY, cx, minY, stroke.width);
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
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, Math.abs(rx)), Math.max(1, Math.abs(ry)), 0, 0, Math.PI * 2);
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
    } else if (stroke.shapeType === 'right-triangle') {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x, p2.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.stroke();
      const marker = Math.min(14, Math.abs(p2.x - p1.x) / 4, Math.abs(p2.y - p1.y) / 4);
      if (marker > 3) {
        const sy = p2.y >= p1.y ? 1 : -1;
        const sx = p2.x >= p1.x ? 1 : -1;
        ctx.strokeRect(p1.x, p2.y - sy * marker, sx * marker, sy * marker);
      }
    } else if (stroke.shapeType === 'diamond') {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, p1.y);
      ctx.lineTo(p2.x, midY);
      ctx.lineTo(midX, p2.y);
      ctx.lineTo(p1.x, midY);
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'parallelogram') {
      const w = p2.x - p1.x;
      const skew = w * 0.25;
      ctx.beginPath();
      ctx.moveTo(p1.x + skew, p1.y);
      ctx.lineTo(p2.x, p1.y);
      ctx.lineTo(p2.x - skew, p2.y);
      ctx.lineTo(p1.x, p2.y);
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'pentagon') {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'hexagon') {
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rx = Math.abs(p2.x - p1.x) / 2;
      const ry = Math.abs(p2.y - p1.y) / 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (stroke.shapeType === 'freeform') {
      if (stroke.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
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
       if (stroke.penType === 'fountain' || stroke.lineStyle === 'tapered') {
           r = (stroke.width * (0.5 + pressure * 1.5)) / 2;
       }
    }
    ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Freehand stroke
  const isDashedOrDotted = stroke.lineStyle === 'dashed' || stroke.lineStyle === 'dotted';
  const isVariableWidth = !isDashedOrDotted && !stroke.isHighlighter && !stroke.isEraser && 
                         (stroke.penType === 'fountain' || stroke.penType === 'calligraphy' || stroke.penType === 'brush' || stroke.lineStyle === 'tapered');
                         
  if (isVariableWidth) {
     const N = stroke.points.length;
     let prevPressure = stroke.points[0].pressure > 0 ? stroke.points[0].pressure : 0.5;
     const isTapered = stroke.lineStyle === 'tapered';
     const taperLength = Math.min(15, Math.floor(N / 2));

     for (let i = 1; i < N; i++) {
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];
        
        let pressure = p2.pressure > 0 ? p2.pressure : 0.5;
        // Simulate pressure via velocity if constant pressure
        if (Math.abs(pressure - 0.5) < 0.01) {
           const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
           const velocity = Math.min(1, dist / 20); 
           const simulatedPressure = Math.max(0.1, 1 - velocity * 0.8);
           pressure = prevPressure * 0.6 + simulatedPressure * 0.4;
        }

        // Taper calculation at start & end
        let taper = 1;
        if (isTapered && taperLength > 0) {
          if (i < taperLength) {
            taper = Math.sin((i / taperLength) * (Math.PI / 2));
          } else if (i >= N - taperLength) {
            taper = Math.sin(((N - i) / taperLength) * (Math.PI / 2));
          }
        }
        
        ctx.beginPath();
        let currentWidth = stroke.width;
        if (stroke.penType === 'calligraphy') {
           const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
           const angleFactor = Math.abs(Math.sin(angle - Math.PI / 4));
           currentWidth = stroke.width * (0.25 + angleFactor * 1.4);
        } else if (stroke.penType === 'brush') {
           currentWidth = stroke.width * (0.3 + pressure * 1.4);
        } else {
           currentWidth = stroke.width * (0.3 + pressure * 1.5);
        }
        
        currentWidth *= Math.max(0.08, taper);

        ctx.lineWidth = Math.max(1, currentWidth);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        
        prevPressure = pressure;
     }
  } else {
     // Smooth curve for uniform width or dashed/dotted tools
     ctx.beginPath();
     ctx.lineWidth = Math.max(1, stroke.width);
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
