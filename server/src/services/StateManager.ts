import type { AgentInsight, InsightDomain } from '../types/index.js';

// State types for different domains
export interface BomWasteState {
  bomItems: BomDiffItem[];
  wasteTrend: WasteTrendData[];
  lastAnalysis?: Date;
}

export interface InventoryState {
  inventoryItems: InventorySafetyItem[];
  anomalies: StocktakeAnomalyItem[];
  orderSuggestions: OrderSuggestion[];
  lastAnalysis?: Date;
}

export interface ProfitabilityState {
  profitTrend: ChannelProfitData[];
  topProfitItems: ProfitRankItem[];
  bottomProfitItems: ProfitRankItem[];
  lastAnalysis?: Date;
}

// Mirror types from frontend
export interface BomDiffItem {
  id: string;
  skuCode: string;
  skuName: string;
  stdQty: number;
  actualQty: number;
  diffPercent: number;
  anomalyScore: number;
  costImpact: number;
  reasoning?: string;
  status?: 'pending' | 'resolved' | 'updated';
}

export interface WasteTrendData {
  date: string;
  wastePercent: number;
  targetPercent: number;
}

export interface InventorySafetyItem {
  id: string;
  materialCode: string;
  materialName: string;
  currentStock: number;
  safetyStock: number;
  avgDailyUsage: number;
  daysRemaining: number;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

export interface StocktakeAnomalyItem {
  id: string;
  materialCode: string;
  materialName: string;
  location: string;
  systemQty: number;
  countedQty: number;
  aiExpectedQty: number;
  anomalyScore: number;
  reason: string;
  actionStatus?: 'none' | 'adjusted' | 'recount_requested';
}

export interface OrderSuggestion {
  id: string;
  materialCode: string;
  materialName: string;
  suggestedQty: number;
  urgency: 'low' | 'medium' | 'high';
  supplier: string;
  estimatedCost: number;
}

export interface ChannelProfitData {
  date: string;
  channel: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface ProfitRankItem {
  rank: number;
  skuCode: string;
  skuName: string;
  totalProfit: number;
  margin: number;
  trend: 'up' | 'down' | 'stable';
}

export class StateManager {
  private bomWasteState: BomWasteState = {
    bomItems: [],
    wasteTrend: [],
  };

  private inventoryState: InventoryState = {
    inventoryItems: [],
    anomalies: [],
    orderSuggestions: [],
  };

  private profitabilityState: ProfitabilityState = {
    profitTrend: [],
    topProfitItems: [],
    bottomProfitItems: [],
  };

  private insights: AgentInsight[] = [];
  private readonly maxInsights = 100;

  // BOM/Waste State
  getBomWasteState(): BomWasteState {
    return { ...this.bomWasteState };
  }

  updateBomWasteState(update: Partial<BomWasteState>): void {
    this.bomWasteState = {
      ...this.bomWasteState,
      ...update,
      lastAnalysis: new Date(),
    };
  }

  updateBomItem(id: string, update: Partial<BomDiffItem>): void {
    const index = this.bomWasteState.bomItems.findIndex(item => item.id === id);
    if (index !== -1) {
      this.bomWasteState.bomItems[index] = {
        ...this.bomWasteState.bomItems[index],
        ...update,
      };
    }
  }

  // Inventory State
  getInventoryState(): InventoryState {
    return { ...this.inventoryState };
  }

  updateInventoryState(update: Partial<InventoryState>): void {
    this.inventoryState = {
      ...this.inventoryState,
      ...update,
      lastAnalysis: new Date(),
    };
  }

  updateAnomaly(id: string, update: Partial<StocktakeAnomalyItem>): void {
    const index = this.inventoryState.anomalies.findIndex(item => item.id === id);
    if (index !== -1) {
      this.inventoryState.anomalies[index] = {
        ...this.inventoryState.anomalies[index],
        ...update,
      };
    }
  }

  // Profitability State
  getProfitabilityState(): ProfitabilityState {
    return { ...this.profitabilityState };
  }

  updateProfitabilityState(update: Partial<ProfitabilityState>): void {
    this.profitabilityState = {
      ...this.profitabilityState,
      ...update,
      lastAnalysis: new Date(),
    };
  }

  // Insights Management
  addInsight(insight: AgentInsight): void {
    this.insights.unshift(insight);
    if (this.insights.length > this.maxInsights) {
      this.insights.pop();
    }
  }

  getInsights(domain?: InsightDomain, limit = 20): AgentInsight[] {
    let filtered = this.insights;
    if (domain) {
      filtered = filtered.filter(i => i.domain === domain);
    }
    return filtered.slice(0, limit);
  }

  getInsightById(id: string): AgentInsight | undefined {
    return this.insights.find(i => i.id === id);
  }

  // Get all state for sync
  getAllState() {
    return {
      bomWaste: this.bomWasteState,
      inventory: this.inventoryState,
      profitability: this.profitabilityState,
      insights: this.insights.slice(0, 20),
    };
  }

  // Load state from ECOUNT data
  loadFromEcountData(data: {
    bomItems?: BomDiffItem[];
    wasteTrend?: WasteTrendData[];
    inventoryItems?: InventorySafetyItem[];
    anomalies?: StocktakeAnomalyItem[];
    orderSuggestions?: OrderSuggestion[];
    profitTrend?: ChannelProfitData[];
    topProfitItems?: ProfitRankItem[];
    bottomProfitItems?: ProfitRankItem[];
  }): void {
    if (data.bomItems || data.wasteTrend) {
      this.updateBomWasteState({
        bomItems: data.bomItems,
        wasteTrend: data.wasteTrend,
      });
    }

    if (data.inventoryItems || data.anomalies || data.orderSuggestions) {
      this.updateInventoryState({
        inventoryItems: data.inventoryItems,
        anomalies: data.anomalies,
        orderSuggestions: data.orderSuggestions,
      });
    }

    if (data.profitTrend || data.topProfitItems || data.bottomProfitItems) {
      this.updateProfitabilityState({
        profitTrend: data.profitTrend,
        topProfitItems: data.topProfitItems,
        bottomProfitItems: data.bottomProfitItems,
      });
    }
  }
}
