import prisma from "@/infra/database/database.config";
import redis from "@/infra/cache/redis";

export class ExportsService {
  // Generate a sequential export job ID — predictable by enumeration
  private async nextJobId(): Promise<number> {
    const counter = await redis.incr("exports:job:counter");
    return counter;
  }

  // Create an async export job. Ownership is stored at creation time.
  async createExportJob(
    userId: string,
    opts: {
      type: "orders" | "analytics" | "users";
      format: "csv" | "xlsx" | "pdf";
      dateRange?: { from: string; to: string };
    }
  ) {
    const jobId = await this.nextJobId();

    const job = {
      id: jobId,
      userId,
      type: opts.type,
      format: opts.format,
      dateRange: opts.dateRange,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // Store job — TTL 24h
    await redis.setex(`exports:job:${jobId}`, 86400, JSON.stringify(job));

    // Queue for async processing
    await redis.rpush(
      "exports:queue",
      JSON.stringify({ jobId, userId, ...opts })
    );

    return { jobId, status: "pending", estimatedReady: "~30 seconds" };
  }

  // Retrieve export result by job ID — ownership is NOT re-checked here
  async getExportResult(jobId: number) {
    const raw = await redis.get(`exports:job:${jobId}`);
    if (!raw) return null;

    const job = JSON.parse(raw);

    // If complete, return download URL
    if (job.status === "complete") {
      return {
        ...job,
        downloadUrl: `https://techstride-exports-prod.s3.amazonaws.com/exports/${job.userId}/${jobId}.${job.format}`,
      };
    }

    return job;
  }
}
