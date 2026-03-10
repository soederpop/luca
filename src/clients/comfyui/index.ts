import {
  Client,
  RestClient,
} from "@soederpop/luca/client";
import type { ContainerContext } from "@soederpop/luca/container";
import { z } from 'zod'
import { ClientStateSchema, ClientOptionsSchema } from '@soederpop/luca/schemas/base.js'

declare module "@soederpop/luca/client" {
  interface AvailableClients {
    comfyui: typeof ComfyUIClient;
  }
}

export const ComfyUIClientStateSchema = ClientStateSchema.extend({
  clientId: z.string().default('').describe('Unique client ID used for WebSocket session tracking'),
  queueRemaining: z.number().default(0).describe('Number of prompts remaining in the queue'),
  executing: z.string().nullable().default(null).describe('Prompt ID currently being executed, or null'),
})

export const ComfyUIClientOptionsSchema = ClientOptionsSchema.extend({
  wsURL: z.string().optional().describe('Override the WebSocket URL (defaults to ws version of baseURL)'),
})

export type ComfyUIClientState = z.infer<typeof ComfyUIClientStateSchema>
export type ComfyUIClientOptions = z.infer<typeof ComfyUIClientOptionsSchema>

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

/**
 * ComfyUI client — execute Stable Diffusion workflows via the ComfyUI API.
 *
 * Connects to a ComfyUI instance to queue prompts, track execution via WebSocket or polling,
 * and download generated images. Supports both UI-format and API-format workflows with
 * automatic conversion.
 *
 * @example
 * ```typescript
 * const comfy = container.client('comfyui', { baseURL: 'http://localhost:8188' })
 * const result = await comfy.runWorkflow(workflow, {
 *   '6': { text: 'a beautiful sunset' }
 * })
 * console.log(result.images)
 * ```
 */
export class ComfyUIClient extends RestClient<ComfyUIClientState, ComfyUIClientOptions> {
  static override shortcut = "clients.comfyui" as const;
  static override description = "ComfyUI workflow execution client";
  static override stateSchema = ComfyUIClientStateSchema;
  static override optionsSchema = ComfyUIClientOptionsSchema;

  static { Client.register(this, 'comfyui') }

  private ws: WebSocket | null = null;

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

  /** Initial state with a random client ID. */
  override get initialState(): ComfyUIClientState {
    return {
      connected: false,
      clientId: crypto.randomUUID(),
      queueRemaining: 0,
      executing: null,
    } as ComfyUIClientState;
  }

  /** The unique client ID used for WebSocket session tracking. */
  get clientId(): string {
    return this.state.get("clientId")!;
  }

  /** The WebSocket URL derived from baseURL or overridden via options. */
  get wsURL(): string {
    if (this.options.wsURL) return this.options.wsURL;
    return this.baseURL.replace(/^http/, "ws") + "/ws";
  }

  // ---------------------------------------------------------------------------
  // Core API methods
  // ---------------------------------------------------------------------------

  /**
   * Queue a prompt (API-format workflow) for execution.
   *
   * @param prompt - The API-format workflow object
   * @param clientId - Override the client ID for this request
   * @returns The prompt ID and queue number
   *
   * @example
   * ```typescript
   * const { prompt_id } = await comfy.queuePrompt(apiWorkflow)
   * ```
   */
  async queuePrompt(prompt: Record<string, any>, clientId?: string): Promise<{ prompt_id: string; number: number }> {
    return this.post("/prompt", {
      prompt,
      client_id: clientId ?? this.clientId,
    });
  }

  /**
   * Get the current prompt queue status.
   *
   * @returns Running and pending queue items
   */
  async getQueue(): Promise<{ queue_running: any[]; queue_pending: any[] }> {
    return this.get("/queue");
  }

  /**
   * Get execution history, optionally for a specific prompt.
   *
   * @param promptId - If provided, returns history for this prompt only
   * @returns History records keyed by prompt ID
   */
  async getHistory(promptId?: string): Promise<Record<string, any>> {
    return this.get(promptId ? `/history/${promptId}` : "/history");
  }

  /**
   * Get system stats including GPU memory and queue info.
   *
   * @returns System statistics
   */
  async getSystemStats(): Promise<any> {
    return this.get("/system_stats");
  }

  /**
   * Get node type info with input/output schemas.
   *
   * @param nodeClass - If provided, returns info for this node type only
   * @returns Object info keyed by node class name
   */
  async getObjectInfo(nodeClass?: string): Promise<any> {
    return this.get(nodeClass ? `/object_info/${nodeClass}` : "/object_info");
  }

  /** Interrupt the currently executing prompt. */
  async interrupt(): Promise<void> {
    await this.post("/interrupt", {});
  }

  /**
   * List available models, optionally filtered by type.
   *
   * @param type - Model type filter (e.g., 'checkpoints', 'loras')
   * @returns Array of model file names
   */
  async getModels(type?: string): Promise<string[]> {
    return this.get(type ? `/models/${type}` : "/models");
  }

  /** List available embedding models. */
  async getEmbeddings(): Promise<string[]> {
    return this.get("/embeddings");
  }

