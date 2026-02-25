import React from 'react';
import { Card } from '../ui/card';

interface ViewSkeletonProps {
  kpiCount?: number;
  showChart?: boolean;
  rows?: number;
}

const Pulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
);

export const ViewSkeleton: React.FC<ViewSkeletonProps> = ({
  kpiCount = 4,
  showChart = true,
  rows = 5,
}) => {
  return (
    <div className="space-y-6">
      {/* KPI 카드 스켈레톤 */}
      <div className={`grid grid-cols-1 md:grid-cols-${kpiCount} gap-4`}>
        {Array.from({ length: kpiCount }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            <Pulse className="h-3 w-20" />
            <Pulse className="h-8 w-28" />
            <Pulse className="h-2.5 w-16" />
          </Card>
        ))}
      </div>

      {/* 차트 스켈레톤 */}
      {showChart && (
        <Card className="p-6">
          <Pulse className="h-4 w-40 mb-4" />
          <Pulse className="h-72 w-full" />
        </Card>
      )}

      {/* 테이블 스켈레톤 */}
      <Card className="p-6">
        <Pulse className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          {/* 헤더 행 */}
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Pulse key={i} className="h-3 flex-1" />
            ))}
          </div>
          {/* 데이터 행 */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <Pulse key={j} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
