import {
  Client,
  type ClientOptions,
  type ClientsInterface,
  RestClient,
} from "@soederpop/luca/client";
import { Container, type ContainerContext } from "@soederpop/luca/container";
import { isEmpty, maxBy, omitBy } from "lodash-es";
import { NodeContainer } from "@soederpop/luca/node/container";
import { z } from 'zod'
import { ClientStateSchema } from '@soederpop/luca/schemas/base.js'

declare module "@soederpop/luca/client" {
  interface AvailableClients {
    civitai: typeof CivitaiClient;
  }
}

export const CivitaiClientStateSchema = ClientStateSchema.extend({
  checkpoints: z.array(z.string()).default([]).describe('List of downloaded checkpoint file IDs'),
})

export type CivitaiClientState = z.infer<typeof CivitaiClientStateSchema>

/**
 * Civitai client — search, browse, and download AI models from civitai.com.
 *
 * Wraps the Civitai REST API to search for checkpoints, LoRA models, embeddings,
 * and other model types. Supports downloading models directly to disk with
 * metadata extraction.
 *
 * @example
 * ```typescript
 * const civitai = container.client('civitai')
 * const results = await civitai.search({ query: 'anime', type: 'Checkpoint' })
 * console.log(results.items.map(m => m.name))
 * ```
 */
export class CivitaiClient<T extends CivitaiClientState> extends RestClient<T> {
  static override stateSchema = CivitaiClientStateSchema;
  // @ts-ignore
  static attach(container: Container & ClientsInterface, options?: any) {
    container.clients.register("civitai", CivitaiClient);
    return container
  }

  constructor(options: ClientOptions, context: ContainerContext) {
    options = {
      ...options,
      baseURL: "https://civitai.com",
    };

    super(options, context);
  }

  types = [
    "Checkpoint",
    "TextualInversion",
    "Hypernetwork",
    "AestheticGradient",
    "LORA",
    "Controlnet",
    "Poses",
  ];

  /**
   * Search models by tag.
   *
   * @param tag - The tag to search for
   * @param options - Additional search filters
   * @returns Search results with items array
   *
   * @example
   * ```typescript
   * const results = await civitai.searchByTag('anime')
   * ```
   */
  async searchByTag(
    tag: string,
    { limit = 100, page = 1, query, type, username }: any = {}
  ): Promise<{ items: ModelInfo[] }> {
    return this.search({ tag, limit, page, type, username, query });
  }

  /**
   * Search models by creator username.
   *
   * @param username - The creator's username
   * @param options - Additional search filters
   * @returns Search results with items array
   *
   * @example
   * ```typescript
   * const results = await civitai.searchByUsername('stabilityai')
   * ```
   */
  async searchByUsername(
    username: string,
    { limit = 100, page = 1, type, query }: any = {}
  ): Promise<{ items: ModelInfo[] }> {
    return this.search({ username, limit, page, type, query });
  }

  /**
   * Search for models with full filter support.
   *
   * @param options - Search parameters (query, tag, username, type, sorting, pagination)
   * @returns Search results with items array
   *
   * @example
   * ```typescript
   * const results = await civitai.search({ query: 'portrait', type: 'LORA', newest: true })
   * ```
   */
  async search({
    limit = 100,
    page = 1,
    query = "",
    newest = false,
    best = true,
    popular = false,
    tag,
    username,
    type,
  }: any = {}): Promise<{ items: ModelInfo[] }> {
    const params = omitBy({ limit, page, query, tag, username }, (v,k) => typeof v === 'undefined');
    
    let sort = 'Highest Rated'
    
    if (newest) {
      sort = 'Newest'
    }  else if (popular) {
      sort = 'Most Downloaded'
    }

    return this.get("/api/v1/models", {
      ...params,
      sort,
      types: type
    });
  }

  /**
   * Get full model details by ID.
   *
   * @param modelId - The Civitai model ID
   * @returns Complete model info including versions and files
   *
   * @example
   * ```typescript
   * const model = await civitai.getModel('12345')
   * console.log(model.name, model.type)
   * ```
   */
  async getModel(modelId: string): Promise<ModelInfo> {
    return this.get(`/api/v1/models/${modelId}`);
  }

  override get container() {
    return this.context.container as NodeContainer;
  }

