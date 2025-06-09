import {
  features,
  type FeatureState,
  type FeatureOptions,
  Feature,
} from "../node/feature.js";
// @ts-ignore-next-line
import type { PuppeteerHar } from "puppeteer-har";
import { Container } from "../container.js";
import { devices } from "./devices.js";
import { load } from 'cheerio'

import type { connect, launch, Browser, HTTPRequest, HTTPResponse, Page } from "puppeteer";

const DeviceDescriptors = devices;

export interface CrawlerOptions extends FeatureOptions {
  harPath?: string;
  tracePath?: string;
  url?: string;
  launchOptions?: Record<string, any>;
  onResponse?: (response: HTTPResponse) => void;
  onRequest?: (request: HTTPRequest) => void;
  connect?: string;
  puppeteer: {
    connect: typeof connect,
    launch: typeof launch,
    har: typeof PuppeteerHar
  }
}

type RunOptions = {
  waitFor?: number | "networkidle0" | "networkidle2";
  stopHar?: boolean;
  waitForIdle?: boolean;
};

type SetupPuppeteerOptions = {
  device?: string;
  headless?: boolean;
  launchArgs?: string[];
};

type HarEntry = {
  response: {
    status: number;
    headers: Array<{ name: string; value: string }>;
  };
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
};

type HARData = {
  log: {
    entries: Array<HarEntry>;
  };
};

export class Crawler extends Feature<FeatureState, CrawlerOptions> {
  static attach(container: Container) {
    // @ts-ignore-next-line
    container.features.register("crawler", Crawler);
  }

  tryResult<T extends keyof CrawlerOptions>(key: T, defaultValue?: any) {
    return (this.options[key] || defaultValue) as CrawlerOptions[T] | undefined;
  }

  async run(options: RunOptions & SetupPuppeteerOptions = {}) {
    const { waitFor, stopHar = true, waitForIdle = true } = options;
    const { pick } = this.container.utils.lodash;

    const harPath = this.tryResult("harPath");
    const tracePath = this.tryResult("tracePath");
    await this.setupPupeteer(pick(options));

    await this.har.start({
      ...(harPath && { path: harPath }),
    });

    let pageDidLoad: boolean;
    this.page.once("load", () => {
      pageDidLoad = true;
    });

    await this.page.tracing.start();

    await this.goto(this.url, {
      ...(waitForIdle && { waitFor: "networkidle0" }),
    });

    if (!waitForIdle) {
      await new Promise((res) => {
        if (pageDidLoad) {
          res(true);
          return;
        }
        this.page.once("load", () => {
          res(false);
        });
      });
    }

    if (typeof waitFor === "number") {
      await new Promise((res) => setTimeout(res, waitFor));
    }

    if (stopHar) {
      await this.stopHar();
    }

    const traceData = await this.page.tracing.stop();

    this.data.set("_tracingData", JSON.parse(String(traceData)));

    return this;
  }

  data = new Map();

  get tracingData() {
    return this.data.get("_tracingData");
  }

  async cookies() {
    return this.page.cookies();
  }

  async content() {
    return this.page.content();
  }

  get wasRedirected() {
    return !!this.harEntries.find(
      ({ response }) => response.status === 302 || response.status === 301
    );
  }

  get url() {
    return this.tryResult("url")!;
  }

  get uri() {
    return new URL(this.url);
  }

  get browser(): Browser {
    return this.data.get("_browser") as Browser;
  }

  get page(): Page {
    return this.data.get("_page") as Page;
  }

  get currentUrl() {
    return this.page.url();
  }

  get deviceDescriptors() {
    return this.container.utils.lodash.keyBy(DeviceDescriptors, "name");
  }

  get requestedUrls(): string[] {
    return this.harEntries.map(({ request }) => request.url);
  }

  get requestedHosts() {
    const { uniq } = this.container.utils.lodash;
    return uniq(this.requestedUrls.map((url) => new URL(url).hostname));
  }

  get requestedUrlsByHost() {
    const { mapValues, groupBy } = this.container.utils.lodash;
    return mapValues(
      groupBy(this.requestedUrls, (url) => new URL(url).hostname),
      (v: string) => new URL(v).pathname
    );
  }

