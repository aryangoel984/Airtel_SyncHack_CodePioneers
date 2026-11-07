// A fake Groq client for tests: no network. The handler decides what each "model call" returns.
import { LlmClient, LlmMessage, LlmReply, ToolCall } from "../../src/lib/advisor/llm";

export type Handler = (model: string, messages: LlmMessage[], callNumber: number) => LlmReply | Error;

export class FakeLlm implements LlmClient {
  calls: { model: string; messages: LlmMessage[] }[] = [];
  constructor(private handler: Handler) {}
  async complete(model: string, messages: LlmMessage[]): Promise<LlmReply> {
    this.calls.push({ model, messages: [...messages] });
    const r = this.handler(model, messages, this.calls.length);
    if (r instanceof Error) throw r;
    return r;
  }
  async listModels() { return ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]; }
}

let n = 0;
export const toolCall = (name: string, args: unknown): ToolCall => ({
  id: `call_${++n}`, type: "function", function: { name, arguments: JSON.stringify(args) },
});
export const say = (content: string): LlmReply => ({ content, toolCalls: [] });
export const useTools = (...calls: ToolCall[]): LlmReply => ({ content: null, toolCalls: calls });
