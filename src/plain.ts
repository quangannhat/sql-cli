type FulfillmentMode = "deliver" | "fail-shipment" | "cancel-shipment";
type ShippingStatus = "label-created" | "shipped" | "in-transit" | "delivered";

interface Order {
  readonly id: string;
  readonly customerId: string;
  readonly total: number;
}

interface Payment {
  readonly id: string;
  readonly orderId: string;
  readonly amount: number;
}

interface Shipment {
  readonly trackingNumber: string;
  readonly orderId: string;
}

interface DemoState {
  readonly inventoryAttempts: Record<string, number>;
  readonly chargedPayments: Set<string>;
  readonly refundedPayments: Set<string>;
}

class InventoryUnavailable extends Error {
  readonly orderId: string;
  readonly attempt: number;

  constructor(orderId: string, attempt: number) {
    super(`Inventory unavailable for ${orderId} on attempt ${attempt}`);
    this.name = "InventoryUnavailable";
    this.orderId = orderId;
    this.attempt = attempt;
  }
}

class ShipmentCreationFailed extends Error {
  readonly orderId: string;

  constructor(orderId: string) {
    super(`Could not create shipment for ${orderId}`);
    this.name = "ShipmentCreationFailed";
    this.orderId = orderId;
  }
}

class OperationCanceled extends Error {
  constructor() {
    super("Operation canceled");
    this.name = "OperationCanceled";
  }
}

const throwIfCanceled = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new OperationCanceled();
  }
};

const sleep = (milliseconds: number, signal?: AbortSignal): Promise<void> => {
  throwIfCanceled(signal);

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new OperationCanceled());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

const retry = async <A>(
  operation: () => Promise<A>,
  options: {
    readonly times: number;
    readonly shouldRetry: (error: unknown) => boolean;
    readonly signal?: AbortSignal;
  },
): Promise<A> => {
  let retries = 0;

  while (true) {
    throwIfCanceled(options.signal);

    try {
      return await operation();
    } catch (error) {
      if (retries >= options.times || !options.shouldRetry(error)) {
        throw error;
      }
      retries += 1;
    }
  }
};

const makeOrderService = (state: DemoState) => {
  const createOrder = async (id: string): Promise<Order> => {
    const order: Order = { id, customerId: "customer-123", total: 49.99 };
    console.log(`[${order.id}] order created for $${order.total}`);
    return order;
  };

  const reserveInventory = async (order: Order, signal?: AbortSignal): Promise<void> => {
    await retry(
      async () => {
        throwIfCanceled(signal);
        const attempt = (state.inventoryAttempts[order.id] ?? 0) + 1;
        state.inventoryAttempts[order.id] = attempt;
        console.log(`[${order.id}] reserving inventory (attempt ${attempt})`);

        if (attempt === 1) {
          console.warn(`[${order.id}] warehouse temporarily unavailable`);
          throw new InventoryUnavailable(order.id, attempt);
        }

        console.log(`[${order.id}] inventory reserved`);
      },
      {
        times: 2,
        shouldRetry: (error) => error instanceof InventoryUnavailable,
        signal,
      },
    );
  };

  const chargeCustomer = async (order: Order): Promise<Payment> => {
    const payment: Payment = {
      id: `payment-${order.id}`,
      orderId: order.id,
      amount: order.total,
    };
    state.chargedPayments.add(payment.id);
    console.log(`[${order.id}] customer charged (${payment.id})`);
    return payment;
  };

  const refundCustomer = async (payment: Payment): Promise<void> => {
    if (state.refundedPayments.has(payment.id)) {
      console.log(`[${payment.orderId}] refund already completed; skipping duplicate`);
      return;
    }

    state.refundedPayments.add(payment.id);
    console.warn(`[${payment.orderId}] payment refunded (${payment.id})`);
  };

  const createShipment = async (
    order: Order,
    mode: FulfillmentMode,
    signal?: AbortSignal,
  ): Promise<Shipment> => {
    console.log(`[${order.id}] creating shipping label`);
    await sleep(mode === "cancel-shipment" ? 2_000 : 150, signal);

    if (mode === "fail-shipment") {
      throw new ShipmentCreationFailed(order.id);
    }

    const shipment: Shipment = {
      orderId: order.id,
      trackingNumber: `TRACK-${order.id.toUpperCase()}`,
    };
    console.log(`[${order.id}] shipping label created (${shipment.trackingNumber})`);
    return shipment;
  };

  const trackShipment = async (shipment: Shipment, signal?: AbortSignal): Promise<void> => {
    const statuses: ReadonlyArray<ShippingStatus> = [
      "label-created",
      "shipped",
      "in-transit",
      "delivered",
    ];

    for (const status of statuses) {
      await sleep(100, signal);
      console.log(`[${shipment.orderId}] shipping status: ${status}`);
    }
  };

  const fulfillOrder = async (
    orderId: string,
    mode: FulfillmentMode,
    signal?: AbortSignal,
  ): Promise<Order> => {
    const order = await createOrder(orderId);
    await reserveInventory(order, signal);

    // Charging is the acquisition. The finally block is its release handler.
    const payment = await chargeCustomer(order);
    let fulfillmentCommitted = false;
    let shipment: Shipment;

    try {
      shipment = await createShipment(order, mode, signal);
      fulfillmentCommitted = true;
    } finally {
      if (!fulfillmentCommitted) {
        // Do not pass the aborted signal: compensation must not be canceled too.
        console.warn(`[${order.id}] fulfillment did not commit; compensating`);
        await refundCustomer(payment);
      }
    }

    console.log(`[${order.id}] fulfillment committed; payment retained`);
    await trackShipment(shipment, signal);
    return order;
  };

  return { fulfillOrder } as const;
};

const main = async () => {
  const state: DemoState = {
    inventoryAttempts: {},
    chargedPayments: new Set(),
    refundedPayments: new Set(),
  };
  const orders = makeOrderService(state);

  console.log("\n--- Successful order: retry, charge, and delivery ---");
  await orders.fulfillOrder("order-success", "deliver");

  console.log("\n--- Failed order: shipment failure triggers refund ---");
  try {
    await orders.fulfillOrder("order-failure", "fail-shipment");
  } catch (error) {
    console.warn("Failure observed by caller:", error);
  }

  console.log("\n--- Canceled order: aborting fulfillment ---");
  const controller = new AbortController();
  const canceledOrder = orders.fulfillOrder("order-canceled", "cancel-shipment", controller.signal);

  await sleep(250);
  controller.abort();

  try {
    await canceledOrder;
  } catch (error) {
    if (error instanceof OperationCanceled) {
      console.log("Caller observed a clean cancellation");
    } else {
      throw error;
    }
  }

  console.log("\n--- Final payment state ---");
  console.log(`Charged: ${[...state.chargedPayments].join(", ")}`);
  console.log(`Refunded: ${[...state.refundedPayments].join(", ")}`);
};

main().catch((error: unknown) => {
  console.error("Unexpected program failure:", error);
  process.exitCode = 1;
});
