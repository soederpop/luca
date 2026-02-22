import {
  Client,
  type ClientOptions,
  type ClientsInterface,
  clients,
} from "@soederpop/luca/client";
import type { Container, ContainerContext } from "@soederpop/luca/container";
import { z } from "zod";
import {
  ClientStateSchema,
  ClientOptionsSchema,
  ClientEventsSchema,
} from "@soederpop/luca/schemas/base.js";
import {
  createClient,
  type SupabaseClient as SupabaseSDKClient,
  type SupabaseClientOptions as SupabaseSDKOptions,
  type RealtimeChannel,
} from "@supabase/supabase-js";

declare module "@soederpop/luca/client" {
  interface AvailableClients {
    supabase: typeof SupabaseClient;
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SupabaseClientOptionsSchema = ClientOptionsSchema.extend({
  supabaseUrl: z
    .string()
    .describe("The Supabase project URL (e.g. https://xyz.supabase.co)"),
  supabaseKey: z
    .string()
    .describe("The Supabase anon or service-role key"),
  clientOptions: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Pass-through options forwarded directly to the Supabase SDK createClient()"
    ),
}).describe("Options for creating a Supabase client");

export const SupabaseClientStateSchema = ClientStateSchema.extend({
  authenticated: z
    .boolean()
    .default(false)
    .describe("Whether a user session is currently active"),
  userId: z
    .string()
    .nullable()
    .default(null)
    .describe("The authenticated user's ID, if any"),
  userEmail: z
    .string()
    .nullable()
    .default(null)
    .describe("The authenticated user's email, if any"),
  realtimeChannels: z
    .array(z.string())
    .default([])
    .describe("Names of currently subscribed realtime channels"),
  lastError: z
    .string()
    .nullable()
    .default(null)
    .describe("The most recent error message, if any"),
}).describe("Supabase client state");

export const SupabaseClientEventsSchema = ClientEventsSchema.extend({
  authStateChange: z
    .tuple([
      z.string().describe("The auth event name (e.g. SIGNED_IN, SIGNED_OUT)"),
      z.any().describe("The session object"),
    ])
    .describe("Emitted when the auth state changes"),
  realtimeMessage: z
    .tuple([
      z.string().describe("The channel name"),
      z.any().describe("The payload"),
    ])
    .describe("Emitted when a realtime message is received"),
  realtimeStatus: z
    .tuple([
      z.string().describe("The channel name"),
      z.string().describe("The status (e.g. SUBSCRIBED, CLOSED)"),
    ])
    .describe("Emitted when a realtime channel status changes"),
  error: z
    .tuple([z.any().describe("The error object")])
    .describe("Emitted on any Supabase error"),
}).describe("Supabase client events");

export type SupabaseClientOptions = z.infer<typeof SupabaseClientOptionsSchema>;
export type SupabaseClientState = z.infer<typeof SupabaseClientStateSchema>;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Supabase client for the Luca container system.
 *
 * Wraps the official `@supabase/supabase-js` SDK and exposes it through Luca's
 * typed state, events, and introspection system. The SDK is isomorphic so this
 * single implementation works in both Node and browser containers.
 *
 * Use `client.sdk` for full SDK access, or use the convenience wrappers for
 * common operations (auth, database queries, storage, edge functions, realtime).
 *
 * @example
 * ```typescript
 * const supabase = container.client('supabase', {
 *   supabaseUrl: 'https://xyz.supabase.co',
 *   supabaseKey: 'your-anon-key',
 * })
 *
 * // Query data
 * const { data } = await supabase.from('users').select('*')
 *
 * // Auth
 * await supabase.signInWithPassword('user@example.com', 'password')
 *
 * // Realtime
 * supabase.subscribe('changes', 'users', (payload) => {
 *   console.log('Change:', payload)
 * })
 * ```
 */
export class SupabaseClient extends Client<
  SupabaseClientState,
  SupabaseClientOptions
> {
  static override shortcut = "clients.supabase" as const;
  static override description =
    "Supabase client wrapping the official SDK with typed state, events, and realtime channel management";

  static override stateSchema = SupabaseClientStateSchema;
  static override optionsSchema = SupabaseClientOptionsSchema;
  static override eventsSchema = SupabaseClientEventsSchema;

  private _sdk!: SupabaseSDKClient<any, any>;
  private _channels = new Map<string, RealtimeChannel>();

  // @ts-ignore - required options (supabaseUrl, supabaseKey) widen beyond base ClientOptions
  static attach(container: Container & ClientsInterface, options?: any) {
    // @ts-ignore
    container.clients.register("supabase", SupabaseClient);
    return container;
  }

  constructor(options: SupabaseClientOptions, context: ContainerContext) {
    super(options, context);

    const sdkOptions = (options.clientOptions ?? {}) as SupabaseSDKOptions<string>;
    this._sdk = createClient(options.supabaseUrl, options.supabaseKey, sdkOptions);

    this._sdk.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      this.state.set("authenticated", !!session);
      this.state.set("userId", user?.id ?? null);
      this.state.set("userEmail", user?.email ?? null);
      this.emit("authStateChange" as any, event, session);
    });

