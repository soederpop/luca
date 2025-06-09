import { RestClient, ClientState, ClientOptions, ClientsInterface, clients } from '../../client.js'
import { Container } from '../../container.js'

export interface OpenAIClientOptions extends ClientOptions {
    apiKey?: string
}

export interface OpenAIClientState extends ClientState {
    apiKey: string
}

export interface CompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'function'  
  content?: string;
  name?: string;
  function_call?: any;
}

export interface CompletionFunction {
  name: string;
  description: string;
  parameters: any;
}

export interface CompletionParams {
  temperature?: number;
  model?: string;
  maxTokens: number;
  messages: CompletionMessage[] 
  functions?: CompletionFunction[];
  count?: number;
  stream?: boolean;
  logitBias: Record<string,number>;
}

export class OpenAIClient extends RestClient<OpenAIClientState, OpenAIClientOptions> {
  static attach(container: Container & ClientsInterface, options?: any) {
    container.clients.register("openai", OpenAIClient);
  }

  get baseURL() {
    return 'https://api.openai.com'
  }
    
  get useJSON() {
    return true
  }
    
  afterInitialize() {
    this.state.set('apiKey', this.options.apiKey! || process.env.OPENAI_API_KEY!) 
  }

  async beforeRequest() {
    this.axios.defaults.headers.common['Authorization'] = `Bearer ${this.state.get('apiKey')}`
    this.axios.defaults.headers.common['Accept'] = `application/json` 
    this.axios.defaults.headers.common['Content-Type'] = `application/json` 
    this.axios.defaults.headers.post['Content-Type'] = `application/json` 
    this.axios.defaults.headers.put['Content-Type'] = `application/json` 
    this.axios.defaults.headers.patch['Content-Type'] = `application/json` 
  }

  async listModels() : Promise<{ id: string, object: string, owned_by: string, root: string, parent: string }[]> {
    return this.get('/v1/models').then(r => r.data)
  }   
  
  getModelIds() {
    return this.listModels().then(r => r.map((m: any) => m.id))
  }

  async createEmbedding(input: string) {
    const resp = await this.post('/v1/embeddings', {
      model: 'text-embedding-ada-002',
      input
    })  
    
    return resp.data
  }

  async completion(options: CompletionParams) {
    const { 
      model = 'gpt-3.5-turbo-16k', 
      messages = [],
      temperature = 0.75,
      maxTokens = 2000,
      functions = [],
      count: n = 1
    } = options;

    const resp = await this.post('/v1/chat/completions', {
      model,
      messages,      
      max_tokens: maxTokens,
      temperature,
      n,
      functions
    })
    
    return resp
  }
} 

export default clients.register('openai', OpenAIClient)