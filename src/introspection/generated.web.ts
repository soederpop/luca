import { setBuildTimeData, setContainerBuildTimeData } from './index.js';

// Auto-generated introspection registry data
// Generated at: 2026-04-05T06:58:06.168Z

setBuildTimeData('features.containerLink', {
  "id": "features.containerLink",
  "description": "ContainerLink (Web-side) — WebSocket client that connects to a node host. Connects to a ContainerLink host over WebSocket. The host can evaluate code in this container, and the web side can emit structured events to the host. The web side can NEVER eval code in the host — trust is strictly one-way.",
  "shortcut": "features.containerLink",
  "className": "ContainerLink",
  "methods": {
    "connect": {
      "description": "Connect to the host WebSocket server and perform registration.",
      "parameters": {
        "hostUrl": {
          "type": "string",
          "description": "Override the configured host URL"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "disconnect": {
      "description": "Disconnect from the host.",
      "parameters": {
        "reason": {
          "type": "string",
          "description": "Optional reason string"
        }
      },
      "required": [],
      "returns": "void"
    },
    "emitToHost": {
      "description": "Send a structured event to the host container.",
      "parameters": {
        "eventName": {
          "type": "string",
          "description": "Name of the event"
        },
        "data": {
          "type": "any",
          "description": "Optional event data"
        }
      },
      "required": [
        "eventName"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "isConnected": {
      "description": "Whether currently connected to the host.",
      "returns": "boolean"
    },
    "token": {
      "description": "The auth token received from the host.",
      "returns": "string | undefined"
    },
    "hostId": {
      "description": "The host container's UUID.",
      "returns": "string | undefined"
    }
  },
  "events": {
    "connected": {
      "name": "connected",
      "description": "Event emitted by ContainerLink",
      "arguments": {}
    },
    "disconnected": {
      "name": "disconnected",
      "description": "Event emitted by ContainerLink",
      "arguments": {}
    },
    "evalRequest": {
      "name": "evalRequest",
      "description": "Event emitted by ContainerLink",
      "arguments": {}
    },
    "reconnecting": {
      "name": "reconnecting",
      "description": "Event emitted by ContainerLink",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const link = container.feature('containerLink', {\n enable: true,\n hostUrl: 'ws://localhost:8089',\n})\nawait link.connect()\n\n// Send events to the host\nlink.emitToHost('click', { x: 100, y: 200 })\n\n// Listen for eval requests before they execute\nlink.on('evalRequest', (code, requestId) => {\n console.log('Host is evaluating:', code)\n})"
    }
  ]
});

setBuildTimeData('features.esbuild', {
  "id": "features.esbuild",
  "description": "Browser-side TypeScript/ESM compilation feature using esbuild-wasm. Loads esbuild's WebAssembly build via the AssetLoader, then provides `compile()` and `transform()` methods that work entirely in the browser. Useful for live playgrounds, in-browser REPLs, and client-side bundling.",
  "shortcut": "features.esbuild",
  "className": "Esbuild",
  "methods": {
    "compile": {
      "description": "",
      "parameters": {
        "code": {
          "type": "string",
          "description": "Parameter code"
        },
        "options": {
          "type": "esbuild.TransformOptions",
          "description": "Parameter options"
        }
      },
      "required": [
        "code"
      ],
      "returns": "void"
    },
    "clearCache": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "start": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "assetLoader": {
      "description": "Returns the assetLoader feature for loading external libraries from unpkg.",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const esbuild = container.feature('esbuild')\nawait esbuild.start()\nconst result = await esbuild.compile('const x: number = 1')\nconsole.log(result.code)"
    }
  ]
});

setBuildTimeData('features.voice', {
  "id": "features.voice",
  "description": "Speech-to-text recognition using the Web Speech API (SpeechRecognition). Wraps the browser's built-in speech recognition, supporting continuous listening, interim results, and language selection. Recognized text is accumulated in state and emitted as events for real-time transcription UIs.",
  "shortcut": "features.voice",
  "className": "VoiceRecognition",
  "methods": {
    "whenFinished": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "start": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "stop": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "abort": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "clearTranscript": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "listening": {
      "description": "Whether the speech recognizer is currently listening for audio input.",
      "returns": "any"
    },
    "transcript": {
      "description": "Returns the accumulated final transcript text from recognition results.",
      "returns": "any"
    }
  },
  "events": {
    "start": {
      "name": "start",
      "description": "Event emitted by VoiceRecognition",
      "arguments": {}
    },
    "stop": {
      "name": "stop",
      "description": "Event emitted by VoiceRecognition",
      "arguments": {}
    },
    "abort": {
      "name": "abort",
      "description": "Event emitted by VoiceRecognition",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const voice = container.feature('voice', { continuous: true, autoListen: true })\n\nvoice.on('transcript', ({ text }) => {\n console.log('Heard:', text)\n})\n\n// Or start manually\nvoice.start()"
    }
  ]
});

setBuildTimeData('features.vm', {
  "id": "features.vm",
  "description": "Sandboxed JavaScript execution environment for the browser. Automatically injects the container's context object into the global scope, so evaluated code can use anything provided by the container. Useful for live code playgrounds, plugin systems, and dynamic script evaluation.",
  "shortcut": "features.vm",
  "className": "VM",
  "methods": {
    "createScript": {
      "description": "",
      "parameters": {
        "code": {
          "type": "string",
          "description": "Parameter code"
        }
      },
      "required": [
        "code"
      ],
      "returns": "void"
    },
    "createContext": {
      "description": "",
      "parameters": {
        "ctx": {
          "type": "any",
          "description": "Parameter ctx"
        }
      },
      "required": [],
      "returns": "void"
    },
    "run": {
      "description": "",
      "parameters": {
        "code": {
          "type": "string",
          "description": "Parameter code"
        },
        "ctx": {
          "type": "any",
          "description": "Parameter ctx"
        },
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [
        "code"
      ],
      "returns": "void"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const vm = container.feature('vm')\nconst result = vm.run('1 + 2 + 3') // 6\nconst greeting = vm.run('container.uuid') // accesses container globals"
    }
  ]
});

setBuildTimeData('features.assetLoader', {
  "id": "features.assetLoader",
  "description": "Injects scripts and stylesheets into the page at runtime. Provides helpers for loading external libraries from unpkg.com, injecting arbitrary script/link tags, and managing load state. Used by other web features (e.g. Esbuild) to pull in dependencies on demand.",
  "shortcut": "features.assetLoader",
  "className": "AssetLoader",
  "methods": {
    "removeStylesheet": {
      "description": "",
      "parameters": {
        "href": {
          "type": "string",
          "description": "Parameter href"
        }
      },
      "required": [
        "href"
      ],
      "returns": "void"
    },
    "loadScript": {
      "description": "",
      "parameters": {
        "url": {
          "type": "string",
          "description": "Parameter url"
        }
      },
      "required": [
        "url"
      ],
      "returns": "Promise<void>"
    },
    "unpkg": {
      "description": "",
      "parameters": {
        "packageName": {
          "type": "string",
          "description": "Parameter packageName"
        },
        "globalName": {
          "type": "string",
          "description": "Parameter globalName"
        }
      },
      "required": [
        "packageName",
        "globalName"
      ],
      "returns": "Promise<any>"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const loader = container.feature('assetLoader')\nawait loader.loadScript('https://unpkg.com/lodash')\nawait AssetLoader.loadStylesheet('https://unpkg.com/normalize.css')"
    }
  ]
});

setBuildTimeData('features.vault', {
  "id": "features.vault",
  "description": "AES-256-GCM encryption and decryption for the browser using the Web Crypto API. Generates or accepts a secret key and provides `encrypt()` / `decrypt()` methods that work entirely client-side. Keys are stored as base64-encoded state so they can persist across sessions when needed.",
  "shortcut": "features.vault",
  "className": "WebVault",
  "methods": {
    "secret": {
      "description": "",
      "parameters": {
        "{ refresh = false, set = true }": {
          "type": "any",
          "description": "Parameter { refresh = false, set = true }"
        }
      },
      "required": [],
      "returns": "Promise<ArrayBuffer>"
    },
    "decrypt": {
      "description": "",
      "parameters": {
        "payload": {
          "type": "string",
          "description": "Parameter payload"
        }
      },
      "required": [
        "payload"
      ],
      "returns": "void"
    },
    "encrypt": {
      "description": "",
      "parameters": {
        "payload": {
          "type": "string",
          "description": "Parameter payload"
        }
      },
      "required": [
        "payload"
      ],
      "returns": "void"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const vault = container.feature('vault')\nconst encrypted = await vault.encrypt('secret data')\nconst decrypted = await vault.decrypt(encrypted)\nconsole.log(decrypted) // 'secret data'"
    }
  ]
});

setBuildTimeData('features.network', {
  "id": "features.network",
  "description": "Tracks browser online/offline connectivity state. Listens for the browser's `online` and `offline` events and keeps the feature state in sync. Other features can observe the `offline` state value or listen for change events to react to connectivity changes.",
  "shortcut": "features.network",
  "className": "Network",
  "methods": {
    "start": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "disable": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "isOffline": {
      "description": "Whether the browser is currently offline.",
      "returns": "any"
    },
    "isOnline": {
      "description": "Whether the browser is currently online.",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const network = container.feature('network')\nconsole.log(network.state.get('offline')) // false when online\n\nnetwork.on('stateChanged', ({ offline }) => {\n console.log(offline ? 'Went offline' : 'Back online')\n})"
    }
  ]
});

setBuildTimeData('features.speech', {
  "id": "features.speech",
  "description": "Text-to-speech synthesis using the Web Speech API (SpeechSynthesis). Wraps the browser's built-in speech synthesis, providing voice selection, queue management, and state tracking. Voices are discovered on init and exposed via state for UI binding.",
  "shortcut": "features.speech",
  "className": "Speech",
  "methods": {
    "loadVoices": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "setDefaultVoice": {
      "description": "",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Parameter name"
        }
      },
      "required": [
        "name"
      ],
      "returns": "void"
    },
    "cancel": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "say": {
      "description": "",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        },
        "options": {
          "type": "{ voice?: Voice }",
          "description": "Parameter options"
        }
      },
      "required": [
        "text"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "voices": {
      "description": "Returns the array of available speech synthesis voices.",
      "returns": "any"
    },
    "defaultVoice": {
      "description": "Returns the Voice object matching the currently selected default voice name.",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const speech = container.feature('speech')\nspeech.say('Hello from the browser!')\n\n// Choose a specific voice\nconst speech = container.feature('speech', { voice: 'Google UK English Female' })\nspeech.say('Cheerio!')"
    }
  ],
  "types": {
    "Voice": {
      "description": "",
      "properties": {
        "voiceURI": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "lang": {
          "type": "string",
          "description": ""
        },
        "localService": {
          "type": "boolean",
          "description": ""
        },
        "default": {
          "type": "boolean",
          "description": ""
        }
      }
    }
  }
});

setBuildTimeData('features.helpers', {
  "id": "features.helpers",
  "description": "The Helpers feature discovers and loads project-level helpers from a JSON manifest served over HTTP. Scripts are injected via AssetLoader and self-register into the container's registries. This is the web equivalent of the node Helpers feature, which scans the filesystem. Instead of filesystem scanning, this feature fetches a manifest from a well-known URL and uses AssetLoader.loadScript() to inject each helper's script tag.",
  "shortcut": "features.helpers",
  "className": "Helpers",
  "methods": {
    "setManifestURL": {
      "description": "Set a new manifest URL. Invalidates any cached manifest.",
      "parameters": {
        "url": {
          "type": "string",
          "description": "The new URL to fetch the manifest from"
        }
      },
      "required": [
        "url"
      ],
      "returns": "void"
    },
    "discover": {
      "description": "Discover and register helpers of the given type from the manifest. Fetches the manifest, then for each entry of the requested type, loads the script via AssetLoader and checks what got newly registered.",
      "parameters": {
        "type": {
          "type": "RegistryType",
          "description": "Which type of helpers to discover ('features' or 'clients')"
        }
      },
      "required": [
        "type"
      ],
      "returns": "Promise<string[]>"
    },
    "discoverAll": {
      "description": "Discover all helper types from the manifest.",
      "parameters": {},
      "required": [],
      "returns": "Promise<Record<string, string[]>>"
    },
    "discoverFeatures": {
      "description": "Convenience method to discover only features.",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>"
    },
    "discoverClients": {
      "description": "Convenience method to discover only clients.",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>"
    },
    "lookup": {
      "description": "Look up a helper class by type and name.",
      "parameters": {
        "type": {
          "type": "RegistryType",
          "description": "The registry type"
        },
        "name": {
          "type": "string",
          "description": "The helper name within that registry"
        }
      },
      "required": [
        "type",
        "name"
      ],
      "returns": "any"
    },
    "describe": {
      "description": "Get the introspection description for a specific helper.",
      "parameters": {
        "type": {
          "type": "RegistryType",
          "description": "The registry type"
        },
        "name": {
          "type": "string",
          "description": "The helper name"
        }
      },
      "required": [
        "type",
        "name"
      ],
      "returns": "string"
    }
  },
  "getters": {
    "manifestURL": {
      "description": "The URL to fetch the helpers manifest from.",
      "returns": "string"
    },
    "available": {
      "description": "Returns a unified view of all available helpers across all registries. Each key is a registry type, each value is the list of helper names in that registry.",
      "returns": "Record<string, string[]>"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const helpers = container.feature('helpers', { enable: true })\n\n// Discover all helper types from the manifest\nawait helpers.discoverAll()\n\n// Discover a specific type\nawait helpers.discover('features')\n\n// Unified view of all available helpers\nconsole.log(helpers.available)"
    }
  ]
});

// Container introspection data
setContainerBuildTimeData('Container', {
  "className": "Container",
  "description": "The Container is the core runtime object in Luca. It is a singleton per process that acts as an event bus, state machine, and dependency injector. It holds registries of helpers (features, clients, servers, commands, endpoints) and provides factory methods to create instances from them. All helper instances share the container's context, enabling them to communicate and coordinate. The container detects its runtime environment (Node, Bun, browser, Electron) and can load platform-specific feature implementations accordingly. Use `container.feature('name')` to create feature instances, `container.use(Plugin)` to extend the container with new capabilities, and `container.on('event', handler)` to react to lifecycle events.",
  "methods": {
    "subcontainer": {
      "description": "Creates a new subcontainer instance of the same concrete Container subclass. The new instance is constructed with the same options as this container, shallow-merged with any overrides you provide. This preserves the runtime container type (e.g. NodeContainer, AGIContainer, etc.).",
      "parameters": {
        "this": {
          "type": "This",
          "description": "Parameter this"
        },
        "options": {
          "type": "ConstructorParameters<This['constructor']>[0]",
          "description": "Options to override for the new container instance"
        }
      },
      "required": [
        "this",
        "options"
      ],
      "returns": "This",
      "examples": [
        {
          "language": "ts",
          "code": "const child = container.subcontainer({ cwd: '/tmp/workspace' })\nchild.cwd // '/tmp/workspace'"
        }
      ]
    },
    "addContext": {
      "description": "Add a value to the container's shared context, which is passed to all helper instances. Accepts either a key and value, or an object of key-value pairs to merge in.",
      "parameters": {
        "keyOrContext": {
          "type": "keyof ContainerContext | Partial<ContainerContext>",
          "description": "Parameter keyOrContext"
        },
        "value": {
          "type": "ContainerContext[keyof ContainerContext]",
          "description": "The context value (omit when passing an object)"
        }
      },
      "required": [
        "keyOrContext"
      ],
      "returns": "this",
      "examples": [
        {
          "language": "ts",
          "code": "container.addContext('db', dbConnection)\ncontainer.addContext({ db: dbConnection, cache: redisClient })"
        }
      ]
    },
    "setState": {
      "description": "Sets the state of the container. Accepts a partial state object to merge, or a function that receives the current state and returns the new state.",
      "parameters": {
        "newState": {
          "type": "SetStateValue<ContainerState>",
          "description": "A partial state object to merge, or a function `(current) => newState`"
        }
      },
      "required": [
        "newState"
      ],
      "returns": "this",
      "examples": [
        {
          "language": "ts",
          "code": "container.setState({ started: true })\ncontainer.setState((prev) => ({ ...prev, started: true }))"
        }
      ]
    },
    "bus": {
      "description": "Create a new standalone event bus instance. Useful when you need a scoped event channel that is independent of the container's own event bus.",
      "parameters": {},
      "required": [],
      "returns": "Bus",
      "examples": [
        {
          "language": "ts",
          "code": "const myBus = container.bus()\nmyBus.on('data', (payload) => console.log(payload))\nmyBus.emit('data', { count: 42 })"
        }
      ]
    },
    "newState": {
      "description": "Create a new standalone observable State object. Useful when you need reactive state that is independent of the container's own state.",
      "parameters": {
        "initialState": {
          "type": "T",
          "description": "The initial state object (defaults to empty)"
        }
      },
      "required": [],
      "returns": "State<T>",
      "examples": [
        {
          "language": "ts",
          "code": "const myState = container.newState({ count: 0, loading: false })\nmyState.observe(() => console.log('Changed:', myState.current))\nmyState.set('count', 1)"
        }
      ]
    },
    "feature": {
      "description": "Creates a new instance of a feature. If you pass the same arguments, it will return the same instance as last time you created that. If you need the ability to create fresh instances, it is up to you how you define your options to support that.",
      "parameters": {
        "id": {
          "type": "T",
          "description": "The id of the feature to create."
        },
        "options": {
          "type": "FeatureInputOptions<Features>[T] | Record<string, unknown>",
          "description": "The options to pass to the feature constructor."
        }
      },
      "required": [
        "id"
      ],
      "returns": "InstanceType<Features[T]>"
    },
    "entity": {
      "description": "Creates a lightweight entity object with observable state, a typed event bus, and access to the container. Same id + options always returns the same cached base instance. An optional third argument auto-extends the entity with functions and getters. All extended methods and getters can access the entity (state, options, container, on/off/emit, etc.) via `this`.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "Stable identifier for this entity (included in cache key)"
        },
        "options": {
          "type": "TOptions",
          "description": "Arbitrary options stored on `entity.options` (included in cache key)"
        },
        "extensions": {
          "type": "Ext & ThisType<Entity<TState, TOptions, TEvents> & Ext>",
          "description": "Optional object of functions/getters to graft onto the entity"
        }
      },
      "required": [
        "id"
      ],
      "returns": "Entity<TState, TOptions, TEvents> & Ext",
      "examples": [
        {
          "language": "ts",
          "code": "// Basic entity with typed state and events\nconst counter = container.entity<{ count: number }>('counter')\ncounter.setState({ count: 0 })\ncounter.on('tick', () => counter.setState(s => ({ count: s.count + 1 })))\n\n// With options and auto-extension\nconst user = container.entity('user:42', { name: 'Alice' }, {\n greet() { return `Hello ${this.options.name}` },\n get label() { return `User: ${this.options.name}` },\n})\nuser.greet() // \"Hello Alice\""
        }
      ]
    },
    "getHelperByUUID": {
      "description": "Look up any helper instance (feature, client, server) by its UUID. Returns undefined if the UUID is unknown or the instance was never created.",
      "parameters": {
        "uuid": {
          "type": "string",
          "description": "The `instance.uuid` value assigned at construction time"
        }
      },
      "required": [
        "uuid"
      ],
      "returns": "Helper | undefined",
      "examples": [
        {
          "language": "ts",
          "code": "const assistant = container.feature('assistant')\nconst { uuid } = assistant\n// ... later ...\nconst same = container.getHelperByUUID(uuid) // === assistant"
        }
      ]
    },
    "start": {
      "description": "Start the container. Emits the 'started' event and sets `state.started` to true. Plugins and features can listen for this event to perform initialization.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>",
      "examples": [
        {
          "language": "ts",
          "code": "container.on('started', () => console.log('Ready'))\nawait container.start()"
        }
      ]
    },
    "emit": {
      "description": "Emit an event on the container's event bus.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "The event name"
        },
        "args": {
          "type": "any[]",
          "description": "Arguments to pass to listeners"
        }
      },
      "required": [
        "event",
        "args"
      ],
      "returns": "this",
      "examples": [
        {
          "language": "ts",
          "code": "container.emit('taskCompleted', { id: 'abc', result: 42 })"
        }
      ]
    },
    "on": {
      "description": "Subscribe to an event on the container's event bus.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "The event name"
        },
        "listener": {
          "type": "(...args: any[]) => void",
          "description": "The callback function"
        }
      },
      "required": [
        "event",
        "listener"
      ],
      "returns": "this",
      "examples": [
        {
          "language": "ts",
          "code": "container.on('featureEnabled', (id, feature) => {\n console.log(`Feature ${id} enabled`)\n})"
        }
      ]
    },
    "off": {
      "description": "Unsubscribe a listener from an event on the container's event bus.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "The event name"
        },
        "listener": {
          "type": "(...args: any[]) => void",
          "description": "The listener to remove"
        }
      },
      "required": [
        "event"
      ],
      "returns": "this"
    },
    "once": {
      "description": "Subscribe to an event on the container's event bus, but only fire once.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "The event name"
        },
        "listener": {
          "type": "(...args: any[]) => void",
          "description": "The callback function (invoked at most once)"
        }
      },
      "required": [
        "event",
        "listener"
      ],
      "returns": "this"
    },
    "waitFor": {
      "description": "Returns a promise that resolves the next time the given event is emitted. Useful for awaiting one-time lifecycle transitions.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "The event name to wait for"
        }
      },
      "required": [
        "event"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "await container.waitFor('started')\nconsole.log('Container is ready')"
        }
      ]
    },
    "introspect": {
      "description": "Returns a full introspection object for this container, merging build-time AST data (JSDoc descriptions, methods, getters) with runtime data (registries, factories, state, environment).",
      "parameters": {},
      "required": [],
      "returns": "ContainerIntrospection",
      "examples": [
        {
          "language": "ts",
          "code": "const info = container.introspect()\nconsole.log(info.methods)   // all public methods with descriptions\nconsole.log(info.getters)   // all getters with return types\nconsole.log(info.registries) // features, clients, servers, etc."
        }
      ]
    },
    "introspectAsText": {
      "description": "Returns a human-readable markdown representation of this container's introspection data. Useful in REPLs, AI agent contexts, or documentation generation. Pass a section name to render only that section (e.g. 'methods', 'getters', 'events', 'state').",
      "parameters": {
        "sectionOrDepth": {
          "type": "IntrospectionSection | number",
          "description": "A section name to render, or heading depth number"
        },
        "startHeadingDepth": {
          "type": "number",
          "description": "Starting markdown heading depth (default 1)"
        }
      },
      "required": [],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "console.log(container.introspectAsText())           // full description\nconsole.log(container.introspectAsText('methods'))   // just methods"
        }
      ]
    },
    "introspectAsJSON": {
      "description": "Returns JSON introspection data.",
      "parameters": {},
      "required": [],
      "returns": "ContainerIntrospection"
    },
    "introspectAsType": {
      "description": "Returns the container's introspection data formatted as a TypeScript interface declaration. Includes the container's own methods, getters, factories, and registered helper types.",
      "parameters": {},
      "required": [],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "console.log(container.introspectAsType())\n// interface NodeContainer {\n//   feature<T>(id: string, options?: object): T;\n//   readonly uuid: string;\n//   ...\n// }"
        }
      ]
    },
    "sleep": {
      "description": "Sleep for the specified number of milliseconds. Useful for scripting and sequencing.",
      "parameters": {
        "ms": {
          "type": "number",
          "description": "Parameter ms"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "use": {
      "description": "Apply a plugin or enable a feature by string name. Plugins are classes with a static `attach(container)` method that extend the container with new registries, factories, or capabilities.",
      "parameters": {
        "plugin": {
          "type": "Extension<T>",
          "description": "A feature name string, or a class/object with a static attach method"
        },
        "options": {
          "type": "any",
          "description": "Options to pass to the plugin's attach method"
        }
      },
      "required": [
        "plugin"
      ],
      "returns": "this & T",
      "examples": [
        {
          "language": "ts",
          "code": "// Enable a feature by name\ncontainer.use('contentDb')\n\n// Attach a plugin class (e.g. Client, Server, or custom)\ncontainer.use(Client)    // registers the clients registry + client() factory\ncontainer.use(Server)    // registers the servers registry + server() factory"
        }
      ]
    }
  },
  "getters": {
    "state": {
      "description": "The observable state object for this container instance.",
      "returns": "State<ContainerState>"
    },
    "enabledFeatureIds": {
      "description": "Returns the list of shortcut IDs for all currently enabled features.",
      "returns": "string[]"
    },
    "enabledFeatures": {
      "description": "Returns a map of enabled feature shortcut IDs to their instances.",
      "returns": "Partial<AvailableInstanceTypes<Features>>"
    },
    "utils": {
      "description": "Common utilities available on every container. Provides UUID generation, object hashing, string case conversion, and lodash helpers — no imports needed. - `utils.uuid()` — generate a v4 UUID - `utils.hashObject(obj)` — deterministic hash of any object - `utils.stringUtils` — `{ kebabCase, camelCase, upperFirst, lowerFirst, pluralize, singularize }` - `utils.lodash` — `{ uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit }`",
      "returns": "ContainerUtils",
      "examples": [
        {
          "language": "ts",
          "code": "const id = container.utils.uuid()\nconst hash = container.utils.hashObject({ foo: 'bar' })\nconst name = container.utils.stringUtils.camelCase('my-feature')\nconst unique = container.utils.lodash.uniq([1, 2, 2, 3])"
        }
      ]
    },
    "context": {
      "description": "The Container's context is an object that contains the enabled features, the container itself, and any additional context that has been added to the container. All helper instances that are created by the container will have access to the shared context.",
      "returns": "ContainerContext<Features> & Partial<AvailableInstanceTypes<AvailableFeatures>>"
    },
    "currentState": {
      "description": "The current state of the container. This is a snapshot of the container's state at the time this method is called.",
      "returns": "ContainerState"
    },
    "features": {
      "description": "The features registry. Use it to check what features are available, look up feature classes, or check if a feature is registered.",
      "returns": "FeaturesRegistry",
      "examples": [
        {
          "language": "ts",
          "code": "container.features.available   // ['fs', 'git', 'grep', ...]\ncontainer.features.has('fs')   // true\ncontainer.features.lookup('fs') // FS class"
        }
      ]
    },
    "isBrowser": {
      "description": "Returns true if the container is running in a browser.",
      "returns": "boolean"
    },
    "isBun": {
      "description": "Returns true if the container is running in Bun.",
      "returns": "boolean"
    },
    "isNode": {
      "description": "Returns true if the container is running in Node.",
      "returns": "boolean"
    },
    "isElectron": {
      "description": "Returns true if the container is running in Electron.",
      "returns": "boolean"
    },
    "isDevelopment": {
      "description": "Returns true if the container is running in development mode.",
      "returns": "boolean"
    },
    "isProduction": {
      "description": "Returns true if the container is running in production mode.",
      "returns": "boolean"
    },
    "isCI": {
      "description": "Returns true if the container is running in a CI environment.",
      "returns": "boolean"
    },
    "registryNames": {
      "description": "Returns the names of all attached registries (e.g. [\"features\", \"clients\", \"servers\"]).",
      "returns": "string[]"
    },
    "factoryNames": {
      "description": "Returns the names of all available factory methods (e.g. [\"feature\", \"client\", \"server\"]).",
      "returns": "string[]"
    }
  },
  "events": {
    "started": {
      "name": "started",
      "description": "Event emitted by Container",
      "arguments": {}
    }
  }
});

