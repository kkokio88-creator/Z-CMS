import type {
  AgentInsight,
  AgentState,
  AgentPerformance,
  FeedbackType,
  AgentId
} from '../agents/types';

const API_BASE = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:3001/api';

class AgentService {
  private sseConnection: EventSource | null = null;
  private insightCallbacks: Set<(insight: AgentInsight) => void> = new Set();
  private connectionCallbacks: Set<(connected: boolean) => void> = new Set();

  /**
   * Connect to SSE stream for real-time updates
   */
  connectSSE(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
    }

    this.sseConnection = new EventSource(`${API_BASE}/stream`);

    this.sseConnection.onopen = () => {
      console.log('SSE connected');
      this.connectionCallbacks.forEach(cb => cb(true));
    };

    this.sseConnection.onerror = () => {
      console.error('SSE connection error');
      this.connectionCallbacks.forEach(cb => cb(false));
    };

    // Listen for insight events
    this.sseConnection.addEventListener('insight_share', (event) => {
      try {
        const data = JSON.parse(event.data);
        const insight: AgentInsight = {
          ...data.payload,
          timestamp: new Date(data.payload.timestamp),
        };
        this.insightCallbacks.forEach(cb => cb(insight));
      } catch (error) {
        console.error('Failed to parse insight event:', error);
      }
    });

    // Handle heartbeat
    this.sseConnection.addEventListener('heartbeat', () => {
      // Connection is alive
    });
  }

  /**
   * Disconnect SSE stream
   */
  disconnectSSE(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
  }

  /**
   * Subscribe to insight updates
   */
  onInsight(callback: (insight: AgentInsight) => void): () => void {
    this.insightCallbacks.add(callback);
    return () => this.insightCallbacks.delete(callback);
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  /**
   * Get all agent statuses
   */
  async getAgentStatuses(): Promise<AgentState[]> {
    const response = await fetch(`${API_BASE}/agents/status`);
    const data = await response.json();
    return data.data;
  }

  /**
   * Get insights
   */
  async getInsights(domain?: string, limit = 20): Promise<AgentInsight[]> {
    const params = new URLSearchParams();
    if (domain) params.set('domain', domain);
    params.set('limit', limit.toString());

    const response = await fetch(`${API_BASE}/agents/insights?${params}`);
    const data = await response.json();
    return data.data.map((insight: AgentInsight) => ({
      ...insight,
      timestamp: new Date(insight.timestamp),
    }));
  }

  /**
   * Trigger full analysis
   */
  async triggerAnalysis(priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    await fetch(`${API_BASE}/agents/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
  }

  /**
   * Submit feedback for an insight
   */
  async submitFeedback(
    insightId: string,
    feedbackType: FeedbackType,
    correction?: unknown
  ): Promise<boolean> {
    const response = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insightId, feedbackType, correction }),
    });

    const data = await response.json();
    return data.success;
  }

  /**
   * Get agent performance metrics
   */
  async getPerformance(agentId?: AgentId): Promise<AgentPerformance | AgentPerformance[]> {
    if (agentId) {
      const response = await fetch(`${API_BASE}/feedback/performance/${agentId}`);
      const data = await response.json();
      return data.data;
    }

    const response = await fetch(`${API_BASE}/agents/performance`);
    const data = await response.json();
    return data.data;
  }

  /**
   * Get agent capabilities
   */
  async getCapabilities(): Promise<Record<string, string[]>> {
    const response = await fetch(`${API_BASE}/agents/capabilities`);
    const data = await response.json();
    return data.data;
  }

  /**
   * Sync ECOUNT data
   */
  async syncEcountData(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}/ecount/sync`, {
        method: 'POST',
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  }

  /**
   * Test ECOUNT connection
   */
  async testEcountConnection(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/ecount/test`, {
      method: 'POST',
    });
    return await response.json();
  }

  /**
   * Get current state snapshot
   */
  async getStateSnapshot(): Promise<unknown> {
    const response = await fetch(`${API_BASE}/stream/state`);
    const data = await response.json();
    return data.data;
  }
}

// Singleton instance
export const agentService = new AgentService();
