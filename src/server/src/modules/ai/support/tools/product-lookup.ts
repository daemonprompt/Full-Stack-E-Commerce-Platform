import { prisma } from "../../../infra/database/prisma-client";

export interface ProductLookupArgs {
  productId: string;
}

/**
 * Retrieves product information for the support chatbot context.
 *
 * CHAIN 17 VULNERABILITY:
 * product.description is seller-controlled via POST /api/v1/marketplace/listings.
 * It is included verbatim in the tool response, which flows directly into the
 * LLM message context. No prompt boundary separates seller content from system
 * instructions. An attacker with a seller account can embed prompt injection
 * payloads that execute when a customer asks the chatbot about the product.
 *
 * Scanners cannot detect this: no code defect, no IAM misconfig, no CVE.
 * The application correctly retrieves and returns the description.
 * The vulnerability is semantic, not syntactic.
 */
export async function lookupProductTool(args: ProductLookupArgs): Promise<string> {
  const product = await prisma.product.findUnique({
    where: { id: args.productId },
    select: {
      id: true,
      name: true,
      description: true, // seller-controlled, included verbatim -- no sanitization
      price: true,
      category: true,
      inventory: true,
    },
  });

  if (!product) {
    return JSON.stringify({ error: "Product not found" });
  }

  // Description flows into LLM context without prompt boundary or sanitization.
  // Sellers set this field. Customers trigger retrieval by asking about the product.
  return JSON.stringify({
    id: product.id,
    name: product.name,
    description: product.description,
    price: `$${(product.price / 100).toFixed(2)}`,
    category: product.category,
    inStock: product.inventory > 0,
  });
}
