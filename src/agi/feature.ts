import type { AGIFeatures, AGIContainer } from './container.server.js'
import type { FeatureOptions, FeatureState } from '../feature.ts'
import { features, Feature as NodeFeature } from '../node/feature.ts'

export { features }

export type { FeatureState, FeatureOptions }

export class Feature<T extends FeatureState = FeatureState, K extends FeatureOptions = FeatureOptions> extends NodeFeature<T, K> {
    override get container(): AGIContainer<AGIFeatures> {
        return super.container as AGIContainer<AGIFeatures>
    }
}
