/**
 * 페이지별 AI 인사이트 생성기
 * 현재 뷰+서브탭 조합에 맞는 인사이트를 평이한 한국어로 변환합니다.
 */

import type { DashboardInsights } from '../services/insightService';
import type { ViewType } from '../contexts/UIContext';
import { formatCurrency } from './format';

export interface AIInsightCard {
  id: string;
  icon: string;
  status: 'good' | 'warning' | 'danger' | 'info';
  title: string;
  explanation: string;
  keyMetrics: { label: string; value: string; trend?: 'up' | 'down' | 'flat' }[];
  action?: string;
  priority: number; // 0=위험, 1=주의, 2=정보
}

export function generatePageInsights(
  viewType: ViewType,
  subTab: string | null,
  insights: DashboardInsights | null,
): AIInsightCard[] {
  if (!insights) return [];

  const cards: AIInsightCard[] = [];

  switch (viewType) {
    case 'home':
      cards.push(...generateHomeInsights(insights));
      break;
    case 'profit':
      cards.push(...generateProfitInsights(subTab, insights));
      break;
    case 'cost':
      cards.push(...generateCostInsights(subTab, insights));
      break;
    case 'production':
      cards.push(...generateProductionInsights(subTab, insights));
      break;
    case 'inventory':
      cards.push(...generateInventoryInsights(subTab, insights));
      break;
    default:
      break;
  }

  return cards.sort((a, b) => a.priority - b.priority);
}

// ─── 홈 ───
function generateHomeInsights(ins: DashboardInsights): AIInsightCard[] {
  const cards: AIInsightCard[] = [];

  if (ins.profitCenterScore) {
    const s = ins.profitCenterScore;
    const status = s.overallScore >= 80 ? 'good' : s.overallScore >= 50 ? 'warning' : 'danger';
    cards.push({
      id: 'home-score',
      icon: 'speed',
      status,
      title: '수익센터 종합 점수',
      explanation: `현재 수익센터 종합 점수는 ${s.overallScore}점입니다. ${status === 'good' ? '전반적으로 양호한 상태입니다.' : status === 'warning' ? '일부 영역에서 개선이 필요합니다.' : '긴급하게 점검이 필요한 항목이 있습니다.'}`,
      keyMetrics: s.scores.slice(0, 3).map(m => ({
        label: m.metric,
        value: `${m.score}점`,
        trend: m.score >= 80 ? 'up' as const : m.score >= 50 ? 'flat' as const : 'down' as const,
      })),
      priority: status === 'danger' ? 0 : status === 'warning' ? 1 : 2,
    });
  }

  if (ins.channelRevenue) {
    const ch = ins.channelRevenue;
    cards.push({
      id: 'home-revenue',
      icon: 'payments',
      status: 'info',
      title: '매출 현황 요약',
      explanation: `총 매출은 ${formatCurrency(ch.totalRevenue)}이며, 제품이익(1단계)은 ${formatCurrency(ch.totalProfit1)}입니다. 채널 ${ch.channels.length}개가 운영 중입니다.`,
      keyMetrics: ch.channels.slice(0, 3).map(c => ({
        label: c.name,
        value: formatCurrency(c.revenue),
        trend: c.marginRate1 >= 30 ? 'up' as const : c.marginRate1 >= 15 ? 'flat' as const : 'down' as const,
      })),
      priority: 2,
    });
  }

  if (ins.wasteAnalysis) {
    const w = ins.wasteAnalysis;
    const status = w.avgWasteRate > 3 ? 'danger' : w.avgWasteRate > 2 ? 'warning' : 'good';
    cards.push({
      id: 'home-waste',
      icon: 'delete_outline',
      status,
      title: '폐기율 현황',
      explanation: `평균 폐기율은 ${w.avgWasteRate.toFixed(1)}%입니다. ${status === 'danger' ? '목표(3%)를 초과하여 즉시 원인 파악이 필요합니다.' : status === 'warning' ? '주의 수준이니 모니터링을 강화하세요.' : '목표 이내로 양호합니다.'}`,
      keyMetrics: [
        { label: '평균 폐기율', value: `${w.avgWasteRate.toFixed(1)}%`, trend: w.avgWasteRate > 2.5 ? 'down' as const : 'up' as const },
        { label: '고폐기 일수', value: `${w.highWasteDays.length}일` },
      ],
      priority: status === 'danger' ? 0 : status === 'warning' ? 1 : 2,
    });
  }

  if (ins.recommendations.length > 0) {
    const topRec = ins.recommendations[0];
    cards.push({
      id: 'home-rec',
      icon: 'lightbulb',
      status: topRec.priority === 'high' ? 'danger' : topRec.priority === 'medium' ? 'warning' : 'info',
      title: '최우선 개선 제안',
      explanation: topRec.description,
      keyMetrics: [
        { label: '예상 절감', value: formatCurrency(topRec.estimatedSaving) },
      ],
      action: topRec.title,
      priority: topRec.priority === 'high' ? 0 : 1,
    });
  }

  return cards;
}

