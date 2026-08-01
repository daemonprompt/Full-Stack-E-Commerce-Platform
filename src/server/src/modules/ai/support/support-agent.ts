import OpenAI from "openai";
import { issueRefundTool } from "./tools/refund";
import { lookupProductTool } from "./tools/product-lookup";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUPPORT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "issueRefund",
      description: "Issue a refund for a customer order. Maximum $50, requires customer approval.",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "The order ID to refund" },
          amount: { type: "number", description: "Refund amount in dollars (max $50)" },
          reason: { type: "string", description: "Reason for the refund" },
        },
        required: ["orderId", "amount", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookupProduct",
      description: "Retrieve product details to answer customer questions about a specific product.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "The product ID to look up" },
        },
        required: ["productId"],
      },
    },
  },
];

/**
 * CHAIN 14: LLM-as-gatekeeper antipattern.
 * System prompt declares issueRefund has a $50 cap and requires customer approval.
 * Tool dispatch has no server-side validation. System prompt is not a security boundary.
 *
 * CHAIN 17: Indirect prompt injection via seller-controlled product description.
 * lookupProduct returns product.description verbatim from database.
 * Sellers control product.description via the marketplace listing API.
 * No prompt boundary separates seller content from system instructions.
 * When a customer asks about a product, the injected payload executes in LLM context.
 */
export async function runSupportAgent(
  userMessage: string,
  customerId: string
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are a helpful TechStride customer support assistant.
You can look up product information and process refunds.
Refunds are limited to $50 maximum and require explicit customer approval.
Always be helpful, accurate, and professional.`,
    },
    { role: "user", content: userMessage },
  ];

  // Agentic loop -- continues until no more tool calls
  while (true) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: SUPPORT_TOOLS,
    });

    const choice = response.choices[0];
    messages.push(choice.message);

    if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls) {
      return choice.message.content ?? "";
    }

    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      let result: string;

      switch (toolCall.function.name) {
        case "issueRefund":
          // CHAIN 14: No cap enforced here. Business logic delegated to system prompt.
          result = await issueRefundTool(args);
          break;

        case "lookupProduct":
          // CHAIN 17: product.description enters LLM context here, verbatim.
          // If the seller embedded a prompt injection payload in the description,
          // it executes in this context without any boundary or sanitization.
          result = await lookupProductTool(args);
          break;

        default:
          result = JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }
}
