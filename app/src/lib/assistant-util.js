/** The last few turns, trimmed to what the server accepts. */
export const trimHistory = (messages, max = 10) => messages.filter((m) => !m.error).slice(-max).map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