  get requestsByHost() {
    const { groupBy } = this.container.utils.lodash;
    return groupBy(
      this.harEntries,
      ({ request }) => new URL(request.url).hostname
    );
  }

  get documentRequest() {
    return this.harEntries.find(
      ({ request }) => request.url === this.currentUrl
    );
  }

  get documentResponseHeaders() {
    if (!this.documentRequest) {
      return {};
    }

    return this.documentRequest.response.headers.reduce(
      (memo, pair) => ({
        ...memo,
        [pair.name]: pair.value,
      }),
      {}
    );
  }

  get har() {
    return this.data.get("_har");
  }

  get harData(): HARData {
    return this.data.get("_harData") || {};
  }

  get harEntries(): HarEntry[] {
    return this.tryGet("harData.log.entries", []);
  }

  async stopHar() {
    const harData = await this.har.stop();
    this.data.set("_harData", harData);
    return harData;
  }

  async saveHar(path: string) {
    const outputPath = this.container.paths.resolve(path);

    await this.container.fs.ensureFileAsync(
      outputPath,
      JSON.stringify(this.harData)
    );

    return outputPath;
  }

  async saveTrace(path: string) {
    await this.container.fs.ensureFileAsync(
      this.container.paths.resolve(path),
      this.tracingData
    );
    return this.container.paths.resolve(path);
  }

  get isBrowserConnected() {
    return this.browser?.isConnected();
  }

  async close() {
    if (this.browser?.isConnected()) {
      await this.browser?.close();
    }
    return this;
  }

  async goto(url = this.url, options?: any) {
    await this.page.goto(url, options);
    return this;
  }

  wsEndpoint?: string;
  wsPort?: string;

  async isChromeRunning() {
    return this.container.feature("networking").isPortOpen(9222).then(r => !r);
  }

  async launchChrome() {
    if(await this.isChromeRunning()) {
      return this
    }

    await this.container.proc.spawnAndCapture("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
      '--remote-debugging-port',
      '9222'      
    ], {
      onOutput: (output) => {
        console.log(output)
      },
      onError: (output) => {
        console.log(output)
      }
    })    
  }

  async setupPupeteer(options: SetupPuppeteerOptions = {}) {
    const { launch, connect } = this.options.puppeteer

    const {
      headless = true,
      device,
      launchArgs = [],
    } = {
      ...this.options,
      ...options,
    };

    const launchOptions = this.tryResult("launchOptions", {});

    if (!this.browser) {
      const browser = await (!this.options.connect
        ? launch({
            headless,
            defaultViewport: null,
            args: [...launchArgs],
            ...launchOptions,
          })
        : connect({ defaultViewport: null, browserWSEndpoint: this.options.connect }));

      this.data.set("_browser", browser);

      const wsEndpoint = await browser.wsEndpoint();

      this.wsEndpoint = wsEndpoint;
      this.wsPort = new URL(wsEndpoint).port;
    }

    if (!this.page) {
      const page = await this.browser.newPage();
      const har = new this.options.puppeteer.har(page);
      this.data.set("_page", page);
      this.data.set("_har", har);

      page.on("request", (request: any) => {
        this.receivedRequest(request.url());
      });

      page.on("response", async (response) => {
        this.onResponse(response);
      });
    }

    /*
    if (this.deviceDescriptors[device]) {
      await this.page.emulate(this.deviceDescriptors[device]);
    }
    */

    return this;
  }
  
  async cheerio() {
    return load(await this.content())
  }

  $eval(...args: any[]) {
    // @ts-ignore-next-line
    return this.page.$eval(...args);
  }

  $$eval(...args: any[]) {
    // @ts-ignore-next-line
    return this.page.$$eval(...args);
  }
 
  async click(selector: string) {
    return this.$eval(selector, (el: HTMLElement) => el.click());
  }

  async fillIn(selector: string, value: string) {
    return this.$eval(selector, (el: HTMLInputElement, val: string) => el.value = val, value)
  }

  async receivedRequest(request: any) {
    if (this.options.onRequest) {
      await this.options.onRequest(request);
    }
  }

  async onResponse(response: any) {
    if (this.options.onResponse) {
      this.options.onResponse(response);
    }
  }
}

// @ts-ignore-next-line
export default features.register("crawler", Crawler);