// ─── 수익 분석 ───
function generateProfitInsights(subTab: string | null, ins: DashboardInsights): AIInsightCard[] {
  const cards: AIInsightCard[] = [];

  if (subTab === 'channel' || !subTab) {
    const ch = ins.channelRevenue;
    if (ch) {
      ch.channels.forEach((c, i) => {
        const status = c.marginRate3 >= 20 ? 'good' : c.marginRate3 >= 10 ? 'warning' : 'danger';
        cards.push({
          id: `profit-ch-${i}`,
          icon: 'storefront',
          status,
          title: `${c.name} 수익 현황`,
          explanation: `${c.name} 채널의 정산매출은 ${formatCurrency(c.revenue)}이고, 최종 사업부이익(3단계)은 ${formatCurrency(c.profit3)}입니다. 마진율 ${c.marginRate3.toFixed(1)}%로 ${status === 'good' ? '건강한 수준입니다.' : status === 'warning' ? '개선 여지가 있습니다.' : '수익성이 낮아 점검이 필요합니다.'}`,
          keyMetrics: [
            { label: '정산매출', value: formatCurrency(c.revenue) },
            { label: '사업부이익', value: formatCurrency(c.profit3), trend: c.profit3 > 0 ? 'up' : 'down' },
            { label: '마진율', value: `${c.marginRate3.toFixed(1)}%`, trend: c.marginRate3 >= 15 ? 'up' : 'down' },
          ],
          priority: status === 'danger' ? 0 : status === 'warning' ? 1 : 2,
        });
      });
    }
  }

  if (subTab === 'product') {
    const pp = ins.productProfit;
    const bep = ins.productBEP;
    if (pp && pp.items.length > 0) {
      const top3 = pp.items.slice(0, 3);
      cards.push({
        id: 'profit-product-top',
        icon: 'leaderboard',
        status: 'good',
        title: '상위 수익 품목',
        explanation: `가장 수익이 높은 품목은 ${top3.map(i => i.productName).join(', ')}입니다. 이 품목들의 판매를 더 늘리면 전체 수익성이 개선됩니다.`,
        keyMetrics: top3.map(i => ({
          label: i.productName.slice(0, 8),
          value: formatCurrency(i.margin),
          trend: i.marginRate >= 20 ? 'up' as const : 'down' as const,
        })),
        priority: 2,
      });

      const losers = pp.items.filter(i => i.margin < 0);
      if (losers.length > 0) {
        cards.push({
          id: 'profit-product-loss',
          icon: 'trending_down',
          status: 'danger',
          title: '적자 품목 경고',
          explanation: `${losers.length}개 품목이 적자 상태입니다. ${losers.slice(0, 2).map(l => l.productName).join(', ')} 등이 해당됩니다. 원가 구조를 확인하세요.`,
          keyMetrics: losers.slice(0, 3).map(l => ({
            label: l.productName.slice(0, 8),
            value: formatCurrency(l.margin),
            trend: 'down' as const,
          })),
          action: '적자 품목의 원가/판매가를 재검토하세요',
          priority: 0,
        });
      }
    }

    if (bep) {
      const belowBEP = bep.items.filter(i => i.achievementRate < 100);
      if (belowBEP.length > 0) {
        cards.push({
          id: 'profit-bep',
          icon: 'flag',
          status: 'warning',
          title: '손익분기 미달 품목',
          explanation: `${belowBEP.length}개 품목이 아직 손익분기점에 도달하지 못했습니다. 판매량을 늘리거나 고정비를 줄여야 합니다.`,
          keyMetrics: belowBEP.slice(0, 3).map(b => ({
            label: b.productName.slice(0, 8),
            value: `${b.achievementRate.toFixed(0)}%`,
            trend: 'down' as const,
          })),
          action: '판매 촉진 또는 고정비 절감을 검토하세요',
          priority: 1,
        });
      }
    }
  }

  if (subTab === 'trend') {
    const rt = ins.revenueTrend;
    if (rt && rt.monthly.length >= 2) {
      const last = rt.monthly[rt.monthly.length - 1];
      const prev = rt.monthly[rt.monthly.length - 2];
      const changeRate = prev.revenue > 0 ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : 0;
      cards.push({
        id: 'profit-trend',
        icon: 'show_chart',
        status: changeRate >= 0 ? 'good' : 'warning',
        title: '매출 추세',
        explanation: `최근 월 매출은 ${formatCurrency(last.revenue)}로, 전월 대비 ${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}% 변동했습니다. ${changeRate >= 5 ? '성장세가 이어지고 있습니다.' : changeRate >= 0 ? '안정적인 수준입니다.' : '매출이 감소하고 있어 원인 파악이 필요합니다.'}`,
        keyMetrics: [
          { label: '이번 달', value: formatCurrency(last.revenue), trend: changeRate >= 0 ? 'up' : 'down' },
          { label: '지난 달', value: formatCurrency(prev.revenue) },
          { label: '변동률', value: `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}%`, trend: changeRate >= 0 ? 'up' : 'down' },
        ],
        priority: changeRate < -5 ? 0 : 2,
      });
    }
  }

  if (subTab === 'budget') {
    const cb = ins.costBreakdown;
    if (cb && cb.composition.length > 0) {
      const totalCost = cb.composition.reduce((s, c) => s + c.value, 0);
      cards.push({
        id: 'profit-budget',
        icon: 'account_balance_wallet',
        status: 'info',
        title: '원가 구성 현황',
        explanation: `총 원가는 ${formatCurrency(totalCost)}이며, ${cb.composition.map(c => `${c.name} ${c.rate.toFixed(1)}%`).join(', ')}로 구성됩니다.`,
        keyMetrics: cb.composition.map(c => ({
          label: c.name,
          value: `${c.rate.toFixed(1)}%`,
        })),
        priority: 2,
      });
    }
  }

  if (subTab === 'cashflow') {
    const cf = ins.cashFlow;
    if (cf) {
      const status = cf.netCashPosition >= 0 ? 'good' : 'danger';
      cards.push({
        id: 'profit-cashflow',
        icon: 'account_balance',
        status,
        title: '현금 흐름 현황',
        explanation: `현금 유입은 ${formatCurrency(cf.totalCashInflow)}, 유출은 ${formatCurrency(cf.totalCashOutflow)}입니다. 순 현금 포지션은 ${formatCurrency(cf.netCashPosition)}로 ${status === 'good' ? '안정적입니다.' : '자금 관리에 주의가 필요합니다.'}`,
        keyMetrics: [
          { label: '현금 유입', value: formatCurrency(cf.totalCashInflow), trend: 'up' },
          { label: '현금 유출', value: formatCurrency(cf.totalCashOutflow), trend: 'down' },
          { label: '순 포지션', value: formatCurrency(cf.netCashPosition), trend: cf.netCashPosition >= 0 ? 'up' : 'down' },
        ],
        priority: status === 'danger' ? 0 : 2,
      });
    }
  }

  return cards;
}

