import url from 'node:url'

import { Container, type ContainerState } from "../container";
import { State } from "../state";
import type { FeatureOptions } from "./feature";
import { features, Feature } from "./feature";
import type { AvailableFeatures } from "../feature";
import { Client, type ClientsInterface } from "../client";
import { Server, type ServersInterface } from "../server";
import "../servers/express";
import "../servers/socket";
import "../servers/mcp";
import { Command, type CommandsInterface } from "../command";
import { Endpoint, type EndpointsInterface } from "../endpoint";

import minimist from "minimist";
import { omit, kebabCase, camelCase, mapKeys, castArray } from "lodash-es";
import { basename, parse, relative, resolve, join } from "path";

import "./features/disk-cache";
import "./features/content-db";
import "./features/downloader";
import "./features/esbuild";
import "./features/file-manager";
import "./features/fs";
import "./features/git";
import "./features/grep";
import "./features/ipc-socket";
import "./features/json-tree";
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
import "./features/tmux";
import "./features/ink";
import "./features/telegram";
import "./features/opener";
import "./features/postgres";
import "./features/sqlite";
import "./features/google-auth";
import "./features/google-drive";
import "./features/google-sheets";
import "./features/google-calendar";
import "./features/google-docs";
import "./features/window-manager";

import type { ChildProcess } from "./features/proc";
import type { DiskCache } from "./features/disk-cache";
import type { ContentDb } from "./features/content-db";
import type { Downloader } from "./features/downloader";
import type { ESBuild } from "./features/esbuild";
import type { FileManager } from "./features/file-manager";
import type { FS } from "./features/fs";
import type { Git } from "./features/git";
import type { Grep } from "./features/grep";
import type { IpcSocket } from "./features/ipc-socket";
import type { JsonTree } from "./features/json-tree";
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
import type { Docker } from './features/docker';
import type { Runpod } from './features/runpod';
import type { SecureShell } from './features/secure-shell';
import type { Tmux } from './features/tmux';
import type { Ink } from './features/ink';
import type { Telegram } from './features/telegram';
import type { Opener } from './features/opener';
import type { Postgres } from './features/postgres';
import type { Sqlite } from './features/sqlite';
import type { GoogleAuth } from './features/google-auth';
import type { GoogleDrive } from './features/google-drive';
import type { GoogleSheets } from './features/google-sheets';
import type { GoogleCalendar } from './features/google-calendar';
import type { GoogleDocs } from './features/google-docs';
import type { WindowManager } from './features/window-manager';
export { State };

export {
  features,
  Feature,
  type FS,
  type ContentDb,
  type ChildProcess,
  type Git,
  type Grep,
  type OS,
  type Networking,
  type UI,
  type FileManager,
  type DiskCache,
  type Vault,
  type ScriptRunner,
  type Downloader,
  type PortExposer,
  type Docker,
  type Runpod,
  type SecureShell,
  type Tmux,
  type Ink,
  type Telegram,
  type Opener,
  type Postgres,
  type Sqlite,
  type GoogleAuth,
  type GoogleDrive,
  type GoogleSheets,
  type GoogleCalendar,
  type GoogleDocs,
  type WindowManager,
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
  grep: typeof Grep;
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
  downloader: typeof Downloader;
  python: typeof Python;
  portExposer: typeof PortExposer;
  runpod: typeof Runpod;
  secureShell: typeof SecureShell;
  tmux: typeof Tmux;
  ink: typeof Ink;
  telegram: typeof Telegram;
  opener: typeof Opener;
  postgres: typeof Postgres;
  sqlite: typeof Sqlite;
  contentDb: typeof ContentDb;
  googleAuth: typeof GoogleAuth;
  googleDrive: typeof GoogleDrive;
  googleSheets: typeof GoogleSheets;
  googleCalendar: typeof GoogleCalendar;
  googleDocs: typeof GoogleDocs;
  windowManager: typeof WindowManager;
}

export type ClientsAndServersInterface = ClientsInterface & ServersInterface & CommandsInterface & EndpointsInterface;

export interface NodeContainer extends ClientsAndServersInterface {}

export class NodeContainer<
  Features extends NodeFeatures = NodeFeatures,
  K extends ContainerState = ContainerState
> extends Container<Features, K> {
  fs!: FS;
  git!: Git;
  grep!: Grep;
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
  tmux?: Tmux;
  ink?: Ink;
  telegram?: Telegram;
  opener?: Opener;
  postgres?: Postgres;
  sqlite?: Sqlite;
  googleAuth?: GoogleAuth;
  googleDrive?: GoogleDrive;
  googleSheets?: GoogleSheets;
  googleCalendar?: GoogleCalendar;
  googleDocs?: GoogleDocs;
  windowManager?: WindowManager;

  constructor(options: any = {}) {
    super({ cwd: process.cwd(), ...argv, ...options });

    // Bun loads .env from cwd automatically; no dotenv needed.

    this.feature("fs", { enable: true });
    this.feature("proc", { enable: true });
    this.feature("git", { enable: true });
    this.feature("grep", { enable: true });
    this.feature("os", { enable: true });
    this.feature("networking", { enable: true });
    this.feature("ui", { enable: true });
    this.feature("vm", { enable: true, context: {} });
    this.feature("esbuild", { enable: true }); 

    const enable = castArray(this.options.enable)
      .filter((v) => v && v?.length)
      .map((v) => v as keyof AvailableFeatures);

    enable.forEach((feature) => {
      if (this.features.has(feature)) {
        this.feature(feature, { enable: true });
      }
    });

    this.use(Client).use(Server).use(Command).use(Endpoint);

    loadLocalContainerModule(this as NodeContainer)
  }

  override get Feature() {
    return Feature;
  }

  /** Returns the current working directory, from options or process.cwd(). */
  get cwd(): string {
    return this.options.cwd || process.cwd();
  }

  /** Returns the parsed package.json manifest for the current working directory. */
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

  /** Returns the parsed command-line arguments (from minimist). */
  get argv() {
    return this.options as any;
  }

  /** Returns URL utility functions for parsing URIs. */
  get urlUtils() {
    return {
      parse: (uri: string) => url.parse(uri)
    }
  }

  /** Returns path utility functions scoped to the current working directory (join, resolve, relative, dirname, parse). */
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

/** */
function loadLocalContainerModule(container: NodeContainer) {
  const containerModulePath = container.paths.resolve('container.ts')
  if (!container.fs.exists(containerModulePath)) {
    return
  }

  const vm = container.vm

  const moduleExports = vm.loadModule(containerModulePath, { container }) || {}

  // some ideas, automatically iterate over the exports, if any feature classes, register the feature with the features registry,
  // same for clients, servers, commands, any helper that is known to the container

  if (typeof moduleExports.main === 'function') {
    moduleExports.main(container)
  }

  if (typeof moduleExports.onStart === 'function') {
    container.once('started', () => moduleExports.onStart(container))
  }
}