  /**
   * Download a checkpoint model to a local folder.
   *
   * Fetches model info, saves metadata as YAML, and optionally downloads the safetensors file.
   *
   * @param modelId - The Civitai model ID
   * @param destinationFolder - Local folder path to download into
   * @param skipDownloadFile - If true, only save metadata without downloading the file
   * @returns Model info with downloadPath
   *
   * @example
   * ```typescript
   * const result = await civitai.downloadCheckpoint('12345', '/models/checkpoints')
   * console.log(`Downloaded to: ${result.downloadPath}`)
   * ```
   */
  async downloadCheckpoint(modelId: string, destinationFolder: string, skipDownloadFile = false) {
    const { paths, utils } = this.container;
    const { stringUtils } = utils;
    const downloader = this.container.feature("downloader");
    const yaml = this.container.feature("yaml");

    const info = await this.getCheckpointInfo(modelId);
    const { downloadUrl, fileName } = info;

    const destinationPath = paths.resolve(destinationFolder, fileName.replace(/\s/g, "_"))

    const metaName = info.fileId;

    await this.container.fs.ensureFolder(paths.resolve("checkpoints"));
    const checkpointMetaPath = paths.resolve("checkpoints", metaName);
    await this.container.fs.writeFileAsync(
      checkpointMetaPath,
      yaml.stringify(info)
    );

    if (skipDownloadFile) {
      return {
        ...info,
        downloadPath: destinationPath,
      };
    } else {
      const downloadPath = await downloader.download(
        downloadUrl,
        destinationPath
      );

      return {
        ...info,
        downloadPath,
      };
    }
  }

  /**
   * Download a textual inversion / embedding model to a local folder.
   *
   * @param modelId - The Civitai model ID
   * @param destinationFolder - Local folder path to download into
   * @param skipDownloadFile - If true, only save metadata without downloading
   * @param modelFileId - Specific version ID to download
   * @returns Model info with downloadPath
   *
   * @example
   * ```typescript
   * const result = await civitai.downloadEmbedding('67890', '/models/embeddings')
   * ```
   */
  async downloadEmbedding(modelId: string, destinationFolder: string,skipDownloadFile = false, modelFileId?: string) {
    const { paths, utils } = this.container;
    const downloader = this.container.feature("downloader");
    const yaml = this.container.feature("yaml");

    const info = await this.getEmbeddingModelInfo(modelId);
    const { downloadUrl, fileName } = info;

    const destinationPath = paths.resolve(
      destinationFolder,
      fileName
    );

    const embeddingPath = paths.resolve(
      "embeddings",
      `${utils.stringUtils.camelCase(
        utils.stringUtils.kebabCase(info.name)
      )}.yml`
    );

    await this.container.fs.writeFileAsync(embeddingPath, yaml.stringify(info));

    if (!skipDownloadFile) {
      const downloadPath = await downloader.download(
        downloadUrl,
        destinationPath
      );
      return {
        ...info,
        downloadPath,
      };
    }

    return {
      ...info,
      downloadPath: destinationPath,
    };
  }


  /**
   * Download a LoRA model to a local folder.
   *
   * @param modelId - The Civitai model ID
   * @param fileId - The specific file/version ID to download
   * @param destinationFolder - Local folder path to download into
   * @param skipDownloadFile - If true, only return info without downloading
   * @returns Model info with downloadPath and LoRA tag
   *
   * @example
   * ```typescript
   * const result = await civitai.downloadLoraModel('12345', '67890', '/models/loras')
   * console.log(result.tag) // '<lora:model_name:1>'
   * ```
   */
  async downloadLoraModel(modelId: string, fileId: string | number, destinationFolder: string, skipDownloadFile = false) {
    const { paths } = this.container;
    const downloader = this.container.feature("downloader");

    const info = await this.getLoraModelInfo(modelId, fileId);
    const { downloadUrl, fileName } = info;

    const destinationPath = paths.resolve(
      destinationFolder,
      fileName
    );

    if (!skipDownloadFile) {
      const downloadPath = await downloader.download(
        downloadUrl,
        destinationPath
      );
      return {
        ...info,
        downloadPath,
      };
    }

    return {
      ...info,
      downloadPath: destinationPath,
    };
  }

  /**
   * Get metadata for the latest checkpoint version of a model.
   *
   * @param modelId - The Civitai model ID
   * @returns Checkpoint info with download URL, file name, and image URLs
   *
   * @example
   * ```typescript
   * const info = await civitai.getCheckpointInfo('12345')
   * console.log(info.fileName, info.downloadUrl)
   * ```
   */
  async getCheckpointInfo(modelId: string) {
    const { utils } = this.container;
    const model = await this.getModel(modelId);
    const { modelVersions = [] } = model;
    const latest = maxBy(modelVersions, "createdAt")!;
    const primaryFile =
      latest?.files?.find((f) => f.primary)! || latest?.files[0]!;
    const fileId = `${utils.stringUtils.camelCase(
      utils.stringUtils.kebabCase(model.name)
    )}.yml`;

    if (!primaryFile) {
      console.log(latest);
      throw new Error(`Can not find primary file for ${modelId}`);
    }

    return {
      modelId: model.id,
      name: model.name,
      fileId,
      fileName: primaryFile.name,
      downloadUrl: primaryFile.downloadUrl,
      imageUrls: latest.images.map((i) => i.url),
      imageInfo: latest.images.map((i) => ({
        url: i.url,
        prompt: i.meta?.prompt || "",
        negativePrompt: i.meta?.negativePrompt || "",
      })),
    };
  }

