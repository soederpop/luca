import type { Container } from '@/container';
import { type AvailableFeatures, type FeatureOptions, type FeatureState } from '@/feature'
import { features, Feature } from '@/feature'

declare module '@/feature' {
	interface AvailableFeatures {
		serverInterfaces: ServerInterfaces 
	}
}

/** 
 * The purpose of the `ServerInterfaces` feature is to provide an easy way to define either a Rest or Websocket server 
 * and iteratively add or subtract endpoints / message handlers as needed at runtime.  The primary actor who will be
 * doing this is a self-aware process that wants to define ways to communicate and gather data from other processes, and
 * expose mechanisms to trigger capabilities that it offers.
*/
export class ServerInterfaces extends Feature<ServerInterfacesState, ServerInterfacesOptions> {
	static override shortcut = "features.serverInterfaces" as const

	static attach(container: Container<AvailableFeatures, any>) {
		container.features.register('serverInterfaces', ServerInterfaces)
		return container
	}

	defineServer(name: string) {

	}

	addEndpoint(server: string, endpointConfig: any) {

	}

	describeServer(serverName: string, description: string) {

	}

	describeEndpoint(server: string, endpoint: string, description: string) {

	}
}

export default features.register('serverInterfaces', ServerInterfaces)

export interface ServerInterfacesState extends FeatureState {

}

export interface ServerInterfacesOptions extends FeatureOptions {
}
