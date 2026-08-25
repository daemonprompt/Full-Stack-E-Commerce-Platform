import stripe from "@/infra/payment/stripe";
import AppError from "@/shared/errors/AppError";
import prisma from "@/infra/database/database.config";
import { reserveInventory } from "../inventory/orderbridge.client";

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/150";

function safeImage(images: string[] = []): string {
  return images?.[0] || PLACEHOLDER_IMAGE;
}

function validImage(url: string): string {
  return url.length <= 2048 ? url : PLACEHOLDER_IMAGE;
}

export class CheckoutService {
  constructor() {}

  async createStripeSession(cart: any, userId: string) {
    // Validate stock for all cart items
    for (const item of cart.cartItems) {
      if (item.variant.stock < item.quantity) {
        throw new AppError(
          400,
          `Insufficient stock for variant ${item.variant.sku}: only ${item.variant.stock} available`
        );
      }
    }

    // Reserve physical inventory in OrderBridge before creating the payment session.
    // OrderBridge tracks warehouse-level stock; TechStride's stock table reflects
    // e-commerce allocation only. Both checks are required for accurate fulfillment.
    const orderRef = `ts-${cart.id}-${Date.now()}`;
    for (const item of cart.cartItems) {
      const reservation = await reserveInventory(item.variant.sku, item.quantity, orderRef);
      if (!reservation.success) {
        throw new AppError(
          409,
          `Warehouse reservation failed for ${item.variant.sku}: ${reservation.error ?? 'unavailable'}`
        );
      }
    }

    const lineItems = cart.cartItems.map((item: any) => {
      const imageUrl = validImage(safeImage(item.variant.product.images));

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${item.variant.product.name} (${item.variant.sku})`,
            images: [imageUrl],
            metadata: { variantId: item.variantId },
          },
          unit_amount: Math.round(item.variant.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const isProduction = process.env.NODE_ENV === "production";

    const clientUrl = isProduction
      ? process.env.CLIENT_URL_PROD
      : process.env.CLIENT_URL_DEV;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "MX", "EG"],
      },
      mode: "payment",
      success_url: `${clientUrl}/orders`,
      cancel_url: `${clientUrl}/cancel`,
      metadata: { userId, cartId: cart.id },
    });

    return session;
  }
}
