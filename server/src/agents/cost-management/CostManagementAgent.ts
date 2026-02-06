import { Agent } from '../base/Agent.js';
import { geminiAdapter } from '../../adapters/GeminiAdapter.js';
import type { Task, TaskResult, CoachingMessage } from '../../types/index.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StateManager } from '../../services/StateManager.js';
import type { LearningRegistry } from '../../services/LearningRegistry.js';

interface CostData {
  salesAmount: number;
  rawMaterialCost: number;
  subMaterialCost: number;
  laborCost: number;
  expenseAmount: number;
  wasteCost: number;
}

interface AttendanceData {
  employeeId: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string;
  overtimeHours: number;
  shift: string;
}

interface PurchaseOrderData {
  orderId: string;
  orderDate: string;
  supplierName: string;
  totalAmount: number;
  itemCount: number;
  status: string;
  isUrgent: boolean;
}

export class CostManagementAgent extends Agent {
  private costThreshold = 1.2; // 생산매출/원가 최소 비율
  private laborCostRatio = 0.25; // 노무비 목표 비율 (매출 대비)
  private overtimeAlertThreshold = 20; // 초과근무 경고 임계값 (%)

  constructor(eventBus: EventBus, stateManager: StateManager, learningRegistry: LearningRegistry) {
    super('cost-management-agent', eventBus, stateManager, learningRegistry);
  }

  getCapabilities(): string[] {
    return [
      '원가 구조 분석',
      '노무비 효율성 분석',
      '발주/구매 패턴 분석',
      '원가 절감 기회 도출',
      '비용 추세 모니터링',
      '인건비 최적화 제안',
    ];
  }

  async process(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      switch (task.type) {
        case 'analyze_cost_structure':
          return await this.analyzeCostStructure(task);
        case 'analyze_labor_efficiency':
          return await this.analyzeLaborEfficiency(task);
        case 'analyze_purchase_patterns':
          return await this.analyzePurchasePatterns(task);
        case 'detect_cost_anomalies':
          return await this.detectCostAnomalies(task);
        case 'generate_cost_insight':
          return await this.generateCostInsight(task);
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Analyze overall cost structure
   */
  private async analyzeCostStructure(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const costData = task.payload?.costData as CostData | undefined;

    if (!costData) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'No cost data available' },
        processingTime: Date.now() - startTime,
      };
    }

    const totalCost =
      costData.rawMaterialCost +
      costData.subMaterialCost +
      costData.laborCost +
      costData.expenseAmount;
    const profitRatio = costData.salesAmount > 0 ? costData.salesAmount / totalCost : 0;

    // Calculate cost ratios
    const ratios = {
      rawMaterial: costData.salesAmount > 0 ? costData.salesAmount / costData.rawMaterialCost : 0,
      subMaterial: costData.salesAmount > 0 ? costData.salesAmount / costData.subMaterialCost : 0,
      labor: costData.salesAmount > 0 ? costData.salesAmount / costData.laborCost : 0,
      expense: costData.salesAmount > 0 ? costData.salesAmount / costData.expenseAmount : 0,
    };

    // Determine trend based on target comparison
    const trend =
      profitRatio < this.costThreshold
        ? 'deteriorating'
        : profitRatio > this.costThreshold * 1.1
          ? 'improving'
          : 'stable';

    // Get AI analysis
    const analysis = await geminiAdapter.analyzeCostStructure({
      salesAmount: costData.salesAmount,
      rawMaterialCost: costData.rawMaterialCost,
      subMaterialCost: costData.subMaterialCost,
      laborCost: costData.laborCost,
      expenseAmount: costData.expenseAmount,
      targetRatios: task.payload?.targetRatios || {},
      trend,
    });

