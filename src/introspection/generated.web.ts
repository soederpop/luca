import { __INTROSPECTION__ } from './index.js';

// Auto-generated introspection registry data
// Generated at: 2026-02-09T00:11:33.741Z

__INTROSPECTION__.set('features.esbuild', {
  "id": "features.esbuild",
  "description": "Esbuild helper",
  "shortcut": "features.esbuild",
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
  "events": {},
  "state": {}
});

__INTROSPECTION__.set('features.voice', {
  "id": "features.voice",
  "description": "VoiceRecognition helper",
  "shortcut": "features.voice",
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
  "state": {}
});

__INTROSPECTION__.set('features.vm', {
  "id": "features.vm",
  "description": "VM helper",
  "shortcut": "features.vm",
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
  "events": {},
  "state": {}
});

__INTROSPECTION__.set('features.assetLoader', {
  "id": "features.assetLoader",
  "description": "AssetLoader helper",
  "shortcut": "features.assetLoader",
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
  "events": {},
  "state": {}
});

__INTROSPECTION__.set('features.vault', {
  "id": "features.vault",
  "description": "WebVault helper",
  "shortcut": "features.vault",
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
  "events": {},
  "state": {}
});

__INTROSPECTION__.set('features.network', {
  "id": "features.network",
  "description": "Network helper",
  "shortcut": "features.network",
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
  "events": {},
  "state": {}
});

__INTROSPECTION__.set('features.speech', {
  "id": "features.speech",
  "description": "Speech helper",
  "shortcut": "features.speech",
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
  "events": {},
  "state": {}
});

__INTROSPECTION__.set('features.mdxLoader', {
  "id": "features.mdxLoader",
  "description": "MdxLoader helper",
  "shortcut": "features.mdxLoader",
  "methods": {
    "load": {
      "description": "",
      "parameters": {
        "source": {
          "type": "string",
          "description": "Parameter source"
        }
      },
      "required": [
        "source"
      ],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});
export const introspectionData = [
  {
    "id": "features.esbuild",
    "description": "Esbuild helper",
    "shortcut": "features.esbuild",
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
    "events": {},
    "state": {}
  },
  {
    "id": "features.voice",
    "description": "VoiceRecognition helper",
    "shortcut": "features.voice",
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
    "state": {}
  },
  {
    "id": "features.vm",
    "description": "VM helper",
    "shortcut": "features.vm",
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
    "events": {},
    "state": {}
  },
  {
    "id": "features.assetLoader",
    "description": "AssetLoader helper",
    "shortcut": "features.assetLoader",
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
    "events": {},
    "state": {}
  },
  {
    "id": "features.vault",
    "description": "WebVault helper",
    "shortcut": "features.vault",
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
    "events": {},
    "state": {}
  },
  {
    "id": "features.network",
    "description": "Network helper",
    "shortcut": "features.network",
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
    "events": {},
    "state": {}
  },
  {
    "id": "features.speech",
    "description": "Speech helper",
    "shortcut": "features.speech",
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
    "events": {},
    "state": {}
  },
  {
    "id": "features.mdxLoader",
    "description": "MdxLoader helper",
    "shortcut": "features.mdxLoader",
    "methods": {
      "load": {
        "description": "",
        "parameters": {
          "source": {
            "type": "string",
            "description": "Parameter source"
          }
        },
        "required": [
          "source"
        ],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
  }
];
