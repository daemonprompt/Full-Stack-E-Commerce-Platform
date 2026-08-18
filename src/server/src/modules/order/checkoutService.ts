import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
}

interface CheckoutRequest {
  userId: string;
  items: CartItem[];
  shippingAddressId: string;
  paymentMethodId: string;
}

export async function processCheckout(checkout: CheckoutRequest) {
  const { userId, items, shippingAddressId, paymentMethodId } = checkout;

  // Validate inventory availability
  for (const item of items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId }
    });

    if (!variant || variant.stockQuantity < item.quantity) {
      throw new Error(`Insufficient stock for variant ${item.variantId}`);
    }
  }

  // Create the order record
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = await prisma.order.create({
    data: {
      userId,
      status: OrderStatus.PENDING,
      totalAmount: total,
      shippingAddressId,
      items: {
        create: items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.price
        }))
      }
    },
    include: { items: true }
  });

  // Decrement stock for each item
  for (const item of items) {
    await prisma.productVariant.update({
      where: { id: item.variantId },
      data: {
        stockQuantity: { decrement: item.quantity }
      }
    });
  }

  // Initiate payment
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      userId,
      amount: total,
      paymentMethodId,
      status: 'PENDING'
    }
  });

  return { order, payment };
}

export async function getCheckoutSummary(userId: string, items: CartItem[]) {
  const variantIds = items.map(i => i.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true }
  });

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = subtotal + tax;

  return {
    items: variants.map(v => ({
      variantId: v.id,
      name: v.product.name,
      price: items.find(i => i.variantId === v.id)?.price ?? 0
    })),
    subtotal,
    tax,
    total
  };
}
