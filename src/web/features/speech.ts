import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from "../feature.js";
import { Container, type ContainerContext } from "../container.js";

export const SpeechOptionsSchema = FeatureOptionsSchema.extend({
  voice: z.string().optional(),
})

export const SpeechStateSchema = FeatureStateSchema.extend({
  defaultVoice: z.string(),
  voices: z.array(z.any().describe('Voice object')).optional(),
})

export type SpeechOptions = z.infer<typeof SpeechOptionsSchema>
export type SpeechState = z.infer<typeof SpeechStateSchema>

type Voice = {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
};  

export class Speech<
  T extends SpeechState = SpeechState,
  K extends SpeechOptions = SpeechOptions
> extends Feature<T, K> {

  static attach(container: Container & { speech?: Speech }) {
    container.features.register("speech", Speech);
  }

  static override stateSchema = SpeechStateSchema
  static override optionsSchema = SpeechOptionsSchema
  static override shortcut = "features.speech" as const
  
  constructor(options: K, context: ContainerContext) {
    super(options,context)  

    if(options.voice) {
      this.state.set("defaultVoice", options.voice)
    }

    this.loadVoices()
  }
  
  get voices() {
    return this.state.get('voices') || [] 
  }
  
  get defaultVoice() {
    return this.voices.find(v => v.name === this.state.get("defaultVoice"))
  }

  loadVoices() {
    const voices = speechSynthesis.getVoices();
    this.state.set("voices", voices);

    if (!this.state.get("defaultVoice") && voices.length > 0) {
      const defaultVoice = voices.find(v => v.default)!
      this.state.set("defaultVoice", defaultVoice.name);
    }
  }

  setDefaultVoice(name: string) {
    const voice = this.voices.find(v => v.name === name)!
    this.state.set("defaultVoice", voice.name);
  }
  
  cancel() {
    speechSynthesis.cancel()
    return this
  }

  say(text: string, options: { voice?: Voice } = {}) {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = options.voice || this.defaultVoice 
    utterance.voice = voice || this.voices[0]! 
    speechSynthesis.speak(utterance);
  }
}

export default features.register("speech", Speech);