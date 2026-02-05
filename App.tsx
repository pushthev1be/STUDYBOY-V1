
import React, { useState, useEffect } from 'react';
import { Upload, FileText, BrainCircuit, Layout, Loader2, AlertCircle, Sparkles, Trophy, Target, X, LogOut, Flame, Moon, BookOpen, Star, Award, Zap, Heart, Stethoscope } from 'lucide-react';
import { AppState, StudyMaterial, ViewMode, Achievement, StudyGoal, UserStats, User, ProcessingState } from './types';
import { processStudyContent, extendQuiz } from './services/geminiService';
import { SummaryView } from './components/SummaryView';
import { FlashcardView } from './components/FlashcardView';
import { QuizView } from './components/QuizView';
import { AchievementsView } from './components/AchievementsView';
import { AuthView } from './components/AuthView';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_upload', title: 'Quick Starter', description: 'Upload your first study document.', icon: 'Zap', unlocked: false, requirement: 1, currentValue: 0 },
  { id: 'quiz_master', title: 'Quiz Master', description: 'Complete 5 practice quizzes.', icon: 'Star', unlocked: false, requirement: 5, currentValue: 0 },
  { id: 'perfectionist', title: 'Perfectionist', description: 'Get 100% on any practice quiz.', icon: 'Award', unlocked: false, requirement: 1, currentValue: 0 },
  { id: 'reviewer', title: 'Diligent Student', description: 'Review 50 flashcards across your notes.', icon: 'BookOpen', unlocked: false, requirement: 50, currentValue: 0 },
  { id: 'power_user', title: 'Study Genius', description: 'Generate 10 different study materials.', icon: 'Cpu', unlocked: false, requirement: 10, currentValue: 0 },
  { id: 'night_owl', title: 'Night Owl', description: 'Study after midnight.', icon: 'Moon', unlocked: false, requirement: 1, currentValue: 0 },
  { id: 'on_fire', title: 'On Fire', description: 'Maintain a 3-day study streak.', icon: 'Flame', unlocked: false, requirement: 3, currentValue: 0 },
  { id: 'goal_getter', title: 'Goal Getter', description: 'Complete 10 daily goals.', icon: 'Target', unlocked: false, requirement: 10, currentValue: 0 },
];

const INITIAL_GOALS: StudyGoal[] = [
  { id: 'daily_quizzes', label: 'Complete 3 Quizzes', target: 3, current: 0 },
  { id: 'daily_cards', label: 'Review 20 Flashcards', target: 20, current: 0 },
];

const INITIAL_STATS: UserStats = {
  totalUploads: 0,
  totalQuizzesCompleted: 0,
  totalFlashcardsViewed: 0,
  perfectQuizzes: 0,
  streakDays: 0,
  lastActive: new Date().toISOString()
};

const LOADING_STEPS = [
  "Extracting text from document...",
  "Identifying clinical indicators...",
  "Synthesizing PANCE-style vignettes...",
  "Drafting diagnostic-choice questions...",
  "Refining medical explanations...",
  "Ready for Board Review!"
];

