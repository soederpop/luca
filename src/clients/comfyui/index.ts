import {
  type ClientOptions,
  type ClientState,
  type ClientsInterface,
  clients,
  RestClient,
} from "@/client";
import type { Container, ContainerContext } from "@/container";

declare module "@/client" {
  interface AvailableClients {
    comfyui: typeof ComfyUIClient;
  }
}

export interface ComfyUIClientState extends ClientState {
  clientId: string;
  queueRemaining: number;
  executing: string | null;
}

export interface ComfyUIClientOptions extends ClientOptions {
  /** Override the WebSocket URL (defaults to ws version of baseURL) */
  wsURL?: string;
}

/** Maps a semantic input name to a specific node ID and field */
export type InputMapping = Record<string, { nodeId: string; field: string }>;

export type WorkflowRunOptions = {
  /** Use polling instead of WebSocket for tracking execution */
  poll?: boolean;
  /** Polling interval in ms (default 1000) */
  pollInterval?: number;
  /** Named input mapping: semantic name -> { nodeId, field } */
  inputMap?: InputMapping;
  /** If provided, output images are downloaded to this directory */
  outputDir?: string;
};

export type WorkflowResult = {
  promptId: string;
  outputs: Record<string, any>;
  images?: Array<{ filename: string; subfolder: string; type: string; localPath?: string }>;
};

export class ComfyUIClient extends RestClient<ComfyUIClientState, ComfyUIClientOptions> {
  static override shortcut = "clients.comfyui" as const;
  static override description = "ComfyUI workflow execution client";

  private ws: WebSocket | null = null;

  static attach(container: Container & ClientsInterface, options?: any) {
    container.clients.register("comfyui", ComfyUIClient);
    return container;
  }

  constructor(options: ComfyUIClientOptions, context: ContainerContext) {
    super(
      {
        ...options,
        baseURL: options.baseURL || "http://127.0.0.1:8000",
        json: options.json ?? true,
      } as ComfyUIClientOptions,
      context
    );
  }

  override get initialState(): ComfyUIClientState {
    return {
      connected: false,
      clientId: crypto.randomUUID(),
      queueRemaining: 0,
      executing: null,
    } as ComfyUIClientState;
  }

  get clientId(): string {
    return this.state.get("clientId")!;
  }

  get wsURL(): string {
    if (this.options.wsURL) return this.options.wsURL;
    return this.baseURL.replace(/^http/, "ws") + "/ws";
  }

  // ---------------------------------------------------------------------------
  // Core API methods
  // ---------------------------------------------------------------------------

  async queuePrompt(prompt: Record<string, any>, clientId?: string): Promise<{ prompt_id: string; number: number }> {
    return this.post("/prompt", {
      prompt,
      client_id: clientId ?? this.clientId,
    });
  }

  async getQueue(): Promise<{ queue_running: any[]; queue_pending: any[] }> {
    return this.get("/queue");
  }

  async getHistory(promptId?: string): Promise<Record<string, any>> {
    return this.get(promptId ? `/history/${promptId}` : "/history");
  }

  async getSystemStats(): Promise<any> {
    return this.get("/system_stats");
  }

  async getObjectInfo(nodeClass?: string): Promise<any> {
    return this.get(nodeClass ? `/object_info/${nodeClass}` : "/object_info");
  }

  async interrupt(): Promise<void> {
    await this.post("/interrupt", {});
  }

  async getModels(type?: string): Promise<string[]> {
    return this.get(type ? `/models/${type}` : "/models");
  }

  async getEmbeddings(): Promise<string[]> {
    return this.get("/embeddings");
  }

