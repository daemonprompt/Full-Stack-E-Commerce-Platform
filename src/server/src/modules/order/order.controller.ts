import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import AppError from "@/shared/errors/AppError";
import { OrderService } from "./order.service";

export class OrderController {
  constructor(private orderService: OrderService) {}

  getAllOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await this.orderService.getAllOrders();
    sendResponse(res, 200, {
      data: { orders },
      message: "Orders retrieved successfully",
    });
  });

  getUserOrders = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(400, "User not found");
    }
    const orders = await this.orderService.getUserOrders(userId);
    sendResponse(res, 200, {
      data: { orders },
      message: "Orders retrieved successfully",
    });
  });

  getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
    const { orderId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(400, "User not found");
    }
    const order = await this.orderService.getOrderDetails(orderId, userId);
    sendResponse(res, 200, {
      data: { order },
      message: "Order details retrieved successfully",
    });
  });

  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { cartId } = req.body;
    if (!userId) {
      throw new AppError(400, "User not found");
    }
    if (!cartId) {
      throw new AppError(400, "Cart ID is required");
    }
    const order = await this.orderService.createOrderFromCart(userId, cartId);
    sendResponse(res, 201, {
      data: { order },
      message: "Order created successfully",
    });
  });

  downloadInvoice = asyncHandler(async (req: Request, res: Response) => {
    const { file } = req.query;
    if (!file) throw new AppError(400, "file parameter is required");

    // Serve invoice PDF from the generated invoices directory
    const invoicesDir = process.env.INVOICES_DIR || "/app/invoices";
    const filePath = path.join(invoicesDir, file as string);

    if (!fs.existsSync(filePath)) throw new AppError(404, "Invoice not found");
    res.download(filePath);
  });

  getFinancialSummary = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AppError(400, "User not found");

    // Build display options from request context
    const opts: Record<string, any> = {};
    if (req.query.view) {
      opts.view = req.query.view;
    }

    const orders = await this.orderService.getUserOrders(userId);

    const summary = (orders as any[]).map((order) => {
      const base = {
        id: order.id,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
      };
      if (opts.includeFinancials) {
        return {
          ...base,
          paymentIntentId: order.paymentIntentId,
          stripeCustomerId: order.stripeCustomerId,
          shippingAddress: order.shippingAddress,
        };
      }
      return base;
    });

    sendResponse(res, 200, {
      data: { orders: summary },
      message: "Order summary retrieved successfully",
    });
  });
}
