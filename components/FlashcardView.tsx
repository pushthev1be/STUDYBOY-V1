import React, { useState } from 'react';
import { Flashcard } from '../types';
import { ChevronLeft, ChevronRight, RotateCcw, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FlashcardViewProps {
  cards: Flashcard[];
  topic?: string;
  onCardViewed?: () => void;
  onCardRated?: (cardIndex: number, quality: number) => void;
  onLoadMore?: (newCards: Flashcard[]) => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ cards, topic, onCardViewed, onCardRated, onLoadMore }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set([0]));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [direction, setDirection] = useState(0);

  const displayedCards = cards.length;

  const markAsViewed = (index: number) => {
    if (!viewedIndices.has(index)) {
      const newViewed = new Set(viewedIndices);
      newViewed.add(index);
      setViewedIndices(newViewed);
      if (onCardViewed) onCardViewed();
    }
  };

  const nextCard = () => {
    setDirection(1);
    setIsFlipped(false);
    const nextIdx = (currentIndex + 1) % displayedCards;
    setCurrentIndex(nextIdx);
    markAsViewed(nextIdx);
  };

  const prevCard = () => {
    setDirection(-1);
    setIsFlipped(false);
    const prevIdx = (currentIndex - 1 + displayedCards) % displayedCards;
    setCurrentIndex(prevIdx);
    markAsViewed(prevIdx);
  };

  const loadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const { generateAdditionalFlashcards } = await import('../services/geminiService');
      const cardTopic = topic || 'Study Material';
      const newCards = await generateAdditionalFlashcards(cardTopic);
      if (newCards.length > 0 && onLoadMore) {
        onLoadMore(newCards);
      }
    } catch (error) {
      console.error("Failed to load more flashcards:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const prevCardsLength = React.useRef(cards.length);

  React.useEffect(() => {
    if (cards.length > prevCardsLength.current && isLoadingMore) {
      setCurrentIndex(prevCardsLength.current);
      setIsFlipped(false);
    }
    prevCardsLength.current = cards.length;
  }, [cards.length, isLoadingMore]);

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextCard();
      if (e.key === 'ArrowLeft') prevCard();
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped(!isFlipped);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, currentIndex, displayedCards]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.8
    })
  };

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col items-center space-y-4 md:space-y-8 py-6 md:py-12 max-w-lg mx-auto min-h-full px-4 overflow-x-hidden">
      <div className="text-slate-500 font-medium text-xs md:text-sm">
        Card {currentIndex + 1} of {cards.length}
      </div>

      <div className="relative w-full aspect-[4/5] md:aspect-[4/3]">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = offset.x;
              if (swipe < -100) nextCard();
              else if (swipe > 100) prevCard();
            }}
            className="absolute inset-0 cursor-grab active:cursor-grabbing perspective-1000"
          >
            <div
              role="button"
              tabIndex={0}
              className="relative w-full h-full outline-none focus:ring-4 focus:ring-indigo-500 rounded-2xl md:rounded-3xl shadow-xl transform-style-3d"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <motion.div
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                className="relative w-full h-full transform-style-3d"
              >
                {/* Front */}
                <div className="absolute inset-0 bg-white border-2 border-slate-100 rounded-2xl md:rounded-3xl flex items-center justify-center p-6 md:p-8 backface-hidden">
                  <div className="text-center">
                    <span className="text-indigo-500 font-bold uppercase tracking-wider text-[10px] md:text-xs mb-3 md:mb-4 block">Question</span>
                    <p className="text-lg md:text-2xl font-semibold text-slate-800">{currentCard.question}</p>
                  </div>
                  <div className="absolute bottom-6 text-slate-400 text-[10px] md:text-xs flex items-center gap-2">
                    <RotateCcw size={14} /> Tap to flip • Swipe to navigate
                  </div>
                </div>

                {/* Back */}
                <div className="absolute inset-0 bg-indigo-600 border-2 border-indigo-500 rounded-2xl md:rounded-3xl flex flex-col items-center justify-center p-6 md:p-8 backface-hidden rotate-y-180">
                  <div className="text-center mb-4 md:mb-6">
                    <span className="text-indigo-200 font-bold uppercase tracking-wider text-[10px] md:text-xs mb-3 md:mb-4 block">Answer</span>
                    <p className="text-lg md:text-2xl font-medium text-white">{currentCard.answer}</p>
                  </div>
                  {isFlipped && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-wrap justify-center gap-2 md:gap-3 mt-4"
                    >
                      {[{ l: 'Hard', q: 1, c: 'bg-red-500' }, { l: 'Good', q: 2, c: 'bg-yellow-500' }, { l: 'Easy', q: 3, c: 'bg-green-500' }].map(btn => (
                        <button
                          key={btn.l}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCardRated?.(currentIndex, btn.q);
                            nextCard();
                          }}
                          className={`px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all active:scale-95`}
                        >
                          {btn.l}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-8 pt-4">
        <button
          onClick={prevCard}
          className="p-5 md:p-4 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-90"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          onClick={nextCard}
          className="p-5 md:p-4 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm active:scale-90"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={loadMore}
        disabled={isLoadingMore}
        className={`mt-4 w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-indigo-100 ${isLoadingMore ? 'cursor-not-allowed' : ''}`}
      >
        <AnimatePresence mode="wait">
          {isLoadingMore ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, rotate: -180 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 180 }}
              transition={{ duration: 0.2 }}
            >
              <Loader2 size={24} className="animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={24} />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="relative">
          {isLoadingMore ? 'Generating 15 more cards...' : 'Load More Flashcards'}
          {isLoadingMore && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute -right-4"
            >
              .
            </motion.span>
          )}
        </span>
      </motion.button>
    </div>
  );
};
