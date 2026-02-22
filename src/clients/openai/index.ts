import { z } from 'zod'
import { ClientStateSchema, ClientOptionsSchema } from '@soederpop/luca/schemas/base.js'
import { clients, Client } from "@soederpop/luca/client";
import type { Container, ContainerContext } from "@soederpop/luca/container";
import type { ClientsInterface } from "@soederpop/luca/client";
import OpenAI from "openai";

export const OpenAIClientStateSchema = ClientStateSchema.extend({
  requestCount: z.number().default(0).describe('Total number of API requests made'),
  lastRequestTime: z.number().nullable().default(null).describe('Timestamp of the last API request'),
  tokenUsage: z.object({
    prompt: z.number().default(0).describe('Total prompt tokens consumed'),
    completion: z.number().default(0).describe('Total completion tokens consumed'),
    total: z.number().default(0).describe('Total tokens consumed (prompt + completion)'),
  }).default({ prompt: 0, completion: 0, total: 0 }).describe('Cumulative token usage across all requests'),
})
export type OpenAIClientState = z.infer<typeof OpenAIClientStateSchema>

export const OpenAIClientOptionsSchema = ClientOptionsSchema.extend({
  apiKey: z.string().optional().describe('OpenAI API key (falls back to OPENAI_API_KEY env var)'),
  organization: z.string().optional().describe('OpenAI organization ID'),
  project: z.string().optional().describe('OpenAI project ID'),
  dangerouslyAllowBrowser: z.boolean().optional().describe('Allow usage in browser environments'),
  defaultModel: z.string().optional().describe('Default model for completions (default: gpt-4o)'),
  timeout: z.number().optional().describe('Request timeout in milliseconds'),
  maxRetries: z.number().optional().describe('Maximum number of retries on failure'),
})
export type OpenAIClientOptions = z.infer<typeof OpenAIClientOptionsSchema>

/**
 * OpenAI client — wraps the OpenAI SDK for chat completions, responses API, embeddings, and image generation.
 *
 * Provides convenience methods for common operations while tracking token usage and request counts.
 * Supports both the Chat Completions API and the newer Responses API.
 *
 * @example
 * ```typescript
 * const openai = container.client('openai', { defaultModel: 'gpt-4o' })
 * const answer = await openai.ask('What is the meaning of life?')
 * console.log(answer)
 * ```
 */
export class OpenAIClient extends Client<OpenAIClientState, OpenAIClientOptions> {
  private openai!: OpenAI;

  static override shortcut = "clients.openai" as const
  static override envVars = ['OPENAI_API_KEY']
  static override stateSchema = OpenAIClientStateSchema
  static override optionsSchema = OpenAIClientOptionsSchema

  static override attach(container: Container & ClientsInterface): any {
    return container;
  }

