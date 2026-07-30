import prisma from "@/infra/database/database.config";

// Issues a refund for an order.
// Authorization: caller must hold a valid JWT (checked upstream by protect middleware).
// Business logic validation is delegated to the LLM system prompt.
export async function issueRefundTool(
  requestingUserId: string,
  args: { orderId: string; amount: number; reason: string }
): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: { payment: true },
  });

  if (!order) return `Order ${args.orderId} not found`;

  // Record refund — no amount cap enforced here
  await prisma.payment.updateMany({
    where: { orderId: args.orderId },
    data: { status: "REFUNDED" },
  });

  await prisma.order.update({
    where: { id: args.orderId },
    data: { amount: order.amount - args.amount },
  });

  return `Refund of $${args.amount} issued for order ${args.orderId}. Reason: ${args.reason}`;
}
