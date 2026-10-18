import React from 'react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
  badgeColor?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg = 'bg-blue-50',
  iconColor = 'text-whitepace-blue',
  badge,
  badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-whitepace-blue hover:shadow-md group' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-center space-x-2">
          {badge && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {badge}
            </span>
          )}
          {onClick && (
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-whitepace-blue transition-colors" />
          )}
        </div>
      </div>
      <div className="text-2xl font-extrabold text-whitepace-navy tracking-tight">{value}</div>
      <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">{title}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
};
