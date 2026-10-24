/** Structural contracts for the small Host surface this bundle consumes. */

/** Header bag accepted by the Connection trust fence. */
export type HeadersLike = Readonly<Record<string, string | readonly string[] | undefined>>

/** Minimal server request used by the pairing route. */
export interface RequestLike extends AsyncIterable<Uint8Array | string> {
  readonly method?: string | undefined
  readonly url?: string | undefined
  readonly headers: HeadersLike
  readonly socket?: { readonly remoteAddress?: string | undefined } | undefined
  resume?(): void
  destroy?(): void
}

/** Minimal server response used by the pairing route. */
export interface ResponseLike {
  statusCode: number
  setHeader(name: string, value: string | readonly string[]): void
  end(body?: string): void
}

/** One exact Host Web route. */
export interface WebRouteLike {
  readonly kind: 'exact' | 'prefix'
  readonly path: string
  readonly handler: (request: RequestLike, response: ResponseLike) => void | Promise<void>
}

/** One exact browser Fetch route inside Connection's authenticated `/api` fence. */
export interface FetchRouteLike {
  readonly path: string
  readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
  readonly requestBody: 'buffered' | 'streaming'
  readonly fetch: (request: Request) => Promise<Response>
}

/** Index request accepted by Connection's index authorizer. */
export interface IndexRequestLike {
  readonly headers: HeadersLike
  readonly method?: string | undefined
  readonly url?: string | undefined
}

/** Index response target owned by Connection when index access is refused. */
export interface IndexResponseLike {
  writeHead(status: number, headers?: Readonly<Record<string, string>>): unknown
  end(body?: string): unknown
}

/** Subset of the Host web carrier used by this bundle. */
export interface WebServerLike {
  getOrigin(): string
  readonly host: string
  readonly port: number
  readonly protocol: string
  register(route: WebRouteLike): () => void
}

/** Subset of the Host browser-connection service used by this bundle. */
export interface ConnectionLike {
  requestRejection(request: { readonly headers: HeadersLike }): 401 | 403 | undefined
  authorizeIndex(request: IndexRequestLike, response: IndexResponseLike): boolean
  authenticatedUrl(baseUrl: string): string
  readonly fetch: {
    register(route: FetchRouteLike): () => Promise<void>
  }
}

/** Logger shape shared by Cordis contexts. */
export interface LoggerLike {
  info?(message: string, ...args: readonly unknown[]): void
  warn?(message: string, ...args: readonly unknown[]): void
  error?(message: string, ...args: readonly unknown[]): void
}

/** Host plugin context consumed by `apply`. */
export interface PluginContext {
  readonly webServer: WebServerLike
  readonly connection: ConnectionLike
  effect(execute: () => void | (() => void), label?: string): void
  readonly logger?: LoggerLike
}
