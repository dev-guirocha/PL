import React from 'react';

const StatCard = ({ title, value, subtext, icon, color = 'emerald' }) => {
  const colors = {
    emerald: 'from-emerald-500 to-teal-600 text-emerald-50',
    blue: 'from-blue-500 to-indigo-600 text-blue-50',
    amber: 'from-amber-400 to-orange-500 text-amber-50',
    rose: 'from-rose-500 to-pink-600 text-rose-50',
  };

  const bgGradient = colors[color] || colors.emerald;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bgGradient} p-5 shadow-lg shadow-slate-200 hover:shadow-xl transition-shadow duration-300`}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold uppercase tracking-wider opacity-80">{title}</span>
          <div className="text-2xl opacity-80">{icon}</div>
        </div>
        <div className="text-3xl font-extrabold tracking-tight text-white mb-1">{value}</div>
        {subtext && <div className="text-xs font-medium opacity-90">{subtext}</div>}
      </div>

      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
    </div>
  );
};

export default StatCard;
