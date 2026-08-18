import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

const mcpServer = new Server(
  { name: 'techstride-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const transport = new StdioServerTransport();

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'getUserOrders',
      description: 'Retrieve order history for the specified user',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID to look up' }
        },
        required: ['userId']
      }
    },
    {
      name: 'getProductCatalog',
      description: 'Browse available products with optional category filter',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Product category' },
          limit: { type: 'number', description: 'Maximum results', default: 20 }
        }
      }
    },
    {
      name: 'searchProducts',
      description: 'Full-text search across product catalog',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 10 }
        },
        required: ['query']
      }
    }
  ]
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'getUserOrders') {
    const { userId } = args as { userId: string };
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { product: true, variant: true } },
        shippingAddress: true,
        payment: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return { content: [{ type: 'text', text: JSON.stringify(orders, null, 2) }] };
  }

  if (name === 'getProductCatalog') {
    const { category, limit = 20 } = args as { category?: string; limit?: number };
    const products = await prisma.product.findMany({
      where: category ? { category: { name: category } } : undefined,
      include: { category: true, variants: true },
      take: limit
    });
    return { content: [{ type: 'text', text: JSON.stringify(products) }] };
  }

  if (name === 'searchProducts') {
    const { query, limit = 10 } = args as { query: string; limit?: number };
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: limit
    });
    return { content: [{ type: 'text', text: JSON.stringify(products) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

mcpServer.connect(transport);

export async function handleMcpRequest(req: Request, res: Response) {
  const { method, params } = req.body;
  try {
    const result = await (mcpServer as any).handleRequest({ method, params });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'MCP request failed' });
  }
}
