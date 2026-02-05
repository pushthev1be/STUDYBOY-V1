
import React from 'react';
import { Achievement, StudyGoal, UserStats } from '../types';
import { Trophy, Target, Medal, CheckCircle2, Star, Zap, Flame, Moon, BookOpen, Cpu } from 'lucide-react';

const ICON_MAP = {
  Zap: Zap,
  Star: Star,
  Award: Medal,
  BookOpen: BookOpen,
  Cpu: Cpu,
  Moon: Moon,
  Flame: Flame,
  Target: Target
};

interface AchievementsViewProps {
  achievements: Achievement[];
  goals: StudyGoal[];
  stats: UserStats;
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({ achievements, goals, stats }) => {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-12 pb-12">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Uploads', value: stats.totalUploads, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Quizzes', value: stats.totalQuizzesCompleted, icon: Star, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { label: 'Streak', value: `${stats.streakDays}d`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Flashcards', value: stats.totalFlashcardsViewed, icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Perfect', value: stats.perfectQuizzes, icon: Medal, color: 'text-rose-500', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
            <div className={`${stat.bg} ${stat.color} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon size={20} />
            </div>
            <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Goals Section */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <Target className="text-indigo-600" size={28} />
            <h2 className="text-2xl font-bold text-slate-800">Daily Goals</h2>
          </div>
          <div className="space-y-6">
            {goals.map((goal) => (
              <div key={goal.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-700">{goal.label}</h3>
                  <span className="text-sm font-bold text-indigo-600">
                    {goal.current} / {goal.target}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                  />
                </div>
                {goal.current >= goal.target && (
                  <div className="mt-3 flex items-center gap-2 text-emerald-600 text-sm font-bold">
                    <CheckCircle2 size={16} /> Completed
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Achievements Section */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="text-amber-500" size={28} />
            <h2 className="text-2xl font-bold text-slate-800">Mastery Badges</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {achievements.map((achievement) => {
              const IconComp = ICON_MAP[achievement.icon] || Trophy;
              return (
                <div 
                  key={achievement.id} 
                  className={`flex items-center gap-6 p-5 rounded-3xl border transition-all ${
                    achievement.unlocked 
                      ? 'bg-white border-slate-100 shadow-sm' 
                      : 'bg-slate-50 border-slate-200 grayscale opacity-40'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    achievement.unlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <IconComp size={28} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800">{achievement.title}</h3>
                    <p className="text-slate-500 text-xs">{achievement.description}</p>
                  </div>
                  {achievement.unlocked && (
                    <div className="text-amber-500 pr-2">
                      <Medal size={20} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
