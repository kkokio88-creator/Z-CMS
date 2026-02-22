import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts';
import { Card, CardContent } from '../ui/card';
import { DynamicIcon } from '../ui/icon';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface KPICardProps {
  /** 카드 제목 */
  title: string;
  /** 표시할 주요 값 (문자열 또는 숫자) */
  value: string | number;
  /** 단위 (예: '원', '%', '개') */
  unit?: string;
  /** 변화량 텍스트 (예: '+3.2%', '-1건') */
  change?: string;
  /** 변화 수치 (양수/음수 판단용, change 텍스트 대신 사용 가능) */
  changePercent?: number;
  /** 변화 라벨 (기본값: '이전 기간 대비') */
  changeLabel?: string;
  /** Material Icon 이름 */
  icon?: string;
  /** 긍정/부정 여부 (아이콘 및 변화량 색상 결정) */
  isPositive?: boolean;
  /** 트렌드 방향 (isPositive 와 별개로 방향만 표시할 때) */
  trend?: 'up' | 'down' | 'neutral';
  /** 미니 차트 데이터 배열 ({ value: number }[]) */
  chartData?: { value: number }[];
  /** 미니 차트 유형 */
  chartType?: 'line' | 'area';
  /** 차트 및 아이콘 강조 색상 */
  color?: string;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  change,
  changePercent,
  changeLabel = '이전 기간 대비',
  icon,
  isPositive = true,
  trend,
  chartData,
  chartType = 'line',
  color = '#3B82F6',
  className = '',
}) => {
  const positive =
    isPositive !== undefined
      ? isPositive
      : changePercent !== undefined
      ? changePercent >= 0
      : true;

  const changeText =
    change ??
    (changePercent !== undefined
      ? `${changePercent >= 0 ? '+' : ''}${changePercent}%`
      : undefined);

  const TrendIcon =
    trend === 'up' || (trend === undefined && positive) ? ArrowUp
    : trend === 'down' || (trend === undefined && !positive) ? ArrowDown
    : Minus;

  return (
    <Card
      className={cn(
        'flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-shadow',
        className
      )}
    >
      <CardContent className="p-5 flex flex-col justify-between h-full">
        {/* 상단: 제목 + 값 + 아이콘 */}
        <div className="flex justify-between items-start z-10">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {value}
              {unit && (
                <span className="text-base font-normal text-muted-foreground ml-0.5">
                  {unit}
                </span>
              )}
            </p>
          </div>

          {icon && (
            <div
              className={cn(
                'p-2 rounded-full',
                positive
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              )}
            >
              <DynamicIcon
                name={icon}
                size={20}
                className={cn(
                  positive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              />
            </div>
          )}
        </div>

        {/* 하단: 변화량 */}
        {changeText !== undefined && (
          <div className="flex items-center mt-2 z-10">
            {(trend || changePercent !== undefined) && (
              <TrendIcon
                size={12}
                className={cn(
                  'mr-0.5',
                  positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}
              />
            )}
            <span
              className={cn(
                'text-xs font-bold mr-1',
                positive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {changeText}
            </span>
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          </div>
        )}
      </CardContent>

      {/* 배경 미니 차트 */}
      {chartData && chartData.length > 0 ? (
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 group-hover:opacity-30 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData}>
                <Area type="monotone" dataKey="value" stroke={color} fill={color} />
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="absolute bottom-2 right-2 opacity-10">
          <DynamicIcon name="show_chart" size={36} className="text-muted-foreground" />
        </div>
      )}
    </Card>
  );
};

export default KPICard;
