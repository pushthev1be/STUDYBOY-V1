
import React, { useState, useMemo, useEffect } from 'react';
import { QuizQuestion, QuestionStatus, QuizSession, SavedUpload, StudyDomain } from '../types';
import {
  CheckCircle2,
  XCircle,
  Flag,
  RotateCcw,
  Award,
  Check,
  Sparkles,
  PlusCircle,
  Loader2,
  Stethoscope,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SessionList } from './SessionList';
import { generateWrongAnswerFeedback } from '../services/geminiService';

interface QuizViewProps {
  questions: QuizQuestion[];
  domain?: StudyDomain;
  onQuizComplete?: (score: number, total: number, questions: QuizQuestion[], questionStates: QuestionStatus[]) => void;
  onKeepGoing?: () => Promise<void>;
  onQuestionFailed?: () => Promise<void>;
  isExtending?: boolean;
  pastSessions?: QuizSession[];
  savedUploads?: SavedUpload[];
  onReattemptSession?: (session: QuizSession) => void;
  onOpenUpload?: (upload: SavedUpload) => void;
  onRegenerateQuiz?: (upload: SavedUpload) => void;
  resetKey?: string;
}

export const QuizView: React.FC<QuizViewProps> = ({
  questions,
  domain = 'PA',
  onQuizComplete,
  onKeepGoing,
  onQuestionFailed,
  isExtending = false,
  pastSessions = [],
  savedUploads = [],
  onReattemptSession,
  onOpenUpload,
  onRegenerateQuiz,
  resetKey,
}) => {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const [sessionStates, setSessionStates] = useState<QuestionStatus[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const quizCopy = useMemo(() => {
    switch (domain) {
      case 'Nursing':
        return {
          title: 'Clinical Scenarios',
          subtitle: 'NCLEX-style practice questions',
          extendAction: 'Extend Practice Set',
          loadingTitle: 'Generating more practice scenarios...',
          loadingSubtitle: 'Creating new nursing judgment questions',
          requestMore: 'Request More Questions',
          finish: 'Finish Practice Review',
          restart: 'Restart Practice Review',
          roundSubtitle: 'Practice judgment improves with repetition.',
          scoreLabel: 'Score',
          correctLabel: 'Questions Correct',
          insightLabel: 'Key Takeaway'
        };
      case 'Medical':
        return {
          title: 'Clinical Reasoning',
          subtitle: 'Application-focused medical questions',
          extendAction: 'Extend Practice Set',
          loadingTitle: 'Generating more practice questions...',
          loadingSubtitle: 'Creating new mechanism and application questions',
          requestMore: 'Request More Questions',
          finish: 'Finish Review',
          restart: 'Restart Review',
          roundSubtitle: 'Strong reasoning comes from repeated retrieval.',
          scoreLabel: 'Score',
          correctLabel: 'Questions Correct',
          insightLabel: 'Key Takeaway'
        };
      case 'GenEd':
        return {
          title: 'Practice Questions',
          subtitle: 'Concept and application review',
          extendAction: 'Load More Questions',
          loadingTitle: 'Generating more practice questions...',
          loadingSubtitle: 'Creating new concept checks and applied examples',
          requestMore: 'Request More Questions',
          finish: 'Finish Practice',
          restart: 'Restart Practice',
          roundSubtitle: 'Keep building understanding one round at a time.',
          scoreLabel: 'Score',
          correctLabel: 'Questions Correct',
          insightLabel: 'Key Takeaway'
        };
      case 'PA':
      default:
        return {
          title: 'Clinical Vignettes',
          subtitle: 'Board-style practice questions',
          extendAction: 'Extend Case Study',
          loadingTitle: 'Generating more clinical cases...',
          loadingSubtitle: 'Creating challenging board-style questions',
          requestMore: 'Request More Cases',
          finish: 'Finish Board Review',
          restart: 'Restart Board Review',
          roundSubtitle: 'PANCE prep takes persistence.',
          scoreLabel: 'Diagnostic Score',
          correctLabel: 'Cases Correct',
          insightLabel: 'Clinical Pearl'
        };
    }
  }, [domain]);
  
  // Create a stable quiz ID based on the questions to track progress
  const quizId = React.useMemo(() => {
    if (safeQuestions.length === 0) return null;
    // Use first and last question text as a simple hash to identify this quiz
    return `quiz_${safeQuestions.length}_${safeQuestions[0]?.question.substring(0, 20)}`;
  }, [safeQuestions.length]);

  // Initialize and sync states when questions array grows
  useEffect(() => {
    // Clear any previously saved state for different quizzes
    const allKeys = Object.keys(sessionStorage);
    allKeys.forEach(key => {
      if (key.startsWith('quiz_') && key !== quizId) {
        sessionStorage.removeItem(key);
      }
    });
    
    // Try to restore from session storage first
    if (quizId) {
      const savedStates = sessionStorage.getItem(quizId);
      if (savedStates) {
        try {
          const restored = JSON.parse(savedStates);
          if (Array.isArray(restored) && restored.length === safeQuestions.length) {
            setSessionStates(restored);
            return;
          }
        } catch (e) {
          console.warn("Could not restore quiz progress:", e);
        }
      }
    }
    
    // If no saved state, initialize new states
    setSessionStates(prev => {
      const newStates = [...prev];
      for (let i = prev.length; i < safeQuestions.length; i++) {
        newStates.push({
          id: i,
          isAnswered: false,
          isCorrect: null,
          selectedOption: null,
          isFlagged: false,
          showExplanation: false,
        });
      }
      return newStates;
    });
  }, [safeQuestions.length, quizId, resetKey]);

  // Save quiz progress whenever it changes
  useEffect(() => {
    if (quizId && sessionStates.length > 0) {
      sessionStorage.setItem(quizId, JSON.stringify(sessionStates));
    }
  }, [sessionStates, quizId]);

  const stats = useMemo(() => {
    const answered = sessionStates.filter(s => s.isAnswered).length;
    const correct = sessionStates.filter(s => s.isCorrect === true).length;
    const flagged = sessionStates.filter(s => s.isFlagged).length;
    return { answered, correct, flagged, total: safeQuestions.length };
  }, [sessionStates, safeQuestions.length]);

  const getUploadForSession = (session: QuizSession) => {
    if (!session.uploadId) return undefined;
    return savedUploads.find(upload => upload.id === session.uploadId);
  };

  const handleDownloadUpload = (upload: SavedUpload | undefined, session: QuizSession) => {
    if (!upload) return;
    if (upload.sourceType === 'image' && upload.sourceDataUrl) {
      const link = document.createElement('a');
      link.href = upload.sourceDataUrl;
      link.download = upload.fileName || `${session.topic}.png`;
      link.click();
      return;
    }
    if (upload.sourceText) {
      const baseName = upload.fileName ? upload.fileName.replace(/\.[^/.]+$/, '') : session.topic;
      const fileName = `${baseName}.txt`;
      const blob = new Blob([upload.sourceText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleOptionSelect = (qIdx: number, optionIndex: number) => {
    if (isSubmitted) return;

    const newStates = [...sessionStates];
    const isCorrect = optionIndex === safeQuestions[qIdx].correctAnswer;

    newStates[qIdx] = {
      ...newStates[qIdx],
      selectedOption: optionIndex,
      isAnswered: true,
      isCorrect: isCorrect,
      showExplanation: true
    };
    setSessionStates(newStates);

    // Generate targeted feedback for wrong answers
    if (!isCorrect) {
      const question = safeQuestions[qIdx];
      const selectedAnswer = question.options[optionIndex];
      const correctAnswer = question.options[question.correctAnswer];
      
      generateWrongAnswerFeedback(
        question.question,
        selectedAnswer,
        correctAnswer,
        question.options,
        question.explanation,
        domain
      ).then(feedback => {
        // Update the state with custom explanation
        setSessionStates(prevStates => {
          const updated = [...prevStates];
          updated[qIdx] = {
            ...updated[qIdx],
            customExplanation: feedback
          };
          return updated;
        });
      });
    }

    // Trigger auto-generate 2 more questions on failure
    if (!isCorrect && onQuestionFailed) {
      onQuestionFailed();
    }
  };

  const toggleFlag = (qIdx: number) => {
    const newStates = [...sessionStates];
    newStates[qIdx] = { ...newStates[qIdx], isFlagged: !newStates[qIdx].isFlagged };
    setSessionStates(newStates);
  };

  const finalizeSession = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsSubmitted(true);
    // Clear saved progress after quiz is submitted
    if (quizId) {
      sessionStorage.removeItem(quizId);
    }
    if (onQuizComplete) {
      const finalizedStates = sessionStates.map(state => ({ ...state, showExplanation: true }));
      onQuizComplete(stats.correct, stats.total, safeQuestions, finalizedStates);
    }
  };

  const restartSession = () => {
    const resetStates = safeQuestions.map((_, i) => ({
      id: i,
      isAnswered: false,
      isCorrect: null,
      selectedOption: null,
      isFlagged: false,
      showExplanation: false,
    }));
    setSessionStates(resetStates);
    setIsSubmitted(false);
    // Save the reset state
    if (quizId) {
      sessionStorage.setItem(quizId, JSON.stringify(resetStates));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isSubmitted) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in mb-20">
        <div className="bg-indigo-600 p-12 text-center text-white">
          <Award className="mx-auto mb-6 opacity-80" size={64} />
          <h2 className="text-4xl font-bold mb-2">Round Complete</h2>
          <p className="text-indigo-100 text-lg">{quizCopy.roundSubtitle}</p>
        </div>
        <div className="p-12">
          <div className="grid grid-cols-3 gap-8 mb-12">
            <div className="text-center p-6 bg-slate-50 rounded-2xl">
              <div className="text-3xl font-bold text-slate-800">{stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%</div>
              <div className="text-sm text-slate-500 font-medium">{quizCopy.scoreLabel}</div>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-2xl">
              <div className="text-3xl font-bold text-slate-800">{stats.correct}/{stats.total}</div>
              <div className="text-sm text-slate-500 font-medium">{quizCopy.correctLabel}</div>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-2xl">
              <div className="text-3xl font-bold text-slate-800">{stats.flagged}</div>
              <div className="text-sm text-slate-500 font-medium">Review Later</div>
            </div>
          </div>
          <button
            onClick={restartSession}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw size={20} /> {quizCopy.restart}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-32">
      <div className="flex items-center justify-between bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24 z-30">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-xl">
            {domain === 'GenEd' ? <Sparkles className="text-indigo-600" size={24} /> : <Stethoscope className="text-indigo-600" size={24} />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{quizCopy.title}</h2>
            <p className="text-sm text-slate-500">{quizCopy.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block mr-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Questions Found</div>
            <div className="text-sm font-bold text-indigo-600">{stats.answered} / {stats.total}</div>
          </div>

          {onKeepGoing && (
            <button
              onClick={onKeepGoing}
              disabled={isExtending}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-600 border border-indigo-200 rounded-xl font-bold hover:bg-indigo-50 transition-all disabled:opacity-50"
            >
              {isExtending ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={18} />}
              {quizCopy.extendAction}
            </button>
          )}

          <button
            onClick={finalizeSession}
            disabled={stats.answered === 0}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg"
          >
            Submit All
          </button>
        </div>
      </div>

      {pastSessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <History className="text-indigo-500" size={20} />
              <span className="font-bold text-slate-700">Past Quiz Sessions</span>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{pastSessions.length}</span>
            </div>
            {showHistory ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
          </button>

          {showHistory && (
            <SessionList
              sessions={pastSessions}
              savedUploads={savedUploads}
              onReattempt={onReattemptSession}
              onOpenUpload={onOpenUpload}
              onRegenerateQuiz={onRegenerateQuiz}
            />
          )}

        </div>
      )
      }

      <div className="space-y-6">
        {(() => {
          let lastSubtopic = '';
          return safeQuestions.map((q, qIdx) => {
            const status = sessionStates[qIdx];
            if (!status) return null;
            const subtopicHeader = q.subtopic && q.subtopic !== lastSubtopic;
            if (q.subtopic) lastSubtopic = q.subtopic;

            return (
              <React.Fragment key={qIdx}>
                {subtopicHeader && (
                  <div className="flex items-center gap-3 pt-4">
                    <div className="h-px flex-1 bg-indigo-100"></div>
                    <span className="text-xs font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-4 py-1.5 rounded-full">{q.subtopic}</span>
                    <div className="h-px flex-1 bg-indigo-100"></div>
                  </div>
                )}
                <div className={`bg-white rounded-3xl border transition-all p-8 relative ${status.isAnswered ? 'border-slate-100 shadow-sm' : 'border-slate-200 shadow-md'}`}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${status.isAnswered ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        {qIdx + 1}
                      </span>
                      <h3 className="text-lg font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{q.question}</h3>
                    </div>
                    <button
                      onClick={() => toggleFlag(qIdx)}
                      className={`p-2 rounded-lg transition-all ${status.isFlagged ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:text-slate-500'}`}
                    >
                      <Flag size={20} fill={status.isFlagged ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((option, oIdx) => {
                      const isSelected = status.selectedOption === oIdx;
                      const isCorrect = oIdx === q.correctAnswer;
                      const showFeedback = status.isAnswered;

                      let style = "border-slate-200 hover:border-indigo-200 hover:bg-slate-50";
                      if (isSelected) style = "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100";
                      if (showFeedback) {
                        if (isCorrect) style = "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100";
                        else if (isSelected) style = "border-rose-500 bg-rose-50 ring-2 ring-rose-100";
                        else style = "border-slate-100 opacity-50";
                      }

                      return (
                        <button
                          key={oIdx}
                          disabled={status.isAnswered}
                          onClick={() => handleOptionSelect(qIdx, oIdx)}
                          className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 group ${style}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                          <span className={`text-base font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {option}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {status.showExplanation && (
                    <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 animate-slide-up">
                      <div className="flex gap-4 mb-4">
                        <div className={`p-2 rounded-lg h-fit ${status.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {status.isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 mb-1">
                            {status.isCorrect ? 'Correct!' : `The correct answer is "${q.options[q.correctAnswer]}".`}
                          </h4>
                          {!status.isCorrect && status.selectedOption !== null && (
                            <p className="text-sm text-slate-500 mb-3">
                              You selected: <span className="font-semibold text-slate-700">"{q.options[status.selectedOption]}"</span>
                            </p>
                          )}
                          <p className="text-slate-600 text-sm leading-relaxed">
                            {status.customExplanation && !status.isCorrect ? status.customExplanation : q.explanation}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
                        <Sparkles className="text-indigo-500" size={16} />
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{quizCopy.insightLabel}</span>
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          });
        })()}

        {isExtending && (
          <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="text-indigo-500 animate-spin mb-4" size={40} />
            <p className="text-slate-600 font-semibold mb-2">{quizCopy.loadingTitle}</p>
            <p className="text-slate-400 text-sm mb-4">{quizCopy.loadingSubtitle}</p>
            <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full animate-progress-indeterminate"></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
        <button
          onClick={onKeepGoing}
          disabled={isExtending}
          className="px-8 py-5 bg-white text-indigo-600 border-2 border-indigo-100 rounded-2xl font-bold text-lg hover:bg-indigo-50 disabled:bg-slate-50 disabled:text-indigo-400 disabled:cursor-wait transition-all flex items-center justify-center gap-2 min-w-[240px]"
        >
          {isExtending ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              <span>Generating<span className="animate-pulse">...</span></span>
            </>
          ) : (
            <>
              <Sparkles size={24} />
              {quizCopy.requestMore}
            </>
          )}
        </button>
        <button
          onClick={finalizeSession}
          className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
        >
          {quizCopy.finish}
        </button>
      </div>
    </div >
  );
};
