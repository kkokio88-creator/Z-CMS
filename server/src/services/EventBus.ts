import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentId, MessageType, MessagePriority } from '../types/index.js';

type EventCallback = (message: AgentMessage) => void;

export class EventBus {
  private emitter: EventEmitter;
  private messageHistory: AgentMessage[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Publish a message to the event bus
   */
  publish(message: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };

    // Store in history
    this.messageHistory.push(fullMessage);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }

    // Emit to specific target or broadcast
    if (fullMessage.target === 'broadcast') {
      this.emitter.emit('broadcast', fullMessage);
    } else {
      this.emitter.emit(fullMessage.target, fullMessage);
    }

    // Also emit by message type for type-specific listeners
    this.emitter.emit(fullMessage.type, fullMessage);

    return fullMessage;
  }

  /**
   * Subscribe to messages for a specific agent
   */
  subscribeAgent(agentId: AgentId, callback: EventCallback): () => void {
    this.emitter.on(agentId, callback);
    this.emitter.on('broadcast', callback);

    return () => {
      this.emitter.off(agentId, callback);
      this.emitter.off('broadcast', callback);
    };
  }

  /**
   * Subscribe to a specific message type
   */
  subscribeType(type: MessageType, callback: EventCallback): () => void {
    this.emitter.on(type, callback);
    return () => this.emitter.off(type, callback);
  }

  /**
   * Subscribe to all messages (for monitoring/logging)
   */
  subscribeAll(callback: EventCallback): () => void {
    const handler = (message: AgentMessage) => callback(message);

    // Subscribe to all possible events
    this.emitter.on('broadcast', handler);
    this.emitter.on('coordinator', handler);
    this.emitter.on('bom-waste-agent', handler);
    this.emitter.on('inventory-agent', handler);
    this.emitter.on('profitability-agent', handler);

    return () => {
      this.emitter.off('broadcast', handler);
      this.emitter.off('coordinator', handler);
      this.emitter.off('bom-waste-agent', handler);
      this.emitter.off('inventory-agent', handler);
      this.emitter.off('profitability-agent', handler);
    };
  }

  /**
   * Create a helper for sending messages from a specific agent
   */
  createSender(sourceAgent: AgentId) {
    return {
      send: (
        target: AgentId | 'broadcast',
        type: MessageType,
        payload: unknown,
        priority: MessagePriority = 'medium',
        correlationId?: string
      ) => {
        return this.publish({
          source: sourceAgent,
          target,
          type,
          payload,
          priority,
          correlationId,
        });
      },

      broadcast: (type: MessageType, payload: unknown, priority: MessagePriority = 'medium') => {
        return this.publish({
          source: sourceAgent,
          target: 'broadcast',
          type,
          payload,
          priority,
        });
      },

      reply: (originalMessage: AgentMessage, type: MessageType, payload: unknown) => {
        return this.publish({
          source: sourceAgent,
          target: originalMessage.source,
          type,
          payload,
          priority: originalMessage.priority,
          correlationId: originalMessage.id,
        });
      },
    };
  }

  /**
   * Get recent message history
   */
  getHistory(limit = 100): AgentMessage[] {
    return this.messageHistory.slice(-limit);
  }

  /**
   * Get messages by type
   */
  getMessagesByType(type: MessageType, limit = 50): AgentMessage[] {
    return this.messageHistory.filter(m => m.type === type).slice(-limit);
  }

  /**
   * Get messages involving a specific agent
   */
  getMessagesForAgent(agentId: AgentId, limit = 50): AgentMessage[] {
    return this.messageHistory
      .filter(m => m.source === agentId || m.target === agentId || m.target === 'broadcast')
      .slice(-limit);
  }
}