const MAX_CHAR_COUNT = 100000; // ~25,000 tokens, plenty for study notes
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState>(AppState.AUTH);
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isExtending, setIsExtending] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [processedChars, setProcessedChars] = useState(0);
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [goals, setGoals] = useState<StudyGoal[]>(INITIAL_GOALS);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  useEffect(() => {
    let interval: number;
    if (state === AppState.PROCESSING) {
      interval = window.setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    const savedUser = localStorage.getItem('sg_user');
    const savedStats = localStorage.getItem('sg_stats');
    const savedAchievements = localStorage.getItem('sg_achievements');
    const savedGoals = localStorage.getItem('sg_goals');

    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setState(AppState.IDLE);
    }
    if (savedStats) setStats(JSON.parse(savedStats));
    if (savedAchievements) setAchievements(JSON.parse(savedAchievements));
    if (savedGoals) {
      const g = JSON.parse(savedGoals);
      const lastActive = savedStats ? JSON.parse(savedStats).lastActive : null;
      if (lastActive && new Date(lastActive).toDateString() !== new Date().toDateString()) {
        setGoals(INITIAL_GOALS);
      } else {
        setGoals(g);
      }
    }
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem('sg_user', JSON.stringify(user));
    localStorage.setItem('sg_stats', JSON.stringify({ ...stats, lastActive: new Date().toISOString() }));
    localStorage.setItem('sg_achievements', JSON.stringify(achievements));
    localStorage.setItem('sg_goals', JSON.stringify(goals));
  }, [user, stats, achievements, goals]);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    
    // Process up to 50 pages for speed/safety
    const pageLimit = Math.min(pdf.numPages, 50);
    for (let i = 1; i <= pageLimit; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(" ") + "\n";
      if (fullText.length > MAX_CHAR_COUNT) break;
    }
    
    return fullText;
  };

  const triggerAchievement = (id: string) => {
    setAchievements(prev => prev.map(a => {
      if (a.id === id && !a.unlocked) {
        setShowNotification(`New Achievement: ${a.title}!`);
        setTimeout(() => setShowNotification(null), 5000);
        return { ...a, unlocked: true };
      }
      return a;
    }));
  };

  const updateProgress = (type: 'upload' | 'quiz' | 'flashcard', payload?: any) => {
    setStats(prev => {
      const newStats = { ...prev };
      const now = new Date();
      const last = new Date(prev.lastActive);
      if (now.toDateString() !== last.toDateString()) {
         const diffTime = Math.abs(now.getTime() - last.getTime());
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         if (diffDays === 1) newStats.streakDays += 1;
         else if (diffDays > 1) newStats.streakDays = 1;
      }

      if (newStats.streakDays >= 3) triggerAchievement('on_fire');
      const hours = now.getHours();
      if (hours >= 0 && hours < 5) triggerAchievement('night_owl');

      if (type === 'upload') {
        newStats.totalUploads += 1;
        if (newStats.totalUploads >= 1) triggerAchievement('first_upload');
        if (newStats.totalUploads >= 10) triggerAchievement('power_user');
      }
      if (type === 'quiz') {
        newStats.totalQuizzesCompleted += 1;
        if (payload?.perfect) newStats.perfectQuizzes += 1;
        if (newStats.totalQuizzesCompleted >= 5) triggerAchievement('quiz_master');
        if (payload?.perfect) triggerAchievement('perfectionist');
      }
      if (type === 'flashcard') {
        newStats.totalFlashcardsViewed += 1;
        if (newStats.totalFlashcardsViewed >= 50) triggerAchievement('reviewer');
      }
      return newStats;
    });

    setGoals(prev => prev.map(g => {
      let nextG = { ...g };
      if (type === 'quiz' && g.id === 'daily_quizzes') nextG.current += 1;
      if (type === 'flashcard' && g.id === 'daily_cards') nextG.current += 1;
      return nextG;
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("File is too large. Please upload a document smaller than 15MB.");
      setState(AppState.ERROR);
      return;
    }

    setState(AppState.PROCESSING);
    setErrorMessage('');
    setLoadingStep(0);

    try {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      let content = '';

      if (isImage) {
        content = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
      } else if (isPDF) {
        content = await extractTextFromPDF(file);
      } else {
        content = await file.text();
      }

      if (!content || content.trim().length < 20) {
        throw new Error("Could not extract enough text from the document. Please ensure it contains readable text.");
      }

      // Track content coverage: split when it exceeds limit
      let unprocessedContent = '';
      if (content.length > MAX_CHAR_COUNT) {
        unprocessedContent = content.substring(MAX_CHAR_COUNT);
        content = content.substring(0, MAX_CHAR_COUNT);
      }

      setProcessedChars(content.length);
      
      // Store processing state for later use
      setProcessingState({
        totalContent: content + unprocessedContent,
        processedContent: content,
        unprocessedContent,
        fileName: file.name
      });

      const result = await processStudyContent(content, isImage);
      const coveragePercent = unprocessedContent 
        ? Math.round((content.length / (content.length + unprocessedContent.length)) * 100)
        : 100;
      
      setMaterial({
        ...result,
        unprocessedContent,
        contentCoveragePercent: coveragePercent
      });
      setState(AppState.VIEWING);
      updateProgress('upload');
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Failed to process the document. Try a different format.");
      setState(AppState.ERROR);
    }
  };

  const handleKeepGoing = async () => {
    if (!material || isExtending) return;
    
    // If there's unprocessed content, generate from that
    if (material.unprocessedContent) {
      setIsExtending(true);
      try {
        const newMaterial = await processStudyContent(material.unprocessedContent, false);
        setMaterial({
          ...material,
          summary: material.summary + '\n\n[Continued from remaining content]\n' + newMaterial.summary,
          flashcards: [...material.flashcards, ...newMaterial.flashcards],
          quiz: [...material.quiz, ...newMaterial.quiz],
          unprocessedContent: '', // Marked as fully processed
          contentCoveragePercent: 100
        });
        setShowNotification('Generated content from remaining material!');
        setTimeout(() => setShowNotification(null), 5000);
      } catch (err) {
        console.error(err);
        setErrorMessage("Failed to generate more content. Try again.");
      } finally {
        setIsExtending(false);
      }
    } else {
      // Fallback: generate more questions from existing material
      setIsExtending(true);
      try {
        const newQuestions = await extendQuiz(material.title, material.quiz.length);
        if (newQuestions.length > 0) {
          setMaterial({
            ...material,
            quiz: [...material.quiz, ...newQuestions]
          });
          setShowNotification('Generated more practice questions!');
          setTimeout(() => setShowNotification(null), 5000);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsExtending(false);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sg_user');
    setUser(null);
    setState(AppState.AUTH);
  };

  if (state === AppState.AUTH) {
    return <AuthView onAuth={(u) => { setUser(u); setState(AppState.IDLE); }} />;
  }

  const renderContent = () => {
    if (viewMode === 'stats') return <AchievementsView achievements={achievements} goals={goals} stats={stats} />;
    if (!material) return null;

    switch (viewMode) {
      case 'summary': return <SummaryView summary={material.summary} title={material.title} contentCoveragePercent={material.contentCoveragePercent} hasUnprocessedContent={!!material.unprocessedContent} />;
      case 'flashcards': return <FlashcardView cards={material.flashcards} onCardViewed={() => updateProgress('flashcard')} />;
      case 'quiz': return <QuizView 
          questions={material.quiz} 
          onQuizComplete={(score, total) => updateProgress('quiz', { perfect: score === total })} 
          onKeepGoing={handleKeepGoing}
          isExtending={isExtending}
        />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] text-slate-900 flex flex-col">
      {showNotification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-down border border-slate-700">
          <div className="bg-amber-500 p-2 rounded-lg"><Trophy size={20} className="text-white" /></div>
          <span className="font-bold">{showNotification}</span>
          <button onClick={() => setShowNotification(null)} className="ml-2 hover:text-slate-400"><X size={16} /></button>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setState(AppState.IDLE); setViewMode('summary'); }}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><BrainCircuit className="text-white" size={28} /></div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">StudyGenius<span className="text-indigo-600">AI</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hi, {user?.username || 'Learner'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-tighter">
              <Zap size={14} fill="currentColor" /> Flash Engine Active
            </div>
            {state === AppState.VIEWING && (
              <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                {[
                  { id: 'summary', label: 'Summary', icon: FileText },
                  { id: 'flashcards', label: 'Flashcards', icon: Layout },
                  { id: 'quiz', label: 'Quiz', icon: Sparkles },
                  { id: 'stats', label: 'Progress', icon: Trophy }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as ViewMode)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      viewMode === mode.id ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                  >
                    <mode.icon size={18} /> {mode.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { if (state !== AppState.VIEWING) setState(AppState.VIEWING); setViewMode('stats'); }} className={`p-2.5 rounded-2xl transition-all ${viewMode === 'stats' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`} title="View Progress & Goals"><Trophy size={24} /></button>
            <button onClick={handleLogout} className="p-2.5 rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all" title="Log Out"><LogOut size={24} /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        {state === AppState.IDLE && (
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="mb-12">
              <h2 className="text-5xl font-extrabold text-slate-900 mb-6 leading-tight">Crush your rotations, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">{user?.username}</span></h2>
              <p className="text-xl text-slate-500 max-w-xl mx-auto leading-relaxed">PANCE prep optimized for large files. Upload clinical notes up to <span className="text-indigo-600 font-bold">15MB</span> and let us parse them.</p>
            </div>
            <div className="relative group">
              <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-slate-300 rounded-[3rem] bg-white hover:bg-slate-50 hover:border-indigo-400 transition-all cursor-pointer shadow-sm">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="bg-slate-100 p-6 rounded-full mb-6 group-hover:scale-110 group-hover:bg-indigo-50 transition-all duration-300"><Upload className="text-slate-400 group-hover:text-indigo-500" size={48} /></div>
                  <p className="mb-2 text-2xl font-bold text-slate-700">Drop your clinical notes here</p>
                  <p className="text-slate-400">PDF, Text, or Document Images (Max 15MB)</p>
                </div>
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.pdf,image/*" />
              </label>
            </div>
            <div className="mt-16 flex items-center justify-center gap-12">
               <div className="flex flex-col items-center"><div className="text-4xl font-extrabold text-indigo-600 mb-1">{stats.streakDays}</div><div className="text-slate-400 font-bold uppercase tracking-widest text-xs">Day Streak</div></div>
               <div className="w-px h-12 bg-slate-200"></div>
               <div className="flex flex-col items-center"><div className="text-4xl font-extrabold text-violet-600 mb-1">{stats.totalUploads}</div><div className="text-slate-400 font-bold uppercase tracking-widest text-xs">Documents</div></div>
               <div className="w-px h-12 bg-slate-200"></div>
               <div className="flex flex-col items-center"><div className="text-4xl font-extrabold text-emerald-600 mb-1">{stats.totalQuizzesCompleted}</div><div className="text-slate-400 font-bold uppercase tracking-widest text-xs">Practice Sets</div></div>
            </div>
          </div>
        )}

        {state === AppState.PROCESSING && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="bg-white p-12 rounded-[3rem] shadow-xl shadow-indigo-100/50 flex flex-col items-center border border-slate-100 max-w-md w-full">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping scale-150"></div>
                <div className="relative bg-white p-4 rounded-full border-2 border-indigo-600">
                  <Stethoscope className="text-indigo-600" size={48} />
                </div>
                <Sparkles className="absolute -top-1 -right-1 text-amber-400 animate-bounce" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4 text-center">Optimizing Content</h2>
              <div className="w-full space-y-4">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                   <div 
                    className="h-full bg-indigo-600 transition-all duration-[3000ms] ease-linear"
                    style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
                   />
                </div>
                <p className="text-indigo-600 text-sm font-bold text-center tracking-wide uppercase transition-all animate-pulse">
                  {LOADING_STEPS[loadingStep]}
                </p>
                <div className="flex justify-between items-center px-4 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Volume Parsed</span>
                  <span className="text-[10px] font-bold text-indigo-600">{processedChars > 0 ? `${(processedChars / 1024).toFixed(1)} KB` : 'Initializing...'}</span>
                </div>
                <p className="text-slate-400 text-center text-xs px-8 leading-relaxed">
                  Parsing high-volume clinical data. Large files are safely truncated to ensure maximum AI stability.
                </p>
              </div>
            </div>
          </div>
        )}

        {state === AppState.ERROR && (
          <div className="max-w-xl mx-auto bg-rose-50 border border-rose-100 p-10 rounded-[2rem] text-center">
            <div className="bg-rose-100 text-rose-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32} /></div>
            <h2 className="text-2xl font-bold text-rose-800 mb-4">Upload Error</h2>
            <p className="text-rose-600 mb-8">{errorMessage}</p>
            <button onClick={() => setState(AppState.IDLE)} className="px-10 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-colors">Return to Home</button>
          </div>
        )}

        {state === AppState.VIEWING && <div className="animate-fade-in"><div className="mb-8">{renderContent()}</div></div>}
      </main>

      <footer className="bg-transparent py-8 mt-auto border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
              Support this project with a <Heart size={12} className="text-indigo-500 fill-indigo-500" /> 
            </p>
            <div className="bg-white/50 border border-slate-200 px-4 py-1.5 rounded-full flex items-center gap-3">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Zelle</span>
              <span className="text-slate-700 font-bold text-sm">3175310381</span>
            </div>
            <p className="text-[10px] text-slate-300 uppercase tracking-widest mt-2">StudyGenius AI © 2024</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
