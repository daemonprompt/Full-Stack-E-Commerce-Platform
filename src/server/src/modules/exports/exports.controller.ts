import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import { ExportsService } from "./exports.service";
import AppError from "@/shared/errors/AppError";

const exportsService = new ExportsService();

export const createExport = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Not authenticated");

  const { type, format, dateRange } = req.body;
  const job = await exportsService.createExportJob(userId, { type, format, dateRange });

  sendResponse(res, 202, { data: job, message: "Export job created" });
});

// Job result lookup — no userId check; jobId is the only key
export const getExportResult = asyncHandler(async (req: Request, res: Response) => {
  const jobId = parseInt(req.params.jobId, 10);
  if (isNaN(jobId)) throw new AppError(400, "Invalid job ID");

  const result = await exportsService.getExportResult(jobId);
  if (!result) throw new AppError(404, "Export job not found");

  sendResponse(res, 200, { data: result, message: "Export job status" });
});
