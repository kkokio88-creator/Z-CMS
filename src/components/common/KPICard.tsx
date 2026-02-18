import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts';

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

/**
 * KPICard — 공통 KPI 지표 카드 컴포넌트
 *
 * DashboardHomeView 의 로컬 KPICard 패턴을 추출한 범용 버전.
 * 미니 트렌드 차트(area/line), 아이콘, 변화량 표시를 지원한다.
 */
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
  // isPositive 결정: 명시적으로 전달된 경우 우선, 없으면 changePercent 부호로 추론
  const positive =
    isPositive !== undefined
      ? isPositive
      : changePercent !== undefined
      ? changePercent >= 0
      : true;

  // 표시할 변화 텍스트
  const changeText =
    change ??
    (changePercent !== undefined
      ? `${changePercent >= 0 ? '+' : ''}${changePercent}%`
      : undefined);

  return (
    <div
      className={`bg-white dark:bg-surface-dark rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between h-40 relative overflow-hidden group hover:shadow-md transition-shadow ${className}`}
    >
      {/* 상단: 제목 + 값 + 아이콘 */}
      <div className="flex justify-between items-start z-10">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
            {unit && (
              <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-0.5">
                {unit}
              </span>
            )}
          </p>
        </div>

        {icon && (
          <div
            className={`p-2 rounded-full ${
              positive
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            }`}
          >
            <span
              className={`material-icons-outlined text-xl ${
                positive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {icon}
            </span>
          </div>
        )}
      </div>

      {/* 하단: 변화량 */}
      {changeText !== undefined && (
        <div className="flex items-center mt-2 z-10">
          {(trend || changePercent !== undefined) && (
            <span
              className={`material-icons-outlined text-xs mr-0.5 ${
                positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {trend === 'up' || (trend === undefined && positive)
                ? 'arrow_upward'
                : trend === 'down' || (trend === undefined && !positive)
                ? 'arrow_downward'
                : 'remove'}
            </span>
          )}
          <span
            className={`text-xs font-bold mr-1 ${
              positive
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {changeText}
          </span>
          <span className="text-xs text-gray-400">{changeLabel}</span>
        </div>
      )}

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
          <span className="text-4xl text-gray-300 material-icons-outlined">show_chart</span>
        </div>
      )}
    </div>
  );
};

export default KPICard;
