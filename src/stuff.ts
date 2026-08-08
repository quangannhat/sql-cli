import { Cause, Data, Duration, Effect, Exit, Fiber, Ref } from "effect";

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
  readonly inventoryAttempts: Readonly<Record<string, number>>;
  readonly chargedPayments: ReadonlySet<string>;
  readonly refundedPayments: ReadonlySet<string>;
}

class InventoryUnavailable extends Data.TaggedError("InventoryUnavailable")<{
  readonly orderId: string;
  readonly attempt: number;
  readonly message: string;
}> {}

class ShipmentCreationFailed extends Data.TaggedError("ShipmentCreationFailed")<{
  readonly orderId: string;
  readonly message: string;
}> {}

const makeOrderService = (state: Ref.Ref<DemoState>) => {
  const createOrder = (id: string) =>
    Effect.gen(function* () {
      const order: Order = { id, customerId: "customer-123", total: 49.99 };
      yield* Effect.log(`Order created for $${order.total}`);
      return order;
    });

  const reserveInventory = (order: Order) =>
    Effect.gen(function* () {
      const attempt = yield* Ref.modify(state, (current) => {
        const attempt = (current.inventoryAttempts[order.id] ?? 0) + 1;
        return [
          attempt,
          {
            ...current,
            inventoryAttempts: { ...current.inventoryAttempts, [order.id]: attempt },
          },
        ];
      });

      yield* Effect.log(`Reserving inventory (attempt ${attempt})`);

      if (attempt === 1) {
        yield* Effect.logWarning("Warehouse temporarily unavailable");
        return yield* new InventoryUnavailable({
          orderId: order.id,
          attempt,
          message: `Inventory unavailable on attempt ${attempt}`,
        });
      }

      yield* Effect.log("Inventory reserved");
    }).pipe(
      // Only typed failures are retried. Defects and interruption are not retried.
      Effect.retry({ times: 2 }),
    );

  const chargeCustomer = (order: Order) =>
    Effect.gen(function* () {
      const payment: Payment = {
        id: `payment-${order.id}`,
        orderId: order.id,
        amount: order.total,
      };

      yield* Ref.update(state, (current) => ({
        ...current,
        chargedPayments: new Set(current.chargedPayments).add(payment.id),
      }));
      yield* Effect.log(`Customer charged (${payment.id})`);
      return payment;
    });

  const refundCustomer = (payment: Payment) =>
    Effect.gen(function* () {
      const shouldRefund = yield* Ref.modify(state, (current) => {
        if (current.refundedPayments.has(payment.id)) {
          return [false, current];
        }

        return [
          true,
          {
            ...current,
            refundedPayments: new Set(current.refundedPayments).add(payment.id),
          },
        ];
      });

      yield* shouldRefund
        ? Effect.logWarning(`Payment refunded (${payment.id})`)
        : Effect.log(`Refund already completed; skipping duplicate (${payment.id})`);
    });

  const createShipment = (order: Order, mode: FulfillmentMode) =>
    Effect.gen(function* () {
      yield* Effect.log("Creating shipping label");

      // The cancellation demo interrupts this sleep after the customer was charged.
      yield* Effect.sleep(mode === "cancel-shipment" ? Duration.seconds(2) : Duration.millis(150));

      if (mode === "fail-shipment") {
        return yield* new ShipmentCreationFailed({
          orderId: order.id,
          message: "The carrier rejected the shipment",
        });
      }

      const shipment: Shipment = {
        orderId: order.id,
        trackingNumber: `TRACK-${order.id.toUpperCase()}`,
      };
      yield* Effect.log(`Shipping label created (${shipment.trackingNumber})`);
      return shipment;
    });

  const trackShipment = (shipment: Shipment) =>
    Effect.forEach(
      ["label-created", "shipped", "in-transit", "delivered"] as const,
      (status: ShippingStatus) =>
        Effect.sleep(Duration.millis(100)).pipe(
          Effect.andThen(Effect.log(`Shipping status: ${status}`)),
        ),
      { discard: true },
    );

  const compensatePayment = (payment: Payment, cause: Cause.Cause<ShipmentCreationFailed>) => {
    const reason = Cause.hasInterruptsOnly(cause)
      ? "Shipment creation was interrupted"
      : `Shipment creation failed: ${Cause.pretty(cause)}`;

    // acquireUseRelease runs this release uninterruptibly, including on cancellation.
    return Effect.logWarning(`${reason}; compensating`).pipe(
      Effect.andThen(refundCustomer(payment)),
    );
  };

  const fulfillOrder = (orderId: string, mode: FulfillmentMode) =>
    Effect.gen(function* () {
      const order = yield* createOrder(orderId);
      yield* reserveInventory(order);

      const shipment = yield* Effect.acquireUseRelease(
        chargeCustomer(order),
        () => createShipment(order, mode),
        (payment, exit) =>
          Exit.isFailure(exit) ? compensatePayment(payment, exit.cause) : Effect.void,
      );

      yield* Effect.log("Fulfillment committed; payment retained");
      yield* trackShipment(shipment);
      return order;
    }).pipe(Effect.annotateLogs("orderId", orderId));

  return { fulfillOrder } as const;
};

const program = Effect.gen(function* () {
  const state = yield* Ref.make<DemoState>({
    inventoryAttempts: {},
    chargedPayments: new Set(),
    refundedPayments: new Set(),
  });
  const orders = makeOrderService(state);

  yield* Effect.log("\n--- Successful order: retry, charge, and delivery ---");
  yield* orders.fulfillOrder("order-success", "deliver");

  yield* Effect.log("\n--- Failed order: shipment failure triggers refund ---");
  const failedExit = yield* Effect.exit(orders.fulfillOrder("order-failure", "fail-shipment"));
  if (Exit.isFailure(failedExit)) {
    yield* Effect.logWarning(`Failure observed by caller: ${Cause.pretty(failedExit.cause)}`);
  }

  yield* Effect.log("\n--- Canceled order: interrupting the fulfillment fiber ---");
  const fiber = yield* Effect.forkChild(orders.fulfillOrder("order-canceled", "cancel-shipment"));
  yield* Effect.sleep(Duration.millis(250));
  yield* Fiber.interrupt(fiber);
  const canceledExit = yield* Fiber.await(fiber);
  if (Exit.isFailure(canceledExit) && Cause.hasInterruptsOnly(canceledExit.cause)) {
    yield* Effect.log("Caller observed a clean fiber interruption");
  }

  const finalState = yield* Ref.get(state);
  yield* Effect.log("\n--- Final payment state ---");
  yield* Effect.log(`Charged: ${[...finalState.chargedPayments].join(", ")}`);
  yield* Effect.log(`Refunded: ${[...finalState.refundedPayments].join(", ")}`);
});

Effect.runPromise(program);