    this.state.set("connected", true);
  }

  // ---------------------------------------------------------------------------
  // SDK access
  // ---------------------------------------------------------------------------

  /** Returns the raw Supabase SDK client for full access to all SDK methods. */
  get sdk(): SupabaseSDKClient<any, any> {
    return this._sdk;
  }

  // ---------------------------------------------------------------------------
  // Database
  // ---------------------------------------------------------------------------

  /**
   * Start a query on a Postgres table or view.
   * @param table - The table or view name to query
   */
  from(table: string) {
    return this._sdk.from(table);
  }

  /**
   * Call a Postgres function (RPC).
   * @param fn - The function name
   * @param params - Arguments to pass to the function
   * @param options - Optional settings (head, get, count)
   */
  rpc(fn: string, params?: Record<string, unknown>, options?: { head?: boolean; get?: boolean; count?: "exact" | "planned" | "estimated" }) {
    return this._sdk.rpc(fn, params, options);
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  /** Sign in with email and password. */
  async signInWithPassword(email: string, password: string) {
    const result = await this._sdk.auth.signInWithPassword({ email, password });
    if (result.error) {
      this._setError(result.error.message);
    }
    return result;
  }

  /** Create a new user account with email and password. */
  async signUp(email: string, password: string) {
    const result = await this._sdk.auth.signUp({ email, password });
    if (result.error) {
      this._setError(result.error.message);
    }
    return result;
  }

  /** Sign the current user out. */
  async signOut() {
    const result = await this._sdk.auth.signOut();
    if (result.error) {
      this._setError(result.error.message);
    }
    return result;
  }

  /** Get the current session, if any. */
  async getSession() {
    return this._sdk.auth.getSession();
  }

  /** Get the current user, if any. */
  async getUser() {
    return this._sdk.auth.getUser();
  }

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  /** Returns the Supabase Storage client for managing buckets and files. */
  get storage() {
    return this._sdk.storage;
  }

  // ---------------------------------------------------------------------------
  // Edge Functions
  // ---------------------------------------------------------------------------

  /** Returns the Supabase Functions client. */
  get functions() {
    return this._sdk.functions;
  }

  /** Invoke a Supabase Edge Function by name. */
  async invoke(name: string, body?: any) {
    const result = await this._sdk.functions.invoke(name, { body });
    if (result.error) {
      this._setError(result.error.message);
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to realtime changes on a Postgres table.
   * @param channelName - A name for this subscription channel
   * @param table - The table to listen to
   * @param callback - Called with the payload on each change
   * @param event - The event type to listen for (default: all changes)
   */
  subscribe(
    channelName: string,
    table: string,
    callback: (payload: any) => void,
    event: "INSERT" | "UPDATE" | "DELETE" | "*" = "*"
  ): RealtimeChannel {
    const channel = this._sdk
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        { event, schema: "public", table },
        (payload: any) => {
          this.emit("realtimeMessage" as any, channelName, payload);
          callback(payload);
        }
      )
      .subscribe((status: string) => {
        this.emit("realtimeStatus" as any, channelName, status);
      });

    this._channels.set(channelName, channel);
    this._syncChannelState();
    return channel;
  }

  /**
   * Unsubscribe and remove a realtime channel by name.
   * @param channelName - The channel name to remove
   */
  async unsubscribe(channelName: string) {
    const channel = this._channels.get(channelName);
    if (channel) {
      await this._sdk.removeChannel(channel);
      this._channels.delete(channelName);
      this._syncChannelState();
    }
  }

  /** Unsubscribe and remove all realtime channels. */
  async unsubscribeAll() {
    await this._sdk.removeAllChannels();
    this._channels.clear();
    this._syncChannelState();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Connect is a no-op since the Supabase SDK initializes on construction.
   * The client is ready to use immediately after creation.
   */
  override async connect() {
    this.state.set("connected", true);
    return this;
  }

  /**
   * Disconnect by signing out and removing all realtime channels.
   */
  async disconnect() {
    await this.unsubscribeAll();
    await this._sdk.auth.signOut();
    this.state.set("connected", false);
    this.state.set("authenticated", false);
    this.state.set("userId", null);
    this.state.set("userEmail", null);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private _syncChannelState() {
    this.state.set("realtimeChannels", Array.from(this._channels.keys()));
  }

  private _setError(message: string) {
    this.state.set("lastError", message);
    this.emit("error" as any, new Error(message));
  }
}

// @ts-ignore
clients.register("supabase", SupabaseClient);