// ─── 원가 관리 ───
function generateCostInsights(subTab: string | null, ins: DashboardInsights): AIInsightCard[] {
  const cards: AIInsightCard[] = [];

  if (subTab === 'overview' || !subTab) {
    const cb = ins.costBreakdown;
    if (cb && cb.composition.length > 0) {
      const totalCost = cb.composition.reduce((s, c) => s + c.value, 0);
      const rawRate = cb.composition.find(c => c.name === '원재료')?.rate || 0;
      const status = rawRate > 50 ? 'warning' : 'good';
      cards.push({
        id: 'cost-overview',
        icon: 'account_balance',
        status,
        title: '원가 4요소 분석',
        explanation: `총 원가 ${formatCurrency(totalCost)} 중 원재료가 ${rawRate.toFixed(1)}%로 가장 큰 비중입니다. ${status === 'warning' ? '원재료 비중이 높아 단가 협상이나 대체재 검토를 권장합니다.' : '균형 잡힌 원가 구조입니다.'}`,
        keyMetrics: cb.composition.map(c => ({
          label: c.name,
          value: formatCurrency(c.value),
        })),
        priority: status === 'warning' ? 1 : 2,
      });
    }
  }

  if (subTab === 'raw') {
    const mp = ins.materialPrices;
    const lp = ins.limitPrice;
    if (mp && mp.items.length > 0) {
      const rising = mp.items.filter(i => i.changeRate > 5);
      const falling = mp.items.filter(i => i.changeRate < -5);
      cards.push({
        id: 'cost-raw-trend',
        icon: 'inventory_2',
        status: rising.length > 3 ? 'danger' : rising.length > 0 ? 'warning' : 'good',
        title: '원재료 가격 동향',
        explanation: `원재료 ${mp.items.length}개 품목 중, ${rising.length}개가 단가 상승(5%↑), ${falling.length}개가 단가 하락(5%↓) 중입니다. ${rising.length > 3 ? '전반적인 원자재 가격 상승세에 주의하세요.' : '대체로 안정적입니다.'}`,
        keyMetrics: [
          { label: '상승 품목', value: `${rising.length}개`, trend: rising.length > 0 ? 'down' : 'flat' },
          { label: '하락 품목', value: `${falling.length}개`, trend: falling.length > 0 ? 'up' : 'flat' },
          { label: '총 품목', value: `${mp.items.length}개` },
        ],
        action: rising.length > 0 ? '단가 상승 품목의 대체재나 거래처 변경을 검토하세요' : undefined,
        priority: rising.length > 3 ? 0 : 1,
      });
    }
    if (lp && lp.exceedCount > 0) {
      cards.push({
        id: 'cost-raw-limit',
        icon: 'warning',
        status: 'danger',
        title: '한계단가 초과 품목',
        explanation: `${lp.exceedCount}/${lp.totalItems}개 품목이 한계단가(평균+1σ)를 초과했습니다. 비정상적인 가격 상승이 감지되었으니 확인이 필요합니다.`,
        keyMetrics: lp.items.filter(i => i.isExceeding).slice(0, 3).map(i => ({
          label: i.productName.slice(0, 8),
          value: formatCurrency(i.currentPrice),
          trend: 'down' as const,
        })),
        action: '한계단가 초과 품목의 구매 내역을 점검하세요',
        priority: 0,
      });
    }
  }

  if (subTab === 'sub') {
    const cb = ins.costBreakdown;
    if (cb?.subMaterialDetail) {
      const subTotal = cb.subMaterialDetail.total;
      cards.push({
        id: 'cost-sub',
        icon: 'category',
        status: 'info',
        title: '부재료 사용 현황',
        explanation: `부재료 총 비용은 ${formatCurrency(subTotal)}입니다. 부재료(포장재, 용기 등)는 원재료 다음으로 관리가 중요한 항목입니다.`,
        keyMetrics: cb.subMaterialDetail.items.slice(0, 3).map(i => ({
          label: i.productName.slice(0, 8),
          value: formatCurrency(i.totalSpent),
        })),
        priority: 2,
      });
    }
  }

  if (subTab === 'labor') {
    const cb = ins.costBreakdown;
    if (cb) {
      const laborCost = cb.composition.find(c => c.name === '노무비')?.value || 0;
      cards.push({
        id: 'cost-labor',
        icon: 'people',
        status: 'info',
        title: '노무비 현황',
        explanation: `노무비는 총 ${formatCurrency(laborCost)}이며, 전체 원가에서 ${(cb.composition.find(c => c.name === '노무비')?.rate || 0).toFixed(1)}%를 차지합니다. 인건비는 고정비 성격이 강하므로 생산성 향상이 핵심입니다.`,
        keyMetrics: [
          { label: '노무비 총액', value: formatCurrency(laborCost) },
          { label: '비중', value: `${(cb.composition.find(c => c.name === '노무비')?.rate || 0).toFixed(1)}%` },
        ],
        action: '1인당 생산량 지표를 모니터링하세요',
        priority: 2,
      });
    }
  }

  if (subTab === 'overhead') {
    const uc = ins.utilityCosts;
    if (uc && uc.monthly.length > 0) {
      const lastMonth = uc.monthly[uc.monthly.length - 1];
      cards.push({
        id: 'cost-overhead',
        icon: 'bolt',
        status: 'info',
        title: '경비(공과금) 현황',
        explanation: `총 경비는 ${formatCurrency(uc.totalCost)}입니다. 최근 월 기준 전기 ${formatCurrency(lastMonth.electricity)}, 수도 ${formatCurrency(lastMonth.water)}, 가스 ${formatCurrency(lastMonth.gas)}입니다.`,
        keyMetrics: [
          { label: '전기', value: formatCurrency(lastMonth.electricity) },
          { label: '수도', value: formatCurrency(lastMonth.water) },
          { label: '가스', value: formatCurrency(lastMonth.gas) },
        ],
        priority: 2,
      });
    }
  }

  return cards;
}