setContainerBuildTimeData('WebContainer', {
  "className": "WebContainer",
  "description": "Browser-specific container that extends the base Container with web client support and browser-specific features like speech, voice recognition, and asset loading.",
  "methods": {},
  "getters": {
    "Client": {
      "description": "Returns the base Client class for creating custom clients.",
      "returns": "any"
    },
    "SocketClient": {
      "description": "Returns the SocketClient class for WebSocket connections.",
      "returns": "any"
    },
    "RestClient": {
      "description": "Returns the RestClient class for HTTP REST API connections.",
      "returns": "any"
    }
  },
  "events": {}
});
export const introspectionData = [
  {
    "id": "features.containerLink",
    "description": "ContainerLink (Web-side) — WebSocket client that connects to a node host. Connects to a ContainerLink host over WebSocket. The host can evaluate code in this container, and the web side can emit structured events to the host. The web side can NEVER eval code in the host — trust is strictly one-way.",
    "shortcut": "features.containerLink",
    "className": "ContainerLink",
    "methods": {
      "connect": {
        "description": "Connect to the host WebSocket server and perform registration.",
        "parameters": {
          "hostUrl": {
            "type": "string",
            "description": "Override the configured host URL"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "disconnect": {
        "description": "Disconnect from the host.",
        "parameters": {
          "reason": {
            "type": "string",
            "description": "Optional reason string"
          }
        },
        "required": [],
        "returns": "void"
      },
      "emitToHost": {
        "description": "Send a structured event to the host container.",
        "parameters": {
          "eventName": {
            "type": "string",
            "description": "Name of the event"
          },
          "data": {
            "type": "any",
            "description": "Optional event data"
          }
        },
        "required": [
          "eventName"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "isConnected": {
        "description": "Whether currently connected to the host.",
        "returns": "boolean"
      },
      "token": {
        "description": "The auth token received from the host.",
        "returns": "string | undefined"
      },
      "hostId": {
        "description": "The host container's UUID.",
        "returns": "string | undefined"
      }
    },
    "events": {
      "connected": {
        "name": "connected",
        "description": "Event emitted by ContainerLink",
        "arguments": {}
      },
      "disconnected": {
        "name": "disconnected",
        "description": "Event emitted by ContainerLink",
        "arguments": {}
      },
      "evalRequest": {
        "name": "evalRequest",
        "description": "Event emitted by ContainerLink",
        "arguments": {}
      },
      "reconnecting": {
        "name": "reconnecting",
        "description": "Event emitted by ContainerLink",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const link = container.feature('containerLink', {\n enable: true,\n hostUrl: 'ws://localhost:8089',\n})\nawait link.connect()\n\n// Send events to the host\nlink.emitToHost('click', { x: 100, y: 200 })\n\n// Listen for eval requests before they execute\nlink.on('evalRequest', (code, requestId) => {\n console.log('Host is evaluating:', code)\n})"
      }
    ]
  },
  {
    "id": "features.esbuild",
    "description": "Browser-side TypeScript/ESM compilation feature using esbuild-wasm. Loads esbuild's WebAssembly build via the AssetLoader, then provides `compile()` and `transform()` methods that work entirely in the browser. Useful for live playgrounds, in-browser REPLs, and client-side bundling.",
    "shortcut": "features.esbuild",
    "className": "Esbuild",
    "methods": {
      "compile": {
        "description": "",
        "parameters": {
          "code": {
            "type": "string",
            "description": "Parameter code"
          },
          "options": {
            "type": "esbuild.TransformOptions",
            "description": "Parameter options"
          }
        },
        "required": [
          "code"
        ],
        "returns": "void"
      },
      "clearCache": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "start": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "assetLoader": {
        "description": "Returns the assetLoader feature for loading external libraries from unpkg.",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const esbuild = container.feature('esbuild')\nawait esbuild.start()\nconst result = await esbuild.compile('const x: number = 1')\nconsole.log(result.code)"
      }
    ]
  },
  {
    "id": "features.voice",
    "description": "Speech-to-text recognition using the Web Speech API (SpeechRecognition). Wraps the browser's built-in speech recognition, supporting continuous listening, interim results, and language selection. Recognized text is accumulated in state and emitted as events for real-time transcription UIs.",
    "shortcut": "features.voice",
    "className": "VoiceRecognition",
    "methods": {
      "whenFinished": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "start": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "stop": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "abort": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "clearTranscript": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "listening": {
        "description": "Whether the speech recognizer is currently listening for audio input.",
        "returns": "any"
      },
      "transcript": {
        "description": "Returns the accumulated final transcript text from recognition results.",
        "returns": "any"
      }
    },
    "events": {
      "start": {
        "name": "start",
        "description": "Event emitted by VoiceRecognition",
        "arguments": {}
      },
      "stop": {
        "name": "stop",
        "description": "Event emitted by VoiceRecognition",
        "arguments": {}
      },
      "abort": {
        "name": "abort",
        "description": "Event emitted by VoiceRecognition",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const voice = container.feature('voice', { continuous: true, autoListen: true })\n\nvoice.on('transcript', ({ text }) => {\n console.log('Heard:', text)\n})\n\n// Or start manually\nvoice.start()"
      }
    ]
  },
  {
    "id": "features.vm",
    "description": "Sandboxed JavaScript execution environment for the browser. Automatically injects the container's context object into the global scope, so evaluated code can use anything provided by the container. Useful for live code playgrounds, plugin systems, and dynamic script evaluation.",
    "shortcut": "features.vm",
    "className": "VM",
    "methods": {
      "createScript": {
        "description": "",
        "parameters": {
          "code": {
            "type": "string",
            "description": "Parameter code"
          }
        },
        "required": [
          "code"
        ],
        "returns": "void"
      },
      "createContext": {
        "description": "",
        "parameters": {
          "ctx": {
            "type": "any",
            "description": "Parameter ctx"
          }
        },
        "required": [],
        "returns": "void"
      },
      "run": {
        "description": "",
        "parameters": {
          "code": {
            "type": "string",
            "description": "Parameter code"
          },
          "ctx": {
            "type": "any",
            "description": "Parameter ctx"
          },
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [
          "code"
        ],
        "returns": "void"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const vm = container.feature('vm')\nconst result = vm.run('1 + 2 + 3') // 6\nconst greeting = vm.run('container.uuid') // accesses container globals"
      }
    ]
  },
  {
    "id": "features.assetLoader",
    "description": "Injects scripts and stylesheets into the page at runtime. Provides helpers for loading external libraries from unpkg.com, injecting arbitrary script/link tags, and managing load state. Used by other web features (e.g. Esbuild) to pull in dependencies on demand.",
    "shortcut": "features.assetLoader",
    "className": "AssetLoader",
    "methods": {
      "removeStylesheet": {
        "description": "",
        "parameters": {
          "href": {
            "type": "string",
            "description": "Parameter href"
          }
        },
        "required": [
          "href"
        ],
        "returns": "void"
      },
      "loadScript": {
        "description": "",
        "parameters": {
          "url": {
            "type": "string",
            "description": "Parameter url"
          }
        },
        "required": [
          "url"
        ],
        "returns": "Promise<void>"
      },
      "unpkg": {
        "description": "",
        "parameters": {
          "packageName": {
            "type": "string",
            "description": "Parameter packageName"
          },
          "globalName": {
            "type": "string",
            "description": "Parameter globalName"
          }
        },
        "required": [
          "packageName",
          "globalName"
        ],
        "returns": "Promise<any>"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const loader = container.feature('assetLoader')\nawait loader.loadScript('https://unpkg.com/lodash')\nawait AssetLoader.loadStylesheet('https://unpkg.com/normalize.css')"
      }
    ]
  },
  {
    "id": "features.vault",
    "description": "AES-256-GCM encryption and decryption for the browser using the Web Crypto API. Generates or accepts a secret key and provides `encrypt()` / `decrypt()` methods that work entirely client-side. Keys are stored as base64-encoded state so they can persist across sessions when needed.",
    "shortcut": "features.vault",
    "className": "WebVault",
    "methods": {
      "secret": {
        "description": "",
        "parameters": {
          "{ refresh = false, set = true }": {
            "type": "any",
            "description": "Parameter { refresh = false, set = true }"
          }
        },
        "required": [],
        "returns": "Promise<ArrayBuffer>"
      },
      "decrypt": {
        "description": "",
        "parameters": {
          "payload": {
            "type": "string",
            "description": "Parameter payload"
          }
        },
        "required": [
          "payload"
        ],
        "returns": "void"
      },
      "encrypt": {
        "description": "",
        "parameters": {
          "payload": {
            "type": "string",
            "description": "Parameter payload"
          }
        },
        "required": [
          "payload"
        ],
        "returns": "void"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const vault = container.feature('vault')\nconst encrypted = await vault.encrypt('secret data')\nconst decrypted = await vault.decrypt(encrypted)\nconsole.log(decrypted) // 'secret data'"
      }
    ]
  },
  {
    "id": "features.network",
    "description": "Tracks browser online/offline connectivity state. Listens for the browser's `online` and `offline` events and keeps the feature state in sync. Other features can observe the `offline` state value or listen for change events to react to connectivity changes.",
    "shortcut": "features.network",
    "className": "Network",
    "methods": {
      "start": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "disable": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "isOffline": {
        "description": "Whether the browser is currently offline.",
        "returns": "any"
      },
      "isOnline": {
        "description": "Whether the browser is currently online.",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const network = container.feature('network')\nconsole.log(network.state.get('offline')) // false when online\n\nnetwork.on('stateChanged', ({ offline }) => {\n console.log(offline ? 'Went offline' : 'Back online')\n})"
      }
    ]
  },
  {
    "id": "features.speech",
    "description": "Text-to-speech synthesis using the Web Speech API (SpeechSynthesis). Wraps the browser's built-in speech synthesis, providing voice selection, queue management, and state tracking. Voices are discovered on init and exposed via state for UI binding.",
    "shortcut": "features.speech",
    "className": "Speech",
    "methods": {
      "loadVoices": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "setDefaultVoice": {
        "description": "",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Parameter name"
          }
        },
        "required": [
          "name"
        ],
        "returns": "void"
      },
      "cancel": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "say": {
        "description": "",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          },
          "options": {
            "type": "{ voice?: Voice }",
            "description": "Parameter options"
          }
        },
        "required": [
          "text"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "voices": {
        "description": "Returns the array of available speech synthesis voices.",
        "returns": "any"
      },
      "defaultVoice": {
        "description": "Returns the Voice object matching the currently selected default voice name.",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const speech = container.feature('speech')\nspeech.say('Hello from the browser!')\n\n// Choose a specific voice\nconst speech = container.feature('speech', { voice: 'Google UK English Female' })\nspeech.say('Cheerio!')"
      }
    ],
    "types": {
      "Voice": {
        "description": "",
        "properties": {
          "voiceURI": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "lang": {
            "type": "string",
            "description": ""
          },
          "localService": {
            "type": "boolean",
            "description": ""
          },
          "default": {
            "type": "boolean",
            "description": ""
          }
        }
      }
    }
  },
  {
    "id": "features.helpers",
    "description": "The Helpers feature discovers and loads project-level helpers from a JSON manifest served over HTTP. Scripts are injected via AssetLoader and self-register into the container's registries. This is the web equivalent of the node Helpers feature, which scans the filesystem. Instead of filesystem scanning, this feature fetches a manifest from a well-known URL and uses AssetLoader.loadScript() to inject each helper's script tag.",
    "shortcut": "features.helpers",
    "className": "Helpers",
    "methods": {
      "setManifestURL": {
        "description": "Set a new manifest URL. Invalidates any cached manifest.",
        "parameters": {
          "url": {
            "type": "string",
            "description": "The new URL to fetch the manifest from"
          }
        },
        "required": [
          "url"
        ],
        "returns": "void"
      },
      "discover": {
        "description": "Discover and register helpers of the given type from the manifest. Fetches the manifest, then for each entry of the requested type, loads the script via AssetLoader and checks what got newly registered.",
        "parameters": {
          "type": {
            "type": "RegistryType",
            "description": "Which type of helpers to discover ('features' or 'clients')"
          }
        },
        "required": [
          "type"
        ],
        "returns": "Promise<string[]>"
      },
      "discoverAll": {
        "description": "Discover all helper types from the manifest.",
        "parameters": {},
        "required": [],
        "returns": "Promise<Record<string, string[]>>"
      },
      "discoverFeatures": {
        "description": "Convenience method to discover only features.",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>"
      },
      "discoverClients": {
        "description": "Convenience method to discover only clients.",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>"
      },
      "lookup": {
        "description": "Look up a helper class by type and name.",
        "parameters": {
          "type": {
            "type": "RegistryType",
            "description": "The registry type"
          },
          "name": {
            "type": "string",
            "description": "The helper name within that registry"
          }
        },
        "required": [
          "type",
          "name"
        ],
        "returns": "any"
      },
      "describe": {
        "description": "Get the introspection description for a specific helper.",
        "parameters": {
          "type": {
            "type": "RegistryType",
            "description": "The registry type"
          },
          "name": {
            "type": "string",
            "description": "The helper name"
          }
        },
        "required": [
          "type",
          "name"
        ],
        "returns": "string"
      }
    },
    "getters": {
      "manifestURL": {
        "description": "The URL to fetch the helpers manifest from.",
        "returns": "string"
      },
      "available": {
        "description": "Returns a unified view of all available helpers across all registries. Each key is a registry type, each value is the list of helper names in that registry.",
        "returns": "Record<string, string[]>"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const helpers = container.feature('helpers', { enable: true })\n\n// Discover all helper types from the manifest\nawait helpers.discoverAll()\n\n// Discover a specific type\nawait helpers.discover('features')\n\n// Unified view of all available helpers\nconsole.log(helpers.available)"
      }
    ]
  }
];

export const containerIntrospectionData = [
  {
    "className": "Container",
    "description": "The Container is the core runtime object in Luca. It is a singleton per process that acts as an event bus, state machine, and dependency injector. It holds registries of helpers (features, clients, servers, commands, endpoints) and provides factory methods to create instances from them. All helper instances share the container's context, enabling them to communicate and coordinate. The container detects its runtime environment (Node, Bun, browser, Electron) and can load platform-specific feature implementations accordingly. Use `container.feature('name')` to create feature instances, `container.use(Plugin)` to extend the container with new capabilities, and `container.on('event', handler)` to react to lifecycle events.",
    "methods": {
      "subcontainer": {
        "description": "Creates a new subcontainer instance of the same concrete Container subclass. The new instance is constructed with the same options as this container, shallow-merged with any overrides you provide. This preserves the runtime container type (e.g. NodeContainer, AGIContainer, etc.).",
        "parameters": {
          "this": {
            "type": "This",
            "description": "Parameter this"
          },
          "options": {
            "type": "ConstructorParameters<This['constructor']>[0]",
            "description": "Options to override for the new container instance"
          }
        },
        "required": [
          "this",
          "options"
        ],
        "returns": "This",
        "examples": [
          {
            "language": "ts",
            "code": "const child = container.subcontainer({ cwd: '/tmp/workspace' })\nchild.cwd // '/tmp/workspace'"
          }
        ]
      },
      "addContext": {
        "description": "Add a value to the container's shared context, which is passed to all helper instances. Accepts either a key and value, or an object of key-value pairs to merge in.",
        "parameters": {
          "keyOrContext": {
            "type": "keyof ContainerContext | Partial<ContainerContext>",
            "description": "Parameter keyOrContext"
          },
          "value": {
            "type": "ContainerContext[keyof ContainerContext]",
            "description": "The context value (omit when passing an object)"
          }
        },
        "required": [
          "keyOrContext"
        ],
        "returns": "this",
        "examples": [
          {
            "language": "ts",
            "code": "container.addContext('db', dbConnection)\ncontainer.addContext({ db: dbConnection, cache: redisClient })"
          }
        ]
      },
      "setState": {
        "description": "Sets the state of the container. Accepts a partial state object to merge, or a function that receives the current state and returns the new state.",
        "parameters": {
          "newState": {
            "type": "SetStateValue<ContainerState>",
            "description": "A partial state object to merge, or a function `(current) => newState`"
          }
        },
        "required": [
          "newState"
        ],
        "returns": "this",
        "examples": [
          {
            "language": "ts",
            "code": "container.setState({ started: true })\ncontainer.setState((prev) => ({ ...prev, started: true }))"
          }
        ]
      },
      "bus": {
        "description": "Create a new standalone event bus instance. Useful when you need a scoped event channel that is independent of the container's own event bus.",
        "parameters": {},
        "required": [],
        "returns": "Bus",
        "examples": [
          {
            "language": "ts",
            "code": "const myBus = container.bus()\nmyBus.on('data', (payload) => console.log(payload))\nmyBus.emit('data', { count: 42 })"
          }
        ]
      },
      "newState": {
        "description": "Create a new standalone observable State object. Useful when you need reactive state that is independent of the container's own state.",
        "parameters": {
          "initialState": {
            "type": "T",
            "description": "The initial state object (defaults to empty)"
          }
        },
        "required": [],
        "returns": "State<T>",
        "examples": [
          {
            "language": "ts",
            "code": "const myState = container.newState({ count: 0, loading: false })\nmyState.observe(() => console.log('Changed:', myState.current))\nmyState.set('count', 1)"
          }
        ]
      },
      "feature": {
        "description": "Creates a new instance of a feature. If you pass the same arguments, it will return the same instance as last time you created that. If you need the ability to create fresh instances, it is up to you how you define your options to support that.",
        "parameters": {
          "id": {
            "type": "T",
            "description": "The id of the feature to create."
          },
          "options": {
            "type": "FeatureInputOptions<Features>[T] | Record<string, unknown>",
            "description": "The options to pass to the feature constructor."
          }
        },
        "required": [
          "id"
        ],
        "returns": "InstanceType<Features[T]>"
      },
      "entity": {
        "description": "Creates a lightweight entity object with observable state, a typed event bus, and access to the container. Same id + options always returns the same cached base instance. An optional third argument auto-extends the entity with functions and getters. All extended methods and getters can access the entity (state, options, container, on/off/emit, etc.) via `this`.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "Stable identifier for this entity (included in cache key)"
          },
          "options": {
            "type": "TOptions",
            "description": "Arbitrary options stored on `entity.options` (included in cache key)"
          },
          "extensions": {
            "type": "Ext & ThisType<Entity<TState, TOptions, TEvents> & Ext>",
            "description": "Optional object of functions/getters to graft onto the entity"
          }
        },
        "required": [
          "id"
        ],
        "returns": "Entity<TState, TOptions, TEvents> & Ext",
        "examples": [
          {
            "language": "ts",
            "code": "// Basic entity with typed state and events\nconst counter = container.entity<{ count: number }>('counter')\ncounter.setState({ count: 0 })\ncounter.on('tick', () => counter.setState(s => ({ count: s.count + 1 })))\n\n// With options and auto-extension\nconst user = container.entity('user:42', { name: 'Alice' }, {\n greet() { return `Hello ${this.options.name}` },\n get label() { return `User: ${this.options.name}` },\n})\nuser.greet() // \"Hello Alice\""
          }
        ]
      },
      "getHelperByUUID": {
        "description": "Look up any helper instance (feature, client, server) by its UUID. Returns undefined if the UUID is unknown or the instance was never created.",
        "parameters": {
          "uuid": {
            "type": "string",
            "description": "The `instance.uuid` value assigned at construction time"
          }
        },
        "required": [
          "uuid"
        ],
        "returns": "Helper | undefined",
        "examples": [
          {
            "language": "ts",
            "code": "const assistant = container.feature('assistant')\nconst { uuid } = assistant\n// ... later ...\nconst same = container.getHelperByUUID(uuid) // === assistant"
          }
        ]
      },
      "start": {
        "description": "Start the container. Emits the 'started' event and sets `state.started` to true. Plugins and features can listen for this event to perform initialization.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>",
        "examples": [
          {
            "language": "ts",
            "code": "container.on('started', () => console.log('Ready'))\nawait container.start()"
          }
        ]
      },
      "emit": {
        "description": "Emit an event on the container's event bus.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "The event name"
          },
          "args": {
            "type": "any[]",
            "description": "Arguments to pass to listeners"
          }
        },
        "required": [
          "event",
          "args"
        ],
        "returns": "this",
        "examples": [
          {
            "language": "ts",
            "code": "container.emit('taskCompleted', { id: 'abc', result: 42 })"
          }
        ]
      },
      "on": {
        "description": "Subscribe to an event on the container's event bus.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "The event name"
          },
          "listener": {
            "type": "(...args: any[]) => void",
            "description": "The callback function"
          }
        },
        "required": [
          "event",
          "listener"
        ],
        "returns": "this",
        "examples": [
          {
            "language": "ts",
            "code": "container.on('featureEnabled', (id, feature) => {\n console.log(`Feature ${id} enabled`)\n})"
          }
        ]
      },
      "off": {
        "description": "Unsubscribe a listener from an event on the container's event bus.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "The event name"
          },
          "listener": {
            "type": "(...args: any[]) => void",
            "description": "The listener to remove"
          }
        },
        "required": [
          "event"
        ],
        "returns": "this"
      },
      "once": {
        "description": "Subscribe to an event on the container's event bus, but only fire once.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "The event name"
          },
          "listener": {
            "type": "(...args: any[]) => void",
            "description": "The callback function (invoked at most once)"
          }
        },
        "required": [
          "event",
          "listener"
        ],
        "returns": "this"
      },
      "waitFor": {
        "description": "Returns a promise that resolves the next time the given event is emitted. Useful for awaiting one-time lifecycle transitions.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "The event name to wait for"
          }
        },
        "required": [
          "event"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "await container.waitFor('started')\nconsole.log('Container is ready')"
          }
        ]
      },
      "introspect": {
        "description": "Returns a full introspection object for this container, merging build-time AST data (JSDoc descriptions, methods, getters) with runtime data (registries, factories, state, environment).",
        "parameters": {},
        "required": [],
        "returns": "ContainerIntrospection",
        "examples": [
          {
            "language": "ts",
            "code": "const info = container.introspect()\nconsole.log(info.methods)   // all public methods with descriptions\nconsole.log(info.getters)   // all getters with return types\nconsole.log(info.registries) // features, clients, servers, etc."
          }
        ]
      },
      "introspectAsText": {
        "description": "Returns a human-readable markdown representation of this container's introspection data. Useful in REPLs, AI agent contexts, or documentation generation. Pass a section name to render only that section (e.g. 'methods', 'getters', 'events', 'state').",
        "parameters": {
          "sectionOrDepth": {
            "type": "IntrospectionSection | number",
            "description": "A section name to render, or heading depth number"
          },
          "startHeadingDepth": {
            "type": "number",
            "description": "Starting markdown heading depth (default 1)"
          }
        },
        "required": [],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "console.log(container.introspectAsText())           // full description\nconsole.log(container.introspectAsText('methods'))   // just methods"
          }
        ]
      },
      "introspectAsJSON": {
        "description": "Returns JSON introspection data.",
        "parameters": {},
        "required": [],
        "returns": "ContainerIntrospection"
      },
      "introspectAsType": {
        "description": "Returns the container's introspection data formatted as a TypeScript interface declaration. Includes the container's own methods, getters, factories, and registered helper types.",
        "parameters": {},
        "required": [],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "console.log(container.introspectAsType())\n// interface NodeContainer {\n//   feature<T>(id: string, options?: object): T;\n//   readonly uuid: string;\n//   ...\n// }"
          }
        ]
      },
      "sleep": {
        "description": "Sleep for the specified number of milliseconds. Useful for scripting and sequencing.",
        "parameters": {
          "ms": {
            "type": "number",
            "description": "Parameter ms"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "use": {
        "description": "Apply a plugin or enable a feature by string name. Plugins are classes with a static `attach(container)` method that extend the container with new registries, factories, or capabilities.",
        "parameters": {
          "plugin": {
            "type": "Extension<T>",
            "description": "A feature name string, or a class/object with a static attach method"
          },
          "options": {
            "type": "any",
            "description": "Options to pass to the plugin's attach method"
          }
        },
        "required": [
          "plugin"
        ],
        "returns": "this & T",
        "examples": [
          {
            "language": "ts",
            "code": "// Enable a feature by name\ncontainer.use('contentDb')\n\n// Attach a plugin class (e.g. Client, Server, or custom)\ncontainer.use(Client)    // registers the clients registry + client() factory\ncontainer.use(Server)    // registers the servers registry + server() factory"
          }
        ]
      }
    },
    "getters": {
      "state": {
        "description": "The observable state object for this container instance.",
        "returns": "State<ContainerState>"
      },
      "enabledFeatureIds": {
        "description": "Returns the list of shortcut IDs for all currently enabled features.",
        "returns": "string[]"
      },
      "enabledFeatures": {
        "description": "Returns a map of enabled feature shortcut IDs to their instances.",
        "returns": "Partial<AvailableInstanceTypes<Features>>"
      },
      "utils": {
        "description": "Common utilities available on every container. Provides UUID generation, object hashing, string case conversion, and lodash helpers — no imports needed. - `utils.uuid()` — generate a v4 UUID - `utils.hashObject(obj)` — deterministic hash of any object - `utils.stringUtils` — `{ kebabCase, camelCase, upperFirst, lowerFirst, pluralize, singularize }` - `utils.lodash` — `{ uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit }`",
        "returns": "ContainerUtils",
        "examples": [
          {
            "language": "ts",
            "code": "const id = container.utils.uuid()\nconst hash = container.utils.hashObject({ foo: 'bar' })\nconst name = container.utils.stringUtils.camelCase('my-feature')\nconst unique = container.utils.lodash.uniq([1, 2, 2, 3])"
          }
        ]
      },
      "context": {
        "description": "The Container's context is an object that contains the enabled features, the container itself, and any additional context that has been added to the container. All helper instances that are created by the container will have access to the shared context.",
        "returns": "ContainerContext<Features> & Partial<AvailableInstanceTypes<AvailableFeatures>>"
      },
      "currentState": {
        "description": "The current state of the container. This is a snapshot of the container's state at the time this method is called.",
        "returns": "ContainerState"
      },
      "features": {
        "description": "The features registry. Use it to check what features are available, look up feature classes, or check if a feature is registered.",
        "returns": "FeaturesRegistry",
        "examples": [
          {
            "language": "ts",
            "code": "container.features.available   // ['fs', 'git', 'grep', ...]\ncontainer.features.has('fs')   // true\ncontainer.features.lookup('fs') // FS class"
          }
        ]
      },
      "isBrowser": {
        "description": "Returns true if the container is running in a browser.",
        "returns": "boolean"
      },
      "isBun": {
        "description": "Returns true if the container is running in Bun.",
        "returns": "boolean"
      },
      "isNode": {
        "description": "Returns true if the container is running in Node.",
        "returns": "boolean"
      },
      "isElectron": {
        "description": "Returns true if the container is running in Electron.",
        "returns": "boolean"
      },
      "isDevelopment": {
        "description": "Returns true if the container is running in development mode.",
        "returns": "boolean"
      },
      "isProduction": {
        "description": "Returns true if the container is running in production mode.",
        "returns": "boolean"
      },
      "isCI": {
        "description": "Returns true if the container is running in a CI environment.",
        "returns": "boolean"
      },
      "registryNames": {
        "description": "Returns the names of all attached registries (e.g. [\"features\", \"clients\", \"servers\"]).",
        "returns": "string[]"
      },
      "factoryNames": {
        "description": "Returns the names of all available factory methods (e.g. [\"feature\", \"client\", \"server\"]).",
        "returns": "string[]"
      }
    },
    "events": {
      "started": {
        "name": "started",
        "description": "Event emitted by Container",
        "arguments": {}
      }
    }
  },
  {
    "className": "WebContainer",
    "description": "Browser-specific container that extends the base Container with web client support and browser-specific features like speech, voice recognition, and asset loading.",
    "methods": {},
    "getters": {
      "Client": {
        "description": "Returns the base Client class for creating custom clients.",
        "returns": "any"
      },
      "SocketClient": {
        "description": "Returns the SocketClient class for WebSocket connections.",
        "returns": "any"
      },
      "RestClient": {
        "description": "Returns the RestClient class for HTTP REST API connections.",
        "returns": "any"
      }
    },
    "events": {}
  }
];