  /** Initial state with zeroed token usage counters. */
  override get initialState(): OpenAIClientState {
    return {
      ...super.initialState,
      requestCount: 0,
      lastRequestTime: null,
      tokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0
      }
    };
  }

  constructor(options: OpenAIClientOptions, context: ContainerContext) {
    super(options, context);
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    this.openai = new OpenAI({
      apiKey: this.options.apiKey || process.env.OPENAI_API_KEY,
      organization: this.options.organization,
      project: this.options.project,
      dangerouslyAllowBrowser: this.options.dangerouslyAllowBrowser,
      timeout: this.options.timeout,
      maxRetries: this.options.maxRetries,
      baseURL: this.options.baseURL,
    });
  }

  /**
   * Test the API connection by listing models.
   *
   * @returns This client instance
   * @throws If the API key is invalid or the connection fails
   *
   * @example
   * ```typescript
   * await openai.connect()
   * ```
   */
  override async connect(): Promise<this> {
    try {
      // Test the connection by making a simple request
      await this.openai.models.list();
      await super.connect();
      this.emit('connected');
      return this;
    } catch (error) {
      this.emit('failure', error);
      throw error;
    }
  }

  /** The default model used for completions, from options or 'gpt-4o'. */
  get defaultModel(): string {
    return this.options.defaultModel || 'gpt-4o';
  }

  private updateTokenUsage(usage?: OpenAI.CompletionUsage | OpenAI.Embeddings.CreateEmbeddingResponse.Usage) {
    if (usage) {
      const currentUsage = this.state.get('tokenUsage') || { prompt: 0, completion: 0, total: 0 };
      this.setState({
        tokenUsage: {
          prompt: currentUsage.prompt + (usage.prompt_tokens || 0),
          completion: currentUsage.completion + ('completion_tokens' in usage ? usage.completion_tokens || 0 : 0),
          total: currentUsage.total + (usage.total_tokens || 0)
        }
      });
    }
  }

  private updateResponsesTokenUsage(usage?: OpenAI.Responses.ResponseUsage) {
    if (usage) {
      const currentUsage = this.state.get('tokenUsage') || { prompt: 0, completion: 0, total: 0 };
      this.setState({
        tokenUsage: {
          prompt: currentUsage.prompt + (usage.input_tokens || 0),
          completion: currentUsage.completion + (usage.output_tokens || 0),
          total: currentUsage.total + (usage.total_tokens || 0),
        }
      });
    }
  }

  private trackRequest() {
    const requestCount = this.state.get('requestCount') || 0;
    this.setState({
      requestCount: requestCount + 1,
      lastRequestTime: Date.now()
    });
  }

  /**
   * Create a chat completion using the Chat Completions API.
   *
   * @param messages - Array of chat messages
   * @param options - Additional parameters for the completion
   * @returns The complete chat completion response
   *
   * @example
   * ```typescript
   * const response = await openai.createChatCompletion([
   *   { role: 'system', content: 'You are a helpful assistant.' },
   *   { role: 'user', content: 'Hello!' }
   * ])
   * console.log(response.choices[0]?.message?.content)
   * ```
   */
  async createChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    this.trackRequest();

    try {
      const response = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages,
        stream: false, // Ensure non-streaming response
        ...options
      }) as OpenAI.Chat.Completions.ChatCompletion;

      this.updateTokenUsage(response.usage);
      this.emit('completion', response);

      return response;
    } catch (error) {
      this.emit('failure', error);
      throw error;
    }
  }

  /**
   * Create a response using the Responses API.
   *
   * @param input - The input prompt or message array
   * @param options - Additional parameters for the response
   * @returns The complete response object
   *
   * @example
   * ```typescript
   * const response = await openai.createResponse('Explain quantum computing')
   * ```
   */
  async createResponse(
    input: OpenAI.Responses.ResponseInput | string,
    options: Partial<OpenAI.Responses.ResponseCreateParamsNonStreaming> = {}
  ): Promise<OpenAI.Responses.Response> {
    this.trackRequest();

    try {
      const response = await this.openai.responses.create({
        model: this.defaultModel as OpenAI.Responses.ResponseCreateParams['model'],
        input,
        ...options,
        stream: false,
      }) as OpenAI.Responses.Response;

      this.updateResponsesTokenUsage(response.usage || undefined);
      this.emit('completion', response);

      return response;
    } catch (error) {
      this.emit('failure', error);
      throw error;
    }
  }

  /**
   * Stream a response using the Responses API.
   *
   * @param input - The input prompt or message array
   * @param options - Additional parameters for the streaming response
   * @returns An async iterable of response stream events
   *
   * @example
   * ```typescript
   * const stream = await openai.streamResponse('Write a poem')
   * for await (const event of stream) {
   *   if (event.type === 'response.output_text.delta') {
   *     process.stdout.write(event.delta)
   *   }
   * }
   * ```
   */
  async streamResponse(
    input: OpenAI.Responses.ResponseInput | string,
    options: Partial<OpenAI.Responses.ResponseCreateParamsStreaming> = {}
  ): Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>> {
    this.trackRequest();

    try {
      const stream = await this.openai.responses.create({
        model: this.defaultModel as OpenAI.Responses.ResponseCreateParams['model'],
        input,
        ...options,
        stream: true,
      }) as AsyncIterable<OpenAI.Responses.ResponseStreamEvent>;

      return stream;
    } catch (error) {
      this.emit('failure', error);
      throw error;
    }
  }

  /**
   * Create a legacy text completion.
   *
   * @param prompt - The text prompt to complete
   * @param options - Additional parameters for the completion
   * @returns The complete completion response
   *
   * @example
   * ```typescript
   * const response = await openai.createCompletion('Once upon a time')
   * ```
   */
  async createCompletion(
    prompt: string,
    options: Partial<OpenAI.Completions.CompletionCreateParams> = {}
  ): Promise<OpenAI.Completions.Completion> {
    this.trackRequest();

    try {
      const response = await this.openai.completions.create({
        model: options.model || 'gpt-5',
        prompt,
        stream: false, // Ensure non-streaming response
        ...options
      }) as OpenAI.Completions.Completion;

      this.updateTokenUsage(response.usage);
      this.emit('completion', response);

      return response;
    } catch (error) {
      this.emit('failure', error);
      throw error;
    }
  }

  /**
   * Create text embeddings for semantic search or similarity comparisons.
   *
   * @param input - A string or array of strings to embed
   * @param options - Additional parameters (model, etc.)
   * @returns The embedding response with vectors
   *
   * @example
   * ```typescript
   * const response = await openai.createEmbedding('Hello world')
   * console.log(response.data[0].embedding.length)
   * ```
   */
  async createEmbedding(
    input: string | string[],
    options: Partial<OpenAI.Embeddings.EmbeddingCreateParams> = {}
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    this.trackRequest();

    try {
      const response = await this.openai.embeddings.create({
        model: options.model || 'text-embedding-ada-002',
        input,
        ...options
      });

      this.updateTokenUsage(response.usage);
      this.emit('embedding', response);

      return response;
    } catch (error) {
      this.emit('failure', error);
      throw error;
    }
  }

  /**
   * Generate an image from a text prompt using DALL-E.
   *
   * @param prompt - Description of the image to generate
   * @param options - Additional parameters (size, n, etc.)
   * @returns The image response with URLs or base64 data
   *
   * @example
   * ```typescript
   * const response = await openai.createImage('A sunset over mountains')
   * console.log(response.data[0].url)
   * ```
   */
  async createImage(
    prompt: string,
    options: Partial<OpenAI.Images.ImageGenerateParams> = {}
  ): Promise<OpenAI.Images.ImagesResponse> {
    this.trackRequest();

    try {
      const response = await this.openai.images.generate({
        prompt,
        n: 1,
        size: '1024x1024',
        ...options
      });

      this.emit('image', response);

      return response;
    } catch (error) {
      this.emit('failure', error);
      throw error;
    }
  }

  /**
   * List all available models.
   *
   * @returns Paginated list of available models
   *
   * @example
   * ```typescript
   * const models = await openai.listModels()
   * ```
   */
  async listModels(): Promise<OpenAI.Models.ModelsPage> {
    try {
      const response = await this.openai.models.list();
      this.emit('models', response);
      return response;
    } catch (error) {
      this.emit('failure', error);
      throw error;
    }
  }

  /**
   * Ask a single question and get a text response.
   *
   * Convenience wrapper around `createChatCompletion` for simple Q&A.
   *
   * @param question - The question to ask
   * @param options - Additional completion parameters
   * @returns The assistant's text response
   *
   * @example
   * ```typescript
   * const answer = await openai.ask('What is 2 + 2?')
   * console.log(answer) // '4'
   * ```
   */
  async ask(
    question: string,
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<string> {
    const response = await this.createChatCompletion([
      { role: 'user', content: question }
    ], options);

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Send a multi-turn conversation and get a text response.
   *
   * Convenience wrapper around `createChatCompletion` that returns just the text.
   *
   * @param messages - Array of chat messages
   * @param options - Additional completion parameters
   * @returns The assistant's text response
   *
   * @example
   * ```typescript
   * const reply = await openai.chat([
   *   { role: 'system', content: 'You are a pirate.' },
   *   { role: 'user', content: 'Hello!' }
   * ])
   * ```
   */
  async chat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<string> {
    const response = await this.createChatCompletion(messages, options);
    return response.choices[0]?.message?.content || '';
  }

  /** The underlying OpenAI SDK instance for advanced use cases. */
  get raw(): OpenAI {
    return this.openai;
  }
}

clients.register("openai", OpenAIClient)

export default OpenAIClient;
