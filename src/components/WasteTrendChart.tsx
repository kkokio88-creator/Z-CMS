import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { WasteTrendData } from '../types';

interface Props {
  data: WasteTrendData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow-lg">
        <p className="font-semibold mb-1">{label}</p>
        <p>{`실제 폐기량: ${payload[0].value}kg`}</p>
        <p>{`평균 기준: ${payload[1].value}kg`}</p>
      </div>
    );
  }
  return null;
};

export const WasteTrendChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 h-full transition-colors">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">일별 폐기 추이 (kg)</h3>
        <div className="flex gap-2">
          <select className="text-xs border-gray-300 dark:border-gray-600 rounded bg-transparent text-gray-600 dark:text-gray-300 focus:ring-primary focus:border-primary">
            <option>최근 7일</option>
            <option>최근 30일</option>
          </select>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />

            {/* Average Line (Dashed) */}
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#9CA3AF"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
              name="평균 기준선"
            />

            {/* Actual Line (Primary Color) */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#2F5E3E"
              strokeWidth={3}
              dot={{ r: 4, fill: 'white', stroke: '#2F5E3E', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#2F5E3E', stroke: 'white', strokeWidth: 2 }}
              name="실제 폐기량"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-0.5 bg-gray-400 border border-gray-400 border-dashed"></span>
          <span className="text-gray-600 dark:text-gray-400">평균 기준선</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-primary"></span>
          <span className="text-gray-600 dark:text-gray-400">실제 폐기량</span>
        </div>
      </div>
    </div>
  );
};
