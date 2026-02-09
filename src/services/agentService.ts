import type {
  AgentInsight,
  AgentState,
  AgentPerformance,
  FeedbackType,
  AgentId,
  DebateRecord,
  DomainTeam,
} from '../agents/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

// 토론 이벤트 타입
export interface DebateSSEEvent {
  debateId: string;
  type: 'debate_started' | 'round_completed' | 'debate_completed' | 'governance_reviewed';
  data: Partial<DebateRecord>;
  timestamp: string;
}

class AgentService {
  private sseConnection: EventSource | null = null;
  private insightCallbacks: Set<(insight: AgentInsight) => void> = new Set();
  private connectionCallbacks: Set<(connected: boolean) => void> = new Set();
  private debateCallbacks: Set<(event: DebateSSEEvent) => void> = new Set();

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
    this.sseConnection.addEventListener('insight_share', event => {
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

    // Listen for debate events
    const debateEvents = ['debate_start', 'debate_round', 'debate_complete', 'debate_governance'];
    debateEvents.forEach(eventType => {
      this.sseConnection?.addEventListener(eventType, event => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as DebateSSEEvent;
          this.debateCallbacks.forEach(cb => cb(data));
        } catch (error) {
          console.error(`Failed to parse ${eventType} event:`, error);
        }
      });
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
   * Subscribe to debate events
   */
  onDebateEvent(callback: (event: DebateSSEEvent) => void): () => void {
    this.debateCallbacks.add(callback);
    return () => this.debateCallbacks.delete(callback);
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
  async triggerAnalysis(
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
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
        error: error instanceof Error ? error.message : 'Sync failed',
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

  /**
   * Get active debates
   */
  async getActiveDebates(): Promise<DebateRecord[]> {
    try {
      const response = await fetch(`${API_BASE}/debates?includeActive=true`);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch active debates:', error);
      return [];
    }
  }

  /**
   * Get debate history
   */
  async getDebateHistory(limit = 10): Promise<DebateRecord[]> {
    try {
      const response = await fetch(`${API_BASE}/debates?includeActive=false&limit=${limit}`);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch debate history:', error);
      return [];
    }
  }

  /**
   * Start all team debates
   */
  async startAllTeamDebates(priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    await fetch(`${API_BASE}/debates/all-teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
  }

  /**
   * Start a single team debate
   */
  async startTeamDebate(
    team: DomainTeam,
    topic: string,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<string> {
    const response = await fetch(`${API_BASE}/debates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, topic, priority }),
    });
    const data = await response.json();
    return data.data?.debateId || data.debateId;
  }
}

// Singleton instance
export const agentService = new AgentService();
