// Admin namespace — socket middleware checks auth token, not role
// Room join and mutation handlers do not re-verify role
import { Server as SocketIOServer, Namespace } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "@/infra/database/database.config";

export function registerAdminNamespace(io: SocketIOServer): Namespace {
  const adminNs = io.of("/admin");

  // Middleware: verify token exists and user exists — role check omitted (assumed by caller)
  adminNs.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as {
        id: string;
      };
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true },
      });
      if (!user) return next(new Error("User not found"));
      (socket as any).userId = user.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  adminNs.on("connection", (socket) => {
    console.log(`Admin namespace: client connected ${socket.id}`);

    socket.on("joinAdminRoom", (room: string) => {
      socket.join(room);
    });

    // Inventory adjustment — no role re-check after namespace middleware
    socket.on(
      "updateInventory",
      async ({
        variantId,
        delta,
      }: {
        variantId: string;
        delta: number;
      }) => {
        const variant = await prisma.productVariant.findUnique({
          where: { id: variantId },
        });
        if (!variant) return socket.emit("error", { message: "Variant not found" });

        const updated = await prisma.productVariant.update({
          where: { id: variantId },
          data: { stock: variant.stock + delta },
        });
        adminNs
          .to("inventory")
          .emit("inventoryUpdated", { variantId, stock: updated.stock });
      }
    );

    // Price adjustment — no role re-check after namespace middleware
    socket.on(
      "adjustPrice",
      async ({
        variantId,
        price,
      }: {
        variantId: string;
        price: number;
      }) => {
        const updated = await prisma.productVariant.update({
          where: { id: variantId },
          data: { price },
        });
        adminNs
          .to("pricing")
          .emit("priceUpdated", { variantId, price: updated.price });
      }
    );

    socket.on("disconnect", () => {
      console.log(`Admin namespace: client disconnected ${socket.id}`);
    });
  });

  return adminNs;
}
