import { setBuildTimeData, setContainerBuildTimeData } from './index.js';

// Auto-generated introspection registry data
// Generated at: 2026-03-01T05:24:22.459Z

setBuildTimeData('features.esbuild', {
  "id": "features.esbuild",
  "description": "Esbuild helper",
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
  "envVars": []
});

setBuildTimeData('features.voice', {
  "id": "features.voice",
  "description": "VoiceRecognition helper",
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
  "envVars": []
});

setBuildTimeData('features.vm', {
  "id": "features.vm",
  "description": "The VM features providers a virtual machine for executing JavaScript code in a sandboxed environment. The Vm feature automatically injects the container.context object into the global scope, so these things can be referenced in the code and the code can use anything provided by the container.",
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
  "envVars": []
});

setBuildTimeData('features.assetLoader', {
  "id": "features.assetLoader",
  "description": "The AssetLoader provides an API for injecting scripts and stylesheets into the page. It also provides a convenient way of loading any library from unpkg.com",
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
  "envVars": []
});

setBuildTimeData('features.vault', {
  "id": "features.vault",
  "description": "WebVault helper",
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
  "envVars": []
});

setBuildTimeData('features.network', {
  "id": "features.network",
  "description": "Network helper",
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
  "envVars": []
});

setBuildTimeData('features.speech', {
  "id": "features.speech",
  "description": "Speech helper",
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
  "envVars": []
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
  "description": "Containers are single objects that contain state, an event bus, and registries of helpers such as: - features - clients - servers A Helper represents a category of components in your program which have a common interface, e.g. all servers can be started / stopped, all features can be enabled, if supported, all clients can connect to something. A Helper can be introspected at runtime to learn about the interface of the helper. A helper has state, and emits events. You can design your own containers and load them up with the helpers you want for that environment.",
  "methods": {
    "subcontainer": {
      "description": "Creates a new subcontainer instance of the same concrete Container subclass. The new instance is constructed with the same options as this container, shallow-merged with any overrides you provide. This preserves the runtime container type (e.g. NodeContainer, BrowserContainer, etc.).",
      "parameters": {
        "this": {
          "type": "This",
          "description": "Parameter this"
        },
        "options": {
          "type": "ConstructorParameters<This['constructor']>[0]",
          "description": "Options to override for the new container instance."
        }
      },
      "required": [
        "this",
        "options"
      ],
      "returns": "This"
    },
    "addContext": {
      "description": "",
      "parameters": {
        "keyOrContext": {
          "type": "keyof ContainerContext | Partial<ContainerContext>",
          "description": "Parameter keyOrContext"
        },
        "value": {
          "type": "ContainerContext[keyof ContainerContext]",
          "description": "Parameter value"
        }
      },
      "required": [
        "keyOrContext"
      ],
      "returns": "this"
    },
    "setState": {
      "description": "Sets the state of the container.",
      "parameters": {
        "newState": {
          "type": "SetStateValue<ContainerState>",
          "description": "The new state of the container."
        }
      },
      "required": [
        "newState"
      ],
      "returns": "void"
    },
    "bus": {
      "description": "Convenience method for creating a new event bus instance.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "newState": {
      "description": "Convenience method for creating a new observable State object.",
      "parameters": {
        "initialState": {
          "type": "T",
          "description": "Parameter initialState"
        }
      },
      "required": [],
      "returns": "void"
    },
    "normalizeHelperOptions": {
      "description": "Parse helper options through the helper's static options schema so defaults are materialized.",
      "parameters": {
        "BaseClass": {
          "type": "any",
          "description": "Parameter BaseClass"
        },
        "options": {
          "type": "any",
          "description": "Parameter options"
        },
        "fallbackName": {
          "type": "string",
          "description": "Parameter fallbackName"
        }
      },
      "required": [
        "BaseClass",
        "options"
      ],
      "returns": "void"
    },
    "buildHelperCacheKey": {
      "description": "",
      "parameters": {
        "type": {
          "type": "string",
          "description": "Parameter type"
        },
        "id": {
          "type": "string",
          "description": "Parameter id"
        },
        "options": {
          "type": "any",
          "description": "Parameter options"
        },
        "omitOptionKeys": {
          "type": "string[]",
          "description": "Parameter omitOptionKeys"
        }
      },
      "required": [
        "type",
        "id",
        "options"
      ],
      "returns": "void"
    },
    "createHelperInstance": {
      "description": "",
      "parameters": {
        "{\n    cache,\n    type,\n    id,\n    BaseClass,\n    options,\n    fallbackName,\n    omitOptionKeys = [],\n    context,\n  }": {
          "type": "{\n    cache: Map<string, any>\n    type: string\n    id: string\n    BaseClass: any\n    options?: any\n    fallbackName?: string\n    omitOptionKeys?: string[]\n    context?: any\n  }",
          "description": "Parameter {\n    cache,\n    type,\n    id,\n    BaseClass,\n    options,\n    fallbackName,\n    omitOptionKeys = [],\n    context,\n  }"
        }
      },
      "required": [
        "{\n    cache,\n    type,\n    id,\n    BaseClass,\n    options,\n    fallbackName,\n    omitOptionKeys = [],\n    context,\n  }"
      ],
      "returns": "void"
    },
    "feature": {
      "description": "Creates a new instance of a feature. If you pass the same arguments, it will return the same instance as last time you created that. If you need the ability to create fresh instances, it is up to you how you define your options to support that.",
      "parameters": {
        "id": {
          "type": "T",
          "description": "The id of the feature to create."
        },
        "options": {
          "type": "ConstructorParameters<Features[T]>[0]",
          "description": "The options to pass to the feature constructor."
        }
      },
      "required": [
        "id"
      ],
      "returns": "InstanceType<Features[T]>"
    },
    "start": {
      "description": "TODO: A container should be able to container.use(plugin) and that plugin should be able to define an asynchronous method that will be run when the container is started.  Right now there's nothing to do with starting / stopping a container but that might be neat.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "emit": {
      "description": "Emit an event on the container's event bus.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "Parameter event"
        },
        "args": {
          "type": "any[]",
          "description": "Parameter args"
        }
      },
      "required": [
        "event",
        "args"
      ],
      "returns": "void"
    },
    "on": {
      "description": "Subscribe to an event on the container's event bus.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "Parameter event"
        },
        "listener": {
          "type": "(...args: any[]) => void",
          "description": "Parameter listener"
        }
      },
      "required": [
        "event",
        "listener"
      ],
      "returns": "void"
    },
    "off": {
      "description": "Unsubscribe a listener from an event on the container's event bus.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "Parameter event"
        },
        "listener": {
          "type": "(...args: any[]) => void",
          "description": "Parameter listener"
        }
      },
      "required": [
        "event"
      ],
      "returns": "void"
    },
    "once": {
      "description": "Subscribe to an event on the container's event bus, but only fire once.",
      "parameters": {
        "event": {
          "type": "string",
          "description": "Parameter event"
        },
        "listener": {
          "type": "(...args: any[]) => void",
          "description": "Parameter listener"
        }
      },
      "required": [
        "event",
        "listener"
      ],
      "returns": "void"
    },
    "waitFor": {
      "description": "Returns a promise that will resolve when the event is emitted",
      "parameters": {
        "event": {
          "type": "string",
          "description": "Parameter event"
        }
      },
      "required": [
        "event"
      ],
      "returns": "void"
    },
    "registerHelperType": {
      "description": "Register a helper type (registry + factory pair) on this container. Called automatically by Helper.attach() methods (e.g. Client.attach, Server.attach).",
      "parameters": {
        "registryName": {
          "type": "string",
          "description": "The plural name of the registry, e.g. \"clients\", \"servers\""
        },
        "factoryName": {
          "type": "string",
          "description": "The singular factory method name, e.g. \"client\", \"server\""
        }
      },
      "required": [
        "registryName",
        "factoryName"
      ],
      "returns": "void"
    },
    "inspect": {
      "description": "Returns a full introspection object for this container, merging build-time AST data (JSDoc descriptions, methods, getters) with runtime data (registries, factories, state, environment).",
      "parameters": {},
      "required": [],
      "returns": "ContainerIntrospection"
    },
    "inspectAsText": {
      "description": "Returns a human-readable markdown representation of this container's introspection data. Useful in REPLs, AI agent contexts, or documentation generation. The first argument can be a section name (`'methods'`, `'getters'`, etc.) to render only that section, or a number for the starting heading depth (backward compatible).",
      "parameters": {
        "sectionOrDepth": {
          "type": "IntrospectionSection | number",
          "description": "Parameter sectionOrDepth"
        },
        "startHeadingDepth": {
          "type": "number",
          "description": "Parameter startHeadingDepth"
        }
      },
      "required": [],
      "returns": "string"
    },
    "introspectAsText": {
      "description": "Alias for inspectAsText",
      "parameters": {
        "sectionOrDepth": {
          "type": "IntrospectionSection | number",
          "description": "Parameter sectionOrDepth"
        },
        "startHeadingDepth": {
          "type": "number",
          "description": "Parameter startHeadingDepth"
        }
      },
      "required": [],
      "returns": "string"
    },
    "introspectAsJSON": {
      "description": "Alias for inspectAsJSON",
      "parameters": {
        "sectionOrDepth": {
          "type": "IntrospectionSection | number",
          "description": "Parameter sectionOrDepth"
        },
        "startHeadingDepth": {
          "type": "number",
          "description": "Parameter startHeadingDepth"
        }
      },
      "required": [],
      "returns": "any"
    },
    "sleep": {
      "description": "Sleep for the specified number of milliseconds. Useful for scripting and sequencing.",
      "parameters": {
        "ms": {
          "type": "any",
          "description": "Parameter ms"
        }
      },
      "required": [],
      "returns": "void"
    },
    "use": {
      "description": "Apply a plugin or enable a feature by string name. Plugins must have a static attach(container) method.",
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
      "returns": "this & T"
    }
  },
  "getters": {
    "state": {
      "description": "The observable state object for this container instance.",
      "returns": "any"
    },
    "enabledFeatureIds": {
      "description": "Returns the list of shortcut IDs for all currently enabled features.",
      "returns": "any"
    },
    "enabledFeatures": {
      "description": "Returns a map of enabled feature shortcut IDs to their instances.",
      "returns": "Partial<AvailableInstanceTypes<Features>>"
    },
    "context": {
      "description": "The Container's context is an object that contains the enabled features, the container itself, and any additional context that has been added to the container. All helper instances that are created by the container will have access to the shared context.",
      "returns": "ContainerContext<Features> & Partial<AvailableInstanceTypes<AvailableFeatures>>"
    },
    "currentState": {
      "description": "The current state of the container. This is a snapshot of the container's state at the time this method is called.",
      "returns": "any"
    },
    "isBrowser": {
      "description": "Returns true if the container is running in a browser.",
      "returns": "any"
    },
    "isBun": {
      "description": "Returns true if the container is running in Bun.",
      "returns": "any"
    },
    "isNode": {
      "description": "Returns true if the container is running in Node.",
      "returns": "any"
    },
    "isElectron": {
      "description": "Returns true if the container is running in Electron.",
      "returns": "any"
    },
    "isDevelopment": {
      "description": "Returns true if the container is running in development mode.",
      "returns": "any"
    },
    "isProduction": {
      "description": "Returns true if the container is running in production mode.",
      "returns": "any"
    },
    "isCI": {
      "description": "Returns true if the container is running in a CI environment.",
      "returns": "any"
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
    "id": "features.esbuild",
    "description": "Esbuild helper",
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
    "envVars": []
  },
  {
    "id": "features.voice",
    "description": "VoiceRecognition helper",
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
    "envVars": []
  },
  {
    "id": "features.vm",
    "description": "The VM features providers a virtual machine for executing JavaScript code in a sandboxed environment. The Vm feature automatically injects the container.context object into the global scope, so these things can be referenced in the code and the code can use anything provided by the container.",
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
    "envVars": []
  },
  {
    "id": "features.assetLoader",
    "description": "The AssetLoader provides an API for injecting scripts and stylesheets into the page. It also provides a convenient way of loading any library from unpkg.com",
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
    "envVars": []
  },
  {
    "id": "features.vault",
    "description": "WebVault helper",
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
    "envVars": []
  },
  {
    "id": "features.network",
    "description": "Network helper",
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
    "envVars": []
  },
  {
    "id": "features.speech",
    "description": "Speech helper",
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
    "envVars": []
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
    "description": "Containers are single objects that contain state, an event bus, and registries of helpers such as: - features - clients - servers A Helper represents a category of components in your program which have a common interface, e.g. all servers can be started / stopped, all features can be enabled, if supported, all clients can connect to something. A Helper can be introspected at runtime to learn about the interface of the helper. A helper has state, and emits events. You can design your own containers and load them up with the helpers you want for that environment.",
    "methods": {
      "subcontainer": {
        "description": "Creates a new subcontainer instance of the same concrete Container subclass. The new instance is constructed with the same options as this container, shallow-merged with any overrides you provide. This preserves the runtime container type (e.g. NodeContainer, BrowserContainer, etc.).",
        "parameters": {
          "this": {
            "type": "This",
            "description": "Parameter this"
          },
          "options": {
            "type": "ConstructorParameters<This['constructor']>[0]",
            "description": "Options to override for the new container instance."
          }
        },
        "required": [
          "this",
          "options"
        ],
        "returns": "This"
      },
      "addContext": {
        "description": "",
        "parameters": {
          "keyOrContext": {
            "type": "keyof ContainerContext | Partial<ContainerContext>",
            "description": "Parameter keyOrContext"
          },
          "value": {
            "type": "ContainerContext[keyof ContainerContext]",
            "description": "Parameter value"
          }
        },
        "required": [
          "keyOrContext"
        ],
        "returns": "this"
      },
      "setState": {
        "description": "Sets the state of the container.",
        "parameters": {
          "newState": {
            "type": "SetStateValue<ContainerState>",
            "description": "The new state of the container."
          }
        },
        "required": [
          "newState"
        ],
        "returns": "void"
      },
      "bus": {
        "description": "Convenience method for creating a new event bus instance.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "newState": {
        "description": "Convenience method for creating a new observable State object.",
        "parameters": {
          "initialState": {
            "type": "T",
            "description": "Parameter initialState"
          }
        },
        "required": [],
        "returns": "void"
      },
      "normalizeHelperOptions": {
        "description": "Parse helper options through the helper's static options schema so defaults are materialized.",
        "parameters": {
          "BaseClass": {
            "type": "any",
            "description": "Parameter BaseClass"
          },
          "options": {
            "type": "any",
            "description": "Parameter options"
          },
          "fallbackName": {
            "type": "string",
            "description": "Parameter fallbackName"
          }
        },
        "required": [
          "BaseClass",
          "options"
        ],
        "returns": "void"
      },
      "buildHelperCacheKey": {
        "description": "",
        "parameters": {
          "type": {
            "type": "string",
            "description": "Parameter type"
          },
          "id": {
            "type": "string",
            "description": "Parameter id"
          },
          "options": {
            "type": "any",
            "description": "Parameter options"
          },
          "omitOptionKeys": {
            "type": "string[]",
            "description": "Parameter omitOptionKeys"
          }
        },
        "required": [
          "type",
          "id",
          "options"
        ],
        "returns": "void"
      },
      "createHelperInstance": {
        "description": "",
        "parameters": {
          "{\n    cache,\n    type,\n    id,\n    BaseClass,\n    options,\n    fallbackName,\n    omitOptionKeys = [],\n    context,\n  }": {
            "type": "{\n    cache: Map<string, any>\n    type: string\n    id: string\n    BaseClass: any\n    options?: any\n    fallbackName?: string\n    omitOptionKeys?: string[]\n    context?: any\n  }",
            "description": "Parameter {\n    cache,\n    type,\n    id,\n    BaseClass,\n    options,\n    fallbackName,\n    omitOptionKeys = [],\n    context,\n  }"
          }
        },
        "required": [
          "{\n    cache,\n    type,\n    id,\n    BaseClass,\n    options,\n    fallbackName,\n    omitOptionKeys = [],\n    context,\n  }"
        ],
        "returns": "void"
      },
      "feature": {
        "description": "Creates a new instance of a feature. If you pass the same arguments, it will return the same instance as last time you created that. If you need the ability to create fresh instances, it is up to you how you define your options to support that.",
        "parameters": {
          "id": {
            "type": "T",
            "description": "The id of the feature to create."
          },
          "options": {
            "type": "ConstructorParameters<Features[T]>[0]",
            "description": "The options to pass to the feature constructor."
          }
        },
        "required": [
          "id"
        ],
        "returns": "InstanceType<Features[T]>"
      },
      "start": {
        "description": "TODO: A container should be able to container.use(plugin) and that plugin should be able to define an asynchronous method that will be run when the container is started.  Right now there's nothing to do with starting / stopping a container but that might be neat.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "emit": {
        "description": "Emit an event on the container's event bus.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "Parameter event"
          },
          "args": {
            "type": "any[]",
            "description": "Parameter args"
          }
        },
        "required": [
          "event",
          "args"
        ],
        "returns": "void"
      },
      "on": {
        "description": "Subscribe to an event on the container's event bus.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "Parameter event"
          },
          "listener": {
            "type": "(...args: any[]) => void",
            "description": "Parameter listener"
          }
        },
        "required": [
          "event",
          "listener"
        ],
        "returns": "void"
      },
      "off": {
        "description": "Unsubscribe a listener from an event on the container's event bus.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "Parameter event"
          },
          "listener": {
            "type": "(...args: any[]) => void",
            "description": "Parameter listener"
          }
        },
        "required": [
          "event"
        ],
        "returns": "void"
      },
      "once": {
        "description": "Subscribe to an event on the container's event bus, but only fire once.",
        "parameters": {
          "event": {
            "type": "string",
            "description": "Parameter event"
          },
          "listener": {
            "type": "(...args: any[]) => void",
            "description": "Parameter listener"
          }
        },
        "required": [
          "event",
          "listener"
        ],
        "returns": "void"
      },
      "waitFor": {
        "description": "Returns a promise that will resolve when the event is emitted",
        "parameters": {
          "event": {
            "type": "string",
            "description": "Parameter event"
          }
        },
        "required": [
          "event"
        ],
        "returns": "void"
      },
      "registerHelperType": {
        "description": "Register a helper type (registry + factory pair) on this container. Called automatically by Helper.attach() methods (e.g. Client.attach, Server.attach).",
        "parameters": {
          "registryName": {
            "type": "string",
            "description": "The plural name of the registry, e.g. \"clients\", \"servers\""
          },
          "factoryName": {
            "type": "string",
            "description": "The singular factory method name, e.g. \"client\", \"server\""
          }
        },
        "required": [
          "registryName",
          "factoryName"
        ],
        "returns": "void"
      },
      "inspect": {
        "description": "Returns a full introspection object for this container, merging build-time AST data (JSDoc descriptions, methods, getters) with runtime data (registries, factories, state, environment).",
        "parameters": {},
        "required": [],
        "returns": "ContainerIntrospection"
      },
      "inspectAsText": {
        "description": "Returns a human-readable markdown representation of this container's introspection data. Useful in REPLs, AI agent contexts, or documentation generation. The first argument can be a section name (`'methods'`, `'getters'`, etc.) to render only that section, or a number for the starting heading depth (backward compatible).",
        "parameters": {
          "sectionOrDepth": {
            "type": "IntrospectionSection | number",
            "description": "Parameter sectionOrDepth"
          },
          "startHeadingDepth": {
            "type": "number",
            "description": "Parameter startHeadingDepth"
          }
        },
        "required": [],
        "returns": "string"
      },
      "introspectAsText": {
        "description": "Alias for inspectAsText",
        "parameters": {
          "sectionOrDepth": {
            "type": "IntrospectionSection | number",
            "description": "Parameter sectionOrDepth"
          },
          "startHeadingDepth": {
            "type": "number",
            "description": "Parameter startHeadingDepth"
          }
        },
        "required": [],
        "returns": "string"
      },
      "introspectAsJSON": {
        "description": "Alias for inspectAsJSON",
        "parameters": {
          "sectionOrDepth": {
            "type": "IntrospectionSection | number",
            "description": "Parameter sectionOrDepth"
          },
          "startHeadingDepth": {
            "type": "number",
            "description": "Parameter startHeadingDepth"
          }
        },
        "required": [],
        "returns": "any"
      },
      "sleep": {
        "description": "Sleep for the specified number of milliseconds. Useful for scripting and sequencing.",
        "parameters": {
          "ms": {
            "type": "any",
            "description": "Parameter ms"
          }
        },
        "required": [],
        "returns": "void"
      },
      "use": {
        "description": "Apply a plugin or enable a feature by string name. Plugins must have a static attach(container) method.",
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
        "returns": "this & T"
      }
    },
    "getters": {
      "state": {
        "description": "The observable state object for this container instance.",
        "returns": "any"
      },
      "enabledFeatureIds": {
        "description": "Returns the list of shortcut IDs for all currently enabled features.",
        "returns": "any"
      },
      "enabledFeatures": {
        "description": "Returns a map of enabled feature shortcut IDs to their instances.",
        "returns": "Partial<AvailableInstanceTypes<Features>>"
      },
      "context": {
        "description": "The Container's context is an object that contains the enabled features, the container itself, and any additional context that has been added to the container. All helper instances that are created by the container will have access to the shared context.",
        "returns": "ContainerContext<Features> & Partial<AvailableInstanceTypes<AvailableFeatures>>"
      },
      "currentState": {
        "description": "The current state of the container. This is a snapshot of the container's state at the time this method is called.",
        "returns": "any"
      },
      "isBrowser": {
        "description": "Returns true if the container is running in a browser.",
        "returns": "any"
      },
      "isBun": {
        "description": "Returns true if the container is running in Bun.",
        "returns": "any"
      },
      "isNode": {
        "description": "Returns true if the container is running in Node.",
        "returns": "any"
      },
      "isElectron": {
        "description": "Returns true if the container is running in Electron.",
        "returns": "any"
      },
      "isDevelopment": {
        "description": "Returns true if the container is running in development mode.",
        "returns": "any"
      },
      "isProduction": {
        "description": "Returns true if the container is running in production mode.",
        "returns": "any"
      },
      "isCI": {
        "description": "Returns true if the container is running in a CI environment.",
        "returns": "any"
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
