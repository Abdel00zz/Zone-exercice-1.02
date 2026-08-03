#!/bin/bash
# A script to patch the pen menu in Toolbar.tsx
cat << 'INNER_EOF' > /tmp/pen_menu.tsx
          {openMenu === 'pen' && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[340px] bg-[#F4F5F8] rounded-3xl shadow-xl border border-slate-200 z-50 animate-in fade-in duration-150 overflow-hidden">
              <div className="p-6 flex flex-col gap-6">
                
                {/* Pen Types */}
                <div className="flex justify-between items-end gap-1 px-1 h-20">
                  <button onClick={() => setPenType('fountain')} className={`relative flex flex-col items-center justify-end w-12 h-full rounded-t-xl transition-all ${penType === 'fountain' ? 'bg-white shadow-sm -translate-y-2' : 'hover:bg-white/50'}`}>
                    <PenTool size={24} className="mb-2 text-slate-800" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => setPenType('calligraphy')} className={`relative flex flex-col items-center justify-end w-12 h-full rounded-t-xl transition-all ${penType === 'calligraphy' ? 'bg-white shadow-sm -translate-y-2' : 'hover:bg-white/50'}`}>
                    <Pen size={24} className="mb-2 text-slate-800" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => setPenType('marker')} className={`relative flex flex-col items-center justify-end w-12 h-full rounded-t-xl transition-all ${penType === 'marker' ? 'bg-white shadow-sm -translate-y-2' : 'hover:bg-white/50'}`}>
                    <div className="w-4 h-8 bg-slate-800 rounded-t-sm mb-2" />
                  </button>
                  <button onClick={() => setPenType('pencil')} className={`relative flex flex-col items-center justify-end w-12 h-full rounded-t-xl transition-all ${penType === 'pencil' ? 'bg-white shadow-sm -translate-y-2' : 'hover:bg-white/50'}`}>
                    <Pencil size={24} className="mb-2 text-red-500" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => setPenType('brush')} className={`relative flex flex-col items-center justify-end w-12 h-full rounded-t-xl transition-all ${penType === 'brush' ? 'bg-white shadow-sm -translate-y-2' : 'hover:bg-white/50'}`}>
                    <Brush size={24} className="mb-2 text-yellow-400" strokeWidth={1.5} />
                  </button>
                </div>
                
                <hr className="border-slate-200" />

                {/* Thickness Slider */}
                <div className="flex items-center gap-3">
                  <button onClick={() => setLineWidth(Math.max(1, lineWidth - 1))} className="p-1 text-slate-600 hover:text-slate-900"><Minus size={20} /></button>
                  <div className="flex-1 relative flex items-center justify-center h-8">
                    <input type="range" min="1" max="50" step="1" value={lineWidth} onChange={(e) => setLineWidth(parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-400" />
                    <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 text-slate-800 text-xs font-medium px-3 py-1 rounded-full shadow-sm pointer-events-none">
                      {Math.round(lineWidth)}
                    </div>
                  </div>
                  <button onClick={() => setLineWidth(Math.min(50, lineWidth + 1))} className="p-1 text-slate-600 hover:text-slate-900"><Plus size={20} /></button>
                </div>

                {/* Line Styles */}
                <div className="flex gap-2">
                  <button onClick={() => setLineStyle && setLineStyle('solid')} className={`flex-1 h-10 flex items-center justify-center rounded-full transition ${lineStyle === 'solid' ? 'bg-white shadow-sm border border-slate-200' : 'bg-slate-200/50 hover:bg-slate-200'}`}>
                    <div className="w-8 h-1 bg-slate-800 rounded-full" />
                  </button>
                  <button onClick={() => setLineStyle && setLineStyle('tapered')} className={`flex-1 h-10 flex items-center justify-center rounded-full transition ${lineStyle === 'tapered' ? 'bg-white shadow-sm border border-slate-200' : 'bg-slate-200/50 hover:bg-slate-200'}`}>
                    <svg width="32" height="6" viewBox="0 0 32 6"><path d="M0 3 Q 16 0, 32 3 Q 16 6, 0 3" fill="#1e293b" /></svg>
                  </button>
                  <button onClick={() => setLineStyle && setLineStyle('dashed')} className={`flex-1 h-10 flex items-center justify-center rounded-full transition ${lineStyle === 'dashed' ? 'bg-white shadow-sm border border-slate-200' : 'bg-slate-200/50 hover:bg-slate-200'}`}>
                    <div className="w-8 h-1 border-b-2 border-slate-800 border-dashed" />
                  </button>
                  <button onClick={() => setLineStyle && setLineStyle('dotted')} className={`flex-1 h-10 flex items-center justify-center rounded-full transition ${lineStyle === 'dotted' ? 'bg-white shadow-sm border border-slate-200' : 'bg-slate-200/50 hover:bg-slate-200'}`}>
                    <div className="w-8 h-1 border-b-2 border-slate-800 border-dotted" style={{ borderStyle: 'dotted' }} />
                  </button>
                </div>

                {/* Straighten Lines */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-800 font-medium">Redresser les lignes</span>
                  <button 
                    onClick={() => setStraightenLines && setStraightenLines(!straightenLines)} 
                    className={`w-11 h-6 rounded-full transition-colors relative ${straightenLines ? 'bg-green-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${straightenLines ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex flex-wrap justify-between gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-110 shadow-md ring-2 ring-blue-500 ring-offset-2 ring-offset-[#F4F5F8]' : 'hover:scale-110 shadow-sm'}`} style={{ backgroundColor: c }}>
                      {color === c && <Check size={16} className="mx-auto text-white drop-shadow-md" />}
                    </button>
                  ))}
                  <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-yellow-500 shadow-sm hover:scale-110 transition-transform" />
                </div>
              </div>
            </div>
          )}
INNER_EOF
