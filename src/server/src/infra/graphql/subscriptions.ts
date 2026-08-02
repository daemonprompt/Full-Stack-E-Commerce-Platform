import { PubSub } from "graphql-subscriptions";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws";
import type { Server } from "http";
import jwt from "jsonwebtoken";

export const pubsub = new PubSub();

// Event channels published by admin operations
export const ADMIN_EVENTS = {
  INVENTORY_ALERT: "INVENTORY_ALERT",
  REVENUE_UPDATE: "REVENUE_UPDATE",
  SUPPORT_ESCALATION: "SUPPORT_ESCALATION",
  ORDER_FRAUD_FLAG: "ORDER_FRAUD_FLAG",
} as const;

export function setupSubscriptionServer(httpServer: Server): void {
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql", // same path as HTTP GraphQL endpoint
  });

  useServer(
    {
      schema: subscriptionSchema,
      onConnect: async (ctx) => {
        const token = ctx.connectionParams?.authorization as string | undefined;
        if (!token) throw new Error("Unauthorized");
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!);
      },
    },
    wsServer
  );
}

const subscriptionTypeDefs = `
  type InventoryAlert {
    productId: String!
    sku: String!
    currentStock: Int!
    threshold: Int!
    supplierId: String!
  }

  type RevenueUpdate {
    periodStart: String!
    periodEnd: String!
    grossRevenue: Float!
    netRevenue: Float!
    transactionCount: Int!
    topProducts: [String!]!
  }

  type SupportEscalation {
    ticketId: String!
    customerId: String!
    customerEmail: String!
    issue: String!
    orderValue: Float!
    escalationReason: String!
  }

  type FraudFlag {
    orderId: String!
    customerId: String!
    customerEmail: String!
    flagReason: String!
    riskScore: Float!
    detectionRuleFired: String!
  }

  type Subscription {
    inventoryAlert: InventoryAlert!
    revenueUpdate: RevenueUpdate!
    supportEscalation: SupportEscalation!
    orderFraudFlag: FraudFlag!
  }
`;

const subscriptionResolvers = {
  Subscription: {
    inventoryAlert: {
      subscribe: () => pubsub.asyncIterator([ADMIN_EVENTS.INVENTORY_ALERT]),
    },
    revenueUpdate: {
      subscribe: () => pubsub.asyncIterator([ADMIN_EVENTS.REVENUE_UPDATE]),
    },
    supportEscalation: {
      subscribe: () => pubsub.asyncIterator([ADMIN_EVENTS.SUPPORT_ESCALATION]),
    },
    orderFraudFlag: {
      subscribe: () => pubsub.asyncIterator([ADMIN_EVENTS.ORDER_FRAUD_FLAG]),
    },
  },
};

export const subscriptionSchema = makeExecutableSchema({
  typeDefs: subscriptionTypeDefs,
  resolvers: subscriptionResolvers,
});
