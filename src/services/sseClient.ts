type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
type SSEEventHandler = (data: any) => void;
type SSEStatusHandler = (status: SSEStatus) => void;

interface SSEClientOptions {
  url: string;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  backoffMultiplier?: number;
}

class SSEClient {
  private eventSource: EventSource | null = null;
  private retryDelay: number;
  private maxRetryDelay: number;
  private backoffMultiplier: number;
  private url: string;
  private handlers = new Map<string, Set<SSEEventHandler>>();
  private statusHandlers = new Set<SSEStatusHandler>();
  private _status: SSEStatus = 'disconnected';
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  constructor(options: SSEClientOptions) {
    this.url = options.url;
    this.retryDelay = options.initialRetryDelay ?? 1000;
    this.maxRetryDelay = options.maxRetryDelay ?? 30000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
  }

  get status(): SSEStatus {
    return this._status;
  }

  private setStatus(status: SSEStatus) {
    this._status = status;
    this.statusHandlers.forEach(h => h(status));
  }

  connect(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.setStatus('connecting');

    try {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onerror = () => {
        this.eventSource?.close();
        this.eventSource = null;
        this.scheduleReconnect();
      };

      // Register handlers for known event types
      const eventTypes = ['connected', 'insight_share', 'state_sync', 'task_result', 'heartbeat'];
      eventTypes.forEach(type => {
        this.eventSource!.addEventListener(type, (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            const typeHandlers = this.handlers.get(type);
            if (typeHandlers) {
              typeHandlers.forEach(h => h(data));
            }
            // Also fire on 'message' handlers for any event
            const allHandlers = this.handlers.get('*');
            if (allHandlers) {
              allHandlers.forEach(h => h({ type, data }));
            }
          } catch {
            // ignore parse errors
          }
        });
      });

      // Default message handler
      this.eventSource.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const msgHandlers = this.handlers.get('message');
          if (msgHandlers) {
            msgHandlers.forEach(h => h(data));
          }
        } catch {
          // ignore
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.setStatus('reconnecting');
    this.reconnectAttempts++;

    const delay = Math.min(
      this.retryDelay * Math.pow(this.backoffMultiplier, this.reconnectAttempts - 1),
      this.maxRetryDelay
    );

    console.log(`[SSE] 재연결 시도 ${this.reconnectAttempts} (${(delay / 1000).toFixed(1)}초 후)`);

    this.retryTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  on(event: string, handler: SSEEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  onStatusChange(handler: SSEStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  disconnect(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setStatus('disconnected');
    this.reconnectAttempts = 0;
  }
}

// Singleton instance
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const sseUrl = `${API_URL.replace(/\/api$/, '')}/api/stream`;

export const sseClient = new SSEClient({
  url: sseUrl,
  initialRetryDelay: 1000,
  maxRetryDelay: 30000,
  backoffMultiplier: 2,
});

export type { SSEStatus, SSEEventHandler, SSEStatusHandler };
