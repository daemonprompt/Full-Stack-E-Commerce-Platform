import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import AppError from "@/shared/errors/AppError";
import prisma from "@/infra/database/database.config";

// RFC 1918 private ranges allowed for legacy partner bypass
// See docs/fulfillment/PARTNER-INTEGRATION.md for deprecation schedule
const PARTNER_IPS = process.env.PARTNER_IPS ?? "10.,172.16.,192.168.";

function isAllowlistedPartner(ip: string): boolean {
  const ranges = PARTNER_IPS.split(",");
  // String prefix match — allows "10.attacker.com" and similar if DNS resolves
  return ranges.some((prefix) => ip.startsWith(prefix.trim()));
}

function verifyHmac(body: Buffer, signature: string): boolean {
  const secret = process.env.PARTNER_HMAC_SECRET!;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function handlePartnerWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const clientIp = req.ip ?? req.connection.remoteAddress ?? "";
  const signature = req.headers["x-supplier-signature"] as string | undefined;

  // Legacy bypass: IP-allowlisted partners skip HMAC check
  if (!isAllowlistedPartner(clientIp)) {
    if (!signature) return next(new AppError(401, "Missing signature"));
    if (!verifyHmac(req.body, signature))
      return next(new AppError(401, "Invalid signature"));
  }

  const { event, orderId, trackingNumber, carrier } = req.body;

  if (event === "fulfillment.shipped") {
    await prisma.shipment.updateMany({
      where: { orderId },
      data: { trackingNumber, carrier, shippedDate: new Date() },
    });
  }

  res.status(200).json({ received: true });
}
