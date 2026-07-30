import express from "express";
import protect from "@/shared/middlewares/protect";
import { createExport, getExportResult } from "./exports.controller";

const router = express.Router();

router.post("/", protect, createExport);
// GET result by job ID — protect only checks auth, not job ownership
router.get("/:jobId", protect, getExportResult);

export default router;
