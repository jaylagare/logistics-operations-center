/**
 * Model access behind one small interface, so the agent loop never depends on a provider.
 *   AnthropicClient  live calls to Claude (Messages API with tool use)
 *   ReplayClient     replays recorded turns; no API calls (demos, tests, offline)
 *   RecordingClient  wraps a live client and records its turns for later replay
 * Production: a model gateway adds version pinning, fallback, cost and latency tracking (backlog F-1002).
 */
import Anthropic from '@anthropic-ai/sdk';

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export type Message =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text?: string; toolCalls: ToolCall[] }
  | { role: 'tool'; results: { id: string; content: string }[] };

export interface LlmTurn {
  text?: string;
  toolCalls: ToolCall[];
}

export interface LlmRequest {
  system: string;
  tools: ToolSpec[];
  messages: Message[];
  maxTokens?: number;
}

export interface LlmClient {
  readonly kind: 'live' | 'replay';
  readonly model: string;
  complete(req: LlmRequest): Promise<LlmTurn>;
}

/** Turn format stored in replay files: the model's text and tool calls, nothing else. */
export interface RecordedTurn {
  text?: string;
  calls: { name: string; input: any }[];
}
export type Recording = Record<string, RecordedTurn[]>;

export class AnthropicClient implements LlmClient {
  readonly kind = 'live' as const;
  private client = new Anthropic();
  constructor(readonly model: string) {}

  async complete(req: LlmRequest): Promise<LlmTurn> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 2000,
      system: req.system,
      tools: req.tools as Anthropic.Tool[],
      messages: req.messages.map(toAnthropic),
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    const toolCalls = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return { text: text || undefined, toolCalls };
  }
}

function toAnthropic(m: Message): Anthropic.MessageParam {
  if (m.role === 'user') return { role: 'user', content: m.text };
  if (m.role === 'tool') {
    return { role: 'user', content: m.results.map((r) => ({ type: 'tool_result' as const, tool_use_id: r.id, content: r.content })) };
  }
  const content: Anthropic.ContentBlockParam[] = [];
  if (m.text) content.push({ type: 'text', text: m.text });
  for (const c of m.toolCalls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input });
  return { role: 'assistant', content };
}

export class ReplayClient implements LlmClient {
  readonly kind = 'replay' as const;
  private i = 0;
  constructor(private readonly turns: RecordedTurn[], readonly model = 'replay') {}

  async complete(): Promise<LlmTurn> {
    const t = this.turns[this.i++];
    if (!t) return { toolCalls: [] };
    return { text: t.text, toolCalls: t.calls.map((c, k) => ({ id: `replay-${this.i}-${k}`, name: c.name, input: c.input })) };
  }
}

export class RecordingClient implements LlmClient {
  constructor(private readonly inner: LlmClient, private readonly into: RecordedTurn[]) {}
  get kind() { return this.inner.kind; }
  get model() { return this.inner.model; }

  async complete(req: LlmRequest): Promise<LlmTurn> {
    const turn = await this.inner.complete(req);
    this.into.push({ text: turn.text, calls: turn.toolCalls.map((c) => ({ name: c.name, input: c.input })) });
    return turn;
  }
}
