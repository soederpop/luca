import { Feature, type FeatureOptions, type FeatureState, features } from "../feature.js";
import vm from 'vm'

async function start(options: any) {
  const repl = await import('node:repl')
  return repl.start(options)
}

export interface ReplState extends FeatureState {
  started?: boolean;
}

export interface ReplOptions extends FeatureOptions {
  prompt?: string;
  historyPath?: string;
}

export class Repl<
  T extends ReplState = ReplState,
  K extends ReplOptions = ReplOptions
> extends Feature<T, K> {
  get isStarted() {
    return !!this.state.get("started");
  }

  _server?: ReturnType<typeof start> 

  async createServer() {
    if (this._server) {
      return this._server
    }

    const { prompt = "> " } = this.options;
    const server = start({
      useGlobal: false,
      useColors: true,
      terminal: true,
      prompt,
      eval: (
        command: string,
        context: any,
        file: string,
        cb: (err: any, result: any) => void
      ) => {
        const script = new vm.Script(command);
        const result = script.runInContext(context);

        if (typeof result?.then === "function") {
          result
            .then((result: any) => cb(null, result))
            .catch((e: any) => cb(null, e));
        } else {
          cb(null, result);
        }
      },
    });
   
    return this._server = server
  }

  async start(options: { historyPath?: string, context?: any, exclude?: string | string[] } = {}) {
    if (this.isStarted) {
      return this;
    }
    
    const userHistoryPath = options.historyPath || this.options.historyPath
    
    const historyPath = typeof userHistoryPath === 'string' 
      ? this.container.paths.resolve(userHistoryPath)
      : this.container.paths.resolve('node_modules', '.cache', '.repl_history')
    
    this.container.fs.ensureFolder(this.container.paths.dirname(historyPath))
    //await this.container.fs.ensureFileAsync(historyPath, '', false)
   
    const server = await this.createServer()

    await new Promise((res,rej) => {
      server.setupHistory(historyPath, (err) => {
        err ? rej(err) : res(true)
      })
    })
    
    Object.assign(server.context, this.container.context, options.context || {}, {
      // @ts-ignore-next-line
      client: (...args) => this.container.client(...args)
    })

    return this;
  }
}

export default features.register("repl", Repl);
