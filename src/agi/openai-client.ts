import { clients, Client, type ClientState, type ClientOptions } from "../client.js";
import type { Container, ContainerContext } from "../container.js";
import type { ClientsInterface } from "../client.js";
import OpenAI from "openai";

export interface OpenAIClientState extends ClientState {
  requestCount: number;
  lastRequestTime: number | null;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface OpenAIClientOptions extends ClientOptions {
  apiKey?: string;
  organization?: string;
  project?: string;
  dangerouslyAllowBrowser?: boolean;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
}

export class OpenAIClient extends Client<OpenAIClientState, OpenAIClientOptions> {
  private openai!: OpenAI;

  static override shortcut = "clients.openai" as const

  static override attach(container: Container & ClientsInterface): any {
    return container;
  }

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
      maxRetries: this.options.maxRetries
    });
  }

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

  get defaultModel(): string {
    return this.options.defaultModel || 'gpt-3.5-turbo';
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

  private trackRequest() {
    const requestCount = this.state.get('requestCount') || 0;
    this.setState({
      requestCount: requestCount + 1,
      lastRequestTime: Date.now()
    });
  }

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



  // Convenience methods for common use cases
  async ask(
    question: string,
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<string> {
    const response = await this.createChatCompletion([
      { role: 'user', content: question }
    ], options);

    return response.choices[0]?.message?.content || '';
  }

  async chat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<string> {
    const response = await this.createChatCompletion(messages, options);
    return response.choices[0]?.message?.content || '';
  }

  // Access to the raw OpenAI client for advanced use cases
  get raw(): OpenAI {
    return this.openai;
  }
}

clients.register("openai", OpenAIClient)

export default OpenAIClient;
