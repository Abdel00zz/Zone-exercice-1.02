import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, Link as LinkIcon, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ImageConfig } from '../types';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (imageConfig: ImageConfig | undefined) => void;
  initialImage?: ImageConfig;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, onSave, initialImage }) => {
  const [src, setSrc] = useState(initialImage?.src || '');
  const [width, setWidth] = useState(initialImage?.width || 200);
  const [height, setHeight] = useState(initialImage?.height || 200);
  const [placement, setPlacement] = useState<'left' | 'center' | 'right'>(initialImage?.placement || 'left');
  const [caption, setCaption] = useState(initialImage?.caption || '');
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSrc(initialImage?.src || '');
      setWidth(initialImage?.width || 200);
      setHeight(initialImage?.height || 200);
      setPlacement(initialImage?.placement || 'left');
      setCaption(initialImage?.caption || '');
      setError(null);
    }
  }, [isOpen, initialImage]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner un fichier image valide (JPG, PNG, GIF).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSrc(result);
      setError(null);
      
      // Try to get original dimensions
      const img = new Image();
      img.onload = () => {
        // Set reasonable default size if it's too large
        let newWidth = img.width;
        let newHeight = img.height;
        const maxDim = 300;
        
        if (newWidth > maxDim || newHeight > maxDim) {
          if (newWidth > newHeight) {
            newHeight = Math.round((newHeight * maxDim) / newWidth);
            newWidth = maxDim;
          } else {
            newWidth = Math.round((newWidth * maxDim) / newHeight);
            newHeight = maxDim;
          }
        }
        setWidth(newWidth);
        setHeight(newHeight);
      };
      img.src = result;
    };
    reader.onerror = () => {
      setError('Erreur lors de la lecture du fichier.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!src) {
      onSave(undefined);
      return;
    }

    onSave({
      id: initialImage?.id || `img_${Date.now()}`,
      src,
      width,
      height,
      placement,
      caption
    });
  };

  const handleRemove = () => {
    onSave(undefined);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-none border border-slate-300 shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-700 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-slate-900">Configuration de l'image</h2>
              <p className="text-sm text-slate-500">Ajoutez et personnalisez une image pour cette question</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Source Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Source de l'image</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-colors group"
              >
                <div className="w-12 h-12 bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 rounded-full flex items-center justify-center transition-colors">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="block font-medium text-slate-900">Parcourir les fichiers</span>
                  <span className="block text-xs text-slate-500 mt-1">JPG, PNG, GIF (max 5MB)</span>
                </div>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/jpeg, image/png, image/gif" 
                className="hidden" 
              />

              <div className="flex flex-col justify-center gap-3 p-6 border border-slate-200 bg-slate-50">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Ou via URL
                </label>
                <input
                  type="text"
                  value={src.startsWith('data:') ? '' : src}
                  onChange={(e) => setSrc(e.target.value)}
                  placeholder="https://exemple.com/image.jpg"
                  className="w-full px-3 py-2 border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview & Settings */}
          {src && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-200">
              
              {/* Preview */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Aperçu</h3>
                <div className="border border-slate-200 bg-slate-100 h-48 flex items-center justify-center overflow-hidden relative">
                  <img 
                    src={src} 
                    alt="Aperçu" 
                    className="max-w-full max-h-full object-contain"
                    style={{ width: `${width}px`, height: `${height}px` }}
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Paramètres</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Largeur (px)</label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Hauteur (px)</label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Alignement</label>
                  <div className="flex border border-slate-300">
                    {(['left', 'center', 'right'] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setPlacement(pos)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          placement === pos 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-slate-700 hover:bg-slate-50'
                        } ${pos !== 'right' ? 'border-r border-slate-300' : ''}`}
                      >
                        {pos === 'left' ? 'Gauche' : pos === 'center' ? 'Centre' : 'Droite'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Légende (Optionnelle)</label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Ex: Figure 1"
                    className="w-full px-3 py-2 border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          {initialImage ? (
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
            >
              Supprimer l'image
            </button>
          ) : <div></div>}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {initialImage ? 'Mettre à jour' : 'Ajouter l\'image'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ImageModal;
