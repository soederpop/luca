import container from "../src/node"
import { Crawler } from "../src/crawler/crawler"
container.use(Crawler)

declare module "../src/feature" {
  interface AvailableFeatures {
    crawler: typeof Crawler
  }
}

const crawler = container.feature("crawler")