  /**
   * Get metadata for a LoRA model including trained words and LoRA tag.
   *
   * @param modelId - The Civitai model ID
   * @param downloadFileId - Specific version ID (defaults to latest)
   * @returns LoRA info with download URL, tag, trained words, and images
   *
   * @example
   * ```typescript
   * const info = await civitai.getLoraModelInfo('12345')
   * console.log(info.tag, info.words)
   * ```
   */
  async getLoraModelInfo(modelId: string, downloadFileId?: string | number) {
    const { utils } = this.container;

    const model = await this.getModel(modelId);
    const { modelVersions = [] } = model;
    const latest = maxBy(modelVersions, "createdAt")!;
    const primaryFile = downloadFileId ? modelVersions.find(m => String(m.id) === String(downloadFileId))! : latest?.files?.find((f) => f.primary)! || modelVersions[0]!;
    let fileId = `${utils.stringUtils.camelCase(
      utils.stringUtils.kebabCase(model.name)
    )}.yml`.replace(/\W/g, "_");
    
    if (downloadFileId) {
      fileId = [downloadFileId, fileId].join("_")   
    }

    // @ts-ignore-next-line
    if (!primaryFile?.downloadUrl) {
      throw new Error(`No primary file found for ${modelId} ${model.name}`);
    }

    return {
      modelId: model.id,
      name: model.name,
      fileId,
      fileName: primaryFile.name,
      modelVersions,
    // @ts-ignore-next-line
      downloadUrl: primaryFile.downloadUrl,
      tag: `<lora:${primaryFile.name.replace(".safetensors", "")}:1>`,
      words: latest.trainedWords,
      imageUrls: latest.images.map((i) => i.url),
      imageInfo: latest.images.map((i) => ({
        url: i.url,
        prompt: i.meta?.prompt || "",
        negativePrompt: i.meta?.negativePrompt || "",
      })),
    };
  }

  /**
   * Get metadata for an embedding model including trained words.
   *
   * @param modelId - The Civitai model ID
   * @param modelFileId - Specific version ID (defaults to latest)
   * @returns Embedding info with download URL, trained words, and images
   *
   * @example
   * ```typescript
   * const info = await civitai.getEmbeddingModelInfo('12345')
   * console.log(info.words)
   * ```
   */
  async getEmbeddingModelInfo(modelId: string, modelFileId?: string) {
    const { utils } = this.container;

    const model = await this.getModel(modelId);
    const { modelVersions = [] } = model;
    const latest = modelVersions.find(i => i.id.toString() === String(modelFileId)) || maxBy(modelVersions, "createdAt")!;
    const primaryFile = latest?.files?.find((f) => f.primary)!;
    const fileId = `${utils.stringUtils.camelCase(
      utils.stringUtils.kebabCase(model.name)
    )}.yml`;

    if (!primaryFile) {
      throw new Error(`No primary file found for ${modelId} ${model.name}`);
    }

    return {
      modelId: model.id,
      name: model.name,
      fileId,
      fileName: primaryFile.name,
      downloadUrl: primaryFile.downloadUrl,
      words: latest.trainedWords,
      imageUrls: latest.images.map((i) => i.url),
      imageInfo: latest.images.map((i) => ({
        url: i.url,
        prompt: i.meta?.prompt || "",
        negativePrompt: i.meta?.negativePrompt || "",
      })),
    };
  }

}

export type ModelInfo = {
  id: number;
  name: string;
  description: string;
  type: string;
  poi: boolean;
  nsfw: boolean;
  allowNoCredit: boolean;
  allowCommercialUse: string;
  allowDerivatives: boolean;
  allowDifferentLicense: boolean;
  stats: {
    downloadCount: number;
    favoriteCount: number;
    commentCount: number;
    ratingCount: number;
    rating: number;
  };
  creator: {
    username: string;
    image: string;
  };
  tags: {
    name: string;
  }[];
  modelVersions: {
    id: number;
    modelId: number;
    name: string;
    createdAt: string;
    updatedAt: string;
    trainedWords: string[];
    baseModel: string;
    earlyAccessTimeFrame: number;
    description: string;
    stats: {
      downloadCount: number;
      ratingCount: number;
      rating: number;
    };
    files: {
      name: string;
      id: number;
      sizeKB: number;
      type: string;
      metadata: {
        fp: string;
        size: string | number;
        format: string;
      };
      pickleScanResult: string;
      pickleScanMessage: string;
      virusScanResult: string;
      scannedAt: string;
      hashes: {
        AutoV1: string;
        AutoV2: string;
        SHA256: string;
        CRC32: string;
        BLAKE3: string;
      };
      downloadUrl: string;
      primary: boolean;
    }[];
    images: {
      url: string;
      nsfw: boolean | string;
      width: number;
      height: number;
      hash: string;
      meta: {
        Size: string;
        seed: number;
        steps: number;
        prompt: string;
        sampler: string;
        cfgScale: number;
        resources: any[];
        Model_hash: string;
        Variation_seed: string;
        negativePrompt: string;
        Variation_seed_strength: string;
      };
    }[];
  }[];
};
