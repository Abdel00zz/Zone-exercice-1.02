import React, { useState } from 'react';
import { 
    HelpCircle, X, BookOpen, Folder, Edit3, PenTool, 
    Tv, RefreshCw, CheckCircle2, Sparkles, GraduationCap, 
    Lightbulb, FileText, Layers, ShieldCheck, Globe, ChevronRight,
    Search, Terminal, Monitor, Tablet, Code2
} from 'lucide-react';

type Language = 'fr' | 'en' | 'ar';
type HelpTab = 'overview' | 'classes' | 'editing' | 'canvas' | 'presentation' | 'sync';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const translations = {
    fr: {
        title: "Guide & Centre d'aide",
        subtitle: "Interactive Maths v1.0",
        author: "Créé par Boudouh Abdelmalek",
        authorArabic: "بدوح عبدالمالك",
        close: "Fermer le guide",
        searchPlaceholder: "Rechercher dans l'aide...",
        languages: { fr: "Français", en: "English", ar: "العربية" },
        tabs: {
            overview: { label: "Introduction", desc: "Prise en main & fonctionnalités" },
            classes: { label: "Classes & Arborescence", desc: "Organisation du tableau de bord" },
            editing: { label: "Éditeur & LaTeX", desc: "Création et formules mathématiques" },
            canvas: { label: "Tableau & Stylet", desc: "Moteur d'encre & annotations" },
            presentation: { label: "Projection & PDF", desc: "Mode Beamer et impression" },
            sync: { label: "Sync & Hors-ligne", desc: "Mode PWA et réseau local" },
        },
        overview: {
            badge: "Guide Interactif",
            heading: "Bienvenue sur Interactive Maths",
            intro: "Interactive Maths est votre espace de travail mathématique tout-en-un conçu spécifiquement pour la création, l'enseignement et la résolution de fiches d'exercices interactives.",
            forWhoTitle: "Pour qui est conçue l'application ?",
            teachers: {
                title: "Enseignants de Mathématiques",
                desc: "Rédigez vos exercices en LaTeX, projetez les solutions pas à pas avec le mode Beamer et annoter en direct lors du cours."
            },
            students: {
                title: "Élèves & Étudiants",
                desc: "Révisez et résolvez les fiches directement sur tablette tactile avec la saisie manuscrite fluide et le guidage pas à pas."
            },
            keyFeaturesTitle: "Fonctionnalités Clés",
            features: [
                { title: "Saisie LaTeX & MathJax", desc: "Rendu mathématique instantané haute précision." },
                { title: "Tableau d'annotation tactile", desc: "Encre numérique fluide avec gestion de la pression du stylet." },
                { title: "Projection Beamer", desc: "Affichage dynamique des étapes de solution et indices." },
                { title: "100% Fonctionnel Hors-ligne", desc: "Application PWA autonome avec synchronisation PC/Tablette." }
            ]
        },
        classes: {
            heading: "Gestion du Tableau de Bord & Arborescence",
            intro: "Organisez l'ensemble de vos cours et fiches d'exercices grâce à une structure hiérarchique claire.",
            cards: [
                { title: "1. Structure par Classe", desc: "Créez des classes (ex: 2nde A, 1ère Spé, Term Spé) depuis la barre latérale pour regrouper vos fiches." },
                { title: "2. Chapitres & Sous-groupes", desc: "Les fiches sont automatiquement triées par chapitre dans chaque classe pour une navigation rapide." },
                { title: "3. Recherche Instantanée", desc: "Filtrez en temps réel vos fiches par mots-clés, nom de chapitre ou classe grâce à la barre de recherche." },
                { title: "4. Import / Export JSON", desc: "Partagez facilement vos fiches avec d'autres professeurs au format JSON standard." }
            ]
        },
        editing: {
            heading: "Création de Fiches & Formules LaTeX",
            intro: "Combinez du texte explicatif enrichi et des formules mathématiques rigoureuses.",
            syntaxTitle: "Syntaxe de saisie LaTeX",
            syntaxDesc: "Entourez vos formules de $ ... $ pour du LaTeX en ligne ou $$ ... $$ pour des équations centrées.",
            examplesTitle: "Exemples de formules courantes",
            examples: [
                { label: "Fractions", code: "$$\\frac{a}{b}$$" },
                { label: "Racines", code: "$$\\sqrt{x^2 + 1}$$" },
                { label: "Intégrales", code: "$$\\int_0^1 x\\,dx$$" },
                { label: "Systèmes", code: "$$\\begin{cases} x+y=3 \\\\ 2x-y=0 \\end{cases}$$" }
            ],
            blanksTitle: "Exercices à trous & Guidage",
            blanksDesc: "Intégrez des zones de réponses masquées que l'élève ou l'enseignant peut révéler d'un simple clic."
        },
        canvas: {
            heading: "Tableau Manuscrit & Stylet Numérique",
            intro: "Un tableau d'écriture haute performance optimisé pour la prise de note et les corrections.",
            cards: [
                { title: "Courbe de Pression", desc: "Trois modes de réglage du stylet : Souple, Équilibré ou Ferme selon votre matériel." },
                { title: "Stabilisation de l'encre", desc: "Lissage des traits de 0% à 100% pour une écriture manuscrite propre et lisible." },
                { title: "Gomme Intelligente", desc: "Effacement par trait complet ou par zone géométrique précise." },
                { title: "Mode Plein Écran", desc: "Maximisez la surface de dessin pour les démonstrations complexes au tableau." }
            ]
        },
        presentation: {
            heading: "Projection Beamer & Impression PDF",
            intro: "Présentez vos fiches en classe ou exportez-les pour vos supports papier.",
            beamerTitle: "Mode Projection Interactive (Beamer)",
            beamerDesc: "Affichez l'exercice sur grand écran et révélez la solution étape par étape en utilisant les flèches du clavier ou la télécommande.",
            pdfTitle: "Impression & Exportation PDF",
            pdfDesc: "Générez des documents prêts à imprimer avec des zones de réponses quadrillées (Seya, carreaux) ou blanches selon vos besoins."
        },
        sync: {
            heading: "Synchronisation & Mode Hors-Ligne",
            intro: "Travaillez partout, en classe ou à la maison, sans dépendre d'une connexion Internet.",
            pwaTitle: "Application PWA (Hors-ligne)",
            pwaDesc: "Vos fiches sont enregistrées directement dans votre navigateur. L'application reste utilisable à 100% même hors-ligne.",
            syncTitle: "Appairage PC / Tablette",
            syncDesc: "Connectez votre ordinateur et votre tablette sur le même réseau local à l'aide d'un simple code à 6 chiffres ou QR Code."
        }
    },
    en: {
        title: "Help Center & Guide",
        subtitle: "Interactive Maths v1.0",
        author: "Created by Boudouh Abdelmalek",
        authorArabic: "بدوح عبدالمالك",
        close: "Close Guide",
        searchPlaceholder: "Search help...",
        languages: { fr: "Français", en: "English", ar: "العربية" },
        tabs: {
            overview: { label: "Overview", desc: "Getting started & core features" },
            classes: { label: "Classes & Tree", desc: "Dashboard & folder organization" },
            editing: { label: "Editor & LaTeX", desc: "Worksheet creation & math syntax" },
            canvas: { label: "Canvas & Stylus", desc: "Ink engine & digital whiteboard" },
            presentation: { label: "Projection & PDF", desc: "Beamer mode & printing options" },
            sync: { label: "Sync & Offline", desc: "PWA & local network sync" },
        },
        overview: {
            badge: "Interactive Guide",
            heading: "Welcome to Interactive Maths",
            intro: "Interactive Maths is your all-in-one mathematical workspace tailored for creating, teaching, and solving interactive exercise worksheets.",
            forWhoTitle: "Who is this app for?",
            teachers: {
                title: "Math Teachers",
                desc: "Write worksheets in LaTeX, project step-by-step solutions in Beamer mode, and live-annotate during class."
            },
            students: {
                title: "Students",
                desc: "Solve worksheets directly on tablets using handwriting input, view guided steps, and review offline."
            },
            keyFeaturesTitle: "Key Highlights",
            features: [
                { title: "LaTeX & MathJax Rendering", desc: "Instant high-precision mathematical rendering." },
                { title: "Touch Annotation Canvas", desc: "Smooth digital ink with pressure sensitivity control." },
                { title: "Beamer Projection Mode", desc: "Step-by-step solution and hint reveal for classrooms." },
                { title: "100% Offline Capable", desc: "Autonomous PWA with local PC/Tablet sync." }
            ]
        },
        classes: {
            heading: "Dashboard Management & Tree Structure",
            intro: "Organize all your courses and exercise worksheets with a clean hierarchical tree.",
            cards: [
                { title: "1. Class Hierarchy", desc: "Create classes in the sidebar to group worksheets systematically." },
                { title: "2. Chapter Sorting", desc: "Worksheets are automatically sorted by chapter within each class." },
                { title: "3. Instant Search", desc: "Filter worksheets in real time by keywords, chapter, or class name." },
                { title: "4. JSON Import / Export", desc: "Share worksheets easily with colleagues using standard JSON files." }
            ]
        },
        editing: {
            heading: "Worksheet Creation & LaTeX Syntax",
            intro: "Combine rich explanatory text with rigorous mathematical formulas.",
            syntaxTitle: "LaTeX Input Syntax",
            syntaxDesc: "Wrap inline formulas with $ ... $ and block equations with $$ ... $$.",
            examplesTitle: "Common Formula Examples",
            examples: [
                { label: "Fractions", code: "$$\\frac{a}{b}$$" },
                { label: "Roots", code: "$$\\sqrt{x^2 + 1}$$" },
                { label: "Integrals", code: "$$\\int_0^1 x\\,dx$$" },
                { label: "Systems", code: "$$\\begin{cases} x+y=3 \\\\ 2x-y=0 \\end{cases}$$" }
            ],
            blanksTitle: "Fill-in-the-blanks & Guidance",
            blanksDesc: "Include hidden answer steps that students or teachers can reveal with a single tap."
        },
        canvas: {
            heading: "Handwriting Canvas & Stylus Engine",
            intro: "A high-performance digital whiteboard optimized for stylus notes and corrections.",
            cards: [
                { title: "Pressure Sensitivity", desc: "Three stylus response modes: Soft, Balanced, or Firm." },
                { title: "Ink Stabilization", desc: "Stroke smoothing from 0% to 100% for clean handwriting." },
                { title: "Smart Eraser", desc: "Erase by stroke or by geometric area." },
                { title: "Full Screen Mode", desc: "Maximize drawing surface for complex blackboard demonstrations." }
            ]
        },
        presentation: {
            heading: "Beamer Projection & PDF Export",
            intro: "Present worksheets live in class or export clean printable PDFs.",
            beamerTitle: "Interactive Beamer Mode",
            beamerDesc: "Project exercises on screen and reveal solutions step-by-step using keyboard arrows.",
            pdfTitle: "Print & PDF Export",
            pdfDesc: "Generate ready-to-print documents with grid answer spaces (Seya, squared, or blank)."
        },
        sync: {
            heading: "Sync & Offline Mode",
            intro: "Work seamlessly anywhere without relying on an internet connection.",
            pwaTitle: "PWA Offline Mode",
            pwaDesc: "All worksheets are saved in browser local storage. Fully usable offline.",
            syncTitle: "PC / Tablet Pairing",
            syncDesc: "Connect your PC and tablet over the local Wi-Fi network using a 6-digit code or QR code."
        }
    },
    ar: {
        title: "دليل المستخدم ومركز المساعدة",
        subtitle: "Interactive Maths v1.0",
        author: "أنشئ بواسطة بدوح عبدالمالك",
        authorArabic: "بدوح عبدالمالك",
        close: "إغلاق الدليل",
        searchPlaceholder: "البحث في الدليل...",
        languages: { fr: "Français", en: "English", ar: "العربية" },
        tabs: {
            overview: { label: "مقدمة ودليل سريع", desc: "البدء والمميزات الأساسية" },
            classes: { label: "الفصول والأبواب", desc: "تنظيم لوحة التحكم" },
            editing: { label: "المحرر وLaTeX", desc: "إنشاء أوراق العمل والصيغ" },
            canvas: { label: "السبورة والقلم", desc: "محرك الحبر وتدوين الملاحظات" },
            presentation: { label: "العرض والطباعة", desc: "وضع Beamer وتصدير PDF" },
            sync: { label: "المزامنة بدون إنترنت", desc: "تطبيق PWA والشبكة المحلية" },
        },
        overview: {
            badge: "دليل تفاعلي",
            heading: "مرحباً بك في Interactive Maths",
            intro: "Interactive Maths هي بيئة العمل الرياضية المتكاملة المصممة خصيصاً لإنشاء وعرض وحل أوراق التمارين التفاعلية.",
            forWhoTitle: "لمن صُمم هذا التطبيق؟",
            teachers: {
                title: "معلمو الرياضيات",
                desc: "كتابة أوراق العمل بـ LaTeX، عرض الحلول خطوة بخطوة في وضع Beamer، وتدوين الملاحظات مباشرة أثناء الشرح."
            },
            students: {
                title: "الطلاب والمتعلمين",
                desc: "مراجعة وحل أوراق التمارين مباشرة على الأجهزة اللوحية باستخدام الكتابة اليدوية والانتقال التدريجي."
            },
            keyFeaturesTitle: "أبرز مميزات المنصة",
            features: [
                { title: "عرض LaTeX وMathJax", desc: "عرض فوري وعالي الدقة للمعادلات الرياضية." },
                { title: "سبورة كتابة تفاعلية", desc: "حبر رقمي انسيابي مع التحكم في حساسية ضغط القلم." },
                { title: "وضع العرض Beamer", desc: "كشف تدريجي للخطوات والإرشادات في الفصل." },
                { title: "عمل كامل بدون إنترنت", desc: "تطبيق PWA مستقل مع مزامنة محلية بين الكمبيوتر والتابلت." }
            ]
        },
        classes: {
            heading: "إدارة لوحة التحكم وشجرة الفصول",
            intro: "نظّم أوراق التمارين والدروس ضمن هيكلية شجرية واضحة ومباشرة.",
            cards: [
                { title: "١. التنظيم حسب الفصل", desc: "أنشئ الفصول الدراسية في الشريط الجانبي لتجميع أوراق العمل." },
                { title: "٢. التصنيف حسب الأبواب", desc: "تُصنف أوراق العمل تلقائياً حسب الفصل والباب لسهولة الوصول." },
                { title: "٣. البحث الفوري", desc: "فلترة فوريّة لأوراق العمل حسب الكلمات المفتاحية أو اسم الباب." },
                { title: "٤. استيراد/تصدير JSON", desc: "مشاركة أوراق العمل بسهولة مع زملائك بصيغة JSON." }
            ]
        },
        editing: {
            heading: "إنشاء أوراق العمل وصيغ LaTeX",
            intro: "دمج النص الشارح مع المعادلات الرياضية الدقيقة.",
            syntaxTitle: "صيغة كتابة LaTeX",
            syntaxDesc: "ضع المعادلة بين $ ... $ للمعادلات المدمجة في النص، أو $$ ... $$ للمعادلات المستقلة.",
            examplesTitle: "أمثلة شائعة للصيغ",
            examples: [
                { label: "الكسور", code: "$$\\frac{a}{b}$$" },
                { label: "الجذور", code: "$$\\sqrt{x^2 + 1}$$" },
                { label: "التكاملات", code: "$$\\int_0^1 x\\,dx$$" },
                { label: "الأنظمة", code: "$$\\begin{cases} x+y=3 \\\\ 2x-y=0 \\end{cases}$$" }
            ],
            blanksTitle: "النصوص المفرغة والتوجيه",
            blanksDesc: "إضافة مساحات إجابة مخفية يمكن للمعلم أو الطالب كشفها بنقرة واحدة."
        },
        canvas: {
            heading: "السبورة الرقمية والقلم",
            intro: "سبورة رقمية فائقة الاستجابة مخصصة للشرح والتصحيح بالقلم.",
            cards: [
                { title: "حساسية ضغط القلم", desc: "ثلاثة أوضاع لتعديل القلم: مرن، متوازن، أو صلب حسب نوع الجهاز." },
                { title: "تنعيم وتثبيت الحبر", desc: "تنعيم خطوط الكتابة من ٠٪ إلى ١٠٠٪ لخط واضح ومقروء." },
                { title: "الممحاة الذكية", desc: "مسح الخطوط بالكامل أو مسح المساحات المحددة." },
                { title: "وضع الشاشة الكاملة", desc: "توسيع مساحة الرسم والشرح للتمارين المعقدة." }
            ]
        },
        presentation: {
            heading: "عرض Beamer وتصدير PDF",
            intro: "اعرض الدروس في الفصل أو قم بتصديرها للطباعة على الورق.",
            beamerTitle: "وضع العرض التفاعلي (Beamer)",
            beamerDesc: "عرض التمارين على الشاشة وكشف الحلول خطوة بخطوة باستخدام أسهم لوحة المفاتيح.",
            pdfTitle: "الطباعة والتصدير إلى PDF",
            pdfDesc: "إنشاء مستندات جاهزة للطباعة مع مساحات إجابة مسطرة أو بيضاء."
        },
        sync: {
            heading: "المزامنة والعمل بدون إنترنت",
            intro: "اعمل من أي مكان، في الفصل أو المنزل، دون الحاجة للاتصال بالإنترنت.",
            pwaTitle: "تطبيق PWA أوفلاين",
            pwaDesc: "تُحفظ أوراق العمل في ذاكرة المتصفح المحلية. التطبيق يعمل ١٠٠٪ بدون إنترنت.",
            syncTitle: "اقتران الكمبيوتر والتابلت",
            syncDesc: "ربط الكمبيوتر والتابلت على نفس شبكة Wi-Fi المحلية عبر رمز مكون من ٦ أرقام أو رمز QR."
        }
    }
};

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const [language, setLanguage] = useState<Language>('fr');
    const [activeTab, setActiveTab] = useState<HelpTab>('overview');

    if (!isOpen) return null;

    const t = translations[language];
    const isRtl = language === 'ar';

    const tabIcons: Record<HelpTab, React.ReactNode> = {
        overview: <Sparkles className="h-4 w-4" />,
        classes: <Folder className="h-4 w-4" />,
        editing: <Edit3 className="h-4 w-4" />,
        canvas: <PenTool className="h-4 w-4" />,
        presentation: <Tv className="h-4 w-4" />,
        sync: <RefreshCw className="h-4 w-4" />
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-md animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className={`relative flex h-[88vh] max-h-[760px] w-full max-w-5xl overflow-hidden rounded-3xl bg-[#fffefa] shadow-2xl border border-[#dce4d5] transition-all ${isRtl ? 'font-sans' : ''}`}
                dir={isRtl ? 'rtl' : 'ltr'}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── VERTICAL SIDEBAR ── */}
                <aside className="w-64 sm:w-72 shrink-0 flex flex-col bg-[#f5f3ec] border-r border-[#e3ebd8] dark:border-none p-4 select-none">
                    {/* Header with App Logo & Title */}
                    <div className="flex items-center gap-3 px-2 py-2 mb-4 border-b border-[#e3ebd8] pb-4">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#19788c] text-white shadow-md">
                            <HelpCircle className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-serif text-base font-bold text-[#172126] truncate">{t.title}</h2>
                            <span className="text-[11px] font-semibold text-[#19788c] bg-[#19788c]/10 px-2 py-0.5 rounded-full inline-block">
                                {t.subtitle}
                            </span>
                        </div>
                    </div>

                    {/* Language Selector Selector Tabs */}
                    <div className="mb-4 bg-[#eae7dc] p-1 rounded-xl flex items-center justify-between border border-[#dddad0]">
                        {(['fr', 'en', 'ar'] as Language[]).map((lang) => (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => setLanguage(lang)}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                    language === lang 
                                        ? 'bg-[#19788c] text-white shadow-sm' 
                                        : 'text-[#5d6b6e] hover:text-[#172126]'
                                }`}
                            >
                                {t.languages[lang]}
                            </button>
                        ))}
                    </div>

                    {/* Vertical Navigation Links */}
                    <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                        {(Object.keys(t.tabs) as HelpTab[]).map((key) => {
                            const tabInfo = t.tabs[key];
                            const isActive = activeTab === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setActiveTab(key)}
                                    className={`w-full flex items-start gap-3 p-2.5 rounded-2xl text-left transition-all ${
                                        isActive 
                                            ? 'bg-white text-[#19788c] shadow-sm border border-[#d6e3df] font-bold' 
                                            : 'text-[#4e5b5f] hover:bg-white/60 hover:text-[#172126]'
                                    }`}
                                >
                                    <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl transition-colors ${
                                        isActive ? 'bg-[#19788c] text-white' : 'bg-[#e2dfd4] text-[#5d6b6e]'
                                    }`}>
                                        {tabIcons[key]}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold leading-tight">{tabInfo.label}</div>
                                        <div className="text-[10px] text-[#78878b] line-clamp-1 mt-0.5">{tabInfo.desc}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Bottom Status Box & Creator Credit */}
                    <div className="mt-4 space-y-2">
                        <div className="rounded-2xl bg-[#e6f0ee] p-2.5 border border-[#cbe0dc] flex items-center gap-2 text-xs text-[#19788c]">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-[#19788c]" />
                            <span className="text-[11px] font-semibold leading-tight">PWA Ready · Functioning offline</span>
                        </div>
                        <div className="rounded-2xl bg-[#f0eee4] p-2.5 border border-[#dfdbcd] text-center shadow-2xs">
                            <div className="text-[11px] font-bold text-[#172126] flex items-center justify-center gap-1">
                                <GraduationCap className="h-3.5 w-3.5 text-[#19788c]" />
                                <span>{t.author}</span>
                            </div>
                            <div className="text-[11px] font-bold text-[#19788c] mt-0.5" dir="rtl">
                                {t.authorArabic}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* ── MAIN CONTENT PANE ── */}
                <main className="flex-1 flex flex-col min-w-0 bg-[#fffefa]">
                    {/* Top Bar with Close button */}
                    <div className="flex items-center justify-between border-b border-[#e8ece7] px-6 py-3.5 bg-[#fcfbf7]">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#697478]">
                            <span>{t.title}</span>
                            <span>/</span>
                            <span className="text-[#19788c]">{t.tabs[activeTab].label}</span>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center gap-1.5 rounded-xl bg-[#f2f0e8] px-3 py-1.5 text-xs font-bold text-[#526065] hover:bg-red-50 hover:text-red-600 transition"
                        >
                            <span>{t.close}</span>
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Scrollable Main Section Content */}
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-fadeIn">
                                {/* Hero Intro Card */}
                                <div className="rounded-3xl bg-gradient-to-br from-[#eef6f5] to-[#f4f8f2] p-6 border border-[#cbe4e3] relative overflow-hidden">
                                    <span className="inline-block rounded-full bg-[#19788c] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white mb-2">
                                        {t.overview.badge}
                                    </span>
                                    <h3 className="font-serif text-2xl font-bold text-[#172126] mb-2">{t.overview.heading}</h3>
                                    <p className="text-sm leading-relaxed text-[#3d4c51] max-w-2xl">{t.overview.intro}</p>
                                </div>

                                {/* Author / Creator Card */}
                                <div className="rounded-2xl bg-gradient-to-r from-[#f7f5ed] to-[#f0efe6] p-4 border border-[#e2ded0] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                                    <div className="flex items-center gap-3">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#19788c] text-white shadow-sm">
                                            <GraduationCap className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#19788c] block">Conception & Développement</span>
                                            <span className="text-sm font-bold text-[#172126]">{t.author}</span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-[#19788c] bg-white px-3 py-1 rounded-xl shadow-2xs border border-[#d8e3e1]" dir="rtl">
                                        {t.authorArabic}
                                    </span>
                                </div>

                                {/* Target Audience */}
                                <div>
                                    <h4 className="font-serif text-base font-bold text-[#172126] mb-3 flex items-center gap-2">
                                        <GraduationCap className="h-5 w-5 text-[#19788c]" />
                                        {t.overview.forWhoTitle}
                                    </h4>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="rounded-2xl bg-[#faf9f5] p-4 border border-[#e8ece7] shadow-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="h-2 w-2 rounded-full bg-[#19788c]" />
                                                <h5 className="font-bold text-[#19788c] text-sm">{t.overview.teachers.title}</h5>
                                            </div>
                                            <p className="text-xs text-[#526065] leading-relaxed">{t.overview.teachers.desc}</p>
                                        </div>
                                        <div className="rounded-2xl bg-[#faf9f5] p-4 border border-[#e8ece7] shadow-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="h-2 w-2 rounded-full bg-[#81983f]" />
                                                <h5 className="font-bold text-[#81983f] text-sm">{t.overview.students.title}</h5>
                                            </div>
                                            <p className="text-xs text-[#526065] leading-relaxed">{t.overview.students.desc}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Features Grid */}
                                <div>
                                    <h4 className="font-serif text-base font-bold text-[#172126] mb-3 flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-[#81983f]" />
                                        {t.overview.keyFeaturesTitle}
                                    </h4>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {t.overview.features.map((feat, idx) => (
                                            <div key={idx} className="flex items-start gap-3 rounded-2xl bg-[#f8f7f2] p-3.5 border border-[#e5ebd9]">
                                                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#81983f] mt-0.5" />
                                                <div>
                                                    <h6 className="font-bold text-xs text-[#172126]">{feat.title}</h6>
                                                    <p className="text-[11px] text-[#697478] mt-0.5">{feat.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'classes' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div>
                                    <h3 className="font-serif text-xl font-bold text-[#172126] mb-1">{t.classes.heading}</h3>
                                    <p className="text-xs text-[#697478]">{t.classes.intro}</p>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    {t.classes.cards.map((card, idx) => (
                                        <div key={idx} className="rounded-2xl bg-[#faf9f5] p-4 border border-[#e8ece7] shadow-sm flex flex-col justify-between">
                                            <div>
                                                <h4 className="font-bold text-sm text-[#19788c] mb-1.5">{card.title}</h4>
                                                <p className="text-xs text-[#526065] leading-relaxed">{card.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'editing' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div>
                                    <h3 className="font-serif text-xl font-bold text-[#172126] mb-1">{t.editing.heading}</h3>
                                    <p className="text-xs text-[#697478]">{t.editing.intro}</p>
                                </div>

                                <div className="rounded-2xl bg-[#eef6f5] p-4 border border-[#cbe4e3]">
                                    <h4 className="font-bold text-sm text-[#19788c] mb-1">{t.editing.syntaxTitle}</h4>
                                    <p className="text-xs text-[#3d4c51]">{t.editing.syntaxDesc}</p>
                                </div>

                                <div>
                                    <h4 className="font-serif text-base font-bold text-[#172126] mb-3 flex items-center gap-2">
                                        <Code2 className="h-5 w-5 text-[#19788c]" />
                                        {t.editing.examplesTitle}
                                    </h4>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {t.editing.examples.map((ex, idx) => (
                                            <div key={idx} className="rounded-2xl bg-[#f8f7f2] p-3.5 border border-[#e5ebd9] space-y-1.5">
                                                <span className="text-[11px] font-bold text-[#697478] uppercase">{ex.label}</span>
                                                <div className="rounded-xl bg-white p-2.5 text-xs font-mono border border-[#dce3d5] text-[#19788c] dir-ltr text-left">
                                                    {ex.code}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-[#f5f8f2] p-4 border border-[#e0ebd0]">
                                    <h4 className="font-bold text-sm text-[#81983f] mb-1">{t.editing.blanksTitle}</h4>
                                    <p className="text-xs text-[#3d4c51] leading-relaxed">{t.editing.blanksDesc}</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'canvas' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div>
                                    <h3 className="font-serif text-xl font-bold text-[#172126] mb-1">{t.canvas.heading}</h3>
                                    <p className="text-xs text-[#697478]">{t.canvas.intro}</p>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    {t.canvas.cards.map((card, idx) => (
                                        <div key={idx} className="rounded-2xl bg-[#faf9f5] p-4 border border-[#e8ece7] shadow-sm">
                                            <h4 className="font-bold text-sm text-[#19788c] mb-1.5">{card.title}</h4>
                                            <p className="text-xs text-[#526065] leading-relaxed">{card.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'presentation' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div>
                                    <h3 className="font-serif text-xl font-bold text-[#172126] mb-1">{t.presentation.heading}</h3>
                                    <p className="text-xs text-[#697478]">{t.presentation.intro}</p>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="rounded-2xl bg-[#eef6f5] p-5 border border-[#cbe4e3]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Tv className="h-5 w-5 text-[#19788c]" />
                                            <h4 className="font-bold text-sm text-[#19788c]">{t.presentation.beamerTitle}</h4>
                                        </div>
                                        <p className="text-xs text-[#3d4c51] leading-relaxed">{t.presentation.beamerDesc}</p>
                                    </div>

                                    <div className="rounded-2xl bg-[#f5f8f2] p-5 border border-[#e0ebd0]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="h-5 w-5 text-[#81983f]" />
                                            <h4 className="font-bold text-sm text-[#81983f]">{t.presentation.pdfTitle}</h4>
                                        </div>
                                        <p className="text-xs text-[#3d4c51] leading-relaxed">{t.presentation.pdfDesc}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'sync' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div>
                                    <h3 className="font-serif text-xl font-bold text-[#172126] mb-1">{t.sync.heading}</h3>
                                    <p className="text-xs text-[#697478]">{t.sync.intro}</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-[#f5f8f2] p-5 border border-[#e0ebd0]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldCheck className="h-5 w-5 text-[#81983f]" />
                                            <h4 className="font-bold text-sm text-[#81983f]">{t.sync.pwaTitle}</h4>
                                        </div>
                                        <p className="text-xs text-[#3d4c51] leading-relaxed">{t.sync.pwaDesc}</p>
                                    </div>

                                    <div className="rounded-2xl bg-[#eef6f5] p-5 border border-[#cbe4e3]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <RefreshCw className="h-5 w-5 text-[#19788c]" />
                                            <h4 className="font-bold text-sm text-[#19788c]">{t.sync.syncTitle}</h4>
                                        </div>
                                        <p className="text-xs text-[#3d4c51] leading-relaxed">{t.sync.syncDesc}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default HelpModal;
