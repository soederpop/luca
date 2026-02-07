import url from 'node:url'

import { Container, type ContainerState } from "../container";
import { State } from "../state";
import type { FeatureOptions } from "./feature.ts";
import { features, Feature } from "./feature.ts";
import type { AvailableFeatures } from "../feature";
import { Client, type ClientsInterface } from "../client";
import { Server, type ServersInterface } from "../server/index";

import minimist from "minimist";
import { omit, kebabCase, camelCase, mapKeys, castArray } from "lodash-es";
import { basename, parse, relative, resolve, join } from "path";

import "./features/disk-cache";
import "./features/downloader";
import "./features/esbuild";
import "./features/file-manager";
import "./features/fs";
import "./features/git";
import "./features/ipc-socket";
import "./features/json-tree";
import "./features/mdx-bundler";
import "./features/networking";
import "./features/os";
import "./features/package-finder";
import "./features/port-exposer";
import "./features/python";
import "./features/proc";
import "./features/repl";
import "./features/script-runner";
import "./features/ui";
import "./features/vault";
import "./features/vm";
import "./features/yaml-tree";
import "./features/yaml";
import "./features/docker";
import "./features/runpod";
import "./features/secure-shell";

import type { ChildProcess } from "./features/proc";
import type { DiskCache } from "./features/disk-cache";
import type { Downloader } from "./features/downloader";
import type { ESBuild } from "./features/esbuild";
import type { FileManager } from "./features/file-manager";
import type { FS } from "./features/fs";
import type { Git } from "./features/git";
import type { IpcSocket } from "./features/ipc-socket";
import type { JsonTree } from "./features/json-tree";
import type { MdxBundler } from "./features/mdx-bundler";
import type { Networking } from "./features/networking";
import type { OS } from "./features/os";
import type { PackageFinder } from "./features/package-finder";
import type { Python } from "./features/python";
import type { Repl } from "./features/repl";
import type { ScriptRunner } from "./features/script-runner";
import type { UI } from "./features/ui";
import type { Vault } from "./features/vault";
import type { VM } from "./features/vm";
import type { YAML } from "./features/yaml";
import type { YamlTree } from "./features/yaml-tree";
import type { PortExposer } from "./features/port-exposer";
import type { Docker } from './features/docker.ts';
import type { Runpod } from './features/runpod.ts';
import type { SecureShell } from './features/secure-shell.ts';
export { State };

export {
  features,
  Feature,
  type FS,
  type ChildProcess,
  type Git,
  type OS,
  type Networking,
  type UI,
  type FileManager,
  type DiskCache,
  type Vault,
  type ScriptRunner,
  type MdxBundler,
  type Downloader,
  type PortExposer,
  type Docker,
  type Runpod,
  type SecureShell
};

export type { FeatureOptions };

const baseArgv = minimist(process.argv.slice(2)) as Record<string, any> & {
  _: string[];
  cwd?: string;
};
const argv = {
  ...baseArgv,
  ...mapKeys(omit(baseArgv, "_"), (_, key) => camelCase(kebabCase(key))),
};

declare module "../container" {
  interface ContainerArgv {
    cwd?: string;
    _?: string[];
    enable?: string | string[];
  }
}

export interface NodeFeatures extends AvailableFeatures {
  fs: typeof FS;
  scriptRunner: typeof ScriptRunner;
  proc: typeof ChildProcess;
  git: typeof Git;
  os: typeof OS;
  docker: typeof Docker;
  networking: typeof Networking;
  ui: typeof UI;
  vm: typeof VM;
  fileManager: typeof FileManager;
  ipcSocket: typeof IpcSocket;
  yamlTree: typeof YamlTree;
  packageFinder: typeof PackageFinder;
  repl: typeof Repl;
  yaml: typeof YAML;
  esbuild: typeof ESBuild;
  diskCache: typeof DiskCache;
  vault: typeof Vault;
  jsonTree: typeof JsonTree;
  mdxBundler: typeof MdxBundler;
  downloader: typeof Downloader;
  python: typeof Python;
  portExposer: typeof PortExposer;
  runpod: typeof Runpod;
  secureShell: typeof SecureShell;
}

export type ClientsAndServersInterface = ClientsInterface & ServersInterface;

export interface NodeContainer extends ClientsAndServersInterface {}

export class NodeContainer<
  Features extends NodeFeatures = NodeFeatures,
  K extends ContainerState = ContainerState
> extends Container<Features, K> {
  fs!: FS;
  git!: Git;
  proc!: ChildProcess;
  os!: OS;
  networking!: Networking;
  ui!: UI;

  vm!: VM;

  fileManager?: FileManager;
  scriptRunner?: ScriptRunner;
  ipcSocket?: IpcSocket;
  yamlTree?: YamlTree;
  packageFinder?: PackageFinder;
  repl?: Repl;
  esbuild?: ESBuild;
  diskCache?: DiskCache;
  vault?: Vault;
  python?: Python;
  portExposer?: PortExposer;

  constructor(options: any = {}) {
    super({ cwd: process.cwd(), ...argv, ...options });

    this.feature("fs", { enable: true });
    this.feature("proc", { enable: true });
    this.feature("git", { enable: true });
    this.feature("os", { enable: true });
    this.feature("networking", { enable: true });
    this.feature("ui", { enable: true });
    this.feature("vm", { enable: true });

    const enable = castArray(this.options.enable)
      .filter((v) => v && v?.length)
      .map((v) => v as keyof AvailableFeatures);

    enable.forEach((feature) => {
      if (this.features.has(feature)) {
        this.feature(feature, { enable: true });
      }
    });

    this.use(Client).use(Server);
  }

  override get Feature() {
    return Feature;
  }

  get cwd(): string {
    return this.options.cwd || process.cwd();
  }

  get manifest() {
    try {
      const packageJson = this.fs.findUp("packageon");

      if (!packageJson) {
        throw new Error("No packageon found");
      }

      const manifest = this.fs.readJson(packageJson);

      return manifest;
    } catch (error) {
      return {
        name: basename(this.cwd),
        version: "0.0.0",
        type: "module",
      };
    }
  }

  get argv() {
    return this.options as any;
  }

  get urlUtils() {
    return {
      parse: (uri: string) => url.parse(uri) 
    }
  }

  get paths() {
    const { cwd } = this;
    return {
      dirname(path: string) {
        return parse(path).dir
      },
      parse(path: string) {
        return parse(path);
      },
      join(...paths: string[]) {
        return join(cwd, ...paths);
      },
      resolve(...paths: string[]) {
        return resolve(cwd, ...paths);
      },
      relative(...paths: string[]) {
        return relative(cwd, resolve(cwd, ...paths));
      },
    };
  }
}
