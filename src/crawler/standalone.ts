import puppeteer, { Browser, Page, HTTPResponse } from 'puppeteer';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface HarCapture {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    postData?: string;
    timestamp: number;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    content?: string;
    timestamp: number;
  };
  timings: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export interface Crawler {
  harEntries: Array<HarCapture>;
  currentUrl: string;
  goto: (url: string) => Promise<void>;
  click: (selector: string) => Promise<void>;
  eval: <T = any>(code: string) => Promise<T>;
  takeScreenshot: (options?: ScreenshotOptions) => Promise<string>;
  reloadPage: () => Promise<void>;
  close: () => Promise<void>;
}

export interface CrawlerOptions {
  urlMatcher: string;
  wsPort?: number;
}

export interface ScreenshotOptions {
  path?: string;
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class ChromeCrawler implements Crawler {
  private browser: Browser;
  private page: Page;
  public harEntries: Array<HarCapture> = [];
  public currentUrl: string = '';

  constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.page = page;
    this.setupHarCapture();
  }

  private setupHarCapture(): void {
    // Clear existing entries when setting up
    this.harEntries = [];

    // Enable network domain for CDP
    this.page.target().createCDPSession().then(client => {
      client.send('Network.enable');
    });

    // Capture requests and responses
    this.page.on('request', (request) => {
      // We'll store the request data temporarily and complete it when response arrives
      const reqData = {
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        postData: request.postData(),
        timestamp: Date.now()
      };
      
      // Store in a map with request ID for later matching
      (request as any)._harRequestData = reqData;
    });

    this.page.on('response', async (response: HTTPResponse) => {
      try {
        const request = response.request();
        const reqData = (request as any)._harRequestData;
        
        if (!reqData) return;

        const startTime = Date.now();
        let content: string | undefined;
        
        // Only capture response body for XHR/Fetch requests
        const resourceType = request.resourceType();
        if (resourceType === 'xhr' || resourceType === 'fetch') {
          try {
            content = await response.text();
          } catch (error) {
            console.warn('Failed to capture response body:', error);
          }
        }

        const endTime = Date.now();

        const harEntry: HarCapture = {
          request: reqData,
          response: {
            status: response.status(),
            statusText: response.statusText(),
            headers: response.headers(),
            content,
            timestamp: endTime
          },
          timings: {
            startTime: reqData.timestamp,
            endTime,
            duration: endTime - reqData.timestamp
          }
        };

        this.harEntries.push(harEntry);
      } catch (error) {
        console.warn('Error capturing HAR entry:', error);
      }
    });

    // Update current URL on navigation
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame()) {
        this.currentUrl = frame.url();
      }
    });
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    this.currentUrl = url;
  }

  async click(selector: string): Promise<void> {
    await this.page.click(selector);
    // Wait a bit for any potential navigation or XHR requests
    await this.page.waitForTimeout(1000);
  }

  async eval<T = any>(code: string): Promise<T> {
    return await this.page.evaluate(code) as T;
  }

  async takeScreenshot(options: ScreenshotOptions = {}): Promise<string> {
    const timestamp = Date.now();
    const defaultPath = join(process.cwd(), `screenshot-${timestamp}.png`);
    const path = options.path || defaultPath;

    await this.page.screenshot({
      path,
      fullPage: options.fullPage || false,
      clip: options.clip
    });

    return path;
  }

  async reloadPage(): Promise<void> {
    // Clear HAR entries before reload
    this.harEntries = [];
    await this.page.reload({ waitUntil: 'networkidle2' });
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

export async function connectToRunningChromeWithPuppeteer(options: CrawlerOptions): Promise<Crawler> {
  const { urlMatcher, wsPort = 9222 } = options;

  try {
    // Connect to existing Chrome instance
    const browserWSEndpoint = `ws://localhost:${wsPort}`;
    const browser = await puppeteer.connect({ 
      browserWSEndpoint,
      defaultViewport: null // Use the actual viewport size
    });

    // Get all pages
    const pages = await browser.pages();
    
    // Find page that matches the URL pattern
    let targetPage: Page | undefined;
    
    for (const page of pages) {
      const url = page.url();
      if (url.includes(urlMatcher)) {
        targetPage = page;
        break;
      }
    }

    if (!targetPage) {
      // If no matching page found, create a new one
      targetPage = await browser.newPage();
      console.warn(`No page found matching "${urlMatcher}". Created new page.`);
    }

    // Create and return the crawler instance
    const crawler = new ChromeCrawler(browser, targetPage);
    crawler.currentUrl = targetPage.url();

    console.log(`Connected to Chrome tab: ${crawler.currentUrl}`);
    return crawler;

  } catch (error) {
    throw new Error(`Failed to connect to Chrome: ${error}`);
  }
}

// Utility function to export HAR entries to a file
export async function exportHarEntries(harEntries: Array<HarCapture>, filePath: string): Promise<void> {
  const harData = {
    log: {
      version: "1.2",
      creator: {
        name: "Chrome Puppeteer Crawler",
        version: "1.0.0"
      },
      entries: harEntries.map(entry => ({
        startedDateTime: new Date(entry.timings.startTime).toISOString(),
        time: entry.timings.duration,
        request: {
          method: entry.request.method,
          url: entry.request.url,
          headers: Object.entries(entry.request.headers).map(([name, value]) => ({ name, value })),
          postData: entry.request.postData ? {
            mimeType: "application/json",
            text: entry.request.postData
          } : undefined
        },
        response: {
          status: entry.response.status,
          statusText: entry.response.statusText,
          headers: Object.entries(entry.response.headers).map(([name, value]) => ({ name, value })),
          content: entry.response.content ? {
            size: entry.response.content.length,
            mimeType: entry.response.headers['content-type'] || 'text/plain',
            text: entry.response.content
          } : {
            size: 0,
            mimeType: 'text/plain'
          }
        },
        timings: {
          send: 0,
          wait: entry.timings.duration,
          receive: 0
        }
      }))
    }
  };

  await writeFile(filePath, JSON.stringify(harData, null, 2));
}