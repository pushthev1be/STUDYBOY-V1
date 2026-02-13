
import React from 'react';
import { Achievement, StudyGoal, UserStats } from '../types';
import { Trophy, Target, Medal, CheckCircle2, Star, Zap, Flame, Moon, BookOpen, Cpu, Heart, Stethoscope } from 'lucide-react';

const ICON_MAP = {
  Zap: Zap,
  Star: Star,
  Award: Medal,
  BookOpen: BookOpen,
  Cpu: Cpu,
  Moon: Moon,
  Flame: Flame,
  Target: Target,
  Heart: Heart,
  Stethoscope: Stethoscope
};

interface AchievementsViewProps {
  achievements: Achievement[];
  goals: StudyGoal[];
  stats: UserStats;
}

const RARITY_CONFIG = {
  bronze: {
    bg: 'bg-orange-50 border-orange-100',
    iconBg: 'bg-orange-100 text-orange-700',
    badge: 'bg-orange-700 text-white',
    label: 'BRONZE'
  },
  silver: {
    bg: 'bg-slate-50 border-slate-200',
    iconBg: 'bg-slate-200 text-slate-700',
    badge: 'bg-slate-400 text-white',
    label: 'SILVER'
  },
  gold: {
    bg: 'bg-amber-50 border-amber-200',
    iconBg: 'bg-amber-100 text-amber-700',
    badge: 'bg-amber-500 text-white',
    label: 'GOLD'
  }
};

export const AchievementsView: React.FC<AchievementsViewProps> = ({ achievements, goals, stats }) => {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-12 pb-12">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Uploads', value: stats.totalUploads, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Quizzes', value: stats.totalQuizzesCompleted, icon: Star, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { label: 'Streak', value: `${stats.streakDays}d`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Flashcards', value: stats.totalFlashcardsViewed, icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Avg Skill', value: stats.currentPerfectStreak > 0 ? `${stats.currentPerfectStreak}x 🔥` : stats.perfectQuizzes, icon: Medal, color: 'text-rose-500', bg: 'bg-rose-50' },
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
            <h2 className="text-2xl font-bold text-slate-800">Daily Missions</h2>
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
                    <CheckCircle2 size={16} /> Mission Accomplished
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Achievements Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Trophy className="text-amber-500" size={28} />
              <h2 className="text-2xl font-bold text-slate-800">Hall of Fame</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {achievements.map((achievement) => {
              const IconComp = ICON_MAP[achievement.icon] || Trophy;
              const config = RARITY_CONFIG[achievement.rarity];

              return (
                <div
                  key={achievement.id}
                  className={`flex items-center gap-4 md:gap-6 p-5 rounded-3xl border transition-all ${achievement.unlocked
                    ? `${config.bg} shadow-sm`
                    : 'bg-slate-50 border-slate-200 grayscale opacity-40'
                    }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${achievement.unlocked ? config.iconBg : 'bg-slate-200 text-slate-400'
                    }`}>
                    <IconComp size={28} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-slate-800 line-clamp-1">{achievement.title}</h3>
                      {achievement.unlocked && (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full tracking-tighter ${config.badge}`}>
                          {config.label}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px] md:text-xs leading-tight">{achievement.description}</p>
                  </div>
                  {achievement.unlocked && (
                    <div className={achievement.rarity === 'gold' ? 'text-amber-500' :
                      achievement.rarity === 'silver' ? 'text-slate-400' : 'text-orange-700'}>
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
