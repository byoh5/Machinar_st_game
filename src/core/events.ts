export type EventPayloadMap = Record<string, unknown>;

type EventHandler<T> = (payload: T) => void;

export class EventBus<T extends EventPayloadMap> {
  private readonly listeners = new Map<keyof T, Set<EventHandler<unknown>>>();

  on<K extends keyof T>(eventName: K, handler: EventHandler<T[K]>): () => void {
    const current = this.listeners.get(eventName) ?? new Set<EventHandler<unknown>>();
    current.add(handler as EventHandler<unknown>);
    this.listeners.set(eventName, current);

    return () => {
      const handlers = this.listeners.get(eventName);
      if (!handlers) {
        return;
      }

      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  emit<K extends keyof T>(eventName: K, payload: T[K]): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => {
      (handler as EventHandler<T[K]>)(payload);
    });
  }
}