// ─── 생산/BOM ───
function generateProductionInsights(subTab: string | null, ins: DashboardInsights): AIInsightCard[] {
  const cards: AIInsightCard[] = [];

  if (subTab === 'production' || !subTab) {
    const pe = ins.productionEfficiency;
    if (pe) {
      cards.push({
        id: 'prod-status',
        icon: 'precision_manufacturing',
        status: 'info',
        title: '생산 현황 요약',
        explanation: `총 생산량은 ${pe.totalProduction.toLocaleString()}개이며, 일평균 ${pe.avgDaily.toLocaleString()}개입니다. 카테고리별 비중을 확인하여 생산 라인 배분을 최적화하세요.`,
        keyMetrics: [
          { label: '총 생산량', value: `${pe.totalProduction.toLocaleString()}개` },
          { label: '일평균', value: `${pe.avgDaily.toLocaleString()}개` },
        ],
        priority: 2,
      });
    }
  }

  if (subTab === 'waste') {
    const wa = ins.wasteAnalysis;
    if (wa) {
      const status = wa.avgWasteRate > 3 ? 'danger' : wa.avgWasteRate > 2 ? 'warning' : 'good';
      cards.push({
        id: 'prod-waste',
        icon: 'delete_outline',
        status,
        title: '폐기 분석',
        explanation: `평균 폐기율 ${wa.avgWasteRate.toFixed(1)}%입니다. ${wa.highWasteDays.length > 0 ? `고폐기 일수가 ${wa.highWasteDays.length}일 발생했으며, 최대 폐기율은 ${Math.max(...wa.highWasteDays.map(d => d.rate)).toFixed(1)}%입니다.` : '폐기율이 안정적입니다.'}`,
        keyMetrics: [
          { label: '평균 폐기율', value: `${wa.avgWasteRate.toFixed(1)}%`, trend: wa.avgWasteRate > 2.5 ? 'down' : 'up' },
          { label: '고폐기 일수', value: `${wa.highWasteDays.length}일` },
        ],
        action: status !== 'good' ? '폐기율 3% 미만을 목표로 공정을 점검하세요' : undefined,
        priority: status === 'danger' ? 0 : status === 'warning' ? 1 : 2,
      });
    }
  }

  if (subTab === 'efficiency') {
    const pe = ins.productionEfficiency;
    if (pe && pe.categoryStats.length > 0) {
      const topCat = pe.categoryStats.reduce((best, c) => c.total > best.total ? c : best, pe.categoryStats[0]);
      cards.push({
        id: 'prod-efficiency',
        icon: 'speed',
        status: 'info',
        title: '생산성 분석',
        explanation: `카테고리별 생산을 보면, "${topCat.category}"가 ${topCat.total.toLocaleString()}개로 가장 많이 생산되었습니다. 각 카테고리의 일평균 생산량을 비교하여 병목 구간을 파악하세요.`,
        keyMetrics: pe.categoryStats.slice(0, 4).map(c => ({
          label: c.category,
          value: `${c.total.toLocaleString()}개`,
        })),
        priority: 2,
      });
    }
  }

  if (subTab === 'bomVariance') {
    const bv = ins.bomVariance;
    if (bv) {
      const status = bv.unfavorableCount > bv.favorableCount ? 'warning' : 'good';
      cards.push({
        id: 'prod-bom',
        icon: 'compare_arrows',
        status,
        title: 'BOM 오차 분석',
        explanation: `BOM 오차 분석 결과, ${bv.favorableCount}개 품목은 유리(비용 절감), ${bv.unfavorableCount}개 품목은 불리(비용 초과)입니다. 총 오차 금액은 ${formatCurrency(bv.totalVariance)}입니다.`,
        keyMetrics: [
          { label: '유리 품목', value: `${bv.favorableCount}개`, trend: 'up' },
          { label: '불리 품목', value: `${bv.unfavorableCount}개`, trend: 'down' },
          { label: '총 오차', value: formatCurrency(bv.totalVariance) },
        ],
        action: bv.unfavorableCount > 0 ? '불리 품목의 BOM 기준을 재검토하세요' : undefined,
        priority: status === 'warning' ? 1 : 2,
      });
    }
  }

  if (subTab === 'yield') {
    const yt = ins.yieldTracking;
    if (yt) {
      const gap = yt.avgYieldRate - yt.standardYield;
      const status = gap < -3 ? 'danger' : gap < 0 ? 'warning' : 'good';
      cards.push({
        id: 'prod-yield',
        icon: 'science',
        status,
        title: '수율 추적',
        explanation: `평균 수율은 ${yt.avgYieldRate.toFixed(1)}%이며 기준 수율은 ${yt.standardYield.toFixed(1)}%입니다. ${gap >= 0 ? '기준을 충족하고 있습니다.' : `기준 대비 ${Math.abs(gap).toFixed(1)}%p 낮으므로 공정 개선이 필요합니다.`}`,
        keyMetrics: [
          { label: '평균 수율', value: `${yt.avgYieldRate.toFixed(1)}%`, trend: gap >= 0 ? 'up' : 'down' },
          { label: '기준 수율', value: `${yt.standardYield.toFixed(1)}%` },
          { label: '차이', value: `${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%p`, trend: gap >= 0 ? 'up' : 'down' },
        ],
        action: gap < 0 ? '수율 저하 원인을 파악하고 공정을 개선하세요' : undefined,
        priority: status === 'danger' ? 0 : status === 'warning' ? 1 : 2,
      });
    }
  }

  return cards;
}

