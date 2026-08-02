import React, { useState, useRef, useEffect } from 'react';
import type { Worksheet, WorksheetContent } from '../types';
import { GripVertical, Trash2, X, UploadCloud, ImageOff, Info, Image, LayoutTemplate, ListOrdered, Palette } from 'lucide-react';

const CLASS_OPTIONS = [
	'Tronc Commun Scientifique',
	"1ère Bac Sciences Expérimentales",
	"1ère Bac Sciences Mathématiques",
	"2ème Bac Sciences Expérimentales",
	"2ème Bac Sciences Mathématiques",
];

const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo

const computeDefaultSchoolYear = (): string => {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth(); // 0-11
	const startYear = month >= 7 ? year : year - 1;
	return `${startYear}-${startYear + 1}`;
};

interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	worksheet: Worksheet;
	onSave: (updatedContent: WorksheetContent) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, worksheet, onSave }) => {
	const [editableContent, setEditableContent] = useState<WorksheetContent>(JSON.parse(JSON.stringify(worksheet.content)));
	const [logoError, setLogoError] = useState<string | null>(null);
	const [isLogoDragOver, setIsLogoDragOver] = useState(false);
	const draggedItem = useRef<number | null>(null);
	const draggedOverItem = useRef<number | null>(null);
	const logoInputRef = useRef<HTMLInputElement>(null);

		useEffect(() => {
			if (!isOpen) {
				return;
			}
			const cloned: WorksheetContent = JSON.parse(JSON.stringify(worksheet.content));
			const defaultYear = computeDefaultSchoolYear();
			const settings = { ...(cloned.settings ?? {}) };
			if (!settings.schoolYear) {
				settings.schoolYear = defaultYear;
			}
			cloned.settings = settings;
			setEditableContent(cloned);
			setLogoError(null);
			setIsLogoDragOver(false);
		}, [worksheet, isOpen]);

	if (!isOpen) {
		return null;
	}

	const handleClassChange = (value: string) => {
		setEditableContent(prev => ({
			...prev,
			settings: {
				...prev.settings,
				className: value || undefined,
			},
		}));
	};

		const handleSchoolYearChange = (value: string) => {
			const normalized = value.trim();
			const resolvedValue = normalized === '' ? computeDefaultSchoolYear() : value;
			setEditableContent(prev => ({
				...prev,
				settings: {
					...prev.settings,
					schoolYear: resolvedValue,
				},
			}));
	};

	const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newHeight = parseInt(e.target.value, 10);
		setEditableContent(prev => ({
			...prev,
			settings: { ...prev.settings, answerSpaceMinHeight: newHeight },
		}));
	};

	const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newStyle = e.target.value as 'seyes' | 'slate' | 'grid' | 'dotted' | 'blank';
		setEditableContent(prev => ({
			...prev,
			settings: { ...prev.settings, answerSpaceStyle: newStyle },
		}));
	};

	const handleColorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newColor = e.target.value as 'black' | 'green' | 'blue' | 'white' | 'cream';
		setEditableContent(prev => ({
			...prev,
			settings: { ...prev.settings, answerSpaceColor: newColor },
		}));
	};

	const handleDeleteExercise = (index: number) => {
		if (window.confirm("Êtes-vous sûr de vouloir supprimer cet exercice ? Cette action est irréversible.")) {
			const newExercises = [...editableContent.exercises];
			newExercises.splice(index, 1);
			setEditableContent(prev => ({ ...prev, exercises: newExercises }));
		}
	};

	const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
		draggedItem.current = index;
		e.dataTransfer.effectAllowed = 'move';
	};

	const handleDragEnter = (_e: React.DragEvent<HTMLDivElement>, index: number) => {
		draggedOverItem.current = index;
	};

	const handleDragEnd = () => {
		draggedItem.current = null;
		draggedOverItem.current = null;
	};

	const handleDrop = () => {
		if (draggedItem.current !== null && draggedOverItem.current !== null && draggedItem.current !== draggedOverItem.current) {
			const newExercises = [...editableContent.exercises];
			const item = newExercises.splice(draggedItem.current, 1)[0];
			newExercises.splice(draggedOverItem.current, 0, item);
			setEditableContent(prev => ({ ...prev, exercises: newExercises }));
		}
		handleDragEnd();
	};

	const handleLogoFile = (file: File) => {
		if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
			setLogoError('Formats acceptés : PNG, JPG ou SVG.');
			return;
		}
		if (file.size > MAX_LOGO_SIZE_BYTES) {
			setLogoError('Le fichier dépasse la taille maximale de 2 Mo.');
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result === 'string') {
				setEditableContent(prev => ({
					...prev,
					settings: {
						...prev.settings,
						logoDataUrl: result,
					},
				}));
				setLogoError(null);
			} else {
				setLogoError('Impossible de lire ce fichier.');
			}
		};
		reader.onerror = () => {
			setLogoError('Erreur lors de la lecture du fichier.');
		};
		reader.readAsDataURL(file);
	};

	const handleLogoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			handleLogoFile(file);
		}
		e.target.value = '';
	};

	const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsLogoDragOver(false);
		const file = e.dataTransfer.files && e.dataTransfer.files[0];
		if (file) {
			handleLogoFile(file);
		}
	};

	const handleLogoDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		if (!isLogoDragOver) {
			setIsLogoDragOver(true);
		}
	};

	const handleLogoDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		if (isLogoDragOver) {
			setIsLogoDragOver(false);
		}
	};

	const handleRemoveLogo = () => {
		setEditableContent(prev => ({
			...prev,
			settings: {
				...prev.settings,
				logoDataUrl: undefined,
			},
		}));
		setLogoError(null);
	};

	const handleSave = () => {
		const cleanedSettings = editableContent.settings ? { ...editableContent.settings } : {};
		if (!cleanedSettings.className) delete cleanedSettings.className;
		if (!cleanedSettings.schoolYear) delete cleanedSettings.schoolYear;
		if (!cleanedSettings.logoDataUrl) delete cleanedSettings.logoDataUrl;
		if (cleanedSettings.answerSpaceMinHeight === undefined) delete cleanedSettings.answerSpaceMinHeight;
		if (!cleanedSettings.answerSpaceStyle) delete cleanedSettings.answerSpaceStyle;
		if (!cleanedSettings.answerSpaceColor) delete cleanedSettings.answerSpaceColor;

		const finalSettings = Object.keys(cleanedSettings).length > 0 ? cleanedSettings : undefined;

		const contentToSave: WorksheetContent = {
			...editableContent,
			settings: finalSettings,
		};

		onSave(contentToSave);
	};

	const currentSettings = editableContent.settings ?? {};
	const selectedClass = currentSettings.className ?? '';
		const selectedSchoolYear = currentSettings.schoolYear ?? computeDefaultSchoolYear();
	const logoPreview = currentSettings.logoDataUrl;

	return (
		<div
			className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-center items-center p-4"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
		>
			<div
				className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
				onClick={e => e.stopPropagation()}
			>
				<header className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
					<h2 className="text-lg font-bold font-display text-slate-900">Paramètres</h2>
					<button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition" aria-label="Fermer">
						<X className="h-5 w-5 text-slate-500" />
					</button>
				</header>

			<main className="p-6 overflow-y-auto text-gray-900 custom-scrollbar">
					<input
						ref={logoInputRef}
						type="file"
						accept={ACCEPTED_LOGO_TYPES.join(',')}
						className="hidden"
						onChange={handleLogoInputChange}
					/>
					<div className="space-y-10">
						{/* Informations Générales */}
						<section className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
									<Info className="h-5 w-5" />
								</div>
								<div>
									<h3 className="text-lg font-semibold text-gray-900">Informations générales</h3>
									<p className="text-sm text-slate-500">Ces informations s'afficheront en haut de la fiche imprimée.</p>
								</div>
							</div>
							<div className="grid gap-6 md:grid-cols-2 ml-0 md:ml-12">
								<div>
									  <label htmlFor="class-select" className="block text-sm font-medium text-gray-900 mb-2">Classe</label>
									<select
										id="class-select"
										value={selectedClass}
										onChange={(e) => handleClassChange(e.target.value)}
										className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition shadow-sm"
									>
										<option value="">— Sélectionner —</option>
										{CLASS_OPTIONS.map(option => (
											<option key={option} value={option}>{option}</option>
										))}
									</select>
								</div>
								<div>
									  <label htmlFor="school-year" className="block text-sm font-medium text-gray-900 mb-2">Année scolaire</label>
									<input
										id="school-year"
										type="text"
										placeholder="2025-2026"
										value={selectedSchoolYear}
										onChange={(e) => handleSchoolYearChange(e.target.value)}
										className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition shadow-sm"
									/>
								</div>
							</div>
						</section>

						{/* Identité Visuelle */}
						<section className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
									<Image className="h-5 w-5" />
								</div>
								<div>
									<h3 className="text-lg font-semibold text-gray-900">Identité visuelle</h3>
									<p className="text-sm text-slate-500">Personnalisez l'en-tête avec votre logo (PNG, JPG ou SVG).</p>
								</div>
							</div>
							<div className="ml-0 md:ml-12">
								<div
									className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${isLogoDragOver ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-300 bg-gray-50 hover:border-blue-500 hover:bg-blue-50'}`}
									onClick={() => logoInputRef.current?.click()}
									onDrop={handleLogoDrop}
									onDragOver={handleLogoDragOver}
									onDragLeave={handleLogoDragLeave}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											logoInputRef.current?.click();
										}
									}}
									aria-label="Zone de dépôt pour le logo"
								>
									<UploadCloud className="h-8 w-8" />
									<div>
										<p className="text-sm font-semibold">Glissez-déposez votre logo ici</p>
										<p className="text-xs text-gray-500 mt-1">ou cliquez pour parcourir vos fichiers</p>
									</div>
									{logoPreview && (
										<div className="mt-4 w-full max-w-xs rounded-md border border-gray-200 bg-white p-3 relative group">
											<img src={logoPreview} alt="Logo téléchargé" className="mx-auto max-h-32 w-full object-contain" />
										</div>
									)}
								</div>
								{logoError && <p className="text-sm text-red-600 mt-2">{logoError}</p>}
								{logoPreview && (
									<button
										type="button"
										onClick={handleRemoveLogo}
										className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-red-600 hover:text-red-600 hover:bg-red-50 transition shadow-sm"
									>
										<ImageOff className="h-3.5 w-3.5" />
										Retirer le logo
									</button>
								)}
							</div>
						</section>



						{/* Affichage et Pagination */}
						<section className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
									<LayoutTemplate className="h-5 w-5" />
								</div>
								<div>
									<h3 className="text-lg font-semibold text-gray-900">Affichage & Pagination</h3>
									<p className="text-sm text-slate-500">Gérez la présentation des questions et l'impression.</p>
								</div>
							</div>
							
							<div className="ml-0 md:ml-12 grid gap-4">
								<label className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition shadow-sm">
									<div className="flex items-center h-5">
										<input
											type="checkbox"
											checked={editableContent.settings?.showCanvas !== false}
											onChange={(e) => setEditableContent(prev => ({
												...prev,
												settings: { ...prev.settings, showCanvas: e.target.checked }
											}))}
											className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
										/>
									</div>
									<div className="flex flex-col">
										<span className="text-sm font-medium text-gray-900">Afficher les zones de réponse (Canevas)</span>
										<span className="text-xs text-slate-500">Affiche ou masque les zones de réponse et le canevas de dessin sous les questions.</span>
									</div>
								</label>

								<label className="flex items-start gap-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl cursor-pointer hover:bg-emerald-50 transition shadow-sm">
									<div className="flex items-center h-5">
										<input
											type="checkbox"
											checked={editableContent.settings?.showSolutions || false}
											onChange={(e) => setEditableContent(prev => ({
												...prev,
												settings: { ...prev.settings, showSolutions: e.target.checked }
											}))}
											className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
										/>
									</div>
									<div className="flex flex-col">
										<span className="text-sm font-semibold text-emerald-900">Afficher les corrigés manuscrits par défaut</span>
										<span className="text-xs text-emerald-700">Affiche directement le corrigé rédigé en écriture manuscrite dans toutes les zones de réponse.</span>
									</div>
								</label>

								<label className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition shadow-sm">
									<div className="flex items-center h-5">
										<input
											type="checkbox"
											checked={editableContent.settings?.oneQuestionPerPage || false}
											onChange={(e) => setEditableContent(prev => ({
												...prev,
												settings: { ...prev.settings, oneQuestionPerPage: e.target.checked }
											}))}
											className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
										/>
									</div>
									<div className="flex flex-col">
										<span className="text-sm font-medium text-gray-900">Une question par page</span>
										<span className="text-xs text-slate-500">Ajoute un saut de page avant chaque question principale lors de l'impression.</span>
									</div>
								</label>

								<label className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition shadow-sm">
									<div className="flex items-center h-5">
										<input
											type="checkbox"
											checked={editableContent.settings?.presentationMode || false}
											onChange={(e) => setEditableContent(prev => ({
												...prev,
												settings: { ...prev.settings, presentationMode: e.target.checked }
											}))}
											className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
										/>
									</div>
									<div className="flex flex-col">
										<span className="text-sm font-medium text-gray-900">Mode Diaporama (Questions avec sous-questions)</span>
										<span className="text-xs text-slate-500">Affiche l'énoncé de la question centré sur une page séparée si elle contient des sous-questions.</span>
									</div>
								</label>
							</div>
						</section>

						{/* Style & Fond des Zones de Réponse */}
						<section className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
									<Palette className="h-5 w-5" />
								</div>
								<div>
									<h3 className="text-lg font-semibold text-gray-900">Style & Fond des Zones de Réponse</h3>
									<p className="text-sm text-slate-500">Personnalisez le quadrillage, la couleur de fond et la hauteur par défaut des canevas de réponse.</p>
								</div>
							</div>

							<div className="ml-0 md:ml-12 grid gap-6 md:grid-cols-2">
								<div>
									<label htmlFor="answer-space-style" className="block text-sm font-medium text-gray-900 mb-2">Style de lignes / quadrillage</label>
									<select
										id="answer-space-style"
										value={editableContent.settings?.answerSpaceStyle || 'slate'}
										onChange={(e) => setEditableContent(prev => ({
											...prev,
											settings: { ...prev.settings, answerSpaceStyle: e.target.value as any }
										}))}
										className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition shadow-sm"
									>
										<option value="slate">Ardoise (Lignes horizontales)</option>
										<option value="seyes">Grands Carreaux (Seyes)</option>
										<option value="grid">Quadrillage (Grid)</option>
										<option value="dotted">Pointillés (Dotted)</option>
										<option value="blank">Vierge (Sans lignes)</option>
									</select>
								</div>

								<div>
									<label htmlFor="answer-space-color" className="block text-sm font-medium text-gray-900 mb-2">Couleur de fond du canevas</label>
									<select
										id="answer-space-color"
										value={editableContent.settings?.answerSpaceColor || ''}
										onChange={(e) => setEditableContent(prev => ({
											...prev,
											settings: { ...prev.settings, answerSpaceColor: e.target.value as any }
										}))}
										className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition shadow-sm"
									>
										<option value="">Couleur par défaut du style</option>
										<option value="black">Noir Sombre (#0F172A)</option>
										<option value="green">Vert Ardoise (#14532D)</option>
										<option value="blue">Bleu Nuit (#1E3A8A)</option>
										<option value="white">Blanc Pur (#FFFFFF)</option>
										<option value="cream">Crème Doux (#FEF3C7)</option>
									</select>
								</div>

								<div className="md:col-span-2">
									<label htmlFor="answer-space-height" className="block text-sm font-medium text-gray-900 mb-2">
										Hauteur minimale des zones de réponse : <span className="font-bold text-blue-600">{editableContent.settings?.answerSpaceMinHeight || 120} px</span>
									</label>
									<input
										id="answer-space-height"
										type="range"
										min="60"
										max="600"
										step="20"
										value={editableContent.settings?.answerSpaceMinHeight || 120}
										onChange={(e) => setEditableContent(prev => ({
											...prev,
											settings: { ...prev.settings, answerSpaceMinHeight: parseInt(e.target.value, 10) }
										}))}
										className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
									/>
								</div>
							</div>
						</section>

						{/* Organisation */}
						<section className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
									<ListOrdered className="h-5 w-5" />
								</div>
								<div>
									<h3 className="text-lg font-semibold text-gray-900">Organisation des exercices</h3>
									<p className="text-sm text-slate-500">Réordonnez ou supprimez des exercices.</p>
								</div>
							</div>
							<div className="space-y-2 ml-0 md:ml-12">
								{editableContent.exercises.map((ex, index) => (
									<div
										key={ex.id || index}
										className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition group shadow-sm"
										draggable
										onDragStart={(e) => handleDragStart(e, index)}
										onDragEnter={(e) => handleDragEnter(e, index)}
										onDragOver={(e) => e.preventDefault()}
										onDrop={handleDrop}
										onDragEnd={handleDragEnd}
									>
										<div className="flex items-center gap-3">
											<div className="p-1 text-gray-300 group-hover:text-blue-600 cursor-move transition">
												<GripVertical className="h-5 w-5" />
											</div>
											<span className="font-medium text-slate-700 truncate">{index + 1}. {ex.title}</span>
										</div>
										<button
											onClick={() => handleDeleteExercise(index)}
											  className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
											aria-label="Supprimer l'exercice"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								))}
							</div>
						</section>
					</div>
				</main>

			<footer className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
					<button onClick={onClose} className="px-5 py-2.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition shadow-sm">
						Annuler
					</button>
					<button onClick={handleSave} className="px-5 py-2.5 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 font-medium transition shadow-sm hover:shadow-md">
						Enregistrer
					</button>
				</footer>
			</div>
		</div>
	);
};

export default SettingsModal;