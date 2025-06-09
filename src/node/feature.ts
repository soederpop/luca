import type { NodeFeatures, NodeContainer } from './container.js'
import type { FeatureOptions, FeatureState } from '../feature.ts'
import { features, Feature as UniversalFeature } from '../feature.ts'

export { features }

export type { FeatureState, FeatureOptions }

export class Feature<T extends FeatureState = FeatureState, K extends FeatureOptions = FeatureOptions> extends UniversalFeature<T, K> {
    override get container() : NodeContainer<NodeFeatures> {
        return super.container as NodeContainer<NodeFeatures>
    }
}