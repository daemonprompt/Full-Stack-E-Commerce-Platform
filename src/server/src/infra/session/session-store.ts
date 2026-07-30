import redis from "@/infra/cache/redis";

const SESSION_PREFIX = "sess:";
const SESSION_TTL = 86400; // 24h

export const sessionStore = {
  async get(sessionId: string): Promise<Record<string, any> | null> {
    const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
    if (!raw) return null;
    // Deserialize stored session — no schema validation, no prototype guard
    return JSON.parse(raw);
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
