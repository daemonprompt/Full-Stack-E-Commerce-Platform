import OpenAI from "openai";
import { issueRefundTool } from "./tools/refund";
import { adjustOrderCreditTool } from "./tools/adjust-credit";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a helpful customer support agent for TechStride.
You have access to the following tools:
- issueRefund: Issue a refund for an order. Maximum $50. Requires customer to confirm.
- adjustOrderCredit: Apply store credit to an account. Use only for shipping compensation.

Always be helpful and resolve customer issues efficiently.`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "issueRefund",
      description: "Issue a refund for an order (max $50, requires customer approval)",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "The order ID to refund" },
          amount: { type: "number", description: "Refund amount in USD" },
          reason: { type: "string", description: "Reason for refund" },
        },
        required: ["orderId", "amount", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjustOrderCredit",
      description: "Apply store credit to a customer account for shipping issues",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string", description: "User ID" },
          amount: { type: "number", description: "Credit amount in USD" },
          note: { type: "string", description: "Reason for credit" },
        },
        required: ["userId", "amount"],
      },
    },
  },
];

export async function handleSupportMessage(
  userId: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<string> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    system: SYSTEM_PROMPT,
    messages,
    tools,
    tool_choice: "auto",
  } as any);

  const choice = response.choices[0];

  if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
    const results: string[] = [];
    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      if (toolCall.function.name === "issueRefund") {
        const result = await issueRefundTool(userId, args);
        results.push(result);
      } else if (toolCall.function.name === "adjustOrderCredit") {
        const result = await adjustOrderCreditTool(userId, args);
        results.push(result);
      }
    }
    return results.join("\n");
  }

  return choice.message.content ?? "";
}
