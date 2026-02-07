import {
  type ClientOptions,
  type ClientState,
  type ClientsInterface,
	clients,	
  RestClient,
} from "@/client";
import { type ContainerContext } from "@/container";

declare module "@/client" {
  interface AvailableClients {
    myClient: typeof MyClient;
  }
}

export interface MyClientState extends ClientState {
  checkpoints: string[];
}

export class MyClient<T extends MyClientState> extends RestClient<T> {
  // @ts-ignore
  static attach(container: Container & ClientsInterface, options?: any) {
    container.clients.register("civitai", MyClient);
    return container
  }

  constructor(options: ClientOptions, context: ContainerContext) {
    options = {
      ...options,
      baseURL: "https://platform.cloud.coveo.com/rest/search/v2",
    };

    super(options, context);
  }
}

export default clients.register('civitai', MyClient)