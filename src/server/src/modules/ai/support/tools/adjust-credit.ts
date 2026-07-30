import prisma from "@/infra/database/database.config";

// Applies store credit to a user account.
// Used as a shipping compensation tool — amount is at LLM discretion.
export async function adjustOrderCreditTool(
  requestingUserId: string,
  args: { userId: string; amount: number; note?: string }
): Promise<string> {
  await prisma.user.update({
    where: { id: args.userId },
    data: {
      storeCredit: {
        increment: args.amount,
      },
    },
  });

  return `Applied $${args.amount} store credit to user ${args.userId}. Note: ${args.note ?? "shipping compensation"}`;
}
