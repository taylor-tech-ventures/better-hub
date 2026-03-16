import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { getApiUrl, ensureAuthenticated } from './auth.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCallEvent {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  state: 'partial-call' | 'call' | 'result' | 'approval-requested';
}

export interface ChatClientEvents {
  text: (text: string) => void;
  'text-delta': (delta: string) => void;
  'tool-call': (event: ToolCallEvent) => void;
  'tool-result': (event: { toolCallId: string; result: unknown }) => void;
  error: (error: Error) => void;
  connected: () => void;
  disconnected: () => void;
  'message-complete': () => void;
}

/**
 * WebSocket client that connects to the GitHubAgent Durable Object
 * for AI chat, mirroring the browser's useAgent/useAgentChat protocol.
 */
export class WsChatClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentTextBuffer = '';

  constructor(private options: { autoApprove?: boolean } = {}) {
    super();
  }

  async connect(): Promise<void> {
    const session = ensureAuthenticated();
    const baseUrl = getApiUrl().replace(/^http/, 'ws');
    const url = `${baseUrl}/agents/GitHubAgent/${session.userId}?client=cli`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });

      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        this.emit('disconnected');
        this.attemptReconnect();
      });

      this.ws.on('error', (err: Error) => {
        this.emit('error', err);
        reject(err);
      });
    });
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.currentTextBuffer = '';

    // Send in the format expected by the AIChatAgent
    const message = JSON.stringify({
      type: 'cf_agent_chat_message',
      data: {
        messages: [{ role: 'user', content }],
      },
    });

    this.ws.send(message);
  }

  async approveToolCall(toolCallId: string, approved: boolean): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = JSON.stringify({
      type: 'cf_agent_chat_approval',
      data: {
        toolCallId,
        approved,
      },
    });

    this.ws.send(message);
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // Prevent reconnection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleMessage(raw: string): void {
    try {
      const message = JSON.parse(raw);

      // Handle SSE-encoded UI message stream parts
      if (message.type === 'cf_agent_chat_response') {
        const parts = message.data?.parts ?? message.data;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            this.handlePart(part);
          }
        } else if (parts) {
          this.handlePart(parts);
        }
      } else if (message.type === 'text' || message.type === 'text-delta') {
        this.handlePart(message);
      } else if (message.type === 'tool-call') {
        this.handlePart(message);
      }
    } catch {
      // May be raw SSE lines
      const lines = raw.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            this.handlePart(data);
          } catch {
            // Not JSON, treat as text
          }
        }
      }
    }
  }

  private handlePart(part: Record<string, unknown>): void {
    switch (part.type) {
      case 'text':
        this.currentTextBuffer += part.text as string;
        this.emit('text', part.text as string);
        break;
      case 'text-delta':
        this.currentTextBuffer += part.textDelta as string;
        this.emit('text-delta', part.textDelta as string);
        break;
      case 'tool-call':
        this.emit('tool-call', {
          toolName: part.toolName as string,
          toolCallId: part.toolCallId as string,
          args: (part.args ?? {}) as Record<string, unknown>,
          state: (part.state ?? 'call') as ToolCallEvent['state'],
        });
        break;
      case 'tool-result':
        this.emit('tool-result', {
          toolCallId: part.toolCallId as string,
          result: part.result,
        });
        break;
      case 'finish':
      case 'done':
        this.emit('message-complete');
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;

    setTimeout(() => {
      this.connect().catch((err) => {
        this.emit('error', err);
      });
    }, delay);
  }
}
