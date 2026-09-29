import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: 'green' | 'yellow' | 'red' | 'blue';
}

export function StatCard({ title, value, icon: Icon, trend, color = 'green' }: StatCardProps) {
  const colorClasses = {
    green: 'bg-[#22C55E]/10 text-[#22C55E]',
    yellow: 'bg-[#FACC15]/10 text-[#FACC15]',
    red: 'bg-[#EF4444]/10 text-[#EF4444]',
    blue: 'bg-[#3B82F6]/10 text-[#3B82F6]',
  };

  return (
    <div className="bg-card border border-border rounded-[14px] p-6 transition-colors duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">{title}</p>
          <p className="text-3xl font-bold text-foreground mb-1">{value}</p>
          {trend && (
            <p className={`text-sm ${trend.positive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
