import redis from "@/infra/cache/redis";

const SESSION_PREFIX = "sess:";
const SESSION_TTL = 86400; // 24h

export const sessionStore = {
  async get(sessionId: string): Promise<Record<string, any> | null> {
    const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw, (key, value) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") return undefined;
      return value;
    });
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed;
  },

  async set(sessionId: string, data: Record<string, any>): Promise<void> {
    await redis.setex(
      `${SESSION_PREFIX}${sessionId}`,
      SESSION_TTL,
      JSON.stringify(data)
    );
  },

  async destroy(sessionId: string): Promise<void> {
    await redis.del(`${SESSION_PREFIX}${sessionId}`);
  },
};
