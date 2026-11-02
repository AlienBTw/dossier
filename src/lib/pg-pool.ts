import { PrismaPg } from "@prisma/adapter-pg";
import { Client, type ClientConfig } from "pg";

/**
 * pg 8 warns, and pg 9 drops the queue, when `client.query()` runs while that
 * client already has a query queued. Prisma's adapter does this inside a
 * transaction. Waiting for the previous query keeps today's order: one query
 * finishes before the next is sent.
 */
export class SerialPgClient extends Client {
  #previous: Promise<void> = Promise.resolve();

  constructor(config?: string | ClientConfig) {
    super(config);
    const send = this.query.bind(this) as (...args: unknown[]) => unknown;
    this.query = ((...args: unknown[]) => this.#sendWhenIdle(send, args)) as this["query"];
  }

  #sendWhenIdle(send: (...args: unknown[]) => unknown, args: unknown[]): unknown {
    // A query stream is long-lived. The pool and Prisma send text or a config.
    if (isSubmittable(args[0])) return send(...args);

    let settle!: (error?: unknown) => void;
    const finished = new Promise<void>((resolve, reject) => {
      settle = (error?: unknown) => (error ? reject(error) : resolve());
    });

    const result = this.#previous.then(() => dispatch(send, args, settle));
    // A failed query must not block the next one. The caller still sees the failure.
    this.#previous = finished.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

/** The pool and Prisma pass a connection string. The client class stops the queued-query warning. */
export function prismaPg(connectionString: string | undefined): PrismaPg {
  return new PrismaPg({ connectionString, Client: SerialPgClient });
}

function isSubmittable(value: unknown): boolean {
  return typeof value === "object" && value !== null && "submit" in value && typeof value.submit === "function";
}

function dispatch(send: (...args: unknown[]) => unknown, args: unknown[], settle: (error?: unknown) => void): unknown {
  const callbackIndex = args.findIndex((value) => typeof value === "function");
  if (callbackIndex >= 0) {
    const wrapped = args.slice();
    const user = wrapped[callbackIndex] as (error: unknown, result: unknown) => void;
    wrapped[callbackIndex] = (error: unknown, result: unknown) => {
      try {
        user(error, result);
      } finally {
        settle(error);
      }
    };
    try {
      send(...wrapped);
    } catch (error) {
      settle(error);
      throw error;
    }
    return undefined;
  }

  try {
    return Promise.resolve(send(...args)).then(
      (value) => {
        settle();
        return value;
      },
      (error: unknown) => {
        settle(error);
        throw error;
      },
    );
  } catch (error) {
    settle(error);
    throw error;
  }
}