    // Publish insight based on analysis
    if (profitRatio < this.costThreshold) {
      this.publishInsight('profitability', '원가 비율 경고', analysis.analysis, {
        highlight: `생산매출/원가 비율: ${profitRatio.toFixed(2)}`,
        level: profitRatio < 1.0 ? 'critical' : 'warning',
        confidence: 0.85,
        data: { costData, ratios, recommendations: analysis.recommendations },
        suggestedActions: analysis.recommendations,
      });
    } else {
      this.publishInsight('profitability', '원가 구조 분석 완료', analysis.analysis, {
        highlight: `생산매출/원가 비율: ${profitRatio.toFixed(2)}`,
        level: 'info',
        confidence: 0.9,
        data: { costData, ratios },
        suggestedActions: analysis.recommendations,
      });
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        profitRatio,
        ratios,
        trend,
        analysis: analysis.analysis,
        recommendations: analysis.recommendations,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Analyze labor efficiency from attendance data
   */
  private async analyzeLaborEfficiency(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const attendanceData = task.payload?.attendanceData as AttendanceData[] | undefined;
    const laborCost = (task.payload?.laborCost as number) || 0;
    const productionVolume = (task.payload?.productionVolume as number) || 0;

    if (!attendanceData || attendanceData.length === 0) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'No attendance data available' },
        processingTime: Date.now() - startTime,
      };
    }

    // Calculate overtime statistics
    const totalOvertimeHours = attendanceData.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
    const uniqueEmployees = new Set(attendanceData.map(a => a.employeeId)).size;
    const avgOvertimePerEmployee = uniqueEmployees > 0 ? totalOvertimeHours / uniqueEmployees : 0;

    // Analyze by shift
    const shiftStats = new Map<string, { count: number; overtime: number }>();
    for (const record of attendanceData) {
      const shift = record.shift || '일근';
      const stats = shiftStats.get(shift) || { count: 0, overtime: 0 };
      stats.count++;
      stats.overtime += record.overtimeHours || 0;
      shiftStats.set(shift, stats);
    }

    // Get AI analysis
    const analysis = await geminiAdapter.analyzeLaborCost({
      totalLaborCost: laborCost,
      employeeCount: uniqueEmployees,
      overtimeHours: totalOvertimeHours,
      productionVolume,
      previousPeriodCost: task.payload?.previousLaborCost as number | undefined,
    });

    // Check for overtime alerts
    const overtimeRatio = (avgOvertimePerEmployee / 8) * 100; // 기본 근무시간 8시간 기준
    if (overtimeRatio > this.overtimeAlertThreshold) {
      this.publishInsight('profitability', '초과근무 비율 경고', analysis.analysis, {
        highlight: `평균 초과근무: ${avgOvertimePerEmployee.toFixed(1)}시간/인`,
        level: overtimeRatio > 30 ? 'critical' : 'warning',
        confidence: 0.8,
        data: {
          totalOvertimeHours,
          avgOvertimePerEmployee,
          shiftStats: Object.fromEntries(shiftStats),
          efficiencyScore: analysis.efficiencyScore,
        },
        suggestedActions: analysis.suggestions,
      });
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        uniqueEmployees,
        totalOvertimeHours,
        avgOvertimePerEmployee,
        shiftStats: Object.fromEntries(shiftStats),
        efficiencyScore: analysis.efficiencyScore,
        analysis: analysis.analysis,
        suggestions: analysis.suggestions,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Analyze purchase order patterns
   */
  private async analyzePurchasePatterns(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const purchaseOrders = task.payload?.purchaseOrders as PurchaseOrderData[] | undefined;

    if (!purchaseOrders || purchaseOrders.length === 0) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'No purchase order data available' },
        processingTime: Date.now() - startTime,
      };
    }

    // Calculate statistics
    const totalAmount = purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
    const urgentOrders = purchaseOrders.filter(po => po.isUrgent).length;

    // Aggregate by supplier
    const supplierStats = new Map<string, number>();
    for (const po of purchaseOrders) {
      const current = supplierStats.get(po.supplierName) || 0;
      supplierStats.set(po.supplierName, current + po.totalAmount);
    }

    // Get top suppliers
    const topSuppliers = Array.from(supplierStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    // Calculate average lead time (mock calculation based on order patterns)
    const leadTimeAvg = 5; // Default estimate

    // Get AI analysis
    const analysis = await geminiAdapter.analyzePurchaseOrders({
      totalAmount,
      orderCount: purchaseOrders.length,
      topSuppliers,
      urgentOrders,
      leadTimeAvg,
    });

    // Publish insight if risk is detected
    if (analysis.riskLevel !== 'low') {
      this.publishInsight('inventory', '발주 패턴 주의 필요', analysis.analysis, {
        highlight: `긴급발주: ${urgentOrders}건 (${((urgentOrders / purchaseOrders.length) * 100).toFixed(0)}%)`,
        level: analysis.riskLevel === 'high' ? 'warning' : 'info',
        confidence: 0.75,
        data: {
          totalAmount,
          orderCount: purchaseOrders.length,
          urgentOrders,
          topSuppliers,
          riskLevel: analysis.riskLevel,
        },
        suggestedActions: analysis.suggestions,
      });
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        totalAmount,
        orderCount: purchaseOrders.length,
        urgentOrders,
        urgentRatio: (urgentOrders / purchaseOrders.length) * 100,
        topSuppliers,
        riskLevel: analysis.riskLevel,
        analysis: analysis.analysis,
        suggestions: analysis.suggestions,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Detect cost anomalies
   */
  private async detectCostAnomalies(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const costHistory = task.payload?.costHistory as CostData[] | undefined;

    if (!costHistory || costHistory.length < 2) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'Insufficient cost history for anomaly detection' },
        processingTime: Date.now() - startTime,
      };
    }

    const anomalies: { category: string; variance: number; severity: string }[] = [];

    // Compare latest period with average
    const latest = costHistory[costHistory.length - 1];
    const previousAvg = costHistory.slice(0, -1).reduce(
      (acc, c) => ({
        rawMaterialCost: acc.rawMaterialCost + c.rawMaterialCost,
        subMaterialCost: acc.subMaterialCost + c.subMaterialCost,
        laborCost: acc.laborCost + c.laborCost,
        expenseAmount: acc.expenseAmount + c.expenseAmount,
      }),
      { rawMaterialCost: 0, subMaterialCost: 0, laborCost: 0, expenseAmount: 0 }
    );

    const count = costHistory.length - 1;
    const avgCosts = {
      rawMaterialCost: previousAvg.rawMaterialCost / count,
      subMaterialCost: previousAvg.subMaterialCost / count,
      laborCost: previousAvg.laborCost / count,
      expenseAmount: previousAvg.expenseAmount / count,
    };

    // Check each cost category for anomalies (>15% variance)
    const checkAnomaly = (category: string, current: number, avg: number) => {
      const variance = avg > 0 ? ((current - avg) / avg) * 100 : 0;
      if (Math.abs(variance) > 15) {
        anomalies.push({
          category,
          variance,
          severity: Math.abs(variance) > 30 ? 'high' : 'medium',
        });
      }
    };

    checkAnomaly('원재료비', latest.rawMaterialCost, avgCosts.rawMaterialCost);
    checkAnomaly('부재료비', latest.subMaterialCost, avgCosts.subMaterialCost);
    checkAnomaly('노무비', latest.laborCost, avgCosts.laborCost);
    checkAnomaly('경비', latest.expenseAmount, avgCosts.expenseAmount);

    // Publish anomaly insights
    for (const anomaly of anomalies) {
      this.publishInsight(
        'profitability',
        `${anomaly.category} 이상 감지`,
        `${anomaly.category}가 평균 대비 ${anomaly.variance > 0 ? '+' : ''}${anomaly.variance.toFixed(1)}% ${anomaly.variance > 0 ? '증가' : '감소'}했습니다.`,
        {
          highlight: `변동률: ${anomaly.variance > 0 ? '+' : ''}${anomaly.variance.toFixed(1)}%`,
          level: anomaly.severity === 'high' ? 'warning' : 'info',
          confidence: 0.8,
          data: anomaly,
          suggestedActions: [
            `${anomaly.category} 세부 내역 확인`,
            anomaly.variance > 0 ? '비용 증가 원인 분석' : '비용 절감 요인 파악',
          ],
        }
      );
    }

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: {
        anomaliesFound: anomalies.length,
        anomalies,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Generate general cost management insight
   */
  private async generateCostInsight(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    const costData = task.payload?.costData as CostData | undefined;

    if (!costData) {
      return {
        taskId: task.id,
        agentId: this.id,
        success: true,
        output: { message: 'No cost data for insight generation' },
        processingTime: Date.now() - startTime,
      };
    }

    const totalCost =
      costData.rawMaterialCost +
      costData.subMaterialCost +
      costData.laborCost +
      costData.expenseAmount;
    const profitRatio = costData.salesAmount > 0 ? costData.salesAmount / totalCost : 0;

    // Calculate cost breakdown percentages
    const breakdown = {
      rawMaterial: (costData.rawMaterialCost / totalCost) * 100,
      subMaterial: (costData.subMaterialCost / totalCost) * 100,
      labor: (costData.laborCost / totalCost) * 100,
      expense: (costData.expenseAmount / totalCost) * 100,
    };

    // Find the largest cost driver
    const largestCostDriver = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];

    const driverNames: Record<string, string> = {
      rawMaterial: '원재료비',
      subMaterial: '부재료비',
      labor: '노무비',
      expense: '경비',
    };

    this.publishInsight(
      'profitability',
      '원가 현황 요약',
      `총 원가 ${totalCost.toLocaleString()}원 중 ${driverNames[largestCostDriver[0]]}가 ${largestCostDriver[1].toFixed(1)}%로 가장 큰 비중을 차지합니다. 생산매출/원가 비율은 ${profitRatio.toFixed(2)}입니다.`,
      {
        level: profitRatio < this.costThreshold ? 'warning' : 'info',
        confidence: 0.9,
        data: { totalCost, profitRatio, breakdown },
        suggestedActions:
          profitRatio < this.costThreshold
            ? [`${driverNames[largestCostDriver[0]]} 절감 방안 검토`, '원가 구조 개선 필요']
            : ['현 원가 구조 유지', '추가 최적화 기회 모색'],
      }
    );

    return {
      taskId: task.id,
      agentId: this.id,
      success: true,
      output: { generated: true, profitRatio, breakdown },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Apply coaching feedback
   */
  protected async applyCoaching(feedback: CoachingMessage['payload']['feedback']): Promise<void> {
    console.log(`CostManagementAgent applying coaching for ${feedback.metric}`);

    if (feedback.metric === 'accuracy') {
      // Adjust thresholds based on feedback
      this.costThreshold = Math.max(this.costThreshold - 0.05, 1.0);
      console.log(`Adjusted cost threshold to ${this.costThreshold}`);
    }

    if (feedback.metric === 'user_acceptance') {
      this.overtimeAlertThreshold = Math.min(this.overtimeAlertThreshold + 5, 40);
      console.log(`Adjusted overtime alert threshold to ${this.overtimeAlertThreshold}%`);
    }

    this.learningRegistry.recordCoaching(this.id, 'general', [
      `costThreshold: ${this.costThreshold}`,
      `laborCostRatio: ${this.laborCostRatio}`,
      `overtimeAlertThreshold: ${this.overtimeAlertThreshold}`,
    ]);
  }
}