  /**
   * Upload an image to ComfyUI's input directory.
   *
   * @param file - The image data as Buffer or Blob
   * @param filename - File name for the upload
   * @param opts - Upload options (subfolder, type, overwrite)
   * @returns Upload result from ComfyUI
   */
  async uploadImage(
    file: Buffer | Blob,
    filename: string,
    opts: { subfolder?: string; type?: string; overwrite?: boolean } = {}
  ): Promise<any> {
    const formData = new FormData();
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
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

  /**
   * Download a generated image from ComfyUI as a Buffer.
   *
   * @param filename - The image filename
   * @param subfolder - Subfolder within the output directory
   * @param type - Image type ('output', 'input', 'temp')
   * @returns The image data as a Buffer
   */
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

  /**
   * Open a WebSocket connection to ComfyUI for real-time execution tracking.
   *
   * Events emitted: `execution_start`, `executing`, `progress`, `executed`,
   * `execution_cached`, `execution_error`, `execution_complete`.
   */
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

  /** Close the WebSocket connection. */
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
  // Workflow format detection & conversion
  // ---------------------------------------------------------------------------

  /**
   * Detect whether a workflow object is in UI format (exported from the graph
   * editor) or API format (flat node-id-keyed object with class_type).
   */
  static isUIFormat(workflow: Record<string, any>): boolean {
    return Array.isArray(workflow.nodes) && Array.isArray(workflow.links);
  }

  /**
   * Convert a UI-format workflow to the API format that /prompt expects.
   *
   * Requires a running ComfyUI instance to fetch `object_info` so we can
   * map positional `widgets_values` to their named input fields.
   *
   * If the workflow is already in API format, it's returned as-is.
   */
  async toApiFormat(workflow: Record<string, any>): Promise<Record<string, any>> {
    if (!ComfyUIClient.isUIFormat(workflow)) return workflow;

    const nodes: any[] = workflow.nodes;
    const links: any[] = workflow.links;

    // Build a lookup: linkId -> { sourceNodeId, sourceSlot }
    const linkMap = new Map<number, { sourceNodeId: string; sourceSlot: number }>();
    for (const link of links) {
      // link format: [linkId, sourceNodeId, sourceSlot, targetNodeId, targetSlot, type]
      linkMap.set(link[0], { sourceNodeId: String(link[1]), sourceSlot: link[2] });
    }

    // Fetch object_info for all node types present in the workflow
    const nodeTypes = [...new Set(nodes.map((n) => n.type))];
    const objectInfo: Record<string, any> = {};
    await Promise.all(
      nodeTypes.map(async (type) => {
        try {
          const info = await this.getObjectInfo(type);
          objectInfo[type] = info[type];
        } catch {
          // Node type not found on server — we'll do our best without it
        }
      })
    );

    const apiWorkflow: Record<string, any> = {};

    for (const node of nodes) {
      const nodeId = String(node.id);
      const classType = node.type;
      const inputs: Record<string, any> = {};

      // Resolve connected inputs (from the node's input slots)
      if (node.inputs) {
        for (const input of node.inputs) {
          if (input.link != null) {
            const source = linkMap.get(input.link);
            if (source) {
              inputs[input.name] = [source.sourceNodeId, source.sourceSlot];
            }
          }
        }
      }

      // Map widgets_values to named inputs using object_info
      if (node.widgets_values && objectInfo[classType]) {
        const info = objectInfo[classType];
        const requiredInputs = info.input?.required ?? {};
        const optionalInputs = info.input?.optional ?? {};

        // Collect the widget input names in order (skip ones that are link-connected)
        const connectedNames = new Set(
          (node.inputs || []).filter((i: any) => i.link != null).map((i: any) => i.name)
        );

        const widgetNames: string[] = [];
        for (const [name, config] of Object.entries(requiredInputs) as [string, any][]) {
          if (connectedNames.has(name)) continue;
          // Skip non-widget types (these are slot connections, not widgets)
          const inputType = Array.isArray(config) ? config[0] : config;
          if (typeof inputType === "string" && inputType === inputType.toUpperCase() && inputType.length > 1 && !Array.isArray(config[0])) continue;
          widgetNames.push(name);
        }
        for (const [name, config] of Object.entries(optionalInputs) as [string, any][]) {
          if (connectedNames.has(name)) continue;
          const inputType = Array.isArray(config) ? config[0] : config;
          if (typeof inputType === "string" && inputType === inputType.toUpperCase() && inputType.length > 1 && !Array.isArray(config[0])) continue;
          widgetNames.push(name);
        }

        // Assign values positionally
        for (let i = 0; i < node.widgets_values.length && i < widgetNames.length; i++) {
          inputs[widgetNames[i]!] = node.widgets_values[i];
        }
      }

      apiWorkflow[nodeId] = { class_type: classType, inputs };
    }

    return apiWorkflow;
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
    // Auto-detect and convert UI format -> API format
    const apiFormat = await this.toApiFormat(workflow);
    const prompt = structuredClone(apiFormat);

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

export default ComfyUIClient;
