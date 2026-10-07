// Records which (service, recipient) pairs the send tools delivered to during
// the current agent turn. The queue resets it before each turn and checks it
// afterwards so that a reply the agent already sent explicitly is not delivered
// a second time. The queue is single-threaded so there is no race condition.
const deliveries = new Set<string>();

function deliveryKey(service: string, recipient: string): string {
  return `${service}:${recipient}`;
}

export function resetDeliveries(): void {
  deliveries.clear();
}

export function recordDelivery(service: string, recipient: string): void {
  deliveries.add(deliveryKey(service, recipient));
}

export function wasDeliveredTo(service: string, recipient: string): boolean {
  return deliveries.has(deliveryKey(service, recipient));
}
