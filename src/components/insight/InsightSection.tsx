/**
 * InsightSection — AI 인사이트 인라인 오버레이 시스템
 *
 * insightMode가 활성화되면, 매칭되는 인사이트 카드가 있는 섹션에
 * 하이라이트 링 + 플로팅 배지를 표시합니다.
 * 배지 클릭 시 상세 인사이트 카드가 인라인으로 펼쳐집니다.
 */

import React, { createContext, useContext, useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import type { AIInsightCard } from '../../utils/pageInsightGenerator';
import { formatCurrency } from '../../utils/format';

// ─── Context ───
const InsightCardsContext = createContext<AIInsightCard[]>([]);
export const InsightCardsProvider = InsightCardsContext.Provider;
export const useInsightCards = () => useContext(InsightCardsContext);

// ─── Status Config ───
const STATUS_CFG = {
  good: { ring: 'ring-green-400/60', badge: 'bg-green-500', badgeHover: 'hover:bg-green-600', iconColor: 'text-green-500', bgCard: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', label: '정상' },
  warning: { ring: 'ring-yellow-400/60', badge: 'bg-yellow-500', badgeHover: 'hover:bg-yellow-600', iconColor: 'text-yellow-500', bgCard: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', label: '주의' },
  danger: { ring: 'ring-red-400/70', badge: 'bg-red-500', badgeHover: 'hover:bg-red-600', iconColor: 'text-red-500', bgCard: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', label: '위험' },
  info: { ring: 'ring-blue-400/50', badge: 'bg-blue-500', badgeHover: 'hover:bg-blue-600', iconColor: 'text-blue-500', bgCard: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', label: '정보' },
};

const TREND_ICON: Record<string, { icon: string; color: string }> = {
  up: { icon: 'trending_up', color: 'text-green-500' },
  down: { icon: 'trending_down', color: 'text-red-500' },
  flat: { icon: 'trending_flat', color: 'text-gray-400' },
};

// ─── InsightSection ───
interface InsightSectionProps {
  id: string | string[];
  children: React.ReactNode;
  className?: string;
}

export const InsightSection: React.FC<InsightSectionProps> = ({ id, children, className = '' }) => {
  const { insightMode } = useUI();
  const cards = useInsightCards();
  const [expanded, setExpanded] = useState(false);

  // id에 매칭되는 카드 찾기 (exact match 또는 prefix match, 다중 ID 지원)
  const ids = Array.isArray(id) ? id : [id];
  const matchingCards = cards.filter(c =>
    ids.some(i => c.id === i || c.id.startsWith(i + '-'))
  );

  // insightMode 비활성 또는 매칭 카드 없으면 children만 렌더
  if (!insightMode || matchingCards.length === 0) return <>{children}</>;

  const primaryCard = matchingCards[0];
  const cfg = STATUS_CFG[primaryCard.status];
  // 가장 심각한 상태의 링 색상 사용
  const worstStatus = matchingCards.reduce<keyof typeof STATUS_CFG>((worst, c) => {
    const order = { danger: 0, warning: 1, info: 2, good: 3 };
    return order[c.status] < order[worst] ? c.status : worst;
  }, 'good');
  const ringCfg = STATUS_CFG[worstStatus];

  return (
    <div className={`relative ${ringCfg.ring} ring-2 rounded-xl transition-all duration-300 ${className}`}>
      {children}

      {/* 플로팅 배지 */}
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className={`absolute -top-2.5 -right-2.5 z-40 flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-bold shadow-lg ${cfg.badge} ${cfg.badgeHover} transition-all duration-200 hover:scale-110 animate-ai-pulse`}
        title={primaryCard.title}
      >
        <span className="material-icons-outlined text-sm">{primaryCard.icon}</span>
        {matchingCards.length > 1 ? (
          <span>{matchingCards.length}</span>
        ) : (
          <span className="hidden sm:inline max-w-[80px] truncate">{primaryCard.title.slice(0, 6)}</span>
        )}
        <span className="material-icons-outlined text-xs">{expanded ? 'expand_less' : 'expand_more'}</span>
      </button>

      {/* 펼침 카드 */}
      {expanded && (
        <div
          className="absolute top-0 right-0 z-50 w-80 max-h-[400px] overflow-auto mt-6 mr-1 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cfg.bgCard}`}>
                <span className={`material-icons-outlined text-sm ${cfg.iconColor}`}>auto_awesome</span>
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">AI 인사이트</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span className="material-icons-outlined text-sm text-gray-400">close</span>
            </button>
          </div>

          {/* 카드 리스트 */}
          <div className="p-3 space-y-2.5">
            {matchingCards.map(card => (
              <MiniInsightCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Mini Insight Card ───
const MiniInsightCard: React.FC<{ card: AIInsightCard }> = ({ card }) => {
  const cfg = STATUS_CFG[card.status];

  return (
    <div className={`rounded-lg border p-3 ${cfg.bgCard} ${cfg.border}`}>
      {/* 제목 */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`material-icons-outlined text-base ${cfg.iconColor}`}>{card.icon}</span>
        <h4 className="text-xs font-bold text-gray-900 dark:text-white flex-1">{card.title}</h4>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bgCard} ${cfg.iconColor}`}>
          {cfg.label}
        </span>
      </div>

      {/* 설명 */}
      <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{card.explanation}</p>

      {/* 주요 지표 */}
      {card.keyMetrics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.keyMetrics.map((m, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px] bg-white/60 dark:bg-gray-800/60 px-2 py-1 rounded">
              <span className="text-gray-500 dark:text-gray-400">{m.label}:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200">{m.value}</span>
              {m.trend && (
                <span className={`material-icons-outlined text-[10px] ${TREND_ICON[m.trend].color}`}>
                  {TREND_ICON[m.trend].icon}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 추천 */}
      {card.action && (
        <div className="mt-2 flex items-start gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <span className="material-icons-outlined text-[10px] text-yellow-500 mt-0.5">lightbulb</span>
          <span>{card.action}</span>
        </div>
      )}
    </div>
  );
};

// ─── Insight Status Bar (하단 요약) ───
interface InsightStatusBarProps {
  onClose: () => void;
}

export const InsightStatusBar: React.FC<InsightStatusBarProps> = ({ onClose }) => {
  const cards = useInsightCards();

  if (cards.length === 0) return null;

  const counts = { danger: 0, warning: 0, good: 0, info: 0 };
  cards.forEach(c => counts[c.status]++);

  const actionCards = cards.filter(c => c.action);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 shadow-lg animate-slide-up">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* 상태 뱃지 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0D5611' }}>
              <span className="material-icons-outlined text-white text-sm">auto_awesome</span>
            </div>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">AI 분석</span>
          </div>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
          {(['danger', 'warning', 'good', 'info'] as const).map(status => (
            counts[status] > 0 && (
              <div
                key={status}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_CFG[status].bgCard} ${STATUS_CFG[status].border} border`}
              >
                <span className={`material-icons-outlined text-xs ${STATUS_CFG[status].iconColor}`}>
                  {status === 'danger' ? 'error' : status === 'warning' ? 'warning' : status === 'good' ? 'check_circle' : 'info'}
                </span>
                <span className="text-gray-700 dark:text-gray-300">{counts[status]}</span>
              </div>
            )
          ))}
        </div>

        {/* 최우선 추천 */}
        <div className="hidden md:flex items-center gap-2 flex-1 mx-6 max-w-lg">
          {actionCards.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 truncate">
              <span className="material-icons-outlined text-xs text-yellow-500">lightbulb</span>
              <span className="truncate">{actionCards[0].action}</span>
            </div>
          )}
        </div>

        {/* 닫기 */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="material-icons-outlined text-sm">close</span>
          닫기
        </button>
      </div>
    </div>
  );
};
