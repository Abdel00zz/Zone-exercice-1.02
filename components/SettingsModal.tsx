import React, { useState, useRef, useEffect } from 'react';
import type { PaperTheme, Worksheet, WorksheetContent } from '../types';
import { DEFAULT_OFFICIAL_CLASSES } from '../utils/worksheetUtils';
import { PAPER_THEME_OPTIONS } from '../utils/paperThemes';
import { GripVertical, Trash2, X, UploadCloud, ImageOff, Info, Image, LayoutTemplate, ListOrdered, Palette, Settings } from 'lucide-react';

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
	worksheetClasses?: string[];
	onSave: (updatedContent: WorksheetContent) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
	isOpen, 
	onClose, 
	worksheet, 
	worksheetClasses = DEFAULT_OFFICIAL_CLASSES,
	onSave 
}) => {
	const classOptions = worksheetClasses.length > 0 ? worksheetClasses : DEFAULT_OFFICIAL_CLASSES;
	const [editableContent, setEditableContent] = useState<WorksheetContent>(() => structuredClone(worksheet.content));
	const [logoError, setLogoError] = useState<string | null>(null);
	const [isLogoDragOver, setIsLogoDragOver] = useState(false);
	const draggedItem = useRef<number | null>(null);
	const draggedOverItem = useRef<number | null>(null);
	const logoInputRef = useRef<HTMLInputElement>(null);

		useEffect(() => {
			if (!isOpen) {
				return;
			}
			const cloned: WorksheetContent = structuredClone(worksheet.content);
			const defaultYear = computeDefaultSchoolYear();
			const settings = { ...(cloned.settings ?? {}) };
			if (!settings.schoolYear) {
				settings.schoolYear = defaultYear;
			}
			if (settings.presentationMode === undefined) {
				settings.presentationMode = false;
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
		if (!cleanedSettings.paperTheme) delete cleanedSettings.paperTheme;

		const finalSettings = Object.keys(cleanedSettings).length > 0 ? cleanedSettings : undefined;

		const contentToSave: WorksheetContent = {
			...editableContent,
			settings: finalSettings,
		};

		onSave(contentToSave);
	};

	const handlePaperThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const value = event.target.value;
		setEditableContent(prev => {
			const settings = { ...prev.settings };
			if (value) settings.paperTheme = value as PaperTheme;
			else delete settings.paperTheme;
			return { ...prev, settings };
		});
	};

	const currentSettings = editableContent.settings ?? {};
	const selectedClass = currentSettings.className ?? '';
		const selectedSchoolYear = currentSettings.schoolYear ?? computeDefaultSchoolYear();
	const logoPreview = currentSettings.logoDataUrl;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-[#172126]/35 p-4 backdrop-blur-sm"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
		>
			<div
				className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[#dedbd2] bg-[#fffefa] shadow-2xl"
				onClick={e => e.stopPropagation()}
			>
				<header className="flex shrink-0 items-center justify-between border-b border-[#dedbd2] px-5 py-4 sm:px-6">
					<div className="flex items-center gap-3">
						<span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dceceb] text-[#19788c]">
							<Settings className="h-5 w-5" />
						</span>
						<div>
							<h2 className="font-serif text-xl font-semibold text-[#172126]">Configuration de la fiche</h2>
							<p className="text-xs font-medium text-[#697478]">Réglages spécifiques à cette fiche.</p>
						</div>
					</div>
					<button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-[#697478] hover:bg-[#f4f1eb] transition-colors" aria-label="Fermer">
						<X className="h-5 w-5" />
					</button>
				</header>

				<main className="flex-grow overflow-y-auto p-5 sm:p-6 text-[#172126] custom-scrollbar">
					<input
						ref={logoInputRef}
						type="file"
						accept={ACCEPTED_LOGO_TYPES.join(',')}
						className="hidden"
						onChange={handleLogoInputChange}
					/>
					<div className="space-y-6">
						{/* Informations Générales */}
						<section className="rounded-2xl border border-[#cbe0df] bg-[#f1f8f7] p-4 sm:p-5">
							<div className="mb-4 flex items-center gap-3">
								<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#dceceb] text-[#19788c]">
									<Info className="h-4 w-4" />
								</span>
								<div>
									<h3 className="text-sm font-bold text-[#172126]">Informations générales</h3>
									<p className="text-xs text-[#697478]">Ces informations s'afficheront en haut de la fiche imprimée.</p>
								</div>
							</div>
							<div className="grid gap-5 sm:grid-cols-2">
								<label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#435054]">
									Classe
									<select
										value={selectedClass}
										onChange={(e) => handleClassChange(e.target.value)}
										className="h-11 w-full rounded-xl border border-[#cbe0df] bg-white px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20"
									>
										<option value="">— Sélectionner —</option>
										{classOptions.map(option => (
											<option key={option} value={option}>{option}</option>
										))}
									</select>
								</label>
								<label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#435054]">
									Année scolaire
									<input
										type="text"
										placeholder="2025-2026"
										value={selectedSchoolYear}
										onChange={(e) => handleSchoolYearChange(e.target.value)}
										className="h-11 w-full rounded-xl border border-[#cbe0df] bg-white px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20"
									/>
								</label>
							</div>
						</section>

						{/* Identité Visuelle */}
						<section className="rounded-2xl border border-[#e2d5ed] bg-[#f8f3fc] p-4 sm:p-5">
							<div className="mb-4 flex items-center gap-3">
								<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eadef5] text-[#7e3af2]">
									<Image className="h-4 w-4" />
								</span>
								<div>
									<h3 className="text-sm font-bold text-[#172126]">Identité visuelle</h3>
									<p className="text-xs text-[#697478]">Personnalisez l'en-tête avec votre logo (PNG, JPG ou SVG).</p>
								</div>
							</div>
							<div>
								<div
									className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition ${isLogoDragOver ? 'border-[#7e3af2] bg-[#7e3af2]/5 text-[#7e3af2]' : 'border-[#e2d5ed] bg-white hover:border-[#7e3af2]/50 hover:bg-[#7e3af2]/5'}`}
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
										<p className="text-[13px] font-bold text-[#172126]">Glissez-déposez votre logo ici</p>
										<p className="mt-1 text-[11px] text-[#697478]">ou cliquez pour parcourir vos fichiers</p>
									</div>
									{logoPreview && (
										<div className="mt-4 w-full max-w-[200px] rounded-xl border border-[#dedbd2] bg-white p-3 shadow-sm">
											<img src={logoPreview} alt="Logo téléchargé" className="mx-auto max-h-24 w-full object-contain" />
										</div>
									)}
								</div>
								{logoError && <p className="mt-2 text-[13px] font-bold text-red-600">{logoError}</p>}
								{logoPreview && (
									<button
										type="button"
										onClick={handleRemoveLogo}
										className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white border border-[#dedbd2] px-4 py-2 text-[13px] font-bold text-[#697478] shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
									>
										<ImageOff className="h-4 w-4" />
										Retirer le logo
									</button>
								)}
							</div>
						</section>

						{/* Affichage et Pagination */}
						<section className="rounded-2xl border border-[#e5dcb8] bg-[#fbf4dc] p-4 sm:p-5">
							<div className="mb-4 flex items-center gap-3">
								<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f0e6c2] text-[#b88700]">
									<LayoutTemplate className="h-4 w-4" />
								</span>
								<div>
									<h3 className="text-sm font-bold text-[#172126]">Affichage & Pagination</h3>
									<p className="text-xs text-[#697478]">Gérez la présentation des questions et l'impression.</p>
								</div>
							</div>
							
							<div className="grid gap-4">
								<label className="flex items-start gap-4 rounded-xl border border-[#e5dcb8]/80 bg-white p-4 shadow-sm cursor-pointer hover:bg-[#fbf4dc]/20 transition-colors">
									<div className="flex h-5 items-center">
										<input
											type="checkbox"
											checked={editableContent.settings?.showCanvas !== false}
											onChange={(e) => setEditableContent(prev => ({
												...prev,
												settings: { ...prev.settings, showCanvas: e.target.checked }
											}))}
											className="h-4 w-4 rounded border-[#d4d8d5] text-[#b88700] focus:ring-[#b88700]"
										/>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-[13px] font-bold text-[#172126]">Afficher les zones de réponse (Canevas)</span>
										<span className="text-[11px] font-medium text-[#697478]">Affiche ou masque les zones de réponse et le canevas de dessin sous les questions.</span>
									</div>
								</label>

								<label className="flex items-start gap-4 rounded-xl border border-[#e5dcb8]/80 bg-white p-4 shadow-sm cursor-pointer hover:bg-[#fbf4dc]/20 transition-colors">
									<div className="flex h-5 items-center">
										<input
											type="checkbox"
											checked={editableContent.settings?.oneQuestionPerPage || false}
											onChange={(e) => setEditableContent(prev => ({
												...prev,
												settings: { ...prev.settings, oneQuestionPerPage: e.target.checked }
											}))}
											className="h-4 w-4 rounded border-[#d4d8d5] text-[#b88700] focus:ring-[#b88700]"
										/>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-[13px] font-bold text-[#172126]">Une question par page</span>
										<span className="text-[11px] font-medium text-[#697478]">Ajoute un saut de page avant chaque question principale lors de l'impression.</span>
									</div>
								</label>

								<label className="flex items-start gap-4 rounded-xl border border-[#e5dcb8]/80 bg-white p-4 shadow-sm cursor-pointer hover:bg-[#fbf4dc]/20 transition-colors">
									<div className="flex h-5 items-center">
										<input
											type="checkbox"
											checked={editableContent.settings?.presentationMode || false}
											onChange={(e) => setEditableContent(prev => ({
												...prev,
												settings: { ...prev.settings, presentationMode: e.target.checked }
											}))}
											className="h-4 w-4 rounded border-[#d4d8d5] text-[#b88700] focus:ring-[#b88700]"
										/>
									</div>
									<div className="flex flex-col gap-1">
										<span className="text-[13px] font-bold text-[#172126]">Mode Diaporama</span>
										<span className="text-[11px] font-medium text-[#697478]">Affiche l'énoncé de la question centré sur une page séparée si elle contient des sous-questions.</span>
									</div>
								</label>

								<label className="text-[13px] font-bold text-[#172126] flex flex-col gap-1.5 mt-2">Thème de la page (Couleur)
									<select 
										value={editableContent.settings?.paperTheme || ''} 
										onChange={handlePaperThemeChange}
										className="w-full rounded-xl border border-[#e5dcb8]/80 bg-white h-11 px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20"
									>
										<option value="">Par défaut (Général)</option>
										{PAPER_THEME_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
									</select>
								</label>
							</div>
						</section>

						{/* Style & Fond des Zones de Réponse */}
						<section className="rounded-2xl border border-[#dedbd2] bg-[#fbf8f2] p-4 sm:p-5">
							<div className="mb-4 flex items-center gap-3">
								<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e4e4e1] text-[#435054]">
									<Palette className="h-4 w-4" />
								</span>
								<div>
									<h3 className="text-sm font-bold text-[#172126]">Style & Fond des Zones de Réponse</h3>
									<p className="text-xs text-[#697478]">Personnalisez le quadrillage, la couleur de fond et la hauteur.</p>
								</div>
							</div>

							<div className="grid gap-5 sm:grid-cols-2">
								<label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#435054]">
									Style de lignes / quadrillage
									<select
										value={editableContent.settings?.answerSpaceStyle || 'slate'}
										onChange={(e) => setEditableContent(prev => ({
											...prev,
											settings: { ...prev.settings, answerSpaceStyle: e.target.value as any }
										}))}
										className="h-11 w-full rounded-xl border border-[#dedbd2] bg-white px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20"
									>
										<option value="slate">Ardoise (Lignes horizontales)</option>
										<option value="seyes">Grands Carreaux (Seyes)</option>
										<option value="grid">Quadrillage (Grid)</option>
										<option value="dotted">Pointillés (Dotted)</option>
										<option value="blank">Vierge (Sans lignes)</option>
									</select>
								</label>

								<label className="flex flex-col gap-1.5 text-[13px] font-bold text-[#435054]">
									Couleur de fond du canevas
									<select
										value={editableContent.settings?.answerSpaceColor || ''}
										onChange={(e) => setEditableContent(prev => ({
											...prev,
											settings: { ...prev.settings, answerSpaceColor: e.target.value as any }
										}))}
										className="h-11 w-full rounded-xl border border-[#dedbd2] bg-white px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20"
									>
										<option value="">Couleur par défaut du style</option>
										<option value="black">Noir Sombre (#0F172A)</option>
										<option value="green">Vert Ardoise (#14532D)</option>
										<option value="blue">Bleu Nuit (#1E3A8A)</option>
										<option value="white">Blanc Pur (#FFFFFF)</option>
										<option value="cream">Crème Doux (#FEF3C7)</option>
									</select>
								</label>

								<label className="sm:col-span-2 flex flex-col gap-1.5 text-[13px] font-bold text-[#435054]">
									Hauteur minimale des zones de réponse : <span className="text-[#19788c]">{editableContent.settings?.answerSpaceMinHeight || 120} px</span>
									<input
										type="range"
										min="60"
										max="600"
										step="20"
										value={editableContent.settings?.answerSpaceMinHeight || 120}
										onChange={(e) => setEditableContent(prev => ({
											...prev,
											settings: { ...prev.settings, answerSpaceMinHeight: parseInt(e.target.value, 10) }
										}))}
										className="mt-2 w-full accent-[#19788c]"
									/>
								</label>
							</div>

							{/* Aperçu en temps réel */}
							<div className="mt-5 rounded-xl border border-[#dedbd2] bg-white p-4 shadow-sm">
								<div className="mb-2 flex items-center justify-between border-b border-[#f0eee6] pb-2">
									<span className="text-xs font-bold uppercase tracking-wider text-[#19788c]">Aperçu en temps réel</span>
									<span className="rounded-full bg-[#19788c]/10 px-2 py-0.5 text-[10px] font-bold text-[#19788c]">Mise à jour directe</span>
								</div>
								
								{/* Mini En-tête */}
								<div className="flex items-center justify-between rounded-lg bg-[#fcfbfa] p-3 border border-[#f0eee6]">
									<div>
										<div className="text-xs font-bold text-[#172126]">
											{selectedClass || 'Classe non spécifiée'}
										</div>
										<div className="text-[11px] font-medium text-[#697478]">
											Année : {selectedSchoolYear}
										</div>
									</div>
									{logoPreview ? (
										<img src={logoPreview} alt="Aperçu logo" className="h-8 max-w-[80px] object-contain" />
									) : (
										<span className="text-[10px] italic text-[#a3acae]">Aucun logo</span>
									)}
								</div>

								{/* Mini Canevas / Zone de réponse */}
								{editableContent.settings?.showCanvas !== false ? (
									<div className="mt-3">
										<div className="mb-1 text-[11px] font-semibold text-[#697478]">
											Style de zone de réponse : <span className="text-[#172126] font-bold">{editableContent.settings?.answerSpaceStyle || 'slate'}</span> ({editableContent.settings?.answerSpaceMinHeight || 120}px)
										</div>
										<div 
											className="w-full rounded-lg border border-[#334155] relative overflow-hidden transition-all duration-200"
											style={{
												height: `${Math.min(100, Math.max(50, (editableContent.settings?.answerSpaceMinHeight || 120) * 0.4))}px`,
												backgroundColor: 
													editableContent.settings?.answerSpaceColor === 'black' ? '#0F172A' :
													editableContent.settings?.answerSpaceColor === 'green' ? '#14532D' :
													editableContent.settings?.answerSpaceColor === 'blue' ? '#1E3A8A' :
													editableContent.settings?.answerSpaceColor === 'white' ? '#FFFFFF' :
													editableContent.settings?.answerSpaceColor === 'cream' ? '#FEF3C7' : '#0F172A',
											}}
										>
											{/* Simulation du quadrillage */}
											{(editableContent.settings?.answerSpaceStyle === 'slate' || !editableContent.settings?.answerSpaceStyle) && (
												<div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_23px,rgba(255,255,255,0.15)_24px)] bg-[size:100%_24px]" />
											)}
											{editableContent.settings?.answerSpaceStyle === 'seyes' && (
												<div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(239,68,68,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.3)_1px,transparent_1px)] bg-[size:16px_16px]" />
											)}
											{editableContent.settings?.answerSpaceStyle === 'grid' && (
												<div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:16px_16px]" />
											)}
											{editableContent.settings?.answerSpaceStyle === 'dotted' && (
												<div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.3)_1px,transparent_1px)] bg-[size:12px_12px]" />
											)}
											<div className="absolute bottom-2 right-2 text-[10px] font-mono text-white/50 bg-black/30 px-1.5 py-0.5 rounded">
												Zone de réponse ({editableContent.settings?.answerSpaceMinHeight || 120}px)
											</div>
										</div>
									</div>
								) : (
									<div className="mt-3 rounded-lg border border-dashed border-[#dedbd2] p-3 text-center text-xs font-semibold text-[#697478] bg-[#fcfbfa]">
										Les zones de réponse sont actuellement masquées.
									</div>
								)}

								{/* Badges d'options */}
								<div className="mt-3 flex flex-wrap gap-1.5">
									{editableContent.settings?.oneQuestionPerPage && (
										<span className="rounded-md bg-[#fbf4dc] border border-[#e5dcb8] px-2 py-0.5 text-[10px] font-bold text-[#b88700]">
											1 question / page
										</span>
									)}
									{editableContent.settings?.presentationMode && (
										<span className="rounded-md bg-[#eadef5] border border-[#e2d5ed] px-2 py-0.5 text-[10px] font-bold text-[#7e3af2]">
											Mode Diaporama
										</span>
									)}
								</div>
							</div>
						</section>

						{/* Organisation */}
						<section className="rounded-2xl border border-[#cbe0df] bg-[#f1f8f7] p-4 sm:p-5">
							<div className="mb-4 flex items-center gap-3">
								<span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#dceceb] text-[#19788c]">
									<ListOrdered className="h-4 w-4" />
								</span>
								<div>
									<h3 className="text-sm font-bold text-[#172126]">Organisation des exercices</h3>
									<p className="text-xs text-[#697478]">Réordonnez ou supprimez des exercices.</p>
								</div>
							</div>
							<div className="space-y-2">
								{editableContent.exercises.map((ex, index) => (
									<div
										key={ex.id || index}
										className="flex items-center justify-between p-3 bg-white border border-[#cbe0df]/60 rounded-xl hover:border-[#19788c]/40 hover:shadow-sm transition group"
										draggable
										onDragStart={(e) => handleDragStart(e, index)}
										onDragEnter={(e) => handleDragEnter(e, index)}
										onDragOver={(e) => e.preventDefault()}
										onDrop={handleDrop}
										onDragEnd={handleDragEnd}
									>
										<div className="flex items-center gap-3">
											<div className="p-1 text-[#b9c4c2] group-hover:text-[#19788c] cursor-move transition">
												<GripVertical className="h-5 w-5" />
											</div>
											<span className="text-[13px] font-bold text-[#172126] truncate">{index + 1}. {ex.title}</span>
										</div>
										<button
											onClick={() => handleDeleteExercise(index)}
											className="p-2 text-[#697478] hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
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

				<footer className="shrink-0 flex justify-end gap-3 border-t border-[#dedbd2] px-5 py-4 bg-[#fffefa]">
					<button onClick={onClose} className="rounded-xl px-5 h-11 text-sm font-bold text-[#697478] hover:bg-[#f4f1eb] transition-colors">
						Annuler
					</button>
					<button onClick={handleSave} className="rounded-xl bg-[#172126] px-6 h-11 text-sm font-bold text-white shadow-md hover:bg-[#25363c] transition-colors active:scale-95">
						Enregistrer
					</button>
				</footer>
			</div>
		</div>
	);
};

export default SettingsModal;