  async uploadImage(
    file: Buffer | Blob,
    filename: string,
    opts: { subfolder?: string; type?: string; overwrite?: boolean } = {}
  ): Promise<any> {
    const formData = new FormData();
    const blob = file instanceof Blob ? file : new Blob([file]);
    formData.append("image", blob, filename);
    if (opts.subfolder) formData.append("subfolder", opts.subfolder);
    if (opts.type) formData.append("type", opts.type);
    if (opts.overwrite) formData.append("overwrite", "true");

    return this.axios
      .post("/upload/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  }

  async viewImage(
    filename: string,
    subfolder = "",
    type = "output"
  ): Promise<Buffer> {
    const resp = await this.axios.get("/view", {
      params: { filename, subfolder, type },
      responseType: "arraybuffer",
    });
    return Buffer.from(resp.data);
  }

  // ---------------------------------------------------------------------------
  // WebSocket connection
  // ---------------------------------------------------------------------------

  async connectWs(): Promise<void> {
    if (this.ws) return;

    const url = `${this.wsURL}?clientId=${this.clientId}`;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);

      ws.addEventListener("open", () => {
        this.ws = ws;
        this.state.set("connected", true);
        resolve();
      });

      ws.addEventListener("error", (e) => {
        reject(e);
      });

      ws.addEventListener("close", () => {
        this.ws = null;
        this.state.set("connected", false);
      });

      ws.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
          this.handleWsMessage(msg);
        } catch {
          // binary data (e.g. preview images), ignore
        }
      });
    });
  }

  disconnectWs(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.state.set("connected", false);
    }
  }

  private handleWsMessage(msg: { type: string; data: any }) {
    switch (msg.type) {
      case "status":
        if (msg.data?.status?.exec_info) {
          this.state.set("queueRemaining", msg.data.status.exec_info.queue_remaining);
        }
        break;
      case "execution_start":
        this.state.set("executing", msg.data.prompt_id);
        this.emit("execution_start", { promptId: msg.data.prompt_id });
        break;
      case "executing":
        if (msg.data.node === null) {
          this.state.set("executing", null);
          this.emit("execution_complete", { promptId: msg.data.prompt_id });
        } else {
          this.emit("executing", { node: msg.data.node, promptId: msg.data.prompt_id });
        }
        break;
      case "progress":
        this.emit("progress", {
          node: msg.data.node,
          value: msg.data.value,
          max: msg.data.max,
          promptId: msg.data.prompt_id,
        });
        break;
      case "executed":
        this.emit("executed", {
          node: msg.data.node,
          output: msg.data.output,
          promptId: msg.data.prompt_id,
        });
        break;
      case "execution_cached":
        this.emit("execution_cached", {
          nodes: msg.data.nodes,
          promptId: msg.data.prompt_id,
        });
        break;
      case "execution_error":
        this.emit("execution_error", {
          promptId: msg.data.prompt_id,
          ...msg.data,
        });
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // High-level workflow execution
  // ---------------------------------------------------------------------------

  /**
   * Run a ComfyUI workflow with optional runtime input overrides.
   *
   * Inputs can be provided in two forms:
   *
   * **Direct node mapping** (when no `inputMap` in options):
   * ```
   * { '3': { seed: 42 }, '6': { text: 'a cat' } }
   * ```
   *
   * **Named inputs** (when `inputMap` is provided in options):
   * ```
   * inputs: { positive_prompt: 'a cat', seed: 42 }
   * options.inputMap: {
   *   positive_prompt: { nodeId: '6', field: 'text' },
   *   seed: { nodeId: '3', field: 'seed' }
   * }
   * ```
   */
  async runWorkflow(
    workflow: Record<string, any>,
    inputs?: Record<string, any>,
    options: WorkflowRunOptions = {}
  ): Promise<WorkflowResult> {
    const prompt = structuredClone(workflow);

    // Apply inputs
    if (inputs) {
      if (options.inputMap) {
        // Named input mode: resolve through the mapping
        for (const [name, value] of Object.entries(inputs)) {
          const mapping = options.inputMap[name];
          if (!mapping) {
            throw new Error(`No inputMap entry for "${name}". Available: ${Object.keys(options.inputMap).join(", ")}`);
          }
          if (!prompt[mapping.nodeId]) {
            throw new Error(`Node "${mapping.nodeId}" not found in workflow (mapped from "${name}")`);
          }
          prompt[mapping.nodeId].inputs[mapping.field] = value;
        }
      } else {
        // Direct node ID mapping
        for (const [nodeId, fields] of Object.entries(inputs)) {
          if (!prompt[nodeId]) {
            throw new Error(`Node "${nodeId}" not found in workflow`);
          }
          if (typeof fields === "object" && fields !== null) {
            Object.assign(prompt[nodeId].inputs, fields);
          }
        }
      }
    }

    // Queue the prompt
    const { prompt_id: promptId } = await this.queuePrompt(prompt);

    // Track execution
    let outputs: Record<string, any>;

    if (options.poll) {
      outputs = await this.pollForCompletion(promptId, options.pollInterval ?? 1000);
    } else {
      outputs = await this.waitForCompletionWs(promptId);
    }

    // Collect image outputs
    const images: WorkflowResult["images"] = [];
    for (const nodeOutputs of Object.values(outputs)) {
      if (nodeOutputs.images) {
        for (const img of nodeOutputs.images) {
          images.push({
            filename: img.filename,
            subfolder: img.subfolder || "",
            type: img.type || "output",
          });
        }
      }
    }

    // Optionally download images to disk
    if (options.outputDir && images.length) {
      const { mkdir } = await import("fs/promises");
      const { join } = await import("path");
      await mkdir(options.outputDir, { recursive: true });

      for (const img of images) {
        const buf = await this.viewImage(img.filename, img.subfolder, img.type);
        const localPath = join(options.outputDir, img.filename);
        await Bun.write(localPath, buf);
        img.localPath = localPath;
      }
    }

    return { promptId, outputs, images };
  }

  private async waitForCompletionWs(promptId: string): Promise<Record<string, any>> {
    const needsConnect = !this.ws;
    if (needsConnect) await this.connectWs();

    return new Promise<Record<string, any>>((resolve, reject) => {
      const onComplete = (data: any) => {
        if (data.promptId === promptId) {
          cleanup();
          this.getHistory(promptId).then((history) => {
            const entry = history[promptId];
            resolve(entry?.outputs ?? {});
          });
        }
      };

      const onError = (data: any) => {
        if (data.promptId === promptId) {
          cleanup();
          reject(new Error(data.exception_message || "Execution error"));
        }
      };

      const cleanup = () => {
        this.off("execution_complete", onComplete);
        this.off("execution_error", onError);
        if (needsConnect) this.disconnectWs();
      };

      this.on("execution_complete", onComplete);
      this.on("execution_error", onError);
    });
  }

  private async pollForCompletion(promptId: string, interval: number): Promise<Record<string, any>> {
    while (true) {
      const history = await this.getHistory(promptId);
      const entry = history[promptId];

      if (entry?.status?.completed || entry?.outputs) {
        return entry.outputs ?? {};
      }

      if (entry?.status?.status_str === "error") {
        throw new Error("Workflow execution failed");
      }

      await new Promise((r) => setTimeout(r, interval));
    }
  }
}

export default clients.register("comfyui", ComfyUIClient);
