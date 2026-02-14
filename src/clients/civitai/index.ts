import {
  Client,
  type ClientOptions,
  type ClientsInterface,
  RestClient,
} from "@/client";
import { Container, type ContainerContext } from "@/container";
import { isEmpty, maxBy, omitBy } from "lodash-es";
import { NodeContainer } from "@/node/container";
import { z } from 'zod'
import { ClientStateSchema } from '@/schemas/base.js'

declare module "@/client" {
  interface AvailableClients {
    civitai: typeof CivitaiClient;
  }
}

export const CivitaiClientStateSchema = ClientStateSchema.extend({
  checkpoints: z.array(z.string()).default([]),
})

export type CivitaiClientState = z.infer<typeof CivitaiClientStateSchema>

export class CivitaiClient<T extends CivitaiClientState> extends RestClient<T> {
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

  async searchByTag(
    tag: string,
    { limit = 100, page = 1, query, type, username }: any = {}
  ): Promise<{ items: ModelInfo[] }> {
    return this.search({ tag, limit, page, type, username, query });
  }

  async searchByUsername(
    username: string,
    { limit = 100, page = 1, type, query }: any = {}
  ): Promise<{ items: ModelInfo[] }> {
    return this.search({ username, limit, page, type, query });
  }

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

  async getModel(modelId: string): Promise<ModelInfo> {
    return this.get(`/api/v1/models/${modelId}`);
  }

  override get container() {
    return this.context.container as NodeContainer;
  }

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
