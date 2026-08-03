import re

with open("components/canvas/DrawingCanvas.tsx", "r") as f:
    content = f.read()

target_string = """    } else if (currentStrokeRef.current) {
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      setRedoStack([]); 
    }"""

new_string = """    } else if (currentStrokeRef.current) {
      if (straightenLines && activeTool === 'pen' && currentStrokeRef.current.points.length > 5) {
        const pts = currentStrokeRef.current.points;
        const p1 = pts[0];
        const p2 = pts[pts.length - 1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        let maxDeviation = 0;
        for(let i = 1; i < pts.length - 1; i++) {
           const p = pts[i];
           const num = Math.abs((p2.y - p1.y)*p.x - (p2.x - p1.x)*p.y + p2.x*p1.y - p2.y*p1.x);
           const den = Math.hypot(p2.y - p1.y, p2.x - p1.x);
           const d = den === 0 ? 0 : num / den;
           if (d > maxDeviation) maxDeviation = d;
        }
        if (dist > 30 && maxDeviation < dist * 0.08) {
           currentStrokeRef.current.shapeType = 'line';
           currentStrokeRef.current.points = [p1, p2];
        }
      }
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      setRedoStack([]); 
    }"""

content = content.replace(target_string, new_string)
with open("components/canvas/DrawingCanvas.tsx", "w") as f:
    f.write(content)
