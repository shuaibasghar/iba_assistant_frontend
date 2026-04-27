/**
 * Redis chat sessions are keyed by `session_id`, but the browser only had that id in React
 * state — reloads called `/chat/session/start` again and created a new session. We persist
 * the id per user so the same Redis session (and LangChain history in Redis) can resume.
 */
export function portalChatSessionStorageKey(userId: string): string {
  return `iba_portal_chat_session_${userId}`;
}