// ─── 재고/발주 ───
function generateInventoryInsights(subTab: string | null, ins: DashboardInsights): AIInsightCard[] {
  const cards: AIInsightCard[] = [];

  if (subTab === 'inventory' || !subTab) {
    const fr = ins.freshness;
    const so = ins.statisticalOrder;
    if (fr) {
      const dangerCount = fr.gradeCount.danger + fr.gradeCount.warning;
      const status = dangerCount > 5 ? 'danger' : dangerCount > 0 ? 'warning' : 'good';
      cards.push({
        id: 'inv-freshness',
        icon: 'eco',
        status,
        title: '재고 신선도',
        explanation: `평균 신선도 점수는 ${fr.avgScore.toFixed(0)}점입니다. ${dangerCount > 0 ? `위험/경고 등급 ${dangerCount}개 품목이 있습니다. 재고 회전이 느린 품목을 우선 출하하세요.` : '전체적으로 양호한 상태입니다.'}`,
        keyMetrics: [
          { label: '평균 점수', value: `${fr.avgScore.toFixed(0)}점` },
          { label: '위험/경고', value: `${dangerCount}개`, trend: dangerCount > 0 ? 'down' : 'up' },
          { label: '안전', value: `${fr.gradeCount.safe + fr.gradeCount.good}개`, trend: 'up' },
        ],
        priority: status === 'danger' ? 0 : status === 'warning' ? 1 : 2,
      });
    }
    if (so) {
      cards.push({
        id: 'inv-order-summary',
        icon: 'local_shipping',
        status: so.urgentCount > 0 ? 'danger' : so.shortageCount > 0 ? 'warning' : 'good',
        title: '발주 필요 현황',
        explanation: `전체 ${so.totalItems}개 품목 중 ${so.urgentCount}개가 긴급 발주, ${so.shortageCount}개가 부족 상태입니다. ${so.urgentCount > 0 ? '긴급 발주 품목을 최우선으로 처리하세요.' : '현재 재고 수준은 양호합니다.'}`,
        keyMetrics: [
          { label: '긴급', value: `${so.urgentCount}개`, trend: so.urgentCount > 0 ? 'down' : 'flat' },
          { label: '부족', value: `${so.shortageCount}개`, trend: so.shortageCount > 0 ? 'down' : 'flat' },
          { label: '총 품목', value: `${so.totalItems}개` },
        ],
        action: so.urgentCount > 0 ? '긴급 발주 품목을 지금 발주하세요' : undefined,
        priority: so.urgentCount > 0 ? 0 : 1,
      });
    }
  }

  if (subTab === 'anomaly') {
    const lp = ins.limitPrice;
    const abc = ins.abcxyz;
    if (lp && lp.exceedCount > 0) {
      cards.push({
        id: 'inv-anomaly-price',
        icon: 'price_check',
        status: 'danger',
        title: '가격 이상 징후',
        explanation: `${lp.exceedCount}개 품목의 최근 단가가 한계단가(평균+1σ)를 초과했습니다. 비정상적인 가격 변동이 감지되었으니 확인이 필요합니다.`,
        keyMetrics: [
          { label: '초과 품목', value: `${lp.exceedCount}개`, trend: 'down' },
          { label: '전체 품목', value: `${lp.totalItems}개` },
        ],
        action: '이상 단가 품목의 구매 이력을 점검하세요',
        priority: 0,
      });
    }
    if (abc) {
      const azCount = abc.matrix['AZ'] || 0;
      if (azCount > 0) {
        cards.push({
          id: 'inv-anomaly-az',
          icon: 'warning',
          status: 'warning',
          title: 'ABC-XYZ 이상 그룹',
          explanation: `A등급(고금액)이면서 Z등급(수요 불안정)인 품목이 ${azCount}개 있습니다. 이 품목들은 금액이 크지만 수요 예측이 어려워 재고 관리에 특별한 주의가 필요합니다.`,
          keyMetrics: [
            { label: 'AZ 그룹', value: `${azCount}개` },
            { label: 'A등급', value: `${abc.summary.A}개` },
            { label: 'Z등급', value: `${abc.summary.Z}개` },
          ],
          priority: 1,
        });
      }
    }
  }

  if (subTab === 'statistical') {
    const so = ins.statisticalOrder;
    if (so) {
      const urgentItems = so.items.filter(i => i.urgency === 'urgent' || i.urgency === 'shortage');
      cards.push({
        id: 'inv-stat-order',
        icon: 'calculate',
        status: so.urgentCount > 3 ? 'danger' : so.urgentCount > 0 ? 'warning' : 'good',
        title: '통계적 발주 분석',
        explanation: `서비스 수준 ${so.serviceLevel}% 기준으로 분석한 결과, ${so.urgentCount}개 품목이 즉시 발주 필요합니다. ROP(재주문점) 이하로 떨어진 품목을 확인하세요.`,
        keyMetrics: [
          { label: '서비스 수준', value: `${so.serviceLevel}%` },
          { label: '긴급 발주', value: `${so.urgentCount}개`, trend: so.urgentCount > 0 ? 'down' : 'up' },
          { label: '전체 품목', value: `${so.totalItems}개` },
        ],
        action: so.urgentCount > 0 ? '통계적 발주 탭에서 발주를 진행하세요' : undefined,
        priority: so.urgentCount > 3 ? 0 : 1,
      });
    }
  }

  if (subTab === 'purchase' || subTab === 'inventoryCost') {
    const abc = ins.abcxyz;
    const ic = ins.inventoryCost;
    if (abc) {
      cards.push({
        id: 'inv-abc',
        icon: 'analytics',
        status: 'info',
        title: 'ABC-XYZ 분류 현황',
        explanation: `A등급(상위 70% 금액) ${abc.summary.A}개, B등급 ${abc.summary.B}개, C등급 ${abc.summary.C}개 품목입니다. A등급 품목에 집중 관리하면 전체 재고 효율이 크게 개선됩니다.`,
        keyMetrics: [
          { label: 'A등급', value: `${abc.summary.A}개` },
          { label: 'B등급', value: `${abc.summary.B}개` },
          { label: 'C등급', value: `${abc.summary.C}개` },
        ],
        priority: 2,
      });
    }
    if (ic) {
      cards.push({
        id: 'inv-cost',
        icon: 'savings',
        status: ic.summary.totalStockoutCost > 0 ? 'warning' : 'good',
        title: '재고 비용 현황',
        explanation: `총 재고 비용은 ${formatCurrency(ic.summary.grandTotal)}입니다. 보관비 ${formatCurrency(ic.summary.totalHoldingCost)}, 발주비 ${formatCurrency(ic.summary.totalOrderingCost)}, 결품비 ${formatCurrency(ic.summary.totalStockoutCost)}입니다.`,
        keyMetrics: [
          { label: '보관비', value: formatCurrency(ic.summary.totalHoldingCost) },
          { label: '발주비', value: formatCurrency(ic.summary.totalOrderingCost) },
          { label: '결품비', value: formatCurrency(ic.summary.totalStockoutCost), trend: ic.summary.totalStockoutCost > 0 ? 'down' : 'flat' },
        ],
        priority: ic.summary.totalStockoutCost > 0 ? 1 : 2,
      });
    }
  }

  return cards;
}

/** 위험 인사이트 개수 */
export function countDangerInsights(
  viewType: ViewType,
  subTab: string | null,
  insights: DashboardInsights | null,
): number {
  const cards = generatePageInsights(viewType, subTab, insights);
  return cards.filter(c => c.status === 'danger').length;
}
