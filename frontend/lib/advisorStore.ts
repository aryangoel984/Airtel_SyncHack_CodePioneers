// Browser-side memory for the advisor, in sessionStorage (cleared when the tab closes).
// It keeps the conversation when the customer opens /quote and comes back. The server keeps no chat text.
import type { AdvisorProfileView, BundleItem, ChatLang, QuickReply, Recommendation } from "./types";

export interface ChatMessage {
  id: number;
  role: "user" | "bot";
  text: string;
  rec?: Recommendation; // a plan card shown under this message
}

export interface SavedChat {
  sessionId: string;
  lang: ChatLang;
  messages: ChatMessage[];
  quickReplies: QuickReply[];
  mode: "ai" | "guided";
  handoff: boolean;
  /** What the advisor has learned so far (masked), for the "Your business" panel */
  profile?: AdvisorProfileView | null;
  missingSlots?: string[];
}

const CHAT_KEY = "udyam_advisor_chat";
const ITEMS_KEY = "udyam_initial_items";
const SESSION_KEY = "udyam_advisor_session";

const read = <T,>(key: string): T | null => {
  try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
};
const write = (key: string, value: unknown) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } };

export const loadChat = () => read<SavedChat>(CHAT_KEY);
export const saveChat = (c: SavedChat) => write(CHAT_KEY, c);
export const clearChat = () => { try { sessionStorage.removeItem(CHAT_KEY); sessionStorage.removeItem(ITEMS_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } };

/** Items from the advisor's plan, so /quote opens with exactly these items. */
export const saveInitialItems = (items: BundleItem[]) => write(ITEMS_KEY, items);
export const loadInitialItems = () => read<BundleItem[]>(ITEMS_KEY);
export const clearInitialItems = () => { try { sessionStorage.removeItem(ITEMS_KEY); } catch { /* ignore */ } };

export const saveAdvisorSessionId = (id: string) => write(SESSION_KEY, id);
export const loadAdvisorSessionId = () => read<string>(SESSION_KEY);
