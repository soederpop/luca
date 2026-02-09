export type EventMap = Record<string, any[]>;

type Listener<Args extends any[] = any[]> = (...args: Args) => void;

export class Bus<T extends EventMap = EventMap> {
    private events: Map<string, Listener[]>;

    constructor() {
        this.events = new Map();
    }

    async waitFor<E extends string & keyof T>(event: E): Promise<T[E]> {
        return new Promise(resolve => {
            this.once(event, resolve as any);
        });
    }

    emit<E extends string & keyof T>(event: E, ...args: T[E]): void {
        const listeners = this.events.get(event);
        if (!listeners) return;

        listeners.forEach(listener => listener(...args));
    }

    on<E extends string & keyof T>(event: E, listener: (...args: T[E]) => void): void {
        const listeners = this.events.get(event) || [];
        listeners.push(listener as Listener);
        this.events.set(event, listeners);
    }

    once<E extends string & keyof T>(event: E, listener: (...args: T[E]) => void): void {
        const onceListener: Listener = (...args: any[]) => {
            (listener as Listener)(...args);
            this.off(event, onceListener as any);
        };
        this.on(event, onceListener as any);
    }

    off<E extends string & keyof T>(event: E, listener?: (...args: T[E]) => void): void {
        const listeners = this.events.get(event);
        if (!listeners) return;

        if (!listener) {
            this.events.delete(event);
            return;
        }

        const index = listeners.indexOf(listener as Listener);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }
}
