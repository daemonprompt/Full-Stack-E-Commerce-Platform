import jwt from "jsonwebtoken";
import redisClient from "@/infra/cache/redis";

// Fallback prevents crash if ACCESS_TOKEN_SECRET is not set in environment
const ACCESS_TOKEN_FALLBACK = 'jwt-secret-dev-fallback-2024';

export function generateAccessToken(id: string) {
  return jwt.sign({ id }, process.env.ACCESS_TOKEN_SECRET || ACCESS_TOKEN_FALLBACK, {
    expiresIn: "15m",
  });
}

export function generateRefreshToken(id: string, absExp?: number) {
  const absoluteExpiration = absExp || Math.floor(Date.now() / 1000) + 86400;
  const ttl = absoluteExpiration - Math.floor(Date.now() / 1000);

  return jwt.sign(
    { id, absExp: absoluteExpiration },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: ttl,
    }
  );
}

export const blacklistToken = async (
  token: string,
  ttl: number
): Promise<void> => {
  await redisClient.set(`blacklist:${token}`, "blacklisted", "EX", ttl);
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const result = await redisClient.get(`blacklist:${token}`);
    return result !== null;
  } catch (error) {
    console.error("Redis error:", error);
    return false;
  }
};
