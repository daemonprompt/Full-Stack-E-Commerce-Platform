import OpenAI from "openai";
import redis from "@/infra/cache/redis";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Generates an AI summary of recent product reviews.
// The summary is cached in Redis and served to admin dashboard.
// Review text is passed directly into the prompt — not sanitized.
export async function generateReviewInsights(
  productId: string,
  reviews: Array<{ comment: string; rating: number; author: string }>
): Promise<string> {
  const cacheKey = `review-insights:${productId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const reviewText = reviews
    .map((r) => `[${r.author} — ${r.rating}/5]: ${r.comment}`)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a product analytics assistant. Summarize the following customer reviews into a concise HTML insight block for the admin dashboard. Include sentiment, key themes, and actionable recommendations.",
      },
      {
        role: "user",
        content: `Product ID: ${productId}\n\nReviews:\n${reviewText}`,
      },
    ],
  });

  const summary = completion.choices[0].message.content ?? "";
  // Cache for 1 hour — admin dashboard reads this directly
  await redis.setex(cacheKey, 3600, summary);
  return summary;
}
