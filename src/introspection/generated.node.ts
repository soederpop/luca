import { setBuildTimeData, setContainerBuildTimeData } from './index.js';

// Auto-generated introspection registry data

setBuildTimeData('features.googleDocs', {
  "id": "features.googleDocs",
  "description": "Google Docs feature for reading documents and converting them to Markdown. Depends on googleAuth for authentication and optionally googleDrive for listing docs. The markdown converter handles headings, text formatting, links, lists, tables, and images.",
  "shortcut": "features.googleDocs",
  "className": "GoogleDocs",
  "methods": {
    "getDocument": {
      "description": "Get the raw document structure from the Docs API.",
      "parameters": {
        "documentId": {
          "type": "string",
          "description": "The Google Docs document ID"
        }
      },
      "required": [
        "documentId"
      ],
      "returns": "Promise<docs_v1.Schema$Document>"
    },
    "getAsMarkdown": {
      "description": "Read a Google Doc and convert it to Markdown. Handles headings, bold/italic/strikethrough, links, code fonts, ordered/unordered lists with nesting, tables, images, and section breaks.",
      "parameters": {
        "documentId": {
          "type": "string",
          "description": "The Google Docs document ID"
        }
      },
      "required": [
        "documentId"
      ],
      "returns": "Promise<string>"
    },
    "getAsText": {
      "description": "Read a Google Doc as plain text (strips all formatting).",
      "parameters": {
        "documentId": {
          "type": "string",
          "description": "The Google Docs document ID"
        }
      },
      "required": [
        "documentId"
      ],
      "returns": "Promise<string>"
    },
    "saveAsMarkdown": {
      "description": "Download a Google Doc as Markdown and save to a local file.",
      "parameters": {
        "documentId": {
          "type": "string",
          "description": "The Google Docs document ID"
        },
        "localPath": {
          "type": "string",
          "description": "Local file path (resolved relative to container cwd)"
        }
      },
      "required": [
        "documentId",
        "localPath"
      ],
      "returns": "Promise<string>"
    },
    "listDocs": {
      "description": "List Google Docs in Drive (filters by Docs MIME type).",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Optional additional Drive search query"
        },
        "options": {
          "type": "{ pageSize?: number; pageToken?: string }",
          "description": "Pagination options"
        }
      },
      "required": [],
      "returns": "Promise<DriveFile[]>"
    },
    "searchDocs": {
      "description": "Search for Google Docs by name or content.",
      "parameters": {
        "term": {
          "type": "string",
          "description": "Search term"
        }
      },
      "required": [
        "term"
      ],
      "returns": "Promise<DriveFile[]>"
    }
  },
  "getters": {
    "auth": {
      "description": "Access the google-auth feature lazily.",
      "returns": "GoogleAuth"
    },
    "drive": {
      "description": "Access the google-drive feature lazily.",
      "returns": "GoogleDrive"
    }
  },
  "events": {
    "documentFetched": {
      "name": "documentFetched",
      "description": "Event emitted by GoogleDocs",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by GoogleDocs",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const docs = container.feature('googleDocs')\n\n// Get a doc as markdown\nconst markdown = await docs.getAsMarkdown('1abc_document_id')\n\n// Save to file\nawait docs.saveAsMarkdown('1abc_document_id', './output/doc.md')\n\n// List all Google Docs in Drive\nconst allDocs = await docs.listDocs()\n\n// Get raw document structure\nconst rawDoc = await docs.getDocument('1abc_document_id')\n\n// Plain text extraction\nconst text = await docs.getAsText('1abc_document_id')"
    }
  ]
});

setBuildTimeData('features.yamlTree', {
  "id": "features.yamlTree",
  "description": "YamlTree Feature - A powerful YAML file tree loader and processor This feature provides functionality to recursively load YAML files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive YAML file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Support for both .yml and .yaml file extensions",
  "shortcut": "features.yamlTree",
  "className": "YamlTree",
  "methods": {
    "loadTree": {
      "description": "Loads a tree of YAML files from the specified base path and stores them in state. This method recursively scans the provided directory for YAML files (.yml and .yaml), processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Path Processing:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes file extensions (.yml/.yaml) **Example:** ``` config/ database/ production.yml  -> tree.config.database.production staging.yml     -> tree.config.database.staging api/ endpoints.yaml  -> tree.config.api.endpoints ```",
      "parameters": {
        "basePath": {
          "type": "string",
          "description": "The root directory path to scan for YAML files"
        },
        "key": {
          "type": "string",
          "description": "The key to store the tree under in state (defaults to first segment of basePath)"
        }
      },
      "required": [
        "basePath"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "// Load all YAML files from 'config' directory into state.config\nawait yamlTree.loadTree('config');\n\n// Load with custom key\nawait yamlTree.loadTree('app/settings', 'appSettings');\n\n// Access the loaded data\nconst dbConfig = yamlTree.tree.config.database.production;"
        }
      ]
    }
  },
  "getters": {
    "tree": {
      "description": "Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the YAML tree data that has been loaded.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "await yamlTree.loadTree('config');\nconst allTrees = yamlTree.tree;\n// Returns: { config: { database: { ... }, api: { ... } } }"
        }
      ]
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const yamlTree = container.feature('yamlTree', { enable: true });\nawait yamlTree.loadTree('config', 'appConfig');\nconst configData = yamlTree.tree.appConfig;"
    }
  ]
});

setBuildTimeData('features.ink', {
  "id": "features.ink",
  "description": "Ink Feature — React-powered Terminal UI via Ink Exposes the Ink library (React for CLIs) through the container so any feature, script, or application can build rich terminal user interfaces using React components rendered directly in the terminal. This feature is intentionally a thin pass-through. It re-exports all of Ink's components, hooks, and the render function, plus a few convenience methods for mounting / unmounting apps. The actual UI composition is left entirely to the consumer — the feature just makes Ink available. **What you get:** - `ink.render(element)` — mount a React element to the terminal - `ink.components` — { Box, Text, Static, Transform, Newline, Spacer } - `ink.hooks` — { useInput, useApp, useStdin, useStdout, useStderr, useFocus, useFocusManager } - `ink.React` — the React module itself (createElement, useState, etc.) - `ink.unmount()` — tear down the currently mounted app - `ink.waitUntilExit()` — await the mounted app's exit **Quick start:** ```tsx const ink = container.feature('ink', { enable: true }) const { Box, Text } = ink.components const { React } = ink ink.render( React.createElement(Box, { flexDirection: 'column' }, React.createElement(Text, { color: 'green' }, 'hello from ink'), React.createElement(Text, { dimColor: true }, 'powered by luca'), ) ) await ink.waitUntilExit() ``` Or if you're in a .tsx file: ```tsx import React from 'react' const ink = container.feature('ink', { enable: true }) const { Box, Text } = ink.components ink.render( <Box flexDirection=\"column\"> <Text color=\"green\">hello from ink</Text> <Text dimColor>powered by luca</Text> </Box> ) ```",
  "shortcut": "features.ink",
  "className": "Ink",
  "methods": {
    "loadModules": {
      "description": "Pre-load ink + react modules so the sync getters work. Called automatically by render(), but you can call it early.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>",
      "examples": [
        {
          "language": "ts",
          "code": "const ink = container.feature('ink', { enable: true })\nawait ink.loadModules()\n// Now sync getters like ink.React, ink.components, ink.hooks work\nconst { Box, Text } = ink.components"
        }
      ]
    },
    "render": {
      "description": "Mount a React element to the terminal. Wraps `ink.render()` — automatically loads modules if needed, tracks the instance for unmount / waitUntilExit, and updates state.",
      "parameters": {
        "node": {
          "type": "any",
          "description": "A React element (JSX or React.createElement)"
        },
        "options": {
          "type": "Record<string, any>",
          "description": "Ink render options (stdout, stdin, debug, etc.)"
        }
      },
      "required": [
        "node"
      ],
      "returns": "Promise<any>"
    },
    "rerender": {
      "description": "Re-render the currently mounted app with a new root element.",
      "parameters": {
        "node": {
          "type": "any",
          "description": "Parameter node"
        }
      },
      "required": [
        "node"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const ink = container.feature('ink', { enable: true })\nconst { React } = await ink.loadModules()\nconst { Text } = ink.components\n\nawait ink.render(React.createElement(Text, null, 'Hello'))\nink.rerender(React.createElement(Text, null, 'Updated!'))"
        }
      ]
    },
    "unmount": {
      "description": "Unmount the currently mounted Ink app. Tears down the React tree rendered in the terminal and resets state. Safe to call when no app is mounted (no-op).",
      "parameters": {},
      "required": [],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const ink = container.feature('ink', { enable: true })\nawait ink.render(myElement)\n// ... later\nink.unmount()\nconsole.log(ink.isMounted) // false"
        }
      ]
    },
    "waitUntilExit": {
      "description": "Returns a promise that resolves when the mounted app exits. Useful for keeping a script alive while the terminal UI is active.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "const ink = container.feature('ink', { enable: true })\nawait ink.render(myElement)\nawait ink.waitUntilExit()\nconsole.log('App exited')"
        }
      ]
    },
    "clear": {
      "description": "Clear the terminal output of the mounted app. Erases all Ink-rendered content from the terminal. Safe to call when no app is mounted (no-op).",
      "parameters": {},
      "required": [],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const ink = container.feature('ink', { enable: true })\nawait ink.render(myElement)\n// ... later, wipe the screen\nink.clear()"
        }
      ]
    },
    "registerBlock": {
      "description": "Register a named React function component as a renderable block.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Unique block name"
        },
        "component": {
          "type": "Function",
          "description": "A React function component"
        }
      },
      "required": [
        "name",
        "component"
      ],
      "returns": "this",
      "examples": [
        {
          "language": "ts",
          "code": "ink.registerBlock('Greeting', ({ name }) =>\n React.createElement(Text, { color: 'green' }, `Hello ${name}!`)\n)"
        }
      ]
    },
    "renderBlock": {
      "description": "Render a registered block by name with optional props. Looks up the component, creates a React element, renders it via ink, then immediately unmounts so the static output stays on screen while freeing the React tree.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The registered block name"
        },
        "data": {
          "type": "Record<string, any>",
          "description": "Props to pass to the component"
        }
      },
      "required": [
        "name"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await ink.renderBlock('Greeting', { name: 'Jon' })"
        }
      ]
    },
    "renderBlockAsync": {
      "description": "Render a registered block that needs to stay mounted for async work. The component receives a `done` prop — a callback it must invoke when it has finished rendering its final output. The React tree stays alive until `done()` is called or the timeout expires.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The registered block name"
        },
        "data": {
          "type": "Record<string, any>",
          "description": "Props to pass to the component (a `done` prop is added automatically)"
        },
        "options": {
          "type": "{ timeout?: number }",
          "description": "`timeout` in ms before force-unmounting (default 30 000)"
        }
      },
      "required": [
        "name"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "tsx",
          "code": "// In a ## Blocks section:\nfunction AsyncChart({ url, done }) {\n const [rows, setRows] = React.useState(null)\n React.useEffect(() => {\n   fetch(url).then(r => r.json()).then(data => {\n     setRows(data)\n     done()\n   })\n }, [])\n if (!rows) return <Text dimColor>Loading...</Text>\n return <Box><Text>{JSON.stringify(rows)}</Text></Box>\n}\n\n// In a code block:\nawait renderAsync('AsyncChart', { url: 'https://api.example.com/data' })"
        }
      ]
    }
  },
  "getters": {
    "React": {
      "description": "The React module (createElement, useState, useEffect, etc.) Exposed so consumers don't need a separate react import. Lazy-loaded — first access triggers the import.",
      "returns": "typeof import('react')"
    },
    "components": {
      "description": "All Ink components as a single object for destructuring. ```ts const { Box, Text, Static, Spacer } = ink.components ```",
      "returns": "{ Box: typeof import('ink').Box; Text: typeof import('ink').Text; Static: typeof import('ink').Static; Transform: typeof import('ink').Transform; Newline: typeof import('ink').Newline; Spacer: typeof import('ink').Spacer }"
    },
    "hooks": {
      "description": "All Ink hooks as a single object for destructuring. ```ts const { useInput, useApp, useFocus } = ink.hooks ```",
      "returns": "{ useInput: typeof import('ink').useInput; useApp: typeof import('ink').useApp; useStdin: typeof import('ink').useStdin; useStdout: typeof import('ink').useStdout; useStderr: typeof import('ink').useStderr; useFocus: typeof import('ink').useFocus; useFocusManager: typeof import('ink').useFocusManager; useCursor: typeof import('ink').useCursor }"
    },
    "measureElement": {
      "description": "The Ink measureElement utility.",
      "returns": "typeof import('ink').measureElement"
    },
    "isMounted": {
      "description": "Whether an ink app is currently mounted.",
      "returns": "boolean"
    },
    "instance": {
      "description": "The raw ink render instance if you need low-level access.",
      "returns": "any | null"
    },
    "blocks": {
      "description": "List all registered block names.",
      "returns": "string[]"
    }
  },
  "events": {
    "mounted": {
      "name": "mounted",
      "description": "Event emitted by Ink",
      "arguments": {}
    },
    "unmounted": {
      "name": "unmounted",
      "description": "Event emitted by Ink",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.containerLink', {
  "id": "features.containerLink",
  "description": "ContainerLink (Node-side) — WebSocket host for remote web containers. Creates a WebSocket server that web containers connect to. The host can evaluate code in connected web containers and receive structured events back. Trust is strictly one-way: the node side can eval in web containers, but web containers can NEVER eval in the node container.",
  "shortcut": "features.containerLink",
  "className": "ContainerLink",
  "methods": {
    "start": {
      "description": "Start the WebSocket server and begin accepting connections.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "stop": {
      "description": "Stop the WebSocket server and disconnect all clients.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "eval": {
      "description": "Evaluate code in a specific connected web container.",
      "parameters": {
        "containerId": {
          "type": "string",
          "description": "UUID of the target web container"
        },
        "code": {
          "type": "string",
          "description": "JavaScript code to evaluate"
        },
        "context": {
          "type": "Record<string, any>",
          "description": "Optional context variables to inject"
        },
        "timeout": {
          "type": "any",
          "description": "Timeout in ms (default 10000)"
        }
      },
      "required": [
        "containerId",
        "code"
      ],
      "returns": "Promise<T>"
    },
    "broadcast": {
      "description": "Evaluate code in all connected web containers.",
      "parameters": {
        "code": {
          "type": "string",
          "description": "JavaScript code to evaluate"
        },
        "context": {
          "type": "Record<string, any>",
          "description": "Optional context variables to inject"
        },
        "timeout": {
          "type": "any",
          "description": "Timeout in ms (default 10000)"
        }
      },
      "required": [
        "code"
      ],
      "returns": "Promise<Map<string, T | Error>>"
    },
    "getConnections": {
      "description": "Get metadata of all connected containers.",
      "parameters": {},
      "required": [],
      "returns": "Array<Omit<ConnectedContainer, 'ws' | 'token'>>"
    },
    "disconnect": {
      "description": "Disconnect a specific web container.",
      "parameters": {
        "containerId": {
          "type": "string",
          "description": "UUID of the container to disconnect"
        },
        "reason": {
          "type": "string",
          "description": "Optional reason string"
        }
      },
      "required": [
        "containerId"
      ],
      "returns": "void"
    },
    "generateToken": {
      "description": "Generate a cryptographically random token for connection auth.",
      "parameters": {},
      "required": [],
      "returns": "string"
    },
    "sendTo": {
      "description": "Send a message to a specific connected container by UUID.",
      "parameters": {
        "containerId": {
          "type": "string",
          "description": "UUID of the target container"
        },
        "msg": {
          "type": "LinkMessage",
          "description": "The message to send",
          "properties": {
            "type": {
              "type": "MessageType",
              "description": ""
            },
            "id": {
              "type": "string",
              "description": ""
            },
            "timestamp": {
              "type": "number",
              "description": ""
            },
            "token": {
              "type": "string",
              "description": ""
            },
            "data": {
              "type": "T",
              "description": ""
            }
          }
        }
      },
      "required": [
        "containerId",
        "msg"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "isListening": {
      "description": "Whether the WebSocket server is currently listening.",
      "returns": "boolean"
    },
    "connectionCount": {
      "description": "Number of currently connected web containers.",
      "returns": "number"
    }
  },
  "events": {
    "disconnection": {
      "name": "disconnection",
      "description": "Event emitted by ContainerLink",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by ContainerLink",
      "arguments": {}
    },
    "connection": {
      "name": "connection",
      "description": "Event emitted by ContainerLink",
      "arguments": {}
    },
    "evalResult": {
      "name": "evalResult",
      "description": "Event emitted by ContainerLink",
      "arguments": {}
    },
    "event": {
      "name": "event",
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
      "code": "const link = container.feature('containerLink', { enable: true, port: 8089 })\nawait link.start()\n\n// When a web container connects:\nlink.on('connection', (uuid, meta) => {\n console.log('Connected:', uuid)\n})\n\n// Eval code in a specific web container\nconst result = await link.eval(uuid, 'document.title')\n\n// Broadcast eval to all connected containers\nconst results = await link.broadcast('navigator.userAgent')\n\n// Listen for events from web containers\nlink.on('event', (uuid, eventName, data) => {\n console.log(`Event from ${uuid}: ${eventName}`, data)\n})"
    }
  ],
  "types": {
    "ConnectedContainer": {
      "description": "--- Connected Container Metadata ---",
      "properties": {
        "uuid": {
          "type": "string",
          "description": ""
        },
        "url": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "capabilities": {
          "type": "string[]",
          "description": "",
          "optional": true
        },
        "meta": {
          "type": "Record<string, any>",
          "description": "",
          "optional": true
        },
        "ws": {
          "type": "any",
          "description": ""
        },
        "token": {
          "type": "string",
          "description": ""
        },
        "missedHeartbeats": {
          "type": "number",
          "description": ""
        }
      }
    },
    "LinkMessage": {
      "description": "--- Link Message Envelope ---",
      "properties": {
        "type": {
          "type": "MessageType",
          "description": ""
        },
        "id": {
          "type": "string",
          "description": ""
        },
        "timestamp": {
          "type": "number",
          "description": ""
        },
        "token": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "data": {
          "type": "T",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.git', {
  "id": "features.git",
  "description": "The Git feature provides utilities for interacting with Git repositories. This feature allows you to check repository status, list files, get branch information, and access Git metadata for projects within a Git repository.",
  "shortcut": "features.git",
  "className": "Git",
  "methods": {
    "lsFiles": {
      "description": "Lists files in the Git repository using git ls-files command. This method provides a flexible interface to the git ls-files command, allowing you to filter files by various criteria such as cached, deleted, modified, untracked, and ignored files.",
      "parameters": {
        "options": {
          "type": "LsFilesOptions",
          "description": "Options to control which files are listed",
          "properties": {
            "cached": {
              "type": "boolean",
              "description": "Show cached/staged files"
            },
            "deleted": {
              "type": "boolean",
              "description": "Show deleted files"
            },
            "modified": {
              "type": "boolean",
              "description": "Show modified files"
            },
            "others": {
              "type": "boolean",
              "description": "Show untracked files"
            },
            "ignored": {
              "type": "boolean",
              "description": "Show ignored files"
            },
            "status": {
              "type": "boolean",
              "description": "Show file status information"
            },
            "includeIgnored": {
              "type": "boolean",
              "description": "Include ignored files when showing others"
            },
            "exclude": {
              "type": "string | string[]",
              "description": "Patterns to exclude from results"
            },
            "baseDir": {
              "type": "string",
              "description": "Base directory to list files from"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<string[]>",
      "examples": [
        {
          "language": "ts",
          "code": "// Get all tracked files\nconst allFiles = await git.lsFiles()\n\n// Get only modified files\nconst modified = await git.lsFiles({ modified: true })\n\n// Get untracked files excluding certain patterns\nconst untracked = await git.lsFiles({ \n others: true, \n exclude: ['*.log', 'node_modules'] \n})"
        }
      ]
    },
    "getLatestChanges": {
      "description": "Gets the latest commits from the repository. Returns an array of commit objects containing the title (first line of commit message), full message body, and author name for each commit.",
      "parameters": {
        "numberOfChanges": {
          "type": "number",
          "description": "The number of recent commits to return"
        }
      },
      "required": [],
      "returns": "Promise<Array<{ title: string, message: string, author: string }>>",
      "examples": [
        {
          "language": "ts",
          "code": "const changes = await git.getLatestChanges(5)\nfor (const commit of changes) {\n console.log(`${commit.author}: ${commit.title}`)\n}"
        }
      ]
    },
    "fileLog": {
      "description": "Gets a lightweight commit log for one or more files. Returns the SHA and message for each commit that touched the given files, without the per-commit overhead of resolving which specific files matched. For richer per-file matching, see {@link getChangeHistoryForFiles}.",
      "parameters": {
        "files": {
          "type": "string[]",
          "description": "File paths (absolute or relative to container.cwd)"
        }
      },
      "required": [
        "files"
      ],
      "returns": "Array<{ sha: string, message: string }>",
      "examples": [
        {
          "language": "ts",
          "code": "const log = git.fileLog('package.json')\nconst log = git.fileLog('src/index.ts', 'src/helper.ts')\nfor (const entry of log) {\n console.log(`${entry.sha.slice(0, 8)} ${entry.message}`)\n}"
        }
      ]
    },
    "diff": {
      "description": "Gets the diff for a file between two refs. By default compares from the current HEAD to the given ref. You can supply both `compareTo` and `compareFrom` to diff between any two commits, branches, or tags.",
      "parameters": {
        "file": {
          "type": "string",
          "description": "File path (absolute or relative to container.cwd)"
        },
        "compareTo": {
          "type": "string",
          "description": "The target ref (commit SHA, branch, tag) to compare to"
        },
        "compareFrom": {
          "type": "string",
          "description": "The base ref to compare from (defaults to current HEAD)"
        }
      },
      "required": [
        "file",
        "compareTo"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Diff package.json between HEAD and a specific commit\nconst d = git.diff('package.json', 'abc1234')\n\n// Diff between two branches\nconst d = git.diff('src/index.ts', 'feature-branch', 'main')"
        }
      ]
    },
    "displayDiff": {
      "description": "Pretty prints a unified diff string to the terminal using colors. Parses the diff output and applies color coding: - File headers (`diff --git`, `---`, `+++`) are rendered bold - Hunk headers (`@@ ... @@`) are rendered in cyan - Added lines (`+`) are rendered in green - Removed lines (`-`) are rendered in red - Context lines are rendered dim Can be called with a raw diff string, or with the same arguments as {@link diff} to fetch and display in one step.",
      "parameters": {
        "diffOrFile": {
          "type": "string",
          "description": "A raw diff string, or a file path to pass to {@link diff}"
        },
        "compareTo": {
          "type": "string",
          "description": "When diffOrFile is a file path, the target ref to compare to"
        },
        "compareFrom": {
          "type": "string",
          "description": "When diffOrFile is a file path, the base ref to compare from"
        }
      },
      "required": [
        "diffOrFile"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Display a pre-fetched diff\nconst raw = git.diff('src/index.ts', 'main')\ngit.displayDiff(raw)\n\n// Fetch and display in one call\ngit.displayDiff('src/index.ts', 'abc1234')"
        }
      ]
    },
    "extractFolder": {
      "description": "Extracts a folder (or entire repo) from a remote GitHub repository without cloning. Downloads the repo as a tarball and extracts only the specified subfolder, similar to how degit works. No .git history is included — just the files. Supports shorthand (`user/repo/path`), branch refs (`user/repo/path#branch`), and full GitHub URLs (`https://github.com/user/repo/tree/branch/path`).",
      "parameters": {
        "{ source, destination, branch }": {
          "type": "{ source: string, destination: string, branch?: string }",
          "description": "Parameter { source, destination, branch }"
        }
      },
      "required": [
        "{ source, destination, branch }"
      ],
      "returns": "Promise<{ files: string[], source: { user: string, repo: string, ref: string, subdir: string",
      "examples": [
        {
          "language": "ts",
          "code": "// Extract a subfolder\nawait git.extractFolder({ source: 'soederpop/luca/src/assistants', destination: './my-assistants' })\n\n// Specific branch\nawait git.extractFolder({ source: 'sveltejs/template', destination: './my-app', branch: 'main' })\n\n// Full GitHub URL\nawait git.extractFolder({ source: 'https://github.com/user/repo/tree/main/examples', destination: './examples' })"
        }
      ]
    },
    "getChangeHistoryForFiles": {
      "description": "Gets the commit history for a set of files or glob patterns. Accepts absolute paths, relative paths (resolved from container.cwd), or glob patterns. Returns commits that touched any of the matched files, with each entry noting which of your queried files were in that commit.",
      "parameters": {
        "paths": {
          "type": "string[]",
          "description": "File paths or glob patterns to get history for"
        }
      },
      "required": [
        "paths"
      ],
      "returns": "Array<{ sha: string, message: string, longMessage: string, filesMatched: string[] }>",
      "examples": [
        {
          "language": "ts",
          "code": "const history = git.getChangeHistoryForFiles('src/container.ts', 'src/helper.ts')\nconst history = git.getChangeHistoryForFiles('src/node/features/*.ts')"
        }
      ]
    }
  },
  "getters": {
    "gitPath": {
      "description": "Resolve the git binary path, caching the result.",
      "returns": "string"
    },
    "branch": {
      "description": "Gets the current Git branch name.",
      "returns": "string | null",
      "examples": [
        {
          "language": "ts",
          "code": "const currentBranch = git.branch\nif (currentBranch) {\n console.log(`Currently on branch: ${currentBranch}`)\n}"
        }
      ]
    },
    "sha": {
      "description": "Gets the current Git commit SHA hash.",
      "returns": "string | null",
      "examples": [
        {
          "language": "ts",
          "code": "const commitSha = git.sha\nif (commitSha) {\n console.log(`Current commit: ${commitSha}`)\n}"
        }
      ]
    },
    "isRepo": {
      "description": "Checks if the current directory is within a Git repository.",
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (git.isRepo) {\n console.log('This is a Git repository!')\n} else {\n console.log('Not in a Git repository')\n}"
        }
      ]
    },
    "isRepoRoot": {
      "description": "Checks if the current working directory is the root of the Git repository.",
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (git.isRepoRoot) {\n console.log('At the repository root')\n} else {\n console.log('In a subdirectory of the repository')\n}"
        }
      ]
    },
    "repoRoot": {
      "description": "Gets the absolute path to the Git repository root directory. This method caches the repository root path for performance. It searches upward from the current directory to find the .git directory.",
      "returns": "string | null",
      "examples": [
        {
          "language": "ts",
          "code": "const repoRoot = git.repoRoot\nif (repoRoot) {\n console.log(`Repository root: ${repoRoot}`)\n}"
        }
      ]
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const git = container.feature('git')\n\nif (git.isRepo) {\n console.log(`Current branch: ${git.branch}`)\n console.log(`Repository root: ${git.repoRoot}`)\n \n const allFiles = await git.lsFiles()\n const modifiedFiles = await git.lsFiles({ modified: true })\n}"
    }
  ],
  "types": {
    "LsFilesOptions": {
      "description": "",
      "properties": {
        "cached": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "deleted": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "modified": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "others": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "ignored": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "status": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "includeIgnored": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "exclude": {
          "type": "string | string[]",
          "description": "",
          "optional": true
        },
        "baseDir": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.dns', {
  "id": "features.dns",
  "description": "The Dns feature provides structured DNS lookups by wrapping the `dig` CLI. All query methods parse dig output into typed JSON objects, making it easy to explore and audit a domain's DNS configuration programmatically.",
  "shortcut": "features.dns",
  "className": "Dns",
  "methods": {
    "isAvailable": {
      "description": "Checks whether the `dig` binary is available on the system.",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "if (await dns.isAvailable()) {\n const records = await dns.a('example.com')\n}"
        }
      ]
    },
    "resolve": {
      "description": "Resolves DNS records of a given type for a domain. This is the core query method. All convenience methods (a, aaaa, mx, etc.) delegate to this method.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "type": {
          "type": "DnsRecordType",
          "description": "The DNS record type to look up"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": "DNS server to use (e.g. '8.8.8.8')"
            },
            "timeout": {
              "type": "number",
              "description": "Query timeout in seconds"
            },
            "short": {
              "type": "boolean",
              "description": "If true, returns only values (no TTL, class, etc.)"
            }
          }
        }
      },
      "required": [
        "domain",
        "type"
      ],
      "returns": "Promise<DnsQueryResult>",
      "examples": [
        {
          "language": "ts",
          "code": "const result = await dns.resolve('example.com', 'A')\nfor (const record of result.records) {\n console.log(`${record.name} -> ${record.value} (TTL: ${record.ttl}s)`)\n}\n\n// Query a specific DNS server\nconst result = await dns.resolve('example.com', 'A', { server: '1.1.1.1' })"
        }
      ]
    },
    "a": {
      "description": "Looks up A (IPv4 address) records for a domain.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<DnsRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.a('google.com')\n// [{ name: 'google.com.', ttl: 300, class: 'IN', type: 'A', value: '142.250.x.x' }]"
        }
      ]
    },
    "aaaa": {
      "description": "Looks up AAAA (IPv6 address) records for a domain.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<DnsRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.aaaa('google.com')\n// [{ name: 'google.com.', ttl: 300, class: 'IN', type: 'AAAA', value: '2607:f8b0:...' }]"
        }
      ]
    },
    "cname": {
      "description": "Looks up CNAME (canonical name) records for a domain.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<DnsRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.cname('www.github.com')\n// [{ name: 'www.github.com.', ttl: 3600, class: 'IN', type: 'CNAME', value: 'github.com.' }]"
        }
      ]
    },
    "mx": {
      "description": "Looks up MX (mail exchange) records for a domain. Returns enriched records with parsed priority and exchange fields.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<MxRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.mx('google.com')\n// [{ name: 'google.com.', ttl: 300, type: 'MX', priority: 10, exchange: 'smtp.google.com.' }]"
        }
      ]
    },
    "ns": {
      "description": "Looks up NS (nameserver) records for a domain.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<DnsRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.ns('google.com')\n// [{ name: 'google.com.', ttl: 86400, type: 'NS', value: 'ns1.google.com.' }, ...]"
        }
      ]
    },
    "txt": {
      "description": "Looks up TXT records for a domain. TXT records often contain SPF policies, DKIM keys, domain verification tokens, and other metadata.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<DnsRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.txt('google.com')\nconst spf = records.find(r => r.value.includes('v=spf1'))\nconsole.log(spf?.value) // 'v=spf1 include:_spf.google.com ~all'"
        }
      ]
    },
    "soa": {
      "description": "Looks up the SOA (Start of Authority) record for a domain. Returns enriched records with parsed SOA fields including primary nameserver, responsible party, serial number, and timing parameters.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<SoaRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.soa('google.com')\nconsole.log(records[0].mname)  // 'ns1.google.com.'\nconsole.log(records[0].serial) // 879543655"
        }
      ]
    },
    "srv": {
      "description": "Looks up SRV (service) records for a domain. SRV records specify the location of services. The domain should include the service and protocol prefix (e.g. `_sip._tcp.example.com`).",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The full SRV domain (e.g. `_sip._tcp.example.com`)"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<SrvRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.srv('_sip._tcp.example.com')\n// [{ priority: 10, weight: 60, port: 5060, target: 'sip.example.com.' }]"
        }
      ]
    },
    "caa": {
      "description": "Looks up CAA (Certificate Authority Authorization) records for a domain. CAA records specify which certificate authorities are allowed to issue certificates for a domain.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<CaaRecord[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const records = await dns.caa('google.com')\n// [{ flags: 0, tag: 'issue', issuer: 'pki.goog' }]"
        }
      ]
    },
    "reverse": {
      "description": "Performs a reverse DNS lookup for an IP address. Converts the IP to its in-addr.arpa form and queries for PTR records.",
      "parameters": {
        "ip": {
          "type": "string",
          "description": "The IPv4 address to look up"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "ip"
      ],
      "returns": "Promise<string[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const hostnames = await dns.reverse('8.8.8.8')\n// ['dns.google.']"
        }
      ]
    },
    "overview": {
      "description": "Retrieves a comprehensive DNS overview for a domain. Queries all common record types (A, AAAA, CNAME, MX, NS, TXT, SOA, CAA) in parallel and returns a consolidated view. This is the go-to method for exploring a domain's full DNS configuration.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "options": {
          "type": "QueryOptions",
          "description": "Optional query parameters applied to all queries",
          "properties": {
            "server": {
              "type": "string",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "short": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "domain"
      ],
      "returns": "Promise<DnsOverview>",
      "examples": [
        {
          "language": "ts",
          "code": "const overview = await dns.overview('example.com')\nconsole.log('IPs:', overview.a.map(r => r.value))\nconsole.log('Mail:', overview.mx.map(r => r.exchange))\nconsole.log('Nameservers:', overview.ns.map(r => r.value))\nconsole.log('TXT:', overview.txt.map(r => r.value))"
        }
      ]
    },
    "compare": {
      "description": "Compares DNS resolution between two nameservers for a given record type. Useful for verifying DNS propagation or checking for inconsistencies between authoritative and recursive resolvers.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "type": {
          "type": "DnsRecordType",
          "description": "The DNS record type to compare"
        },
        "serverA": {
          "type": "string",
          "description": "First DNS server (e.g. '8.8.8.8')"
        },
        "serverB": {
          "type": "string",
          "description": "Second DNS server (e.g. '1.1.1.1')"
        }
      },
      "required": [
        "domain",
        "type",
        "serverA",
        "serverB"
      ],
      "returns": "Promise<{ serverA: DnsQueryResult; serverB: DnsQueryResult; match: boolean }>",
      "examples": [
        {
          "language": "ts",
          "code": "const diff = await dns.compare('example.com', 'A', '8.8.8.8', '1.1.1.1')\nconsole.log(diff.match)   // true if both return the same values\nconsole.log(diff.serverA) // records from 8.8.8.8\nconsole.log(diff.serverB) // records from 1.1.1.1"
        }
      ]
    },
    "queryAuthoritative": {
      "description": "Queries a domain's authoritative nameservers directly. First resolves the NS records, then queries each nameserver for the specified record type. Useful for bypassing caches and checking what the authoritative servers actually report.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "type": {
          "type": "DnsRecordType",
          "description": "The DNS record type to look up"
        }
      },
      "required": [
        "domain",
        "type"
      ],
      "returns": "Promise<DnsQueryResult[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const results = await dns.queryAuthoritative('example.com', 'A')\nfor (const r of results) {\n console.log(`${r.server}: ${r.records.map(rec => rec.value).join(', ')}`)\n}"
        }
      ]
    },
    "hasTxtRecord": {
      "description": "Checks whether a domain has a specific TXT record containing the given text. Useful for verifying domain ownership tokens, SPF records, DKIM entries, etc.",
      "parameters": {
        "domain": {
          "type": "string",
          "description": "The domain name to query"
        },
        "search": {
          "type": "string",
          "description": "The text to search for in TXT record values"
        }
      },
      "required": [
        "domain",
        "search"
      ],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "// Check for SPF record\nconst hasSPF = await dns.hasTxtRecord('google.com', 'v=spf1')\n\n// Check for domain verification\nconst verified = await dns.hasTxtRecord('example.com', 'google-site-verification=')"
        }
      ]
    }
  },
  "getters": {
    "proc": {
      "description": "",
      "returns": "any"
    },
    "digPath": {
      "description": "Resolved path to the dig binary",
      "returns": "string"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const dns = container.feature('dns')\n\n// Look up A records\nconst result = await dns.resolve('example.com', 'A')\nconsole.log(result.records)\n\n// Get a full overview of all record types\nconst overview = await dns.overview('example.com')\nconsole.log(overview.mx)  // mail servers\nconsole.log(overview.ns)  // nameservers\nconsole.log(overview.txt) // TXT records (SPF, DKIM, etc.)\n\n// Reverse lookup\nconst ptr = await dns.reverse('8.8.8.8')\nconsole.log(ptr) // ['dns.google.']"
    }
  ],
  "types": {
    "QueryOptions": {
      "description": "",
      "properties": {
        "server": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "timeout": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "short": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.downloader', {
  "id": "features.downloader",
  "description": "A feature that provides file downloading capabilities from URLs. The Downloader feature allows you to fetch files from remote URLs and save them to the local filesystem. It handles the network request, buffering, and file writing operations automatically.",
  "shortcut": "features.downloader",
  "className": "Downloader",
  "methods": {
    "download": {
      "description": "Downloads a file from a URL and saves it to the specified local path. This method fetches the file from the provided URL, converts it to a buffer, and writes it to the filesystem at the target path. The target path is resolved relative to the container's configured paths.",
      "parameters": {
        "url": {
          "type": "string",
          "description": "The URL to download the file from. Must be a valid HTTP/HTTPS URL."
        },
        "targetPath": {
          "type": "string",
          "description": "The local file path where the downloaded file should be saved."
        }
      },
      "required": [
        "url",
        "targetPath"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "// Download an image file\nconst imagePath = await downloader.download(\n 'https://example.com/photo.jpg',\n 'images/downloaded-photo.jpg'\n)\n\n// Download a document\nconst docPath = await downloader.download(\n 'https://api.example.com/files/document.pdf',\n 'documents/report.pdf'\n)"
        }
      ]
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
      "code": "// Enable the downloader feature\nconst downloader = container.feature('downloader')\n\n// Download a file\nconst localPath = await downloader.download(\n 'https://example.com/image.jpg',\n 'downloads/image.jpg'\n)\nconsole.log(`File saved to: ${localPath}`)"
    }
  ]
});

setBuildTimeData('features.proc', {
  "id": "features.proc",
  "description": "The ChildProcess feature provides utilities for executing external processes and commands. This feature wraps Node.js child process functionality to provide convenient methods for executing shell commands, spawning processes, and capturing their output. It supports both synchronous and asynchronous execution with various options.",
  "shortcut": "features.proc",
  "className": "ChildProcess",
  "methods": {
    "execAndCapture": {
      "description": "Executes a command string and captures its output asynchronously. This method takes a complete command string, splits it into command and arguments, and executes it using the spawnAndCapture method. It's a convenient wrapper for simple command execution.",
      "parameters": {
        "cmd": {
          "type": "string",
          "description": "The complete command string to execute (e.g., \"git status --porcelain\")"
        },
        "options": {
          "type": "any",
          "description": "Options to pass to the underlying spawn process"
        }
      },
      "required": [
        "cmd"
      ],
      "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>",
      "examples": [
        {
          "language": "ts",
          "code": "// Execute a git command\nconst result = await proc.execAndCapture('git status --porcelain')\nif (result.exitCode === 0) {\n console.log('Git status:', result.stdout)\n} else {\n console.error('Git error:', result.stderr)\n}\n\n// Execute with options\nconst result = await proc.execAndCapture('npm list --depth=0', {\n cwd: '/path/to/project'\n})"
        }
      ]
    },
    "spawnAndCapture": {
      "description": "Spawns a process and captures its output with real-time monitoring capabilities. This method provides comprehensive process execution with the ability to capture output, monitor real-time data streams, and handle process lifecycle events. It's ideal for long-running processes where you need to capture output as it happens.",
      "parameters": {
        "command": {
          "type": "string",
          "description": "The command to execute (e.g., 'node', 'npm', 'git')"
        },
        "args": {
          "type": "string[]",
          "description": "Array of arguments to pass to the command"
        },
        "options": {
          "type": "SpawnOptions",
          "description": "Options for process execution and monitoring",
          "properties": {
            "stdio": {
              "type": "\"ignore\" | \"inherit\"",
              "description": "Standard I/O mode for the child process"
            },
            "stdout": {
              "type": "\"ignore\" | \"inherit\"",
              "description": "Stdout mode for the child process"
            },
            "stderr": {
              "type": "\"ignore\" | \"inherit\"",
              "description": "Stderr mode for the child process"
            },
            "cwd": {
              "type": "string",
              "description": "Working directory for the child process"
            },
            "environment": {
              "type": "Record<string, any>",
              "description": "Environment variables to pass to the child process"
            },
            "onError": {
              "type": "(data: string) => void",
              "description": "Callback invoked when stderr data is received"
            },
            "onOutput": {
              "type": "(data: string) => void",
              "description": "Callback invoked when stdout data is received"
            },
            "onExit": {
              "type": "(code: number) => void",
              "description": "Callback invoked when the process exits"
            },
            "onStart": {
              "type": "(childProcess: ChildProcess) => void",
              "description": "Callback invoked when the process starts"
            }
          }
        }
      },
      "required": [
        "command",
        "args"
      ],
      "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>",
      "examples": [
        {
          "language": "ts",
          "code": "// Basic usage\nconst result = await proc.spawnAndCapture('node', ['--version'])\nconsole.log(`Node version: ${result.stdout}`)\n\n// With real-time output monitoring\nconst result = await proc.spawnAndCapture('npm', ['install'], {\n onOutput: (data) => console.log('📦 ', data.trim()),\n onError: (data) => console.error('❌ ', data.trim()),\n onExit: (code) => console.log(`Process exited with code ${code}`)\n})\n\n// Long-running process with custom working directory\nconst buildResult = await proc.spawnAndCapture('npm', ['run', 'build'], {\n cwd: '/path/to/project',\n onOutput: (data) => {\n   if (data.includes('error')) {\n     console.error('Build error detected:', data)\n   }\n }\n})"
        }
      ]
    },
    "spawn": {
      "description": "Spawn a raw child process and return the handle immediately. Useful when callers need streaming access to stdout/stderr and direct lifecycle control (for example, cancellation via kill()).",
      "parameters": {
        "command": {
          "type": "string",
          "description": "Parameter command"
        },
        "args": {
          "type": "string[]",
          "description": "Parameter args"
        },
        "options": {
          "type": "RawSpawnOptions",
          "description": "Parameter options",
          "properties": {
            "cwd": {
              "type": "string",
              "description": "Working directory for the child process"
            },
            "environment": {
              "type": "Record<string, any>",
              "description": "Environment variables to pass to the child process"
            },
            "stdin": {
              "type": "string | Buffer",
              "description": "Optional stdin payload written immediately after spawn"
            },
            "stdout": {
              "type": "\"pipe\" | \"inherit\" | \"ignore\"",
              "description": "Stdout mode for the child process"
            },
            "stderr": {
              "type": "\"pipe\" | \"inherit\" | \"ignore\"",
              "description": "Stderr mode for the child process"
            }
          }
        }
      },
      "required": [
        "command"
      ],
      "returns": "import('child_process').ChildProcess"
    },
    "exec": {
      "description": "Execute a command synchronously and return its output. Runs a shell command and waits for it to complete before returning. Useful for simple commands where you need the result immediately.",
      "parameters": {
        "command": {
          "type": "string",
          "description": "The command to execute"
        },
        "options": {
          "type": "any",
          "description": "Options for command execution (cwd, encoding, etc.)"
        }
      },
      "required": [
        "command"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const branch = proc.exec('git branch --show-current')\nconst version = proc.exec('node --version')"
        }
      ]
    },
    "execSync": {
      "description": "",
      "parameters": {
        "command": {
          "type": "string",
          "description": "Parameter command"
        },
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [
        "command"
      ],
      "returns": "string"
    },
    "establishLock": {
      "description": "Establishes a PID-file lock to prevent duplicate process instances. Writes the current process PID to the given file path. If the file already exists and the PID inside it refers to a running process, the current process exits immediately. Stale PID files (where the process is no longer running) are automatically cleaned up. Cleanup handlers are registered on SIGTERM, SIGINT, and process exit to remove the PID file when the process shuts down.",
      "parameters": {
        "pidPath": {
          "type": "string",
          "description": "Path to the PID file, resolved relative to container.cwd"
        }
      },
      "required": [
        "pidPath"
      ],
      "returns": "{ release: () => void }",
      "examples": [
        {
          "language": "ts",
          "code": "// In a command handler — exits if already running\nconst lock = proc.establishLock('tmp/luca-main.pid')\n\n// Later, if you need to release manually\nlock.release()"
        }
      ]
    },
    "kill": {
      "description": "Kills a process by its PID.",
      "parameters": {
        "pid": {
          "type": "number",
          "description": "The process ID to kill"
        },
        "signal": {
          "type": "NodeJS.Signals | number",
          "description": "The signal to send (e.g. 'SIGTERM', 'SIGKILL', 9)"
        }
      },
      "required": [
        "pid"
      ],
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "// Gracefully terminate a process\nproc.kill(12345)\n\n// Force kill a process\nproc.kill(12345, 'SIGKILL')"
        }
      ]
    },
    "findPidsByPort": {
      "description": "Finds PIDs of processes listening on a given port. Uses `lsof` on macOS/Linux to discover which processes have a socket bound to the specified port.",
      "parameters": {
        "port": {
          "type": "number",
          "description": "The port number to search for"
        }
      },
      "required": [
        "port"
      ],
      "returns": "number[]",
      "examples": [
        {
          "language": "ts",
          "code": "const pids = proc.findPidsByPort(3000)\nconsole.log(`Processes on port 3000: ${pids}`)\n\n// Kill everything on port 3000\nfor (const pid of proc.findPidsByPort(3000)) {\n proc.kill(pid)\n}"
        }
      ]
    },
    "isProcessRunning": {
      "description": "Checks whether any process matching a given name is currently running. Uses `pgrep -x` for an exact match against process names.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The process name to look for (e.g. 'afplay', 'node', 'nginx')"
        }
      },
      "required": [
        "name"
      ],
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (proc.isProcessRunning('afplay')) {\n console.log('Audio is currently playing')\n}"
        }
      ]
    },
    "onSignal": {
      "description": "",
      "parameters": {
        "signal": {
          "type": "NodeJS.Signals",
          "description": "Parameter signal"
        },
        "handler": {
          "type": "() => void",
          "description": "Parameter handler"
        }
      },
      "required": [
        "signal",
        "handler"
      ],
      "returns": "() => void"
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
      "code": "const proc = container.feature('proc')\n\n// Execute a simple command synchronously\nconst result = proc.exec('echo \"Hello World\"')\nconsole.log(result) // 'Hello World'\n\n// Execute and capture output asynchronously\nconst { stdout, stderr } = await proc.spawnAndCapture('npm', ['--version'])\nconsole.log(`npm version: ${stdout}`)\n\n// Execute with callbacks for real-time output\nawait proc.spawnAndCapture('npm', ['install'], {\n onOutput: (data) => console.log('OUT:', data),\n onError: (data) => console.log('ERR:', data)\n})"
    }
  ],
  "types": {
    "SpawnOptions": {
      "description": "",
      "properties": {
        "stdio": {
          "type": "\"ignore\" | \"inherit\"",
          "description": "Standard I/O mode for the child process",
          "optional": true
        },
        "stdout": {
          "type": "\"ignore\" | \"inherit\"",
          "description": "Stdout mode for the child process",
          "optional": true
        },
        "stderr": {
          "type": "\"ignore\" | \"inherit\"",
          "description": "Stderr mode for the child process",
          "optional": true
        },
        "cwd": {
          "type": "string",
          "description": "Working directory for the child process",
          "optional": true
        },
        "environment": {
          "type": "Record<string, any>",
          "description": "Environment variables to pass to the child process",
          "optional": true
        },
        "onError": {
          "type": "(data: string) => void",
          "description": "Callback invoked when stderr data is received",
          "optional": true
        },
        "onOutput": {
          "type": "(data: string) => void",
          "description": "Callback invoked when stdout data is received",
          "optional": true
        },
        "onExit": {
          "type": "(code: number) => void",
          "description": "Callback invoked when the process exits",
          "optional": true
        },
        "onStart": {
          "type": "(childProcess: ChildProcess) => void",
          "description": "Callback invoked when the process starts",
          "optional": true
        }
      }
    },
    "RawSpawnOptions": {
      "description": "",
      "properties": {
        "cwd": {
          "type": "string",
          "description": "Working directory for the child process",
          "optional": true
        },
        "environment": {
          "type": "Record<string, any>",
          "description": "Environment variables to pass to the child process",
          "optional": true
        },
        "stdin": {
          "type": "string | Buffer",
          "description": "Optional stdin payload written immediately after spawn",
          "optional": true
        },
        "stdout": {
          "type": "\"pipe\" | \"inherit\" | \"ignore\"",
          "description": "Stdout mode for the child process",
          "optional": true
        },
        "stderr": {
          "type": "\"pipe\" | \"inherit\" | \"ignore\"",
          "description": "Stderr mode for the child process",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.vm', {
  "id": "features.vm",
  "description": "The VM feature provides Node.js virtual machine capabilities for executing JavaScript code. This feature wraps Node.js's built-in `vm` module to provide secure code execution in isolated contexts. It's useful for running untrusted code, creating sandboxed environments, or dynamically executing code with controlled access to variables and modules.",
  "shortcut": "features.vm",
  "className": "VM",
  "methods": {
    "defineModule": {
      "description": "Register a virtual module that will be available to `require()` inside VM-executed code. Modules registered here take precedence over Node's native resolution.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The module specifier (e.g. `'@soederpop/luca'`, `'zod'`)"
        },
        "exports": {
          "type": "any",
          "description": "The module's exports object"
        }
      },
      "required": [
        "id",
        "exports"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const vm = container.feature('vm')\nvm.defineModule('@soederpop/luca', { Container, Feature, fs, proc })\nvm.defineModule('zod', { z })\n\n// Now loadModule can resolve these in user code:\n// import { Container } from '@soederpop/luca'  → works"
        }
      ]
    },
    "createRequireFor": {
      "description": "Build a require function that resolves from the virtual modules map first, falling back to Node's native `createRequire` for everything else.",
      "parameters": {
        "filePath": {
          "type": "string",
          "description": "The file path to scope native require resolution to"
        }
      },
      "required": [
        "filePath"
      ],
      "returns": "((id: string) => any) & { resolve: RequireResolve }"
    },
    "createScript": {
      "description": "Creates a new VM script from the provided code. This method compiles JavaScript code into a VM script that can be executed multiple times in different contexts. The script is pre-compiled for better performance when executing the same code repeatedly.",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The JavaScript code to compile into a script"
        },
        "options": {
          "type": "vm.ScriptOptions",
          "description": "Options for script compilation"
        }
      },
      "required": [
        "code"
      ],
      "returns": "vm.Script",
      "examples": [
        {
          "language": "ts",
          "code": "const script = vm.createScript('Math.max(a, b)')\n\n// Execute the script multiple times with different contexts\nconst result1 = script.runInContext(vm.createContext({ a: 5, b: 3 }))\nconst result2 = script.runInContext(vm.createContext({ a: 10, b: 20 }))"
        }
      ]
    },
    "isContext": {
      "description": "Check whether an object has already been contextified by `vm.createContext()`. Useful to avoid double-contextifying when you're not sure if the caller passed a plain object or an existing context.",
      "parameters": {
        "ctx": {
          "type": "unknown",
          "description": "The object to check"
        }
      },
      "required": [
        "ctx"
      ],
      "returns": "ctx is vm.Context",
      "examples": [
        {
          "language": "ts",
          "code": "const ctx = vm.createContext({ x: 1 })\nvm.isContext(ctx)   // true\nvm.isContext({ x: 1 }) // false"
        }
      ]
    },
    "createContext": {
      "description": "Create an isolated JavaScript execution context. Combines the container's context with any additional variables provided. If the input is already a VM context, it is returned as-is.",
      "parameters": {
        "ctx": {
          "type": "any",
          "description": "Additional context variables to include"
        }
      },
      "required": [],
      "returns": "vm.Context",
      "examples": [
        {
          "language": "ts",
          "code": "const context = vm.createContext({ user: { name: 'John' } })\nconst result = vm.runSync('user.name', context)"
        }
      ]
    },
    "wrapTopLevelAwait": {
      "description": "Wrap code containing top-level `await` in an async IIFE, injecting `return` before the last expression so the value is not lost. If the code does not contain `await`, or is already wrapped in an async function/arrow, it is returned unchanged.",
      "parameters": {
        "code": {
          "type": "string",
          "description": "Parameter code"
        }
      },
      "required": [
        "code"
      ],
      "returns": "string"
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
        }
      },
      "required": [
        "code"
      ],
      "returns": "Promise<T>"
    },
    "runCaptured": {
      "description": "Execute code and capture all console output as structured JSON. Returns both the execution result and an array of every `console.*` call made during execution, each entry recording the method name and arguments.",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The JavaScript code to execute"
        },
        "ctx": {
          "type": "any",
          "description": "Context variables to make available to the executing code"
        }
      },
      "required": [
        "code"
      ],
      "returns": "Promise<{\n    result: T\n    console: Array<{ method: string, args: any[] }>\n    context: vm.Context\n  }>",
      "examples": [
        {
          "language": "ts",
          "code": "const { result, console: calls } = await vm.runCaptured('console.log(\"hi\"); console.warn(\"oh\"); 42')\n// result === 42\n// calls === [{ method: 'log', args: ['hi'] }, { method: 'warn', args: ['oh'] }]"
        }
      ]
    },
    "runSync": {
      "description": "Execute JavaScript code synchronously in a controlled environment.",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The JavaScript code to execute"
        },
        "ctx": {
          "type": "any",
          "description": "Context variables to make available to the executing code"
        }
      },
      "required": [
        "code"
      ],
      "returns": "T",
      "examples": [
        {
          "language": "ts",
          "code": "const sum = vm.runSync('a + b', { a: 2, b: 3 })\nconsole.log(sum) // 5"
        }
      ]
    },
    "perform": {
      "description": "Execute code asynchronously and return both the result and the execution context. Unlike `run`, this method also returns the context object, allowing you to inspect variables set during execution.",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The JavaScript code to execute"
        },
        "ctx": {
          "type": "any",
          "description": "Context variables to make available to the executing code"
        }
      },
      "required": [
        "code"
      ],
      "returns": "Promise<{ result: T, context: vm.Context }>",
      "examples": [
        {
          "language": "ts",
          "code": "const { result, context } = await vm.perform('x = 42; x * 2', { x: 0 })\nconsole.log(result)     // 84\nconsole.log(context.x)  // 42"
        }
      ]
    },
    "performSync": {
      "description": "Executes JavaScript code synchronously and returns both the result and the execution context. Unlike `runSync`, this method also returns the context object, allowing you to inspect variables set during execution (e.g. `module.exports`). This is the synchronous equivalent of `perform()`.",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The JavaScript code to execute"
        },
        "ctx": {
          "type": "any",
          "description": "Context variables to make available to the executing code"
        }
      },
      "required": [
        "code"
      ],
      "returns": "{ result: T, context: vm.Context }",
      "examples": [
        {
          "language": "ts",
          "code": "const { result, context } = vm.performSync(code, {\n exports: {},\n module: { exports: {} },\n})\nconst moduleExports = context.module?.exports || context.exports"
        }
      ]
    },
    "loadModule": {
      "description": "Synchronously loads a JavaScript/TypeScript module from a file path, executing it in an isolated VM context and returning its exports. The module gets `require`, `exports`, and `module` globals automatically, plus any additional context you provide.",
      "parameters": {
        "filePath": {
          "type": "string",
          "description": "Absolute path to the module file to load"
        },
        "ctx": {
          "type": "any",
          "description": "Additional context variables to inject into the module's execution environment"
        }
      },
      "required": [
        "filePath"
      ],
      "returns": "Record<string, any>",
      "examples": [
        {
          "language": "ts",
          "code": "const vm = container.feature('vm')\n\n// Load a tools module, injecting the container\nconst tools = vm.loadModule('/path/to/tools.ts', { container, me: assistant })\n// tools.myFunction, tools.schemas, etc."
        }
      ]
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
      "code": "const vm = container.feature('vm')\n\n// Execute simple code\nconst result = vm.run('1 + 2 + 3')\nconsole.log(result) // 6\n\n// Execute code with custom context\nconst result2 = vm.run('greeting + \" \" + name', { \n greeting: 'Hello', \n name: 'World' \n})\nconsole.log(result2) // 'Hello World'"
    }
  ]
});

setBuildTimeData('features.googleDrive', {
  "id": "features.googleDrive",
  "description": "Google Drive feature for listing, searching, browsing, and downloading files. Depends on the googleAuth feature for authentication. Creates a Drive v3 API client lazily and passes the auth client from googleAuth.",
  "shortcut": "features.googleDrive",
  "className": "GoogleDrive",
  "methods": {
    "listFiles": {
      "description": "List files in the user's Drive with an optional query filter.",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Drive search query (e.g. \"name contains 'report'\", \"mimeType='application/pdf'\")"
        },
        "options": {
          "type": "ListFilesOptions",
          "description": "Pagination and filtering options",
          "properties": {
            "pageSize": {
              "type": "number",
              "description": ""
            },
            "pageToken": {
              "type": "string",
              "description": ""
            },
            "orderBy": {
              "type": "string",
              "description": ""
            },
            "fields": {
              "type": "string",
              "description": ""
            },
            "corpora": {
              "type": "'user' | 'drive' | 'allDrives'",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<DriveFileList>"
    },
    "listFolder": {
      "description": "List files within a specific folder.",
      "parameters": {
        "folderId": {
          "type": "string",
          "description": "The Drive folder ID"
        },
        "options": {
          "type": "ListFilesOptions",
          "description": "Pagination and filtering options",
          "properties": {
            "pageSize": {
              "type": "number",
              "description": ""
            },
            "pageToken": {
              "type": "string",
              "description": ""
            },
            "orderBy": {
              "type": "string",
              "description": ""
            },
            "fields": {
              "type": "string",
              "description": ""
            },
            "corpora": {
              "type": "'user' | 'drive' | 'allDrives'",
              "description": ""
            }
          }
        }
      },
      "required": [
        "folderId"
      ],
      "returns": "Promise<DriveFileList>"
    },
    "browse": {
      "description": "Browse a folder's contents, separating files from subfolders.",
      "parameters": {
        "folderId": {
          "type": "string",
          "description": "Folder ID to browse (defaults to 'root')"
        }
      },
      "required": [],
      "returns": "Promise<DriveBrowseResult>"
    },
    "search": {
      "description": "Search files by name, content, or MIME type.",
      "parameters": {
        "term": {
          "type": "string",
          "description": "Search term to look for in file names and content"
        },
        "options": {
          "type": "SearchOptions",
          "description": "Additional search options like mimeType filter or folder restriction"
        }
      },
      "required": [
        "term"
      ],
      "returns": "Promise<DriveFileList>"
    },
    "getFile": {
      "description": "Get file metadata by file ID.",
      "parameters": {
        "fileId": {
          "type": "string",
          "description": "The Drive file ID"
        },
        "fields": {
          "type": "string",
          "description": "Specific fields to request (defaults to common fields)"
        }
      },
      "required": [
        "fileId"
      ],
      "returns": "Promise<DriveFile>"
    },
    "download": {
      "description": "Download a file's content as a Buffer. Uses alt=media for binary download of non-Google files.",
      "parameters": {
        "fileId": {
          "type": "string",
          "description": "The Drive file ID"
        }
      },
      "required": [
        "fileId"
      ],
      "returns": "Promise<Buffer>"
    },
    "downloadTo": {
      "description": "Download a file and save it to a local path.",
      "parameters": {
        "fileId": {
          "type": "string",
          "description": "The Drive file ID"
        },
        "localPath": {
          "type": "string",
          "description": "Local file path (resolved relative to container cwd)"
        }
      },
      "required": [
        "fileId",
        "localPath"
      ],
      "returns": "Promise<string>"
    },
    "exportFile": {
      "description": "Export a Google Workspace file (Docs, Sheets, Slides) to a given MIME type. Uses the Files.export endpoint.",
      "parameters": {
        "fileId": {
          "type": "string",
          "description": "The Drive file ID of a Google Workspace document"
        },
        "mimeType": {
          "type": "string",
          "description": "Target MIME type (e.g. 'text/plain', 'application/pdf', 'text/csv')"
        }
      },
      "required": [
        "fileId",
        "mimeType"
      ],
      "returns": "Promise<Buffer>"
    },
    "listDrives": {
      "description": "List all shared drives the user has access to.",
      "parameters": {},
      "required": [],
      "returns": "Promise<SharedDrive[]>"
    }
  },
  "getters": {
    "auth": {
      "description": "Access the google-auth feature lazily.",
      "returns": "GoogleAuth"
    }
  },
  "events": {
    "filesFetched": {
      "name": "filesFetched",
      "description": "Event emitted by GoogleDrive",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by GoogleDrive",
      "arguments": {}
    },
    "fileDownloaded": {
      "name": "fileDownloaded",
      "description": "Event emitted by GoogleDrive",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const drive = container.feature('googleDrive')\n\n// List recent files\nconst { files } = await drive.listFiles()\n\n// Search for documents\nconst { files: docs } = await drive.search('quarterly report', { mimeType: 'application/pdf' })\n\n// Browse a folder\nconst contents = await drive.browse('folder-id-here')\n\n// Download a file to disk\nawait drive.downloadTo('file-id', './downloads/report.pdf')"
    }
  ],
  "types": {
    "ListFilesOptions": {
      "description": "",
      "properties": {
        "pageSize": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "pageToken": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "orderBy": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "fields": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "corpora": {
          "type": "'user' | 'drive' | 'allDrives'",
          "description": "",
          "optional": true
        }
      }
    },
    "DriveFileList": {
      "description": "",
      "properties": {
        "files": {
          "type": "DriveFile[]",
          "description": ""
        },
        "nextPageToken": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    },
    "DriveFile": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "mimeType": {
          "type": "string",
          "description": ""
        },
        "size": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "createdTime": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "modifiedTime": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "parents": {
          "type": "string[]",
          "description": "",
          "optional": true
        },
        "webViewLink": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "iconLink": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "owners": {
          "type": "Array<{ displayName?: string | null; emailAddress?: string | null }>",
          "description": "",
          "optional": true
        }
      }
    },
    "DriveBrowseResult": {
      "description": "",
      "properties": {
        "folder": {
          "type": "DriveFile",
          "description": ""
        },
        "files": {
          "type": "DriveFile[]",
          "description": ""
        },
        "folders": {
          "type": "DriveFile[]",
          "description": ""
        },
        "nextPageToken": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    },
    "SharedDrive": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "colorRgb": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.ui', {
  "id": "features.ui",
  "description": "UI Feature - Interactive Terminal User Interface Builder Unified interface for building professional CLI experiences using chalk (colors/styles), figlet (ASCII art), and inquirer (interactive prompts). Provides rich color management, automatic color assignment, text gradients, banner generation, padding utilities, markdown rendering, and interactive wizards.",
  "shortcut": "features.ui",
  "className": "UI",
  "methods": {
    "markdown": {
      "description": "Parse markdown text and render it for terminal display using marked-terminal.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The markdown string to parse and render"
        }
      },
      "required": [
        "text"
      ],
      "returns": "string | Promise<string>"
    },
    "assignColor": {
      "description": "Assigns a consistent color to a named entity. This method provides automatic color assignment that remains consistent across the application session. Each unique name gets assigned a color from the palette, and subsequent calls with the same name return the same color function. **Assignment Strategy:** - First call with a name assigns the next available palette color - Subsequent calls return the previously assigned color - Colors cycle through the palette when all colors are used - Returns a chalk hex color function for styling text",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The unique identifier to assign a color to"
        }
      },
      "required": [
        "name"
      ],
      "returns": "(str: string) => string",
      "examples": [
        {
          "language": "ts",
          "code": "// Assign colors to users\nconst johnColor = ui.assignColor('john');\nconst janeColor = ui.assignColor('jane');\n\n// Use consistently throughout the app\nconsole.log(johnColor('John: Hello there!'));\nconsole.log(janeColor('Jane: Hi John!'));\nconsole.log(johnColor('John: How are you?')); // Same color as before\n\n// Different entities get different colors\nconst errorColor = ui.assignColor('error');\nconst successColor = ui.assignColor('success');"
        }
      ]
    },
    "wizard": {
      "description": "Creates an interactive wizard using inquirer prompts. This method provides a convenient wrapper around inquirer for creating interactive command-line wizards. It supports all inquirer question types and can handle complex validation and conditional logic. **Supported Question Types:** - input: Text input fields - confirm: Yes/no confirmations - list: Single selection from options - checkbox: Multiple selections - password: Hidden text input - editor: External editor integration **Advanced Features:** - Conditional questions based on previous answers - Input validation and transformation - Custom prompts and styling - Initial answer pre-population",
      "parameters": {
        "questions": {
          "type": "any[]",
          "description": "Array of inquirer question objects"
        },
        "initialAnswers": {
          "type": "any",
          "description": "Pre-populated answers to skip questions or provide defaults"
        }
      },
      "required": [
        "questions"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "// Basic wizard\nconst answers = await ui.wizard([\n {\n   type: 'input',\n   name: 'projectName',\n   message: 'What is your project name?',\n   validate: (input) => input.length > 0 || 'Name is required'\n },\n {\n   type: 'list',\n   name: 'framework',\n   message: 'Choose a framework:',\n   choices: ['React', 'Vue', 'Angular', 'Svelte']\n },\n {\n   type: 'confirm',\n   name: 'typescript',\n   message: 'Use TypeScript?',\n   default: true\n }\n]);\n\nconsole.log(`Creating ${answers.projectName} with ${answers.framework}`);\n\n// With initial answers\nconst moreAnswers = await ui.wizard([\n { type: 'input', name: 'version', message: 'Version?' }\n], { version: '1.0.0' });"
        }
      ]
    },
    "askQuestion": {
      "description": "Prompt the user with a single text input question.",
      "parameters": {
        "question": {
          "type": "string",
          "description": "The question message to display"
        }
      },
      "required": [
        "question"
      ],
      "returns": "Promise<any>"
    },
    "openInEditor": {
      "description": "Opens text in the user's external editor for editing. This method integrates with the user's configured editor (via $EDITOR or $VISUAL environment variables) to allow editing of text content. The edited content is returned when the user saves and closes the editor. **Editor Integration:** - Respects $EDITOR and $VISUAL environment variables - Creates temporary file with specified extension - Returns modified content after editor closes - Handles editor cancellation gracefully",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The initial text content to edit"
        },
        "extension": {
          "type": "any",
          "description": "File extension for syntax highlighting (default: \".ts\")"
        }
      },
      "required": [
        "text"
      ],
      "returns": "Promise<unknown>",
      "examples": [
        {
          "language": "ts",
          "code": "// Edit code snippet\nconst code = `function hello() {\\n  console.log('Hello');\\n}`;\nconst editedCode = await ui.openInEditor(code, '.js');\n\n// Edit configuration\nconst config = JSON.stringify({ port: 3000 }, null, 2);\nconst newConfig = await ui.openInEditor(config, '.json');\n\n// Edit markdown content\nconst markdown = '# Title\\n\\nContent here...';\nconst editedMarkdown = await ui.openInEditor(markdown, '.md');"
        }
      ]
    },
    "asciiArt": {
      "description": "Generates ASCII art from text using the specified font. This method converts regular text into stylized ASCII art using figlet's extensive font collection. Perfect for creating eye-catching headers, logos, and decorative text in terminal applications. **Font Capabilities:** - Large collection of artistic fonts - Various styles: block, script, decorative, technical - Different sizes and character sets - Consistent spacing and alignment",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to convert to ASCII art"
        },
        "font": {
          "type": "Fonts",
          "description": "The figlet font to use (see fonts property for available options)"
        }
      },
      "required": [
        "text",
        "font"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Create a banner\nconst banner = ui.asciiArt('WELCOME', 'Big');\nconsole.log(banner);\n\n// Different fonts for different purposes\nconst title = ui.asciiArt('MyApp', 'Standard');\nconst subtitle = ui.asciiArt('v2.0', 'Small');\n\n// Technical/coding themes\nconst code = ui.asciiArt('CODE', '3D-ASCII');\n\n// List available fonts first\nconsole.log('Available fonts:', ui.fonts.slice(0, 10).join(', '));"
        }
      ]
    },
    "banner": {
      "description": "Creates a styled banner with ASCII art and color gradients. This method combines ASCII art generation with color gradient effects to create visually striking banners for terminal applications. It automatically applies color gradients to the generated ASCII art based on the specified options. **Banner Features:** - ASCII art text generation - Automatic color gradient application - Customizable gradient directions - Multiple color combinations - Professional terminal presentation",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to convert to a styled banner"
        },
        "options": {
          "type": "{ font: Fonts; colors: Color[] }",
          "description": "Banner styling options",
          "properties": {
            "font": {
              "type": "any",
              "description": "The figlet font to use for ASCII art generation"
            },
            "colors": {
              "type": "any",
              "description": "Array of colors for the gradient effect"
            }
          }
        }
      },
      "required": [
        "text"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Classic patriotic banner\nconst banner = ui.banner('AMERICA', {\n font: 'Big',\n colors: ['red', 'white', 'blue']\n});\nconsole.log(banner);\n\n// Tech company banner\nconst techBanner = ui.banner('TechCorp', {\n font: 'Slant',\n colors: ['cyan', 'blue', 'magenta']\n});\n\n// Warning banner\nconst warningBanner = ui.banner('WARNING', {\n font: 'Standard',\n colors: ['yellow', 'red']\n});\n\n// Available fonts: see ui.fonts property\n// Available colors: any chalk color names"
        }
      ]
    },
    "endent": {
      "description": "Dedent and format a tagged template literal using endent. Strips leading indentation while preserving relative indentation.",
      "parameters": {
        "args": {
          "type": "any[]",
          "description": "Tagged template literal arguments"
        }
      },
      "required": [
        "args"
      ],
      "returns": "string"
    },
    "applyGradient": {
      "description": "Applies color gradients to text with configurable direction. This method creates smooth color transitions across text content, supporting both horizontal (character-by-character) and vertical (line-by-line) gradients. Perfect for creating visually appealing terminal output and ASCII art effects. **Gradient Types:** - Horizontal: Colors transition across characters in each line - Vertical: Colors transition across lines of text - Customizable color sequences and transitions - Automatic color cycling for long content",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text content to apply gradients to"
        },
        "lineColors": {
          "type": "Color[]",
          "description": "Array of colors to cycle through in the gradient"
        },
        "direction": {
          "type": "\"horizontal\" | \"vertical\"",
          "description": "Gradient direction: 'horizontal' or 'vertical'"
        }
      },
      "required": [
        "text"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Horizontal rainbow effect\nconst rainbow = ui.applyGradient('Hello World!', \n ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'], \n 'horizontal'\n);\n\n// Vertical gradient for multi-line text\nconst multiline = 'Line 1\\nLine 2\\nLine 3\\nLine 4';\nconst vertical = ui.applyGradient(multiline, \n ['red', 'white', 'blue'], \n 'vertical'\n);\n\n// Fire effect\nconst fire = ui.applyGradient('FIRE', ['red', 'yellow'], 'horizontal');\n\n// Ocean effect\nconst ocean = ui.applyGradient('OCEAN', ['blue', 'cyan', 'white'], 'vertical');"
        }
      ]
    },
    "applyHorizontalGradient": {
      "description": "Applies horizontal color gradients character by character. This method creates color transitions across characters within the text, cycling through the provided colors to create smooth horizontal gradients. Each character gets assigned a color based on its position in the sequence. **Horizontal Gradient Behavior:** - Each character is individually colored - Colors cycle through the provided array - Creates smooth transitions across text width - Works well with ASCII art and single lines",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to apply horizontal gradients to"
        },
        "lineColors": {
          "type": "Color[]",
          "description": "Array of colors to cycle through"
        }
      },
      "required": [
        "text"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Rainbow effect across characters\nconst rainbow = ui.applyHorizontalGradient('RAINBOW', \n ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']\n);\n\n// Simple two-color transition\nconst sunset = ui.applyHorizontalGradient('SUNSET', ['red', 'orange']);\n\n// Great for short text and ASCII art\nconst art = ui.asciiArt('COOL', 'Big');\nconst coloredArt = ui.applyHorizontalGradient(art, ['cyan', 'blue']);"
        }
      ]
    },
    "applyVerticalGradient": {
      "description": "Applies vertical color gradients line by line. This method creates color transitions across lines of text, with each line getting a different color from the sequence. Perfect for multi-line content like ASCII art, banners, and structured output. **Vertical Gradient Behavior:** - Each line is colored uniformly - Colors cycle through the provided array - Creates smooth transitions across text height - Ideal for multi-line ASCII art and structured content",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to apply vertical gradients to (supports newlines)"
        },
        "lineColors": {
          "type": "Color[]",
          "description": "Array of colors to cycle through for each line"
        }
      },
      "required": [
        "text"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Patriotic vertical gradient\nconst flag = 'USA\\nUSA\\nUSA\\nUSA';\nconst patriotic = ui.applyVerticalGradient(flag, ['red', 'white', 'blue']);\n\n// Sunset effect on ASCII art\nconst banner = ui.asciiArt('SUNSET', 'Big');\nconst sunset = ui.applyVerticalGradient(banner, \n ['yellow', 'orange', 'red', 'purple']\n);\n\n// Ocean waves effect\nconst waves = 'Wave 1\\nWave 2\\nWave 3\\nWave 4\\nWave 5';\nconst ocean = ui.applyVerticalGradient(waves, ['cyan', 'blue']);"
        }
      ]
    },
    "padLeft": {
      "description": "Pads text on the left to reach the specified length. This utility method adds padding characters to the left side of text to achieve a desired total length. Useful for creating aligned columns, formatted tables, and consistent text layout in terminal applications. **Padding Behavior:** - Adds padding to the left (start) of the string - Uses specified padding character (default: space) - Returns original string if already at or beyond target length - Handles multi-character padding by repeating the character",
      "parameters": {
        "str": {
          "type": "string",
          "description": "The string to pad"
        },
        "length": {
          "type": "number",
          "description": "The desired total length after padding"
        },
        "padChar": {
          "type": "any",
          "description": "The character to use for padding (default: \" \")"
        }
      },
      "required": [
        "str",
        "length"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Number alignment\nconst numbers = ['1', '23', '456'];\nnumbers.forEach(num => {\n console.log(ui.padLeft(num, 5, '0')); // '00001', '00023', '00456'\n});\n\n// Text alignment in columns\nconst items = ['apple', 'banana', 'cherry'];\nitems.forEach(item => {\n console.log(ui.padLeft(item, 10) + ' | Price: $1.00');\n});\n\n// Custom padding character\nconst title = ui.padLeft('TITLE', 20, '-'); // '---------------TITLE'"
        }
      ]
    },
    "padRight": {
      "description": "Pads text on the right to reach the specified length. This utility method adds padding characters to the right side of text to achieve a desired total length. Essential for creating properly aligned columns, tables, and formatted output in terminal applications. **Padding Behavior:** - Adds padding to the right (end) of the string - Uses specified padding character (default: space) - Returns original string if already at or beyond target length - Handles multi-character padding by repeating the character",
      "parameters": {
        "str": {
          "type": "string",
          "description": "The string to pad"
        },
        "length": {
          "type": "number",
          "description": "The desired total length after padding"
        },
        "padChar": {
          "type": "any",
          "description": "The character to use for padding (default: \" \")"
        }
      },
      "required": [
        "str",
        "length"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// Create aligned table columns\nconst data = [\n ['Name', 'Age', 'City'],\n ['John', '25', 'NYC'],\n ['Jane', '30', 'LA'],\n ['Bob', '35', 'Chicago']\n];\n\ndata.forEach(row => {\n const formatted = row.map((cell, i) => {\n   const widths = [15, 5, 10];\n   return ui.padRight(cell, widths[i]);\n }).join(' | ');\n console.log(formatted);\n});\n\n// Progress bars\nconst progress = ui.padRight('████', 20, '░'); // '████░░░░░░░░░░░░░░░░'\n\n// Menu items with dots\nconst menuItem = ui.padRight('Coffee', 20, '.') + '$3.50';"
        }
      ]
    }
  },
  "getters": {
    "colors": {
      "description": "Provides access to the full chalk colors API. Chalk provides extensive color and styling capabilities including: - Basic colors: red, green, blue, yellow, etc. - Background colors: bgRed, bgGreen, etc. - Styles: bold, italic, underline, strikethrough - Advanced: rgb, hex, hsl color support Colors and styles can be chained for complex formatting.",
      "returns": "typeof colors",
      "examples": [
        {
          "language": "ts",
          "code": "// Basic colors\nui.colors.red('Error message')\nui.colors.green('Success!')\n\n// Chained styling\nui.colors.blue.bold.underline('Important link')\nui.colors.white.bgRed.bold(' ALERT ')\n\n// Hex and RGB colors\nui.colors.hex('#FF5733')('Custom color')\nui.colors.rgb(255, 87, 51)('RGB color')"
        }
      ]
    },
    "colorPalette": {
      "description": "Gets the current color palette used for automatic color assignment. The color palette is a predefined set of hex colors that are automatically assigned to named entities in a cycling fashion. This ensures consistent color assignment across the application.",
      "returns": "string[]"
    },
    "randomColor": {
      "description": "Gets a random color name from the available chalk colors. This provides access to a randomly selected color from chalk's built-in color set. Useful for adding variety to terminal output or testing.",
      "returns": "string | undefined",
      "examples": [
        {
          "language": "ts",
          "code": "const randomColor = ui.randomColor;\nconsole.log(ui.colors[randomColor]('This text is a random color!'));\n\n// Use in loops for varied output\nitems.forEach(item => {\n const color = ui.randomColor;\n console.log(ui.colors[color](`- ${item}`));\n});"
        }
      ]
    },
    "fonts": {
      "description": "Gets an array of available fonts for ASCII art generation. This method provides access to all fonts available through figlet for creating ASCII art. The fonts are automatically discovered and cached on first access for performance. **Font Discovery:** - Fonts are loaded from figlet's built-in font collection - Results are cached in state to avoid repeated file system access - Returns comprehensive list of available font names",
      "returns": "string[]",
      "examples": [
        {
          "language": "ts",
          "code": "// List all available fonts\nconst fonts = ui.fonts;\nconsole.log(`Available fonts: ${fonts.join(', ')}`);\n\n// Use random font for variety\nconst randomFont = fonts[Math.floor(Math.random() * fonts.length)];\nconst art = ui.asciiArt('Hello', randomFont);\n\n// Common fonts: 'Big', 'Standard', 'Small', 'Slant', '3D-ASCII'"
        }
      ]
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.opener', {
  "id": "features.opener",
  "description": "The Opener feature opens files, URLs, desktop applications, and code editors. HTTP/HTTPS URLs are opened in Google Chrome. Desktop apps can be launched by name. VS Code and Cursor can be opened to a specific path. All other paths are opened with the platform's default handler (e.g. Preview for images, Finder for folders).",
  "shortcut": "features.opener",
  "className": "Opener",
  "methods": {
    "open": {
      "description": "Opens a path or URL with the appropriate application. HTTP and HTTPS URLs are opened in Google Chrome. Everything else is opened with the system default handler via `open` (macOS).",
      "parameters": {
        "target": {
          "type": "string",
          "description": "A URL or file path to open"
        }
      },
      "required": [
        "target"
      ],
      "returns": "Promise<void>"
    },
    "app": {
      "description": "Opens a desktop application by name. On macOS, uses `open -a` to launch the app. On Windows, uses `start`. On Linux, attempts to run the lowercase app name as a command.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The application name (e.g. \"Slack\", \"Finder\", \"Safari\")"
        }
      },
      "required": [
        "name"
      ],
      "returns": "Promise<void>"
    },
    "code": {
      "description": "Opens VS Code at the specified path. Uses the `code` CLI command. Falls back to `open -a \"Visual Studio Code\"` on macOS.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file or folder path to open"
        }
      },
      "required": [],
      "returns": "Promise<void>"
    },
    "cursor": {
      "description": "Opens Cursor at the specified path. Uses the `cursor` CLI command. Falls back to `open -a \"Cursor\"` on macOS.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file or folder path to open"
        }
      },
      "required": [],
      "returns": "Promise<void>"
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
      "code": "const opener = container.feature('opener')\n\n// Open a URL in Chrome\nawait opener.open('https://www.google.com')\n\n// Open a file with the default application\nawait opener.open('/path/to/image.png')\n\n// Open a desktop application\nawait opener.app('Slack')\n\n// Open VS Code at a project path\nawait opener.code('/Users/jon/projects/my-app')\n\n// Open Cursor at a project path\nawait opener.cursor('/Users/jon/projects/my-app')"
    }
  ]
});

setBuildTimeData('features.telegram', {
  "id": "features.telegram",
  "description": "Telegram bot feature powered by grammY. Supports both long-polling and webhook modes. Exposes the grammY Bot instance directly for full API access while bridging events to Luca's event bus.",
  "shortcut": "features.telegram",
  "className": "Telegram",
  "methods": {
    "enable": {
      "description": "",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "start": {
      "description": "Start the bot in the configured mode (polling or webhook).",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "stop": {
      "description": "Stop the bot gracefully.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "command": {
      "description": "Register a command handler. Also emits 'command' on the Luca event bus.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Parameter name"
        },
        "handler": {
          "type": "(ctx: Context) => any",
          "description": "Parameter handler"
        }
      },
      "required": [
        "name",
        "handler"
      ],
      "returns": "this"
    },
    "handle": {
      "description": "Register a grammY update handler (filter query). Named 'handle' to avoid collision with the inherited on() event bus method.",
      "parameters": {
        "filter": {
          "type": "Parameters<Bot['on']>[0]",
          "description": "Parameter filter"
        },
        "handler": {
          "type": "(ctx: any) => any",
          "description": "Parameter handler"
        }
      },
      "required": [
        "filter",
        "handler"
      ],
      "returns": "this",
      "examples": [
        {
          "language": "ts",
          "code": "tg.handle('message:text', (ctx) => ctx.reply('Got text'))\ntg.handle('callback_query:data', (ctx) => ctx.answerCallbackQuery('Clicked'))"
        }
      ]
    },
    "use": {
      "description": "Add grammY middleware.",
      "parameters": {
        "middleware": {
          "type": "Middleware[]",
          "description": "Parameter middleware"
        }
      },
      "required": [
        "middleware"
      ],
      "returns": "this"
    },
    "startPolling": {
      "description": "Start long-polling mode.",
      "parameters": {
        "dropPendingUpdates": {
          "type": "boolean",
          "description": "Parameter dropPendingUpdates"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "setupWebhook": {
      "description": "Set up webhook mode with an Express server.",
      "parameters": {
        "url": {
          "type": "string",
          "description": "Parameter url"
        },
        "path": {
          "type": "string",
          "description": "Parameter path"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "deleteWebhook": {
      "description": "Remove the webhook from Telegram.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "getMe": {
      "description": "Get bot info from Telegram API.",
      "parameters": {},
      "required": [],
      "returns": "Promise<UserFromGetMe>"
    },
    "diagnostics": {
      "description": "Print a diagnostic summary of the bot's current state.",
      "parameters": {},
      "required": [],
      "returns": "this"
    }
  },
  "getters": {
    "token": {
      "description": "Bot token from options or TELEGRAM_BOT_TOKEN env var.",
      "returns": "string"
    },
    "bot": {
      "description": "The grammY Bot instance. Created lazily on first access.",
      "returns": "Bot"
    },
    "isRunning": {
      "description": "Whether the bot is currently receiving updates.",
      "returns": "boolean"
    },
    "mode": {
      "description": "Current operation mode: 'polling', 'webhook', or 'idle'.",
      "returns": "'polling' | 'webhook' | 'idle'"
    }
  },
  "events": {
    "stopped": {
      "name": "stopped",
      "description": "Event emitted by Telegram",
      "arguments": {}
    },
    "command": {
      "name": "command",
      "description": "Event emitted by Telegram",
      "arguments": {}
    },
    "started": {
      "name": "started",
      "description": "Event emitted by Telegram",
      "arguments": {}
    },
    "webhook_ready": {
      "name": "webhook_ready",
      "description": "Event emitted by Telegram",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by Telegram",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const tg = container.feature('telegram', { autoStart: true })\ntg.command('start', (ctx) => ctx.reply('Hello!'))\ntg.handle('message:text', (ctx) => ctx.reply(`Echo: ${ctx.message.text}`))"
    }
  ]
});

setBuildTimeData('features.repl', {
  "id": "features.repl",
  "description": "REPL feature — provides an interactive read-eval-print loop with tab completion and history. Launches a REPL session that evaluates JavaScript/TypeScript expressions in a sandboxed VM context populated with the container and its helpers. Supports tab completion for dot-notation property access, command history persistence, and async/await.",
  "shortcut": "features.repl",
  "className": "Repl",
  "methods": {
    "start": {
      "description": "Start the REPL session. Creates a VM context populated with the container and its helpers, sets up readline with tab completion and history, then enters the interactive loop. Type `.exit` or `exit` to quit. Supports top-level await.",
      "parameters": {
        "options": {
          "type": "{ historyPath?: string, context?: any }",
          "description": "Configuration for the REPL session",
          "properties": {
            "historyPath": {
              "type": "any",
              "description": "Custom path for the history file (defaults to ~/.cache/luca/repl-{cwdHash}.history)"
            },
            "context": {
              "type": "any",
              "description": "Additional variables to inject into the VM context"
            }
          }
        }
      },
      "required": [],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const repl = container.feature('repl', { enable: true })\nawait repl.start({\n context: { db: myDatabase },\n historyPath: '.repl-history'\n})"
        }
      ]
    }
  },
  "getters": {
    "isStarted": {
      "description": "Whether the REPL session is currently running.",
      "returns": "any"
    },
    "vmContext": {
      "description": "The VM context object used for evaluating expressions in the REPL.",
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
      "code": "const repl = container.feature('repl', { enable: true })\nawait repl.start({ context: { myVar: 42 } })"
    }
  ]
});

setBuildTimeData('features.googleMail', {
  "id": "features.googleMail",
  "description": "Google Mail feature for searching, reading, and watching Gmail messages. Depends on the googleAuth feature for authentication. Creates a Gmail v1 API client lazily. Supports Gmail search query syntax, individual message reading, and polling-based new mail detection with event emission.",
  "shortcut": "features.googleMail",
  "className": "GoogleMail",
  "methods": {
    "search": {
      "description": "Search for messages using Gmail query syntax and/or structured filters.",
      "parameters": {
        "options": {
          "type": "SearchMailOptions",
          "description": "Search filters including query, from, to, subject, date ranges",
          "properties": {
            "query": {
              "type": "string",
              "description": ""
            },
            "from": {
              "type": "string",
              "description": ""
            },
            "to": {
              "type": "string",
              "description": ""
            },
            "subject": {
              "type": "string",
              "description": ""
            },
            "after": {
              "type": "string",
              "description": ""
            },
            "before": {
              "type": "string",
              "description": ""
            },
            "hasAttachment": {
              "type": "boolean",
              "description": ""
            },
            "label": {
              "type": "string",
              "description": ""
            },
            "isUnread": {
              "type": "boolean",
              "description": ""
            },
            "maxResults": {
              "type": "number",
              "description": ""
            },
            "pageToken": {
              "type": "string",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<MailMessageList>"
    },
    "getMessage": {
      "description": "Get a single message by ID.",
      "parameters": {
        "messageId": {
          "type": "string",
          "description": "The message ID"
        },
        "format": {
          "type": "'full' | 'metadata' | 'minimal' | 'raw'",
          "description": "Message format (defaults to options.format or 'full')"
        }
      },
      "required": [
        "messageId"
      ],
      "returns": "Promise<MailMessage>"
    },
    "getThread": {
      "description": "Get a full thread with all its messages.",
      "parameters": {
        "threadId": {
          "type": "string",
          "description": "The thread ID"
        }
      },
      "required": [
        "threadId"
      ],
      "returns": "Promise<MailThread>"
    },
    "listLabels": {
      "description": "List all labels for the authenticated user.",
      "parameters": {},
      "required": [],
      "returns": "Promise<MailLabel[]>"
    },
    "startWatching": {
      "description": "Start watching for new mail by polling at a regular interval. Emits 'newMail' events with an array of new messages when they arrive. Uses Gmail history API to efficiently detect only new messages since the last check.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "stopWatching": {
      "description": "Stop watching for new mail.",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "auth": {
      "description": "Access the google-auth feature lazily.",
      "returns": "GoogleAuth"
    },
    "userId": {
      "description": "Default user ID from options or 'me'.",
      "returns": "string"
    },
    "defaultFormat": {
      "description": "Default message format from options or 'full'.",
      "returns": "'full' | 'metadata' | 'minimal' | 'raw'"
    },
    "pollInterval": {
      "description": "Polling interval from options or 30 seconds.",
      "returns": "number"
    }
  },
  "events": {
    "messagesFetched": {
      "name": "messagesFetched",
      "description": "Event emitted by GoogleMail",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by GoogleMail",
      "arguments": {}
    },
    "watchStarted": {
      "name": "watchStarted",
      "description": "Event emitted by GoogleMail",
      "arguments": {}
    },
    "watchStopped": {
      "name": "watchStopped",
      "description": "Event emitted by GoogleMail",
      "arguments": {}
    },
    "newMail": {
      "name": "newMail",
      "description": "Event emitted by GoogleMail",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const mail = container.feature('googleMail')\n\n// Search by sender\nconst fromBoss = await mail.search({ from: 'boss@company.com' })\n\n// Use Gmail query string\nconst unread = await mail.search({ query: 'is:unread category:primary' })\n\n// Read a specific message\nconst msg = await mail.getMessage('message-id-here')\n\n// Get a full thread\nconst thread = await mail.getThread('thread-id-here')\n\n// List labels\nconst labels = await mail.listLabels()\n\n// Watch for new mail (polls and emits 'newMail' events)\nmail.on('newMail', (messages) => {\n console.log(`Got ${messages.length} new messages!`)\n})\nawait mail.startWatching()\n\n// Stop watching\nmail.stopWatching()"
    }
  ],
  "types": {
    "SearchMailOptions": {
      "description": "",
      "properties": {
        "query": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "from": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "to": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "subject": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "after": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "before": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "hasAttachment": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "label": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "isUnread": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "maxResults": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "pageToken": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    },
    "MailMessageList": {
      "description": "",
      "properties": {
        "messages": {
          "type": "MailMessage[]",
          "description": ""
        },
        "nextPageToken": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "resultSizeEstimate": {
          "type": "number",
          "description": "",
          "optional": true
        }
      }
    },
    "MailMessage": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "threadId": {
          "type": "string",
          "description": ""
        },
        "labelIds": {
          "type": "string[]",
          "description": ""
        },
        "snippet": {
          "type": "string",
          "description": ""
        },
        "subject": {
          "type": "string",
          "description": ""
        },
        "from": {
          "type": "string",
          "description": ""
        },
        "to": {
          "type": "string",
          "description": ""
        },
        "cc": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "date": {
          "type": "string",
          "description": ""
        },
        "body": {
          "type": "string",
          "description": ""
        },
        "bodyHtml": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "isUnread": {
          "type": "boolean",
          "description": ""
        },
        "hasAttachments": {
          "type": "boolean",
          "description": ""
        },
        "attachments": {
          "type": "MailAttachment[]",
          "description": ""
        }
      }
    },
    "MailAttachment": {
      "description": "",
      "properties": {
        "filename": {
          "type": "string",
          "description": ""
        },
        "mimeType": {
          "type": "string",
          "description": ""
        },
        "size": {
          "type": "number",
          "description": ""
        },
        "attachmentId": {
          "type": "string",
          "description": ""
        }
      }
    },
    "MailThread": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "snippet": {
          "type": "string",
          "description": ""
        },
        "historyId": {
          "type": "string",
          "description": ""
        },
        "messages": {
          "type": "MailMessage[]",
          "description": ""
        }
      }
    },
    "MailLabel": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "type": {
          "type": "string",
          "description": ""
        },
        "messagesTotal": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "messagesUnread": {
          "type": "number",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.os', {
  "id": "features.os",
  "description": "The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.",
  "shortcut": "features.os",
  "className": "OS",
  "methods": {
    "whichCommand": {
      "description": "Resolve the absolute path to a binary using the platform's lookup command. Uses `where` on Windows, `which` on Unix. Returns the binary name as-is if resolution fails (so downstream code can still try the bare name).",
      "parameters": {
        "bin": {
          "type": "string",
          "description": "The binary name to look up (e.g. 'git', 'docker', 'ssh')"
        }
      },
      "required": [
        "bin"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const gitPath = os.whichCommand('git')\n// '/usr/bin/git' on macOS, 'C:\\Program Files\\Git\\cmd\\git.exe' on Windows"
        }
      ]
    },
    "getDisplayInfo": {
      "description": "Gets information about all connected displays. Platform-specific: currently implemented for macOS (darwin). Linux and Windows will throw with a clear \"not yet implemented\" message.",
      "parameters": {},
      "required": [],
      "returns": "DisplayInfo[]",
      "examples": [
        {
          "language": "ts",
          "code": "const displays = os.getDisplayInfo()\ndisplays.forEach(d => {\n console.log(`${d.name}: ${d.resolution.width}x${d.resolution.height}${d.retina ? ' (Retina)' : ''}`)\n})"
        }
      ]
    }
  },
  "getters": {
    "arch": {
      "description": "Gets the operating system CPU architecture.",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const arch = os.arch\nconsole.log(`Running on ${arch} architecture`)"
        }
      ]
    },
    "tmpdir": {
      "description": "Gets the operating system's default directory for temporary files.",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const tempDir = os.tmpdir\nconsole.log(`Temp directory: ${tempDir}`)"
        }
      ]
    },
    "homedir": {
      "description": "Gets the current user's home directory path.",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const home = os.homedir\nconsole.log(`User home: ${home}`)"
        }
      ]
    },
    "cpuCount": {
      "description": "Gets the number of logical CPU cores available on the system.",
      "returns": "number",
      "examples": [
        {
          "language": "ts",
          "code": "const cores = os.cpuCount\nconsole.log(`System has ${cores} CPU cores`)"
        }
      ]
    },
    "hostname": {
      "description": "Gets the hostname of the operating system.",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const hostname = os.hostname\nconsole.log(`Hostname: ${hostname}`)"
        }
      ]
    },
    "platform": {
      "description": "Gets the operating system platform.",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const platform = os.platform\nif (platform === 'darwin') {\n console.log('Running on macOS')\n}"
        }
      ]
    },
    "networkInterfaces": {
      "description": "Gets information about the system's network interfaces.",
      "returns": "NodeJS.Dict<os.NetworkInterfaceInfo[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const interfaces = os.networkInterfaces\nObject.keys(interfaces).forEach(name => {\n console.log(`Interface ${name}:`, interfaces[name])\n})"
        }
      ]
    },
    "macAddresses": {
      "description": "Gets an array of MAC addresses for non-internal IPv4 network interfaces. This filters the network interfaces to only include external IPv4 interfaces and returns their MAC addresses, which can be useful for system identification.",
      "returns": "string[]",
      "examples": [
        {
          "language": "ts",
          "code": "const macAddresses = os.macAddresses\nconsole.log(`External MAC addresses: ${macAddresses.join(', ')}`)"
        }
      ]
    },
    "isWindows": {
      "description": "Whether the current platform is Windows.",
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (os.isWindows) {\n console.log('Running on Windows')\n}"
        }
      ]
    },
    "isMac": {
      "description": "Whether the current platform is macOS.",
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (os.isMac) {\n console.log('Running on macOS')\n}"
        }
      ]
    },
    "isLinux": {
      "description": "Whether the current platform is Linux.",
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (os.isLinux) {\n console.log('Running on Linux')\n}"
        }
      ]
    },
    "shell": {
      "description": "The platform's default shell for executing command strings. Returns `cmd.exe` on Windows, `sh` on Unix.",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "// spawn a shell command cross-platform\nawait proc.spawnAndCapture(os.shell, [os.shellFlag, 'echo hello'])"
        }
      ]
    },
    "shellFlag": {
      "description": "The flag used to pass a command string to the platform shell. Returns `/c` on Windows, `-c` on Unix.",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "await proc.spawnAndCapture(os.shell, [os.shellFlag, command])"
        }
      ]
    },
    "pathSeparator": {
      "description": "The separator used in the PATH environment variable. Returns `;` on Windows, `:` on Unix.",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const dirs = process.env.PATH?.split(os.pathSeparator) ?? []"
        }
      ]
    },
    "cacheDir": {
      "description": "Platform-appropriate cache directory for luca. - Windows: `%LOCALAPPDATA%\\luca` - macOS/Linux: `~/.cache/luca` (respects `XDG_CACHE_HOME`)",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const cachePath = os.cacheDir\n// '/home/user/.cache/luca' on Linux\n// 'C:\\Users\\user\\AppData\\Local\\luca' on Windows"
        }
      ]
    },
    "configDir": {
      "description": "Platform-appropriate config directory for luca. - Windows: `%APPDATA%\\luca` - macOS: `~/.luca` - Linux: `~/.config/luca` (respects `XDG_CONFIG_HOME`)",
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const configPath = os.configDir"
        }
      ]
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const osInfo = container.feature('os')\n\nconsole.log(`Platform: ${osInfo.platform}`)\nconsole.log(`Architecture: ${osInfo.arch}`)\nconsole.log(`CPU cores: ${osInfo.cpuCount}`)\nconsole.log(`Home directory: ${osInfo.homedir}`)"
    }
  ],
  "types": {
    "DisplayInfo": {
      "description": "Information about a connected display.",
      "properties": {
        "name": {
          "type": "string",
          "description": ""
        },
        "resolution": {
          "type": "{ width: number; height: number }",
          "description": ""
        },
        "retina": {
          "type": "boolean",
          "description": ""
        },
        "main": {
          "type": "boolean",
          "description": ""
        },
        "refreshRate": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "connectionType": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.tts', {
  "id": "features.tts",
  "description": "TTS feature — synthesizes text to audio files via RunPod's Chatterbox Turbo endpoint. Generates high-quality speech audio by calling the Chatterbox Turbo public endpoint on RunPod, downloads the resulting audio, and saves it locally. Supports 20 preset voices and voice cloning via a reference audio URL.",
  "shortcut": "features.tts",
  "className": "TTS",
  "methods": {
    "synthesize": {
      "description": "Synthesize text to an audio file using Chatterbox Turbo. Calls the RunPod public endpoint, downloads the generated audio, and saves it to the output directory.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to synthesize into speech"
        },
        "options": {
          "type": "{\n    voice?: string\n    format?: 'wav' | 'flac' | 'ogg'\n    voiceUrl?: string\n  }",
          "description": "Override voice, format, or provide a voiceUrl for cloning"
        }
      },
      "required": [
        "text"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "// Use a preset voice\nconst path = await tts.synthesize('Good morning!', { voice: 'ethan' })\n\n// Clone a voice from a reference audio URL\nconst path = await tts.synthesize('Hello world', {\n voiceUrl: 'https://example.com/reference.wav'\n})"
        }
      ]
    }
  },
  "getters": {
    "apiKey": {
      "description": "RunPod API key from options or environment.",
      "returns": "string"
    },
    "outputDir": {
      "description": "Directory where generated audio files are saved.",
      "returns": "string"
    },
    "voices": {
      "description": "The 20 preset voice names available in Chatterbox Turbo.",
      "returns": "readonly string[]"
    }
  },
  "events": {
    "synthesized": {
      "name": "synthesized",
      "description": "Event emitted by TTS",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by TTS",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const tts = container.feature('tts', { enable: true })\nconst path = await tts.synthesize('Hello, how are you?', { voice: 'lucy' })\nconsole.log(`Audio saved to: ${path}`)"
    }
  ]
});

setBuildTimeData('features.grep', {
  "id": "features.grep",
  "description": "The Grep feature provides utilities for searching file contents using ripgrep (rg) or grep. Returns structured results as arrays of `{ file, line, column, content }` objects with paths relative to the container cwd. Also provides convenience methods for common search patterns.",
  "shortcut": "features.grep",
  "className": "Grep",
  "methods": {
    "search": {
      "description": "Search for a pattern in files and return structured results.",
      "parameters": {
        "options": {
          "type": "GrepOptions",
          "description": "Search options",
          "properties": {
            "pattern": {
              "type": "string",
              "description": "Pattern to search for (string or regex)"
            },
            "path": {
              "type": "string",
              "description": "Directory or file to search in (defaults to container cwd)"
            },
            "include": {
              "type": "string | string[]",
              "description": "Glob patterns to include (e.g. '*.ts')"
            },
            "exclude": {
              "type": "string | string[]",
              "description": "Glob patterns to exclude (e.g. 'node_modules')"
            },
            "ignoreCase": {
              "type": "boolean",
              "description": "Case insensitive search"
            },
            "fixedStrings": {
              "type": "boolean",
              "description": "Treat pattern as a fixed string, not regex"
            },
            "recursive": {
              "type": "boolean",
              "description": "Search recursively (default: true)"
            },
            "hidden": {
              "type": "boolean",
              "description": "Include hidden files"
            },
            "maxResults": {
              "type": "number",
              "description": "Max number of results to return"
            },
            "before": {
              "type": "number",
              "description": "Number of context lines before match"
            },
            "after": {
              "type": "number",
              "description": "Number of context lines after match"
            },
            "filesOnly": {
              "type": "boolean",
              "description": "Only return filenames, not match details"
            },
            "invert": {
              "type": "boolean",
              "description": "Invert match (return lines that don't match)"
            },
            "wordMatch": {
              "type": "boolean",
              "description": "Match whole words only"
            },
            "rawFlags": {
              "type": "string[]",
              "description": "Additional raw flags to pass to grep/ripgrep"
            }
          }
        }
      },
      "required": [
        "options"
      ],
      "returns": "Promise<GrepMatch[]>",
      "examples": [
        {
          "language": "ts",
          "code": "// Search for a pattern in TypeScript files\nconst results = await grep.search({\n pattern: 'useState',\n include: '*.tsx',\n exclude: 'node_modules'\n})\n\n// Case insensitive search with context\nconst results = await grep.search({\n pattern: 'error',\n ignoreCase: true,\n before: 2,\n after: 2\n})"
        }
      ]
    },
    "filesContaining": {
      "description": "Find files containing a pattern. Returns just the relative file paths.",
      "parameters": {
        "pattern": {
          "type": "string",
          "description": "The pattern to search for"
        },
        "options": {
          "type": "Omit<GrepOptions, 'pattern' | 'filesOnly'>",
          "description": "Additional search options"
        }
      },
      "required": [
        "pattern"
      ],
      "returns": "Promise<string[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const files = await grep.filesContaining('TODO')\n// ['src/index.ts', 'src/utils.ts']"
        }
      ]
    },
    "imports": {
      "description": "Find import/require statements for a module or path.",
      "parameters": {
        "moduleOrPath": {
          "type": "string",
          "description": "The module name or path to search for in imports"
        },
        "options": {
          "type": "Omit<GrepOptions, 'pattern'>",
          "description": "Additional search options"
        }
      },
      "required": [
        "moduleOrPath"
      ],
      "returns": "Promise<GrepMatch[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const lodashImports = await grep.imports('lodash')\nconst localImports = await grep.imports('./utils')"
        }
      ]
    },
    "definitions": {
      "description": "Find function, class, type, or variable definitions matching a name.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The identifier name to search for definitions of"
        },
        "options": {
          "type": "Omit<GrepOptions, 'pattern'>",
          "description": "Additional search options"
        }
      },
      "required": [
        "name"
      ],
      "returns": "Promise<GrepMatch[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const defs = await grep.definitions('MyComponent')\nconst classDefs = await grep.definitions('UserService')"
        }
      ]
    },
    "todos": {
      "description": "Find TODO, FIXME, HACK, and XXX comments.",
      "parameters": {
        "options": {
          "type": "Omit<GrepOptions, 'pattern'>",
          "description": "Additional search options"
        }
      },
      "required": [],
      "returns": "Promise<GrepMatch[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const todos = await grep.todos()\nconst fixmes = await grep.todos({ include: '*.ts' })"
        }
      ]
    },
    "count": {
      "description": "Count the number of matches for a pattern.",
      "parameters": {
        "pattern": {
          "type": "string",
          "description": "The pattern to count"
        },
        "options": {
          "type": "Omit<GrepOptions, 'pattern'>",
          "description": "Additional search options"
        }
      },
      "required": [
        "pattern"
      ],
      "returns": "Promise<number>",
      "examples": [
        {
          "language": "ts",
          "code": "const count = await grep.count('console.log')\nconsole.log(`Found ${count} console.log statements`)"
        }
      ]
    },
    "findForReplace": {
      "description": "Search and replace across files. Returns the list of files that would be affected. Does NOT modify files — use the returned file list to do the replacement yourself.",
      "parameters": {
        "pattern": {
          "type": "string",
          "description": "The pattern to search for"
        },
        "options": {
          "type": "Omit<GrepOptions, 'pattern'>",
          "description": "Additional search options"
        }
      },
      "required": [
        "pattern"
      ],
      "returns": "Promise<{ file: string, matches: GrepMatch[] }[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const affected = await grep.findForReplace('oldFunctionName')\n// [{ file: 'src/a.ts', matches: [...] }, { file: 'src/b.ts', matches: [...] }]"
        }
      ]
    }
  },
  "getters": {
    "hasRipgrep": {
      "description": "Whether ripgrep (rg) is available on this system",
      "returns": "boolean"
    },
    "rgPath": {
      "description": "Resolved path to the rg binary",
      "returns": "string"
    },
    "grepPath": {
      "description": "Resolved path to the grep binary",
      "returns": "string"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const grep = container.feature('grep')\n\n// Basic search\nconst results = await grep.search({ pattern: 'TODO' })\n// [{ file: 'src/index.ts', line: 42, column: 5, content: '// TODO: fix this' }, ...]\n\n// Find all imports of a module\nconst imports = await grep.imports('lodash')\n\n// Find function/class/variable definitions\nconst defs = await grep.definitions('MyClass')\n\n// Just get filenames containing a pattern\nconst files = await grep.filesContaining('API_KEY')"
    }
  ],
  "types": {
    "GrepOptions": {
      "description": "",
      "properties": {
        "pattern": {
          "type": "string",
          "description": "Pattern to search for (string or regex)"
        },
        "path": {
          "type": "string",
          "description": "Directory or file to search in (defaults to container cwd)",
          "optional": true
        },
        "include": {
          "type": "string | string[]",
          "description": "Glob patterns to include (e.g. '*.ts')",
          "optional": true
        },
        "exclude": {
          "type": "string | string[]",
          "description": "Glob patterns to exclude (e.g. 'node_modules')",
          "optional": true
        },
        "ignoreCase": {
          "type": "boolean",
          "description": "Case insensitive search",
          "optional": true
        },
        "fixedStrings": {
          "type": "boolean",
          "description": "Treat pattern as a fixed string, not regex",
          "optional": true
        },
        "recursive": {
          "type": "boolean",
          "description": "Search recursively (default: true)",
          "optional": true
        },
        "hidden": {
          "type": "boolean",
          "description": "Include hidden files",
          "optional": true
        },
        "maxResults": {
          "type": "number",
          "description": "Max number of results to return",
          "optional": true
        },
        "before": {
          "type": "number",
          "description": "Number of context lines before match",
          "optional": true
        },
        "after": {
          "type": "number",
          "description": "Number of context lines after match",
          "optional": true
        },
        "filesOnly": {
          "type": "boolean",
          "description": "Only return filenames, not match details",
          "optional": true
        },
        "invert": {
          "type": "boolean",
          "description": "Invert match (return lines that don't match)",
          "optional": true
        },
        "wordMatch": {
          "type": "boolean",
          "description": "Match whole words only",
          "optional": true
        },
        "rawFlags": {
          "type": "string[]",
          "description": "Additional raw flags to pass to grep/ripgrep",
          "optional": true
        }
      }
    },
    "GrepMatch": {
      "description": "",
      "properties": {
        "file": {
          "type": "string",
          "description": ""
        },
        "line": {
          "type": "number",
          "description": ""
        },
        "column": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "content": {
          "type": "string",
          "description": ""
        }
      }
    }
  }
});

setBuildTimeData('features.googleAuth', {
  "id": "features.googleAuth",
  "description": "Google authentication feature supporting OAuth2 browser flow and service account auth. Handles the complete OAuth2 lifecycle: authorization URL generation, local callback server, token exchange, refresh token storage (via diskCache), and automatic token refresh. Also supports non-interactive service account authentication via JSON key files. Other Google features (drive, sheets, calendar, docs) depend on this feature and access it lazily via `container.feature('googleAuth')`.",
  "shortcut": "features.googleAuth",
  "className": "GoogleAuth",
  "methods": {
    "getOAuth2Client": {
      "description": "Get the OAuth2Client instance, creating it lazily. After authentication, this client has valid credentials set.",
      "parameters": {},
      "required": [],
      "returns": "OAuth2Client"
    },
    "getAuthClient": {
      "description": "Get the authenticated auth client for passing to googleapis service constructors. Handles token refresh automatically for OAuth2. For service accounts, returns the JWT auth client.",
      "parameters": {},
      "required": [],
      "returns": "Promise<OAuth2Client | ReturnType<typeof google.auth.fromJSON>>"
    },
    "authorize": {
      "description": "Start the OAuth2 authorization flow. 1. Spins up a temporary Express callback server on a free port 2. Generates the Google authorization URL 3. Opens the browser to the consent page 4. Waits for the callback with the authorization code 5. Exchanges the code for access + refresh tokens 6. Stores the refresh token in diskCache 7. Shuts down the callback server",
      "parameters": {
        "scopes": {
          "type": "string[]",
          "description": "OAuth2 scopes to request (defaults to options.scopes or defaultScopes)"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "authenticateServiceAccount": {
      "description": "Authenticate using a service account JSON key file. Reads the key from options.serviceAccountKeyPath, options.serviceAccountKey, or the GOOGLE_SERVICE_ACCOUNT_KEY env var.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "tryRestoreTokens": {
      "description": "Attempt to restore authentication from a cached refresh token. Called automatically by getAuthClient() if not yet authenticated.",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>"
    },
    "revoke": {
      "description": "Revoke the current credentials and clear cached tokens.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    }
  },
  "getters": {
    "clientId": {
      "description": "OAuth2 client ID from options or GOOGLE_CLIENT_ID env var.",
      "returns": "string"
    },
    "clientSecret": {
      "description": "OAuth2 client secret from options or GOOGLE_CLIENT_SECRET env var.",
      "returns": "string"
    },
    "authMode": {
      "description": "Resolved authentication mode based on options.",
      "returns": "'oauth2' | 'service-account'"
    },
    "isAuthenticated": {
      "description": "Whether valid credentials are currently available.",
      "returns": "boolean"
    },
    "defaultScopes": {
      "description": "Default scopes covering Drive, Sheets, Calendar, and Docs read access.",
      "returns": "string[]"
    },
    "redirectPort": {
      "description": "Resolved redirect port from options, GOOGLE_OAUTH_REDIRECT_PORT env var, or default 3000.",
      "returns": "number"
    },
    "tokenCacheKey": {
      "description": "DiskCache key used for storing the refresh token.",
      "returns": "string"
    }
  },
  "events": {
    "tokenRefreshed": {
      "name": "tokenRefreshed",
      "description": "Event emitted by GoogleAuth",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by GoogleAuth",
      "arguments": {}
    },
    "authorizationRequired": {
      "name": "authorizationRequired",
      "description": "Event emitted by GoogleAuth",
      "arguments": {}
    },
    "authenticated": {
      "name": "authenticated",
      "description": "Event emitted by GoogleAuth",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "// OAuth2 flow — opens browser for consent\nconst auth = container.feature('googleAuth', {\n clientId: 'your-client-id.apps.googleusercontent.com',\n clientSecret: 'your-secret',\n scopes: ['https://www.googleapis.com/auth/drive.readonly'],\n})\nawait auth.authorize()\n\n// Service account flow — no browser needed\nconst auth = container.feature('googleAuth', {\n serviceAccountKeyPath: '/path/to/key.json',\n scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],\n})\nawait auth.authenticateServiceAccount()"
    }
  ]
});

setBuildTimeData('features.sqlite', {
  "id": "features.sqlite",
  "description": "SQLite feature for safe SQL execution through Bun's native sqlite binding. Supports: - parameterized query execution (`query` / `execute`) - tagged-template query execution (`sql`) to avoid manual placeholder wiring",
  "shortcut": "features.sqlite",
  "className": "Sqlite",
  "methods": {
    "query": {
      "description": "Executes a SELECT-like query and returns result rows. Use sqlite placeholders (`?`) for `params`.",
      "parameters": {
        "queryText": {
          "type": "string",
          "description": "The SQL query string with optional `?` placeholders"
        },
        "params": {
          "type": "SqlValue[]",
          "description": "Ordered array of values to bind to the placeholders"
        }
      },
      "required": [
        "queryText"
      ],
      "returns": "Promise<T[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const db = container.feature('sqlite', { path: 'app.db' })\nconst users = await db.query<{ id: number; email: string }>(\n 'SELECT id, email FROM users WHERE active = ?',\n [1]\n)"
        }
      ]
    },
    "execute": {
      "description": "Executes a write/update/delete statement and returns metadata. Use sqlite placeholders (`?`) for `params`.",
      "parameters": {
        "queryText": {
          "type": "string",
          "description": "The SQL statement string with optional `?` placeholders"
        },
        "params": {
          "type": "SqlValue[]",
          "description": "Ordered array of values to bind to the placeholders"
        }
      },
      "required": [
        "queryText"
      ],
      "returns": "Promise<{ changes: number; lastInsertRowid: number | bigint | null }>",
      "examples": [
        {
          "language": "ts",
          "code": "const db = container.feature('sqlite', { path: 'app.db' })\nconst { changes, lastInsertRowid } = await db.execute(\n 'INSERT INTO users (email) VALUES (?)',\n ['hello@example.com']\n)\nconsole.log(`Inserted row ${lastInsertRowid}, ${changes} change(s)`)"
        }
      ]
    },
    "sql": {
      "description": "Safe tagged-template SQL helper. Values become bound parameters automatically, preventing SQL injection.",
      "parameters": {
        "strings": {
          "type": "TemplateStringsArray",
          "description": "Template literal string segments"
        },
        "values": {
          "type": "SqlValue[]",
          "description": "Interpolated values that become bound `?` parameters"
        }
      },
      "required": [
        "strings",
        "values"
      ],
      "returns": "Promise<T[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const db = container.feature('sqlite', { path: 'app.db' })\nconst email = 'hello@example.com'\nconst rows = await db.sql<{ id: number }>`\n SELECT id FROM users WHERE email = ${email}\n`"
        }
      ]
    },
    "close": {
      "description": "Closes the sqlite database and updates feature state. Emits `closed` after the database handle is released.",
      "parameters": {},
      "required": [],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const db = container.feature('sqlite', { path: 'app.db' })\n// ... run queries ...\ndb.close()"
        }
      ]
    }
  },
  "getters": {
    "db": {
      "description": "Returns the underlying Bun sqlite database instance.",
      "returns": "any"
    }
  },
  "events": {
    "query": {
      "name": "query",
      "description": "Event emitted by Sqlite",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by Sqlite",
      "arguments": {}
    },
    "execute": {
      "name": "execute",
      "description": "Event emitted by Sqlite",
      "arguments": {}
    },
    "closed": {
      "name": "closed",
      "description": "Event emitted by Sqlite",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const sqlite = container.feature('sqlite', { path: 'data/app.db' })\n\nawait sqlite.execute(\n 'create table if not exists users (id integer primary key, email text not null unique)'\n)\n\nawait sqlite.execute('insert into users (email) values (?)', ['hello@example.com'])\n\nconst users = await sqlite.sql<{ id: number; email: string }>`\n select id, email from users where email = ${'hello@example.com'}\n`"
    }
  ]
});

setBuildTimeData('features.docker', {
  "id": "features.docker",
  "description": "Docker CLI interface feature for managing containers, images, and executing Docker commands. Provides comprehensive Docker operations including: - Container management (list, start, stop, create, remove) - Image management (list, pull, build, remove) - Command execution inside containers - Docker system information",
  "shortcut": "features.docker",
  "className": "Docker",
  "methods": {
    "checkDockerAvailability": {
      "description": "Check if Docker is available and working.",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "const available = await docker.checkDockerAvailability()\nif (!available) console.log('Docker is not installed or not running')"
        }
      ]
    },
    "listContainers": {
      "description": "List all containers (running and stopped).",
      "parameters": {
        "options": {
          "type": "{ all?: boolean }",
          "description": "Listing options",
          "properties": {
            "all": {
              "type": "any",
              "description": "Include stopped containers (default: false)"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<DockerContainer[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const running = await docker.listContainers()\nconst all = await docker.listContainers({ all: true })"
        }
      ]
    },
    "listImages": {
      "description": "List all images available locally.",
      "parameters": {},
      "required": [],
      "returns": "Promise<DockerImage[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const images = await docker.listImages()\nconsole.log(images.map(i => `${i.repository}:${i.tag}`))"
        }
      ]
    },
    "startContainer": {
      "description": "Start a stopped container.",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Container ID or name to start"
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await docker.startContainer('my-app')"
        }
      ]
    },
    "stopContainer": {
      "description": "Stop a running container.",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Container ID or name to stop"
        },
        "timeout": {
          "type": "number",
          "description": "Seconds to wait before killing the container"
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await docker.stopContainer('my-app')\nawait docker.stopContainer('my-app', 30) // wait up to 30s"
        }
      ]
    },
    "removeContainer": {
      "description": "Remove a container.",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Container ID or name to remove"
        },
        "options": {
          "type": "{ force?: boolean }",
          "description": "Removal options",
          "properties": {
            "force": {
              "type": "any",
              "description": "Force removal of a running container"
            }
          }
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await docker.removeContainer('old-container')\nawait docker.removeContainer('stubborn-container', { force: true })"
        }
      ]
    },
    "runContainer": {
      "description": "Create and run a new container from the given image.",
      "parameters": {
        "image": {
          "type": "string",
          "description": "Docker image to run (e.g. 'nginx:latest')"
        },
        "options": {
          "type": "{\n      /** Assign a name to the container */\n      name?: string\n      /** Port mappings in 'host:container' format */\n      ports?: string[]\n      /** Volume mounts in 'host:container' format */\n      volumes?: string[]\n      /** Environment variables as key-value pairs */\n      environment?: Record<string, string>\n      /** Run the container in the background */\n      detach?: boolean\n      /** Keep STDIN open */\n      interactive?: boolean\n      /** Allocate a pseudo-TTY */\n      tty?: boolean\n      /** Command and arguments to run inside the container */\n      command?: string[]\n      /** Working directory inside the container */\n      workdir?: string\n      /** Username or UID to run as */\n      user?: string\n      /** Override the default entrypoint */\n      entrypoint?: string\n      /** Connect the container to a network */\n      network?: string\n      /** Restart policy (e.g. 'always', 'on-failure') */\n      restart?: string\n    }",
          "description": "Container run options",
          "properties": {
            "name": {
              "type": "any",
              "description": "Assign a name to the container"
            },
            "ports": {
              "type": "any",
              "description": "Port mappings in 'host:container' format (e.g. ['8080:80'])"
            },
            "volumes": {
              "type": "any",
              "description": "Volume mounts in 'host:container' format (e.g. ['./data:/app/data'])"
            },
            "environment": {
              "type": "any",
              "description": "Environment variables as key-value pairs"
            },
            "detach": {
              "type": "any",
              "description": "Run the container in the background"
            },
            "interactive": {
              "type": "any",
              "description": "Keep STDIN open"
            },
            "tty": {
              "type": "any",
              "description": "Allocate a pseudo-TTY"
            },
            "command": {
              "type": "any",
              "description": "Command and arguments to run inside the container"
            },
            "workdir": {
              "type": "any",
              "description": "Working directory inside the container"
            },
            "user": {
              "type": "any",
              "description": "Username or UID to run as"
            },
            "entrypoint": {
              "type": "any",
              "description": "Override the default entrypoint"
            },
            "network": {
              "type": "any",
              "description": "Connect the container to a network"
            },
            "restart": {
              "type": "any",
              "description": "Restart policy (e.g. 'always', 'on-failure')"
            }
          }
        }
      },
      "required": [
        "image"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const containerId = await docker.runContainer('nginx:latest', {\n name: 'web',\n ports: ['8080:80'],\n detach: true,\n environment: { NODE_ENV: 'production' }\n})"
        }
      ]
    },
    "execCommand": {
      "description": "Execute a command inside a running container. When volumes are specified, uses `docker run --rm` with the container's image instead of `docker exec`, since exec does not support volume mounts.",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Container ID or name to execute in"
        },
        "command": {
          "type": "string[]",
          "description": "Command and arguments array (e.g. ['ls', '-la'])"
        },
        "options": {
          "type": "{\n      /** Keep STDIN open */\n      interactive?: boolean\n      /** Allocate a pseudo-TTY */\n      tty?: boolean\n      /** Username or UID to run as */\n      user?: string\n      /** Working directory inside the container */\n      workdir?: string\n      /** Run the command in the background */\n      detach?: boolean\n      /** Environment variables as key-value pairs */\n      environment?: Record<string, string>\n      /** Volume mounts; triggers a docker run --rm fallback */\n      volumes?: string[]\n    }",
          "description": "Execution options",
          "properties": {
            "interactive": {
              "type": "any",
              "description": "Keep STDIN open"
            },
            "tty": {
              "type": "any",
              "description": "Allocate a pseudo-TTY"
            },
            "user": {
              "type": "any",
              "description": "Username or UID to run as"
            },
            "workdir": {
              "type": "any",
              "description": "Working directory inside the container"
            },
            "detach": {
              "type": "any",
              "description": "Run the command in the background"
            },
            "environment": {
              "type": "any",
              "description": "Environment variables as key-value pairs"
            },
            "volumes": {
              "type": "any",
              "description": "Volume mounts; triggers a docker run --rm fallback"
            }
          }
        }
      },
      "required": [
        "containerIdOrName",
        "command"
      ],
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>",
      "examples": [
        {
          "language": "ts",
          "code": "const result = await docker.execCommand('my-app', ['ls', '-la', '/app'])\nconsole.log(result.stdout)"
        }
      ]
    },
    "createShell": {
      "description": "Create a shell-like wrapper for executing multiple commands against a container. When volume mounts are specified, a new long-running container is created from the same image with the mounts applied (since docker exec does not support volumes). Call `destroy()` when finished to clean up the helper container. Returns an object with: - `run(command)` — execute a shell command string via `sh -c` - `last` — getter for the most recent command result - `destroy()` — stop the helper container (no-op when no volumes were needed)",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Parameter containerIdOrName"
        },
        "options": {
          "type": "{\n      volumes?: string[]\n      workdir?: string\n      user?: string\n      environment?: Record<string, string>\n    }",
          "description": "Parameter options"
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<DockerShell>"
    },
    "pullImage": {
      "description": "Pull an image from a registry.",
      "parameters": {
        "image": {
          "type": "string",
          "description": "Full image reference (e.g. 'nginx:latest', 'ghcr.io/org/repo:tag')"
        }
      },
      "required": [
        "image"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await docker.pullImage('node:20-alpine')"
        }
      ]
    },
    "removeImage": {
      "description": "Remove an image from the local store.",
      "parameters": {
        "imageIdOrName": {
          "type": "string",
          "description": "Image ID, repository, or repository:tag to remove"
        },
        "options": {
          "type": "{ force?: boolean }",
          "description": "Removal options",
          "properties": {
            "force": {
              "type": "any",
              "description": "Force removal even if the image is in use"
            }
          }
        }
      },
      "required": [
        "imageIdOrName"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await docker.removeImage('nginx:latest')\nawait docker.removeImage('old-image', { force: true })"
        }
      ]
    },
    "buildImage": {
      "description": "Build an image from a Dockerfile.",
      "parameters": {
        "contextPath": {
          "type": "string",
          "description": "Path to the build context directory"
        },
        "options": {
          "type": "{\n      /** Tag the resulting image (e.g. 'my-app:latest') */\n      tag?: string\n      /** Path to an alternate Dockerfile */\n      dockerfile?: string\n      /** Build-time variables as key-value pairs */\n      buildArgs?: Record<string, string>\n      /** Target build stage in a multi-stage Dockerfile */\n      target?: string\n      /** Do not use cache when building the image */\n      nocache?: boolean\n    }",
          "description": "Build options",
          "properties": {
            "tag": {
              "type": "any",
              "description": "Tag the resulting image (e.g. 'my-app:latest')"
            },
            "dockerfile": {
              "type": "any",
              "description": "Path to an alternate Dockerfile"
            },
            "buildArgs": {
              "type": "any",
              "description": "Build-time variables as key-value pairs"
            },
            "target": {
              "type": "any",
              "description": "Target build stage in a multi-stage Dockerfile"
            },
            "nocache": {
              "type": "any",
              "description": "Do not use cache when building the image"
            }
          }
        }
      },
      "required": [
        "contextPath"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await docker.buildImage('./project', {\n tag: 'my-app:latest',\n buildArgs: { NODE_ENV: 'production' }\n})"
        }
      ]
    },
    "getLogs": {
      "description": "Get container logs.",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Container ID or name to fetch logs from"
        },
        "options": {
          "type": "{\n      /** Follow log output (stream) */\n      follow?: boolean\n      /** Number of lines to show from the end of the logs */\n      tail?: number\n      /** Show logs since a timestamp or relative time */\n      since?: string\n      /** Prepend a timestamp to each log line */\n      timestamps?: boolean\n    }",
          "description": "Log retrieval options",
          "properties": {
            "follow": {
              "type": "any",
              "description": "Follow log output (stream)"
            },
            "tail": {
              "type": "any",
              "description": "Number of lines to show from the end of the logs"
            },
            "since": {
              "type": "any",
              "description": "Show logs since a timestamp or relative time (e.g. '10m', '2024-01-01T00:00:00')"
            },
            "timestamps": {
              "type": "any",
              "description": "Prepend a timestamp to each log line"
            }
          }
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const logs = await docker.getLogs('my-app', { tail: 100, timestamps: true })\nconsole.log(logs)"
        }
      ]
    },
    "getSystemInfo": {
      "description": "Get Docker system information (engine version, storage driver, OS, etc.).",
      "parameters": {},
      "required": [],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "const info = await docker.getSystemInfo()\nconsole.log(info.ServerVersion)"
        }
      ]
    },
    "prune": {
      "description": "Prune unused Docker resources. When no specific resource type is selected, falls back to `docker system prune`.",
      "parameters": {
        "options": {
          "type": "{\n    /** Prune stopped containers */\n    containers?: boolean\n    /** Prune dangling images */\n    images?: boolean\n    /** Prune unused volumes */\n    volumes?: boolean\n    /** Prune unused networks */\n    networks?: boolean\n    /** Prune all resource types */\n    all?: boolean\n    /** Skip confirmation prompts for image pruning */\n    force?: boolean\n  }",
          "description": "Pruning options",
          "properties": {
            "containers": {
              "type": "any",
              "description": "Prune stopped containers"
            },
            "images": {
              "type": "any",
              "description": "Prune dangling images"
            },
            "volumes": {
              "type": "any",
              "description": "Prune unused volumes"
            },
            "networks": {
              "type": "any",
              "description": "Prune unused networks"
            },
            "all": {
              "type": "any",
              "description": "Prune all resource types (containers, images, volumes, networks)"
            },
            "force": {
              "type": "any",
              "description": "Skip confirmation prompts for image pruning"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await docker.prune({ all: true })\nawait docker.prune({ containers: true, images: true })"
        }
      ]
    },
    "enable": {
      "description": "Initialize the Docker feature by checking availability and optionally refreshing state.",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Enable options passed to the base Feature"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    }
  },
  "getters": {
    "proc": {
      "description": "",
      "returns": "any"
    },
    "dockerPath": {
      "description": "Resolve the docker binary path, caching the result. Options take precedence.",
      "returns": "string"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const docker = container.feature('docker', { enable: true })\nawait docker.checkDockerAvailability()\nconst containers = await docker.listContainers({ all: true })"
    }
  ],
  "types": {
    "DockerShell": {
      "description": "Shell-like interface for executing commands against a Docker container",
      "properties": {
        "containerId": {
          "type": "string",
          "description": "The ID of the container being targeted"
        },
        "last": {
          "type": "{ stdout: string; stderr: string; exitCode: number } | null",
          "description": "The result of the most recently executed command, or null if no command has been run"
        }
      }
    }
  }
});

setBuildTimeData('features.transpiler', {
  "id": "features.transpiler",
  "description": "Transpile TypeScript, TSX, and JSX to JavaScript at runtime using Bun's built-in transpiler. Compile code strings on the fly without touching the filesystem or spawning external processes.",
  "shortcut": "features.transpiler",
  "className": "Transpiler",
  "methods": {
    "transformSync": {
      "description": "Transform code synchronously",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The code to transform"
        },
        "options": {
          "type": "TransformOptions",
          "description": "Transform options (loader, format, minify)",
          "properties": {
            "loader": {
              "type": "'ts' | 'tsx' | 'jsx' | 'js'",
              "description": ""
            },
            "format": {
              "type": "'esm' | 'cjs'",
              "description": ""
            },
            "minify": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "code"
      ],
      "returns": "TransformResult"
    },
    "transform": {
      "description": "Transform code asynchronously",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The code to transform"
        },
        "options": {
          "type": "TransformOptions",
          "description": "Transform options (loader, format, minify)",
          "properties": {
            "loader": {
              "type": "'ts' | 'tsx' | 'jsx' | 'js'",
              "description": ""
            },
            "format": {
              "type": "'esm' | 'cjs'",
              "description": ""
            },
            "minify": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "code"
      ],
      "returns": "Promise<TransformResult>"
    },
    "bundle": {
      "description": "Bundle a file using Bun.build, inlining all imports except those marked external. Returns CJS code ready for VM execution.",
      "parameters": {
        "filePath": {
          "type": "string",
          "description": "Absolute path to the entrypoint file"
        },
        "external": {
          "type": "string[]",
          "description": "Module IDs to leave as require() calls (e.g. virtual modules)"
        }
      },
      "required": [
        "filePath"
      ],
      "returns": "Promise<string>"
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
      "code": "const transpiler = container.feature('transpiler')\nconst result = transpiler.transformSync('const x: number = 1')\nconsole.log(result.code) // 'const x = 1;\\n'"
    }
  ],
  "types": {
    "TransformOptions": {
      "description": "",
      "properties": {
        "loader": {
          "type": "'ts' | 'tsx' | 'jsx' | 'js'",
          "description": "",
          "optional": true
        },
        "format": {
          "type": "'esm' | 'cjs'",
          "description": "",
          "optional": true
        },
        "minify": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    },
    "TransformResult": {
      "description": "",
      "properties": {
        "code": {
          "type": "string",
          "description": ""
        },
        "map": {
          "type": "string",
          "description": ""
        },
        "warnings": {
          "type": "any[]",
          "description": ""
        }
      }
    }
  }
});

setBuildTimeData('features.yaml', {
  "id": "features.yaml",
  "description": "The YAML feature provides utilities for parsing and stringifying YAML data. This feature wraps the js-yaml library to provide convenient methods for converting between YAML strings and JavaScript objects. It's automatically attached to Node containers for easy access.",
  "shortcut": "features.yaml",
  "className": "YAML",
  "methods": {
    "stringify": {
      "description": "Converts a JavaScript object to a YAML string. This method serializes JavaScript data structures into YAML format, which is human-readable and commonly used for configuration files.",
      "parameters": {
        "data": {
          "type": "any",
          "description": "The data to convert to YAML format"
        }
      },
      "required": [
        "data"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const config = {\n name: 'MyApp',\n version: '1.0.0',\n settings: {\n   debug: true,\n   ports: [3000, 3001]\n }\n}\n\nconst yamlString = yaml.stringify(config)\nconsole.log(yamlString)\n// Output:\n// name: MyApp\n// version: 1.0.0\n// settings:\n//   debug: true\n//   ports:\n//     - 3000\n//     - 3001"
        }
      ]
    },
    "parse": {
      "description": "Parses a YAML string into a JavaScript object. This method deserializes YAML content into JavaScript data structures. It supports all standard YAML features including nested objects, arrays, and various data types.",
      "parameters": {
        "yamlStr": {
          "type": "string",
          "description": "The YAML string to parse"
        }
      },
      "required": [
        "yamlStr"
      ],
      "returns": "T",
      "examples": [
        {
          "language": "ts",
          "code": "const yamlContent = `\n name: MyApp\n version: 1.0.0\n settings:\n   debug: true\n   ports:\n     - 3000\n     - 3001\n`\n\n// Parse with type inference\nconst config = yaml.parse(yamlContent)\nconsole.log(config.name) // 'MyApp'\n\n// Parse with explicit typing\ninterface AppConfig {\n name: string\n version: string\n settings: {\n   debug: boolean\n   ports: number[]\n }\n}\n\nconst typedConfig = yaml.parse<AppConfig>(yamlContent)\nconsole.log(typedConfig.settings.ports) // [3000, 3001]"
        }
      ]
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
      "code": "const yamlFeature = container.feature('yaml')\n\n// Parse YAML string to object\nconst config = yamlFeature.parse(`\n name: MyApp\n version: 1.0.0\n settings:\n   debug: true\n`)\n\n// Convert object to YAML string\nconst yamlString = yamlFeature.stringify(config)\nconsole.log(yamlString)"
    }
  ]
});

setBuildTimeData('features.nlp', {
  "id": "features.nlp",
  "description": "The NLP feature provides natural language processing utilities for parsing utterances into structured data. Combines two complementary libraries: - **compromise**: Verb normalization (toInfinitive), POS pattern matching - **wink-nlp**: High-accuracy POS tagging (~95%), named entity recognition Three methods at increasing levels of detail: - `parse()` — compromise-powered quick structure + verb normalization - `analyze()` — wink-powered high-accuracy POS + entity extraction - `understand()` — combined parse + analyze merged",
  "shortcut": "features.nlp",
  "className": "NLP",
  "methods": {
    "parse": {
      "description": "Parse an utterance into structured command data using compromise. Extracts intent (normalized verb), target noun, prepositional subject, and modifiers.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The raw utterance to parse"
        }
      },
      "required": [
        "text"
      ],
      "returns": "ParsedCommand",
      "examples": [
        {
          "language": "ts",
          "code": "nlp.parse(\"open the terminal\")\n// { intent: \"open\", target: \"terminal\", subject: null, modifiers: [], raw: \"open the terminal\" }\n\nnlp.parse(\"draw a diagram of the auth flow\")\n// { intent: \"draw\", target: \"diagram\", subject: \"auth flow\", modifiers: [], raw: \"...\" }"
        }
      ]
    },
    "analyze": {
      "description": "Analyze text with high-accuracy POS tagging and named entity recognition using wink-nlp.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to analyze"
        }
      },
      "required": [
        "text"
      ],
      "returns": "Analysis",
      "examples": [
        {
          "language": "ts",
          "code": "nlp.analyze(\"meet john at 3pm about the deployment\")\n// { tokens: [{value:\"meet\",pos:\"VERB\"}, {value:\"john\",pos:\"PROPN\"}, ...],\n//   entities: [{value:\"john\",type:\"PERSON\"}, {value:\"3pm\",type:\"TIME\"}],\n//   raw: \"meet john at 3pm about the deployment\" }"
        }
      ]
    },
    "understand": {
      "description": "Full understanding: combines compromise parsing with wink-nlp analysis. Returns intent, target, subject, modifiers (from parse) plus tokens and entities (from analyze).",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to understand"
        }
      },
      "required": [
        "text"
      ],
      "returns": "ParsedCommand & Analysis",
      "examples": [
        {
          "language": "ts",
          "code": "nlp.understand(\"draw a diagram of the auth flow\")\n// { intent: \"draw\", target: \"diagram\", subject: \"auth flow\", modifiers: [],\n//   tokens: [{value:\"draw\",pos:\"VERB\"}, ...], entities: [...], raw: \"...\" }"
        }
      ]
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
      "code": "const nlp = container.feature('nlp', { enable: true })\n\nnlp.parse(\"draw a diagram of the auth flow\")\n// { intent: \"draw\", target: \"diagram\", subject: \"auth flow\", modifiers: [], raw: \"...\" }\n\nnlp.analyze(\"meet john at 3pm about the deployment\")\n// { tokens: [{value:\"meet\",pos:\"VERB\"}, ...], entities: [{value:\"john\",type:\"PERSON\"}, ...] }\n\nnlp.understand(\"draw a diagram of the auth flow\")\n// { intent, target, subject, modifiers, tokens, entities, raw }"
    }
  ]
});

setBuildTimeData('features.networking', {
  "id": "features.networking",
  "description": "The Networking feature provides utilities for network-related operations. This feature includes utilities for port detection and availability checking, which are commonly needed when setting up servers or network services.",
  "shortcut": "features.networking",
  "className": "Networking",
  "methods": {
    "findOpenPort": {
      "description": "Finds the next available port starting from the specified port number. This method will search for the first available port starting from the given port number. If the specified port is available, it returns that port. Otherwise, it returns the next available port.",
      "parameters": {
        "startAt": {
          "type": "any",
          "description": "The port number to start searching from (0 means system will choose)"
        }
      },
      "required": [],
      "returns": "Promise<number>",
      "examples": [
        {
          "language": "ts",
          "code": "// Find any available port\nconst anyPort = await networking.findOpenPort()\n\n// Find an available port starting from 3000\nconst port = await networking.findOpenPort(3000)\nconsole.log(`Server can use port: ${port}`)"
        }
      ]
    },
    "isPortOpen": {
      "description": "Checks if a specific port is available for use. This method attempts to detect if the specified port is available. It returns true if the port is available, false if it's already in use.",
      "parameters": {
        "checkPort": {
          "type": "any",
          "description": "The port number to check for availability"
        }
      },
      "required": [],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "// Check if port 8080 is available\nconst isAvailable = await networking.isPortOpen(8080)\nif (isAvailable) {\n console.log('Port 8080 is free to use')\n} else {\n console.log('Port 8080 is already in use')\n}"
        }
      ]
    },
    "getLocalNetworks": {
      "description": "Returns local external IPv4 interfaces and their CIDR ranges.",
      "parameters": {},
      "required": [],
      "returns": "LocalNetwork[]"
    },
    "expandCidr": {
      "description": "Expands a CIDR block to host IP addresses. For /31 and /32, all addresses are returned. For all others, network/broadcast are excluded.",
      "parameters": {
        "cidr": {
          "type": "string",
          "description": "Parameter cidr"
        }
      },
      "required": [
        "cidr"
      ],
      "returns": "string[]"
    },
    "getArpTable": {
      "description": "Reads and parses the system ARP cache.",
      "parameters": {},
      "required": [],
      "returns": "Promise<ArpEntry[]>"
    },
    "isHostReachable": {
      "description": "Performs a lightweight TCP reachability probe.",
      "parameters": {
        "host": {
          "type": "string",
          "description": "Parameter host"
        },
        "options": {
          "type": "ReachableHostOptions",
          "description": "Parameter options",
          "properties": {
            "timeout": {
              "type": "number",
              "description": ""
            },
            "ports": {
              "type": "number[]",
              "description": ""
            }
          }
        }
      },
      "required": [
        "host"
      ],
      "returns": "Promise<boolean>"
    },
    "discoverHosts": {
      "description": "Discovers hosts in a CIDR range by combining ARP cache and TCP probes.",
      "parameters": {
        "cidr": {
          "type": "string",
          "description": "Parameter cidr"
        },
        "options": {
          "type": "DiscoverHostsOptions",
          "description": "Parameter options",
          "properties": {
            "timeout": {
              "type": "number",
              "description": ""
            },
            "concurrency": {
              "type": "number",
              "description": ""
            },
            "ports": {
              "type": "number[]",
              "description": ""
            }
          }
        }
      },
      "required": [
        "cidr"
      ],
      "returns": "Promise<DiscoverHost[]>"
    },
    "scanPorts": {
      "description": "TCP connect scan for a host. By default only returns open ports.",
      "parameters": {
        "host": {
          "type": "string",
          "description": "Parameter host"
        },
        "options": {
          "type": "ScanPortsOptions",
          "description": "Parameter options",
          "properties": {
            "ports": {
              "type": "string | number[]",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "concurrency": {
              "type": "number",
              "description": ""
            },
            "banner": {
              "type": "boolean",
              "description": ""
            },
            "includeClosed": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "host"
      ],
      "returns": "Promise<PortScanResult[]>"
    },
    "scanLocalNetworks": {
      "description": "Convenience method: discover and port-scan hosts across all local networks.",
      "parameters": {
        "options": {
          "type": "ScanLocalNetworksOptions",
          "description": "Parameter options",
          "properties": {
            "ports": {
              "type": "string | number[]",
              "description": ""
            },
            "timeout": {
              "type": "number",
              "description": ""
            },
            "concurrency": {
              "type": "number",
              "description": ""
            },
            "hostConcurrency": {
              "type": "number",
              "description": ""
            },
            "banner": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<LocalNetworkScanHost[]>"
    }
  },
  "getters": {
    "proc": {
      "description": "",
      "returns": "ReturnType<typeof this.container.feature<'proc'>>"
    },
    "os": {
      "description": "",
      "returns": "ReturnType<typeof this.container.feature<'os'>>"
    },
    "nmap": {
      "description": "Optional nmap wrapper for users that already have nmap installed.",
      "returns": "{ isAvailable: () => Promise<boolean>; scan: (target: string, args?: string[]) => Promise<{ hosts: NmapHost[]; raw: string }>; quickScan: (cidr: string) => Promise<{ hosts: NmapHost[]; raw: string }>; fullScan: (target: string) => Promise<{ hosts: NmapHost[]; raw: string }> }"
    }
  },
  "events": {
    "scan:start": {
      "name": "scan:start",
      "description": "Event emitted by Networking",
      "arguments": {}
    },
    "host:discovered": {
      "name": "host:discovered",
      "description": "Event emitted by Networking",
      "arguments": {}
    },
    "scan:complete": {
      "name": "scan:complete",
      "description": "Event emitted by Networking",
      "arguments": {}
    },
    "port:open": {
      "name": "port:open",
      "description": "Event emitted by Networking",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const networking = container.feature('networking')\n\n// Find an available port starting from 3000\nconst port = await networking.findOpenPort(3000)\nconsole.log(`Available port: ${port}`)\n\n// Check if a specific port is available\nconst isAvailable = await networking.isPortOpen(8080)\nif (isAvailable) {\n console.log('Port 8080 is available')\n}"
    }
  ],
  "types": {
    "ReachableHostOptions": {
      "description": "",
      "properties": {
        "timeout": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "ports": {
          "type": "number[]",
          "description": "",
          "optional": true
        }
      }
    },
    "DiscoverHostsOptions": {
      "description": "",
      "properties": {
        "timeout": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "concurrency": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "ports": {
          "type": "number[]",
          "description": "",
          "optional": true
        }
      }
    },
    "ScanPortsOptions": {
      "description": "",
      "properties": {
        "ports": {
          "type": "string | number[]",
          "description": "",
          "optional": true
        },
        "timeout": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "concurrency": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "banner": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "includeClosed": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    },
    "ScanLocalNetworksOptions": {
      "description": "",
      "properties": {
        "ports": {
          "type": "string | number[]",
          "description": "",
          "optional": true
        },
        "timeout": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "concurrency": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "hostConcurrency": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "banner": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    },
    "NmapHost": {
      "description": "",
      "properties": {
        "ip": {
          "type": "string",
          "description": ""
        },
        "hostname": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "status": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "mac": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "ports": {
          "type": "NmapPort[]",
          "description": ""
        }
      }
    },
    "NmapPort": {
      "description": "",
      "properties": {
        "port": {
          "type": "number",
          "description": ""
        },
        "state": {
          "type": "string",
          "description": ""
        },
        "protocol": {
          "type": "string",
          "description": ""
        },
        "service": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.vault', {
  "id": "features.vault",
  "description": "The Vault feature provides encryption and decryption capabilities using AES-256-GCM. This feature allows you to securely encrypt and decrypt sensitive data using industry-standard encryption. It manages secret keys and provides a simple interface for cryptographic operations.",
  "shortcut": "features.vault",
  "className": "Vault",
  "methods": {
    "secret": {
      "description": "Gets or generates a secret key for encryption operations.",
      "parameters": {
        "{ refresh = false, set = true }": {
          "type": "any",
          "description": "Parameter { refresh = false, set = true }"
        }
      },
      "required": [],
      "returns": "Buffer"
    },
    "decrypt": {
      "description": "Decrypts an encrypted payload that was created by the encrypt method.",
      "parameters": {
        "payload": {
          "type": "string",
          "description": "The encrypted payload to decrypt (base64 encoded with delimiters)"
        }
      },
      "required": [
        "payload"
      ],
      "returns": "string"
    },
    "encrypt": {
      "description": "Encrypts a plaintext string using AES-256-GCM encryption.",
      "parameters": {
        "payload": {
          "type": "string",
          "description": "The plaintext string to encrypt"
        }
      },
      "required": [
        "payload"
      ],
      "returns": "string"
    }
  },
  "getters": {
    "secretText": {
      "description": "Gets the secret key as a base64-encoded string.",
      "returns": "string | undefined"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const vault = container.feature('vault')\n\n// Encrypt sensitive data\nconst encrypted = vault.encrypt('sensitive information')\nconsole.log(encrypted) // Base64 encoded encrypted data\n\n// Decrypt the data\nconst decrypted = vault.decrypt(encrypted)\nconsole.log(decrypted) // 'sensitive information'"
    }
  ]
});

setBuildTimeData('features.googleCalendar', {
  "id": "features.googleCalendar",
  "description": "Google Calendar feature for listing calendars and reading events. Depends on the googleAuth feature for authentication. Creates a Calendar v3 API client lazily. Provides convenience methods for today's events and upcoming days.",
  "shortcut": "features.googleCalendar",
  "className": "GoogleCalendar",
  "methods": {
    "listCalendars": {
      "description": "List all calendars accessible to the authenticated user.",
      "parameters": {},
      "required": [],
      "returns": "Promise<CalendarInfo[]>"
    },
    "listEvents": {
      "description": "List events from a calendar within a time range.",
      "parameters": {
        "options": {
          "type": "ListEventsOptions",
          "description": "Filtering options including timeMin, timeMax, query, maxResults",
          "properties": {
            "calendarId": {
              "type": "string",
              "description": ""
            },
            "timeMin": {
              "type": "string",
              "description": ""
            },
            "timeMax": {
              "type": "string",
              "description": ""
            },
            "maxResults": {
              "type": "number",
              "description": ""
            },
            "query": {
              "type": "string",
              "description": ""
            },
            "orderBy": {
              "type": "'startTime' | 'updated'",
              "description": ""
            },
            "pageToken": {
              "type": "string",
              "description": ""
            },
            "singleEvents": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<CalendarEventList>"
    },
    "getToday": {
      "description": "Get today's events from a calendar.",
      "parameters": {
        "calendarId": {
          "type": "string",
          "description": "Calendar ID (defaults to options.defaultCalendarId or 'primary')"
        }
      },
      "required": [],
      "returns": "Promise<CalendarEvent[]>"
    },
    "getUpcoming": {
      "description": "Get upcoming events for the next N days.",
      "parameters": {
        "days": {
          "type": "number",
          "description": "Number of days to look ahead (default: 7)"
        },
        "calendarId": {
          "type": "string",
          "description": "Calendar ID"
        }
      },
      "required": [],
      "returns": "Promise<CalendarEvent[]>"
    },
    "getEvent": {
      "description": "Get a single event by ID.",
      "parameters": {
        "eventId": {
          "type": "string",
          "description": "The event ID"
        },
        "calendarId": {
          "type": "string",
          "description": "Calendar ID"
        }
      },
      "required": [
        "eventId"
      ],
      "returns": "Promise<CalendarEvent>"
    },
    "searchEvents": {
      "description": "Search events by text query across event summaries, descriptions, and locations.",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Freetext search term"
        },
        "options": {
          "type": "ListEventsOptions",
          "description": "Additional listing options (timeMin, timeMax, calendarId, etc.)",
          "properties": {
            "calendarId": {
              "type": "string",
              "description": ""
            },
            "timeMin": {
              "type": "string",
              "description": ""
            },
            "timeMax": {
              "type": "string",
              "description": ""
            },
            "maxResults": {
              "type": "number",
              "description": ""
            },
            "query": {
              "type": "string",
              "description": ""
            },
            "orderBy": {
              "type": "'startTime' | 'updated'",
              "description": ""
            },
            "pageToken": {
              "type": "string",
              "description": ""
            },
            "singleEvents": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "query"
      ],
      "returns": "Promise<CalendarEvent[]>"
    }
  },
  "getters": {
    "auth": {
      "description": "Access the google-auth feature lazily.",
      "returns": "GoogleAuth"
    },
    "defaultCalendarId": {
      "description": "Default calendar ID from options or 'primary'.",
      "returns": "string"
    }
  },
  "events": {
    "error": {
      "name": "error",
      "description": "Event emitted by GoogleCalendar",
      "arguments": {}
    },
    "eventsFetched": {
      "name": "eventsFetched",
      "description": "Event emitted by GoogleCalendar",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const calendar = container.feature('googleCalendar')\n\n// List all calendars\nconst calendars = await calendar.listCalendars()\n\n// Get today's events\nconst today = await calendar.getToday()\n\n// Get next 7 days of events\nconst upcoming = await calendar.getUpcoming(7)\n\n// Search events\nconst meetings = await calendar.searchEvents('standup')\n\n// List events in a time range\nconst events = await calendar.listEvents({\n timeMin: '2026-03-01T00:00:00Z',\n timeMax: '2026-03-31T23:59:59Z',\n})"
    }
  ],
  "types": {
    "CalendarInfo": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "summary": {
          "type": "string",
          "description": ""
        },
        "description": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "timeZone": {
          "type": "string",
          "description": ""
        },
        "primary": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "backgroundColor": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "accessRole": {
          "type": "string",
          "description": ""
        }
      }
    },
    "ListEventsOptions": {
      "description": "",
      "properties": {
        "calendarId": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "timeMin": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "timeMax": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "maxResults": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "query": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "orderBy": {
          "type": "'startTime' | 'updated'",
          "description": "",
          "optional": true
        },
        "pageToken": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "singleEvents": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    },
    "CalendarEventList": {
      "description": "",
      "properties": {
        "events": {
          "type": "CalendarEvent[]",
          "description": ""
        },
        "nextPageToken": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "timeZone": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    },
    "CalendarEvent": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "summary": {
          "type": "string",
          "description": ""
        },
        "description": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "location": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "start": {
          "type": "{ dateTime?: string; date?: string; timeZone?: string }",
          "description": ""
        },
        "end": {
          "type": "{ dateTime?: string; date?: string; timeZone?: string }",
          "description": ""
        },
        "status": {
          "type": "string",
          "description": ""
        },
        "htmlLink": {
          "type": "string",
          "description": ""
        },
        "creator": {
          "type": "{ email?: string; displayName?: string }",
          "description": "",
          "optional": true
        },
        "organizer": {
          "type": "{ email?: string; displayName?: string }",
          "description": "",
          "optional": true
        },
        "attendees": {
          "type": "Array<{ email?: string; displayName?: string; responseStatus?: string }>",
          "description": "",
          "optional": true
        },
        "recurrence": {
          "type": "string[]",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.redis', {
  "id": "features.redis",
  "description": "Redis feature for shared state and pub/sub communication between container instances. Wraps ioredis with a focused API for the primitives that matter most: key/value state, pub/sub messaging, and cross-instance coordination. Uses a dedicated subscriber connection for pub/sub (ioredis requirement), created lazily on first subscribe call.",
  "shortcut": "features.redis",
  "className": "RedisFeature",
  "methods": {
    "set": {
      "description": "Set a key to a string value with optional TTL.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The key name"
        },
        "value": {
          "type": "string",
          "description": "The string value to store"
        },
        "ttl": {
          "type": "number",
          "description": "Optional time-to-live in seconds"
        }
      },
      "required": [
        "key",
        "value"
      ],
      "returns": "Promise<void>"
    },
    "get": {
      "description": "Get a key's value. Returns null if the key doesn't exist.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The key name"
        }
      },
      "required": [
        "key"
      ],
      "returns": "Promise<string | null>"
    },
    "del": {
      "description": "Delete one or more keys.",
      "parameters": {
        "keys": {
          "type": "string[]",
          "description": "One or more key names to delete"
        }
      },
      "required": [
        "keys"
      ],
      "returns": "Promise<number>"
    },
    "exists": {
      "description": "Check if a key exists.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The key name"
        }
      },
      "required": [
        "key"
      ],
      "returns": "Promise<boolean>"
    },
    "expire": {
      "description": "Set a key's TTL in seconds.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The key name"
        },
        "seconds": {
          "type": "number",
          "description": "TTL in seconds"
        }
      },
      "required": [
        "key",
        "seconds"
      ],
      "returns": "Promise<boolean>"
    },
    "keys": {
      "description": "Find keys matching a glob pattern (respects prefix).",
      "parameters": {
        "pattern": {
          "type": "string",
          "description": "Glob pattern, e.g. \"worker:*\""
        }
      },
      "required": [],
      "returns": "Promise<string[]>"
    },
    "setJSON": {
      "description": "Store a value as JSON.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The key name"
        },
        "value": {
          "type": "unknown",
          "description": "Any JSON-serializable value"
        },
        "ttl": {
          "type": "number",
          "description": "Optional TTL in seconds"
        }
      },
      "required": [
        "key",
        "value"
      ],
      "returns": "Promise<void>"
    },
    "getJSON": {
      "description": "Retrieve and parse a JSON value.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The key name"
        }
      },
      "required": [
        "key"
      ],
      "returns": "Promise<T | null>"
    },
    "hset": {
      "description": "Set fields on a hash.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The hash key"
        },
        "fields": {
          "type": "Record<string, string>",
          "description": "Object of field/value pairs"
        }
      },
      "required": [
        "key",
        "fields"
      ],
      "returns": "Promise<void>"
    },
    "hgetall": {
      "description": "Get all fields from a hash.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The hash key"
        }
      },
      "required": [
        "key"
      ],
      "returns": "Promise<Record<string, string>>"
    },
    "hget": {
      "description": "Get a single field from a hash.",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The hash key"
        },
        "field": {
          "type": "string",
          "description": "The field name"
        }
      },
      "required": [
        "key",
        "field"
      ],
      "returns": "Promise<string | null>"
    },
    "subscribe": {
      "description": "Subscribe to one or more channels. Optionally pass a handler that fires only for these channels. The feature also emits a `message` event for all messages.",
      "parameters": {
        "channels": {
          "type": "string | string[]",
          "description": "Channel name(s) to subscribe to"
        },
        "handler": {
          "type": "MessageHandler",
          "description": "Optional per-channel message handler"
        }
      },
      "required": [
        "channels"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await redis.subscribe('tasks', (channel, msg) => {\n console.log(`Got ${msg} on ${channel}`)\n})"
        }
      ]
    },
    "unsubscribe": {
      "description": "Unsubscribe from one or more channels.",
      "parameters": {
        "channels": {
          "type": "string[]",
          "description": "Channel name(s) to unsubscribe from"
        }
      },
      "required": [
        "channels"
      ],
      "returns": "Promise<void>"
    },
    "publish": {
      "description": "Publish a message to a channel.",
      "parameters": {
        "channel": {
          "type": "string",
          "description": "The channel to publish to"
        },
        "message": {
          "type": "string",
          "description": "The message string (use JSON.stringify for objects)"
        }
      },
      "required": [
        "channel",
        "message"
      ],
      "returns": "Promise<number>"
    },
    "ensureLocalDocker": {
      "description": "Spin up a local Redis instance via Docker. Checks if a container with the given name already exists and starts it if stopped, or creates a new one from redis:alpine. Requires the docker feature to be available on the container.",
      "parameters": {
        "options": {
          "type": "{ name?: string; port?: number; image?: string }",
          "description": "Container name and host port"
        }
      },
      "required": [],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const redis = container.feature('redis', { url: 'redis://localhost:6379', lazyConnect: true })\nawait redis.ensureLocalDocker()"
        }
      ]
    },
    "close": {
      "description": "Close all redis connections (main client + subscriber).",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    }
  },
  "getters": {
    "client": {
      "description": "The underlying ioredis client for advanced operations.",
      "returns": "Redis"
    },
    "subscriber": {
      "description": "The dedicated subscriber connection, if pub/sub is active.",
      "returns": "Redis | null"
    }
  },
  "events": {
    "message": {
      "name": "message",
      "description": "Event emitted by RedisFeature",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by RedisFeature",
      "arguments": {}
    },
    "subscribed": {
      "name": "subscribed",
      "description": "Event emitted by RedisFeature",
      "arguments": {}
    },
    "unsubscribed": {
      "name": "unsubscribed",
      "description": "Event emitted by RedisFeature",
      "arguments": {}
    },
    "closed": {
      "name": "closed",
      "description": "Event emitted by RedisFeature",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const redis = container.feature('redis', { url: 'redis://localhost:6379' })\n\n// Shared state\nawait redis.set('worker:status', 'active')\nconst status = await redis.get('worker:status')\n\n// Pub/sub between instances\nredis.on('message', (channel, msg) => console.log(`${channel}: ${msg}`))\nawait redis.subscribe('tasks')\nawait redis.publish('tasks', JSON.stringify({ type: 'ping' }))\n\n// JSON helpers\nawait redis.setJSON('config', { workers: 4, debug: true })\nconst config = await redis.getJSON<{ workers: number }>('config')"
    }
  ]
});

setBuildTimeData('features.fs', {
  "id": "features.fs",
  "description": "The FS feature provides methods for interacting with the file system, relative to the container's cwd.",
  "shortcut": "features.fs",
  "className": "FS",
  "methods": {
    "readFile": {
      "description": "Synchronously reads a file and returns its contents as a string.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path relative to the container's working directory"
        },
        "encoding": {
          "type": "BufferEncoding | null",
          "description": "The encoding to use. Pass null to get a raw Buffer."
        }
      },
      "required": [
        "path"
      ],
      "returns": "string | Buffer",
      "examples": [
        {
          "language": "ts",
          "code": "const content = fs.readFile('README.md')\nconst buffer = fs.readFile('image.png', null)"
        }
      ]
    },
    "readFileSync": {
      "description": "Synchronously reads a file and returns its contents as a string. added this method because AI Assistants are understandly confused by this deviation from 2000's era node style",
      "parameters": {
        "path": {
          "type": "string",
          "description": "Parameter path"
        },
        "encoding": {
          "type": "BufferEncoding | null",
          "description": "Parameter encoding"
        }
      },
      "required": [
        "path"
      ],
      "returns": "string | Buffer"
    },
    "readFileAsync": {
      "description": "Asynchronously reads a file and returns its contents as a string.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path relative to the container's working directory"
        },
        "encoding": {
          "type": "BufferEncoding | null",
          "description": "The encoding to use. Pass null to get a raw Buffer."
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<string | Buffer>",
      "examples": [
        {
          "language": "ts",
          "code": "const content = await fs.readFileAsync('data.txt')\nconst buffer = await fs.readFileAsync('image.png', null)"
        }
      ]
    },
    "readJson": {
      "description": "Synchronously reads and parses a JSON file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to the JSON file"
        }
      },
      "required": [
        "path"
      ],
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const config = fs.readJson('config.json')\nconsole.log(config.version)"
        }
      ]
    },
    "readJsonSync": {
      "description": "Read and parse a JSON file synchronously",
      "parameters": {
        "path": {
          "type": "string",
          "description": "Parameter path"
        }
      },
      "required": [
        "path"
      ],
      "returns": "any"
    },
    "readJsonAsync": {
      "description": "Asynchronously reads and parses a JSON file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to the JSON file"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "const config = await fs.readJsonAsync('config.json')\nconsole.log(config.version)"
        }
      ]
    },
    "readdirSync": {
      "description": "Synchronously reads the contents of a directory.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The directory path relative to the container's working directory"
        }
      },
      "required": [
        "path"
      ],
      "returns": "string[]",
      "examples": [
        {
          "language": "ts",
          "code": "const entries = fs.readdirSync('src')\nconsole.log(entries) // ['index.ts', 'utils.ts', 'components']"
        }
      ]
    },
    "readdir": {
      "description": "Asynchronously reads the contents of a directory.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The directory path relative to the container's working directory"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<string[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const entries = await fs.readdir('src')\nconsole.log(entries) // ['index.ts', 'utils.ts', 'components']"
        }
      ]
    },
    "writeFile": {
      "description": "Synchronously writes content to a file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path where content should be written"
        },
        "content": {
          "type": "Buffer | string",
          "description": "The content to write to the file"
        }
      },
      "required": [
        "path",
        "content"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.writeFile('output.txt', 'Hello World')\nfs.writeFile('data.bin', Buffer.from([1, 2, 3, 4]))"
        }
      ]
    },
    "writeFileAsync": {
      "description": "Asynchronously writes content to a file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path where content should be written"
        },
        "content": {
          "type": "Buffer | string",
          "description": "The content to write to the file"
        }
      },
      "required": [
        "path",
        "content"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.writeFileAsync('output.txt', 'Hello World')\nawait fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))"
        }
      ]
    },
    "writeJson": {
      "description": "Synchronously writes an object to a file as JSON.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path where the JSON should be written"
        },
        "data": {
          "type": "any",
          "description": "The data to serialize as JSON"
        },
        "indent": {
          "type": "number",
          "description": "The number of spaces to use for indentation"
        }
      },
      "required": [
        "path",
        "data"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.writeJson('config.json', { version: '1.0.0', debug: false })"
        }
      ]
    },
    "writeJsonAsync": {
      "description": "Asynchronously writes an object to a file as JSON.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path where the JSON should be written"
        },
        "data": {
          "type": "any",
          "description": "The data to serialize as JSON"
        },
        "indent": {
          "type": "number",
          "description": "The number of spaces to use for indentation"
        }
      },
      "required": [
        "path",
        "data"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.writeJsonAsync('config.json', { version: '1.0.0', debug: false })"
        }
      ]
    },
    "appendFile": {
      "description": "Synchronously appends content to a file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path to append to"
        },
        "content": {
          "type": "Buffer | string",
          "description": "The content to append"
        }
      },
      "required": [
        "path",
        "content"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.appendFile('log.txt', 'New line\\n')"
        }
      ]
    },
    "appendFileAsync": {
      "description": "Asynchronously appends content to a file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path to append to"
        },
        "content": {
          "type": "Buffer | string",
          "description": "The content to append"
        }
      },
      "required": [
        "path",
        "content"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.appendFileAsync('log.txt', 'New line\\n')"
        }
      ]
    },
    "ensureFile": {
      "description": "Synchronously ensures a file exists with the specified content, creating directories as needed.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path where the file should be created"
        },
        "content": {
          "type": "string",
          "description": "The content to write to the file"
        },
        "overwrite": {
          "type": "any",
          "description": "Whether to overwrite the file if it already exists"
        }
      },
      "required": [
        "path",
        "content"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "fs.ensureFile('logs/app.log', '', false)"
        }
      ]
    },
    "ensureFileAsync": {
      "description": "Asynchronously ensures a file exists with the specified content, creating directories as needed.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path where the file should be created"
        },
        "content": {
          "type": "string",
          "description": "The content to write to the file"
        },
        "overwrite": {
          "type": "any",
          "description": "Whether to overwrite the file if it already exists"
        }
      },
      "required": [
        "path",
        "content"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.ensureFileAsync('config/settings.json', '{}', true)"
        }
      ]
    },
    "ensureFolder": {
      "description": "Synchronously ensures a directory exists, creating parent directories as needed.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The directory path to create"
        }
      },
      "required": [
        "path"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "fs.ensureFolder('logs/debug')"
        }
      ]
    },
    "ensureFolderAsync": {
      "description": "Asynchronously ensures a directory exists, creating parent directories as needed.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The directory path to create"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.ensureFolderAsync('logs/debug')"
        }
      ]
    },
    "mkdirp": {
      "description": "Alias for ensureFolder. Synchronously creates a directory and all parent directories.",
      "parameters": {
        "folder": {
          "type": "string",
          "description": "The directory path to create"
        }
      },
      "required": [
        "folder"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "fs.mkdirp('deep/nested/path')"
        }
      ]
    },
    "exists": {
      "description": "Synchronously checks if a file or directory exists.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to check for existence"
        }
      },
      "required": [
        "path"
      ],
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (fs.exists('config.json')) {\n console.log('Config file exists!')\n}"
        }
      ]
    },
    "existsSync": {
      "description": "Alias for exists. Synchronously checks if a file or directory exists.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to check for existence"
        }
      },
      "required": [
        "path"
      ],
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (fs.existsSync('config.json')) {\n console.log('Config file exists!')\n}"
        }
      ]
    },
    "existsAsync": {
      "description": "Asynchronously checks if a file or directory exists.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to check for existence"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "if (await fs.existsAsync('config.json')) {\n console.log('Config file exists!')\n}"
        }
      ]
    },
    "isSymlink": {
      "description": "Checks if a path is a symbolic link.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to check"
        }
      },
      "required": [
        "path"
      ],
      "returns": "boolean"
    },
    "realpath": {
      "description": "Resolves a symlink to its real path. Returns the resolved path as-is if not a symlink.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to resolve"
        }
      },
      "required": [
        "path"
      ],
      "returns": "string"
    },
    "stat": {
      "description": "Synchronously returns the stat object for a file or directory.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to stat"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Stats",
      "examples": [
        {
          "language": "ts",
          "code": "const info = fs.stat('package.json')\nconsole.log(info.size, info.mtime)"
        }
      ]
    },
    "statAsync": {
      "description": "Asynchronously returns the stat object for a file or directory.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to stat"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<Stats>",
      "examples": [
        {
          "language": "ts",
          "code": "const info = await fs.statAsync('package.json')\nconsole.log(info.size, info.mtime)"
        }
      ]
    },
    "isFile": {
      "description": "Synchronously checks if a path is a file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to check"
        }
      },
      "required": [
        "path"
      ],
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (fs.isFile('package.json')) {\n console.log('It is a file')\n}"
        }
      ]
    },
    "isFileAsync": {
      "description": "Asynchronously checks if a path is a file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to check"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "if (await fs.isFileAsync('package.json')) {\n console.log('It is a file')\n}"
        }
      ]
    },
    "isDirectory": {
      "description": "Synchronously checks if a path is a directory.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to check"
        }
      },
      "required": [
        "path"
      ],
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "if (fs.isDirectory('src')) {\n console.log('It is a directory')\n}"
        }
      ]
    },
    "isDirectoryAsync": {
      "description": "Asynchronously checks if a path is a directory.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to check"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "if (await fs.isDirectoryAsync('src')) {\n console.log('It is a directory')\n}"
        }
      ]
    },
    "rmSync": {
      "description": "Synchronously removes a file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path of the file to remove"
        }
      },
      "required": [
        "path"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.rmSync('temp/cache.tmp')"
        }
      ]
    },
    "rm": {
      "description": "Asynchronously removes a file.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path of the file to remove"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.rm('temp/cache.tmp')"
        }
      ]
    },
    "rmdirSync": {
      "description": "Synchronously removes a directory and all its contents.",
      "parameters": {
        "dirPath": {
          "type": "string",
          "description": "The path of the directory to remove"
        }
      },
      "required": [
        "dirPath"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.rmdirSync('temp/cache')"
        }
      ]
    },
    "rmdir": {
      "description": "Asynchronously removes a directory and all its contents.",
      "parameters": {
        "dirPath": {
          "type": "string",
          "description": "The path of the directory to remove"
        }
      },
      "required": [
        "dirPath"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.rmdir('temp/cache')"
        }
      ]
    },
    "copy": {
      "description": "Synchronously copies a file or directory. Auto-detects whether the source is a file or directory and handles each appropriately (recursive for directories).",
      "parameters": {
        "src": {
          "type": "string",
          "description": "The source path to copy from"
        },
        "dest": {
          "type": "string",
          "description": "The destination path to copy to"
        },
        "options": {
          "type": "{ overwrite?: boolean }",
          "description": "Copy options",
          "properties": {
            "overwrite": {
              "type": "any",
              "description": "Whether to overwrite existing files at the destination"
            }
          }
        }
      },
      "required": [
        "src",
        "dest"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.copy('src/config.json', 'backup/config.json')\nfs.copy('src', 'backup/src')"
        }
      ]
    },
    "copyAsync": {
      "description": "Asynchronously copies a file or directory. Auto-detects whether the source is a file or directory and handles each appropriately (recursive for directories).",
      "parameters": {
        "src": {
          "type": "string",
          "description": "The source path to copy from"
        },
        "dest": {
          "type": "string",
          "description": "The destination path to copy to"
        },
        "options": {
          "type": "{ overwrite?: boolean }",
          "description": "Copy options",
          "properties": {
            "overwrite": {
              "type": "any",
              "description": "Whether to overwrite existing files at the destination"
            }
          }
        }
      },
      "required": [
        "src",
        "dest"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.copyAsync('src/config.json', 'backup/config.json')\nawait fs.copyAsync('src', 'backup/src')"
        }
      ]
    },
    "move": {
      "description": "Synchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.",
      "parameters": {
        "src": {
          "type": "string",
          "description": "The source path to move from"
        },
        "dest": {
          "type": "string",
          "description": "The destination path to move to"
        }
      },
      "required": [
        "src",
        "dest"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.move('temp/draft.txt', 'final/document.txt')\nfs.move('old-dir', 'new-dir')"
        }
      ]
    },
    "moveAsync": {
      "description": "Asynchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.",
      "parameters": {
        "src": {
          "type": "string",
          "description": "The source path to move from"
        },
        "dest": {
          "type": "string",
          "description": "The destination path to move to"
        }
      },
      "required": [
        "src",
        "dest"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.moveAsync('temp/draft.txt', 'final/document.txt')\nawait fs.moveAsync('old-dir', 'new-dir')"
        }
      ]
    },
    "walk": {
      "description": "Recursively walks a directory and returns arrays of file and directory paths. By default paths are absolute. Pass `relative: true` to get paths relative to `basePath`. Supports filtering with exclude and include glob patterns.",
      "parameters": {
        "basePath": {
          "type": "string",
          "description": "The base directory path to start walking from"
        },
        "options": {
          "type": "WalkOptions",
          "description": "Options to configure the walk behavior",
          "properties": {
            "directories": {
              "type": "boolean",
              "description": "Whether to include directories in results"
            },
            "files": {
              "type": "boolean",
              "description": "Whether to include files in results"
            },
            "exclude": {
              "type": "string | string[]",
              "description": "] - Glob patterns to exclude (e.g. 'node_modules', '*.log')"
            },
            "include": {
              "type": "string | string[]",
              "description": "] - Glob patterns to include (only matching paths are returned)"
            },
            "relative": {
              "type": "boolean",
              "description": "When true, returned paths are relative to `baseDir` instead of absolute."
            }
          }
        }
      },
      "required": [
        "basePath"
      ],
      "returns": "{ directories: string[], files: string[] }",
      "examples": [
        {
          "language": "ts",
          "code": "const result = fs.walk('src', { files: true, directories: false })\nconst filtered = fs.walk('.', { exclude: ['node_modules', '.git'], include: ['*.ts'] })\nconst relative = fs.walk('inbox', { relative: true }) // => { files: ['contact-1.json', ...] }"
        }
      ]
    },
    "walkAsync": {
      "description": "Asynchronously and recursively walks a directory and returns arrays of file and directory paths. By default paths are absolute. Pass `relative: true` to get paths relative to `baseDir`. Supports filtering with exclude and include glob patterns.",
      "parameters": {
        "baseDir": {
          "type": "string",
          "description": "The base directory path to start walking from"
        },
        "options": {
          "type": "WalkOptions",
          "description": "Options to configure the walk behavior",
          "properties": {
            "directories": {
              "type": "boolean",
              "description": "Whether to include directories in results"
            },
            "files": {
              "type": "boolean",
              "description": "Whether to include files in results"
            },
            "exclude": {
              "type": "string | string[]",
              "description": "] - Glob patterns to exclude (e.g. 'node_modules', '.git')"
            },
            "include": {
              "type": "string | string[]",
              "description": "] - Glob patterns to include (only matching paths are returned)"
            },
            "relative": {
              "type": "boolean",
              "description": "When true, returned paths are relative to `baseDir` instead of absolute."
            }
          }
        }
      },
      "required": [
        "baseDir"
      ],
      "returns": "Promise<{ directories: string[], files: string[] }>",
      "examples": [
        {
          "language": "ts",
          "code": "const result = await fs.walkAsync('src', { exclude: ['node_modules'] })\nconst files = await fs.walkAsync('inbox', { relative: true })\n// files.files => ['contact-1.json', 'subfolder/file.txt', ...]"
        }
      ]
    },
    "findUp": {
      "description": "Synchronously finds a file by walking up the directory tree from the current working directory.",
      "parameters": {
        "fileName": {
          "type": "string",
          "description": "The name of the file to search for"
        },
        "options": {
          "type": "{ cwd?: string }",
          "description": "Options for the search",
          "properties": {
            "cwd": {
              "type": "any",
              "description": "The directory to start searching from (defaults to container.cwd)"
            }
          }
        }
      },
      "required": [
        "fileName"
      ],
      "returns": "string | null",
      "examples": [
        {
          "language": "ts",
          "code": "const packageJson = fs.findUp('package.json')\nif (packageJson) {\n console.log(`Found package.json at: ${packageJson}`)\n}"
        }
      ]
    },
    "findUpAsync": {
      "description": "Asynchronously finds a file by walking up the directory tree.",
      "parameters": {
        "fileName": {
          "type": "string",
          "description": "The name of the file to search for"
        },
        "options": {
          "type": "{ cwd?: string; multiple?: boolean }",
          "description": "Options for the search",
          "properties": {
            "cwd": {
              "type": "any",
              "description": "The directory to start searching from (defaults to container.cwd)"
            },
            "multiple": {
              "type": "any",
              "description": "Whether to find multiple instances of the file"
            }
          }
        }
      },
      "required": [
        "fileName"
      ],
      "returns": "Promise<string | string[] | null>",
      "examples": [
        {
          "language": "ts",
          "code": "const packageJson = await fs.findUpAsync('package.json')\nconst allPackageJsons = await fs.findUpAsync('package.json', { multiple: true })"
        }
      ]
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
      "code": "const fs = container.feature('fs')\nconst content = fs.readFile('package.json')\nconst exists = fs.exists('tsconfig.json')\nawait fs.writeFileAsync('output.txt', 'Hello World')\nfs.writeFile('sync-output.txt', 'Hello Sync')\nfs.copy('src', 'backup/src')"
    }
  ],
  "types": {
    "WalkOptions": {
      "description": "",
      "properties": {
        "directories": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "files": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "exclude": {
          "type": "string | string[]",
          "description": "",
          "optional": true
        },
        "include": {
          "type": "string | string[]",
          "description": "",
          "optional": true
        },
        "relative": {
          "type": "boolean",
          "description": "When true, returned paths are relative to `baseDir` instead of absolute.",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.ipcSocket', {
  "id": "features.ipcSocket",
  "description": "IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Hub-and-spoke: one server, many named clients with identity tracking - Targeted messaging: sendTo(clientId), broadcast(msg, excludeId) - Request/reply: ask() + reply() with timeout-based correlation - Auto-reconnect: clients reconnect with exponential backoff - Stale socket detection: probeSocket() before listen() - Clean shutdown: stopServer() removes socket file **Server (Hub):** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/hub.sock', true); ipc.on('connection', (clientId, socket) => { console.log('Client joined:', clientId); }); ipc.on('message', (data, clientId) => { console.log(`From ${clientId}:`, data); // Reply to sender, or ask and wait ipc.sendTo(clientId, { ack: true }); }); ``` **Client (Spoke):** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/hub.sock', { reconnect: true, name: 'worker-1' }); // Fire and forget await ipc.send({ type: 'status', ready: true }); // Request/reply ipc.on('message', (data) => { if (data.requestId) ipc.reply(data.requestId, { result: 42 }); }); ```",
  "shortcut": "features.ipcSocket",
  "className": "IpcSocket",
  "methods": {
    "listen": {
      "description": "Starts the IPC server listening on the specified socket path. This method sets up a Unix domain socket server that can accept multiple client connections. Each connected client is tracked, and the server automatically handles connection lifecycle events. Messages received from clients are JSON-parsed and emitted as 'message' events. **Server Behavior:** - Tracks all connected clients in the sockets Set - Automatically removes clients when they disconnect - JSON-parses incoming messages and emits 'message' events - Emits 'connection' events when clients connect - Prevents starting multiple servers on the same instance **Socket File Management:** - Resolves the socket path relative to the container's working directory - Optionally removes existing socket files to prevent \"address in use\" errors - Throws error if socket file exists and removeLock is false",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "The file system path for the Unix domain socket"
        },
        "removeLock": {
          "type": "any",
          "description": "Whether to remove existing socket file (default: false)"
        }
      },
      "required": [
        "socketPath"
      ],
      "returns": "Promise<Server>",
      "examples": [
        {
          "language": "ts",
          "code": "// Basic server setup\nconst server = await ipc.listen('/tmp/myapp.sock');\n\n// With automatic lock removal\nconst server = await ipc.listen('/tmp/myapp.sock', true);\n\n// Handle connections and messages\nipc.on('connection', (socket) => {\n console.log('New client connected');\n});\n\nipc.on('message', (data) => {\n console.log('Received message:', data);\n // Echo back to all clients\n ipc.broadcast({ echo: data });\n});"
        }
      ]
    },
    "stopServer": {
      "description": "Stops the IPC server and cleans up all connections. This method gracefully shuts down the server by: 1. Closing the server listener 2. Destroying all active client connections 3. Clearing the sockets tracking set 4. Resetting the server instance",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "// Graceful shutdown\ntry {\n await ipc.stopServer();\n console.log('IPC server stopped successfully');\n} catch (error) {\n console.error('Failed to stop server:', error.message);\n}"
        }
      ]
    },
    "broadcast": {
      "description": "Broadcasts a message to all connected clients (server mode only).",
      "parameters": {
        "message": {
          "type": "any",
          "description": "The message object to broadcast"
        },
        "exclude": {
          "type": "string",
          "description": "Optional client ID to exclude from broadcast"
        }
      },
      "required": [
        "message"
      ],
      "returns": "this"
    },
    "sendTo": {
      "description": "Sends a message to a specific client by ID (server mode only).",
      "parameters": {
        "clientId": {
          "type": "string",
          "description": "The target client ID"
        },
        "message": {
          "type": "any",
          "description": "The message to send"
        }
      },
      "required": [
        "clientId",
        "message"
      ],
      "returns": "boolean"
    },
    "send": {
      "description": "Fire-and-forget: sends a message to the server (client mode only). For server→client, use sendTo() or broadcast().",
      "parameters": {
        "message": {
          "type": "any",
          "description": "The message to send"
        }
      },
      "required": [
        "message"
      ],
      "returns": "Promise<void>"
    },
    "ask": {
      "description": "Sends a message and waits for a correlated reply. Works in both client and server mode. The recipient should call `reply(requestId, response)` to respond.",
      "parameters": {
        "message": {
          "type": "any",
          "description": "The message to send"
        },
        "options": {
          "type": "{ clientId?: string; timeoutMs?: number }",
          "description": "Optional: clientId (server mode target), timeoutMs"
        }
      },
      "required": [
        "message"
      ],
      "returns": "Promise<any>"
    },
    "reply": {
      "description": "Sends a reply to a previous ask() call, correlated by requestId.",
      "parameters": {
        "requestId": {
          "type": "string",
          "description": "The requestId from the incoming message"
        },
        "data": {
          "type": "any",
          "description": "The reply payload"
        },
        "clientId": {
          "type": "string",
          "description": "Target client (server mode; for client mode, omit)"
        }
      },
      "required": [
        "requestId",
        "data"
      ],
      "returns": "void"
    },
    "connect": {
      "description": "Connects to an IPC server at the specified socket path (client mode).",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "Path to the server's Unix domain socket"
        },
        "options": {
          "type": "{ reconnect?: boolean; name?: string }",
          "description": "Optional: reconnect (enable auto-reconnect), name (identify this client)"
        }
      },
      "required": [
        "socketPath"
      ],
      "returns": "Promise<Socket>"
    },
    "disconnect": {
      "description": "Disconnects the client and stops any reconnection attempts.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "probeSocket": {
      "description": "Probe an existing socket to see if a live listener is behind it. Attempts a quick connect — if it succeeds, someone is listening.",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "Parameter socketPath"
        }
      },
      "required": [
        "socketPath"
      ],
      "returns": "Promise<boolean>"
    }
  },
  "getters": {
    "isClient": {
      "description": "Checks if the IPC socket is operating in client mode.",
      "returns": "boolean"
    },
    "isServer": {
      "description": "Checks if the IPC socket is operating in server mode.",
      "returns": "boolean"
    },
    "clientCount": {
      "description": "Returns the number of currently connected clients (server mode).",
      "returns": "number"
    },
    "connectedClients": {
      "description": "Returns info about all connected clients (server mode).",
      "returns": "Array<{ id: string; name?: string; connectedAt: number }>"
    },
    "connection": {
      "description": "Gets the current client connection socket.",
      "returns": "Socket | undefined"
    }
  },
  "events": {
    "disconnection": {
      "name": "disconnection",
      "description": "Event emitted by IpcSocket",
      "arguments": {}
    },
    "connection": {
      "name": "connection",
      "description": "Event emitted by IpcSocket",
      "arguments": {}
    },
    "message": {
      "name": "message",
      "description": "Event emitted by IpcSocket",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.diskCache', {
  "id": "features.diskCache",
  "description": "File-backed key-value cache built on top of the cacache library (the same store that powers npm). Suitable for persisting arbitrary data including very large blobs when necessary, with optional encryption support.",
  "shortcut": "features.diskCache",
  "className": "DiskCache",
  "methods": {
    "saveFile": {
      "description": "Retrieve a file from the disk cache and save it to the local disk",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The cache key to retrieve"
        },
        "outputPath": {
          "type": "string",
          "description": "The local path where the file should be saved"
        },
        "isBase64": {
          "type": "any",
          "description": "Whether the cached content is base64 encoded"
        }
      },
      "required": [
        "key",
        "outputPath"
      ],
      "returns": "Promise<Buffer | string>",
      "examples": [
        {
          "language": "ts",
          "code": "await diskCache.saveFile('myFile', './output/file.txt')\nawait diskCache.saveFile('encodedImage', './images/photo.jpg', true)"
        }
      ]
    },
    "ensure": {
      "description": "Ensure a key exists in the cache, setting it with the provided content if it doesn't exist",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The cache key to check/set"
        },
        "content": {
          "type": "string",
          "description": "The content to set if the key doesn't exist"
        }
      },
      "required": [
        "key",
        "content"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "await diskCache.ensure('config', JSON.stringify(defaultConfig))"
        }
      ]
    },
    "copy": {
      "description": "Copy a cached item from one key to another",
      "parameters": {
        "source": {
          "type": "string",
          "description": "The source cache key"
        },
        "destination": {
          "type": "string",
          "description": "The destination cache key"
        },
        "overwrite": {
          "type": "boolean",
          "description": "Whether to overwrite if destination exists (default: false)"
        }
      },
      "required": [
        "source",
        "destination"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "await diskCache.copy('original', 'backup')\nawait diskCache.copy('file1', 'file2', true) // force overwrite"
        }
      ]
    },
    "move": {
      "description": "Move a cached item from one key to another (copy then delete source)",
      "parameters": {
        "source": {
          "type": "string",
          "description": "The source cache key"
        },
        "destination": {
          "type": "string",
          "description": "The destination cache key"
        },
        "overwrite": {
          "type": "boolean",
          "description": "Whether to overwrite if destination exists (default: false)"
        }
      },
      "required": [
        "source",
        "destination"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "await diskCache.move('temp', 'permanent')\nawait diskCache.move('old_key', 'new_key', true) // force overwrite"
        }
      ]
    },
    "has": {
      "description": "Check if a key exists in the cache",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The cache key to check"
        }
      },
      "required": [
        "key"
      ],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "if (await diskCache.has('myKey')) {\n console.log('Key exists!')\n}"
        }
      ]
    },
    "get": {
      "description": "Retrieve a value from the cache",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The cache key to retrieve"
        },
        "json": {
          "type": "any",
          "description": "Whether to parse the value as JSON (default: false)"
        }
      },
      "required": [
        "key"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "const text = await diskCache.get('myText')\nconst data = await diskCache.get('myData', true) // parse as JSON"
        }
      ]
    },
    "set": {
      "description": "Store a value in the cache",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The cache key to store under"
        },
        "value": {
          "type": "any",
          "description": "The value to store (string, object, or any serializable data)"
        },
        "meta": {
          "type": "any",
          "description": "Optional metadata to associate with the cached item"
        }
      },
      "required": [
        "key",
        "value"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "await diskCache.set('myKey', 'Hello World')\nawait diskCache.set('userData', { name: 'John', age: 30 })\nawait diskCache.set('file', content, { size: 1024, type: 'image' })"
        }
      ]
    },
    "rm": {
      "description": "Remove a cached item",
      "parameters": {
        "key": {
          "type": "string",
          "description": "The cache key to remove"
        }
      },
      "required": [
        "key"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "await diskCache.rm('obsoleteKey')"
        }
      ]
    },
    "clearAll": {
      "description": "Clear all cached items",
      "parameters": {
        "confirm": {
          "type": "any",
          "description": "Must be set to true to confirm the operation"
        }
      },
      "required": [],
      "returns": "Promise<this>",
      "examples": [
        {
          "language": "ts",
          "code": "await diskCache.clearAll(true) // Must explicitly confirm"
        }
      ]
    },
    "keys": {
      "description": "Get all cache keys",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const allKeys = await diskCache.keys()\nconsole.log(`Cache contains ${allKeys.length} items`)"
        }
      ]
    },
    "listKeys": {
      "description": "List all cache keys (alias for keys())",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const keyList = await diskCache.listKeys()"
        }
      ]
    },
    "create": {
      "description": "Create a cacache instance with the specified path",
      "parameters": {
        "path": {
          "type": "string",
          "description": "Optional cache directory path (defaults to options.path or ~/.cache/luca/disk-cache-{cwdHash})"
        }
      },
      "required": [],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const customCache = diskCache.create('/custom/cache/path')"
        }
      ]
    }
  },
  "getters": {
    "cache": {
      "description": "Returns the underlying cacache instance configured with the cache directory path.",
      "returns": "ReturnType<typeof this.create>"
    },
    "securely": {
      "description": "Get encrypted cache operations interface Requires encryption to be enabled and a secret to be provided",
      "returns": "{ set(name: string, payload: any, meta?: any): Promise<any>; get(name: string): Promise<any> }",
      "examples": [
        {
          "language": "ts",
          "code": "// Initialize with encryption\nconst cache = container.feature('diskCache', { \n encrypt: true, \n secret: Buffer.from('my-secret-key') \n})\n\n// Use encrypted operations\nawait cache.securely.set('sensitive', 'secret data')\nconst decrypted = await cache.securely.get('sensitive')"
        }
      ]
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const diskCache = container.feature('diskCache', { path: '/tmp/cache' })\nawait diskCache.set('greeting', 'Hello World')\nconst value = await diskCache.get('greeting')"
    }
  ]
});

setBuildTimeData('features.postgres', {
  "id": "features.postgres",
  "description": "Postgres feature for safe SQL execution through Bun's native SQL client. Supports: - parameterized query execution (`query` / `execute`) - tagged-template query execution (`sql`) to avoid manual placeholder wiring",
  "shortcut": "features.postgres",
  "className": "Postgres",
  "methods": {
    "query": {
      "description": "Executes a SELECT-like query and returns result rows. Use postgres placeholders (`$1`, `$2`, ...) for `params`.",
      "parameters": {
        "queryText": {
          "type": "string",
          "description": "The SQL query string with optional `$N` placeholders"
        },
        "params": {
          "type": "SqlValue[]",
          "description": "Ordered array of values to bind to the placeholders"
        }
      },
      "required": [
        "queryText"
      ],
      "returns": "Promise<T[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })\nconst users = await pg.query<{ id: number; email: string }>(\n 'SELECT id, email FROM users WHERE active = $1',\n [true]\n)"
        }
      ]
    },
    "execute": {
      "description": "Executes a write/update/delete statement and returns metadata. Use postgres placeholders (`$1`, `$2`, ...) for `params`.",
      "parameters": {
        "queryText": {
          "type": "string",
          "description": "The SQL statement string with optional `$N` placeholders"
        },
        "params": {
          "type": "SqlValue[]",
          "description": "Ordered array of values to bind to the placeholders"
        }
      },
      "required": [
        "queryText"
      ],
      "returns": "Promise<{ rowCount: number }>",
      "examples": [
        {
          "language": "ts",
          "code": "const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })\nconst { rowCount } = await pg.execute(\n 'UPDATE users SET active = $1 WHERE last_login < $2',\n [false, '2024-01-01']\n)\nconsole.log(`Deactivated ${rowCount} users`)"
        }
      ]
    },
    "sql": {
      "description": "Safe tagged-template SQL helper. Values become bound parameters automatically, preventing SQL injection.",
      "parameters": {
        "strings": {
          "type": "TemplateStringsArray",
          "description": "Template literal string segments"
        },
        "values": {
          "type": "SqlValue[]",
          "description": "Interpolated values that become bound `$N` parameters"
        }
      },
      "required": [
        "strings",
        "values"
      ],
      "returns": "Promise<T[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })\nconst email = 'hello@example.com'\nconst rows = await pg.sql<{ id: number }>`\n SELECT id FROM users WHERE email = ${email}\n`"
        }
      ]
    },
    "close": {
      "description": "Closes the postgres connection and updates feature state. Emits `closed` after the connection is torn down.",
      "parameters": {},
      "required": [],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })\n// ... run queries ...\nawait pg.close()"
        }
      ]
    }
  },
  "getters": {
    "client": {
      "description": "Returns the underlying Bun SQL postgres client.",
      "returns": "any"
    }
  },
  "events": {
    "query": {
      "name": "query",
      "description": "Event emitted by Postgres",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by Postgres",
      "arguments": {}
    },
    "execute": {
      "name": "execute",
      "description": "Event emitted by Postgres",
      "arguments": {}
    },
    "closed": {
      "name": "closed",
      "description": "Event emitted by Postgres",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const postgres = container.feature('postgres', { url: process.env.DATABASE_URL! })\n\nconst users = await postgres.query<{ id: number; email: string }>(\n 'select id, email from users where id = $1',\n [123]\n)\n\nconst rows = await postgres.sql<{ id: number }>`\n select id from users where email = ${'hello@example.com'}\n`"
    }
  ]
});

setBuildTimeData('features.python', {
  "id": "features.python",
  "description": "The Python VM feature provides Python virtual machine capabilities for executing Python code. This feature automatically detects Python environments (uv, conda, venv, system) and provides methods to install dependencies and execute Python scripts. It can manage project-specific Python environments and maintain context between executions. Supports two modes: - **Stateless** (default): `execute()` and `executeFile()` spawn a fresh process per call - **Persistent session**: `startSession()` spawns a long-lived bridge process that maintains state across `run()` calls, enabling real codebase interaction with imports and session variables",
  "shortcut": "features.python",
  "className": "Python",
  "methods": {
    "enable": {
      "description": "",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "detectEnvironment": {
      "description": "Detects the Python environment type and sets the appropriate Python path. This method checks for various Python environment managers in order of preference: uv, conda, venv, then falls back to system Python. It sets the pythonPath and environmentType in the state.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await python.detectEnvironment()\nconsole.log(python.state.get('environmentType')) // 'uv' | 'conda' | 'venv' | 'system'\nconsole.log(python.state.get('pythonPath')) // '/path/to/python/executable'"
        }
      ]
    },
    "installDependencies": {
      "description": "Installs dependencies for the Python project. This method automatically detects the appropriate package manager and install command based on the environment type. If a custom installCommand is provided in options, it will use that instead.",
      "parameters": {},
      "required": [],
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>",
      "examples": [
        {
          "language": "ts",
          "code": "// Auto-detect and install\nconst result = await python.installDependencies()\n\n// With custom install command\nconst python = container.feature('python', { \n installCommand: 'pip install -r requirements.txt' \n})\nconst result = await python.installDependencies()"
        }
      ]
    },
    "execute": {
      "description": "Executes Python code and returns the result. This method creates a temporary Python script with the provided code and variables, executes it using the detected Python environment, and captures the output.",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The Python code to execute"
        },
        "variables": {
          "type": "Record<string, any>",
          "description": "Variables to make available to the Python code"
        },
        "options": {
          "type": "{ captureLocals?: boolean }",
          "description": "Execution options",
          "properties": {
            "captureLocals": {
              "type": "any",
              "description": "Whether to capture and return local variables after execution"
            }
          }
        }
      },
      "required": [
        "code"
      ],
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number; locals?: any }>",
      "examples": [
        {
          "language": "ts",
          "code": "// Simple execution\nconst result = await python.execute('print(\"Hello World\")')\nconsole.log(result.stdout) // 'Hello World'\n\n// With variables\nconst result = await python.execute('print(f\"Hello {name}!\")', { name: 'Alice' })\n\n// Capture locals\nconst result = await python.execute('x = 42\\ny = x * 2', {}, { captureLocals: true })\nconsole.log(result.locals) // { x: 42, y: 84 }"
        }
      ]
    },
    "executeFile": {
      "description": "Executes a Python file and returns the result.",
      "parameters": {
        "filePath": {
          "type": "string",
          "description": "Path to the Python file to execute"
        },
        "variables": {
          "type": "Record<string, any>",
          "description": "Variables to make available via command line arguments"
        }
      },
      "required": [
        "filePath"
      ],
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>",
      "examples": [
        {
          "language": "ts",
          "code": "const result = await python.executeFile('/path/to/script.py')\nconsole.log(result.stdout)"
        }
      ]
    },
    "getEnvironmentInfo": {
      "description": "Gets information about the current Python environment.",
      "parameters": {},
      "required": [],
      "returns": "Promise<{ version: string; path: string; packages: string[] }>"
    },
    "startSession": {
      "description": "Starts a persistent Python session by spawning the bridge process. The bridge sets up sys.path for the project directory, then enters a JSON-line REPL loop. State (variables, imports) persists across run() calls until stopSession() or resetSession() is called.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "const python = container.feature('python', { dir: '/path/to/project' })\nawait python.enable()\nawait python.startSession()\nawait python.run('x = 42')\nconst result = await python.run('print(x)')\nconsole.log(result.stdout) // '42\\n'\nawait python.stopSession()"
        }
      ]
    },
    "stopSession": {
      "description": "Stops the persistent Python session and cleans up the bridge process.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await python.stopSession()"
        }
      ]
    },
    "run": {
      "description": "Executes Python code in the persistent session. Variables and imports survive across calls. This is the session equivalent of execute().",
      "parameters": {
        "code": {
          "type": "string",
          "description": "Python code to execute"
        },
        "variables": {
          "type": "Record<string, any>",
          "description": "Variables to inject into the namespace before execution"
        }
      },
      "required": [
        "code"
      ],
      "returns": "Promise<RunResult>",
      "examples": [
        {
          "language": "ts",
          "code": "await python.startSession()\n\n// State persists across calls\nawait python.run('x = 42')\nconst result = await python.run('print(x * 2)')\nconsole.log(result.stdout) // '84\\n'\n\n// Inject variables from JS\nconst result2 = await python.run('print(f\"Hello {name}!\")', { name: 'World' })\nconsole.log(result2.stdout) // 'Hello World!\\n'"
        }
      ]
    },
    "eval": {
      "description": "Evaluates a Python expression in the persistent session and returns its value.",
      "parameters": {
        "expression": {
          "type": "string",
          "description": "Python expression to evaluate"
        }
      },
      "required": [
        "expression"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "await python.run('x = 42')\nconst result = await python.eval('x * 2')\nconsole.log(result) // 84"
        }
      ]
    },
    "importModule": {
      "description": "Imports a Python module into the persistent session namespace.",
      "parameters": {
        "moduleName": {
          "type": "string",
          "description": "Dotted module path (e.g. 'myapp.models')"
        },
        "alias": {
          "type": "string",
          "description": "Optional alias for the import (defaults to the last segment)"
        }
      },
      "required": [
        "moduleName"
      ],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await python.importModule('json')\nawait python.importModule('myapp.models', 'models')\nconst result = await python.eval('models.User')"
        }
      ]
    },
    "call": {
      "description": "Calls a function by dotted path in the persistent session namespace.",
      "parameters": {
        "funcPath": {
          "type": "string",
          "description": "Dotted path to the function (e.g. 'json.dumps' or 'my_func')"
        },
        "args": {
          "type": "any[]",
          "description": "Positional arguments"
        },
        "kwargs": {
          "type": "Record<string, any>",
          "description": "Keyword arguments"
        }
      },
      "required": [
        "funcPath"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "await python.importModule('json')\nconst result = await python.call('json.dumps', [{ a: 1 }], { indent: 2 })"
        }
      ]
    },
    "getLocals": {
      "description": "Returns all non-dunder variables from the persistent session namespace.",
      "parameters": {},
      "required": [],
      "returns": "Promise<Record<string, any>>",
      "examples": [
        {
          "language": "ts",
          "code": "await python.run('x = 42\\ny = \"hello\"')\nconst locals = await python.getLocals()\nconsole.log(locals) // { x: 42, y: 'hello' }"
        }
      ]
    },
    "resetSession": {
      "description": "Clears all variables and imports from the persistent session namespace. The session remains active — you can continue calling run() after reset.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "await python.run('x = 42')\nawait python.resetSession()\n// x is now undefined"
        }
      ]
    }
  },
  "getters": {
    "projectDir": {
      "description": "Returns the root directory of the Python project.",
      "returns": "any"
    },
    "pythonPath": {
      "description": "Returns the path to the Python executable for this environment.",
      "returns": "any"
    },
    "environmentType": {
      "description": "Returns the detected environment type: 'uv', 'conda', 'venv', or 'system'.",
      "returns": "any"
    }
  },
  "events": {
    "ready": {
      "name": "ready",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "environmentDetected": {
      "name": "environmentDetected",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "installingDependencies": {
      "name": "installingDependencies",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "dependenciesInstalled": {
      "name": "dependenciesInstalled",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "dependencyInstallFailed": {
      "name": "dependencyInstallFailed",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "localsParseError": {
      "name": "localsParseError",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "codeExecuted": {
      "name": "codeExecuted",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "fileExecuted": {
      "name": "fileExecuted",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "sessionError": {
      "name": "sessionError",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "sessionStarted": {
      "name": "sessionStarted",
      "description": "Event emitted by Python",
      "arguments": {}
    },
    "sessionStopped": {
      "name": "sessionStopped",
      "description": "Event emitted by Python",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const python = container.feature('python', {\n dir: \"/path/to/python/project\",\n})\n\n// Stateless execution\nconst result = await python.execute('print(\"Hello from Python!\")')\n\n// Persistent session\nawait python.startSession()\nawait python.run('import myapp.models')\nawait python.run('users = myapp.models.User.objects.all()')\nconst result = await python.run('print(len(users))')\nawait python.stopSession()"
    }
  ],
  "types": {
    "RunResult": {
      "description": "Result from a persistent session run() call.",
      "properties": {
        "ok": {
          "type": "boolean",
          "description": ""
        },
        "result": {
          "type": "any",
          "description": ""
        },
        "stdout": {
          "type": "string",
          "description": ""
        },
        "error": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "traceback": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.jsonTree', {
  "id": "features.jsonTree",
  "description": "JsonTree Feature - A powerful JSON file tree loader and processor This feature provides functionality to recursively load JSON files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive JSON file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Native JSON parsing for optimal performance **Path Processing:** Files are processed to create a nested object structure: - Directory names become object properties (camelCased) - File names become the final property names (without .json extension) - Nested directories create nested objects **Usage Example:** ```typescript const jsonTree = container.feature('jsonTree', { enable: true }); await jsonTree.loadTree('data', 'appData'); const userData = jsonTree.tree.appData.users.profiles; ``` **Directory Structure Example:** ``` data/ users/ profiles.json    -> tree.data.users.profiles settings.json    -> tree.data.users.settings config/ app-config.json  -> tree.data.config.appConfig ```",
  "shortcut": "features.jsonTree",
  "className": "JsonTree",
  "methods": {
    "loadTree": {
      "description": "Loads a tree of JSON files from the specified base path and stores them in state. This method recursively scans the provided directory for JSON files, processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Processing Steps:** 1. Uses FileManager to discover all .json files recursively 2. Reads each file's content using the file system feature 3. Parses JSON content using native JSON.parse() 4. Converts file paths to nested object properties 5. Stores the complete tree in feature state **Path Transformation:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes .json file extension **Example Transformation:** ``` config/ database/ production.json  -> tree.config.database.production staging.json     -> tree.config.database.staging api/ endpoints.json   -> tree.config.api.endpoints ```",
      "parameters": {
        "basePath": {
          "type": "string",
          "description": "The root directory path to scan for JSON files"
        },
        "key": {
          "type": "string",
          "description": "The key to store the tree under in state (defaults to first segment of basePath)"
        }
      },
      "required": [
        "basePath"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "// Load all JSON files from 'data' directory into state.data\nawait jsonTree.loadTree('data');\n\n// Load with custom key\nawait jsonTree.loadTree('app/config', 'configuration');\n\n// Access the loaded data\nconst dbConfig = jsonTree.tree.data.database.production;\nconst apiEndpoints = jsonTree.tree.data.api.endpoints;"
        }
      ]
    }
  },
  "getters": {
    "tree": {
      "description": "Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the JSON tree data that has been loaded through loadTree().",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "await jsonTree.loadTree('data');\nawait jsonTree.loadTree('config', 'appConfig');\n\nconst allTrees = jsonTree.tree;\n// Returns: { \n//   data: { users: { ... }, products: { ... } },\n//   appConfig: { database: { ... }, api: { ... } }\n// }\n\n// Access specific trees\nconst userData = jsonTree.tree.data.users;\nconst dbConfig = jsonTree.tree.appConfig.database;"
        }
      ]
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.packageFinder', {
  "id": "features.packageFinder",
  "description": "PackageFinder Feature - Comprehensive package discovery and analysis tool This feature provides powerful capabilities for discovering, indexing, and analyzing npm packages across the entire project workspace. It recursively scans all node_modules directories and builds a comprehensive index of packages, enabling: **Core Functionality:** - Recursive node_modules scanning across the workspace - Package manifest parsing and indexing - Duplicate package detection and analysis - Dependency relationship mapping - Scoped package organization (@scope/package) - Package count and statistics **Use Cases:** - Dependency auditing and analysis - Duplicate package identification - Package version conflict detection - Dependency tree analysis - Workspace package inventory **Performance Features:** - Parallel manifest reading for fast scanning - Efficient duplicate detection using unique paths - Lazy initialization - only scans when started - In-memory indexing for fast queries **Usage Example:** ```typescript const finder = container.feature('packageFinder'); await finder.start(); // Find duplicates console.log('Duplicate packages:', finder.duplicates); // Find package by name const lodash = finder.findByName('lodash'); // Find dependents of a package const dependents = finder.findDependentsOf('react'); ```",
  "shortcut": "features.packageFinder",
  "className": "PackageFinder",
  "methods": {
    "afterInitialize": {
      "description": "Initializes the feature state after construction. Sets the started flag to false, indicating the initial scan hasn't completed.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "addPackage": {
      "description": "Adds a package manifest to the internal index. This method ensures uniqueness based on file path and maintains an array of all versions/instances of each package found across the workspace. Packages with the same name but different paths (versions) are tracked separately.",
      "parameters": {
        "manifest": {
          "type": "PartialManifest",
          "description": "The package manifest data from package.json",
          "properties": {
            "name": {
              "type": "string",
              "description": "The package name (e.g., 'lodash', '@types/node')"
            },
            "version": {
              "type": "string",
              "description": "The package version (e.g., '1.0.0', '^2.1.3')"
            },
            "description": {
              "type": "string",
              "description": "Optional package description"
            },
            "dependencies": {
              "type": "Record<string, Record<string,string>>",
              "description": "Runtime dependencies with version constraints"
            },
            "devDependencies": {
              "type": "Record<string, Record<string,string>>",
              "description": "Development dependencies with version constraints"
            },
            "peerDependencies": {
              "type": "Record<string, Record<string,string>>",
              "description": "Peer dependencies with version constraints"
            },
            "optionalDependencies": {
              "type": "Record<string, Record<string,string>>",
              "description": "Optional dependencies with version constraints"
            }
          }
        },
        "path": {
          "type": "string",
          "description": "The file system path to the package.json file"
        }
      },
      "required": [
        "manifest",
        "path"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "finder.addPackage({\n name: 'lodash',\n version: '4.17.21',\n description: 'A modern JavaScript utility library'\n}, '/project/node_modules/lodash/package.json');"
        }
      ]
    },
    "start": {
      "description": "Starts the package finder and performs the initial workspace scan. This method is idempotent - calling it multiple times will not re-scan if already started. It triggers the complete workspace scanning process.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this | undefined>",
      "examples": [
        {
          "language": "ts",
          "code": "await finder.start();\nconsole.log(`Found ${finder.packageNames.length} unique packages`);"
        }
      ]
    },
    "scan": {
      "description": "Performs a comprehensive scan of all node_modules directories in the workspace. This method orchestrates the complete scanning process: 1. Discovers all node_modules directories recursively 2. Finds all package directories (including scoped packages) 3. Reads and parses all package.json files in parallel 4. Indexes all packages for fast querying The scan is performed in parallel for optimal performance, reading multiple package.json files simultaneously.",
      "parameters": {
        "options": {
          "type": "{ exclude?: string | string[] }",
          "description": "Scanning options (currently unused)",
          "properties": {
            "exclude": {
              "type": "any",
              "description": "Optional exclusion patterns (not implemented)"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<this>",
      "examples": [
        {
          "language": "ts",
          "code": "// Manual scan (usually called automatically by start())\nawait finder.scan();\n\n// Check results\nconsole.log(`Scanned ${finder.manifests.length} packages`);"
        }
      ]
    },
    "findByName": {
      "description": "Finds the first package manifest matching the given name. If multiple versions of the package exist, returns the first one found. Use the packages property directly if you need all versions.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The exact package name to search for"
        }
      },
      "required": [
        "name"
      ],
      "returns": "PartialManifest | undefined",
      "examples": [
        {
          "language": "ts",
          "code": "const lodash = finder.findByName('lodash');\nif (lodash) {\n console.log(`Found lodash version ${lodash.version}`);\n}"
        }
      ]
    },
    "findDependentsOf": {
      "description": "Finds all packages that declare the specified package as a dependency. Searches through dependencies and devDependencies of all packages to find which ones depend on the target package. Useful for impact analysis when considering package updates or removals.",
      "parameters": {
        "packageName": {
          "type": "string",
          "description": "The name of the package to find dependents for"
        }
      },
      "required": [
        "packageName"
      ],
      "returns": "PartialManifest[]",
      "examples": [
        {
          "language": "ts",
          "code": "const reactDependents = finder.findDependentsOf('react');\nconsole.log(`${reactDependents.length} packages depend on React:`);\nreactDependents.forEach(pkg => {\n console.log(`- ${pkg.name}@${pkg.version}`);\n});"
        }
      ]
    },
    "find": {
      "description": "Finds the first package manifest matching the provided filter function.",
      "parameters": {
        "filter": {
          "type": "(manifest: PartialManifest) => boolean",
          "description": "Function that returns true for matching packages"
        }
      },
      "required": [
        "filter"
      ],
      "returns": "PartialManifest | undefined",
      "examples": [
        {
          "language": "ts",
          "code": "// Find a package with specific version\nconst specific = finder.find(pkg => pkg.name === 'lodash' && pkg.version.startsWith('4.'));\n\n// Find a package with description containing keyword\nconst utility = finder.find(pkg => pkg.description?.includes('utility'));"
        }
      ]
    },
    "filter": {
      "description": "Finds all package manifests matching the provided filter function.",
      "parameters": {
        "filter": {
          "type": "(manifest: PartialManifest) => boolean",
          "description": "Function that returns true for matching packages"
        }
      },
      "required": [
        "filter"
      ],
      "returns": "PartialManifest[]",
      "examples": [
        {
          "language": "ts",
          "code": "// Find all packages with 'babel' in the name\nconst babelPackages = finder.filter(pkg => pkg.name.includes('babel'));\n\n// Find all packages with no description\nconst undocumented = finder.filter(pkg => !pkg.description);\n\n// Find all scoped packages\nconst scoped = finder.filter(pkg => pkg.name.startsWith('@'));"
        }
      ]
    },
    "exclude": {
      "description": "Returns all packages that do NOT match the provided filter function. This is the inverse of filter() - returns packages where filter returns false.",
      "parameters": {
        "filter": {
          "type": "(manifest: PartialManifest) => boolean",
          "description": "Function that returns true for packages to exclude"
        }
      },
      "required": [
        "filter"
      ],
      "returns": "PartialManifest[]",
      "examples": [
        {
          "language": "ts",
          "code": "// Get all non-development packages (those not in devDependencies)\nconst prodPackages = finder.exclude(pkg => isDevDependency(pkg.name));\n\n// Get all non-scoped packages\nconst unscoped = finder.exclude(pkg => pkg.name.startsWith('@'));"
        }
      ]
    },
    "findLocalPackageFolders": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>"
    }
  },
  "getters": {
    "duplicates": {
      "description": "Gets a list of package names that have multiple versions/instances installed. This is useful for identifying potential dependency conflicts or opportunities for deduplication in the project.",
      "returns": "string[]",
      "examples": [
        {
          "language": "ts",
          "code": "const duplicates = finder.duplicates;\n// ['lodash', 'react', '@types/node'] - packages with multiple versions\n\nduplicates.forEach(name => {\n console.log(`${name} has ${finder.packages[name].length} versions`);\n});"
        }
      ]
    },
    "isStarted": {
      "description": "Checks if the package finder has completed its initial scan.",
      "returns": "boolean"
    },
    "packageNames": {
      "description": "Gets an array of all unique package names discovered in the workspace.",
      "returns": "string[]",
      "examples": [
        {
          "language": "ts",
          "code": "const names = finder.packageNames;\nconsole.log(`Found ${names.length} unique packages`);"
        }
      ]
    },
    "scopes": {
      "description": "Gets an array of all scoped package prefixes found in the workspace. Scoped packages are those starting with '@' (e.g., @types/node, @babel/core). This returns just the scope part (e.g., '@types', '@babel').",
      "returns": "string[]",
      "examples": [
        {
          "language": "ts",
          "code": "const scopes = finder.scopes;\n// ['@types', '@babel', '@angular'] - all scopes in use\n\nscopes.forEach(scope => {\n const scopedPackages = finder.packageNames.filter(name => name.startsWith(scope));\n console.log(`${scope}: ${scopedPackages.length} packages`);\n});"
        }
      ]
    },
    "manifests": {
      "description": "Gets a flat array of all package manifests found in the workspace. This includes all versions/instances of packages, unlike packageNames which returns unique names only.",
      "returns": "(PartialManifest & { __path: string })[]",
      "examples": [
        {
          "language": "ts",
          "code": "const all = finder.manifests;\nconsole.log(`Total package instances: ${all.length}`);\n\n// Group by name to see duplicates\nconst grouped = all.reduce((acc, pkg) => {\n acc[pkg.name] = (acc[pkg.name] || 0) + 1;\n return acc;\n}, {});"
        }
      ]
    },
    "counts": {
      "description": "Gets a count of instances for each package name. Useful for quickly identifying which packages have multiple versions and how many instances of each exist.",
      "returns": "Record<string, number>",
      "examples": [
        {
          "language": "ts",
          "code": "const counts = finder.counts;\n// { 'lodash': 3, 'react': 2, 'express': 1 }\n\nObject.entries(counts)\n .filter(([name, count]) => count > 1)\n .forEach(([name, count]) => {\n   console.log(`${name}: ${count} versions installed`);\n });"
        }
      ]
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "types": {
    "PartialManifest": {
      "description": "Partial representation of a package.json manifest file. Contains the most commonly used fields for package analysis and dependency management.",
      "properties": {
        "name": {
          "type": "string",
          "description": "The package name (e.g., 'lodash', '@types/node')"
        },
        "version": {
          "type": "string",
          "description": "The package version (e.g., '1.0.0', '^2.1.3')"
        },
        "description": {
          "type": "string",
          "description": "Optional package description",
          "optional": true
        },
        "dependencies": {
          "type": "Record<string, Record<string,string>>",
          "description": "Runtime dependencies with version constraints",
          "optional": true
        },
        "devDependencies": {
          "type": "Record<string, Record<string,string>>",
          "description": "Development dependencies with version constraints",
          "optional": true
        },
        "peerDependencies": {
          "type": "Record<string, Record<string,string>>",
          "description": "Peer dependencies with version constraints",
          "optional": true
        },
        "optionalDependencies": {
          "type": "Record<string, Record<string,string>>",
          "description": "Optional dependencies with version constraints",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.processManager', {
  "id": "features.processManager",
  "description": "Manages long-running child processes with tracking, events, and automatic cleanup. Unlike the `proc` feature whose spawn methods block until the child exits, ProcessManager returns a SpawnHandler immediately — a handle object with its own state, events, and lifecycle methods. The feature tracks all spawned processes, maintains observable state, and can automatically kill them on parent exit. Each handler maintains a memory-efficient output buffer: the first 20 lines (head) and last 50 lines (tail) of stdout/stderr are kept, everything in between is discarded.",
  "shortcut": "features.processManager",
  "className": "ProcessManager",
  "methods": {
    "spawnProcess": {
      "description": "Tool handler: spawn a long-running background process.",
      "parameters": {
        "args": {
          "type": "{ command: string; args?: string; tag?: string; cwd?: string }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "runCommand": {
      "description": "Tool handler: run a command to completion and return its output.",
      "parameters": {
        "args": {
          "type": "{ command: string; cwd?: string }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "listProcesses": {
      "description": "Tool handler: list all tracked processes.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "getProcessOutput": {
      "description": "Tool handler: peek at a process's buffered output.",
      "parameters": {
        "args": {
          "type": "{ id?: string; tag?: string; stream?: string }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "killProcess": {
      "description": "Tool handler: kill a process by ID or tag.",
      "parameters": {
        "args": {
          "type": "{ id?: string; tag?: string; signal?: string }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "setupToolsConsumer": {
      "description": "When an assistant uses processManager, inject system prompt guidance about how to manage processes safely and effectively.",
      "parameters": {
        "consumer": {
          "type": "Helper",
          "description": "Parameter consumer"
        }
      },
      "required": [
        "consumer"
      ],
      "returns": "void"
    },
    "spawn": {
      "description": "Spawn a long-running process and return a handle immediately. The returned SpawnHandler provides events for stdout/stderr streaming, exit/crash notifications, and methods to kill or await the process.",
      "parameters": {
        "command": {
          "type": "string",
          "description": "The command to execute (e.g. 'node', 'bun', 'python')"
        },
        "args": {
          "type": "string[]",
          "description": "Arguments to pass to the command"
        },
        "options": {
          "type": "SpawnOptions",
          "description": "Spawn configuration",
          "properties": {
            "tag": {
              "type": "string",
              "description": "User-defined tag for later lookups via getByTag()"
            },
            "cwd": {
              "type": "string",
              "description": "Working directory for the spawned process (defaults to container cwd)"
            },
            "env": {
              "type": "Record<string, string>",
              "description": "Additional environment variables merged with process.env"
            },
            "stdin": {
              "type": "'pipe' | 'inherit' | 'ignore' | null",
              "description": "stdin mode: 'pipe' to write to the process, 'inherit', or 'ignore' (default: 'ignore')"
            },
            "stdout": {
              "type": "'pipe' | 'inherit' | 'ignore' | null",
              "description": "stdout mode: 'pipe' to capture output, 'inherit', or 'ignore' (default: 'pipe')"
            },
            "stderr": {
              "type": "'pipe' | 'inherit' | 'ignore' | null",
              "description": "stderr mode: 'pipe' to capture errors, 'inherit', or 'ignore' (default: 'pipe')"
            }
          }
        }
      },
      "required": [
        "command"
      ],
      "returns": "SpawnHandler"
    },
    "get": {
      "description": "Get a SpawnHandler by its unique ID.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The process ID returned by spawn"
        }
      },
      "required": [
        "id"
      ],
      "returns": "SpawnHandler | undefined"
    },
    "getByTag": {
      "description": "Find a SpawnHandler by its user-defined tag.",
      "parameters": {
        "tag": {
          "type": "string",
          "description": "The tag passed to spawn()"
        }
      },
      "required": [
        "tag"
      ],
      "returns": "SpawnHandler | undefined"
    },
    "list": {
      "description": "List all tracked SpawnHandlers (running and finished).",
      "parameters": {},
      "required": [],
      "returns": "SpawnHandler[]"
    },
    "killAll": {
      "description": "Kill all running processes.",
      "parameters": {
        "signal": {
          "type": "NodeJS.Signals | number",
          "description": "Signal to send (default: SIGTERM)"
        }
      },
      "required": [],
      "returns": "void"
    },
    "stop": {
      "description": "Stop the process manager: kill all running processes and remove cleanup handlers.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "remove": {
      "description": "Remove a finished handler from tracking.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The process ID to remove"
        }
      },
      "required": [
        "id"
      ],
      "returns": "boolean"
    },
    "enable": {
      "description": "",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "_onHandlerDone": {
      "description": "Called by SpawnHandler when a process finishes. Updates feature-level state.",
      "parameters": {
        "handler": {
          "type": "SpawnHandler",
          "description": "Parameter handler"
        },
        "status": {
          "type": "'exited' | 'crashed' | 'killed'",
          "description": "Parameter status"
        },
        "exitCode": {
          "type": "number",
          "description": "Parameter exitCode"
        }
      },
      "required": [
        "handler",
        "status"
      ],
      "returns": "void"
    }
  },
  "getters": {},
  "events": {
    "spawned": {
      "name": "spawned",
      "description": "Event emitted by ProcessManager",
      "arguments": {}
    },
    "exited": {
      "name": "exited",
      "description": "Event emitted by ProcessManager",
      "arguments": {}
    },
    "crashed": {
      "name": "crashed",
      "description": "Event emitted by ProcessManager",
      "arguments": {}
    },
    "killed": {
      "name": "killed",
      "description": "Event emitted by ProcessManager",
      "arguments": {}
    },
    "allStopped": {
      "name": "allStopped",
      "description": "Event emitted by ProcessManager",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const pm = container.feature('processManager', { enable: true })\n\nconst server = pm.spawn('node', ['server.js'], { tag: 'api', cwd: '/app' })\nserver.on('stdout', (data) => console.log('[api]', data))\nserver.on('crash', (code) => console.error('API crashed:', code))\n\n// Peek at buffered output\nconst { head, tail } = server.peek()\n\n// Kill one\nserver.kill()\n\n// Kill all tracked processes\npm.killAll()\n\n// List and lookup\npm.list()              // SpawnHandler[]\npm.getByTag('api')     // SpawnHandler | undefined"
    }
  ],
  "types": {
    "SpawnOptions": {
      "description": "",
      "properties": {
        "tag": {
          "type": "string",
          "description": "User-defined tag for later lookups via getByTag()",
          "optional": true
        },
        "cwd": {
          "type": "string",
          "description": "Working directory for the spawned process (defaults to container cwd)",
          "optional": true
        },
        "env": {
          "type": "Record<string, string>",
          "description": "Additional environment variables merged with process.env",
          "optional": true
        },
        "stdin": {
          "type": "'pipe' | 'inherit' | 'ignore' | null",
          "description": "stdin mode: 'pipe' to write to the process, 'inherit', or 'ignore' (default: 'ignore')",
          "optional": true
        },
        "stdout": {
          "type": "'pipe' | 'inherit' | 'ignore' | null",
          "description": "stdout mode: 'pipe' to capture output, 'inherit', or 'ignore' (default: 'pipe')",
          "optional": true
        },
        "stderr": {
          "type": "'pipe' | 'inherit' | 'ignore' | null",
          "description": "stderr mode: 'pipe' to capture errors, 'inherit', or 'ignore' (default: 'pipe')",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.googleSheets', {
  "id": "features.googleSheets",
  "description": "Google Sheets feature for reading spreadsheet data as JSON, CSV, or raw arrays. Depends on the googleAuth feature for authentication. Creates a Sheets v4 API client lazily and provides convenient methods for reading tabular data.",
  "shortcut": "features.googleSheets",
  "className": "GoogleSheets",
  "methods": {
    "getSpreadsheet": {
      "description": "Get spreadsheet metadata including title, locale, and sheet list.",
      "parameters": {
        "spreadsheetId": {
          "type": "string",
          "description": "The spreadsheet ID (defaults to options.defaultSpreadsheetId)"
        }
      },
      "required": [],
      "returns": "Promise<SpreadsheetMeta>"
    },
    "listSheets": {
      "description": "List all sheets (tabs) in a spreadsheet.",
      "parameters": {
        "spreadsheetId": {
          "type": "string",
          "description": "The spreadsheet ID"
        }
      },
      "required": [],
      "returns": "Promise<SheetInfo[]>"
    },
    "getRange": {
      "description": "Read a range of values from a sheet.",
      "parameters": {
        "range": {
          "type": "string",
          "description": "A1 notation range (e.g. \"Sheet1!A1:D10\" or \"Sheet1\" for entire sheet)"
        },
        "spreadsheetId": {
          "type": "string",
          "description": "The spreadsheet ID"
        }
      },
      "required": [
        "range"
      ],
      "returns": "Promise<string[][]>"
    },
    "getAsJson": {
      "description": "Read a sheet as an array of JSON objects. The first row is treated as headers; subsequent rows become objects keyed by those headers.",
      "parameters": {
        "sheetName": {
          "type": "string",
          "description": "Name of the sheet tab (if omitted, reads the first sheet)"
        },
        "spreadsheetId": {
          "type": "string",
          "description": "The spreadsheet ID"
        }
      },
      "required": [],
      "returns": "Promise<T[]>"
    },
    "getAsCsv": {
      "description": "Read a sheet and return it as a CSV string.",
      "parameters": {
        "sheetName": {
          "type": "string",
          "description": "Name of the sheet tab (if omitted, reads the first sheet)"
        },
        "spreadsheetId": {
          "type": "string",
          "description": "The spreadsheet ID"
        }
      },
      "required": [],
      "returns": "Promise<string>"
    },
    "saveAsJson": {
      "description": "Download sheet data as JSON and save to a local file.",
      "parameters": {
        "localPath": {
          "type": "string",
          "description": "Local file path (resolved relative to container cwd)"
        },
        "sheetName": {
          "type": "string",
          "description": "Sheet tab name (defaults to first sheet)"
        },
        "spreadsheetId": {
          "type": "string",
          "description": "The spreadsheet ID"
        }
      },
      "required": [
        "localPath"
      ],
      "returns": "Promise<string>"
    },
    "saveAsCsv": {
      "description": "Download sheet data as CSV and save to a local file.",
      "parameters": {
        "localPath": {
          "type": "string",
          "description": "Local file path (resolved relative to container cwd)"
        },
        "sheetName": {
          "type": "string",
          "description": "Sheet tab name (defaults to first sheet)"
        },
        "spreadsheetId": {
          "type": "string",
          "description": "The spreadsheet ID"
        }
      },
      "required": [
        "localPath"
      ],
      "returns": "Promise<string>"
    }
  },
  "getters": {
    "auth": {
      "description": "Access the google-auth feature lazily.",
      "returns": "GoogleAuth"
    }
  },
  "events": {
    "error": {
      "name": "error",
      "description": "Event emitted by GoogleSheets",
      "arguments": {}
    },
    "dataFetched": {
      "name": "dataFetched",
      "description": "Event emitted by GoogleSheets",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const sheets = container.feature('googleSheets', {\n defaultSpreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'\n})\n\n// Read as JSON objects (first row = headers)\nconst data = await sheets.getAsJson('Sheet1')\n// => [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]\n\n// Read as CSV string\nconst csv = await sheets.getAsCsv('Revenue')\n\n// Read a specific range\nconst values = await sheets.getRange('Sheet1!A1:D10')\n\n// Save to file\nawait sheets.saveAsJson('./data/export.json')"
    }
  ],
  "types": {
    "SpreadsheetMeta": {
      "description": "",
      "properties": {
        "spreadsheetId": {
          "type": "string",
          "description": ""
        },
        "title": {
          "type": "string",
          "description": ""
        },
        "locale": {
          "type": "string",
          "description": ""
        },
        "sheets": {
          "type": "SheetInfo[]",
          "description": ""
        }
      }
    },
    "SheetInfo": {
      "description": "",
      "properties": {
        "sheetId": {
          "type": "number",
          "description": ""
        },
        "title": {
          "type": "string",
          "description": ""
        },
        "index": {
          "type": "number",
          "description": ""
        },
        "rowCount": {
          "type": "number",
          "description": ""
        },
        "columnCount": {
          "type": "number",
          "description": ""
        }
      }
    }
  }
});

setBuildTimeData('features.secureShell', {
  "id": "features.secureShell",
  "description": "SecureShell Feature -- SSH command execution and SCP file transfers. Uses the system `ssh` and `scp` binaries to run commands on remote hosts and transfer files. Supports key-based and password-based authentication through the container's `proc` feature.",
  "shortcut": "features.secureShell",
  "className": "SecureShell",
  "methods": {
    "testConnection": {
      "description": "Test the SSH connection by running a simple echo command on the remote host. Updates `state.connected` based on the result.",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })\nconst ok = await ssh.testConnection()\nif (!ok) console.error('SSH connection failed')"
        }
      ]
    },
    "exec": {
      "description": "Executes a command on the remote host.",
      "parameters": {
        "command": {
          "type": "string",
          "description": "The command to execute on the remote shell"
        }
      },
      "required": [
        "command"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })\nconst listing = await ssh.exec('ls -la /var/log')\nconsole.log(listing)"
        }
      ]
    },
    "download": {
      "description": "Downloads a file from the remote host via SCP.",
      "parameters": {
        "source": {
          "type": "string",
          "description": "The source file path on the remote host"
        },
        "target": {
          "type": "string",
          "description": "The target file path on the local machine"
        }
      },
      "required": [
        "source",
        "target"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })\nawait ssh.download('/var/log/app.log', './logs/app.log')"
        }
      ]
    },
    "upload": {
      "description": "Uploads a file to the remote host via SCP.",
      "parameters": {
        "source": {
          "type": "string",
          "description": "The source file path on the local machine"
        },
        "target": {
          "type": "string",
          "description": "The target file path on the remote host"
        }
      },
      "required": [
        "source",
        "target"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })\nawait ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')"
        }
      ]
    }
  },
  "getters": {
    "sshPath": {
      "description": "Resolved path to the ssh binary",
      "returns": "string"
    },
    "scpPath": {
      "description": "Resolved path to the scp binary",
      "returns": "string"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const ssh = container.feature('secureShell', {\n host: '192.168.1.100',\n username: 'deploy',\n key: '~/.ssh/id_ed25519',\n})\n\nif (await ssh.testConnection()) {\n const uptime = await ssh.exec('uptime')\n console.log(uptime)\n}"
    }
  ]
});

setBuildTimeData('features.semanticSearch', {
  "id": "features.semanticSearch",
  "description": "Semantic search feature providing BM25 keyword search, vector similarity search, and hybrid search with Reciprocal Rank Fusion over a SQLite-backed index. Uses bun:sqlite for FTS5 keyword search and BLOB-stored embeddings with JavaScript cosine similarity for vector search.",
  "shortcut": "features.semanticSearch",
  "className": "SemanticSearch",
  "methods": {
    "initDb": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "insertDocument": {
      "description": "",
      "parameters": {
        "doc": {
          "type": "DocumentInput",
          "description": "Parameter doc",
          "properties": {
            "pathId": {
              "type": "string",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "title": {
              "type": "string",
              "description": ""
            },
            "slug": {
              "type": "string",
              "description": ""
            },
            "meta": {
              "type": "Record<string, any>",
              "description": ""
            },
            "content": {
              "type": "string",
              "description": ""
            },
            "sections": {
              "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
              "description": ""
            }
          }
        }
      },
      "required": [
        "doc"
      ],
      "returns": "void"
    },
    "insertChunk": {
      "description": "",
      "parameters": {
        "chunk": {
          "type": "Chunk",
          "description": "Parameter chunk",
          "properties": {
            "pathId": {
              "type": "string",
              "description": ""
            },
            "section": {
              "type": "string",
              "description": ""
            },
            "headingPath": {
              "type": "string",
              "description": ""
            },
            "seq": {
              "type": "number",
              "description": ""
            },
            "content": {
              "type": "string",
              "description": ""
            },
            "contentHash": {
              "type": "string",
              "description": ""
            }
          }
        },
        "embedding": {
          "type": "Float32Array",
          "description": "Parameter embedding"
        }
      },
      "required": [
        "chunk",
        "embedding"
      ],
      "returns": "void"
    },
    "removeDocument": {
      "description": "",
      "parameters": {
        "pathId": {
          "type": "string",
          "description": "Parameter pathId"
        }
      },
      "required": [
        "pathId"
      ],
      "returns": "void"
    },
    "getStats": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "IndexStatus"
    },
    "embed": {
      "description": "",
      "parameters": {
        "texts": {
          "type": "string[]",
          "description": "Parameter texts"
        }
      },
      "required": [
        "texts"
      ],
      "returns": "Promise<number[][]>"
    },
    "ensureModel": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "disposeModel": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "getDimensions": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "number"
    },
    "chunkDocument": {
      "description": "",
      "parameters": {
        "doc": {
          "type": "DocumentInput",
          "description": "Parameter doc",
          "properties": {
            "pathId": {
              "type": "string",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "title": {
              "type": "string",
              "description": ""
            },
            "slug": {
              "type": "string",
              "description": ""
            },
            "meta": {
              "type": "Record<string, any>",
              "description": ""
            },
            "content": {
              "type": "string",
              "description": ""
            },
            "sections": {
              "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
              "description": ""
            }
          }
        },
        "strategy": {
          "type": "'section' | 'fixed' | 'document'",
          "description": "Parameter strategy"
        }
      },
      "required": [
        "doc"
      ],
      "returns": "Chunk[]"
    },
    "search": {
      "description": "",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Parameter query"
        },
        "options": {
          "type": "SearchOptions",
          "description": "Parameter options",
          "properties": {
            "limit": {
              "type": "number",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "where": {
              "type": "Record<string, any>",
              "description": ""
            }
          }
        }
      },
      "required": [
        "query"
      ],
      "returns": "Promise<SearchResult[]>"
    },
    "vectorSearch": {
      "description": "",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Parameter query"
        },
        "options": {
          "type": "SearchOptions",
          "description": "Parameter options",
          "properties": {
            "limit": {
              "type": "number",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "where": {
              "type": "Record<string, any>",
              "description": ""
            }
          }
        }
      },
      "required": [
        "query"
      ],
      "returns": "Promise<SearchResult[]>"
    },
    "hybridSearch": {
      "description": "",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Parameter query"
        },
        "options": {
          "type": "HybridSearchOptions",
          "description": "Parameter options",
          "properties": {
            "ftsWeight": {
              "type": "number",
              "description": ""
            },
            "vecWeight": {
              "type": "number",
              "description": ""
            }
          }
        }
      },
      "required": [
        "query"
      ],
      "returns": "Promise<SearchResult[]>"
    },
    "deepSearch": {
      "description": "",
      "parameters": {
        "_query": {
          "type": "string",
          "description": "Parameter _query"
        },
        "_options": {
          "type": "SearchOptions",
          "description": "Parameter _options",
          "properties": {
            "limit": {
              "type": "number",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "where": {
              "type": "Record<string, any>",
              "description": ""
            }
          }
        }
      },
      "required": [
        "_query"
      ],
      "returns": "Promise<SearchResult[]>"
    },
    "indexDocuments": {
      "description": "",
      "parameters": {
        "docs": {
          "type": "DocumentInput[]",
          "description": "Parameter docs",
          "properties": {
            "pathId": {
              "type": "string",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "title": {
              "type": "string",
              "description": ""
            },
            "slug": {
              "type": "string",
              "description": ""
            },
            "meta": {
              "type": "Record<string, any>",
              "description": ""
            },
            "content": {
              "type": "string",
              "description": ""
            },
            "sections": {
              "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
              "description": ""
            }
          }
        }
      },
      "required": [
        "docs"
      ],
      "returns": "Promise<void>"
    },
    "reindex": {
      "description": "",
      "parameters": {
        "pathIds": {
          "type": "string[]",
          "description": "Parameter pathIds"
        }
      },
      "required": [],
      "returns": "Promise<void>"
    },
    "removeStale": {
      "description": "",
      "parameters": {
        "currentPathIds": {
          "type": "string[]",
          "description": "Parameter currentPathIds"
        }
      },
      "required": [
        "currentPathIds"
      ],
      "returns": "void"
    },
    "needsReindex": {
      "description": "",
      "parameters": {
        "doc": {
          "type": "DocumentInput",
          "description": "Parameter doc",
          "properties": {
            "pathId": {
              "type": "string",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "title": {
              "type": "string",
              "description": ""
            },
            "slug": {
              "type": "string",
              "description": ""
            },
            "meta": {
              "type": "Record<string, any>",
              "description": ""
            },
            "content": {
              "type": "string",
              "description": ""
            },
            "sections": {
              "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
              "description": ""
            }
          }
        }
      },
      "required": [
        "doc"
      ],
      "returns": "boolean"
    },
    "status": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "IndexStatus"
    },
    "installLocalEmbeddings": {
      "description": "Install node-llama-cpp into the user's project for local embedding support. Detects package manager from lockfile presence and verifies the native addon loads.",
      "parameters": {
        "cwd": {
          "type": "string",
          "description": "Parameter cwd"
        }
      },
      "required": [
        "cwd"
      ],
      "returns": "Promise<void>"
    },
    "close": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    }
  },
  "getters": {
    "db": {
      "description": "",
      "returns": "Database"
    },
    "dimensions": {
      "description": "",
      "returns": "number"
    }
  },
  "events": {
    "dbReady": {
      "name": "dbReady",
      "description": "Event emitted by SemanticSearch",
      "arguments": {}
    },
    "modelLoaded": {
      "name": "modelLoaded",
      "description": "Event emitted by SemanticSearch",
      "arguments": {}
    },
    "modelDisposed": {
      "name": "modelDisposed",
      "description": "Event emitted by SemanticSearch",
      "arguments": {}
    },
    "indexed": {
      "name": "indexed",
      "description": "Event emitted by SemanticSearch",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const search = container.feature('semanticSearch', {\n dbPath: '.contentbase/search.sqlite',\n embeddingProvider: 'local',\n})\nawait search.initDb()\nawait search.indexDocuments(docs)\nconst results = await search.hybridSearch('how does authentication work')"
    }
  ],
  "types": {
    "DocumentInput": {
      "description": "",
      "properties": {
        "pathId": {
          "type": "string",
          "description": ""
        },
        "model": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "title": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "slug": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "meta": {
          "type": "Record<string, any>",
          "description": "",
          "optional": true
        },
        "content": {
          "type": "string",
          "description": ""
        },
        "sections": {
          "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
          "description": "",
          "optional": true
        }
      }
    },
    "Chunk": {
      "description": "── Types ───────────────────────────────────────────────────────────",
      "properties": {
        "pathId": {
          "type": "string",
          "description": ""
        },
        "section": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "headingPath": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "seq": {
          "type": "number",
          "description": ""
        },
        "content": {
          "type": "string",
          "description": ""
        },
        "contentHash": {
          "type": "string",
          "description": ""
        }
      }
    },
    "IndexStatus": {
      "description": "",
      "properties": {
        "documentCount": {
          "type": "number",
          "description": ""
        },
        "chunkCount": {
          "type": "number",
          "description": ""
        },
        "embeddingCount": {
          "type": "number",
          "description": ""
        },
        "lastIndexedAt": {
          "type": "string | null",
          "description": ""
        },
        "provider": {
          "type": "string",
          "description": ""
        },
        "model": {
          "type": "string",
          "description": ""
        },
        "dimensions": {
          "type": "number",
          "description": ""
        },
        "dbSizeBytes": {
          "type": "number",
          "description": ""
        }
      }
    },
    "SearchOptions": {
      "description": "",
      "properties": {
        "limit": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "model": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "where": {
          "type": "Record<string, any>",
          "description": "",
          "optional": true
        }
      }
    },
    "SearchResult": {
      "description": "",
      "properties": {
        "pathId": {
          "type": "string",
          "description": ""
        },
        "model": {
          "type": "string",
          "description": ""
        },
        "title": {
          "type": "string",
          "description": ""
        },
        "meta": {
          "type": "Record<string, any>",
          "description": ""
        },
        "score": {
          "type": "number",
          "description": ""
        },
        "snippet": {
          "type": "string",
          "description": ""
        },
        "matchedSection": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "headingPath": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    },
    "HybridSearchOptions": {
      "description": "",
      "properties": {
        "ftsWeight": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "vecWeight": {
          "type": "number",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.runpod', {
  "id": "features.runpod",
  "description": "RunPod feature — manage GPU cloud pods, templates, volumes, and SSH connections via the RunPod REST API. Provides a complete interface for provisioning and managing RunPod GPU instances. Supports creating pods from templates, managing network storage volumes, SSH access via the SecureShell feature, file transfers, and polling for pod readiness.",
  "shortcut": "features.runpod",
  "className": "Runpod",
  "methods": {
    "listTemplates": {
      "description": "List available pod templates.",
      "parameters": {
        "options": {
          "type": "{ includePublic?: boolean, includeRunpod?: boolean }",
          "description": "Filter options for templates",
          "properties": {
            "includePublic": {
              "type": "any",
              "description": "Include public community templates (default: false)"
            },
            "includeRunpod": {
              "type": "any",
              "description": "Include RunPod official templates (default: true)"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<TemplateInfo[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const templates = await runpod.listTemplates({ includeRunpod: true })\nconsole.log(templates.map(t => t.name))"
        }
      ]
    },
    "getTemplate": {
      "description": "Get details for a specific template by ID.",
      "parameters": {
        "templateId": {
          "type": "string",
          "description": "The template ID to look up"
        }
      },
      "required": [
        "templateId"
      ],
      "returns": "Promise<TemplateInfo>",
      "examples": [
        {
          "language": "ts",
          "code": "const template = await runpod.getTemplate('abc123')\nconsole.log(template.imageName)"
        }
      ]
    },
    "createPod": {
      "description": "Create a new GPU pod on RunPod.",
      "parameters": {
        "options": {
          "type": "CreatePodOptions",
          "description": "Pod configuration options",
          "properties": {
            "name": {
              "type": "string",
              "description": "Pod display name (default: 'luca-pod')"
            },
            "imageName": {
              "type": "string",
              "description": "Docker image name to run"
            },
            "gpuTypeId": {
              "type": "string | string[]",
              "description": "GPU type ID or array of acceptable GPU types"
            },
            "gpuCount": {
              "type": "number",
              "description": "Number of GPUs to allocate (default: 1)"
            },
            "templateId": {
              "type": "string",
              "description": "Template ID to use for pod configuration"
            },
            "cloudType": {
              "type": "'SECURE' | 'COMMUNITY'",
              "description": "Cloud type: 'SECURE' for dedicated or 'COMMUNITY' for shared (default: 'SECURE')"
            },
            "containerDiskInGb": {
              "type": "number",
              "description": "Container disk size in GB (default: 50)"
            },
            "volumeInGb": {
              "type": "number",
              "description": "Persistent volume size in GB (default: 20)"
            },
            "volumeMountPath": {
              "type": "string",
              "description": "Mount path for the volume (default: '/workspace')"
            },
            "ports": {
              "type": "string[]",
              "description": "Port mappings like ['8888/http', '22/tcp']"
            },
            "env": {
              "type": "Record<string, string>",
              "description": "Environment variables to set in the container"
            },
            "interruptible": {
              "type": "boolean",
              "description": "Whether the pod can be preempted for spot pricing"
            },
            "networkVolumeId": {
              "type": "string",
              "description": "ID of an existing network volume to attach"
            },
            "minRAMPerGPU": {
              "type": "number",
              "description": "Minimum RAM per GPU in GB"
            }
          }
        }
      },
      "required": [
        "options"
      ],
      "returns": "Promise<PodInfo>",
      "examples": [
        {
          "language": "ts",
          "code": "const pod = await runpod.createPod({\n gpuTypeId: 'NVIDIA RTX 4090',\n templateId: 'abc123',\n volumeInGb: 50,\n})\nconsole.log(`Pod ${pod.id} created`)"
        }
      ]
    },
    "stopPod": {
      "description": "Stop a running pod.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID to stop"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "await runpod.stopPod('pod-abc123')"
        }
      ]
    },
    "startPod": {
      "description": "Start a stopped pod.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID to start"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "await runpod.startPod('pod-abc123')"
        }
      ]
    },
    "removePod": {
      "description": "Permanently delete a pod.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID to remove"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "await runpod.removePod('pod-abc123')"
        }
      ]
    },
    "getpods": {
      "description": "Get all pods via the REST API.",
      "parameters": {
        "filters": {
          "type": "{ name?: string; imageName?: string; desiredStatus?: string }",
          "description": "Optional filters for name, image, or status",
          "properties": {
            "name": {
              "type": "any",
              "description": "Filter by pod name"
            },
            "imageName": {
              "type": "any",
              "description": "Filter by Docker image name"
            },
            "desiredStatus": {
              "type": "any",
              "description": "Filter by status (RUNNING, EXITED, TERMINATED)"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<RestPodInfo[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const pods = await runpod.getpods({ desiredStatus: 'RUNNING' })\nconsole.log(pods.map(p => `${p.name}: ${p.desiredStatus}`))"
        }
      ]
    },
    "getPod": {
      "description": "Get detailed pod info via the REST API. Returns richer data than the CLI-based `getPodInfo`, including port mappings and public IP.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID to look up"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "Promise<RestPodInfo>",
      "examples": [
        {
          "language": "ts",
          "code": "const pod = await runpod.getPod('pod-abc123')\nconsole.log(`${pod.name} - ${pod.desiredStatus} - $${pod.costPerHr}/hr`)"
        }
      ]
    },
    "waitForPod": {
      "description": "Poll until a pod reaches a desired status.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID to monitor"
        },
        "status": {
          "type": "string",
          "description": "Target status to wait for (default: 'RUNNING')"
        },
        "{ interval = 5000, timeout = 300000 }": {
          "type": "any",
          "description": "Parameter { interval = 5000, timeout = 300000 }"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "Promise<RestPodInfo>",
      "examples": [
        {
          "language": "ts",
          "code": "const pod = await runpod.createPod({ gpuTypeId: 'NVIDIA RTX 4090', templateId: 'abc' })\nconst ready = await runpod.waitForPod(pod.id, 'RUNNING', { timeout: 120000 })"
        }
      ]
    },
    "listVolumes": {
      "description": "List all network storage volumes on your account.",
      "parameters": {},
      "required": [],
      "returns": "Promise<VolumeInfo[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const volumes = await runpod.listVolumes()\nconsole.log(volumes.map(v => `${v.name}: ${v.size}GB`))"
        }
      ]
    },
    "getVolume": {
      "description": "Get details for a specific network volume.",
      "parameters": {
        "volumeId": {
          "type": "string",
          "description": "The volume ID to look up"
        }
      },
      "required": [
        "volumeId"
      ],
      "returns": "Promise<VolumeInfo>",
      "examples": [
        {
          "language": "ts",
          "code": "const vol = await runpod.getVolume('vol-abc123')\nconsole.log(`${vol.name}: ${vol.size}GB in ${vol.dataCenterId}`)"
        }
      ]
    },
    "createVolume": {
      "description": "Create a new network storage volume.",
      "parameters": {
        "options": {
          "type": "CreateVolumeOptions",
          "description": "Volume configuration",
          "properties": {
            "name": {
              "type": "string",
              "description": "Display name for the volume"
            },
            "size": {
              "type": "number",
              "description": "Size in GB"
            },
            "dataCenterId": {
              "type": "string",
              "description": "Data center to create in (defaults to feature's dataCenterId)"
            }
          }
        }
      },
      "required": [
        "options"
      ],
      "returns": "Promise<VolumeInfo>",
      "examples": [
        {
          "language": "ts",
          "code": "const vol = await runpod.createVolume({ name: 'my-models', size: 100 })\nconsole.log(`Created volume ${vol.id}`)"
        }
      ]
    },
    "removeVolume": {
      "description": "Delete a network storage volume.",
      "parameters": {
        "volumeId": {
          "type": "string",
          "description": "The volume ID to delete"
        }
      },
      "required": [
        "volumeId"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "await runpod.removeVolume('vol-abc123')"
        }
      ]
    },
    "createRemoteShell": {
      "description": "Create an SSH connection to a pod using the runpodctl CLI. Prefer `getShell()` which uses the REST API and is more reliable.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID to connect to"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const shell = await runpod.createRemoteShell('pod-abc123')\nconst output = await shell.exec('nvidia-smi')"
        }
      ]
    },
    "getShell": {
      "description": "Get an SSH connection to a pod using the REST API. Uses port mappings and public IP from the REST API, which is more reliable than the CLI-based `createRemoteShell`.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID to connect to"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const shell = await runpod.getShell('pod-abc123')\nconst output = await shell.exec('ls /workspace')"
        }
      ]
    },
    "ensureFileExists": {
      "description": "Ensure a file exists on a pod's filesystem. If missing, kicks off a background download via a helper script and polls until the file appears.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID"
        },
        "remotePath": {
          "type": "string",
          "description": "Absolute path on the pod where the file should exist"
        },
        "fallbackUrl": {
          "type": "string",
          "description": "URL to download from (inside the pod) if the file doesn't exist"
        },
        "options": {
          "type": "{\n\t\t\tpollInterval?: number\n\t\t\ttimeout?: number\n\t\t\tonProgress?: (bytes: number) => void\n\t\t}",
          "description": "Parameter options",
          "properties": {
            "pollInterval": {
              "type": "any",
              "description": "How often to check in ms (default 5000)"
            },
            "timeout": {
              "type": "any",
              "description": "Max time to wait for download in ms (default 600000 / 10 min)"
            },
            "onProgress": {
              "type": "any",
              "description": "Called each poll with current file size in bytes"
            }
          }
        }
      },
      "required": [
        "podId",
        "remotePath",
        "fallbackUrl"
      ],
      "returns": "Promise<{ existed: boolean; path: string }>",
      "examples": [
        {
          "language": "ts",
          "code": "await runpod.ensureFileExists(\n podId,\n '/workspace/ComfyUI/models/checkpoints/juggernaut_xl.safetensors',\n 'https://civitai.com/api/download/models/456789',\n { onProgress: (bytes) => console.log(`${(bytes / 1e9).toFixed(2)} GB downloaded`) }\n)"
        }
      ]
    },
    "getPodHttpURLs": {
      "description": "Get the public HTTP proxy URLs for a pod's exposed HTTP ports.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const urls = await runpod.getPodHttpURLs('pod-abc123')\n// ['https://pod-abc123-8888.proxy.runpod.net']"
        }
      ]
    },
    "listPods": {
      "description": "List all pods using the runpodctl CLI. Parses the tabular output from `runpodctl get pod`. For richer data, use `getpods()`.",
      "parameters": {
        "detailed": {
          "type": "any",
          "description": "Reserved for future use"
        }
      },
      "required": [],
      "returns": "Promise<PodInfo[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const pods = await runpod.listPods()\npods.forEach(p => console.log(`${p.name} (${p.gpu}): ${p.status}`))"
        }
      ]
    },
    "getPodInfo": {
      "description": "Get pod info using the runpodctl CLI. For richer data including port mappings and public IP, use `getPod()`.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "The pod ID to look up"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "Promise<PodInfo>",
      "examples": [
        {
          "language": "ts",
          "code": "const info = await runpod.getPodInfo('pod-abc123')\nconsole.log(`${info.name}: ${info.status}`)"
        }
      ]
    },
    "listSecureGPUs": {
      "description": "List available secure GPU types with pricing. Uses the runpodctl CLI to query available secure cloud GPUs, filtering out reserved instances.",
      "parameters": {},
      "required": [],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const gpus = await runpod.listSecureGPUs()\ngpus.forEach(g => console.log(`${g.gpuType}: $${g.ondemandPrice}/hr`))"
        }
      ]
    }
  },
  "getters": {
    "proc": {
      "description": "The proc feature used for executing CLI commands like runpodctl.",
      "returns": "any"
    },
    "runpodctlPath": {
      "description": "Resolve the runpodctl binary path, caching the result.",
      "returns": "string"
    },
    "apiKey": {
      "description": "RunPod API key from options or the RUNPOD_API_KEY environment variable.",
      "returns": "any"
    },
    "dataCenterId": {
      "description": "Preferred data center ID, defaults to 'US-TX-3'.",
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
      "code": "const runpod = container.feature('runpod', { enable: true })\nconst pod = await runpod.createPod({ gpuTypeId: 'NVIDIA RTX 4090', templateId: 'abc123' })\nconst ready = await runpod.waitForPod(pod.id)\nconst shell = await runpod.getShell(pod.id)\nawait shell.exec('nvidia-smi')"
    }
  ],
  "types": {
    "TemplateInfo": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "category": {
          "type": "string",
          "description": ""
        },
        "imageName": {
          "type": "string",
          "description": ""
        },
        "isPublic": {
          "type": "boolean",
          "description": ""
        },
        "isRunpod": {
          "type": "boolean",
          "description": ""
        },
        "isServerless": {
          "type": "boolean",
          "description": ""
        },
        "containerDiskInGb": {
          "type": "number",
          "description": ""
        },
        "volumeInGb": {
          "type": "number",
          "description": ""
        },
        "volumeMountPath": {
          "type": "string",
          "description": ""
        },
        "ports": {
          "type": "string[]",
          "description": ""
        },
        "env": {
          "type": "Record<string, string>",
          "description": ""
        },
        "readme": {
          "type": "string",
          "description": ""
        }
      }
    },
    "CreatePodOptions": {
      "description": "",
      "properties": {
        "name": {
          "type": "string",
          "description": "Pod display name (default: 'luca-pod')",
          "optional": true
        },
        "imageName": {
          "type": "string",
          "description": "Docker image name to run",
          "optional": true
        },
        "gpuTypeId": {
          "type": "string | string[]",
          "description": "GPU type ID or array of acceptable GPU types"
        },
        "gpuCount": {
          "type": "number",
          "description": "Number of GPUs to allocate (default: 1)",
          "optional": true
        },
        "templateId": {
          "type": "string",
          "description": "Template ID to use for pod configuration",
          "optional": true
        },
        "cloudType": {
          "type": "'SECURE' | 'COMMUNITY'",
          "description": "Cloud type: 'SECURE' for dedicated or 'COMMUNITY' for shared (default: 'SECURE')",
          "optional": true
        },
        "containerDiskInGb": {
          "type": "number",
          "description": "Container disk size in GB (default: 50)",
          "optional": true
        },
        "volumeInGb": {
          "type": "number",
          "description": "Persistent volume size in GB (default: 20)",
          "optional": true
        },
        "volumeMountPath": {
          "type": "string",
          "description": "Mount path for the volume (default: '/workspace')",
          "optional": true
        },
        "ports": {
          "type": "string[]",
          "description": "Port mappings like ['8888/http', '22/tcp']",
          "optional": true
        },
        "env": {
          "type": "Record<string, string>",
          "description": "Environment variables to set in the container",
          "optional": true
        },
        "interruptible": {
          "type": "boolean",
          "description": "Whether the pod can be preempted for spot pricing",
          "optional": true
        },
        "networkVolumeId": {
          "type": "string",
          "description": "ID of an existing network volume to attach",
          "optional": true
        },
        "minRAMPerGPU": {
          "type": "number",
          "description": "Minimum RAM per GPU in GB",
          "optional": true
        }
      }
    },
    "PodInfo": {
      "description": "{ \"id\": \"vv32fbi9y21cxz\", \"name\": \"RunPod Stable Diffusion\", \"gpu\": \"1 RTX 4090\", \"imageName\": \"runpod/stable-diffusion:web-ui-10.2.1\", \"status\": \"RUNNING\", \"podType\": \"RESERVED\", \"cpu\": \"21\", \"memory\": \"41\", \"containerDisk\": \"10\", \"volumeDisk\": \"0\", \"spotPrice\": \"0.690\", \"ports\": [ { \"ip\": \"100.65.22.197\", \"internal\": \"60014\", \"external\": \"8888\", \"serviceType\": \"http\", \"isPublic\": false }, { \"ip\": \"100.65.22.197\", \"internal\": \"60013\", \"external\": \"19123\", \"serviceType\": \"http\", \"isPublic\": false }, { \"ip\": \"203.57.40.89\", \"internal\": \"10020\", \"external\": \"22\", \"serviceType\": \"tcp\", \"isPublic\": true }, { \"ip\": \"100.65.22.197\", \"internal\": \"60015\", \"external\": \"3001\", \"serviceType\": \"http\", \"isPublic\": false } ] }",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "gpu": {
          "type": "string",
          "description": ""
        },
        "imageName": {
          "type": "string",
          "description": ""
        },
        "status": {
          "type": "string",
          "description": ""
        },
        "podType": {
          "type": "string",
          "description": ""
        },
        "cpu": {
          "type": "string",
          "description": ""
        },
        "memory": {
          "type": "string",
          "description": ""
        },
        "containerDisk": {
          "type": "string",
          "description": ""
        },
        "volumeDisk": {
          "type": "string",
          "description": ""
        },
        "spotPrice": {
          "type": "string",
          "description": ""
        },
        "ports": {
          "type": "PortInfo[]",
          "description": ""
        }
      }
    },
    "PortInfo": {
      "description": "",
      "properties": {
        "ip": {
          "type": "string",
          "description": ""
        },
        "internal": {
          "type": "number",
          "description": ""
        },
        "external": {
          "type": "number",
          "description": ""
        },
        "serviceType": {
          "type": "string",
          "description": ""
        },
        "isPublic": {
          "type": "boolean",
          "description": ""
        }
      }
    },
    "RestPodInfo": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "desiredStatus": {
          "type": "'RUNNING' | 'EXITED' | 'TERMINATED'",
          "description": ""
        },
        "costPerHr": {
          "type": "number",
          "description": ""
        },
        "adjustedCostPerHr": {
          "type": "number",
          "description": ""
        },
        "gpu": {
          "type": "{ id: string; count: number; displayName: string }",
          "description": ""
        },
        "machine": {
          "type": "{ dataCenterId: string; location: string; gpuTypeId: string }",
          "description": ""
        },
        "publicIp": {
          "type": "string | null",
          "description": "Public IP for SSH/TCP connections"
        },
        "ports": {
          "type": "string[]",
          "description": ""
        },
        "portMappings": {
          "type": "Record<string, number> | null",
          "description": "Maps internal port (e.g. \"22\") to external port number (e.g. 22122)"
        },
        "containerDiskInGb": {
          "type": "number",
          "description": ""
        },
        "volumeInGb": {
          "type": "number",
          "description": ""
        },
        "memoryInGb": {
          "type": "number",
          "description": ""
        },
        "vcpuCount": {
          "type": "number",
          "description": ""
        },
        "image": {
          "type": "string",
          "description": ""
        }
      }
    },
    "VolumeInfo": {
      "description": "",
      "properties": {
        "id": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "size": {
          "type": "number",
          "description": ""
        },
        "dataCenterId": {
          "type": "string",
          "description": ""
        }
      }
    },
    "CreateVolumeOptions": {
      "description": "",
      "properties": {
        "name": {
          "type": "string",
          "description": "Display name for the volume"
        },
        "size": {
          "type": "number",
          "description": "Size in GB"
        },
        "dataCenterId": {
          "type": "string",
          "description": "Data center to create in (defaults to feature's dataCenterId)",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.helpers', {
  "id": "features.helpers",
  "description": "The Helpers feature is a unified gateway for discovering and registering project-level helpers from conventional folder locations. It scans known folder names (features/, clients/, servers/, commands/, endpoints/, selectors/) and handles registration differently based on the helper type: - Class-based (features, clients, servers): Dynamic import, validate subclass, register - Config-based (commands, endpoints, selectors): Delegate to existing discovery mechanisms",
  "shortcut": "features.helpers",
  "className": "Helpers",
  "methods": {
    "seedVirtualModules": {
      "description": "Seeds the VM feature with virtual modules so that project-level files can `import` / `require('@soederpop/luca')`, `zod`, etc. without needing them in `node_modules`. Called automatically when `useNativeImport` is false. Can also be called externally (e.g. from the CLI) to pre-seed before discovery.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "discover": {
      "description": "Discover and register project-level helpers of the given type. Idempotent: the first caller triggers the actual scan. Subsequent callers receive the cached results. If discovery is in-flight, callers await the same promise — no duplicate work.",
      "parameters": {
        "type": {
          "type": "RegistryType",
          "description": "Which type of helpers to discover"
        },
        "options": {
          "type": "{ directory?: string }",
          "description": "Optional overrides",
          "properties": {
            "directory": {
              "type": "any",
              "description": "Override the directory to scan"
            }
          }
        }
      },
      "required": [
        "type"
      ],
      "returns": "Promise<string[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const names = await container.helpers.discover('features')\nconsole.log(names) // ['myCustomFeature']"
        }
      ]
    },
    "discoverAll": {
      "description": "Discover all helper types from their conventional folder locations. Idempotent: safe to call from multiple places (luca.cli.ts, commands, etc.). The first caller triggers discovery; all others receive the same results.",
      "parameters": {},
      "required": [],
      "returns": "Promise<Record<string, string[]>>",
      "examples": [
        {
          "language": "ts",
          "code": "const results = await container.helpers.discoverAll()\n// { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }"
        }
      ]
    },
    "lookup": {
      "description": "Look up a helper class by type and name.",
      "parameters": {
        "type": {
          "type": "RegistryType",
          "description": "The registry type (features, clients, servers, commands, endpoints)"
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
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const FsClass = container.helpers.lookup('features', 'fs')"
        }
      ]
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
    },
    "loadModuleExports": {
      "description": "Load a module either via native `import()` or the VM's virtual module system. Uses the same `useNativeImport` check as discovery to decide the loading strategy.",
      "parameters": {
        "absPath": {
          "type": "string",
          "description": "Absolute path to the module file"
        },
        "options": {
          "type": "{ cacheBust?: boolean }",
          "description": "Optional settings",
          "properties": {
            "cacheBust": {
              "type": "any",
              "description": "When true, appends a timestamp query to bypass the native import cache (useful for hot reload)"
            }
          }
        }
      },
      "required": [
        "absPath"
      ],
      "returns": "Promise<Record<string, any>>"
    }
  },
  "getters": {
    "rootDir": {
      "description": "The root directory to scan for helper folders.",
      "returns": "string"
    },
    "useNativeImport": {
      "description": "Whether to use native `import()` for loading project helpers. True only if `@soederpop/luca` is actually resolvable in `node_modules`. Warns when `node_modules` exists but the package is missing.",
      "returns": "boolean"
    },
    "available": {
      "description": "Returns a unified view of all available helpers across all registries. Each key is a registry type, each value is the list of helper names in that registry.",
      "returns": "Record<string, string[]>",
      "examples": [
        {
          "language": "ts",
          "code": "container.helpers.available\n// { features: ['fs', 'git', ...], clients: ['rest', 'websocket'], ... }"
        }
      ]
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const helpers = container.feature('helpers', { enable: true })\n\n// Discover all helper types\nawait helpers.discoverAll()\n\n// Discover a specific type\nawait helpers.discover('features')\n\n// Unified view of all available helpers\nconsole.log(helpers.available)"
    }
  ]
});

setBuildTimeData('features.fileManager', {
  "id": "features.fileManager",
  "description": "The FileManager feature creates a database like index of all of the files in the project, and provides metadata about these files, and also provides a way to watch for changes to the files.",
  "shortcut": "features.fileManager",
  "className": "FileManager",
  "methods": {
    "match": {
      "description": "Matches the file IDs against the pattern(s) provided",
      "parameters": {
        "patterns": {
          "type": "string | string[]",
          "description": "The patterns to match against the file IDs"
        }
      },
      "required": [
        "patterns"
      ],
      "returns": "string[]"
    },
    "matchFiles": {
      "description": "Matches the file IDs against the pattern(s) provided and returns the file objects for each.",
      "parameters": {
        "patterns": {
          "type": "string | string[]",
          "description": "The patterns to match against the file IDs"
        }
      },
      "required": [
        "patterns"
      ],
      "returns": "(File | undefined)[]"
    },
    "start": {
      "description": "Starts the file manager and scans the files in the project.",
      "parameters": {
        "options": {
          "type": "{ exclude?: string | string[] }",
          "description": "Options for the file manager",
          "properties": {
            "exclude": {
              "type": "any",
              "description": "The patterns to exclude from the scan"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "scanFiles": {
      "description": "Scans the files in the project and updates the file manager state.",
      "parameters": {
        "options": {
          "type": "{ exclude?: string | string[] }",
          "description": "Options for the file manager",
          "properties": {
            "exclude": {
              "type": "any",
              "description": "The patterns to exclude from the scan"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "watch": {
      "description": "Watches directories for file changes. Can be called multiple times to add more directories to an existing watcher. Tracks all watched paths in state. When called without `paths`, watches the project's `directoryIds` (default behavior). When called with `paths`, watches only those specific directories/globs. Subsequent calls add to the existing watcher — they never replace what's already watched.",
      "parameters": {
        "options": {
          "type": "{ paths?: string | string[]; exclude?: string | string[] }",
          "description": "Options for the file manager",
          "properties": {
            "paths": {
              "type": "any",
              "description": "Specific directories or globs to watch. Defaults to project directoryIds."
            },
            "exclude": {
              "type": "any",
              "description": "The patterns to exclude from the watch"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<void>"
    },
    "stopWatching": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "updateFile": {
      "description": "",
      "parameters": {
        "path": {
          "type": "string",
          "description": "Parameter path"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<void>"
    },
    "removeFile": {
      "description": "",
      "parameters": {
        "path": {
          "type": "string",
          "description": "Parameter path"
        }
      },
      "required": [
        "path"
      ],
      "returns": "Promise<void>"
    }
  },
  "getters": {
    "fileIds": {
      "description": "Returns an array of all relative file paths indexed by the file manager.",
      "returns": "string[]"
    },
    "fileObjects": {
      "description": "Returns an array of all file metadata objects indexed by the file manager.",
      "returns": "File[]"
    },
    "directoryIds": {
      "description": "Returns the directory IDs for all of the files in the project.",
      "returns": "string[]"
    },
    "uniqueExtensions": {
      "description": "Returns an array of unique file extensions found across all indexed files.",
      "returns": "string[]"
    },
    "isStarted": {
      "description": "Whether the file manager has completed its initial scan.",
      "returns": "boolean"
    },
    "isStarting": {
      "description": "Whether the file manager is currently performing its initial scan.",
      "returns": "boolean"
    },
    "isWatching": {
      "description": "Whether the file watcher is actively monitoring for changes.",
      "returns": "boolean"
    },
    "watchedPaths": {
      "description": "Returns the list of directories currently being watched.",
      "returns": "string[]"
    },
    "watchedFiles": {
      "description": "Returns the directories and files currently being watched by chokidar.",
      "returns": "Record<string, string[]>"
    }
  },
  "events": {
    "file:change": {
      "name": "file:change",
      "description": "Event emitted by FileManager",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const fileManager = container.feature('fileManager')\nawait fileManager.start()\n\nconst fileIds = fileManager.fileIds\nconst typescriptFiles = fileManager.matchFiles(\"**ts\")"
    }
  ],
  "types": {
    "File": {
      "description": "",
      "properties": {
        "absolutePath": {
          "type": "string",
          "description": ""
        },
        "relativePath": {
          "type": "string",
          "description": ""
        },
        "relativeDirname": {
          "type": "string",
          "description": ""
        },
        "dirname": {
          "type": "string",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "extension": {
          "type": "string",
          "description": ""
        },
        "size": {
          "type": "number",
          "description": ""
        },
        "modifiedAt": {
          "type": "Date",
          "description": ""
        },
        "createdAt": {
          "type": "Date",
          "description": ""
        }
      }
    }
  }
});

setBuildTimeData('features.contentDb', {
  "id": "features.contentDb",
  "description": "Provides access to a Contentbase Collection for a folder of structured markdown files. Models are defined in the collection's models.ts file and auto-discovered on load. This feature is a thin wrapper that manages the collection lifecycle and provides convenience accessors for models and documents.",
  "shortcut": "features.contentDb",
  "className": "ContentDb",
  "methods": {
    "setupToolsConsumer": {
      "description": "When an assistant uses contentDb, inject system prompt guidance about progressive document exploration.",
      "parameters": {
        "consumer": {
          "type": "Helper",
          "description": "Parameter consumer"
        }
      },
      "required": [
        "consumer"
      ],
      "returns": "void"
    },
    "renderTree": {
      "description": "Render a tree view of the collection directory structure. Built with container.fs so it works without the `tree` binary.",
      "parameters": {
        "options": {
          "type": "{ depth?: number; dirsOnly?: boolean }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "string"
    },
    "grep": {
      "description": "",
      "parameters": {
        "options": {
          "type": "string | GrepOptions",
          "description": "Parameter options"
        }
      },
      "required": [
        "options"
      ],
      "returns": "void"
    },
    "query": {
      "description": "Query documents belonging to a specific model definition.",
      "parameters": {
        "model": {
          "type": "T",
          "description": "The model definition to query against"
        }
      },
      "required": [
        "model"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const contentDb = container.feature('contentDb', { rootPath: './docs' })\nawait contentDb.load()\nconst articles = await contentDb.query(contentDb.models.Article).fetchAll()"
        }
      ]
    },
    "parseMarkdownAtPath": {
      "description": "Parse a markdown file at the given path without loading the full collection.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "Absolute or relative path to the markdown file"
        }
      },
      "required": [
        "path"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const doc = contentDb.parseMarkdownAtPath('./docs/getting-started.md')\nconsole.log(doc.frontmatter, doc.content)"
        }
      ]
    },
    "load": {
      "description": "Load the collection, discovering models from models.ts and parsing all documents.",
      "parameters": {},
      "required": [],
      "returns": "Promise<ContentDb>",
      "examples": [
        {
          "language": "ts",
          "code": "const contentDb = container.feature('contentDb', { rootPath: './docs' })\nawait contentDb.load()\nconsole.log(contentDb.isLoaded) // true"
        }
      ]
    },
    "reload": {
      "description": "Force-reload the collection from disk, picking up new/changed/deleted documents.",
      "parameters": {},
      "required": [],
      "returns": "Promise<ContentDb>"
    },
    "read": {
      "description": "Read a single document by its path ID, optionally filtering to specific sections. The document title (H1) is always included in the output. When using `include`, the leading content (paragraphs between the H1 and first H2) is also included by default, controlled by the `leadingContent` option. When `include` is provided, only those sections are returned (via extractSections in flat mode). When `exclude` is provided, those sections are removed from the full document. If both are set, `include` takes precedence.",
      "parameters": {
        "idStringOrObject": {
          "type": "string | { id: string }",
          "description": "Document path ID string, or an object with an `id` property"
        },
        "options": {
          "type": "{ exclude?: string[], include?: string[], meta?: boolean, leadingContent?: boolean }",
          "description": "Optional filtering and formatting options",
          "properties": {
            "include": {
              "type": "any",
              "description": "Only return sections matching these heading names"
            },
            "exclude": {
              "type": "any",
              "description": "Remove sections matching these heading names"
            },
            "meta": {
              "type": "any",
              "description": "Whether to include YAML frontmatter in the output (default: false)"
            },
            "leadingContent": {
              "type": "any",
              "description": "Include content between the H1 and first H2 when using include filter (default: true)"
            }
          }
        }
      },
      "required": [
        "idStringOrObject"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "await contentDb.read('guides/intro')\nawait contentDb.read('guides/intro', { include: ['Installation', 'Usage'] })\nawait contentDb.read('guides/intro', { exclude: ['Changelog'], meta: true })\nawait contentDb.read('guides/intro', { include: ['API'], leadingContent: false })"
        }
      ]
    },
    "readMultiple": {
      "description": "Read multiple documents by their path IDs, concatenated into a single string. By default each document is wrapped in `<!-- BEGIN: id -->` / `<!-- END: id -->` dividers for easy identification. Supports the same filtering options as {@link read}.",
      "parameters": {
        "ids": {
          "type": "string[] | { id: string }[]",
          "description": "Array of document path ID strings or objects with `id` properties"
        },
        "options": {
          "type": "{ exclude?: string[], include?: string[], meta?: boolean, leadingContent?: boolean, dividers?: boolean }",
          "description": "Optional filtering and formatting options (applied to each document)",
          "properties": {
            "dividers": {
              "type": "any",
              "description": "Wrap each document in BEGIN/END comment dividers showing the ID (default: true)"
            }
          }
        }
      },
      "required": [
        "ids"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "await contentDb.readMultiple(['guides/intro', 'guides/setup'])\nawait contentDb.readMultiple([{ id: 'guides/intro' }], { include: ['Overview'], dividers: false })"
        }
      ]
    },
    "generateTableOfContents": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "generateModelSummary": {
      "description": "",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [
        "options"
      ],
      "returns": "void"
    },
    "search": {
      "description": "BM25 keyword search across indexed documents. If no search index exists, throws with an actionable message.",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Parameter query"
        },
        "options": {
          "type": "{ limit?: number; model?: string; where?: Record<string, any> }",
          "description": "Parameter options"
        }
      },
      "required": [
        "query"
      ],
      "returns": "void"
    },
    "vectorSearch": {
      "description": "Vector similarity search using embeddings. Finds conceptually related documents even without keyword matches.",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Parameter query"
        },
        "options": {
          "type": "{ limit?: number; model?: string; where?: Record<string, any> }",
          "description": "Parameter options"
        }
      },
      "required": [
        "query"
      ],
      "returns": "void"
    },
    "hybridSearch": {
      "description": "Combined keyword + semantic search with Reciprocal Rank Fusion. Best for general questions about the collection.",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Parameter query"
        },
        "options": {
          "type": "{ limit?: number; model?: string; where?: Record<string, any>; ftsWeight?: number; vecWeight?: number }",
          "description": "Parameter options"
        }
      },
      "required": [
        "query"
      ],
      "returns": "void"
    },
    "buildSearchIndex": {
      "description": "Build the search index from all documents in the collection. Chunks documents and generates embeddings.",
      "parameters": {
        "options": {
          "type": "{ force?: boolean; embeddingProvider?: string; embeddingModel?: string; onProgress?: (indexed: number, total: number) => void }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "void"
    },
    "rebuildSearchIndex": {
      "description": "Rebuild the entire search index from scratch.",
      "parameters": {
        "options": {
          "type": "{ embeddingProvider?: string; embeddingModel?: string; onProgress?: (indexed: number, total: number) => void }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "void"
    },
    "getCollectionOverview": {
      "description": "Returns a high-level overview of the collection.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "listDocuments": {
      "description": "List document IDs, optionally filtered by model or glob.",
      "parameters": {
        "args": {
          "type": "{ model?: string; glob?: string }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "readDocument": {
      "description": "Read a single document with optional section filtering.",
      "parameters": {
        "args": {
          "type": "{ id: string; include?: string[]; exclude?: string[]; meta?: boolean }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "readMultipleDocuments": {
      "description": "Read multiple documents with optional section filtering.",
      "parameters": {
        "args": {
          "type": "{ ids: string[]; include?: string[]; exclude?: string[]; meta?: boolean }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "queryDocuments": {
      "description": "Query documents by model with filters, sort, limit.",
      "parameters": {
        "args": {
          "type": "{ model: string; where?: string; sort?: string; limit?: number; offset?: number; select?: string[] }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "searchContent": {
      "description": "Grep/text search across the collection.",
      "parameters": {
        "args": {
          "type": "{ pattern: string; caseSensitive?: boolean }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    },
    "semanticSearch": {
      "description": "Hybrid semantic search with graceful fallback to grep.",
      "parameters": {
        "args": {
          "type": "{ query: string; limit?: number }",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "isLoaded": {
      "description": "Whether the content database has been loaded.",
      "returns": "boolean"
    },
    "collection": {
      "description": "Returns the lazily-initialized Collection instance for the configured rootPath.",
      "returns": "Collection"
    },
    "collectionPath": {
      "description": "Returns the absolute resolved path to the collection root directory.",
      "returns": "string"
    },
    "models": {
      "description": "Returns an object mapping model names to their model definitions, sourced from the collection.",
      "returns": "Record<string, ModelDefinition>"
    },
    "modelNames": {
      "description": "Returns an array of all registered model names from the collection.",
      "returns": "string[]"
    },
    "available": {
      "description": "Returns the available document ids in the collection",
      "returns": "string[]"
    },
    "modelDefinitionTable": {
      "description": "",
      "returns": "Record<string, { description: string; glob: string; routePatterns: string[] }>"
    },
    "fileTree": {
      "description": "",
      "returns": "string"
    },
    "searchIndexStatus": {
      "description": "Get the current search index status.",
      "returns": "{ exists: boolean; documentCount: number; chunkCount: number; embeddingCount: number; lastIndexedAt: any; provider: any; model: any; dimensions: number; dbSizeBytes: number }"
    },
    "queries": {
      "description": "Returns an object with query builders keyed by model name (singular and plural, lowercased). Provides a convenient shorthand for querying without looking up model definitions manually.",
      "returns": "Record<string, ReturnType<typeof this.query>>",
      "examples": [
        {
          "language": "ts",
          "code": "const contentDb = container.feature('contentDb', { rootPath: './docs' })\nawait contentDb.load()\nconst allArticles = await contentDb.queries.articles.fetchAll()\nconst firstTask = await contentDb.queries.task.first()"
        }
      ]
    }
  },
  "events": {
    "reloaded": {
      "name": "reloaded",
      "description": "Event emitted by ContentDb",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const contentDb = container.feature('contentDb', { rootPath: './docs' })\nawait contentDb.load()\nconsole.log(contentDb.modelNames) // ['Article', 'Page', ...]"
    }
  ]
});

setBuildTimeData('clients.graph', {
  "id": "clients.graph",
  "description": "GraphQL client that wraps RestClient with convenience methods for executing queries and mutations. Automatically handles the GraphQL request envelope (query/variables/operationName) and unwraps responses, extracting the `data` field and emitting events for GraphQL-level errors.",
  "shortcut": "clients.graph",
  "className": "GraphClient",
  "methods": {
    "query": {
      "description": "Execute a GraphQL query and return the unwrapped data.",
      "parameters": {
        "query": {
          "type": "string",
          "description": "The GraphQL query string"
        },
        "variables": {
          "type": "Record<string, any>",
          "description": "Optional variables for the query"
        },
        "operationName": {
          "type": "string",
          "description": "Optional operation name when the query contains multiple operations"
        }
      },
      "required": [
        "query"
      ],
      "returns": "Promise<R>"
    },
    "mutate": {
      "description": "Execute a GraphQL mutation and return the unwrapped data. Semantically identical to query() but named for clarity when performing mutations.",
      "parameters": {
        "mutation": {
          "type": "string",
          "description": "The GraphQL mutation string"
        },
        "variables": {
          "type": "Record<string, any>",
          "description": "Optional variables for the mutation"
        },
        "operationName": {
          "type": "string",
          "description": "Optional operation name when the mutation contains multiple operations"
        }
      },
      "required": [
        "mutation"
      ],
      "returns": "Promise<R>"
    }
  },
  "getters": {
    "endpoint": {
      "description": "The GraphQL endpoint path. Defaults to '/graphql'.",
      "returns": "any"
    }
  },
  "events": {
    "graphqlError": {
      "name": "graphqlError",
      "description": "Event emitted by GraphClient",
      "arguments": {}
    },
    "failure": {
      "name": "failure",
      "description": "Event emitted by GraphClient",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const gql = container.client('graph', { baseURL: 'https://api.example.com' })\nconst data = await gql.query(`{ users { id name } }`)\nawait gql.mutate(`mutation($name: String!) { createUser(name: $name) { id } }`, { name: 'Alice' })"
    }
  ]
});

setBuildTimeData('clients.rest', {
  "id": "clients.rest",
  "description": "HTTP REST client built on top of axios. Provides convenience methods for GET, POST, PUT, PATCH, and DELETE requests with automatic JSON handling, configurable base URL, and error event emission.",
  "shortcut": "clients.rest",
  "className": "RestClient",
  "methods": {
    "beforeRequest": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "patch": {
      "description": "Send a PATCH request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
      "parameters": {
        "url": {
          "type": "string",
          "description": "Request path relative to baseURL"
        },
        "data": {
          "type": "any",
          "description": "Request body"
        },
        "options": {
          "type": "AxiosRequestConfig",
          "description": "Additional axios request config"
        }
      },
      "required": [
        "url"
      ],
      "returns": "Promise<any>"
    },
    "put": {
      "description": "Send a PUT request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
      "parameters": {
        "url": {
          "type": "string",
          "description": "Request path relative to baseURL"
        },
        "data": {
          "type": "any",
          "description": "Request body"
        },
        "options": {
          "type": "AxiosRequestConfig",
          "description": "Additional axios request config"
        }
      },
      "required": [
        "url"
      ],
      "returns": "Promise<any>"
    },
    "post": {
      "description": "Send a POST request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
      "parameters": {
        "url": {
          "type": "string",
          "description": "Request path relative to baseURL"
        },
        "data": {
          "type": "any",
          "description": "Request body"
        },
        "options": {
          "type": "AxiosRequestConfig",
          "description": "Additional axios request config"
        }
      },
      "required": [
        "url"
      ],
      "returns": "Promise<any>"
    },
    "delete": {
      "description": "Send a DELETE request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
      "parameters": {
        "url": {
          "type": "string",
          "description": "Request path relative to baseURL"
        },
        "params": {
          "type": "any",
          "description": "Query parameters"
        },
        "options": {
          "type": "AxiosRequestConfig",
          "description": "Additional axios request config"
        }
      },
      "required": [
        "url"
      ],
      "returns": "Promise<any>"
    },
    "get": {
      "description": "Send a GET request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
      "parameters": {
        "url": {
          "type": "string",
          "description": "Request path relative to baseURL"
        },
        "params": {
          "type": "any",
          "description": "Query parameters"
        },
        "options": {
          "type": "AxiosRequestConfig",
          "description": "Additional axios request config"
        }
      },
      "required": [
        "url"
      ],
      "returns": "Promise<any>"
    },
    "handleError": {
      "description": "Handle an axios error by emitting 'failure' and returning the error as JSON.",
      "parameters": {
        "error": {
          "type": "AxiosError",
          "description": "Parameter error"
        }
      },
      "required": [
        "error"
      ],
      "returns": "Promise<object>"
    }
  },
  "getters": {
    "useJSON": {
      "description": "Whether JSON content-type headers should be set automatically.",
      "returns": "any"
    },
    "baseURL": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {
    "failure": {
      "name": "failure",
      "description": "Event emitted by RestClient",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })\nconst users = await api.get('/users')\nawait api.post('/users', { name: 'Alice' })"
    }
  ]
});

setBuildTimeData('clients.websocket', {
  "id": "clients.websocket",
  "description": "WebSocketClient helper",
  "shortcut": "clients.websocket",
  "className": "WebSocketClient",
  "methods": {
    "connect": {
      "description": "Establish a WebSocket connection to the configured baseURL. Wires all raw WebSocket events (open, message, close, error) to the Helper event bus and updates connection state accordingly. Resolves once the connection is open; rejects on error.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "send": {
      "description": "Send data over the WebSocket connection. Automatically JSON-serializes the payload. If not currently connected, attempts to connect first.",
      "parameters": {
        "data": {
          "type": "any",
          "description": "The data to send (will be JSON.stringify'd)"
        }
      },
      "required": [
        "data"
      ],
      "returns": "Promise<void>"
    },
    "ask": {
      "description": "Send a request and wait for a correlated response. The message is sent with a unique `requestId`; the remote side is expected to reply with a message containing `replyTo` set to that same ID.",
      "parameters": {
        "type": {
          "type": "string",
          "description": "A string identifying the request type"
        },
        "data": {
          "type": "any",
          "description": "Optional payload to include with the request"
        },
        "timeout": {
          "type": "any",
          "description": "How long to wait for a response (default 10 000 ms)"
        }
      },
      "required": [
        "type"
      ],
      "returns": "Promise<R>",
      "examples": [
        {
          "language": "ts",
          "code": "const result = await ws.ask('getUser', { id: 42 })"
        }
      ]
    },
    "disconnect": {
      "description": "Gracefully close the WebSocket connection. Suppresses auto-reconnect and updates connection state to disconnected.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    }
  },
  "getters": {
    "hasError": {
      "description": "Whether the client is in an error state.",
      "returns": "any"
    }
  },
  "events": {
    "open": {
      "name": "open",
      "description": "Event emitted by WebSocketClient",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by WebSocketClient",
      "arguments": {}
    },
    "message": {
      "name": "message",
      "description": "Event emitted by WebSocketClient",
      "arguments": {}
    },
    "close": {
      "name": "close",
      "description": "Event emitted by WebSocketClient",
      "arguments": {}
    },
    "reconnecting": {
      "name": "reconnecting",
      "description": "Event emitted by WebSocketClient",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('clients.openai', {
  "id": "clients.openai",
  "description": "OpenAI client — wraps the OpenAI SDK for chat completions, responses API, embeddings, and image generation. Provides convenience methods for common operations while tracking token usage and request counts. Supports both the Chat Completions API and the newer Responses API.",
  "shortcut": "clients.openai",
  "className": "OpenAIClient",
  "methods": {
    "connect": {
      "description": "Test the API connection by listing models.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>",
      "examples": [
        {
          "language": "ts",
          "code": "await openai.connect()"
        }
      ]
    },
    "createChatCompletion": {
      "description": "Create a chat completion using the Chat Completions API.",
      "parameters": {
        "messages": {
          "type": "OpenAI.Chat.Completions.ChatCompletionMessageParam[]",
          "description": "Array of chat messages"
        },
        "options": {
          "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
          "description": "Additional parameters for the completion"
        }
      },
      "required": [
        "messages"
      ],
      "returns": "Promise<OpenAI.Chat.Completions.ChatCompletion>",
      "examples": [
        {
          "language": "ts",
          "code": "const response = await openai.createChatCompletion([\n { role: 'system', content: 'You are a helpful assistant.' },\n { role: 'user', content: 'Hello!' }\n])\nconsole.log(response.choices[0]?.message?.content)"
        }
      ]
    },
    "createResponse": {
      "description": "Create a response using the Responses API.",
      "parameters": {
        "input": {
          "type": "OpenAI.Responses.ResponseInput | string",
          "description": "The input prompt or message array"
        },
        "options": {
          "type": "Partial<OpenAI.Responses.ResponseCreateParamsNonStreaming>",
          "description": "Additional parameters for the response"
        }
      },
      "required": [
        "input"
      ],
      "returns": "Promise<OpenAI.Responses.Response>",
      "examples": [
        {
          "language": "ts",
          "code": "const response = await openai.createResponse('Explain quantum computing')"
        }
      ]
    },
    "streamResponse": {
      "description": "Stream a response using the Responses API.",
      "parameters": {
        "input": {
          "type": "OpenAI.Responses.ResponseInput | string",
          "description": "The input prompt or message array"
        },
        "options": {
          "type": "Partial<OpenAI.Responses.ResponseCreateParamsStreaming>",
          "description": "Additional parameters for the streaming response"
        }
      },
      "required": [
        "input"
      ],
      "returns": "Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>",
      "examples": [
        {
          "language": "ts",
          "code": "const stream = await openai.streamResponse('Write a poem')\nfor await (const event of stream) {\n if (event.type === 'response.output_text.delta') {\n   process.stdout.write(event.delta)\n }\n}"
        }
      ]
    },
    "createCompletion": {
      "description": "Create a legacy text completion.",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "The text prompt to complete"
        },
        "options": {
          "type": "Partial<OpenAI.Completions.CompletionCreateParams>",
          "description": "Additional parameters for the completion"
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<OpenAI.Completions.Completion>",
      "examples": [
        {
          "language": "ts",
          "code": "const response = await openai.createCompletion('Once upon a time')"
        }
      ]
    },
    "createEmbedding": {
      "description": "Create text embeddings for semantic search or similarity comparisons.",
      "parameters": {
        "input": {
          "type": "string | string[]",
          "description": "A string or array of strings to embed"
        },
        "options": {
          "type": "Partial<OpenAI.Embeddings.EmbeddingCreateParams>",
          "description": "Additional parameters (model, etc.)"
        }
      },
      "required": [
        "input"
      ],
      "returns": "Promise<OpenAI.Embeddings.CreateEmbeddingResponse>",
      "examples": [
        {
          "language": "ts",
          "code": "const response = await openai.createEmbedding('Hello world')\nconsole.log(response.data[0].embedding.length)"
        }
      ]
    },
    "createImage": {
      "description": "Generate an image from a text prompt using DALL-E.",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "Description of the image to generate"
        },
        "options": {
          "type": "Partial<OpenAI.Images.ImageGenerateParams>",
          "description": "Additional parameters (size, n, etc.)"
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<OpenAI.Images.ImagesResponse>",
      "examples": [
        {
          "language": "ts",
          "code": "const response = await openai.createImage('A sunset over mountains')\nconsole.log(response.data[0].url)"
        }
      ]
    },
    "listModels": {
      "description": "List all available models.",
      "parameters": {},
      "required": [],
      "returns": "Promise<OpenAI.Models.ModelsPage>",
      "examples": [
        {
          "language": "ts",
          "code": "const models = await openai.listModels()"
        }
      ]
    },
    "ask": {
      "description": "Ask a single question and get a text response. Convenience wrapper around `createChatCompletion` for simple Q&A.",
      "parameters": {
        "question": {
          "type": "string",
          "description": "The question to ask"
        },
        "options": {
          "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
          "description": "Additional completion parameters"
        }
      },
      "required": [
        "question"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const answer = await openai.ask('What is 2 + 2?')\nconsole.log(answer) // '4'"
        }
      ]
    },
    "chat": {
      "description": "Send a multi-turn conversation and get a text response. Convenience wrapper around `createChatCompletion` that returns just the text.",
      "parameters": {
        "messages": {
          "type": "OpenAI.Chat.Completions.ChatCompletionMessageParam[]",
          "description": "Array of chat messages"
        },
        "options": {
          "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
          "description": "Additional completion parameters"
        }
      },
      "required": [
        "messages"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const reply = await openai.chat([\n { role: 'system', content: 'You are a pirate.' },\n { role: 'user', content: 'Hello!' }\n])"
        }
      ]
    }
  },
  "getters": {
    "defaultModel": {
      "description": "The default model used for completions, from options or 'gpt-4o'.",
      "returns": "string"
    },
    "raw": {
      "description": "The underlying OpenAI SDK instance for advanced use cases.",
      "returns": "OpenAI"
    }
  },
  "events": {
    "connected": {
      "name": "connected",
      "description": "Event emitted by OpenAIClient",
      "arguments": {}
    },
    "failure": {
      "name": "failure",
      "description": "Event emitted by OpenAIClient",
      "arguments": {}
    },
    "completion": {
      "name": "completion",
      "description": "Event emitted by OpenAIClient",
      "arguments": {}
    },
    "embedding": {
      "name": "embedding",
      "description": "Event emitted by OpenAIClient",
      "arguments": {}
    },
    "image": {
      "name": "image",
      "description": "Event emitted by OpenAIClient",
      "arguments": {}
    },
    "models": {
      "name": "models",
      "description": "Event emitted by OpenAIClient",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const openai = container.client('openai', { defaultModel: 'gpt-4o' })\nconst answer = await openai.ask('What is the meaning of life?')\nconsole.log(answer)"
    }
  ]
});

setBuildTimeData('clients.voicebox', {
  "id": "clients.voicebox",
  "description": "VoiceBox client — local TTS synthesis via VoiceBox.sh REST API (Qwen3-TTS). Provides methods for managing voice profiles and generating speech audio locally. Uses the streaming endpoint for synchronous synthesis (returns WAV buffer).",
  "shortcut": "clients.voicebox",
  "className": "VoiceBoxClient",
  "methods": {
    "connect": {
      "description": "Validate the VoiceBox server is reachable by hitting the health endpoint.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "listProfiles": {
      "description": "List all voice profiles.",
      "parameters": {},
      "required": [],
      "returns": "Promise<any[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const profiles = await vb.listProfiles()\nconsole.log(profiles.map(p => `${p.name} (${p.sample_count} samples)`))"
        }
      ]
    },
    "getProfile": {
      "description": "Get a single voice profile by ID.",
      "parameters": {
        "profileId": {
          "type": "string",
          "description": "Parameter profileId"
        }
      },
      "required": [
        "profileId"
      ],
      "returns": "Promise<any>"
    },
    "createProfile": {
      "description": "Create a new voice profile.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Parameter name"
        },
        "options": {
          "type": "{ description?: string; language?: string }",
          "description": "Parameter options"
        }
      },
      "required": [
        "name"
      ],
      "returns": "Promise<any>"
    },
    "listEffects": {
      "description": "List available audio effects and their parameter definitions.",
      "parameters": {},
      "required": [],
      "returns": "Promise<any>"
    },
    "synthesize": {
      "description": "Synthesize speech from text using the streaming endpoint. Returns audio as a WAV Buffer (synchronous — blocks until audio is ready).",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to convert to speech"
        },
        "options": {
          "type": "SynthesizeOptions",
          "description": "Profile, engine, model, and other synthesis options",
          "properties": {
            "profileId": {
              "type": "string",
              "description": ""
            },
            "engine": {
              "type": "string",
              "description": ""
            },
            "modelSize": {
              "type": "string",
              "description": ""
            },
            "language": {
              "type": "string",
              "description": ""
            },
            "instruct": {
              "type": "string",
              "description": ""
            },
            "seed": {
              "type": "number",
              "description": ""
            },
            "maxChunkChars": {
              "type": "number",
              "description": ""
            },
            "crossfadeMs": {
              "type": "number",
              "description": ""
            },
            "normalize": {
              "type": "boolean",
              "description": ""
            },
            "effectsChain": {
              "type": "EffectConfig[]",
              "description": ""
            },
            "disableCache": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "text"
      ],
      "returns": "Promise<Buffer>",
      "examples": [
        {
          "language": "ts",
          "code": "const audio = await vb.synthesize('Hello world', { profileId: 'abc-123' })\n// audio is a Buffer of WAV data"
        }
      ]
    },
    "generate": {
      "description": "Generate speech asynchronously (returns metadata, not audio). Use getAudio() to fetch the audio after generation completes.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        },
        "options": {
          "type": "SynthesizeOptions",
          "description": "Parameter options",
          "properties": {
            "profileId": {
              "type": "string",
              "description": ""
            },
            "engine": {
              "type": "string",
              "description": ""
            },
            "modelSize": {
              "type": "string",
              "description": ""
            },
            "language": {
              "type": "string",
              "description": ""
            },
            "instruct": {
              "type": "string",
              "description": ""
            },
            "seed": {
              "type": "number",
              "description": ""
            },
            "maxChunkChars": {
              "type": "number",
              "description": ""
            },
            "crossfadeMs": {
              "type": "number",
              "description": ""
            },
            "normalize": {
              "type": "boolean",
              "description": ""
            },
            "effectsChain": {
              "type": "EffectConfig[]",
              "description": ""
            },
            "disableCache": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "text"
      ],
      "returns": "Promise<any>"
    },
    "getAudio": {
      "description": "Fetch generated audio by generation ID. Returns WAV Buffer.",
      "parameters": {
        "generationId": {
          "type": "string",
          "description": "Parameter generationId"
        }
      },
      "required": [
        "generationId"
      ],
      "returns": "Promise<Buffer>"
    },
    "say": {
      "description": "Synthesize and write audio to a file.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        },
        "outputPath": {
          "type": "string",
          "description": "Parameter outputPath"
        },
        "options": {
          "type": "SynthesizeOptions",
          "description": "Parameter options",
          "properties": {
            "profileId": {
              "type": "string",
              "description": ""
            },
            "engine": {
              "type": "string",
              "description": ""
            },
            "modelSize": {
              "type": "string",
              "description": ""
            },
            "language": {
              "type": "string",
              "description": ""
            },
            "instruct": {
              "type": "string",
              "description": ""
            },
            "seed": {
              "type": "number",
              "description": ""
            },
            "maxChunkChars": {
              "type": "number",
              "description": ""
            },
            "crossfadeMs": {
              "type": "number",
              "description": ""
            },
            "normalize": {
              "type": "boolean",
              "description": ""
            },
            "effectsChain": {
              "type": "EffectConfig[]",
              "description": ""
            },
            "disableCache": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "text",
        "outputPath"
      ],
      "returns": "Promise<string>"
    }
  },
  "getters": {},
  "events": {
    "failure": {
      "name": "failure",
      "description": "Event emitted by VoiceBoxClient",
      "arguments": {}
    },
    "profiles": {
      "name": "profiles",
      "description": "Event emitted by VoiceBoxClient",
      "arguments": {}
    },
    "speech": {
      "name": "speech",
      "description": "Event emitted by VoiceBoxClient",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const vb = container.client('voicebox')\nawait vb.connect()\nconst profiles = await vb.listProfiles()\nconst audio = await vb.synthesize('Hello world', { profileId: profiles[0].id })\n// audio is a Buffer of WAV data"
    }
  ],
  "types": {
    "SynthesizeOptions": {
      "description": "",
      "properties": {
        "profileId": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "engine": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "modelSize": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "language": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "instruct": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "seed": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "maxChunkChars": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "crossfadeMs": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "normalize": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "effectsChain": {
          "type": "EffectConfig[]",
          "description": "",
          "optional": true
        },
        "disableCache": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    },
    "EffectConfig": {
      "description": "",
      "properties": {
        "type": {
          "type": "string",
          "description": ""
        },
        "enabled": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "params": {
          "type": "Record<string, any>",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('clients.supabase', {
  "id": "clients.supabase",
  "description": "Supabase client for the Luca container system. Wraps the official `@supabase/supabase-js` SDK and exposes it through Luca's typed state, events, and introspection system. The SDK is isomorphic so this single implementation works in both Node and browser containers. Use `client.sdk` for full SDK access, or use the convenience wrappers for common operations (auth, database queries, storage, edge functions, realtime).",
  "shortcut": "clients.supabase",
  "className": "SupabaseClient",
  "methods": {
    "from": {
      "description": "Start a query on a Postgres table or view.",
      "parameters": {
        "table": {
          "type": "string",
          "description": "The table or view name to query"
        }
      },
      "required": [
        "table"
      ],
      "returns": "void"
    },
    "rpc": {
      "description": "Call a Postgres function (RPC).",
      "parameters": {
        "fn": {
          "type": "string",
          "description": "The function name"
        },
        "params": {
          "type": "Record<string, unknown>",
          "description": "Arguments to pass to the function"
        },
        "options": {
          "type": "{ head?: boolean; get?: boolean; count?: \"exact\" | \"planned\" | \"estimated\" }",
          "description": "Optional settings (head, get, count)"
        }
      },
      "required": [
        "fn"
      ],
      "returns": "void"
    },
    "signInWithPassword": {
      "description": "Sign in with email and password.",
      "parameters": {
        "email": {
          "type": "string",
          "description": "Parameter email"
        },
        "password": {
          "type": "string",
          "description": "Parameter password"
        }
      },
      "required": [
        "email",
        "password"
      ],
      "returns": "void"
    },
    "signUp": {
      "description": "Create a new user account with email and password.",
      "parameters": {
        "email": {
          "type": "string",
          "description": "Parameter email"
        },
        "password": {
          "type": "string",
          "description": "Parameter password"
        }
      },
      "required": [
        "email",
        "password"
      ],
      "returns": "void"
    },
    "signOut": {
      "description": "Sign the current user out.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "getSession": {
      "description": "Get the current session, if any.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "getUser": {
      "description": "Get the current user, if any.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "invoke": {
      "description": "Invoke a Supabase Edge Function by name.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Parameter name"
        },
        "body": {
          "type": "any",
          "description": "Parameter body"
        }
      },
      "required": [
        "name"
      ],
      "returns": "void"
    },
    "subscribe": {
      "description": "Subscribe to realtime changes on a Postgres table.",
      "parameters": {
        "channelName": {
          "type": "string",
          "description": "A name for this subscription channel"
        },
        "table": {
          "type": "string",
          "description": "The table to listen to"
        },
        "callback": {
          "type": "(payload: any) => void",
          "description": "Called with the payload on each change"
        },
        "event": {
          "type": "\"INSERT\" | \"UPDATE\" | \"DELETE\" | \"*\"",
          "description": "The event type to listen for (default: all changes)"
        }
      },
      "required": [
        "channelName",
        "table",
        "callback"
      ],
      "returns": "RealtimeChannel"
    },
    "unsubscribe": {
      "description": "Unsubscribe and remove a realtime channel by name.",
      "parameters": {
        "channelName": {
          "type": "string",
          "description": "The channel name to remove"
        }
      },
      "required": [
        "channelName"
      ],
      "returns": "void"
    },
    "unsubscribeAll": {
      "description": "Unsubscribe and remove all realtime channels.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "connect": {
      "description": "Connect is a no-op since the Supabase SDK initializes on construction. The client is ready to use immediately after creation.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "disconnect": {
      "description": "Disconnect by signing out and removing all realtime channels.",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "sdk": {
      "description": "Returns the raw Supabase SDK client for full access to all SDK methods.",
      "returns": "SupabaseSDKClient<any, any>"
    },
    "storage": {
      "description": "Returns the Supabase Storage client for managing buckets and files.",
      "returns": "any"
    },
    "functions": {
      "description": "Returns the Supabase Functions client.",
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
      "code": "const supabase = container.client('supabase', {\n supabaseUrl: 'https://xyz.supabase.co',\n supabaseKey: 'your-anon-key',\n})\n\n// Query data\nconst { data } = await supabase.from('users').select('*')\n\n// Auth\nawait supabase.signInWithPassword('user@example.com', 'password')\n\n// Realtime\nsupabase.subscribe('changes', 'users', (payload) => {\n console.log('Change:', payload)\n})"
    }
  ]
});

setBuildTimeData('clients.comfyui', {
  "id": "clients.comfyui",
  "description": "ComfyUI client — execute Stable Diffusion workflows via the ComfyUI API. Connects to a ComfyUI instance to queue prompts, track execution via WebSocket or polling, and download generated images. Supports both UI-format and API-format workflows with automatic conversion.",
  "shortcut": "clients.comfyui",
  "className": "ComfyUIClient",
  "methods": {
    "queuePrompt": {
      "description": "Queue a prompt (API-format workflow) for execution.",
      "parameters": {
        "prompt": {
          "type": "Record<string, any>",
          "description": "The API-format workflow object"
        },
        "clientId": {
          "type": "string",
          "description": "Override the client ID for this request"
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<{ prompt_id: string; number: number }>",
      "examples": [
        {
          "language": "ts",
          "code": "const { prompt_id } = await comfy.queuePrompt(apiWorkflow)"
        }
      ]
    },
    "getQueue": {
      "description": "Get the current prompt queue status.",
      "parameters": {},
      "required": [],
      "returns": "Promise<{ queue_running: any[]; queue_pending: any[] }>"
    },
    "getHistory": {
      "description": "Get execution history, optionally for a specific prompt.",
      "parameters": {
        "promptId": {
          "type": "string",
          "description": "If provided, returns history for this prompt only"
        }
      },
      "required": [],
      "returns": "Promise<Record<string, any>>"
    },
    "getSystemStats": {
      "description": "Get system stats including GPU memory and queue info.",
      "parameters": {},
      "required": [],
      "returns": "Promise<any>"
    },
    "getObjectInfo": {
      "description": "Get node type info with input/output schemas.",
      "parameters": {
        "nodeClass": {
          "type": "string",
          "description": "If provided, returns info for this node type only"
        }
      },
      "required": [],
      "returns": "Promise<any>"
    },
    "interrupt": {
      "description": "Interrupt the currently executing prompt.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "getModels": {
      "description": "List available models, optionally filtered by type.",
      "parameters": {
        "type": {
          "type": "string",
          "description": "Model type filter (e.g., 'checkpoints', 'loras')"
        }
      },
      "required": [],
      "returns": "Promise<string[]>"
    },
    "getEmbeddings": {
      "description": "List available embedding models.",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>"
    },
    "uploadImage": {
      "description": "Upload an image to ComfyUI's input directory.",
      "parameters": {
        "file": {
          "type": "Buffer | Blob",
          "description": "The image data as Buffer or Blob"
        },
        "filename": {
          "type": "string",
          "description": "File name for the upload"
        },
        "opts": {
          "type": "{ subfolder?: string; type?: string; overwrite?: boolean }",
          "description": "Upload options (subfolder, type, overwrite)"
        }
      },
      "required": [
        "file",
        "filename"
      ],
      "returns": "Promise<any>"
    },
    "viewImage": {
      "description": "Download a generated image from ComfyUI as a Buffer.",
      "parameters": {
        "filename": {
          "type": "string",
          "description": "The image filename"
        },
        "subfolder": {
          "type": "any",
          "description": "Subfolder within the output directory"
        },
        "type": {
          "type": "any",
          "description": "Image type ('output', 'input', 'temp')"
        }
      },
      "required": [
        "filename"
      ],
      "returns": "Promise<Buffer>"
    },
    "connectWs": {
      "description": "Open a WebSocket connection to ComfyUI for real-time execution tracking. Events emitted: `execution_start`, `executing`, `progress`, `executed`, `execution_cached`, `execution_error`, `execution_complete`.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "disconnectWs": {
      "description": "Close the WebSocket connection.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "toApiFormat": {
      "description": "Convert a UI-format workflow to the API format that /prompt expects. Requires a running ComfyUI instance to fetch `object_info` so we can map positional `widgets_values` to their named input fields. If the workflow is already in API format, it's returned as-is.",
      "parameters": {
        "workflow": {
          "type": "Record<string, any>",
          "description": "Parameter workflow"
        }
      },
      "required": [
        "workflow"
      ],
      "returns": "Promise<Record<string, any>>"
    },
    "runWorkflow": {
      "description": "Run a ComfyUI workflow with optional runtime input overrides. Inputs can be provided in two forms: **Direct node mapping** (when no `inputMap` in options): ``` { '3': { seed: 42 }, '6': { text: 'a cat' } } ``` **Named inputs** (when `inputMap` is provided in options): ``` inputs: { positive_prompt: 'a cat', seed: 42 } options.inputMap: { positive_prompt: { nodeId: '6', field: 'text' }, seed: { nodeId: '3', field: 'seed' } } ```",
      "parameters": {
        "workflow": {
          "type": "Record<string, any>",
          "description": "Parameter workflow"
        },
        "inputs": {
          "type": "Record<string, any>",
          "description": "Parameter inputs"
        },
        "options": {
          "type": "WorkflowRunOptions",
          "description": "Parameter options",
          "properties": {
            "poll": {
              "type": "boolean",
              "description": "Use polling instead of WebSocket for tracking execution"
            },
            "pollInterval": {
              "type": "number",
              "description": "Polling interval in ms (default 1000)"
            },
            "inputMap": {
              "type": "InputMapping",
              "description": "Named input mapping: semantic name -> { nodeId, field }"
            },
            "outputDir": {
              "type": "string",
              "description": "If provided, output images are downloaded to this directory"
            }
          }
        }
      },
      "required": [
        "workflow"
      ],
      "returns": "Promise<WorkflowResult>"
    }
  },
  "getters": {
    "clientId": {
      "description": "The unique client ID used for WebSocket session tracking.",
      "returns": "string"
    },
    "wsURL": {
      "description": "The WebSocket URL derived from baseURL or overridden via options.",
      "returns": "string"
    }
  },
  "events": {
    "execution_start": {
      "name": "execution_start",
      "description": "Event emitted by ComfyUIClient",
      "arguments": {}
    },
    "execution_complete": {
      "name": "execution_complete",
      "description": "Event emitted by ComfyUIClient",
      "arguments": {}
    },
    "executing": {
      "name": "executing",
      "description": "Event emitted by ComfyUIClient",
      "arguments": {}
    },
    "progress": {
      "name": "progress",
      "description": "Event emitted by ComfyUIClient",
      "arguments": {}
    },
    "executed": {
      "name": "executed",
      "description": "Event emitted by ComfyUIClient",
      "arguments": {}
    },
    "execution_cached": {
      "name": "execution_cached",
      "description": "Event emitted by ComfyUIClient",
      "arguments": {}
    },
    "execution_error": {
      "name": "execution_error",
      "description": "Event emitted by ComfyUIClient",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const comfy = container.client('comfyui', { baseURL: 'http://localhost:8188' })\nconst result = await comfy.runWorkflow(workflow, {\n '6': { text: 'a beautiful sunset' }\n})\nconsole.log(result.images)"
    }
  ],
  "types": {
    "WorkflowRunOptions": {
      "description": "",
      "properties": {
        "poll": {
          "type": "boolean",
          "description": "Use polling instead of WebSocket for tracking execution",
          "optional": true
        },
        "pollInterval": {
          "type": "number",
          "description": "Polling interval in ms (default 1000)",
          "optional": true
        },
        "inputMap": {
          "type": "InputMapping",
          "description": "Named input mapping: semantic name -> { nodeId, field }",
          "optional": true
        },
        "outputDir": {
          "type": "string",
          "description": "If provided, output images are downloaded to this directory",
          "optional": true
        }
      }
    },
    "WorkflowResult": {
      "description": "",
      "properties": {
        "promptId": {
          "type": "string",
          "description": ""
        },
        "outputs": {
          "type": "Record<string, any>",
          "description": ""
        },
        "images": {
          "type": "Array<{ filename: string; subfolder: string; type: string; localPath?: string }>",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('clients.elevenlabs', {
  "id": "clients.elevenlabs",
  "description": "ElevenLabs client — text-to-speech synthesis via the ElevenLabs REST API. Provides methods for listing voices, listing models, and generating speech audio. Audio is returned as a Buffer; use `say()` for a convenience method that writes to disk.",
  "shortcut": "clients.elevenlabs",
  "className": "ElevenLabsClient",
  "methods": {
    "beforeRequest": {
      "description": "Inject the xi-api-key header before each request.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "connect": {
      "description": "Validate the API key by listing available models.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>",
      "examples": [
        {
          "language": "ts",
          "code": "await el.connect()"
        }
      ]
    },
    "listVoices": {
      "description": "List available voices with optional search and filtering.",
      "parameters": {
        "options": {
          "type": "{\n    search?: string\n    category?: string\n    voice_type?: string\n    page_size?: number\n    next_page_token?: string\n  }",
          "description": "Query parameters for filtering voices"
        }
      },
      "required": [],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "const voices = await el.listVoices()\nconst premade = await el.listVoices({ category: 'premade' })"
        }
      ]
    },
    "getVoice": {
      "description": "Get details for a single voice.",
      "parameters": {
        "voiceId": {
          "type": "string",
          "description": "The voice ID to look up"
        }
      },
      "required": [
        "voiceId"
      ],
      "returns": "Promise<any>",
      "examples": [
        {
          "language": "ts",
          "code": "const voice = await el.getVoice('21m00Tcm4TlvDq8ikWAM')\nconsole.log(voice.name, voice.settings)"
        }
      ]
    },
    "listModels": {
      "description": "List available TTS models.",
      "parameters": {},
      "required": [],
      "returns": "Promise<any[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const models = await el.listModels()\nconsole.log(models.map(m => m.model_id))"
        }
      ]
    },
    "synthesize": {
      "description": "Synthesize speech from text, returning audio as a Buffer.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to convert to speech"
        },
        "options": {
          "type": "SynthesizeOptions",
          "description": "Voice, model, format, and voice settings overrides",
          "properties": {
            "voiceId": {
              "type": "string",
              "description": ""
            },
            "modelId": {
              "type": "string",
              "description": ""
            },
            "outputFormat": {
              "type": "string",
              "description": ""
            },
            "voiceSettings": {
              "type": "ElevenLabsVoiceSettings",
              "description": ""
            },
            "disableCache": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "text"
      ],
      "returns": "Promise<Buffer>",
      "examples": [
        {
          "language": "ts",
          "code": "const audio = await el.synthesize('Hello world')\n// audio is a Buffer of mp3 data\n\nconst custom = await el.synthesize('Hello', {\n voiceId: '21m00Tcm4TlvDq8ikWAM',\n voiceSettings: { stability: 0.5, similarityBoost: 0.8 }\n})"
        }
      ]
    },
    "say": {
      "description": "Synthesize speech and write the audio to a file.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "The text to convert to speech"
        },
        "outputPath": {
          "type": "string",
          "description": "File path to write the audio to"
        },
        "options": {
          "type": "SynthesizeOptions",
          "description": "Voice, model, format, and voice settings overrides",
          "properties": {
            "voiceId": {
              "type": "string",
              "description": ""
            },
            "modelId": {
              "type": "string",
              "description": ""
            },
            "outputFormat": {
              "type": "string",
              "description": ""
            },
            "voiceSettings": {
              "type": "ElevenLabsVoiceSettings",
              "description": ""
            },
            "disableCache": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "text",
        "outputPath"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const path = await el.say('Hello world', './hello.mp3')\nconsole.log(`Audio saved to ${path}`)"
        }
      ]
    }
  },
  "getters": {
    "apiKey": {
      "description": "The resolved API key from options or environment.",
      "returns": "string"
    }
  },
  "events": {
    "failure": {
      "name": "failure",
      "description": "Event emitted by ElevenLabsClient",
      "arguments": {}
    },
    "voices": {
      "name": "voices",
      "description": "Event emitted by ElevenLabsClient",
      "arguments": {}
    },
    "speech": {
      "name": "speech",
      "description": "Event emitted by ElevenLabsClient",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const el = container.client('elevenlabs')\nawait el.connect()\nconst voices = await el.listVoices()\nconst audio = await el.synthesize('Hello world')\n// audio is a Buffer of mp3 data"
    }
  ],
  "types": {
    "SynthesizeOptions": {
      "description": "",
      "properties": {
        "voiceId": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "modelId": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "outputFormat": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "voiceSettings": {
          "type": "ElevenLabsVoiceSettings",
          "description": "",
          "optional": true
        },
        "disableCache": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    },
    "ElevenLabsVoiceSettings": {
      "description": "",
      "properties": {
        "stability": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "similarityBoost": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "style": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "speed": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "useSpeakerBoost": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('servers.mcp', {
  "id": "servers.mcp",
  "description": "MCP (Model Context Protocol) server for exposing tools, resources, and prompts to AI clients like Claude Code. Uses the low-level MCP SDK Server class directly with Zod 4 native JSON Schema conversion. Register tools, resources, and prompts programmatically, then start the server over stdio (for CLI integration) or HTTP (for remote access).",
  "shortcut": "servers.mcp",
  "className": "MCPServer",
  "methods": {
    "tool": {
      "description": "Register an MCP tool. The tool's Zod schema is converted to JSON Schema for the protocol listing, and used for runtime argument validation. Tool handlers can return a string (auto-wrapped as text content) or a full CallToolResult object for advanced responses (images, errors, etc).",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Unique tool name"
        },
        "options": {
          "type": "ToolRegistrationOptions",
          "description": "Tool schema, description, and handler",
          "properties": {
            "schema": {
              "type": "z.ZodType",
              "description": ""
            },
            "description": {
              "type": "string",
              "description": ""
            },
            "handler": {
              "type": "Function | ((args: any, ctx: any) => any)",
              "description": ""
            }
          }
        }
      },
      "required": [
        "name",
        "options"
      ],
      "returns": "this"
    },
    "resource": {
      "description": "Register an MCP resource. Resources expose data (files, configs, etc) that AI clients can read by URI. Accepts either a handler function directly or an options object with additional metadata (name, description, mimeType).",
      "parameters": {
        "uri": {
          "type": "string",
          "description": "Unique resource URI (e.g. \"project://readme\")"
        },
        "handlerOrOptions": {
          "type": "ResourceRegistrationOptions['handler'] | ResourceRegistrationOptions",
          "description": "Handler function or options object with handler"
        }
      },
      "required": [
        "uri",
        "handlerOrOptions"
      ],
      "returns": "this"
    },
    "prompt": {
      "description": "Register an MCP prompt. Prompts are reusable message templates that AI clients can invoke with optional string arguments.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Unique prompt name"
        },
        "options": {
          "type": "PromptRegistrationOptions",
          "description": "Prompt handler, optional args schema, and description",
          "properties": {
            "description": {
              "type": "string",
              "description": ""
            },
            "args": {
              "type": "Record<string, z.ZodType>",
              "description": ""
            },
            "handler": {
              "type": "(args: Record<string, string | undefined>, ctx: MCPContext) => Promise<PromptMessage[]> | PromptMessage[]",
              "description": ""
            }
          }
        }
      },
      "required": [
        "name",
        "options"
      ],
      "returns": "this"
    },
    "configure": {
      "description": "Configure the MCP protocol server and register all protocol handlers. Called automatically before start() if not already configured.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "start": {
      "description": "Start the MCP server with the specified transport.",
      "parameters": {
        "options": {
          "type": "{\n    transport?: 'stdio' | 'http'\n    port?: number\n    host?: string\n    mcpCompat?: MCPCompatMode\n    stdioCompat?: StdioCompatMode\n  }",
          "description": "Transport configuration. Defaults to stdio.",
          "properties": {
            "transport": {
              "type": "any",
              "description": "'stdio' for CLI integration, 'http' for remote access"
            },
            "port": {
              "type": "any",
              "description": "Port for HTTP transport (default 3001)"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "stop": {
      "description": "Stop the MCP server and close all connections.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    }
  },
  "getters": {
    "mcpServer": {
      "description": "The underlying MCP protocol server instance. Created during configure().",
      "returns": "MCPProtocolServer"
    },
    "handlerContext": {
      "description": "The handler context passed to all tool, resource, and prompt handlers.",
      "returns": "MCPContext"
    }
  },
  "events": {
    "toolRegistered": {
      "name": "toolRegistered",
      "description": "Event emitted by MCPServer",
      "arguments": {}
    },
    "resourceRegistered": {
      "name": "resourceRegistered",
      "description": "Event emitted by MCPServer",
      "arguments": {}
    },
    "promptRegistered": {
      "name": "promptRegistered",
      "description": "Event emitted by MCPServer",
      "arguments": {}
    },
    "toolCalled": {
      "name": "toolCalled",
      "description": "Event emitted by MCPServer",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const mcp = container.server('mcp', { serverName: 'my-server', serverVersion: '1.0.0' })\n\nmcp.tool('search_files', {\n schema: z.object({ pattern: z.string() }),\n description: 'Search for files',\n handler: async (args, ctx) => {\n   return ctx.container.feature('fs').walk('.', { include: [args.pattern] }).files.join('\\n')\n }\n})\n\nawait mcp.start()"
    }
  ],
  "types": {
    "ToolRegistrationOptions": {
      "description": "",
      "properties": {
        "schema": {
          "type": "z.ZodType",
          "description": "",
          "optional": true
        },
        "description": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "handler": {
          "type": "Function | ((args: any, ctx: any) => any)",
          "description": "",
          "optional": true
        }
      }
    },
    "ResourceRegistrationOptions": {
      "description": "",
      "properties": {
        "name": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "description": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "mimeType": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "handler": {
          "type": "(uri: string, ctx: MCPContext) => Promise<string> | string",
          "description": ""
        }
      }
    },
    "MCPContext": {
      "description": "Context object passed to all MCP tool, resource, and prompt handlers.",
      "properties": {
        "container": {
          "type": "NodeContainer",
          "description": ""
        }
      }
    },
    "PromptRegistrationOptions": {
      "description": "",
      "properties": {
        "description": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "args": {
          "type": "Record<string, z.ZodType>",
          "description": "",
          "optional": true
        },
        "handler": {
          "type": "(args: Record<string, string | undefined>, ctx: MCPContext) => Promise<PromptMessage[]> | PromptMessage[]",
          "description": ""
        }
      }
    },
    "PromptMessage": {
      "description": "",
      "properties": {
        "role": {
          "type": "'user' | 'assistant'",
          "description": ""
        },
        "content": {
          "type": "string",
          "description": ""
        }
      }
    }
  }
});

setBuildTimeData('servers.express', {
  "id": "servers.express",
  "description": "Express.js HTTP server with automatic endpoint mounting, CORS, and SPA history fallback. Wraps an Express application with convention-based endpoint discovery. Endpoints defined as modules are automatically mounted as routes. Supports static file serving, CORS configuration, and single-page app history fallback out of the box.",
  "shortcut": "servers.express",
  "className": "ExpressServer",
  "methods": {
    "start": {
      "description": "Start the Express HTTP server. A runtime `port` overrides the constructor option and is written to state so `server.port` always reflects reality.",
      "parameters": {
        "options": {
          "type": "StartOptions",
          "description": "Optional runtime overrides for port and host"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "stop": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "configure": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "useEndpoint": {
      "description": "",
      "parameters": {
        "endpoint": {
          "type": "Endpoint",
          "description": "Parameter endpoint"
        }
      },
      "required": [
        "endpoint"
      ],
      "returns": "this"
    },
    "useEndpoints": {
      "description": "",
      "parameters": {
        "dir": {
          "type": "string",
          "description": "Parameter dir"
        }
      },
      "required": [
        "dir"
      ],
      "returns": "Promise<this>"
    },
    "reloadEndpoint": {
      "description": "Reload a mounted endpoint by its file path. Re-reads the module through the helpers VM loader so the next request picks up the new handlers.",
      "parameters": {
        "filePath": {
          "type": "string",
          "description": "Absolute path to the endpoint file"
        }
      },
      "required": [
        "filePath"
      ],
      "returns": "Promise<Endpoint | null>"
    },
    "useEndpointModules": {
      "description": "",
      "parameters": {
        "modules": {
          "type": "EndpointModule[]",
          "description": "Parameter modules"
        }
      },
      "required": [
        "modules"
      ],
      "returns": "Promise<this>"
    },
    "serveOpenAPISpec": {
      "description": "",
      "parameters": {
        "options": {
          "type": "{ title?: string; version?: string; description?: string }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "this"
    },
    "generateOpenAPISpec": {
      "description": "",
      "parameters": {
        "options": {
          "type": "{ title?: string; version?: string; description?: string }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Record<string, any>"
    }
  },
  "getters": {
    "express": {
      "description": "",
      "returns": "typeof express"
    },
    "hooks": {
      "description": "",
      "returns": "{ create: (app: Express, server: Server) => Express; beforeStart: (options: any, server: Server) => any }"
    },
    "app": {
      "description": "",
      "returns": "Express"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const server = container.server('express', { cors: true, static: './public' })\nawait server.start({ port: 3000 })\n\n// Mount endpoints programmatically\nserver.mount(myEndpoint)\n\n// Access the underlying Express app\nserver.app.get('/health', (req, res) => res.json({ ok: true }))"
    }
  ]
});

setBuildTimeData('servers.websocket', {
  "id": "servers.websocket",
  "description": "WebSocket server built on the `ws` library with optional JSON message framing. Manages WebSocket connections, tracks connected clients, and bridges messages to Luca's event bus. When `json` mode is enabled, incoming messages are automatically JSON-parsed (with `.toString()` for Buffer data) and outgoing messages via `send()` / `broadcast()` are JSON-stringified. When `json` mode is disabled, raw message data is emitted as-is and `send()` / `broadcast()` still JSON-stringify for safety. Supports ask/reply semantics when paired with the Luca WebSocket client. The server can `ask(ws, type, data)` a connected client and await a typed response, or handle incoming asks from clients by listening for messages with a `requestId` and replying via `send(ws, { replyTo, data })`. Requests time out if no reply arrives within the configurable window.",
  "shortcut": "servers.websocket",
  "className": "WebsocketServer",
  "methods": {
    "broadcast": {
      "description": "",
      "parameters": {
        "message": {
          "type": "any",
          "description": "Parameter message"
        }
      },
      "required": [
        "message"
      ],
      "returns": "Promise<this>"
    },
    "send": {
      "description": "",
      "parameters": {
        "ws": {
          "type": "any",
          "description": "Parameter ws"
        },
        "message": {
          "type": "any",
          "description": "Parameter message"
        }
      },
      "required": [
        "ws",
        "message"
      ],
      "returns": "Promise<this>"
    },
    "ask": {
      "description": "Send a request to a specific client and wait for a correlated response. The client is expected to reply with a message whose `replyTo` matches the `requestId` of this message.",
      "parameters": {
        "ws": {
          "type": "any",
          "description": "The WebSocket client to ask"
        },
        "type": {
          "type": "string",
          "description": "A string identifying the request type"
        },
        "data": {
          "type": "any",
          "description": "Optional payload"
        },
        "timeout": {
          "type": "any",
          "description": "How long to wait (default 10 000 ms)"
        }
      },
      "required": [
        "ws",
        "type"
      ],
      "returns": "Promise<R>",
      "examples": [
        {
          "language": "ts",
          "code": "ws.on('connection', async (client) => {\n const info = await ws.ask(client, 'identify')\n console.log('Client says:', info)\n})"
        }
      ]
    },
    "start": {
      "description": "Start the WebSocket server. A runtime `port` overrides the constructor option and is written to state before the underlying `ws.Server` is created, so the server binds to the correct port.",
      "parameters": {
        "options": {
          "type": "StartOptions",
          "description": "Optional runtime overrides for port and host"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "stop": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    }
  },
  "getters": {
    "wss": {
      "description": "",
      "returns": "BaseServer"
    },
    "port": {
      "description": "The port this server will bind to. Defaults to 8081 if not set via constructor options or start().",
      "returns": "number"
    }
  },
  "events": {
    "connection": {
      "name": "connection",
      "description": "Event emitted by WebsocketServer",
      "arguments": {}
    },
    "message": {
      "name": "message",
      "description": "Event emitted by WebsocketServer",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const ws = container.server('websocket', { json: true })\nawait ws.start({ port: 8080 })\n\nws.on('message', (data, client) => {\n console.log('Received:', data)\n ws.broadcast({ echo: data })\n})\n\n// ask/reply: request info from a connected client\nws.on('connection', async (client) => {\n const info = await ws.ask(client, 'identify')\n console.log('Client says:', info)\n})"
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

setContainerBuildTimeData('NodeContainer', {
  "className": "NodeContainer",
  "description": "Server-side container for Node.js and Bun environments. Extends the base Container with file system access, process management, git integration, and other server-side capabilities. Auto-enables core features on construction: fs, proc, git, grep, os, networking, ui, vm, transpiler, helpers. Also attaches Client, Server, Command, Endpoint, and Selector helper types, providing `container.client()`, `container.server()`, `container.command()`, etc. factory methods.",
  "methods": {},
  "getters": {
    "cwd": {
      "description": "Returns the current working directory, from options or process.cwd().",
      "returns": "string"
    },
    "manifest": {
      "description": "Returns the parsed package.json manifest for the current working directory.",
      "returns": "Record<string, any>"
    },
    "argv": {
      "description": "Returns the parsed command-line arguments (from minimist).",
      "returns": "Record<string, any> & { _: string[] }"
    },
    "urlUtils": {
      "description": "Returns URL utility functions for parsing URIs.",
      "returns": "{ parse: (uri: string) => url.UrlWithStringQuery }"
    },
    "paths": {
      "description": "Returns path utility functions scoped to the current working directory (join, resolve, relative, dirname, parse).",
      "returns": "{ dirname: (path: string) => string; join: (...paths: string[]) => string; resolve: (...paths: string[]) => string; relative: (...paths: string[]) => string; basename: typeof basename; parse: typeof parse }"
    }
  },
  "events": {}
});
export const introspectionData = [
  {
    "id": "features.googleDocs",
    "description": "Google Docs feature for reading documents and converting them to Markdown. Depends on googleAuth for authentication and optionally googleDrive for listing docs. The markdown converter handles headings, text formatting, links, lists, tables, and images.",
    "shortcut": "features.googleDocs",
    "className": "GoogleDocs",
    "methods": {
      "getDocument": {
        "description": "Get the raw document structure from the Docs API.",
        "parameters": {
          "documentId": {
            "type": "string",
            "description": "The Google Docs document ID"
          }
        },
        "required": [
          "documentId"
        ],
        "returns": "Promise<docs_v1.Schema$Document>"
      },
      "getAsMarkdown": {
        "description": "Read a Google Doc and convert it to Markdown. Handles headings, bold/italic/strikethrough, links, code fonts, ordered/unordered lists with nesting, tables, images, and section breaks.",
        "parameters": {
          "documentId": {
            "type": "string",
            "description": "The Google Docs document ID"
          }
        },
        "required": [
          "documentId"
        ],
        "returns": "Promise<string>"
      },
      "getAsText": {
        "description": "Read a Google Doc as plain text (strips all formatting).",
        "parameters": {
          "documentId": {
            "type": "string",
            "description": "The Google Docs document ID"
          }
        },
        "required": [
          "documentId"
        ],
        "returns": "Promise<string>"
      },
      "saveAsMarkdown": {
        "description": "Download a Google Doc as Markdown and save to a local file.",
        "parameters": {
          "documentId": {
            "type": "string",
            "description": "The Google Docs document ID"
          },
          "localPath": {
            "type": "string",
            "description": "Local file path (resolved relative to container cwd)"
          }
        },
        "required": [
          "documentId",
          "localPath"
        ],
        "returns": "Promise<string>"
      },
      "listDocs": {
        "description": "List Google Docs in Drive (filters by Docs MIME type).",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Optional additional Drive search query"
          },
          "options": {
            "type": "{ pageSize?: number; pageToken?: string }",
            "description": "Pagination options"
          }
        },
        "required": [],
        "returns": "Promise<DriveFile[]>"
      },
      "searchDocs": {
        "description": "Search for Google Docs by name or content.",
        "parameters": {
          "term": {
            "type": "string",
            "description": "Search term"
          }
        },
        "required": [
          "term"
        ],
        "returns": "Promise<DriveFile[]>"
      }
    },
    "getters": {
      "auth": {
        "description": "Access the google-auth feature lazily.",
        "returns": "GoogleAuth"
      },
      "drive": {
        "description": "Access the google-drive feature lazily.",
        "returns": "GoogleDrive"
      }
    },
    "events": {
      "documentFetched": {
        "name": "documentFetched",
        "description": "Event emitted by GoogleDocs",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by GoogleDocs",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const docs = container.feature('googleDocs')\n\n// Get a doc as markdown\nconst markdown = await docs.getAsMarkdown('1abc_document_id')\n\n// Save to file\nawait docs.saveAsMarkdown('1abc_document_id', './output/doc.md')\n\n// List all Google Docs in Drive\nconst allDocs = await docs.listDocs()\n\n// Get raw document structure\nconst rawDoc = await docs.getDocument('1abc_document_id')\n\n// Plain text extraction\nconst text = await docs.getAsText('1abc_document_id')"
      }
    ]
  },
  {
    "id": "features.yamlTree",
    "description": "YamlTree Feature - A powerful YAML file tree loader and processor This feature provides functionality to recursively load YAML files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive YAML file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Support for both .yml and .yaml file extensions",
    "shortcut": "features.yamlTree",
    "className": "YamlTree",
    "methods": {
      "loadTree": {
        "description": "Loads a tree of YAML files from the specified base path and stores them in state. This method recursively scans the provided directory for YAML files (.yml and .yaml), processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Path Processing:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes file extensions (.yml/.yaml) **Example:** ``` config/ database/ production.yml  -> tree.config.database.production staging.yml     -> tree.config.database.staging api/ endpoints.yaml  -> tree.config.api.endpoints ```",
        "parameters": {
          "basePath": {
            "type": "string",
            "description": "The root directory path to scan for YAML files"
          },
          "key": {
            "type": "string",
            "description": "The key to store the tree under in state (defaults to first segment of basePath)"
          }
        },
        "required": [
          "basePath"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "// Load all YAML files from 'config' directory into state.config\nawait yamlTree.loadTree('config');\n\n// Load with custom key\nawait yamlTree.loadTree('app/settings', 'appSettings');\n\n// Access the loaded data\nconst dbConfig = yamlTree.tree.config.database.production;"
          }
        ]
      }
    },
    "getters": {
      "tree": {
        "description": "Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the YAML tree data that has been loaded.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "await yamlTree.loadTree('config');\nconst allTrees = yamlTree.tree;\n// Returns: { config: { database: { ... }, api: { ... } } }"
          }
        ]
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const yamlTree = container.feature('yamlTree', { enable: true });\nawait yamlTree.loadTree('config', 'appConfig');\nconst configData = yamlTree.tree.appConfig;"
      }
    ]
  },
  {
    "id": "features.ink",
    "description": "Ink Feature — React-powered Terminal UI via Ink Exposes the Ink library (React for CLIs) through the container so any feature, script, or application can build rich terminal user interfaces using React components rendered directly in the terminal. This feature is intentionally a thin pass-through. It re-exports all of Ink's components, hooks, and the render function, plus a few convenience methods for mounting / unmounting apps. The actual UI composition is left entirely to the consumer — the feature just makes Ink available. **What you get:** - `ink.render(element)` — mount a React element to the terminal - `ink.components` — { Box, Text, Static, Transform, Newline, Spacer } - `ink.hooks` — { useInput, useApp, useStdin, useStdout, useStderr, useFocus, useFocusManager } - `ink.React` — the React module itself (createElement, useState, etc.) - `ink.unmount()` — tear down the currently mounted app - `ink.waitUntilExit()` — await the mounted app's exit **Quick start:** ```tsx const ink = container.feature('ink', { enable: true }) const { Box, Text } = ink.components const { React } = ink ink.render( React.createElement(Box, { flexDirection: 'column' }, React.createElement(Text, { color: 'green' }, 'hello from ink'), React.createElement(Text, { dimColor: true }, 'powered by luca'), ) ) await ink.waitUntilExit() ``` Or if you're in a .tsx file: ```tsx import React from 'react' const ink = container.feature('ink', { enable: true }) const { Box, Text } = ink.components ink.render( <Box flexDirection=\"column\"> <Text color=\"green\">hello from ink</Text> <Text dimColor>powered by luca</Text> </Box> ) ```",
    "shortcut": "features.ink",
    "className": "Ink",
    "methods": {
      "loadModules": {
        "description": "Pre-load ink + react modules so the sync getters work. Called automatically by render(), but you can call it early.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>",
        "examples": [
          {
            "language": "ts",
            "code": "const ink = container.feature('ink', { enable: true })\nawait ink.loadModules()\n// Now sync getters like ink.React, ink.components, ink.hooks work\nconst { Box, Text } = ink.components"
          }
        ]
      },
      "render": {
        "description": "Mount a React element to the terminal. Wraps `ink.render()` — automatically loads modules if needed, tracks the instance for unmount / waitUntilExit, and updates state.",
        "parameters": {
          "node": {
            "type": "any",
            "description": "A React element (JSX or React.createElement)"
          },
          "options": {
            "type": "Record<string, any>",
            "description": "Ink render options (stdout, stdin, debug, etc.)"
          }
        },
        "required": [
          "node"
        ],
        "returns": "Promise<any>"
      },
      "rerender": {
        "description": "Re-render the currently mounted app with a new root element.",
        "parameters": {
          "node": {
            "type": "any",
            "description": "Parameter node"
          }
        },
        "required": [
          "node"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const ink = container.feature('ink', { enable: true })\nconst { React } = await ink.loadModules()\nconst { Text } = ink.components\n\nawait ink.render(React.createElement(Text, null, 'Hello'))\nink.rerender(React.createElement(Text, null, 'Updated!'))"
          }
        ]
      },
      "unmount": {
        "description": "Unmount the currently mounted Ink app. Tears down the React tree rendered in the terminal and resets state. Safe to call when no app is mounted (no-op).",
        "parameters": {},
        "required": [],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const ink = container.feature('ink', { enable: true })\nawait ink.render(myElement)\n// ... later\nink.unmount()\nconsole.log(ink.isMounted) // false"
          }
        ]
      },
      "waitUntilExit": {
        "description": "Returns a promise that resolves when the mounted app exits. Useful for keeping a script alive while the terminal UI is active.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "const ink = container.feature('ink', { enable: true })\nawait ink.render(myElement)\nawait ink.waitUntilExit()\nconsole.log('App exited')"
          }
        ]
      },
      "clear": {
        "description": "Clear the terminal output of the mounted app. Erases all Ink-rendered content from the terminal. Safe to call when no app is mounted (no-op).",
        "parameters": {},
        "required": [],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const ink = container.feature('ink', { enable: true })\nawait ink.render(myElement)\n// ... later, wipe the screen\nink.clear()"
          }
        ]
      },
      "registerBlock": {
        "description": "Register a named React function component as a renderable block.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Unique block name"
          },
          "component": {
            "type": "Function",
            "description": "A React function component"
          }
        },
        "required": [
          "name",
          "component"
        ],
        "returns": "this",
        "examples": [
          {
            "language": "ts",
            "code": "ink.registerBlock('Greeting', ({ name }) =>\n React.createElement(Text, { color: 'green' }, `Hello ${name}!`)\n)"
          }
        ]
      },
      "renderBlock": {
        "description": "Render a registered block by name with optional props. Looks up the component, creates a React element, renders it via ink, then immediately unmounts so the static output stays on screen while freeing the React tree.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The registered block name"
          },
          "data": {
            "type": "Record<string, any>",
            "description": "Props to pass to the component"
          }
        },
        "required": [
          "name"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await ink.renderBlock('Greeting', { name: 'Jon' })"
          }
        ]
      },
      "renderBlockAsync": {
        "description": "Render a registered block that needs to stay mounted for async work. The component receives a `done` prop — a callback it must invoke when it has finished rendering its final output. The React tree stays alive until `done()` is called or the timeout expires.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The registered block name"
          },
          "data": {
            "type": "Record<string, any>",
            "description": "Props to pass to the component (a `done` prop is added automatically)"
          },
          "options": {
            "type": "{ timeout?: number }",
            "description": "`timeout` in ms before force-unmounting (default 30 000)"
          }
        },
        "required": [
          "name"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "tsx",
            "code": "// In a ## Blocks section:\nfunction AsyncChart({ url, done }) {\n const [rows, setRows] = React.useState(null)\n React.useEffect(() => {\n   fetch(url).then(r => r.json()).then(data => {\n     setRows(data)\n     done()\n   })\n }, [])\n if (!rows) return <Text dimColor>Loading...</Text>\n return <Box><Text>{JSON.stringify(rows)}</Text></Box>\n}\n\n// In a code block:\nawait renderAsync('AsyncChart', { url: 'https://api.example.com/data' })"
          }
        ]
      }
    },
    "getters": {
      "React": {
        "description": "The React module (createElement, useState, useEffect, etc.) Exposed so consumers don't need a separate react import. Lazy-loaded — first access triggers the import.",
        "returns": "typeof import('react')"
      },
      "components": {
        "description": "All Ink components as a single object for destructuring. ```ts const { Box, Text, Static, Spacer } = ink.components ```",
        "returns": "{ Box: typeof import('ink').Box; Text: typeof import('ink').Text; Static: typeof import('ink').Static; Transform: typeof import('ink').Transform; Newline: typeof import('ink').Newline; Spacer: typeof import('ink').Spacer }"
      },
      "hooks": {
        "description": "All Ink hooks as a single object for destructuring. ```ts const { useInput, useApp, useFocus } = ink.hooks ```",
        "returns": "{ useInput: typeof import('ink').useInput; useApp: typeof import('ink').useApp; useStdin: typeof import('ink').useStdin; useStdout: typeof import('ink').useStdout; useStderr: typeof import('ink').useStderr; useFocus: typeof import('ink').useFocus; useFocusManager: typeof import('ink').useFocusManager; useCursor: typeof import('ink').useCursor }"
      },
      "measureElement": {
        "description": "The Ink measureElement utility.",
        "returns": "typeof import('ink').measureElement"
      },
      "isMounted": {
        "description": "Whether an ink app is currently mounted.",
        "returns": "boolean"
      },
      "instance": {
        "description": "The raw ink render instance if you need low-level access.",
        "returns": "any | null"
      },
      "blocks": {
        "description": "List all registered block names.",
        "returns": "string[]"
      }
    },
    "events": {
      "mounted": {
        "name": "mounted",
        "description": "Event emitted by Ink",
        "arguments": {}
      },
      "unmounted": {
        "name": "unmounted",
        "description": "Event emitted by Ink",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.containerLink",
    "description": "ContainerLink (Node-side) — WebSocket host for remote web containers. Creates a WebSocket server that web containers connect to. The host can evaluate code in connected web containers and receive structured events back. Trust is strictly one-way: the node side can eval in web containers, but web containers can NEVER eval in the node container.",
    "shortcut": "features.containerLink",
    "className": "ContainerLink",
    "methods": {
      "start": {
        "description": "Start the WebSocket server and begin accepting connections.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "stop": {
        "description": "Stop the WebSocket server and disconnect all clients.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "eval": {
        "description": "Evaluate code in a specific connected web container.",
        "parameters": {
          "containerId": {
            "type": "string",
            "description": "UUID of the target web container"
          },
          "code": {
            "type": "string",
            "description": "JavaScript code to evaluate"
          },
          "context": {
            "type": "Record<string, any>",
            "description": "Optional context variables to inject"
          },
          "timeout": {
            "type": "any",
            "description": "Timeout in ms (default 10000)"
          }
        },
        "required": [
          "containerId",
          "code"
        ],
        "returns": "Promise<T>"
      },
      "broadcast": {
        "description": "Evaluate code in all connected web containers.",
        "parameters": {
          "code": {
            "type": "string",
            "description": "JavaScript code to evaluate"
          },
          "context": {
            "type": "Record<string, any>",
            "description": "Optional context variables to inject"
          },
          "timeout": {
            "type": "any",
            "description": "Timeout in ms (default 10000)"
          }
        },
        "required": [
          "code"
        ],
        "returns": "Promise<Map<string, T | Error>>"
      },
      "getConnections": {
        "description": "Get metadata of all connected containers.",
        "parameters": {},
        "required": [],
        "returns": "Array<Omit<ConnectedContainer, 'ws' | 'token'>>"
      },
      "disconnect": {
        "description": "Disconnect a specific web container.",
        "parameters": {
          "containerId": {
            "type": "string",
            "description": "UUID of the container to disconnect"
          },
          "reason": {
            "type": "string",
            "description": "Optional reason string"
          }
        },
        "required": [
          "containerId"
        ],
        "returns": "void"
      },
      "generateToken": {
        "description": "Generate a cryptographically random token for connection auth.",
        "parameters": {},
        "required": [],
        "returns": "string"
      },
      "sendTo": {
        "description": "Send a message to a specific connected container by UUID.",
        "parameters": {
          "containerId": {
            "type": "string",
            "description": "UUID of the target container"
          },
          "msg": {
            "type": "LinkMessage",
            "description": "The message to send",
            "properties": {
              "type": {
                "type": "MessageType",
                "description": ""
              },
              "id": {
                "type": "string",
                "description": ""
              },
              "timestamp": {
                "type": "number",
                "description": ""
              },
              "token": {
                "type": "string",
                "description": ""
              },
              "data": {
                "type": "T",
                "description": ""
              }
            }
          }
        },
        "required": [
          "containerId",
          "msg"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "isListening": {
        "description": "Whether the WebSocket server is currently listening.",
        "returns": "boolean"
      },
      "connectionCount": {
        "description": "Number of currently connected web containers.",
        "returns": "number"
      }
    },
    "events": {
      "disconnection": {
        "name": "disconnection",
        "description": "Event emitted by ContainerLink",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by ContainerLink",
        "arguments": {}
      },
      "connection": {
        "name": "connection",
        "description": "Event emitted by ContainerLink",
        "arguments": {}
      },
      "evalResult": {
        "name": "evalResult",
        "description": "Event emitted by ContainerLink",
        "arguments": {}
      },
      "event": {
        "name": "event",
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
        "code": "const link = container.feature('containerLink', { enable: true, port: 8089 })\nawait link.start()\n\n// When a web container connects:\nlink.on('connection', (uuid, meta) => {\n console.log('Connected:', uuid)\n})\n\n// Eval code in a specific web container\nconst result = await link.eval(uuid, 'document.title')\n\n// Broadcast eval to all connected containers\nconst results = await link.broadcast('navigator.userAgent')\n\n// Listen for events from web containers\nlink.on('event', (uuid, eventName, data) => {\n console.log(`Event from ${uuid}: ${eventName}`, data)\n})"
      }
    ],
    "types": {
      "ConnectedContainer": {
        "description": "--- Connected Container Metadata ---",
        "properties": {
          "uuid": {
            "type": "string",
            "description": ""
          },
          "url": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "capabilities": {
            "type": "string[]",
            "description": "",
            "optional": true
          },
          "meta": {
            "type": "Record<string, any>",
            "description": "",
            "optional": true
          },
          "ws": {
            "type": "any",
            "description": ""
          },
          "token": {
            "type": "string",
            "description": ""
          },
          "missedHeartbeats": {
            "type": "number",
            "description": ""
          }
        }
      },
      "LinkMessage": {
        "description": "--- Link Message Envelope ---",
        "properties": {
          "type": {
            "type": "MessageType",
            "description": ""
          },
          "id": {
            "type": "string",
            "description": ""
          },
          "timestamp": {
            "type": "number",
            "description": ""
          },
          "token": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "data": {
            "type": "T",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.git",
    "description": "The Git feature provides utilities for interacting with Git repositories. This feature allows you to check repository status, list files, get branch information, and access Git metadata for projects within a Git repository.",
    "shortcut": "features.git",
    "className": "Git",
    "methods": {
      "lsFiles": {
        "description": "Lists files in the Git repository using git ls-files command. This method provides a flexible interface to the git ls-files command, allowing you to filter files by various criteria such as cached, deleted, modified, untracked, and ignored files.",
        "parameters": {
          "options": {
            "type": "LsFilesOptions",
            "description": "Options to control which files are listed",
            "properties": {
              "cached": {
                "type": "boolean",
                "description": "Show cached/staged files"
              },
              "deleted": {
                "type": "boolean",
                "description": "Show deleted files"
              },
              "modified": {
                "type": "boolean",
                "description": "Show modified files"
              },
              "others": {
                "type": "boolean",
                "description": "Show untracked files"
              },
              "ignored": {
                "type": "boolean",
                "description": "Show ignored files"
              },
              "status": {
                "type": "boolean",
                "description": "Show file status information"
              },
              "includeIgnored": {
                "type": "boolean",
                "description": "Include ignored files when showing others"
              },
              "exclude": {
                "type": "string | string[]",
                "description": "Patterns to exclude from results"
              },
              "baseDir": {
                "type": "string",
                "description": "Base directory to list files from"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<string[]>",
        "examples": [
          {
            "language": "ts",
            "code": "// Get all tracked files\nconst allFiles = await git.lsFiles()\n\n// Get only modified files\nconst modified = await git.lsFiles({ modified: true })\n\n// Get untracked files excluding certain patterns\nconst untracked = await git.lsFiles({ \n others: true, \n exclude: ['*.log', 'node_modules'] \n})"
          }
        ]
      },
      "getLatestChanges": {
        "description": "Gets the latest commits from the repository. Returns an array of commit objects containing the title (first line of commit message), full message body, and author name for each commit.",
        "parameters": {
          "numberOfChanges": {
            "type": "number",
            "description": "The number of recent commits to return"
          }
        },
        "required": [],
        "returns": "Promise<Array<{ title: string, message: string, author: string }>>",
        "examples": [
          {
            "language": "ts",
            "code": "const changes = await git.getLatestChanges(5)\nfor (const commit of changes) {\n console.log(`${commit.author}: ${commit.title}`)\n}"
          }
        ]
      },
      "fileLog": {
        "description": "Gets a lightweight commit log for one or more files. Returns the SHA and message for each commit that touched the given files, without the per-commit overhead of resolving which specific files matched. For richer per-file matching, see {@link getChangeHistoryForFiles}.",
        "parameters": {
          "files": {
            "type": "string[]",
            "description": "File paths (absolute or relative to container.cwd)"
          }
        },
        "required": [
          "files"
        ],
        "returns": "Array<{ sha: string, message: string }>",
        "examples": [
          {
            "language": "ts",
            "code": "const log = git.fileLog('package.json')\nconst log = git.fileLog('src/index.ts', 'src/helper.ts')\nfor (const entry of log) {\n console.log(`${entry.sha.slice(0, 8)} ${entry.message}`)\n}"
          }
        ]
      },
      "diff": {
        "description": "Gets the diff for a file between two refs. By default compares from the current HEAD to the given ref. You can supply both `compareTo` and `compareFrom` to diff between any two commits, branches, or tags.",
        "parameters": {
          "file": {
            "type": "string",
            "description": "File path (absolute or relative to container.cwd)"
          },
          "compareTo": {
            "type": "string",
            "description": "The target ref (commit SHA, branch, tag) to compare to"
          },
          "compareFrom": {
            "type": "string",
            "description": "The base ref to compare from (defaults to current HEAD)"
          }
        },
        "required": [
          "file",
          "compareTo"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Diff package.json between HEAD and a specific commit\nconst d = git.diff('package.json', 'abc1234')\n\n// Diff between two branches\nconst d = git.diff('src/index.ts', 'feature-branch', 'main')"
          }
        ]
      },
      "displayDiff": {
        "description": "Pretty prints a unified diff string to the terminal using colors. Parses the diff output and applies color coding: - File headers (`diff --git`, `---`, `+++`) are rendered bold - Hunk headers (`@@ ... @@`) are rendered in cyan - Added lines (`+`) are rendered in green - Removed lines (`-`) are rendered in red - Context lines are rendered dim Can be called with a raw diff string, or with the same arguments as {@link diff} to fetch and display in one step.",
        "parameters": {
          "diffOrFile": {
            "type": "string",
            "description": "A raw diff string, or a file path to pass to {@link diff}"
          },
          "compareTo": {
            "type": "string",
            "description": "When diffOrFile is a file path, the target ref to compare to"
          },
          "compareFrom": {
            "type": "string",
            "description": "When diffOrFile is a file path, the base ref to compare from"
          }
        },
        "required": [
          "diffOrFile"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Display a pre-fetched diff\nconst raw = git.diff('src/index.ts', 'main')\ngit.displayDiff(raw)\n\n// Fetch and display in one call\ngit.displayDiff('src/index.ts', 'abc1234')"
          }
        ]
      },
      "extractFolder": {
        "description": "Extracts a folder (or entire repo) from a remote GitHub repository without cloning. Downloads the repo as a tarball and extracts only the specified subfolder, similar to how degit works. No .git history is included — just the files. Supports shorthand (`user/repo/path`), branch refs (`user/repo/path#branch`), and full GitHub URLs (`https://github.com/user/repo/tree/branch/path`).",
        "parameters": {
          "{ source, destination, branch }": {
            "type": "{ source: string, destination: string, branch?: string }",
            "description": "Parameter { source, destination, branch }"
          }
        },
        "required": [
          "{ source, destination, branch }"
        ],
        "returns": "Promise<{ files: string[], source: { user: string, repo: string, ref: string, subdir: string",
        "examples": [
          {
            "language": "ts",
            "code": "// Extract a subfolder\nawait git.extractFolder({ source: 'soederpop/luca/src/assistants', destination: './my-assistants' })\n\n// Specific branch\nawait git.extractFolder({ source: 'sveltejs/template', destination: './my-app', branch: 'main' })\n\n// Full GitHub URL\nawait git.extractFolder({ source: 'https://github.com/user/repo/tree/main/examples', destination: './examples' })"
          }
        ]
      },
      "getChangeHistoryForFiles": {
        "description": "Gets the commit history for a set of files or glob patterns. Accepts absolute paths, relative paths (resolved from container.cwd), or glob patterns. Returns commits that touched any of the matched files, with each entry noting which of your queried files were in that commit.",
        "parameters": {
          "paths": {
            "type": "string[]",
            "description": "File paths or glob patterns to get history for"
          }
        },
        "required": [
          "paths"
        ],
        "returns": "Array<{ sha: string, message: string, longMessage: string, filesMatched: string[] }>",
        "examples": [
          {
            "language": "ts",
            "code": "const history = git.getChangeHistoryForFiles('src/container.ts', 'src/helper.ts')\nconst history = git.getChangeHistoryForFiles('src/node/features/*.ts')"
          }
        ]
      }
    },
    "getters": {
      "gitPath": {
        "description": "Resolve the git binary path, caching the result.",
        "returns": "string"
      },
      "branch": {
        "description": "Gets the current Git branch name.",
        "returns": "string | null",
        "examples": [
          {
            "language": "ts",
            "code": "const currentBranch = git.branch\nif (currentBranch) {\n console.log(`Currently on branch: ${currentBranch}`)\n}"
          }
        ]
      },
      "sha": {
        "description": "Gets the current Git commit SHA hash.",
        "returns": "string | null",
        "examples": [
          {
            "language": "ts",
            "code": "const commitSha = git.sha\nif (commitSha) {\n console.log(`Current commit: ${commitSha}`)\n}"
          }
        ]
      },
      "isRepo": {
        "description": "Checks if the current directory is within a Git repository.",
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (git.isRepo) {\n console.log('This is a Git repository!')\n} else {\n console.log('Not in a Git repository')\n}"
          }
        ]
      },
      "isRepoRoot": {
        "description": "Checks if the current working directory is the root of the Git repository.",
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (git.isRepoRoot) {\n console.log('At the repository root')\n} else {\n console.log('In a subdirectory of the repository')\n}"
          }
        ]
      },
      "repoRoot": {
        "description": "Gets the absolute path to the Git repository root directory. This method caches the repository root path for performance. It searches upward from the current directory to find the .git directory.",
        "returns": "string | null",
        "examples": [
          {
            "language": "ts",
            "code": "const repoRoot = git.repoRoot\nif (repoRoot) {\n console.log(`Repository root: ${repoRoot}`)\n}"
          }
        ]
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const git = container.feature('git')\n\nif (git.isRepo) {\n console.log(`Current branch: ${git.branch}`)\n console.log(`Repository root: ${git.repoRoot}`)\n \n const allFiles = await git.lsFiles()\n const modifiedFiles = await git.lsFiles({ modified: true })\n}"
      }
    ],
    "types": {
      "LsFilesOptions": {
        "description": "",
        "properties": {
          "cached": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "deleted": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "modified": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "others": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "ignored": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "status": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "includeIgnored": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "exclude": {
            "type": "string | string[]",
            "description": "",
            "optional": true
          },
          "baseDir": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.dns",
    "description": "The Dns feature provides structured DNS lookups by wrapping the `dig` CLI. All query methods parse dig output into typed JSON objects, making it easy to explore and audit a domain's DNS configuration programmatically.",
    "shortcut": "features.dns",
    "className": "Dns",
    "methods": {
      "isAvailable": {
        "description": "Checks whether the `dig` binary is available on the system.",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "if (await dns.isAvailable()) {\n const records = await dns.a('example.com')\n}"
          }
        ]
      },
      "resolve": {
        "description": "Resolves DNS records of a given type for a domain. This is the core query method. All convenience methods (a, aaaa, mx, etc.) delegate to this method.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "type": {
            "type": "DnsRecordType",
            "description": "The DNS record type to look up"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": "DNS server to use (e.g. '8.8.8.8')"
              },
              "timeout": {
                "type": "number",
                "description": "Query timeout in seconds"
              },
              "short": {
                "type": "boolean",
                "description": "If true, returns only values (no TTL, class, etc.)"
              }
            }
          }
        },
        "required": [
          "domain",
          "type"
        ],
        "returns": "Promise<DnsQueryResult>",
        "examples": [
          {
            "language": "ts",
            "code": "const result = await dns.resolve('example.com', 'A')\nfor (const record of result.records) {\n console.log(`${record.name} -> ${record.value} (TTL: ${record.ttl}s)`)\n}\n\n// Query a specific DNS server\nconst result = await dns.resolve('example.com', 'A', { server: '1.1.1.1' })"
          }
        ]
      },
      "a": {
        "description": "Looks up A (IPv4 address) records for a domain.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<DnsRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.a('google.com')\n// [{ name: 'google.com.', ttl: 300, class: 'IN', type: 'A', value: '142.250.x.x' }]"
          }
        ]
      },
      "aaaa": {
        "description": "Looks up AAAA (IPv6 address) records for a domain.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<DnsRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.aaaa('google.com')\n// [{ name: 'google.com.', ttl: 300, class: 'IN', type: 'AAAA', value: '2607:f8b0:...' }]"
          }
        ]
      },
      "cname": {
        "description": "Looks up CNAME (canonical name) records for a domain.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<DnsRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.cname('www.github.com')\n// [{ name: 'www.github.com.', ttl: 3600, class: 'IN', type: 'CNAME', value: 'github.com.' }]"
          }
        ]
      },
      "mx": {
        "description": "Looks up MX (mail exchange) records for a domain. Returns enriched records with parsed priority and exchange fields.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<MxRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.mx('google.com')\n// [{ name: 'google.com.', ttl: 300, type: 'MX', priority: 10, exchange: 'smtp.google.com.' }]"
          }
        ]
      },
      "ns": {
        "description": "Looks up NS (nameserver) records for a domain.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<DnsRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.ns('google.com')\n// [{ name: 'google.com.', ttl: 86400, type: 'NS', value: 'ns1.google.com.' }, ...]"
          }
        ]
      },
      "txt": {
        "description": "Looks up TXT records for a domain. TXT records often contain SPF policies, DKIM keys, domain verification tokens, and other metadata.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<DnsRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.txt('google.com')\nconst spf = records.find(r => r.value.includes('v=spf1'))\nconsole.log(spf?.value) // 'v=spf1 include:_spf.google.com ~all'"
          }
        ]
      },
      "soa": {
        "description": "Looks up the SOA (Start of Authority) record for a domain. Returns enriched records with parsed SOA fields including primary nameserver, responsible party, serial number, and timing parameters.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<SoaRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.soa('google.com')\nconsole.log(records[0].mname)  // 'ns1.google.com.'\nconsole.log(records[0].serial) // 879543655"
          }
        ]
      },
      "srv": {
        "description": "Looks up SRV (service) records for a domain. SRV records specify the location of services. The domain should include the service and protocol prefix (e.g. `_sip._tcp.example.com`).",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The full SRV domain (e.g. `_sip._tcp.example.com`)"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<SrvRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.srv('_sip._tcp.example.com')\n// [{ priority: 10, weight: 60, port: 5060, target: 'sip.example.com.' }]"
          }
        ]
      },
      "caa": {
        "description": "Looks up CAA (Certificate Authority Authorization) records for a domain. CAA records specify which certificate authorities are allowed to issue certificates for a domain.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<CaaRecord[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const records = await dns.caa('google.com')\n// [{ flags: 0, tag: 'issue', issuer: 'pki.goog' }]"
          }
        ]
      },
      "reverse": {
        "description": "Performs a reverse DNS lookup for an IP address. Converts the IP to its in-addr.arpa form and queries for PTR records.",
        "parameters": {
          "ip": {
            "type": "string",
            "description": "The IPv4 address to look up"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "ip"
        ],
        "returns": "Promise<string[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const hostnames = await dns.reverse('8.8.8.8')\n// ['dns.google.']"
          }
        ]
      },
      "overview": {
        "description": "Retrieves a comprehensive DNS overview for a domain. Queries all common record types (A, AAAA, CNAME, MX, NS, TXT, SOA, CAA) in parallel and returns a consolidated view. This is the go-to method for exploring a domain's full DNS configuration.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "options": {
            "type": "QueryOptions",
            "description": "Optional query parameters applied to all queries",
            "properties": {
              "server": {
                "type": "string",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "short": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "domain"
        ],
        "returns": "Promise<DnsOverview>",
        "examples": [
          {
            "language": "ts",
            "code": "const overview = await dns.overview('example.com')\nconsole.log('IPs:', overview.a.map(r => r.value))\nconsole.log('Mail:', overview.mx.map(r => r.exchange))\nconsole.log('Nameservers:', overview.ns.map(r => r.value))\nconsole.log('TXT:', overview.txt.map(r => r.value))"
          }
        ]
      },
      "compare": {
        "description": "Compares DNS resolution between two nameservers for a given record type. Useful for verifying DNS propagation or checking for inconsistencies between authoritative and recursive resolvers.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "type": {
            "type": "DnsRecordType",
            "description": "The DNS record type to compare"
          },
          "serverA": {
            "type": "string",
            "description": "First DNS server (e.g. '8.8.8.8')"
          },
          "serverB": {
            "type": "string",
            "description": "Second DNS server (e.g. '1.1.1.1')"
          }
        },
        "required": [
          "domain",
          "type",
          "serverA",
          "serverB"
        ],
        "returns": "Promise<{ serverA: DnsQueryResult; serverB: DnsQueryResult; match: boolean }>",
        "examples": [
          {
            "language": "ts",
            "code": "const diff = await dns.compare('example.com', 'A', '8.8.8.8', '1.1.1.1')\nconsole.log(diff.match)   // true if both return the same values\nconsole.log(diff.serverA) // records from 8.8.8.8\nconsole.log(diff.serverB) // records from 1.1.1.1"
          }
        ]
      },
      "queryAuthoritative": {
        "description": "Queries a domain's authoritative nameservers directly. First resolves the NS records, then queries each nameserver for the specified record type. Useful for bypassing caches and checking what the authoritative servers actually report.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "type": {
            "type": "DnsRecordType",
            "description": "The DNS record type to look up"
          }
        },
        "required": [
          "domain",
          "type"
        ],
        "returns": "Promise<DnsQueryResult[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const results = await dns.queryAuthoritative('example.com', 'A')\nfor (const r of results) {\n console.log(`${r.server}: ${r.records.map(rec => rec.value).join(', ')}`)\n}"
          }
        ]
      },
      "hasTxtRecord": {
        "description": "Checks whether a domain has a specific TXT record containing the given text. Useful for verifying domain ownership tokens, SPF records, DKIM entries, etc.",
        "parameters": {
          "domain": {
            "type": "string",
            "description": "The domain name to query"
          },
          "search": {
            "type": "string",
            "description": "The text to search for in TXT record values"
          }
        },
        "required": [
          "domain",
          "search"
        ],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "// Check for SPF record\nconst hasSPF = await dns.hasTxtRecord('google.com', 'v=spf1')\n\n// Check for domain verification\nconst verified = await dns.hasTxtRecord('example.com', 'google-site-verification=')"
          }
        ]
      }
    },
    "getters": {
      "proc": {
        "description": "",
        "returns": "any"
      },
      "digPath": {
        "description": "Resolved path to the dig binary",
        "returns": "string"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const dns = container.feature('dns')\n\n// Look up A records\nconst result = await dns.resolve('example.com', 'A')\nconsole.log(result.records)\n\n// Get a full overview of all record types\nconst overview = await dns.overview('example.com')\nconsole.log(overview.mx)  // mail servers\nconsole.log(overview.ns)  // nameservers\nconsole.log(overview.txt) // TXT records (SPF, DKIM, etc.)\n\n// Reverse lookup\nconst ptr = await dns.reverse('8.8.8.8')\nconsole.log(ptr) // ['dns.google.']"
      }
    ],
    "types": {
      "QueryOptions": {
        "description": "",
        "properties": {
          "server": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "timeout": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "short": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.downloader",
    "description": "A feature that provides file downloading capabilities from URLs. The Downloader feature allows you to fetch files from remote URLs and save them to the local filesystem. It handles the network request, buffering, and file writing operations automatically.",
    "shortcut": "features.downloader",
    "className": "Downloader",
    "methods": {
      "download": {
        "description": "Downloads a file from a URL and saves it to the specified local path. This method fetches the file from the provided URL, converts it to a buffer, and writes it to the filesystem at the target path. The target path is resolved relative to the container's configured paths.",
        "parameters": {
          "url": {
            "type": "string",
            "description": "The URL to download the file from. Must be a valid HTTP/HTTPS URL."
          },
          "targetPath": {
            "type": "string",
            "description": "The local file path where the downloaded file should be saved."
          }
        },
        "required": [
          "url",
          "targetPath"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "// Download an image file\nconst imagePath = await downloader.download(\n 'https://example.com/photo.jpg',\n 'images/downloaded-photo.jpg'\n)\n\n// Download a document\nconst docPath = await downloader.download(\n 'https://api.example.com/files/document.pdf',\n 'documents/report.pdf'\n)"
          }
        ]
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
        "code": "// Enable the downloader feature\nconst downloader = container.feature('downloader')\n\n// Download a file\nconst localPath = await downloader.download(\n 'https://example.com/image.jpg',\n 'downloads/image.jpg'\n)\nconsole.log(`File saved to: ${localPath}`)"
      }
    ]
  },
  {
    "id": "features.proc",
    "description": "The ChildProcess feature provides utilities for executing external processes and commands. This feature wraps Node.js child process functionality to provide convenient methods for executing shell commands, spawning processes, and capturing their output. It supports both synchronous and asynchronous execution with various options.",
    "shortcut": "features.proc",
    "className": "ChildProcess",
    "methods": {
      "execAndCapture": {
        "description": "Executes a command string and captures its output asynchronously. This method takes a complete command string, splits it into command and arguments, and executes it using the spawnAndCapture method. It's a convenient wrapper for simple command execution.",
        "parameters": {
          "cmd": {
            "type": "string",
            "description": "The complete command string to execute (e.g., \"git status --porcelain\")"
          },
          "options": {
            "type": "any",
            "description": "Options to pass to the underlying spawn process"
          }
        },
        "required": [
          "cmd"
        ],
        "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>",
        "examples": [
          {
            "language": "ts",
            "code": "// Execute a git command\nconst result = await proc.execAndCapture('git status --porcelain')\nif (result.exitCode === 0) {\n console.log('Git status:', result.stdout)\n} else {\n console.error('Git error:', result.stderr)\n}\n\n// Execute with options\nconst result = await proc.execAndCapture('npm list --depth=0', {\n cwd: '/path/to/project'\n})"
          }
        ]
      },
      "spawnAndCapture": {
        "description": "Spawns a process and captures its output with real-time monitoring capabilities. This method provides comprehensive process execution with the ability to capture output, monitor real-time data streams, and handle process lifecycle events. It's ideal for long-running processes where you need to capture output as it happens.",
        "parameters": {
          "command": {
            "type": "string",
            "description": "The command to execute (e.g., 'node', 'npm', 'git')"
          },
          "args": {
            "type": "string[]",
            "description": "Array of arguments to pass to the command"
          },
          "options": {
            "type": "SpawnOptions",
            "description": "Options for process execution and monitoring",
            "properties": {
              "stdio": {
                "type": "\"ignore\" | \"inherit\"",
                "description": "Standard I/O mode for the child process"
              },
              "stdout": {
                "type": "\"ignore\" | \"inherit\"",
                "description": "Stdout mode for the child process"
              },
              "stderr": {
                "type": "\"ignore\" | \"inherit\"",
                "description": "Stderr mode for the child process"
              },
              "cwd": {
                "type": "string",
                "description": "Working directory for the child process"
              },
              "environment": {
                "type": "Record<string, any>",
                "description": "Environment variables to pass to the child process"
              },
              "onError": {
                "type": "(data: string) => void",
                "description": "Callback invoked when stderr data is received"
              },
              "onOutput": {
                "type": "(data: string) => void",
                "description": "Callback invoked when stdout data is received"
              },
              "onExit": {
                "type": "(code: number) => void",
                "description": "Callback invoked when the process exits"
              },
              "onStart": {
                "type": "(childProcess: ChildProcess) => void",
                "description": "Callback invoked when the process starts"
              }
            }
          }
        },
        "required": [
          "command",
          "args"
        ],
        "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>",
        "examples": [
          {
            "language": "ts",
            "code": "// Basic usage\nconst result = await proc.spawnAndCapture('node', ['--version'])\nconsole.log(`Node version: ${result.stdout}`)\n\n// With real-time output monitoring\nconst result = await proc.spawnAndCapture('npm', ['install'], {\n onOutput: (data) => console.log('📦 ', data.trim()),\n onError: (data) => console.error('❌ ', data.trim()),\n onExit: (code) => console.log(`Process exited with code ${code}`)\n})\n\n// Long-running process with custom working directory\nconst buildResult = await proc.spawnAndCapture('npm', ['run', 'build'], {\n cwd: '/path/to/project',\n onOutput: (data) => {\n   if (data.includes('error')) {\n     console.error('Build error detected:', data)\n   }\n }\n})"
          }
        ]
      },
      "spawn": {
        "description": "Spawn a raw child process and return the handle immediately. Useful when callers need streaming access to stdout/stderr and direct lifecycle control (for example, cancellation via kill()).",
        "parameters": {
          "command": {
            "type": "string",
            "description": "Parameter command"
          },
          "args": {
            "type": "string[]",
            "description": "Parameter args"
          },
          "options": {
            "type": "RawSpawnOptions",
            "description": "Parameter options",
            "properties": {
              "cwd": {
                "type": "string",
                "description": "Working directory for the child process"
              },
              "environment": {
                "type": "Record<string, any>",
                "description": "Environment variables to pass to the child process"
              },
              "stdin": {
                "type": "string | Buffer",
                "description": "Optional stdin payload written immediately after spawn"
              },
              "stdout": {
                "type": "\"pipe\" | \"inherit\" | \"ignore\"",
                "description": "Stdout mode for the child process"
              },
              "stderr": {
                "type": "\"pipe\" | \"inherit\" | \"ignore\"",
                "description": "Stderr mode for the child process"
              }
            }
          }
        },
        "required": [
          "command"
        ],
        "returns": "import('child_process').ChildProcess"
      },
      "exec": {
        "description": "Execute a command synchronously and return its output. Runs a shell command and waits for it to complete before returning. Useful for simple commands where you need the result immediately.",
        "parameters": {
          "command": {
            "type": "string",
            "description": "The command to execute"
          },
          "options": {
            "type": "any",
            "description": "Options for command execution (cwd, encoding, etc.)"
          }
        },
        "required": [
          "command"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const branch = proc.exec('git branch --show-current')\nconst version = proc.exec('node --version')"
          }
        ]
      },
      "execSync": {
        "description": "",
        "parameters": {
          "command": {
            "type": "string",
            "description": "Parameter command"
          },
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [
          "command"
        ],
        "returns": "string"
      },
      "establishLock": {
        "description": "Establishes a PID-file lock to prevent duplicate process instances. Writes the current process PID to the given file path. If the file already exists and the PID inside it refers to a running process, the current process exits immediately. Stale PID files (where the process is no longer running) are automatically cleaned up. Cleanup handlers are registered on SIGTERM, SIGINT, and process exit to remove the PID file when the process shuts down.",
        "parameters": {
          "pidPath": {
            "type": "string",
            "description": "Path to the PID file, resolved relative to container.cwd"
          }
        },
        "required": [
          "pidPath"
        ],
        "returns": "{ release: () => void }",
        "examples": [
          {
            "language": "ts",
            "code": "// In a command handler — exits if already running\nconst lock = proc.establishLock('tmp/luca-main.pid')\n\n// Later, if you need to release manually\nlock.release()"
          }
        ]
      },
      "kill": {
        "description": "Kills a process by its PID.",
        "parameters": {
          "pid": {
            "type": "number",
            "description": "The process ID to kill"
          },
          "signal": {
            "type": "NodeJS.Signals | number",
            "description": "The signal to send (e.g. 'SIGTERM', 'SIGKILL', 9)"
          }
        },
        "required": [
          "pid"
        ],
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "// Gracefully terminate a process\nproc.kill(12345)\n\n// Force kill a process\nproc.kill(12345, 'SIGKILL')"
          }
        ]
      },
      "findPidsByPort": {
        "description": "Finds PIDs of processes listening on a given port. Uses `lsof` on macOS/Linux to discover which processes have a socket bound to the specified port.",
        "parameters": {
          "port": {
            "type": "number",
            "description": "The port number to search for"
          }
        },
        "required": [
          "port"
        ],
        "returns": "number[]",
        "examples": [
          {
            "language": "ts",
            "code": "const pids = proc.findPidsByPort(3000)\nconsole.log(`Processes on port 3000: ${pids}`)\n\n// Kill everything on port 3000\nfor (const pid of proc.findPidsByPort(3000)) {\n proc.kill(pid)\n}"
          }
        ]
      },
      "isProcessRunning": {
        "description": "Checks whether any process matching a given name is currently running. Uses `pgrep -x` for an exact match against process names.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The process name to look for (e.g. 'afplay', 'node', 'nginx')"
          }
        },
        "required": [
          "name"
        ],
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (proc.isProcessRunning('afplay')) {\n console.log('Audio is currently playing')\n}"
          }
        ]
      },
      "onSignal": {
        "description": "",
        "parameters": {
          "signal": {
            "type": "NodeJS.Signals",
            "description": "Parameter signal"
          },
          "handler": {
            "type": "() => void",
            "description": "Parameter handler"
          }
        },
        "required": [
          "signal",
          "handler"
        ],
        "returns": "() => void"
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
        "code": "const proc = container.feature('proc')\n\n// Execute a simple command synchronously\nconst result = proc.exec('echo \"Hello World\"')\nconsole.log(result) // 'Hello World'\n\n// Execute and capture output asynchronously\nconst { stdout, stderr } = await proc.spawnAndCapture('npm', ['--version'])\nconsole.log(`npm version: ${stdout}`)\n\n// Execute with callbacks for real-time output\nawait proc.spawnAndCapture('npm', ['install'], {\n onOutput: (data) => console.log('OUT:', data),\n onError: (data) => console.log('ERR:', data)\n})"
      }
    ],
    "types": {
      "SpawnOptions": {
        "description": "",
        "properties": {
          "stdio": {
            "type": "\"ignore\" | \"inherit\"",
            "description": "Standard I/O mode for the child process",
            "optional": true
          },
          "stdout": {
            "type": "\"ignore\" | \"inherit\"",
            "description": "Stdout mode for the child process",
            "optional": true
          },
          "stderr": {
            "type": "\"ignore\" | \"inherit\"",
            "description": "Stderr mode for the child process",
            "optional": true
          },
          "cwd": {
            "type": "string",
            "description": "Working directory for the child process",
            "optional": true
          },
          "environment": {
            "type": "Record<string, any>",
            "description": "Environment variables to pass to the child process",
            "optional": true
          },
          "onError": {
            "type": "(data: string) => void",
            "description": "Callback invoked when stderr data is received",
            "optional": true
          },
          "onOutput": {
            "type": "(data: string) => void",
            "description": "Callback invoked when stdout data is received",
            "optional": true
          },
          "onExit": {
            "type": "(code: number) => void",
            "description": "Callback invoked when the process exits",
            "optional": true
          },
          "onStart": {
            "type": "(childProcess: ChildProcess) => void",
            "description": "Callback invoked when the process starts",
            "optional": true
          }
        }
      },
      "RawSpawnOptions": {
        "description": "",
        "properties": {
          "cwd": {
            "type": "string",
            "description": "Working directory for the child process",
            "optional": true
          },
          "environment": {
            "type": "Record<string, any>",
            "description": "Environment variables to pass to the child process",
            "optional": true
          },
          "stdin": {
            "type": "string | Buffer",
            "description": "Optional stdin payload written immediately after spawn",
            "optional": true
          },
          "stdout": {
            "type": "\"pipe\" | \"inherit\" | \"ignore\"",
            "description": "Stdout mode for the child process",
            "optional": true
          },
          "stderr": {
            "type": "\"pipe\" | \"inherit\" | \"ignore\"",
            "description": "Stderr mode for the child process",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.vm",
    "description": "The VM feature provides Node.js virtual machine capabilities for executing JavaScript code. This feature wraps Node.js's built-in `vm` module to provide secure code execution in isolated contexts. It's useful for running untrusted code, creating sandboxed environments, or dynamically executing code with controlled access to variables and modules.",
    "shortcut": "features.vm",
    "className": "VM",
    "methods": {
      "defineModule": {
        "description": "Register a virtual module that will be available to `require()` inside VM-executed code. Modules registered here take precedence over Node's native resolution.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The module specifier (e.g. `'@soederpop/luca'`, `'zod'`)"
          },
          "exports": {
            "type": "any",
            "description": "The module's exports object"
          }
        },
        "required": [
          "id",
          "exports"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const vm = container.feature('vm')\nvm.defineModule('@soederpop/luca', { Container, Feature, fs, proc })\nvm.defineModule('zod', { z })\n\n// Now loadModule can resolve these in user code:\n// import { Container } from '@soederpop/luca'  → works"
          }
        ]
      },
      "createRequireFor": {
        "description": "Build a require function that resolves from the virtual modules map first, falling back to Node's native `createRequire` for everything else.",
        "parameters": {
          "filePath": {
            "type": "string",
            "description": "The file path to scope native require resolution to"
          }
        },
        "required": [
          "filePath"
        ],
        "returns": "((id: string) => any) & { resolve: RequireResolve }"
      },
      "createScript": {
        "description": "Creates a new VM script from the provided code. This method compiles JavaScript code into a VM script that can be executed multiple times in different contexts. The script is pre-compiled for better performance when executing the same code repeatedly.",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The JavaScript code to compile into a script"
          },
          "options": {
            "type": "vm.ScriptOptions",
            "description": "Options for script compilation"
          }
        },
        "required": [
          "code"
        ],
        "returns": "vm.Script",
        "examples": [
          {
            "language": "ts",
            "code": "const script = vm.createScript('Math.max(a, b)')\n\n// Execute the script multiple times with different contexts\nconst result1 = script.runInContext(vm.createContext({ a: 5, b: 3 }))\nconst result2 = script.runInContext(vm.createContext({ a: 10, b: 20 }))"
          }
        ]
      },
      "isContext": {
        "description": "Check whether an object has already been contextified by `vm.createContext()`. Useful to avoid double-contextifying when you're not sure if the caller passed a plain object or an existing context.",
        "parameters": {
          "ctx": {
            "type": "unknown",
            "description": "The object to check"
          }
        },
        "required": [
          "ctx"
        ],
        "returns": "ctx is vm.Context",
        "examples": [
          {
            "language": "ts",
            "code": "const ctx = vm.createContext({ x: 1 })\nvm.isContext(ctx)   // true\nvm.isContext({ x: 1 }) // false"
          }
        ]
      },
      "createContext": {
        "description": "Create an isolated JavaScript execution context. Combines the container's context with any additional variables provided. If the input is already a VM context, it is returned as-is.",
        "parameters": {
          "ctx": {
            "type": "any",
            "description": "Additional context variables to include"
          }
        },
        "required": [],
        "returns": "vm.Context",
        "examples": [
          {
            "language": "ts",
            "code": "const context = vm.createContext({ user: { name: 'John' } })\nconst result = vm.runSync('user.name', context)"
          }
        ]
      },
      "wrapTopLevelAwait": {
        "description": "Wrap code containing top-level `await` in an async IIFE, injecting `return` before the last expression so the value is not lost. If the code does not contain `await`, or is already wrapped in an async function/arrow, it is returned unchanged.",
        "parameters": {
          "code": {
            "type": "string",
            "description": "Parameter code"
          }
        },
        "required": [
          "code"
        ],
        "returns": "string"
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
          }
        },
        "required": [
          "code"
        ],
        "returns": "Promise<T>"
      },
      "runCaptured": {
        "description": "Execute code and capture all console output as structured JSON. Returns both the execution result and an array of every `console.*` call made during execution, each entry recording the method name and arguments.",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The JavaScript code to execute"
          },
          "ctx": {
            "type": "any",
            "description": "Context variables to make available to the executing code"
          }
        },
        "required": [
          "code"
        ],
        "returns": "Promise<{\n    result: T\n    console: Array<{ method: string, args: any[] }>\n    context: vm.Context\n  }>",
        "examples": [
          {
            "language": "ts",
            "code": "const { result, console: calls } = await vm.runCaptured('console.log(\"hi\"); console.warn(\"oh\"); 42')\n// result === 42\n// calls === [{ method: 'log', args: ['hi'] }, { method: 'warn', args: ['oh'] }]"
          }
        ]
      },
      "runSync": {
        "description": "Execute JavaScript code synchronously in a controlled environment.",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The JavaScript code to execute"
          },
          "ctx": {
            "type": "any",
            "description": "Context variables to make available to the executing code"
          }
        },
        "required": [
          "code"
        ],
        "returns": "T",
        "examples": [
          {
            "language": "ts",
            "code": "const sum = vm.runSync('a + b', { a: 2, b: 3 })\nconsole.log(sum) // 5"
          }
        ]
      },
      "perform": {
        "description": "Execute code asynchronously and return both the result and the execution context. Unlike `run`, this method also returns the context object, allowing you to inspect variables set during execution.",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The JavaScript code to execute"
          },
          "ctx": {
            "type": "any",
            "description": "Context variables to make available to the executing code"
          }
        },
        "required": [
          "code"
        ],
        "returns": "Promise<{ result: T, context: vm.Context }>",
        "examples": [
          {
            "language": "ts",
            "code": "const { result, context } = await vm.perform('x = 42; x * 2', { x: 0 })\nconsole.log(result)     // 84\nconsole.log(context.x)  // 42"
          }
        ]
      },
      "performSync": {
        "description": "Executes JavaScript code synchronously and returns both the result and the execution context. Unlike `runSync`, this method also returns the context object, allowing you to inspect variables set during execution (e.g. `module.exports`). This is the synchronous equivalent of `perform()`.",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The JavaScript code to execute"
          },
          "ctx": {
            "type": "any",
            "description": "Context variables to make available to the executing code"
          }
        },
        "required": [
          "code"
        ],
        "returns": "{ result: T, context: vm.Context }",
        "examples": [
          {
            "language": "ts",
            "code": "const { result, context } = vm.performSync(code, {\n exports: {},\n module: { exports: {} },\n})\nconst moduleExports = context.module?.exports || context.exports"
          }
        ]
      },
      "loadModule": {
        "description": "Synchronously loads a JavaScript/TypeScript module from a file path, executing it in an isolated VM context and returning its exports. The module gets `require`, `exports`, and `module` globals automatically, plus any additional context you provide.",
        "parameters": {
          "filePath": {
            "type": "string",
            "description": "Absolute path to the module file to load"
          },
          "ctx": {
            "type": "any",
            "description": "Additional context variables to inject into the module's execution environment"
          }
        },
        "required": [
          "filePath"
        ],
        "returns": "Record<string, any>",
        "examples": [
          {
            "language": "ts",
            "code": "const vm = container.feature('vm')\n\n// Load a tools module, injecting the container\nconst tools = vm.loadModule('/path/to/tools.ts', { container, me: assistant })\n// tools.myFunction, tools.schemas, etc."
          }
        ]
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
        "code": "const vm = container.feature('vm')\n\n// Execute simple code\nconst result = vm.run('1 + 2 + 3')\nconsole.log(result) // 6\n\n// Execute code with custom context\nconst result2 = vm.run('greeting + \" \" + name', { \n greeting: 'Hello', \n name: 'World' \n})\nconsole.log(result2) // 'Hello World'"
      }
    ]
  },
  {
    "id": "features.googleDrive",
    "description": "Google Drive feature for listing, searching, browsing, and downloading files. Depends on the googleAuth feature for authentication. Creates a Drive v3 API client lazily and passes the auth client from googleAuth.",
    "shortcut": "features.googleDrive",
    "className": "GoogleDrive",
    "methods": {
      "listFiles": {
        "description": "List files in the user's Drive with an optional query filter.",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Drive search query (e.g. \"name contains 'report'\", \"mimeType='application/pdf'\")"
          },
          "options": {
            "type": "ListFilesOptions",
            "description": "Pagination and filtering options",
            "properties": {
              "pageSize": {
                "type": "number",
                "description": ""
              },
              "pageToken": {
                "type": "string",
                "description": ""
              },
              "orderBy": {
                "type": "string",
                "description": ""
              },
              "fields": {
                "type": "string",
                "description": ""
              },
              "corpora": {
                "type": "'user' | 'drive' | 'allDrives'",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<DriveFileList>"
      },
      "listFolder": {
        "description": "List files within a specific folder.",
        "parameters": {
          "folderId": {
            "type": "string",
            "description": "The Drive folder ID"
          },
          "options": {
            "type": "ListFilesOptions",
            "description": "Pagination and filtering options",
            "properties": {
              "pageSize": {
                "type": "number",
                "description": ""
              },
              "pageToken": {
                "type": "string",
                "description": ""
              },
              "orderBy": {
                "type": "string",
                "description": ""
              },
              "fields": {
                "type": "string",
                "description": ""
              },
              "corpora": {
                "type": "'user' | 'drive' | 'allDrives'",
                "description": ""
              }
            }
          }
        },
        "required": [
          "folderId"
        ],
        "returns": "Promise<DriveFileList>"
      },
      "browse": {
        "description": "Browse a folder's contents, separating files from subfolders.",
        "parameters": {
          "folderId": {
            "type": "string",
            "description": "Folder ID to browse (defaults to 'root')"
          }
        },
        "required": [],
        "returns": "Promise<DriveBrowseResult>"
      },
      "search": {
        "description": "Search files by name, content, or MIME type.",
        "parameters": {
          "term": {
            "type": "string",
            "description": "Search term to look for in file names and content"
          },
          "options": {
            "type": "SearchOptions",
            "description": "Additional search options like mimeType filter or folder restriction"
          }
        },
        "required": [
          "term"
        ],
        "returns": "Promise<DriveFileList>"
      },
      "getFile": {
        "description": "Get file metadata by file ID.",
        "parameters": {
          "fileId": {
            "type": "string",
            "description": "The Drive file ID"
          },
          "fields": {
            "type": "string",
            "description": "Specific fields to request (defaults to common fields)"
          }
        },
        "required": [
          "fileId"
        ],
        "returns": "Promise<DriveFile>"
      },
      "download": {
        "description": "Download a file's content as a Buffer. Uses alt=media for binary download of non-Google files.",
        "parameters": {
          "fileId": {
            "type": "string",
            "description": "The Drive file ID"
          }
        },
        "required": [
          "fileId"
        ],
        "returns": "Promise<Buffer>"
      },
      "downloadTo": {
        "description": "Download a file and save it to a local path.",
        "parameters": {
          "fileId": {
            "type": "string",
            "description": "The Drive file ID"
          },
          "localPath": {
            "type": "string",
            "description": "Local file path (resolved relative to container cwd)"
          }
        },
        "required": [
          "fileId",
          "localPath"
        ],
        "returns": "Promise<string>"
      },
      "exportFile": {
        "description": "Export a Google Workspace file (Docs, Sheets, Slides) to a given MIME type. Uses the Files.export endpoint.",
        "parameters": {
          "fileId": {
            "type": "string",
            "description": "The Drive file ID of a Google Workspace document"
          },
          "mimeType": {
            "type": "string",
            "description": "Target MIME type (e.g. 'text/plain', 'application/pdf', 'text/csv')"
          }
        },
        "required": [
          "fileId",
          "mimeType"
        ],
        "returns": "Promise<Buffer>"
      },
      "listDrives": {
        "description": "List all shared drives the user has access to.",
        "parameters": {},
        "required": [],
        "returns": "Promise<SharedDrive[]>"
      }
    },
    "getters": {
      "auth": {
        "description": "Access the google-auth feature lazily.",
        "returns": "GoogleAuth"
      }
    },
    "events": {
      "filesFetched": {
        "name": "filesFetched",
        "description": "Event emitted by GoogleDrive",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by GoogleDrive",
        "arguments": {}
      },
      "fileDownloaded": {
        "name": "fileDownloaded",
        "description": "Event emitted by GoogleDrive",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const drive = container.feature('googleDrive')\n\n// List recent files\nconst { files } = await drive.listFiles()\n\n// Search for documents\nconst { files: docs } = await drive.search('quarterly report', { mimeType: 'application/pdf' })\n\n// Browse a folder\nconst contents = await drive.browse('folder-id-here')\n\n// Download a file to disk\nawait drive.downloadTo('file-id', './downloads/report.pdf')"
      }
    ],
    "types": {
      "ListFilesOptions": {
        "description": "",
        "properties": {
          "pageSize": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "pageToken": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "orderBy": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "fields": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "corpora": {
            "type": "'user' | 'drive' | 'allDrives'",
            "description": "",
            "optional": true
          }
        }
      },
      "DriveFileList": {
        "description": "",
        "properties": {
          "files": {
            "type": "DriveFile[]",
            "description": ""
          },
          "nextPageToken": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      },
      "DriveFile": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "mimeType": {
            "type": "string",
            "description": ""
          },
          "size": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "createdTime": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "modifiedTime": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "parents": {
            "type": "string[]",
            "description": "",
            "optional": true
          },
          "webViewLink": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "iconLink": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "owners": {
            "type": "Array<{ displayName?: string | null; emailAddress?: string | null }>",
            "description": "",
            "optional": true
          }
        }
      },
      "DriveBrowseResult": {
        "description": "",
        "properties": {
          "folder": {
            "type": "DriveFile",
            "description": ""
          },
          "files": {
            "type": "DriveFile[]",
            "description": ""
          },
          "folders": {
            "type": "DriveFile[]",
            "description": ""
          },
          "nextPageToken": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      },
      "SharedDrive": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "colorRgb": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.ui",
    "description": "UI Feature - Interactive Terminal User Interface Builder Unified interface for building professional CLI experiences using chalk (colors/styles), figlet (ASCII art), and inquirer (interactive prompts). Provides rich color management, automatic color assignment, text gradients, banner generation, padding utilities, markdown rendering, and interactive wizards.",
    "shortcut": "features.ui",
    "className": "UI",
    "methods": {
      "markdown": {
        "description": "Parse markdown text and render it for terminal display using marked-terminal.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The markdown string to parse and render"
          }
        },
        "required": [
          "text"
        ],
        "returns": "string | Promise<string>"
      },
      "assignColor": {
        "description": "Assigns a consistent color to a named entity. This method provides automatic color assignment that remains consistent across the application session. Each unique name gets assigned a color from the palette, and subsequent calls with the same name return the same color function. **Assignment Strategy:** - First call with a name assigns the next available palette color - Subsequent calls return the previously assigned color - Colors cycle through the palette when all colors are used - Returns a chalk hex color function for styling text",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The unique identifier to assign a color to"
          }
        },
        "required": [
          "name"
        ],
        "returns": "(str: string) => string",
        "examples": [
          {
            "language": "ts",
            "code": "// Assign colors to users\nconst johnColor = ui.assignColor('john');\nconst janeColor = ui.assignColor('jane');\n\n// Use consistently throughout the app\nconsole.log(johnColor('John: Hello there!'));\nconsole.log(janeColor('Jane: Hi John!'));\nconsole.log(johnColor('John: How are you?')); // Same color as before\n\n// Different entities get different colors\nconst errorColor = ui.assignColor('error');\nconst successColor = ui.assignColor('success');"
          }
        ]
      },
      "wizard": {
        "description": "Creates an interactive wizard using inquirer prompts. This method provides a convenient wrapper around inquirer for creating interactive command-line wizards. It supports all inquirer question types and can handle complex validation and conditional logic. **Supported Question Types:** - input: Text input fields - confirm: Yes/no confirmations - list: Single selection from options - checkbox: Multiple selections - password: Hidden text input - editor: External editor integration **Advanced Features:** - Conditional questions based on previous answers - Input validation and transformation - Custom prompts and styling - Initial answer pre-population",
        "parameters": {
          "questions": {
            "type": "any[]",
            "description": "Array of inquirer question objects"
          },
          "initialAnswers": {
            "type": "any",
            "description": "Pre-populated answers to skip questions or provide defaults"
          }
        },
        "required": [
          "questions"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "// Basic wizard\nconst answers = await ui.wizard([\n {\n   type: 'input',\n   name: 'projectName',\n   message: 'What is your project name?',\n   validate: (input) => input.length > 0 || 'Name is required'\n },\n {\n   type: 'list',\n   name: 'framework',\n   message: 'Choose a framework:',\n   choices: ['React', 'Vue', 'Angular', 'Svelte']\n },\n {\n   type: 'confirm',\n   name: 'typescript',\n   message: 'Use TypeScript?',\n   default: true\n }\n]);\n\nconsole.log(`Creating ${answers.projectName} with ${answers.framework}`);\n\n// With initial answers\nconst moreAnswers = await ui.wizard([\n { type: 'input', name: 'version', message: 'Version?' }\n], { version: '1.0.0' });"
          }
        ]
      },
      "askQuestion": {
        "description": "Prompt the user with a single text input question.",
        "parameters": {
          "question": {
            "type": "string",
            "description": "The question message to display"
          }
        },
        "required": [
          "question"
        ],
        "returns": "Promise<any>"
      },
      "openInEditor": {
        "description": "Opens text in the user's external editor for editing. This method integrates with the user's configured editor (via $EDITOR or $VISUAL environment variables) to allow editing of text content. The edited content is returned when the user saves and closes the editor. **Editor Integration:** - Respects $EDITOR and $VISUAL environment variables - Creates temporary file with specified extension - Returns modified content after editor closes - Handles editor cancellation gracefully",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The initial text content to edit"
          },
          "extension": {
            "type": "any",
            "description": "File extension for syntax highlighting (default: \".ts\")"
          }
        },
        "required": [
          "text"
        ],
        "returns": "Promise<unknown>",
        "examples": [
          {
            "language": "ts",
            "code": "// Edit code snippet\nconst code = `function hello() {\\n  console.log('Hello');\\n}`;\nconst editedCode = await ui.openInEditor(code, '.js');\n\n// Edit configuration\nconst config = JSON.stringify({ port: 3000 }, null, 2);\nconst newConfig = await ui.openInEditor(config, '.json');\n\n// Edit markdown content\nconst markdown = '# Title\\n\\nContent here...';\nconst editedMarkdown = await ui.openInEditor(markdown, '.md');"
          }
        ]
      },
      "asciiArt": {
        "description": "Generates ASCII art from text using the specified font. This method converts regular text into stylized ASCII art using figlet's extensive font collection. Perfect for creating eye-catching headers, logos, and decorative text in terminal applications. **Font Capabilities:** - Large collection of artistic fonts - Various styles: block, script, decorative, technical - Different sizes and character sets - Consistent spacing and alignment",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to convert to ASCII art"
          },
          "font": {
            "type": "Fonts",
            "description": "The figlet font to use (see fonts property for available options)"
          }
        },
        "required": [
          "text",
          "font"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Create a banner\nconst banner = ui.asciiArt('WELCOME', 'Big');\nconsole.log(banner);\n\n// Different fonts for different purposes\nconst title = ui.asciiArt('MyApp', 'Standard');\nconst subtitle = ui.asciiArt('v2.0', 'Small');\n\n// Technical/coding themes\nconst code = ui.asciiArt('CODE', '3D-ASCII');\n\n// List available fonts first\nconsole.log('Available fonts:', ui.fonts.slice(0, 10).join(', '));"
          }
        ]
      },
      "banner": {
        "description": "Creates a styled banner with ASCII art and color gradients. This method combines ASCII art generation with color gradient effects to create visually striking banners for terminal applications. It automatically applies color gradients to the generated ASCII art based on the specified options. **Banner Features:** - ASCII art text generation - Automatic color gradient application - Customizable gradient directions - Multiple color combinations - Professional terminal presentation",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to convert to a styled banner"
          },
          "options": {
            "type": "{ font: Fonts; colors: Color[] }",
            "description": "Banner styling options",
            "properties": {
              "font": {
                "type": "any",
                "description": "The figlet font to use for ASCII art generation"
              },
              "colors": {
                "type": "any",
                "description": "Array of colors for the gradient effect"
              }
            }
          }
        },
        "required": [
          "text"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Classic patriotic banner\nconst banner = ui.banner('AMERICA', {\n font: 'Big',\n colors: ['red', 'white', 'blue']\n});\nconsole.log(banner);\n\n// Tech company banner\nconst techBanner = ui.banner('TechCorp', {\n font: 'Slant',\n colors: ['cyan', 'blue', 'magenta']\n});\n\n// Warning banner\nconst warningBanner = ui.banner('WARNING', {\n font: 'Standard',\n colors: ['yellow', 'red']\n});\n\n// Available fonts: see ui.fonts property\n// Available colors: any chalk color names"
          }
        ]
      },
      "endent": {
        "description": "Dedent and format a tagged template literal using endent. Strips leading indentation while preserving relative indentation.",
        "parameters": {
          "args": {
            "type": "any[]",
            "description": "Tagged template literal arguments"
          }
        },
        "required": [
          "args"
        ],
        "returns": "string"
      },
      "applyGradient": {
        "description": "Applies color gradients to text with configurable direction. This method creates smooth color transitions across text content, supporting both horizontal (character-by-character) and vertical (line-by-line) gradients. Perfect for creating visually appealing terminal output and ASCII art effects. **Gradient Types:** - Horizontal: Colors transition across characters in each line - Vertical: Colors transition across lines of text - Customizable color sequences and transitions - Automatic color cycling for long content",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text content to apply gradients to"
          },
          "lineColors": {
            "type": "Color[]",
            "description": "Array of colors to cycle through in the gradient"
          },
          "direction": {
            "type": "\"horizontal\" | \"vertical\"",
            "description": "Gradient direction: 'horizontal' or 'vertical'"
          }
        },
        "required": [
          "text"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Horizontal rainbow effect\nconst rainbow = ui.applyGradient('Hello World!', \n ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'], \n 'horizontal'\n);\n\n// Vertical gradient for multi-line text\nconst multiline = 'Line 1\\nLine 2\\nLine 3\\nLine 4';\nconst vertical = ui.applyGradient(multiline, \n ['red', 'white', 'blue'], \n 'vertical'\n);\n\n// Fire effect\nconst fire = ui.applyGradient('FIRE', ['red', 'yellow'], 'horizontal');\n\n// Ocean effect\nconst ocean = ui.applyGradient('OCEAN', ['blue', 'cyan', 'white'], 'vertical');"
          }
        ]
      },
      "applyHorizontalGradient": {
        "description": "Applies horizontal color gradients character by character. This method creates color transitions across characters within the text, cycling through the provided colors to create smooth horizontal gradients. Each character gets assigned a color based on its position in the sequence. **Horizontal Gradient Behavior:** - Each character is individually colored - Colors cycle through the provided array - Creates smooth transitions across text width - Works well with ASCII art and single lines",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to apply horizontal gradients to"
          },
          "lineColors": {
            "type": "Color[]",
            "description": "Array of colors to cycle through"
          }
        },
        "required": [
          "text"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Rainbow effect across characters\nconst rainbow = ui.applyHorizontalGradient('RAINBOW', \n ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta']\n);\n\n// Simple two-color transition\nconst sunset = ui.applyHorizontalGradient('SUNSET', ['red', 'orange']);\n\n// Great for short text and ASCII art\nconst art = ui.asciiArt('COOL', 'Big');\nconst coloredArt = ui.applyHorizontalGradient(art, ['cyan', 'blue']);"
          }
        ]
      },
      "applyVerticalGradient": {
        "description": "Applies vertical color gradients line by line. This method creates color transitions across lines of text, with each line getting a different color from the sequence. Perfect for multi-line content like ASCII art, banners, and structured output. **Vertical Gradient Behavior:** - Each line is colored uniformly - Colors cycle through the provided array - Creates smooth transitions across text height - Ideal for multi-line ASCII art and structured content",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to apply vertical gradients to (supports newlines)"
          },
          "lineColors": {
            "type": "Color[]",
            "description": "Array of colors to cycle through for each line"
          }
        },
        "required": [
          "text"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Patriotic vertical gradient\nconst flag = 'USA\\nUSA\\nUSA\\nUSA';\nconst patriotic = ui.applyVerticalGradient(flag, ['red', 'white', 'blue']);\n\n// Sunset effect on ASCII art\nconst banner = ui.asciiArt('SUNSET', 'Big');\nconst sunset = ui.applyVerticalGradient(banner, \n ['yellow', 'orange', 'red', 'purple']\n);\n\n// Ocean waves effect\nconst waves = 'Wave 1\\nWave 2\\nWave 3\\nWave 4\\nWave 5';\nconst ocean = ui.applyVerticalGradient(waves, ['cyan', 'blue']);"
          }
        ]
      },
      "padLeft": {
        "description": "Pads text on the left to reach the specified length. This utility method adds padding characters to the left side of text to achieve a desired total length. Useful for creating aligned columns, formatted tables, and consistent text layout in terminal applications. **Padding Behavior:** - Adds padding to the left (start) of the string - Uses specified padding character (default: space) - Returns original string if already at or beyond target length - Handles multi-character padding by repeating the character",
        "parameters": {
          "str": {
            "type": "string",
            "description": "The string to pad"
          },
          "length": {
            "type": "number",
            "description": "The desired total length after padding"
          },
          "padChar": {
            "type": "any",
            "description": "The character to use for padding (default: \" \")"
          }
        },
        "required": [
          "str",
          "length"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Number alignment\nconst numbers = ['1', '23', '456'];\nnumbers.forEach(num => {\n console.log(ui.padLeft(num, 5, '0')); // '00001', '00023', '00456'\n});\n\n// Text alignment in columns\nconst items = ['apple', 'banana', 'cherry'];\nitems.forEach(item => {\n console.log(ui.padLeft(item, 10) + ' | Price: $1.00');\n});\n\n// Custom padding character\nconst title = ui.padLeft('TITLE', 20, '-'); // '---------------TITLE'"
          }
        ]
      },
      "padRight": {
        "description": "Pads text on the right to reach the specified length. This utility method adds padding characters to the right side of text to achieve a desired total length. Essential for creating properly aligned columns, tables, and formatted output in terminal applications. **Padding Behavior:** - Adds padding to the right (end) of the string - Uses specified padding character (default: space) - Returns original string if already at or beyond target length - Handles multi-character padding by repeating the character",
        "parameters": {
          "str": {
            "type": "string",
            "description": "The string to pad"
          },
          "length": {
            "type": "number",
            "description": "The desired total length after padding"
          },
          "padChar": {
            "type": "any",
            "description": "The character to use for padding (default: \" \")"
          }
        },
        "required": [
          "str",
          "length"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// Create aligned table columns\nconst data = [\n ['Name', 'Age', 'City'],\n ['John', '25', 'NYC'],\n ['Jane', '30', 'LA'],\n ['Bob', '35', 'Chicago']\n];\n\ndata.forEach(row => {\n const formatted = row.map((cell, i) => {\n   const widths = [15, 5, 10];\n   return ui.padRight(cell, widths[i]);\n }).join(' | ');\n console.log(formatted);\n});\n\n// Progress bars\nconst progress = ui.padRight('████', 20, '░'); // '████░░░░░░░░░░░░░░░░'\n\n// Menu items with dots\nconst menuItem = ui.padRight('Coffee', 20, '.') + '$3.50';"
          }
        ]
      }
    },
    "getters": {
      "colors": {
        "description": "Provides access to the full chalk colors API. Chalk provides extensive color and styling capabilities including: - Basic colors: red, green, blue, yellow, etc. - Background colors: bgRed, bgGreen, etc. - Styles: bold, italic, underline, strikethrough - Advanced: rgb, hex, hsl color support Colors and styles can be chained for complex formatting.",
        "returns": "typeof colors",
        "examples": [
          {
            "language": "ts",
            "code": "// Basic colors\nui.colors.red('Error message')\nui.colors.green('Success!')\n\n// Chained styling\nui.colors.blue.bold.underline('Important link')\nui.colors.white.bgRed.bold(' ALERT ')\n\n// Hex and RGB colors\nui.colors.hex('#FF5733')('Custom color')\nui.colors.rgb(255, 87, 51)('RGB color')"
          }
        ]
      },
      "colorPalette": {
        "description": "Gets the current color palette used for automatic color assignment. The color palette is a predefined set of hex colors that are automatically assigned to named entities in a cycling fashion. This ensures consistent color assignment across the application.",
        "returns": "string[]"
      },
      "randomColor": {
        "description": "Gets a random color name from the available chalk colors. This provides access to a randomly selected color from chalk's built-in color set. Useful for adding variety to terminal output or testing.",
        "returns": "string | undefined",
        "examples": [
          {
            "language": "ts",
            "code": "const randomColor = ui.randomColor;\nconsole.log(ui.colors[randomColor]('This text is a random color!'));\n\n// Use in loops for varied output\nitems.forEach(item => {\n const color = ui.randomColor;\n console.log(ui.colors[color](`- ${item}`));\n});"
          }
        ]
      },
      "fonts": {
        "description": "Gets an array of available fonts for ASCII art generation. This method provides access to all fonts available through figlet for creating ASCII art. The fonts are automatically discovered and cached on first access for performance. **Font Discovery:** - Fonts are loaded from figlet's built-in font collection - Results are cached in state to avoid repeated file system access - Returns comprehensive list of available font names",
        "returns": "string[]",
        "examples": [
          {
            "language": "ts",
            "code": "// List all available fonts\nconst fonts = ui.fonts;\nconsole.log(`Available fonts: ${fonts.join(', ')}`);\n\n// Use random font for variety\nconst randomFont = fonts[Math.floor(Math.random() * fonts.length)];\nconst art = ui.asciiArt('Hello', randomFont);\n\n// Common fonts: 'Big', 'Standard', 'Small', 'Slant', '3D-ASCII'"
          }
        ]
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.opener",
    "description": "The Opener feature opens files, URLs, desktop applications, and code editors. HTTP/HTTPS URLs are opened in Google Chrome. Desktop apps can be launched by name. VS Code and Cursor can be opened to a specific path. All other paths are opened with the platform's default handler (e.g. Preview for images, Finder for folders).",
    "shortcut": "features.opener",
    "className": "Opener",
    "methods": {
      "open": {
        "description": "Opens a path or URL with the appropriate application. HTTP and HTTPS URLs are opened in Google Chrome. Everything else is opened with the system default handler via `open` (macOS).",
        "parameters": {
          "target": {
            "type": "string",
            "description": "A URL or file path to open"
          }
        },
        "required": [
          "target"
        ],
        "returns": "Promise<void>"
      },
      "app": {
        "description": "Opens a desktop application by name. On macOS, uses `open -a` to launch the app. On Windows, uses `start`. On Linux, attempts to run the lowercase app name as a command.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The application name (e.g. \"Slack\", \"Finder\", \"Safari\")"
          }
        },
        "required": [
          "name"
        ],
        "returns": "Promise<void>"
      },
      "code": {
        "description": "Opens VS Code at the specified path. Uses the `code` CLI command. Falls back to `open -a \"Visual Studio Code\"` on macOS.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file or folder path to open"
          }
        },
        "required": [],
        "returns": "Promise<void>"
      },
      "cursor": {
        "description": "Opens Cursor at the specified path. Uses the `cursor` CLI command. Falls back to `open -a \"Cursor\"` on macOS.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file or folder path to open"
          }
        },
        "required": [],
        "returns": "Promise<void>"
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
        "code": "const opener = container.feature('opener')\n\n// Open a URL in Chrome\nawait opener.open('https://www.google.com')\n\n// Open a file with the default application\nawait opener.open('/path/to/image.png')\n\n// Open a desktop application\nawait opener.app('Slack')\n\n// Open VS Code at a project path\nawait opener.code('/Users/jon/projects/my-app')\n\n// Open Cursor at a project path\nawait opener.cursor('/Users/jon/projects/my-app')"
      }
    ]
  },
  {
    "id": "features.telegram",
    "description": "Telegram bot feature powered by grammY. Supports both long-polling and webhook modes. Exposes the grammY Bot instance directly for full API access while bridging events to Luca's event bus.",
    "shortcut": "features.telegram",
    "className": "Telegram",
    "methods": {
      "enable": {
        "description": "",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "start": {
        "description": "Start the bot in the configured mode (polling or webhook).",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "stop": {
        "description": "Stop the bot gracefully.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "command": {
        "description": "Register a command handler. Also emits 'command' on the Luca event bus.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Parameter name"
          },
          "handler": {
            "type": "(ctx: Context) => any",
            "description": "Parameter handler"
          }
        },
        "required": [
          "name",
          "handler"
        ],
        "returns": "this"
      },
      "handle": {
        "description": "Register a grammY update handler (filter query). Named 'handle' to avoid collision with the inherited on() event bus method.",
        "parameters": {
          "filter": {
            "type": "Parameters<Bot['on']>[0]",
            "description": "Parameter filter"
          },
          "handler": {
            "type": "(ctx: any) => any",
            "description": "Parameter handler"
          }
        },
        "required": [
          "filter",
          "handler"
        ],
        "returns": "this",
        "examples": [
          {
            "language": "ts",
            "code": "tg.handle('message:text', (ctx) => ctx.reply('Got text'))\ntg.handle('callback_query:data', (ctx) => ctx.answerCallbackQuery('Clicked'))"
          }
        ]
      },
      "use": {
        "description": "Add grammY middleware.",
        "parameters": {
          "middleware": {
            "type": "Middleware[]",
            "description": "Parameter middleware"
          }
        },
        "required": [
          "middleware"
        ],
        "returns": "this"
      },
      "startPolling": {
        "description": "Start long-polling mode.",
        "parameters": {
          "dropPendingUpdates": {
            "type": "boolean",
            "description": "Parameter dropPendingUpdates"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "setupWebhook": {
        "description": "Set up webhook mode with an Express server.",
        "parameters": {
          "url": {
            "type": "string",
            "description": "Parameter url"
          },
          "path": {
            "type": "string",
            "description": "Parameter path"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "deleteWebhook": {
        "description": "Remove the webhook from Telegram.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "getMe": {
        "description": "Get bot info from Telegram API.",
        "parameters": {},
        "required": [],
        "returns": "Promise<UserFromGetMe>"
      },
      "diagnostics": {
        "description": "Print a diagnostic summary of the bot's current state.",
        "parameters": {},
        "required": [],
        "returns": "this"
      }
    },
    "getters": {
      "token": {
        "description": "Bot token from options or TELEGRAM_BOT_TOKEN env var.",
        "returns": "string"
      },
      "bot": {
        "description": "The grammY Bot instance. Created lazily on first access.",
        "returns": "Bot"
      },
      "isRunning": {
        "description": "Whether the bot is currently receiving updates.",
        "returns": "boolean"
      },
      "mode": {
        "description": "Current operation mode: 'polling', 'webhook', or 'idle'.",
        "returns": "'polling' | 'webhook' | 'idle'"
      }
    },
    "events": {
      "stopped": {
        "name": "stopped",
        "description": "Event emitted by Telegram",
        "arguments": {}
      },
      "command": {
        "name": "command",
        "description": "Event emitted by Telegram",
        "arguments": {}
      },
      "started": {
        "name": "started",
        "description": "Event emitted by Telegram",
        "arguments": {}
      },
      "webhook_ready": {
        "name": "webhook_ready",
        "description": "Event emitted by Telegram",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by Telegram",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const tg = container.feature('telegram', { autoStart: true })\ntg.command('start', (ctx) => ctx.reply('Hello!'))\ntg.handle('message:text', (ctx) => ctx.reply(`Echo: ${ctx.message.text}`))"
      }
    ]
  },
  {
    "id": "features.repl",
    "description": "REPL feature — provides an interactive read-eval-print loop with tab completion and history. Launches a REPL session that evaluates JavaScript/TypeScript expressions in a sandboxed VM context populated with the container and its helpers. Supports tab completion for dot-notation property access, command history persistence, and async/await.",
    "shortcut": "features.repl",
    "className": "Repl",
    "methods": {
      "start": {
        "description": "Start the REPL session. Creates a VM context populated with the container and its helpers, sets up readline with tab completion and history, then enters the interactive loop. Type `.exit` or `exit` to quit. Supports top-level await.",
        "parameters": {
          "options": {
            "type": "{ historyPath?: string, context?: any }",
            "description": "Configuration for the REPL session",
            "properties": {
              "historyPath": {
                "type": "any",
                "description": "Custom path for the history file (defaults to ~/.cache/luca/repl-{cwdHash}.history)"
              },
              "context": {
                "type": "any",
                "description": "Additional variables to inject into the VM context"
              }
            }
          }
        },
        "required": [],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const repl = container.feature('repl', { enable: true })\nawait repl.start({\n context: { db: myDatabase },\n historyPath: '.repl-history'\n})"
          }
        ]
      }
    },
    "getters": {
      "isStarted": {
        "description": "Whether the REPL session is currently running.",
        "returns": "any"
      },
      "vmContext": {
        "description": "The VM context object used for evaluating expressions in the REPL.",
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
        "code": "const repl = container.feature('repl', { enable: true })\nawait repl.start({ context: { myVar: 42 } })"
      }
    ]
  },
  {
    "id": "features.googleMail",
    "description": "Google Mail feature for searching, reading, and watching Gmail messages. Depends on the googleAuth feature for authentication. Creates a Gmail v1 API client lazily. Supports Gmail search query syntax, individual message reading, and polling-based new mail detection with event emission.",
    "shortcut": "features.googleMail",
    "className": "GoogleMail",
    "methods": {
      "search": {
        "description": "Search for messages using Gmail query syntax and/or structured filters.",
        "parameters": {
          "options": {
            "type": "SearchMailOptions",
            "description": "Search filters including query, from, to, subject, date ranges",
            "properties": {
              "query": {
                "type": "string",
                "description": ""
              },
              "from": {
                "type": "string",
                "description": ""
              },
              "to": {
                "type": "string",
                "description": ""
              },
              "subject": {
                "type": "string",
                "description": ""
              },
              "after": {
                "type": "string",
                "description": ""
              },
              "before": {
                "type": "string",
                "description": ""
              },
              "hasAttachment": {
                "type": "boolean",
                "description": ""
              },
              "label": {
                "type": "string",
                "description": ""
              },
              "isUnread": {
                "type": "boolean",
                "description": ""
              },
              "maxResults": {
                "type": "number",
                "description": ""
              },
              "pageToken": {
                "type": "string",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<MailMessageList>"
      },
      "getMessage": {
        "description": "Get a single message by ID.",
        "parameters": {
          "messageId": {
            "type": "string",
            "description": "The message ID"
          },
          "format": {
            "type": "'full' | 'metadata' | 'minimal' | 'raw'",
            "description": "Message format (defaults to options.format or 'full')"
          }
        },
        "required": [
          "messageId"
        ],
        "returns": "Promise<MailMessage>"
      },
      "getThread": {
        "description": "Get a full thread with all its messages.",
        "parameters": {
          "threadId": {
            "type": "string",
            "description": "The thread ID"
          }
        },
        "required": [
          "threadId"
        ],
        "returns": "Promise<MailThread>"
      },
      "listLabels": {
        "description": "List all labels for the authenticated user.",
        "parameters": {},
        "required": [],
        "returns": "Promise<MailLabel[]>"
      },
      "startWatching": {
        "description": "Start watching for new mail by polling at a regular interval. Emits 'newMail' events with an array of new messages when they arrive. Uses Gmail history API to efficiently detect only new messages since the last check.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "stopWatching": {
        "description": "Stop watching for new mail.",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "auth": {
        "description": "Access the google-auth feature lazily.",
        "returns": "GoogleAuth"
      },
      "userId": {
        "description": "Default user ID from options or 'me'.",
        "returns": "string"
      },
      "defaultFormat": {
        "description": "Default message format from options or 'full'.",
        "returns": "'full' | 'metadata' | 'minimal' | 'raw'"
      },
      "pollInterval": {
        "description": "Polling interval from options or 30 seconds.",
        "returns": "number"
      }
    },
    "events": {
      "messagesFetched": {
        "name": "messagesFetched",
        "description": "Event emitted by GoogleMail",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by GoogleMail",
        "arguments": {}
      },
      "watchStarted": {
        "name": "watchStarted",
        "description": "Event emitted by GoogleMail",
        "arguments": {}
      },
      "watchStopped": {
        "name": "watchStopped",
        "description": "Event emitted by GoogleMail",
        "arguments": {}
      },
      "newMail": {
        "name": "newMail",
        "description": "Event emitted by GoogleMail",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const mail = container.feature('googleMail')\n\n// Search by sender\nconst fromBoss = await mail.search({ from: 'boss@company.com' })\n\n// Use Gmail query string\nconst unread = await mail.search({ query: 'is:unread category:primary' })\n\n// Read a specific message\nconst msg = await mail.getMessage('message-id-here')\n\n// Get a full thread\nconst thread = await mail.getThread('thread-id-here')\n\n// List labels\nconst labels = await mail.listLabels()\n\n// Watch for new mail (polls and emits 'newMail' events)\nmail.on('newMail', (messages) => {\n console.log(`Got ${messages.length} new messages!`)\n})\nawait mail.startWatching()\n\n// Stop watching\nmail.stopWatching()"
      }
    ],
    "types": {
      "SearchMailOptions": {
        "description": "",
        "properties": {
          "query": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "from": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "to": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "subject": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "after": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "before": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "hasAttachment": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "label": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "isUnread": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "maxResults": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "pageToken": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      },
      "MailMessageList": {
        "description": "",
        "properties": {
          "messages": {
            "type": "MailMessage[]",
            "description": ""
          },
          "nextPageToken": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "resultSizeEstimate": {
            "type": "number",
            "description": "",
            "optional": true
          }
        }
      },
      "MailMessage": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "threadId": {
            "type": "string",
            "description": ""
          },
          "labelIds": {
            "type": "string[]",
            "description": ""
          },
          "snippet": {
            "type": "string",
            "description": ""
          },
          "subject": {
            "type": "string",
            "description": ""
          },
          "from": {
            "type": "string",
            "description": ""
          },
          "to": {
            "type": "string",
            "description": ""
          },
          "cc": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "date": {
            "type": "string",
            "description": ""
          },
          "body": {
            "type": "string",
            "description": ""
          },
          "bodyHtml": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "isUnread": {
            "type": "boolean",
            "description": ""
          },
          "hasAttachments": {
            "type": "boolean",
            "description": ""
          },
          "attachments": {
            "type": "MailAttachment[]",
            "description": ""
          }
        }
      },
      "MailAttachment": {
        "description": "",
        "properties": {
          "filename": {
            "type": "string",
            "description": ""
          },
          "mimeType": {
            "type": "string",
            "description": ""
          },
          "size": {
            "type": "number",
            "description": ""
          },
          "attachmentId": {
            "type": "string",
            "description": ""
          }
        }
      },
      "MailThread": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "snippet": {
            "type": "string",
            "description": ""
          },
          "historyId": {
            "type": "string",
            "description": ""
          },
          "messages": {
            "type": "MailMessage[]",
            "description": ""
          }
        }
      },
      "MailLabel": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "type": {
            "type": "string",
            "description": ""
          },
          "messagesTotal": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "messagesUnread": {
            "type": "number",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.os",
    "description": "The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.",
    "shortcut": "features.os",
    "className": "OS",
    "methods": {
      "whichCommand": {
        "description": "Resolve the absolute path to a binary using the platform's lookup command. Uses `where` on Windows, `which` on Unix. Returns the binary name as-is if resolution fails (so downstream code can still try the bare name).",
        "parameters": {
          "bin": {
            "type": "string",
            "description": "The binary name to look up (e.g. 'git', 'docker', 'ssh')"
          }
        },
        "required": [
          "bin"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const gitPath = os.whichCommand('git')\n// '/usr/bin/git' on macOS, 'C:\\Program Files\\Git\\cmd\\git.exe' on Windows"
          }
        ]
      },
      "getDisplayInfo": {
        "description": "Gets information about all connected displays. Platform-specific: currently implemented for macOS (darwin). Linux and Windows will throw with a clear \"not yet implemented\" message.",
        "parameters": {},
        "required": [],
        "returns": "DisplayInfo[]",
        "examples": [
          {
            "language": "ts",
            "code": "const displays = os.getDisplayInfo()\ndisplays.forEach(d => {\n console.log(`${d.name}: ${d.resolution.width}x${d.resolution.height}${d.retina ? ' (Retina)' : ''}`)\n})"
          }
        ]
      }
    },
    "getters": {
      "arch": {
        "description": "Gets the operating system CPU architecture.",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const arch = os.arch\nconsole.log(`Running on ${arch} architecture`)"
          }
        ]
      },
      "tmpdir": {
        "description": "Gets the operating system's default directory for temporary files.",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const tempDir = os.tmpdir\nconsole.log(`Temp directory: ${tempDir}`)"
          }
        ]
      },
      "homedir": {
        "description": "Gets the current user's home directory path.",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const home = os.homedir\nconsole.log(`User home: ${home}`)"
          }
        ]
      },
      "cpuCount": {
        "description": "Gets the number of logical CPU cores available on the system.",
        "returns": "number",
        "examples": [
          {
            "language": "ts",
            "code": "const cores = os.cpuCount\nconsole.log(`System has ${cores} CPU cores`)"
          }
        ]
      },
      "hostname": {
        "description": "Gets the hostname of the operating system.",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const hostname = os.hostname\nconsole.log(`Hostname: ${hostname}`)"
          }
        ]
      },
      "platform": {
        "description": "Gets the operating system platform.",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const platform = os.platform\nif (platform === 'darwin') {\n console.log('Running on macOS')\n}"
          }
        ]
      },
      "networkInterfaces": {
        "description": "Gets information about the system's network interfaces.",
        "returns": "NodeJS.Dict<os.NetworkInterfaceInfo[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const interfaces = os.networkInterfaces\nObject.keys(interfaces).forEach(name => {\n console.log(`Interface ${name}:`, interfaces[name])\n})"
          }
        ]
      },
      "macAddresses": {
        "description": "Gets an array of MAC addresses for non-internal IPv4 network interfaces. This filters the network interfaces to only include external IPv4 interfaces and returns their MAC addresses, which can be useful for system identification.",
        "returns": "string[]",
        "examples": [
          {
            "language": "ts",
            "code": "const macAddresses = os.macAddresses\nconsole.log(`External MAC addresses: ${macAddresses.join(', ')}`)"
          }
        ]
      },
      "isWindows": {
        "description": "Whether the current platform is Windows.",
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (os.isWindows) {\n console.log('Running on Windows')\n}"
          }
        ]
      },
      "isMac": {
        "description": "Whether the current platform is macOS.",
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (os.isMac) {\n console.log('Running on macOS')\n}"
          }
        ]
      },
      "isLinux": {
        "description": "Whether the current platform is Linux.",
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (os.isLinux) {\n console.log('Running on Linux')\n}"
          }
        ]
      },
      "shell": {
        "description": "The platform's default shell for executing command strings. Returns `cmd.exe` on Windows, `sh` on Unix.",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "// spawn a shell command cross-platform\nawait proc.spawnAndCapture(os.shell, [os.shellFlag, 'echo hello'])"
          }
        ]
      },
      "shellFlag": {
        "description": "The flag used to pass a command string to the platform shell. Returns `/c` on Windows, `-c` on Unix.",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "await proc.spawnAndCapture(os.shell, [os.shellFlag, command])"
          }
        ]
      },
      "pathSeparator": {
        "description": "The separator used in the PATH environment variable. Returns `;` on Windows, `:` on Unix.",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const dirs = process.env.PATH?.split(os.pathSeparator) ?? []"
          }
        ]
      },
      "cacheDir": {
        "description": "Platform-appropriate cache directory for luca. - Windows: `%LOCALAPPDATA%\\luca` - macOS/Linux: `~/.cache/luca` (respects `XDG_CACHE_HOME`)",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const cachePath = os.cacheDir\n// '/home/user/.cache/luca' on Linux\n// 'C:\\Users\\user\\AppData\\Local\\luca' on Windows"
          }
        ]
      },
      "configDir": {
        "description": "Platform-appropriate config directory for luca. - Windows: `%APPDATA%\\luca` - macOS: `~/.luca` - Linux: `~/.config/luca` (respects `XDG_CONFIG_HOME`)",
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const configPath = os.configDir"
          }
        ]
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const osInfo = container.feature('os')\n\nconsole.log(`Platform: ${osInfo.platform}`)\nconsole.log(`Architecture: ${osInfo.arch}`)\nconsole.log(`CPU cores: ${osInfo.cpuCount}`)\nconsole.log(`Home directory: ${osInfo.homedir}`)"
      }
    ],
    "types": {
      "DisplayInfo": {
        "description": "Information about a connected display.",
        "properties": {
          "name": {
            "type": "string",
            "description": ""
          },
          "resolution": {
            "type": "{ width: number; height: number }",
            "description": ""
          },
          "retina": {
            "type": "boolean",
            "description": ""
          },
          "main": {
            "type": "boolean",
            "description": ""
          },
          "refreshRate": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "connectionType": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.tts",
    "description": "TTS feature — synthesizes text to audio files via RunPod's Chatterbox Turbo endpoint. Generates high-quality speech audio by calling the Chatterbox Turbo public endpoint on RunPod, downloads the resulting audio, and saves it locally. Supports 20 preset voices and voice cloning via a reference audio URL.",
    "shortcut": "features.tts",
    "className": "TTS",
    "methods": {
      "synthesize": {
        "description": "Synthesize text to an audio file using Chatterbox Turbo. Calls the RunPod public endpoint, downloads the generated audio, and saves it to the output directory.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to synthesize into speech"
          },
          "options": {
            "type": "{\n    voice?: string\n    format?: 'wav' | 'flac' | 'ogg'\n    voiceUrl?: string\n  }",
            "description": "Override voice, format, or provide a voiceUrl for cloning"
          }
        },
        "required": [
          "text"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "// Use a preset voice\nconst path = await tts.synthesize('Good morning!', { voice: 'ethan' })\n\n// Clone a voice from a reference audio URL\nconst path = await tts.synthesize('Hello world', {\n voiceUrl: 'https://example.com/reference.wav'\n})"
          }
        ]
      }
    },
    "getters": {
      "apiKey": {
        "description": "RunPod API key from options or environment.",
        "returns": "string"
      },
      "outputDir": {
        "description": "Directory where generated audio files are saved.",
        "returns": "string"
      },
      "voices": {
        "description": "The 20 preset voice names available in Chatterbox Turbo.",
        "returns": "readonly string[]"
      }
    },
    "events": {
      "synthesized": {
        "name": "synthesized",
        "description": "Event emitted by TTS",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by TTS",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const tts = container.feature('tts', { enable: true })\nconst path = await tts.synthesize('Hello, how are you?', { voice: 'lucy' })\nconsole.log(`Audio saved to: ${path}`)"
      }
    ]
  },
  {
    "id": "features.grep",
    "description": "The Grep feature provides utilities for searching file contents using ripgrep (rg) or grep. Returns structured results as arrays of `{ file, line, column, content }` objects with paths relative to the container cwd. Also provides convenience methods for common search patterns.",
    "shortcut": "features.grep",
    "className": "Grep",
    "methods": {
      "search": {
        "description": "Search for a pattern in files and return structured results.",
        "parameters": {
          "options": {
            "type": "GrepOptions",
            "description": "Search options",
            "properties": {
              "pattern": {
                "type": "string",
                "description": "Pattern to search for (string or regex)"
              },
              "path": {
                "type": "string",
                "description": "Directory or file to search in (defaults to container cwd)"
              },
              "include": {
                "type": "string | string[]",
                "description": "Glob patterns to include (e.g. '*.ts')"
              },
              "exclude": {
                "type": "string | string[]",
                "description": "Glob patterns to exclude (e.g. 'node_modules')"
              },
              "ignoreCase": {
                "type": "boolean",
                "description": "Case insensitive search"
              },
              "fixedStrings": {
                "type": "boolean",
                "description": "Treat pattern as a fixed string, not regex"
              },
              "recursive": {
                "type": "boolean",
                "description": "Search recursively (default: true)"
              },
              "hidden": {
                "type": "boolean",
                "description": "Include hidden files"
              },
              "maxResults": {
                "type": "number",
                "description": "Max number of results to return"
              },
              "before": {
                "type": "number",
                "description": "Number of context lines before match"
              },
              "after": {
                "type": "number",
                "description": "Number of context lines after match"
              },
              "filesOnly": {
                "type": "boolean",
                "description": "Only return filenames, not match details"
              },
              "invert": {
                "type": "boolean",
                "description": "Invert match (return lines that don't match)"
              },
              "wordMatch": {
                "type": "boolean",
                "description": "Match whole words only"
              },
              "rawFlags": {
                "type": "string[]",
                "description": "Additional raw flags to pass to grep/ripgrep"
              }
            }
          }
        },
        "required": [
          "options"
        ],
        "returns": "Promise<GrepMatch[]>",
        "examples": [
          {
            "language": "ts",
            "code": "// Search for a pattern in TypeScript files\nconst results = await grep.search({\n pattern: 'useState',\n include: '*.tsx',\n exclude: 'node_modules'\n})\n\n// Case insensitive search with context\nconst results = await grep.search({\n pattern: 'error',\n ignoreCase: true,\n before: 2,\n after: 2\n})"
          }
        ]
      },
      "filesContaining": {
        "description": "Find files containing a pattern. Returns just the relative file paths.",
        "parameters": {
          "pattern": {
            "type": "string",
            "description": "The pattern to search for"
          },
          "options": {
            "type": "Omit<GrepOptions, 'pattern' | 'filesOnly'>",
            "description": "Additional search options"
          }
        },
        "required": [
          "pattern"
        ],
        "returns": "Promise<string[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const files = await grep.filesContaining('TODO')\n// ['src/index.ts', 'src/utils.ts']"
          }
        ]
      },
      "imports": {
        "description": "Find import/require statements for a module or path.",
        "parameters": {
          "moduleOrPath": {
            "type": "string",
            "description": "The module name or path to search for in imports"
          },
          "options": {
            "type": "Omit<GrepOptions, 'pattern'>",
            "description": "Additional search options"
          }
        },
        "required": [
          "moduleOrPath"
        ],
        "returns": "Promise<GrepMatch[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const lodashImports = await grep.imports('lodash')\nconst localImports = await grep.imports('./utils')"
          }
        ]
      },
      "definitions": {
        "description": "Find function, class, type, or variable definitions matching a name.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The identifier name to search for definitions of"
          },
          "options": {
            "type": "Omit<GrepOptions, 'pattern'>",
            "description": "Additional search options"
          }
        },
        "required": [
          "name"
        ],
        "returns": "Promise<GrepMatch[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const defs = await grep.definitions('MyComponent')\nconst classDefs = await grep.definitions('UserService')"
          }
        ]
      },
      "todos": {
        "description": "Find TODO, FIXME, HACK, and XXX comments.",
        "parameters": {
          "options": {
            "type": "Omit<GrepOptions, 'pattern'>",
            "description": "Additional search options"
          }
        },
        "required": [],
        "returns": "Promise<GrepMatch[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const todos = await grep.todos()\nconst fixmes = await grep.todos({ include: '*.ts' })"
          }
        ]
      },
      "count": {
        "description": "Count the number of matches for a pattern.",
        "parameters": {
          "pattern": {
            "type": "string",
            "description": "The pattern to count"
          },
          "options": {
            "type": "Omit<GrepOptions, 'pattern'>",
            "description": "Additional search options"
          }
        },
        "required": [
          "pattern"
        ],
        "returns": "Promise<number>",
        "examples": [
          {
            "language": "ts",
            "code": "const count = await grep.count('console.log')\nconsole.log(`Found ${count} console.log statements`)"
          }
        ]
      },
      "findForReplace": {
        "description": "Search and replace across files. Returns the list of files that would be affected. Does NOT modify files — use the returned file list to do the replacement yourself.",
        "parameters": {
          "pattern": {
            "type": "string",
            "description": "The pattern to search for"
          },
          "options": {
            "type": "Omit<GrepOptions, 'pattern'>",
            "description": "Additional search options"
          }
        },
        "required": [
          "pattern"
        ],
        "returns": "Promise<{ file: string, matches: GrepMatch[] }[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const affected = await grep.findForReplace('oldFunctionName')\n// [{ file: 'src/a.ts', matches: [...] }, { file: 'src/b.ts', matches: [...] }]"
          }
        ]
      }
    },
    "getters": {
      "hasRipgrep": {
        "description": "Whether ripgrep (rg) is available on this system",
        "returns": "boolean"
      },
      "rgPath": {
        "description": "Resolved path to the rg binary",
        "returns": "string"
      },
      "grepPath": {
        "description": "Resolved path to the grep binary",
        "returns": "string"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const grep = container.feature('grep')\n\n// Basic search\nconst results = await grep.search({ pattern: 'TODO' })\n// [{ file: 'src/index.ts', line: 42, column: 5, content: '// TODO: fix this' }, ...]\n\n// Find all imports of a module\nconst imports = await grep.imports('lodash')\n\n// Find function/class/variable definitions\nconst defs = await grep.definitions('MyClass')\n\n// Just get filenames containing a pattern\nconst files = await grep.filesContaining('API_KEY')"
      }
    ],
    "types": {
      "GrepOptions": {
        "description": "",
        "properties": {
          "pattern": {
            "type": "string",
            "description": "Pattern to search for (string or regex)"
          },
          "path": {
            "type": "string",
            "description": "Directory or file to search in (defaults to container cwd)",
            "optional": true
          },
          "include": {
            "type": "string | string[]",
            "description": "Glob patterns to include (e.g. '*.ts')",
            "optional": true
          },
          "exclude": {
            "type": "string | string[]",
            "description": "Glob patterns to exclude (e.g. 'node_modules')",
            "optional": true
          },
          "ignoreCase": {
            "type": "boolean",
            "description": "Case insensitive search",
            "optional": true
          },
          "fixedStrings": {
            "type": "boolean",
            "description": "Treat pattern as a fixed string, not regex",
            "optional": true
          },
          "recursive": {
            "type": "boolean",
            "description": "Search recursively (default: true)",
            "optional": true
          },
          "hidden": {
            "type": "boolean",
            "description": "Include hidden files",
            "optional": true
          },
          "maxResults": {
            "type": "number",
            "description": "Max number of results to return",
            "optional": true
          },
          "before": {
            "type": "number",
            "description": "Number of context lines before match",
            "optional": true
          },
          "after": {
            "type": "number",
            "description": "Number of context lines after match",
            "optional": true
          },
          "filesOnly": {
            "type": "boolean",
            "description": "Only return filenames, not match details",
            "optional": true
          },
          "invert": {
            "type": "boolean",
            "description": "Invert match (return lines that don't match)",
            "optional": true
          },
          "wordMatch": {
            "type": "boolean",
            "description": "Match whole words only",
            "optional": true
          },
          "rawFlags": {
            "type": "string[]",
            "description": "Additional raw flags to pass to grep/ripgrep",
            "optional": true
          }
        }
      },
      "GrepMatch": {
        "description": "",
        "properties": {
          "file": {
            "type": "string",
            "description": ""
          },
          "line": {
            "type": "number",
            "description": ""
          },
          "column": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "content": {
            "type": "string",
            "description": ""
          }
        }
      }
    }
  },
  {
    "id": "features.googleAuth",
    "description": "Google authentication feature supporting OAuth2 browser flow and service account auth. Handles the complete OAuth2 lifecycle: authorization URL generation, local callback server, token exchange, refresh token storage (via diskCache), and automatic token refresh. Also supports non-interactive service account authentication via JSON key files. Other Google features (drive, sheets, calendar, docs) depend on this feature and access it lazily via `container.feature('googleAuth')`.",
    "shortcut": "features.googleAuth",
    "className": "GoogleAuth",
    "methods": {
      "getOAuth2Client": {
        "description": "Get the OAuth2Client instance, creating it lazily. After authentication, this client has valid credentials set.",
        "parameters": {},
        "required": [],
        "returns": "OAuth2Client"
      },
      "getAuthClient": {
        "description": "Get the authenticated auth client for passing to googleapis service constructors. Handles token refresh automatically for OAuth2. For service accounts, returns the JWT auth client.",
        "parameters": {},
        "required": [],
        "returns": "Promise<OAuth2Client | ReturnType<typeof google.auth.fromJSON>>"
      },
      "authorize": {
        "description": "Start the OAuth2 authorization flow. 1. Spins up a temporary Express callback server on a free port 2. Generates the Google authorization URL 3. Opens the browser to the consent page 4. Waits for the callback with the authorization code 5. Exchanges the code for access + refresh tokens 6. Stores the refresh token in diskCache 7. Shuts down the callback server",
        "parameters": {
          "scopes": {
            "type": "string[]",
            "description": "OAuth2 scopes to request (defaults to options.scopes or defaultScopes)"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "authenticateServiceAccount": {
        "description": "Authenticate using a service account JSON key file. Reads the key from options.serviceAccountKeyPath, options.serviceAccountKey, or the GOOGLE_SERVICE_ACCOUNT_KEY env var.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "tryRestoreTokens": {
        "description": "Attempt to restore authentication from a cached refresh token. Called automatically by getAuthClient() if not yet authenticated.",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>"
      },
      "revoke": {
        "description": "Revoke the current credentials and clear cached tokens.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      }
    },
    "getters": {
      "clientId": {
        "description": "OAuth2 client ID from options or GOOGLE_CLIENT_ID env var.",
        "returns": "string"
      },
      "clientSecret": {
        "description": "OAuth2 client secret from options or GOOGLE_CLIENT_SECRET env var.",
        "returns": "string"
      },
      "authMode": {
        "description": "Resolved authentication mode based on options.",
        "returns": "'oauth2' | 'service-account'"
      },
      "isAuthenticated": {
        "description": "Whether valid credentials are currently available.",
        "returns": "boolean"
      },
      "defaultScopes": {
        "description": "Default scopes covering Drive, Sheets, Calendar, and Docs read access.",
        "returns": "string[]"
      },
      "redirectPort": {
        "description": "Resolved redirect port from options, GOOGLE_OAUTH_REDIRECT_PORT env var, or default 3000.",
        "returns": "number"
      },
      "tokenCacheKey": {
        "description": "DiskCache key used for storing the refresh token.",
        "returns": "string"
      }
    },
    "events": {
      "tokenRefreshed": {
        "name": "tokenRefreshed",
        "description": "Event emitted by GoogleAuth",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by GoogleAuth",
        "arguments": {}
      },
      "authorizationRequired": {
        "name": "authorizationRequired",
        "description": "Event emitted by GoogleAuth",
        "arguments": {}
      },
      "authenticated": {
        "name": "authenticated",
        "description": "Event emitted by GoogleAuth",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "// OAuth2 flow — opens browser for consent\nconst auth = container.feature('googleAuth', {\n clientId: 'your-client-id.apps.googleusercontent.com',\n clientSecret: 'your-secret',\n scopes: ['https://www.googleapis.com/auth/drive.readonly'],\n})\nawait auth.authorize()\n\n// Service account flow — no browser needed\nconst auth = container.feature('googleAuth', {\n serviceAccountKeyPath: '/path/to/key.json',\n scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],\n})\nawait auth.authenticateServiceAccount()"
      }
    ]
  },
  {
    "id": "features.sqlite",
    "description": "SQLite feature for safe SQL execution through Bun's native sqlite binding. Supports: - parameterized query execution (`query` / `execute`) - tagged-template query execution (`sql`) to avoid manual placeholder wiring",
    "shortcut": "features.sqlite",
    "className": "Sqlite",
    "methods": {
      "query": {
        "description": "Executes a SELECT-like query and returns result rows. Use sqlite placeholders (`?`) for `params`.",
        "parameters": {
          "queryText": {
            "type": "string",
            "description": "The SQL query string with optional `?` placeholders"
          },
          "params": {
            "type": "SqlValue[]",
            "description": "Ordered array of values to bind to the placeholders"
          }
        },
        "required": [
          "queryText"
        ],
        "returns": "Promise<T[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const db = container.feature('sqlite', { path: 'app.db' })\nconst users = await db.query<{ id: number; email: string }>(\n 'SELECT id, email FROM users WHERE active = ?',\n [1]\n)"
          }
        ]
      },
      "execute": {
        "description": "Executes a write/update/delete statement and returns metadata. Use sqlite placeholders (`?`) for `params`.",
        "parameters": {
          "queryText": {
            "type": "string",
            "description": "The SQL statement string with optional `?` placeholders"
          },
          "params": {
            "type": "SqlValue[]",
            "description": "Ordered array of values to bind to the placeholders"
          }
        },
        "required": [
          "queryText"
        ],
        "returns": "Promise<{ changes: number; lastInsertRowid: number | bigint | null }>",
        "examples": [
          {
            "language": "ts",
            "code": "const db = container.feature('sqlite', { path: 'app.db' })\nconst { changes, lastInsertRowid } = await db.execute(\n 'INSERT INTO users (email) VALUES (?)',\n ['hello@example.com']\n)\nconsole.log(`Inserted row ${lastInsertRowid}, ${changes} change(s)`)"
          }
        ]
      },
      "sql": {
        "description": "Safe tagged-template SQL helper. Values become bound parameters automatically, preventing SQL injection.",
        "parameters": {
          "strings": {
            "type": "TemplateStringsArray",
            "description": "Template literal string segments"
          },
          "values": {
            "type": "SqlValue[]",
            "description": "Interpolated values that become bound `?` parameters"
          }
        },
        "required": [
          "strings",
          "values"
        ],
        "returns": "Promise<T[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const db = container.feature('sqlite', { path: 'app.db' })\nconst email = 'hello@example.com'\nconst rows = await db.sql<{ id: number }>`\n SELECT id FROM users WHERE email = ${email}\n`"
          }
        ]
      },
      "close": {
        "description": "Closes the sqlite database and updates feature state. Emits `closed` after the database handle is released.",
        "parameters": {},
        "required": [],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const db = container.feature('sqlite', { path: 'app.db' })\n// ... run queries ...\ndb.close()"
          }
        ]
      }
    },
    "getters": {
      "db": {
        "description": "Returns the underlying Bun sqlite database instance.",
        "returns": "any"
      }
    },
    "events": {
      "query": {
        "name": "query",
        "description": "Event emitted by Sqlite",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by Sqlite",
        "arguments": {}
      },
      "execute": {
        "name": "execute",
        "description": "Event emitted by Sqlite",
        "arguments": {}
      },
      "closed": {
        "name": "closed",
        "description": "Event emitted by Sqlite",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const sqlite = container.feature('sqlite', { path: 'data/app.db' })\n\nawait sqlite.execute(\n 'create table if not exists users (id integer primary key, email text not null unique)'\n)\n\nawait sqlite.execute('insert into users (email) values (?)', ['hello@example.com'])\n\nconst users = await sqlite.sql<{ id: number; email: string }>`\n select id, email from users where email = ${'hello@example.com'}\n`"
      }
    ]
  },
  {
    "id": "features.docker",
    "description": "Docker CLI interface feature for managing containers, images, and executing Docker commands. Provides comprehensive Docker operations including: - Container management (list, start, stop, create, remove) - Image management (list, pull, build, remove) - Command execution inside containers - Docker system information",
    "shortcut": "features.docker",
    "className": "Docker",
    "methods": {
      "checkDockerAvailability": {
        "description": "Check if Docker is available and working.",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "const available = await docker.checkDockerAvailability()\nif (!available) console.log('Docker is not installed or not running')"
          }
        ]
      },
      "listContainers": {
        "description": "List all containers (running and stopped).",
        "parameters": {
          "options": {
            "type": "{ all?: boolean }",
            "description": "Listing options",
            "properties": {
              "all": {
                "type": "any",
                "description": "Include stopped containers (default: false)"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<DockerContainer[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const running = await docker.listContainers()\nconst all = await docker.listContainers({ all: true })"
          }
        ]
      },
      "listImages": {
        "description": "List all images available locally.",
        "parameters": {},
        "required": [],
        "returns": "Promise<DockerImage[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const images = await docker.listImages()\nconsole.log(images.map(i => `${i.repository}:${i.tag}`))"
          }
        ]
      },
      "startContainer": {
        "description": "Start a stopped container.",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Container ID or name to start"
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await docker.startContainer('my-app')"
          }
        ]
      },
      "stopContainer": {
        "description": "Stop a running container.",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Container ID or name to stop"
          },
          "timeout": {
            "type": "number",
            "description": "Seconds to wait before killing the container"
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await docker.stopContainer('my-app')\nawait docker.stopContainer('my-app', 30) // wait up to 30s"
          }
        ]
      },
      "removeContainer": {
        "description": "Remove a container.",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Container ID or name to remove"
          },
          "options": {
            "type": "{ force?: boolean }",
            "description": "Removal options",
            "properties": {
              "force": {
                "type": "any",
                "description": "Force removal of a running container"
              }
            }
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await docker.removeContainer('old-container')\nawait docker.removeContainer('stubborn-container', { force: true })"
          }
        ]
      },
      "runContainer": {
        "description": "Create and run a new container from the given image.",
        "parameters": {
          "image": {
            "type": "string",
            "description": "Docker image to run (e.g. 'nginx:latest')"
          },
          "options": {
            "type": "{\n      /** Assign a name to the container */\n      name?: string\n      /** Port mappings in 'host:container' format */\n      ports?: string[]\n      /** Volume mounts in 'host:container' format */\n      volumes?: string[]\n      /** Environment variables as key-value pairs */\n      environment?: Record<string, string>\n      /** Run the container in the background */\n      detach?: boolean\n      /** Keep STDIN open */\n      interactive?: boolean\n      /** Allocate a pseudo-TTY */\n      tty?: boolean\n      /** Command and arguments to run inside the container */\n      command?: string[]\n      /** Working directory inside the container */\n      workdir?: string\n      /** Username or UID to run as */\n      user?: string\n      /** Override the default entrypoint */\n      entrypoint?: string\n      /** Connect the container to a network */\n      network?: string\n      /** Restart policy (e.g. 'always', 'on-failure') */\n      restart?: string\n    }",
            "description": "Container run options",
            "properties": {
              "name": {
                "type": "any",
                "description": "Assign a name to the container"
              },
              "ports": {
                "type": "any",
                "description": "Port mappings in 'host:container' format (e.g. ['8080:80'])"
              },
              "volumes": {
                "type": "any",
                "description": "Volume mounts in 'host:container' format (e.g. ['./data:/app/data'])"
              },
              "environment": {
                "type": "any",
                "description": "Environment variables as key-value pairs"
              },
              "detach": {
                "type": "any",
                "description": "Run the container in the background"
              },
              "interactive": {
                "type": "any",
                "description": "Keep STDIN open"
              },
              "tty": {
                "type": "any",
                "description": "Allocate a pseudo-TTY"
              },
              "command": {
                "type": "any",
                "description": "Command and arguments to run inside the container"
              },
              "workdir": {
                "type": "any",
                "description": "Working directory inside the container"
              },
              "user": {
                "type": "any",
                "description": "Username or UID to run as"
              },
              "entrypoint": {
                "type": "any",
                "description": "Override the default entrypoint"
              },
              "network": {
                "type": "any",
                "description": "Connect the container to a network"
              },
              "restart": {
                "type": "any",
                "description": "Restart policy (e.g. 'always', 'on-failure')"
              }
            }
          }
        },
        "required": [
          "image"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const containerId = await docker.runContainer('nginx:latest', {\n name: 'web',\n ports: ['8080:80'],\n detach: true,\n environment: { NODE_ENV: 'production' }\n})"
          }
        ]
      },
      "execCommand": {
        "description": "Execute a command inside a running container. When volumes are specified, uses `docker run --rm` with the container's image instead of `docker exec`, since exec does not support volume mounts.",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Container ID or name to execute in"
          },
          "command": {
            "type": "string[]",
            "description": "Command and arguments array (e.g. ['ls', '-la'])"
          },
          "options": {
            "type": "{\n      /** Keep STDIN open */\n      interactive?: boolean\n      /** Allocate a pseudo-TTY */\n      tty?: boolean\n      /** Username or UID to run as */\n      user?: string\n      /** Working directory inside the container */\n      workdir?: string\n      /** Run the command in the background */\n      detach?: boolean\n      /** Environment variables as key-value pairs */\n      environment?: Record<string, string>\n      /** Volume mounts; triggers a docker run --rm fallback */\n      volumes?: string[]\n    }",
            "description": "Execution options",
            "properties": {
              "interactive": {
                "type": "any",
                "description": "Keep STDIN open"
              },
              "tty": {
                "type": "any",
                "description": "Allocate a pseudo-TTY"
              },
              "user": {
                "type": "any",
                "description": "Username or UID to run as"
              },
              "workdir": {
                "type": "any",
                "description": "Working directory inside the container"
              },
              "detach": {
                "type": "any",
                "description": "Run the command in the background"
              },
              "environment": {
                "type": "any",
                "description": "Environment variables as key-value pairs"
              },
              "volumes": {
                "type": "any",
                "description": "Volume mounts; triggers a docker run --rm fallback"
              }
            }
          }
        },
        "required": [
          "containerIdOrName",
          "command"
        ],
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>",
        "examples": [
          {
            "language": "ts",
            "code": "const result = await docker.execCommand('my-app', ['ls', '-la', '/app'])\nconsole.log(result.stdout)"
          }
        ]
      },
      "createShell": {
        "description": "Create a shell-like wrapper for executing multiple commands against a container. When volume mounts are specified, a new long-running container is created from the same image with the mounts applied (since docker exec does not support volumes). Call `destroy()` when finished to clean up the helper container. Returns an object with: - `run(command)` — execute a shell command string via `sh -c` - `last` — getter for the most recent command result - `destroy()` — stop the helper container (no-op when no volumes were needed)",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Parameter containerIdOrName"
          },
          "options": {
            "type": "{\n      volumes?: string[]\n      workdir?: string\n      user?: string\n      environment?: Record<string, string>\n    }",
            "description": "Parameter options"
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<DockerShell>"
      },
      "pullImage": {
        "description": "Pull an image from a registry.",
        "parameters": {
          "image": {
            "type": "string",
            "description": "Full image reference (e.g. 'nginx:latest', 'ghcr.io/org/repo:tag')"
          }
        },
        "required": [
          "image"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await docker.pullImage('node:20-alpine')"
          }
        ]
      },
      "removeImage": {
        "description": "Remove an image from the local store.",
        "parameters": {
          "imageIdOrName": {
            "type": "string",
            "description": "Image ID, repository, or repository:tag to remove"
          },
          "options": {
            "type": "{ force?: boolean }",
            "description": "Removal options",
            "properties": {
              "force": {
                "type": "any",
                "description": "Force removal even if the image is in use"
              }
            }
          }
        },
        "required": [
          "imageIdOrName"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await docker.removeImage('nginx:latest')\nawait docker.removeImage('old-image', { force: true })"
          }
        ]
      },
      "buildImage": {
        "description": "Build an image from a Dockerfile.",
        "parameters": {
          "contextPath": {
            "type": "string",
            "description": "Path to the build context directory"
          },
          "options": {
            "type": "{\n      /** Tag the resulting image (e.g. 'my-app:latest') */\n      tag?: string\n      /** Path to an alternate Dockerfile */\n      dockerfile?: string\n      /** Build-time variables as key-value pairs */\n      buildArgs?: Record<string, string>\n      /** Target build stage in a multi-stage Dockerfile */\n      target?: string\n      /** Do not use cache when building the image */\n      nocache?: boolean\n    }",
            "description": "Build options",
            "properties": {
              "tag": {
                "type": "any",
                "description": "Tag the resulting image (e.g. 'my-app:latest')"
              },
              "dockerfile": {
                "type": "any",
                "description": "Path to an alternate Dockerfile"
              },
              "buildArgs": {
                "type": "any",
                "description": "Build-time variables as key-value pairs"
              },
              "target": {
                "type": "any",
                "description": "Target build stage in a multi-stage Dockerfile"
              },
              "nocache": {
                "type": "any",
                "description": "Do not use cache when building the image"
              }
            }
          }
        },
        "required": [
          "contextPath"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await docker.buildImage('./project', {\n tag: 'my-app:latest',\n buildArgs: { NODE_ENV: 'production' }\n})"
          }
        ]
      },
      "getLogs": {
        "description": "Get container logs.",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Container ID or name to fetch logs from"
          },
          "options": {
            "type": "{\n      /** Follow log output (stream) */\n      follow?: boolean\n      /** Number of lines to show from the end of the logs */\n      tail?: number\n      /** Show logs since a timestamp or relative time */\n      since?: string\n      /** Prepend a timestamp to each log line */\n      timestamps?: boolean\n    }",
            "description": "Log retrieval options",
            "properties": {
              "follow": {
                "type": "any",
                "description": "Follow log output (stream)"
              },
              "tail": {
                "type": "any",
                "description": "Number of lines to show from the end of the logs"
              },
              "since": {
                "type": "any",
                "description": "Show logs since a timestamp or relative time (e.g. '10m', '2024-01-01T00:00:00')"
              },
              "timestamps": {
                "type": "any",
                "description": "Prepend a timestamp to each log line"
              }
            }
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const logs = await docker.getLogs('my-app', { tail: 100, timestamps: true })\nconsole.log(logs)"
          }
        ]
      },
      "getSystemInfo": {
        "description": "Get Docker system information (engine version, storage driver, OS, etc.).",
        "parameters": {},
        "required": [],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "const info = await docker.getSystemInfo()\nconsole.log(info.ServerVersion)"
          }
        ]
      },
      "prune": {
        "description": "Prune unused Docker resources. When no specific resource type is selected, falls back to `docker system prune`.",
        "parameters": {
          "options": {
            "type": "{\n    /** Prune stopped containers */\n    containers?: boolean\n    /** Prune dangling images */\n    images?: boolean\n    /** Prune unused volumes */\n    volumes?: boolean\n    /** Prune unused networks */\n    networks?: boolean\n    /** Prune all resource types */\n    all?: boolean\n    /** Skip confirmation prompts for image pruning */\n    force?: boolean\n  }",
            "description": "Pruning options",
            "properties": {
              "containers": {
                "type": "any",
                "description": "Prune stopped containers"
              },
              "images": {
                "type": "any",
                "description": "Prune dangling images"
              },
              "volumes": {
                "type": "any",
                "description": "Prune unused volumes"
              },
              "networks": {
                "type": "any",
                "description": "Prune unused networks"
              },
              "all": {
                "type": "any",
                "description": "Prune all resource types (containers, images, volumes, networks)"
              },
              "force": {
                "type": "any",
                "description": "Skip confirmation prompts for image pruning"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await docker.prune({ all: true })\nawait docker.prune({ containers: true, images: true })"
          }
        ]
      },
      "enable": {
        "description": "Initialize the Docker feature by checking availability and optionally refreshing state.",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Enable options passed to the base Feature"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      }
    },
    "getters": {
      "proc": {
        "description": "",
        "returns": "any"
      },
      "dockerPath": {
        "description": "Resolve the docker binary path, caching the result. Options take precedence.",
        "returns": "string"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const docker = container.feature('docker', { enable: true })\nawait docker.checkDockerAvailability()\nconst containers = await docker.listContainers({ all: true })"
      }
    ],
    "types": {
      "DockerShell": {
        "description": "Shell-like interface for executing commands against a Docker container",
        "properties": {
          "containerId": {
            "type": "string",
            "description": "The ID of the container being targeted"
          },
          "last": {
            "type": "{ stdout: string; stderr: string; exitCode: number } | null",
            "description": "The result of the most recently executed command, or null if no command has been run"
          }
        }
      }
    }
  },
  {
    "id": "features.transpiler",
    "description": "Transpile TypeScript, TSX, and JSX to JavaScript at runtime using Bun's built-in transpiler. Compile code strings on the fly without touching the filesystem or spawning external processes.",
    "shortcut": "features.transpiler",
    "className": "Transpiler",
    "methods": {
      "transformSync": {
        "description": "Transform code synchronously",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The code to transform"
          },
          "options": {
            "type": "TransformOptions",
            "description": "Transform options (loader, format, minify)",
            "properties": {
              "loader": {
                "type": "'ts' | 'tsx' | 'jsx' | 'js'",
                "description": ""
              },
              "format": {
                "type": "'esm' | 'cjs'",
                "description": ""
              },
              "minify": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "code"
        ],
        "returns": "TransformResult"
      },
      "transform": {
        "description": "Transform code asynchronously",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The code to transform"
          },
          "options": {
            "type": "TransformOptions",
            "description": "Transform options (loader, format, minify)",
            "properties": {
              "loader": {
                "type": "'ts' | 'tsx' | 'jsx' | 'js'",
                "description": ""
              },
              "format": {
                "type": "'esm' | 'cjs'",
                "description": ""
              },
              "minify": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "code"
        ],
        "returns": "Promise<TransformResult>"
      },
      "bundle": {
        "description": "Bundle a file using Bun.build, inlining all imports except those marked external. Returns CJS code ready for VM execution.",
        "parameters": {
          "filePath": {
            "type": "string",
            "description": "Absolute path to the entrypoint file"
          },
          "external": {
            "type": "string[]",
            "description": "Module IDs to leave as require() calls (e.g. virtual modules)"
          }
        },
        "required": [
          "filePath"
        ],
        "returns": "Promise<string>"
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
        "code": "const transpiler = container.feature('transpiler')\nconst result = transpiler.transformSync('const x: number = 1')\nconsole.log(result.code) // 'const x = 1;\\n'"
      }
    ],
    "types": {
      "TransformOptions": {
        "description": "",
        "properties": {
          "loader": {
            "type": "'ts' | 'tsx' | 'jsx' | 'js'",
            "description": "",
            "optional": true
          },
          "format": {
            "type": "'esm' | 'cjs'",
            "description": "",
            "optional": true
          },
          "minify": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      },
      "TransformResult": {
        "description": "",
        "properties": {
          "code": {
            "type": "string",
            "description": ""
          },
          "map": {
            "type": "string",
            "description": ""
          },
          "warnings": {
            "type": "any[]",
            "description": ""
          }
        }
      }
    }
  },
  {
    "id": "features.yaml",
    "description": "The YAML feature provides utilities for parsing and stringifying YAML data. This feature wraps the js-yaml library to provide convenient methods for converting between YAML strings and JavaScript objects. It's automatically attached to Node containers for easy access.",
    "shortcut": "features.yaml",
    "className": "YAML",
    "methods": {
      "stringify": {
        "description": "Converts a JavaScript object to a YAML string. This method serializes JavaScript data structures into YAML format, which is human-readable and commonly used for configuration files.",
        "parameters": {
          "data": {
            "type": "any",
            "description": "The data to convert to YAML format"
          }
        },
        "required": [
          "data"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const config = {\n name: 'MyApp',\n version: '1.0.0',\n settings: {\n   debug: true,\n   ports: [3000, 3001]\n }\n}\n\nconst yamlString = yaml.stringify(config)\nconsole.log(yamlString)\n// Output:\n// name: MyApp\n// version: 1.0.0\n// settings:\n//   debug: true\n//   ports:\n//     - 3000\n//     - 3001"
          }
        ]
      },
      "parse": {
        "description": "Parses a YAML string into a JavaScript object. This method deserializes YAML content into JavaScript data structures. It supports all standard YAML features including nested objects, arrays, and various data types.",
        "parameters": {
          "yamlStr": {
            "type": "string",
            "description": "The YAML string to parse"
          }
        },
        "required": [
          "yamlStr"
        ],
        "returns": "T",
        "examples": [
          {
            "language": "ts",
            "code": "const yamlContent = `\n name: MyApp\n version: 1.0.0\n settings:\n   debug: true\n   ports:\n     - 3000\n     - 3001\n`\n\n// Parse with type inference\nconst config = yaml.parse(yamlContent)\nconsole.log(config.name) // 'MyApp'\n\n// Parse with explicit typing\ninterface AppConfig {\n name: string\n version: string\n settings: {\n   debug: boolean\n   ports: number[]\n }\n}\n\nconst typedConfig = yaml.parse<AppConfig>(yamlContent)\nconsole.log(typedConfig.settings.ports) // [3000, 3001]"
          }
        ]
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
        "code": "const yamlFeature = container.feature('yaml')\n\n// Parse YAML string to object\nconst config = yamlFeature.parse(`\n name: MyApp\n version: 1.0.0\n settings:\n   debug: true\n`)\n\n// Convert object to YAML string\nconst yamlString = yamlFeature.stringify(config)\nconsole.log(yamlString)"
      }
    ]
  },
  {
    "id": "features.nlp",
    "description": "The NLP feature provides natural language processing utilities for parsing utterances into structured data. Combines two complementary libraries: - **compromise**: Verb normalization (toInfinitive), POS pattern matching - **wink-nlp**: High-accuracy POS tagging (~95%), named entity recognition Three methods at increasing levels of detail: - `parse()` — compromise-powered quick structure + verb normalization - `analyze()` — wink-powered high-accuracy POS + entity extraction - `understand()` — combined parse + analyze merged",
    "shortcut": "features.nlp",
    "className": "NLP",
    "methods": {
      "parse": {
        "description": "Parse an utterance into structured command data using compromise. Extracts intent (normalized verb), target noun, prepositional subject, and modifiers.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The raw utterance to parse"
          }
        },
        "required": [
          "text"
        ],
        "returns": "ParsedCommand",
        "examples": [
          {
            "language": "ts",
            "code": "nlp.parse(\"open the terminal\")\n// { intent: \"open\", target: \"terminal\", subject: null, modifiers: [], raw: \"open the terminal\" }\n\nnlp.parse(\"draw a diagram of the auth flow\")\n// { intent: \"draw\", target: \"diagram\", subject: \"auth flow\", modifiers: [], raw: \"...\" }"
          }
        ]
      },
      "analyze": {
        "description": "Analyze text with high-accuracy POS tagging and named entity recognition using wink-nlp.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to analyze"
          }
        },
        "required": [
          "text"
        ],
        "returns": "Analysis",
        "examples": [
          {
            "language": "ts",
            "code": "nlp.analyze(\"meet john at 3pm about the deployment\")\n// { tokens: [{value:\"meet\",pos:\"VERB\"}, {value:\"john\",pos:\"PROPN\"}, ...],\n//   entities: [{value:\"john\",type:\"PERSON\"}, {value:\"3pm\",type:\"TIME\"}],\n//   raw: \"meet john at 3pm about the deployment\" }"
          }
        ]
      },
      "understand": {
        "description": "Full understanding: combines compromise parsing with wink-nlp analysis. Returns intent, target, subject, modifiers (from parse) plus tokens and entities (from analyze).",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to understand"
          }
        },
        "required": [
          "text"
        ],
        "returns": "ParsedCommand & Analysis",
        "examples": [
          {
            "language": "ts",
            "code": "nlp.understand(\"draw a diagram of the auth flow\")\n// { intent: \"draw\", target: \"diagram\", subject: \"auth flow\", modifiers: [],\n//   tokens: [{value:\"draw\",pos:\"VERB\"}, ...], entities: [...], raw: \"...\" }"
          }
        ]
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
        "code": "const nlp = container.feature('nlp', { enable: true })\n\nnlp.parse(\"draw a diagram of the auth flow\")\n// { intent: \"draw\", target: \"diagram\", subject: \"auth flow\", modifiers: [], raw: \"...\" }\n\nnlp.analyze(\"meet john at 3pm about the deployment\")\n// { tokens: [{value:\"meet\",pos:\"VERB\"}, ...], entities: [{value:\"john\",type:\"PERSON\"}, ...] }\n\nnlp.understand(\"draw a diagram of the auth flow\")\n// { intent, target, subject, modifiers, tokens, entities, raw }"
      }
    ]
  },
  {
    "id": "features.networking",
    "description": "The Networking feature provides utilities for network-related operations. This feature includes utilities for port detection and availability checking, which are commonly needed when setting up servers or network services.",
    "shortcut": "features.networking",
    "className": "Networking",
    "methods": {
      "findOpenPort": {
        "description": "Finds the next available port starting from the specified port number. This method will search for the first available port starting from the given port number. If the specified port is available, it returns that port. Otherwise, it returns the next available port.",
        "parameters": {
          "startAt": {
            "type": "any",
            "description": "The port number to start searching from (0 means system will choose)"
          }
        },
        "required": [],
        "returns": "Promise<number>",
        "examples": [
          {
            "language": "ts",
            "code": "// Find any available port\nconst anyPort = await networking.findOpenPort()\n\n// Find an available port starting from 3000\nconst port = await networking.findOpenPort(3000)\nconsole.log(`Server can use port: ${port}`)"
          }
        ]
      },
      "isPortOpen": {
        "description": "Checks if a specific port is available for use. This method attempts to detect if the specified port is available. It returns true if the port is available, false if it's already in use.",
        "parameters": {
          "checkPort": {
            "type": "any",
            "description": "The port number to check for availability"
          }
        },
        "required": [],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "// Check if port 8080 is available\nconst isAvailable = await networking.isPortOpen(8080)\nif (isAvailable) {\n console.log('Port 8080 is free to use')\n} else {\n console.log('Port 8080 is already in use')\n}"
          }
        ]
      },
      "getLocalNetworks": {
        "description": "Returns local external IPv4 interfaces and their CIDR ranges.",
        "parameters": {},
        "required": [],
        "returns": "LocalNetwork[]"
      },
      "expandCidr": {
        "description": "Expands a CIDR block to host IP addresses. For /31 and /32, all addresses are returned. For all others, network/broadcast are excluded.",
        "parameters": {
          "cidr": {
            "type": "string",
            "description": "Parameter cidr"
          }
        },
        "required": [
          "cidr"
        ],
        "returns": "string[]"
      },
      "getArpTable": {
        "description": "Reads and parses the system ARP cache.",
        "parameters": {},
        "required": [],
        "returns": "Promise<ArpEntry[]>"
      },
      "isHostReachable": {
        "description": "Performs a lightweight TCP reachability probe.",
        "parameters": {
          "host": {
            "type": "string",
            "description": "Parameter host"
          },
          "options": {
            "type": "ReachableHostOptions",
            "description": "Parameter options",
            "properties": {
              "timeout": {
                "type": "number",
                "description": ""
              },
              "ports": {
                "type": "number[]",
                "description": ""
              }
            }
          }
        },
        "required": [
          "host"
        ],
        "returns": "Promise<boolean>"
      },
      "discoverHosts": {
        "description": "Discovers hosts in a CIDR range by combining ARP cache and TCP probes.",
        "parameters": {
          "cidr": {
            "type": "string",
            "description": "Parameter cidr"
          },
          "options": {
            "type": "DiscoverHostsOptions",
            "description": "Parameter options",
            "properties": {
              "timeout": {
                "type": "number",
                "description": ""
              },
              "concurrency": {
                "type": "number",
                "description": ""
              },
              "ports": {
                "type": "number[]",
                "description": ""
              }
            }
          }
        },
        "required": [
          "cidr"
        ],
        "returns": "Promise<DiscoverHost[]>"
      },
      "scanPorts": {
        "description": "TCP connect scan for a host. By default only returns open ports.",
        "parameters": {
          "host": {
            "type": "string",
            "description": "Parameter host"
          },
          "options": {
            "type": "ScanPortsOptions",
            "description": "Parameter options",
            "properties": {
              "ports": {
                "type": "string | number[]",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "concurrency": {
                "type": "number",
                "description": ""
              },
              "banner": {
                "type": "boolean",
                "description": ""
              },
              "includeClosed": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "host"
        ],
        "returns": "Promise<PortScanResult[]>"
      },
      "scanLocalNetworks": {
        "description": "Convenience method: discover and port-scan hosts across all local networks.",
        "parameters": {
          "options": {
            "type": "ScanLocalNetworksOptions",
            "description": "Parameter options",
            "properties": {
              "ports": {
                "type": "string | number[]",
                "description": ""
              },
              "timeout": {
                "type": "number",
                "description": ""
              },
              "concurrency": {
                "type": "number",
                "description": ""
              },
              "hostConcurrency": {
                "type": "number",
                "description": ""
              },
              "banner": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<LocalNetworkScanHost[]>"
      }
    },
    "getters": {
      "proc": {
        "description": "",
        "returns": "ReturnType<typeof this.container.feature<'proc'>>"
      },
      "os": {
        "description": "",
        "returns": "ReturnType<typeof this.container.feature<'os'>>"
      },
      "nmap": {
        "description": "Optional nmap wrapper for users that already have nmap installed.",
        "returns": "{ isAvailable: () => Promise<boolean>; scan: (target: string, args?: string[]) => Promise<{ hosts: NmapHost[]; raw: string }>; quickScan: (cidr: string) => Promise<{ hosts: NmapHost[]; raw: string }>; fullScan: (target: string) => Promise<{ hosts: NmapHost[]; raw: string }> }"
      }
    },
    "events": {
      "scan:start": {
        "name": "scan:start",
        "description": "Event emitted by Networking",
        "arguments": {}
      },
      "host:discovered": {
        "name": "host:discovered",
        "description": "Event emitted by Networking",
        "arguments": {}
      },
      "scan:complete": {
        "name": "scan:complete",
        "description": "Event emitted by Networking",
        "arguments": {}
      },
      "port:open": {
        "name": "port:open",
        "description": "Event emitted by Networking",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const networking = container.feature('networking')\n\n// Find an available port starting from 3000\nconst port = await networking.findOpenPort(3000)\nconsole.log(`Available port: ${port}`)\n\n// Check if a specific port is available\nconst isAvailable = await networking.isPortOpen(8080)\nif (isAvailable) {\n console.log('Port 8080 is available')\n}"
      }
    ],
    "types": {
      "ReachableHostOptions": {
        "description": "",
        "properties": {
          "timeout": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "ports": {
            "type": "number[]",
            "description": "",
            "optional": true
          }
        }
      },
      "DiscoverHostsOptions": {
        "description": "",
        "properties": {
          "timeout": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "concurrency": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "ports": {
            "type": "number[]",
            "description": "",
            "optional": true
          }
        }
      },
      "ScanPortsOptions": {
        "description": "",
        "properties": {
          "ports": {
            "type": "string | number[]",
            "description": "",
            "optional": true
          },
          "timeout": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "concurrency": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "banner": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "includeClosed": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      },
      "ScanLocalNetworksOptions": {
        "description": "",
        "properties": {
          "ports": {
            "type": "string | number[]",
            "description": "",
            "optional": true
          },
          "timeout": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "concurrency": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "hostConcurrency": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "banner": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      },
      "NmapHost": {
        "description": "",
        "properties": {
          "ip": {
            "type": "string",
            "description": ""
          },
          "hostname": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "status": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "mac": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "ports": {
            "type": "NmapPort[]",
            "description": ""
          }
        }
      },
      "NmapPort": {
        "description": "",
        "properties": {
          "port": {
            "type": "number",
            "description": ""
          },
          "state": {
            "type": "string",
            "description": ""
          },
          "protocol": {
            "type": "string",
            "description": ""
          },
          "service": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.vault",
    "description": "The Vault feature provides encryption and decryption capabilities using AES-256-GCM. This feature allows you to securely encrypt and decrypt sensitive data using industry-standard encryption. It manages secret keys and provides a simple interface for cryptographic operations.",
    "shortcut": "features.vault",
    "className": "Vault",
    "methods": {
      "secret": {
        "description": "Gets or generates a secret key for encryption operations.",
        "parameters": {
          "{ refresh = false, set = true }": {
            "type": "any",
            "description": "Parameter { refresh = false, set = true }"
          }
        },
        "required": [],
        "returns": "Buffer"
      },
      "decrypt": {
        "description": "Decrypts an encrypted payload that was created by the encrypt method.",
        "parameters": {
          "payload": {
            "type": "string",
            "description": "The encrypted payload to decrypt (base64 encoded with delimiters)"
          }
        },
        "required": [
          "payload"
        ],
        "returns": "string"
      },
      "encrypt": {
        "description": "Encrypts a plaintext string using AES-256-GCM encryption.",
        "parameters": {
          "payload": {
            "type": "string",
            "description": "The plaintext string to encrypt"
          }
        },
        "required": [
          "payload"
        ],
        "returns": "string"
      }
    },
    "getters": {
      "secretText": {
        "description": "Gets the secret key as a base64-encoded string.",
        "returns": "string | undefined"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const vault = container.feature('vault')\n\n// Encrypt sensitive data\nconst encrypted = vault.encrypt('sensitive information')\nconsole.log(encrypted) // Base64 encoded encrypted data\n\n// Decrypt the data\nconst decrypted = vault.decrypt(encrypted)\nconsole.log(decrypted) // 'sensitive information'"
      }
    ]
  },
  {
    "id": "features.googleCalendar",
    "description": "Google Calendar feature for listing calendars and reading events. Depends on the googleAuth feature for authentication. Creates a Calendar v3 API client lazily. Provides convenience methods for today's events and upcoming days.",
    "shortcut": "features.googleCalendar",
    "className": "GoogleCalendar",
    "methods": {
      "listCalendars": {
        "description": "List all calendars accessible to the authenticated user.",
        "parameters": {},
        "required": [],
        "returns": "Promise<CalendarInfo[]>"
      },
      "listEvents": {
        "description": "List events from a calendar within a time range.",
        "parameters": {
          "options": {
            "type": "ListEventsOptions",
            "description": "Filtering options including timeMin, timeMax, query, maxResults",
            "properties": {
              "calendarId": {
                "type": "string",
                "description": ""
              },
              "timeMin": {
                "type": "string",
                "description": ""
              },
              "timeMax": {
                "type": "string",
                "description": ""
              },
              "maxResults": {
                "type": "number",
                "description": ""
              },
              "query": {
                "type": "string",
                "description": ""
              },
              "orderBy": {
                "type": "'startTime' | 'updated'",
                "description": ""
              },
              "pageToken": {
                "type": "string",
                "description": ""
              },
              "singleEvents": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<CalendarEventList>"
      },
      "getToday": {
        "description": "Get today's events from a calendar.",
        "parameters": {
          "calendarId": {
            "type": "string",
            "description": "Calendar ID (defaults to options.defaultCalendarId or 'primary')"
          }
        },
        "required": [],
        "returns": "Promise<CalendarEvent[]>"
      },
      "getUpcoming": {
        "description": "Get upcoming events for the next N days.",
        "parameters": {
          "days": {
            "type": "number",
            "description": "Number of days to look ahead (default: 7)"
          },
          "calendarId": {
            "type": "string",
            "description": "Calendar ID"
          }
        },
        "required": [],
        "returns": "Promise<CalendarEvent[]>"
      },
      "getEvent": {
        "description": "Get a single event by ID.",
        "parameters": {
          "eventId": {
            "type": "string",
            "description": "The event ID"
          },
          "calendarId": {
            "type": "string",
            "description": "Calendar ID"
          }
        },
        "required": [
          "eventId"
        ],
        "returns": "Promise<CalendarEvent>"
      },
      "searchEvents": {
        "description": "Search events by text query across event summaries, descriptions, and locations.",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Freetext search term"
          },
          "options": {
            "type": "ListEventsOptions",
            "description": "Additional listing options (timeMin, timeMax, calendarId, etc.)",
            "properties": {
              "calendarId": {
                "type": "string",
                "description": ""
              },
              "timeMin": {
                "type": "string",
                "description": ""
              },
              "timeMax": {
                "type": "string",
                "description": ""
              },
              "maxResults": {
                "type": "number",
                "description": ""
              },
              "query": {
                "type": "string",
                "description": ""
              },
              "orderBy": {
                "type": "'startTime' | 'updated'",
                "description": ""
              },
              "pageToken": {
                "type": "string",
                "description": ""
              },
              "singleEvents": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "query"
        ],
        "returns": "Promise<CalendarEvent[]>"
      }
    },
    "getters": {
      "auth": {
        "description": "Access the google-auth feature lazily.",
        "returns": "GoogleAuth"
      },
      "defaultCalendarId": {
        "description": "Default calendar ID from options or 'primary'.",
        "returns": "string"
      }
    },
    "events": {
      "error": {
        "name": "error",
        "description": "Event emitted by GoogleCalendar",
        "arguments": {}
      },
      "eventsFetched": {
        "name": "eventsFetched",
        "description": "Event emitted by GoogleCalendar",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const calendar = container.feature('googleCalendar')\n\n// List all calendars\nconst calendars = await calendar.listCalendars()\n\n// Get today's events\nconst today = await calendar.getToday()\n\n// Get next 7 days of events\nconst upcoming = await calendar.getUpcoming(7)\n\n// Search events\nconst meetings = await calendar.searchEvents('standup')\n\n// List events in a time range\nconst events = await calendar.listEvents({\n timeMin: '2026-03-01T00:00:00Z',\n timeMax: '2026-03-31T23:59:59Z',\n})"
      }
    ],
    "types": {
      "CalendarInfo": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "summary": {
            "type": "string",
            "description": ""
          },
          "description": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "timeZone": {
            "type": "string",
            "description": ""
          },
          "primary": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "backgroundColor": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "accessRole": {
            "type": "string",
            "description": ""
          }
        }
      },
      "ListEventsOptions": {
        "description": "",
        "properties": {
          "calendarId": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "timeMin": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "timeMax": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "maxResults": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "query": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "orderBy": {
            "type": "'startTime' | 'updated'",
            "description": "",
            "optional": true
          },
          "pageToken": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "singleEvents": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      },
      "CalendarEventList": {
        "description": "",
        "properties": {
          "events": {
            "type": "CalendarEvent[]",
            "description": ""
          },
          "nextPageToken": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "timeZone": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      },
      "CalendarEvent": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "summary": {
            "type": "string",
            "description": ""
          },
          "description": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "location": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "start": {
            "type": "{ dateTime?: string; date?: string; timeZone?: string }",
            "description": ""
          },
          "end": {
            "type": "{ dateTime?: string; date?: string; timeZone?: string }",
            "description": ""
          },
          "status": {
            "type": "string",
            "description": ""
          },
          "htmlLink": {
            "type": "string",
            "description": ""
          },
          "creator": {
            "type": "{ email?: string; displayName?: string }",
            "description": "",
            "optional": true
          },
          "organizer": {
            "type": "{ email?: string; displayName?: string }",
            "description": "",
            "optional": true
          },
          "attendees": {
            "type": "Array<{ email?: string; displayName?: string; responseStatus?: string }>",
            "description": "",
            "optional": true
          },
          "recurrence": {
            "type": "string[]",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.redis",
    "description": "Redis feature for shared state and pub/sub communication between container instances. Wraps ioredis with a focused API for the primitives that matter most: key/value state, pub/sub messaging, and cross-instance coordination. Uses a dedicated subscriber connection for pub/sub (ioredis requirement), created lazily on first subscribe call.",
    "shortcut": "features.redis",
    "className": "RedisFeature",
    "methods": {
      "set": {
        "description": "Set a key to a string value with optional TTL.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The key name"
          },
          "value": {
            "type": "string",
            "description": "The string value to store"
          },
          "ttl": {
            "type": "number",
            "description": "Optional time-to-live in seconds"
          }
        },
        "required": [
          "key",
          "value"
        ],
        "returns": "Promise<void>"
      },
      "get": {
        "description": "Get a key's value. Returns null if the key doesn't exist.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The key name"
          }
        },
        "required": [
          "key"
        ],
        "returns": "Promise<string | null>"
      },
      "del": {
        "description": "Delete one or more keys.",
        "parameters": {
          "keys": {
            "type": "string[]",
            "description": "One or more key names to delete"
          }
        },
        "required": [
          "keys"
        ],
        "returns": "Promise<number>"
      },
      "exists": {
        "description": "Check if a key exists.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The key name"
          }
        },
        "required": [
          "key"
        ],
        "returns": "Promise<boolean>"
      },
      "expire": {
        "description": "Set a key's TTL in seconds.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The key name"
          },
          "seconds": {
            "type": "number",
            "description": "TTL in seconds"
          }
        },
        "required": [
          "key",
          "seconds"
        ],
        "returns": "Promise<boolean>"
      },
      "keys": {
        "description": "Find keys matching a glob pattern (respects prefix).",
        "parameters": {
          "pattern": {
            "type": "string",
            "description": "Glob pattern, e.g. \"worker:*\""
          }
        },
        "required": [],
        "returns": "Promise<string[]>"
      },
      "setJSON": {
        "description": "Store a value as JSON.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The key name"
          },
          "value": {
            "type": "unknown",
            "description": "Any JSON-serializable value"
          },
          "ttl": {
            "type": "number",
            "description": "Optional TTL in seconds"
          }
        },
        "required": [
          "key",
          "value"
        ],
        "returns": "Promise<void>"
      },
      "getJSON": {
        "description": "Retrieve and parse a JSON value.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The key name"
          }
        },
        "required": [
          "key"
        ],
        "returns": "Promise<T | null>"
      },
      "hset": {
        "description": "Set fields on a hash.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The hash key"
          },
          "fields": {
            "type": "Record<string, string>",
            "description": "Object of field/value pairs"
          }
        },
        "required": [
          "key",
          "fields"
        ],
        "returns": "Promise<void>"
      },
      "hgetall": {
        "description": "Get all fields from a hash.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The hash key"
          }
        },
        "required": [
          "key"
        ],
        "returns": "Promise<Record<string, string>>"
      },
      "hget": {
        "description": "Get a single field from a hash.",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The hash key"
          },
          "field": {
            "type": "string",
            "description": "The field name"
          }
        },
        "required": [
          "key",
          "field"
        ],
        "returns": "Promise<string | null>"
      },
      "subscribe": {
        "description": "Subscribe to one or more channels. Optionally pass a handler that fires only for these channels. The feature also emits a `message` event for all messages.",
        "parameters": {
          "channels": {
            "type": "string | string[]",
            "description": "Channel name(s) to subscribe to"
          },
          "handler": {
            "type": "MessageHandler",
            "description": "Optional per-channel message handler"
          }
        },
        "required": [
          "channels"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await redis.subscribe('tasks', (channel, msg) => {\n console.log(`Got ${msg} on ${channel}`)\n})"
          }
        ]
      },
      "unsubscribe": {
        "description": "Unsubscribe from one or more channels.",
        "parameters": {
          "channels": {
            "type": "string[]",
            "description": "Channel name(s) to unsubscribe from"
          }
        },
        "required": [
          "channels"
        ],
        "returns": "Promise<void>"
      },
      "publish": {
        "description": "Publish a message to a channel.",
        "parameters": {
          "channel": {
            "type": "string",
            "description": "The channel to publish to"
          },
          "message": {
            "type": "string",
            "description": "The message string (use JSON.stringify for objects)"
          }
        },
        "required": [
          "channel",
          "message"
        ],
        "returns": "Promise<number>"
      },
      "ensureLocalDocker": {
        "description": "Spin up a local Redis instance via Docker. Checks if a container with the given name already exists and starts it if stopped, or creates a new one from redis:alpine. Requires the docker feature to be available on the container.",
        "parameters": {
          "options": {
            "type": "{ name?: string; port?: number; image?: string }",
            "description": "Container name and host port"
          }
        },
        "required": [],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const redis = container.feature('redis', { url: 'redis://localhost:6379', lazyConnect: true })\nawait redis.ensureLocalDocker()"
          }
        ]
      },
      "close": {
        "description": "Close all redis connections (main client + subscriber).",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      }
    },
    "getters": {
      "client": {
        "description": "The underlying ioredis client for advanced operations.",
        "returns": "Redis"
      },
      "subscriber": {
        "description": "The dedicated subscriber connection, if pub/sub is active.",
        "returns": "Redis | null"
      }
    },
    "events": {
      "message": {
        "name": "message",
        "description": "Event emitted by RedisFeature",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by RedisFeature",
        "arguments": {}
      },
      "subscribed": {
        "name": "subscribed",
        "description": "Event emitted by RedisFeature",
        "arguments": {}
      },
      "unsubscribed": {
        "name": "unsubscribed",
        "description": "Event emitted by RedisFeature",
        "arguments": {}
      },
      "closed": {
        "name": "closed",
        "description": "Event emitted by RedisFeature",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const redis = container.feature('redis', { url: 'redis://localhost:6379' })\n\n// Shared state\nawait redis.set('worker:status', 'active')\nconst status = await redis.get('worker:status')\n\n// Pub/sub between instances\nredis.on('message', (channel, msg) => console.log(`${channel}: ${msg}`))\nawait redis.subscribe('tasks')\nawait redis.publish('tasks', JSON.stringify({ type: 'ping' }))\n\n// JSON helpers\nawait redis.setJSON('config', { workers: 4, debug: true })\nconst config = await redis.getJSON<{ workers: number }>('config')"
      }
    ]
  },
  {
    "id": "features.fs",
    "description": "The FS feature provides methods for interacting with the file system, relative to the container's cwd.",
    "shortcut": "features.fs",
    "className": "FS",
    "methods": {
      "readFile": {
        "description": "Synchronously reads a file and returns its contents as a string.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path relative to the container's working directory"
          },
          "encoding": {
            "type": "BufferEncoding | null",
            "description": "The encoding to use. Pass null to get a raw Buffer."
          }
        },
        "required": [
          "path"
        ],
        "returns": "string | Buffer",
        "examples": [
          {
            "language": "ts",
            "code": "const content = fs.readFile('README.md')\nconst buffer = fs.readFile('image.png', null)"
          }
        ]
      },
      "readFileSync": {
        "description": "Synchronously reads a file and returns its contents as a string. added this method because AI Assistants are understandly confused by this deviation from 2000's era node style",
        "parameters": {
          "path": {
            "type": "string",
            "description": "Parameter path"
          },
          "encoding": {
            "type": "BufferEncoding | null",
            "description": "Parameter encoding"
          }
        },
        "required": [
          "path"
        ],
        "returns": "string | Buffer"
      },
      "readFileAsync": {
        "description": "Asynchronously reads a file and returns its contents as a string.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path relative to the container's working directory"
          },
          "encoding": {
            "type": "BufferEncoding | null",
            "description": "The encoding to use. Pass null to get a raw Buffer."
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<string | Buffer>",
        "examples": [
          {
            "language": "ts",
            "code": "const content = await fs.readFileAsync('data.txt')\nconst buffer = await fs.readFileAsync('image.png', null)"
          }
        ]
      },
      "readJson": {
        "description": "Synchronously reads and parses a JSON file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to the JSON file"
          }
        },
        "required": [
          "path"
        ],
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const config = fs.readJson('config.json')\nconsole.log(config.version)"
          }
        ]
      },
      "readJsonSync": {
        "description": "Read and parse a JSON file synchronously",
        "parameters": {
          "path": {
            "type": "string",
            "description": "Parameter path"
          }
        },
        "required": [
          "path"
        ],
        "returns": "any"
      },
      "readJsonAsync": {
        "description": "Asynchronously reads and parses a JSON file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to the JSON file"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "const config = await fs.readJsonAsync('config.json')\nconsole.log(config.version)"
          }
        ]
      },
      "readdirSync": {
        "description": "Synchronously reads the contents of a directory.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The directory path relative to the container's working directory"
          }
        },
        "required": [
          "path"
        ],
        "returns": "string[]",
        "examples": [
          {
            "language": "ts",
            "code": "const entries = fs.readdirSync('src')\nconsole.log(entries) // ['index.ts', 'utils.ts', 'components']"
          }
        ]
      },
      "readdir": {
        "description": "Asynchronously reads the contents of a directory.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The directory path relative to the container's working directory"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<string[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const entries = await fs.readdir('src')\nconsole.log(entries) // ['index.ts', 'utils.ts', 'components']"
          }
        ]
      },
      "writeFile": {
        "description": "Synchronously writes content to a file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path where content should be written"
          },
          "content": {
            "type": "Buffer | string",
            "description": "The content to write to the file"
          }
        },
        "required": [
          "path",
          "content"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.writeFile('output.txt', 'Hello World')\nfs.writeFile('data.bin', Buffer.from([1, 2, 3, 4]))"
          }
        ]
      },
      "writeFileAsync": {
        "description": "Asynchronously writes content to a file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path where content should be written"
          },
          "content": {
            "type": "Buffer | string",
            "description": "The content to write to the file"
          }
        },
        "required": [
          "path",
          "content"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.writeFileAsync('output.txt', 'Hello World')\nawait fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))"
          }
        ]
      },
      "writeJson": {
        "description": "Synchronously writes an object to a file as JSON.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path where the JSON should be written"
          },
          "data": {
            "type": "any",
            "description": "The data to serialize as JSON"
          },
          "indent": {
            "type": "number",
            "description": "The number of spaces to use for indentation"
          }
        },
        "required": [
          "path",
          "data"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.writeJson('config.json', { version: '1.0.0', debug: false })"
          }
        ]
      },
      "writeJsonAsync": {
        "description": "Asynchronously writes an object to a file as JSON.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path where the JSON should be written"
          },
          "data": {
            "type": "any",
            "description": "The data to serialize as JSON"
          },
          "indent": {
            "type": "number",
            "description": "The number of spaces to use for indentation"
          }
        },
        "required": [
          "path",
          "data"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.writeJsonAsync('config.json', { version: '1.0.0', debug: false })"
          }
        ]
      },
      "appendFile": {
        "description": "Synchronously appends content to a file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path to append to"
          },
          "content": {
            "type": "Buffer | string",
            "description": "The content to append"
          }
        },
        "required": [
          "path",
          "content"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.appendFile('log.txt', 'New line\\n')"
          }
        ]
      },
      "appendFileAsync": {
        "description": "Asynchronously appends content to a file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path to append to"
          },
          "content": {
            "type": "Buffer | string",
            "description": "The content to append"
          }
        },
        "required": [
          "path",
          "content"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.appendFileAsync('log.txt', 'New line\\n')"
          }
        ]
      },
      "ensureFile": {
        "description": "Synchronously ensures a file exists with the specified content, creating directories as needed.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path where the file should be created"
          },
          "content": {
            "type": "string",
            "description": "The content to write to the file"
          },
          "overwrite": {
            "type": "any",
            "description": "Whether to overwrite the file if it already exists"
          }
        },
        "required": [
          "path",
          "content"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "fs.ensureFile('logs/app.log', '', false)"
          }
        ]
      },
      "ensureFileAsync": {
        "description": "Asynchronously ensures a file exists with the specified content, creating directories as needed.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path where the file should be created"
          },
          "content": {
            "type": "string",
            "description": "The content to write to the file"
          },
          "overwrite": {
            "type": "any",
            "description": "Whether to overwrite the file if it already exists"
          }
        },
        "required": [
          "path",
          "content"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.ensureFileAsync('config/settings.json', '{}', true)"
          }
        ]
      },
      "ensureFolder": {
        "description": "Synchronously ensures a directory exists, creating parent directories as needed.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The directory path to create"
          }
        },
        "required": [
          "path"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "fs.ensureFolder('logs/debug')"
          }
        ]
      },
      "ensureFolderAsync": {
        "description": "Asynchronously ensures a directory exists, creating parent directories as needed.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The directory path to create"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.ensureFolderAsync('logs/debug')"
          }
        ]
      },
      "mkdirp": {
        "description": "Alias for ensureFolder. Synchronously creates a directory and all parent directories.",
        "parameters": {
          "folder": {
            "type": "string",
            "description": "The directory path to create"
          }
        },
        "required": [
          "folder"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "fs.mkdirp('deep/nested/path')"
          }
        ]
      },
      "exists": {
        "description": "Synchronously checks if a file or directory exists.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to check for existence"
          }
        },
        "required": [
          "path"
        ],
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (fs.exists('config.json')) {\n console.log('Config file exists!')\n}"
          }
        ]
      },
      "existsSync": {
        "description": "Alias for exists. Synchronously checks if a file or directory exists.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to check for existence"
          }
        },
        "required": [
          "path"
        ],
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (fs.existsSync('config.json')) {\n console.log('Config file exists!')\n}"
          }
        ]
      },
      "existsAsync": {
        "description": "Asynchronously checks if a file or directory exists.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to check for existence"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "if (await fs.existsAsync('config.json')) {\n console.log('Config file exists!')\n}"
          }
        ]
      },
      "isSymlink": {
        "description": "Checks if a path is a symbolic link.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to check"
          }
        },
        "required": [
          "path"
        ],
        "returns": "boolean"
      },
      "realpath": {
        "description": "Resolves a symlink to its real path. Returns the resolved path as-is if not a symlink.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to resolve"
          }
        },
        "required": [
          "path"
        ],
        "returns": "string"
      },
      "stat": {
        "description": "Synchronously returns the stat object for a file or directory.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to stat"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Stats",
        "examples": [
          {
            "language": "ts",
            "code": "const info = fs.stat('package.json')\nconsole.log(info.size, info.mtime)"
          }
        ]
      },
      "statAsync": {
        "description": "Asynchronously returns the stat object for a file or directory.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to stat"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<Stats>",
        "examples": [
          {
            "language": "ts",
            "code": "const info = await fs.statAsync('package.json')\nconsole.log(info.size, info.mtime)"
          }
        ]
      },
      "isFile": {
        "description": "Synchronously checks if a path is a file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to check"
          }
        },
        "required": [
          "path"
        ],
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (fs.isFile('package.json')) {\n console.log('It is a file')\n}"
          }
        ]
      },
      "isFileAsync": {
        "description": "Asynchronously checks if a path is a file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to check"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "if (await fs.isFileAsync('package.json')) {\n console.log('It is a file')\n}"
          }
        ]
      },
      "isDirectory": {
        "description": "Synchronously checks if a path is a directory.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to check"
          }
        },
        "required": [
          "path"
        ],
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "if (fs.isDirectory('src')) {\n console.log('It is a directory')\n}"
          }
        ]
      },
      "isDirectoryAsync": {
        "description": "Asynchronously checks if a path is a directory.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to check"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "if (await fs.isDirectoryAsync('src')) {\n console.log('It is a directory')\n}"
          }
        ]
      },
      "rmSync": {
        "description": "Synchronously removes a file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path of the file to remove"
          }
        },
        "required": [
          "path"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.rmSync('temp/cache.tmp')"
          }
        ]
      },
      "rm": {
        "description": "Asynchronously removes a file.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path of the file to remove"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.rm('temp/cache.tmp')"
          }
        ]
      },
      "rmdirSync": {
        "description": "Synchronously removes a directory and all its contents.",
        "parameters": {
          "dirPath": {
            "type": "string",
            "description": "The path of the directory to remove"
          }
        },
        "required": [
          "dirPath"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.rmdirSync('temp/cache')"
          }
        ]
      },
      "rmdir": {
        "description": "Asynchronously removes a directory and all its contents.",
        "parameters": {
          "dirPath": {
            "type": "string",
            "description": "The path of the directory to remove"
          }
        },
        "required": [
          "dirPath"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.rmdir('temp/cache')"
          }
        ]
      },
      "copy": {
        "description": "Synchronously copies a file or directory. Auto-detects whether the source is a file or directory and handles each appropriately (recursive for directories).",
        "parameters": {
          "src": {
            "type": "string",
            "description": "The source path to copy from"
          },
          "dest": {
            "type": "string",
            "description": "The destination path to copy to"
          },
          "options": {
            "type": "{ overwrite?: boolean }",
            "description": "Copy options",
            "properties": {
              "overwrite": {
                "type": "any",
                "description": "Whether to overwrite existing files at the destination"
              }
            }
          }
        },
        "required": [
          "src",
          "dest"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.copy('src/config.json', 'backup/config.json')\nfs.copy('src', 'backup/src')"
          }
        ]
      },
      "copyAsync": {
        "description": "Asynchronously copies a file or directory. Auto-detects whether the source is a file or directory and handles each appropriately (recursive for directories).",
        "parameters": {
          "src": {
            "type": "string",
            "description": "The source path to copy from"
          },
          "dest": {
            "type": "string",
            "description": "The destination path to copy to"
          },
          "options": {
            "type": "{ overwrite?: boolean }",
            "description": "Copy options",
            "properties": {
              "overwrite": {
                "type": "any",
                "description": "Whether to overwrite existing files at the destination"
              }
            }
          }
        },
        "required": [
          "src",
          "dest"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.copyAsync('src/config.json', 'backup/config.json')\nawait fs.copyAsync('src', 'backup/src')"
          }
        ]
      },
      "move": {
        "description": "Synchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.",
        "parameters": {
          "src": {
            "type": "string",
            "description": "The source path to move from"
          },
          "dest": {
            "type": "string",
            "description": "The destination path to move to"
          }
        },
        "required": [
          "src",
          "dest"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.move('temp/draft.txt', 'final/document.txt')\nfs.move('old-dir', 'new-dir')"
          }
        ]
      },
      "moveAsync": {
        "description": "Asynchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.",
        "parameters": {
          "src": {
            "type": "string",
            "description": "The source path to move from"
          },
          "dest": {
            "type": "string",
            "description": "The destination path to move to"
          }
        },
        "required": [
          "src",
          "dest"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.moveAsync('temp/draft.txt', 'final/document.txt')\nawait fs.moveAsync('old-dir', 'new-dir')"
          }
        ]
      },
      "walk": {
        "description": "Recursively walks a directory and returns arrays of file and directory paths. By default paths are absolute. Pass `relative: true` to get paths relative to `basePath`. Supports filtering with exclude and include glob patterns.",
        "parameters": {
          "basePath": {
            "type": "string",
            "description": "The base directory path to start walking from"
          },
          "options": {
            "type": "WalkOptions",
            "description": "Options to configure the walk behavior",
            "properties": {
              "directories": {
                "type": "boolean",
                "description": "Whether to include directories in results"
              },
              "files": {
                "type": "boolean",
                "description": "Whether to include files in results"
              },
              "exclude": {
                "type": "string | string[]",
                "description": "] - Glob patterns to exclude (e.g. 'node_modules', '*.log')"
              },
              "include": {
                "type": "string | string[]",
                "description": "] - Glob patterns to include (only matching paths are returned)"
              },
              "relative": {
                "type": "boolean",
                "description": "When true, returned paths are relative to `baseDir` instead of absolute."
              }
            }
          }
        },
        "required": [
          "basePath"
        ],
        "returns": "{ directories: string[], files: string[] }",
        "examples": [
          {
            "language": "ts",
            "code": "const result = fs.walk('src', { files: true, directories: false })\nconst filtered = fs.walk('.', { exclude: ['node_modules', '.git'], include: ['*.ts'] })\nconst relative = fs.walk('inbox', { relative: true }) // => { files: ['contact-1.json', ...] }"
          }
        ]
      },
      "walkAsync": {
        "description": "Asynchronously and recursively walks a directory and returns arrays of file and directory paths. By default paths are absolute. Pass `relative: true` to get paths relative to `baseDir`. Supports filtering with exclude and include glob patterns.",
        "parameters": {
          "baseDir": {
            "type": "string",
            "description": "The base directory path to start walking from"
          },
          "options": {
            "type": "WalkOptions",
            "description": "Options to configure the walk behavior",
            "properties": {
              "directories": {
                "type": "boolean",
                "description": "Whether to include directories in results"
              },
              "files": {
                "type": "boolean",
                "description": "Whether to include files in results"
              },
              "exclude": {
                "type": "string | string[]",
                "description": "] - Glob patterns to exclude (e.g. 'node_modules', '.git')"
              },
              "include": {
                "type": "string | string[]",
                "description": "] - Glob patterns to include (only matching paths are returned)"
              },
              "relative": {
                "type": "boolean",
                "description": "When true, returned paths are relative to `baseDir` instead of absolute."
              }
            }
          }
        },
        "required": [
          "baseDir"
        ],
        "returns": "Promise<{ directories: string[], files: string[] }>",
        "examples": [
          {
            "language": "ts",
            "code": "const result = await fs.walkAsync('src', { exclude: ['node_modules'] })\nconst files = await fs.walkAsync('inbox', { relative: true })\n// files.files => ['contact-1.json', 'subfolder/file.txt', ...]"
          }
        ]
      },
      "findUp": {
        "description": "Synchronously finds a file by walking up the directory tree from the current working directory.",
        "parameters": {
          "fileName": {
            "type": "string",
            "description": "The name of the file to search for"
          },
          "options": {
            "type": "{ cwd?: string }",
            "description": "Options for the search",
            "properties": {
              "cwd": {
                "type": "any",
                "description": "The directory to start searching from (defaults to container.cwd)"
              }
            }
          }
        },
        "required": [
          "fileName"
        ],
        "returns": "string | null",
        "examples": [
          {
            "language": "ts",
            "code": "const packageJson = fs.findUp('package.json')\nif (packageJson) {\n console.log(`Found package.json at: ${packageJson}`)\n}"
          }
        ]
      },
      "findUpAsync": {
        "description": "Asynchronously finds a file by walking up the directory tree.",
        "parameters": {
          "fileName": {
            "type": "string",
            "description": "The name of the file to search for"
          },
          "options": {
            "type": "{ cwd?: string; multiple?: boolean }",
            "description": "Options for the search",
            "properties": {
              "cwd": {
                "type": "any",
                "description": "The directory to start searching from (defaults to container.cwd)"
              },
              "multiple": {
                "type": "any",
                "description": "Whether to find multiple instances of the file"
              }
            }
          }
        },
        "required": [
          "fileName"
        ],
        "returns": "Promise<string | string[] | null>",
        "examples": [
          {
            "language": "ts",
            "code": "const packageJson = await fs.findUpAsync('package.json')\nconst allPackageJsons = await fs.findUpAsync('package.json', { multiple: true })"
          }
        ]
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
        "code": "const fs = container.feature('fs')\nconst content = fs.readFile('package.json')\nconst exists = fs.exists('tsconfig.json')\nawait fs.writeFileAsync('output.txt', 'Hello World')\nfs.writeFile('sync-output.txt', 'Hello Sync')\nfs.copy('src', 'backup/src')"
      }
    ],
    "types": {
      "WalkOptions": {
        "description": "",
        "properties": {
          "directories": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "files": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "exclude": {
            "type": "string | string[]",
            "description": "",
            "optional": true
          },
          "include": {
            "type": "string | string[]",
            "description": "",
            "optional": true
          },
          "relative": {
            "type": "boolean",
            "description": "When true, returned paths are relative to `baseDir` instead of absolute.",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.ipcSocket",
    "description": "IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Hub-and-spoke: one server, many named clients with identity tracking - Targeted messaging: sendTo(clientId), broadcast(msg, excludeId) - Request/reply: ask() + reply() with timeout-based correlation - Auto-reconnect: clients reconnect with exponential backoff - Stale socket detection: probeSocket() before listen() - Clean shutdown: stopServer() removes socket file **Server (Hub):** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/hub.sock', true); ipc.on('connection', (clientId, socket) => { console.log('Client joined:', clientId); }); ipc.on('message', (data, clientId) => { console.log(`From ${clientId}:`, data); // Reply to sender, or ask and wait ipc.sendTo(clientId, { ack: true }); }); ``` **Client (Spoke):** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/hub.sock', { reconnect: true, name: 'worker-1' }); // Fire and forget await ipc.send({ type: 'status', ready: true }); // Request/reply ipc.on('message', (data) => { if (data.requestId) ipc.reply(data.requestId, { result: 42 }); }); ```",
    "shortcut": "features.ipcSocket",
    "className": "IpcSocket",
    "methods": {
      "listen": {
        "description": "Starts the IPC server listening on the specified socket path. This method sets up a Unix domain socket server that can accept multiple client connections. Each connected client is tracked, and the server automatically handles connection lifecycle events. Messages received from clients are JSON-parsed and emitted as 'message' events. **Server Behavior:** - Tracks all connected clients in the sockets Set - Automatically removes clients when they disconnect - JSON-parses incoming messages and emits 'message' events - Emits 'connection' events when clients connect - Prevents starting multiple servers on the same instance **Socket File Management:** - Resolves the socket path relative to the container's working directory - Optionally removes existing socket files to prevent \"address in use\" errors - Throws error if socket file exists and removeLock is false",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "The file system path for the Unix domain socket"
          },
          "removeLock": {
            "type": "any",
            "description": "Whether to remove existing socket file (default: false)"
          }
        },
        "required": [
          "socketPath"
        ],
        "returns": "Promise<Server>",
        "examples": [
          {
            "language": "ts",
            "code": "// Basic server setup\nconst server = await ipc.listen('/tmp/myapp.sock');\n\n// With automatic lock removal\nconst server = await ipc.listen('/tmp/myapp.sock', true);\n\n// Handle connections and messages\nipc.on('connection', (socket) => {\n console.log('New client connected');\n});\n\nipc.on('message', (data) => {\n console.log('Received message:', data);\n // Echo back to all clients\n ipc.broadcast({ echo: data });\n});"
          }
        ]
      },
      "stopServer": {
        "description": "Stops the IPC server and cleans up all connections. This method gracefully shuts down the server by: 1. Closing the server listener 2. Destroying all active client connections 3. Clearing the sockets tracking set 4. Resetting the server instance",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "// Graceful shutdown\ntry {\n await ipc.stopServer();\n console.log('IPC server stopped successfully');\n} catch (error) {\n console.error('Failed to stop server:', error.message);\n}"
          }
        ]
      },
      "broadcast": {
        "description": "Broadcasts a message to all connected clients (server mode only).",
        "parameters": {
          "message": {
            "type": "any",
            "description": "The message object to broadcast"
          },
          "exclude": {
            "type": "string",
            "description": "Optional client ID to exclude from broadcast"
          }
        },
        "required": [
          "message"
        ],
        "returns": "this"
      },
      "sendTo": {
        "description": "Sends a message to a specific client by ID (server mode only).",
        "parameters": {
          "clientId": {
            "type": "string",
            "description": "The target client ID"
          },
          "message": {
            "type": "any",
            "description": "The message to send"
          }
        },
        "required": [
          "clientId",
          "message"
        ],
        "returns": "boolean"
      },
      "send": {
        "description": "Fire-and-forget: sends a message to the server (client mode only). For server→client, use sendTo() or broadcast().",
        "parameters": {
          "message": {
            "type": "any",
            "description": "The message to send"
          }
        },
        "required": [
          "message"
        ],
        "returns": "Promise<void>"
      },
      "ask": {
        "description": "Sends a message and waits for a correlated reply. Works in both client and server mode. The recipient should call `reply(requestId, response)` to respond.",
        "parameters": {
          "message": {
            "type": "any",
            "description": "The message to send"
          },
          "options": {
            "type": "{ clientId?: string; timeoutMs?: number }",
            "description": "Optional: clientId (server mode target), timeoutMs"
          }
        },
        "required": [
          "message"
        ],
        "returns": "Promise<any>"
      },
      "reply": {
        "description": "Sends a reply to a previous ask() call, correlated by requestId.",
        "parameters": {
          "requestId": {
            "type": "string",
            "description": "The requestId from the incoming message"
          },
          "data": {
            "type": "any",
            "description": "The reply payload"
          },
          "clientId": {
            "type": "string",
            "description": "Target client (server mode; for client mode, omit)"
          }
        },
        "required": [
          "requestId",
          "data"
        ],
        "returns": "void"
      },
      "connect": {
        "description": "Connects to an IPC server at the specified socket path (client mode).",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "Path to the server's Unix domain socket"
          },
          "options": {
            "type": "{ reconnect?: boolean; name?: string }",
            "description": "Optional: reconnect (enable auto-reconnect), name (identify this client)"
          }
        },
        "required": [
          "socketPath"
        ],
        "returns": "Promise<Socket>"
      },
      "disconnect": {
        "description": "Disconnects the client and stops any reconnection attempts.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "probeSocket": {
        "description": "Probe an existing socket to see if a live listener is behind it. Attempts a quick connect — if it succeeds, someone is listening.",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "Parameter socketPath"
          }
        },
        "required": [
          "socketPath"
        ],
        "returns": "Promise<boolean>"
      }
    },
    "getters": {
      "isClient": {
        "description": "Checks if the IPC socket is operating in client mode.",
        "returns": "boolean"
      },
      "isServer": {
        "description": "Checks if the IPC socket is operating in server mode.",
        "returns": "boolean"
      },
      "clientCount": {
        "description": "Returns the number of currently connected clients (server mode).",
        "returns": "number"
      },
      "connectedClients": {
        "description": "Returns info about all connected clients (server mode).",
        "returns": "Array<{ id: string; name?: string; connectedAt: number }>"
      },
      "connection": {
        "description": "Gets the current client connection socket.",
        "returns": "Socket | undefined"
      }
    },
    "events": {
      "disconnection": {
        "name": "disconnection",
        "description": "Event emitted by IpcSocket",
        "arguments": {}
      },
      "connection": {
        "name": "connection",
        "description": "Event emitted by IpcSocket",
        "arguments": {}
      },
      "message": {
        "name": "message",
        "description": "Event emitted by IpcSocket",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.diskCache",
    "description": "File-backed key-value cache built on top of the cacache library (the same store that powers npm). Suitable for persisting arbitrary data including very large blobs when necessary, with optional encryption support.",
    "shortcut": "features.diskCache",
    "className": "DiskCache",
    "methods": {
      "saveFile": {
        "description": "Retrieve a file from the disk cache and save it to the local disk",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The cache key to retrieve"
          },
          "outputPath": {
            "type": "string",
            "description": "The local path where the file should be saved"
          },
          "isBase64": {
            "type": "any",
            "description": "Whether the cached content is base64 encoded"
          }
        },
        "required": [
          "key",
          "outputPath"
        ],
        "returns": "Promise<Buffer | string>",
        "examples": [
          {
            "language": "ts",
            "code": "await diskCache.saveFile('myFile', './output/file.txt')\nawait diskCache.saveFile('encodedImage', './images/photo.jpg', true)"
          }
        ]
      },
      "ensure": {
        "description": "Ensure a key exists in the cache, setting it with the provided content if it doesn't exist",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The cache key to check/set"
          },
          "content": {
            "type": "string",
            "description": "The content to set if the key doesn't exist"
          }
        },
        "required": [
          "key",
          "content"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "await diskCache.ensure('config', JSON.stringify(defaultConfig))"
          }
        ]
      },
      "copy": {
        "description": "Copy a cached item from one key to another",
        "parameters": {
          "source": {
            "type": "string",
            "description": "The source cache key"
          },
          "destination": {
            "type": "string",
            "description": "The destination cache key"
          },
          "overwrite": {
            "type": "boolean",
            "description": "Whether to overwrite if destination exists (default: false)"
          }
        },
        "required": [
          "source",
          "destination"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "await diskCache.copy('original', 'backup')\nawait diskCache.copy('file1', 'file2', true) // force overwrite"
          }
        ]
      },
      "move": {
        "description": "Move a cached item from one key to another (copy then delete source)",
        "parameters": {
          "source": {
            "type": "string",
            "description": "The source cache key"
          },
          "destination": {
            "type": "string",
            "description": "The destination cache key"
          },
          "overwrite": {
            "type": "boolean",
            "description": "Whether to overwrite if destination exists (default: false)"
          }
        },
        "required": [
          "source",
          "destination"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "await diskCache.move('temp', 'permanent')\nawait diskCache.move('old_key', 'new_key', true) // force overwrite"
          }
        ]
      },
      "has": {
        "description": "Check if a key exists in the cache",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The cache key to check"
          }
        },
        "required": [
          "key"
        ],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "if (await diskCache.has('myKey')) {\n console.log('Key exists!')\n}"
          }
        ]
      },
      "get": {
        "description": "Retrieve a value from the cache",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The cache key to retrieve"
          },
          "json": {
            "type": "any",
            "description": "Whether to parse the value as JSON (default: false)"
          }
        },
        "required": [
          "key"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "const text = await diskCache.get('myText')\nconst data = await diskCache.get('myData', true) // parse as JSON"
          }
        ]
      },
      "set": {
        "description": "Store a value in the cache",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The cache key to store under"
          },
          "value": {
            "type": "any",
            "description": "The value to store (string, object, or any serializable data)"
          },
          "meta": {
            "type": "any",
            "description": "Optional metadata to associate with the cached item"
          }
        },
        "required": [
          "key",
          "value"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "await diskCache.set('myKey', 'Hello World')\nawait diskCache.set('userData', { name: 'John', age: 30 })\nawait diskCache.set('file', content, { size: 1024, type: 'image' })"
          }
        ]
      },
      "rm": {
        "description": "Remove a cached item",
        "parameters": {
          "key": {
            "type": "string",
            "description": "The cache key to remove"
          }
        },
        "required": [
          "key"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "await diskCache.rm('obsoleteKey')"
          }
        ]
      },
      "clearAll": {
        "description": "Clear all cached items",
        "parameters": {
          "confirm": {
            "type": "any",
            "description": "Must be set to true to confirm the operation"
          }
        },
        "required": [],
        "returns": "Promise<this>",
        "examples": [
          {
            "language": "ts",
            "code": "await diskCache.clearAll(true) // Must explicitly confirm"
          }
        ]
      },
      "keys": {
        "description": "Get all cache keys",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const allKeys = await diskCache.keys()\nconsole.log(`Cache contains ${allKeys.length} items`)"
          }
        ]
      },
      "listKeys": {
        "description": "List all cache keys (alias for keys())",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const keyList = await diskCache.listKeys()"
          }
        ]
      },
      "create": {
        "description": "Create a cacache instance with the specified path",
        "parameters": {
          "path": {
            "type": "string",
            "description": "Optional cache directory path (defaults to options.path or ~/.cache/luca/disk-cache-{cwdHash})"
          }
        },
        "required": [],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const customCache = diskCache.create('/custom/cache/path')"
          }
        ]
      }
    },
    "getters": {
      "cache": {
        "description": "Returns the underlying cacache instance configured with the cache directory path.",
        "returns": "ReturnType<typeof this.create>"
      },
      "securely": {
        "description": "Get encrypted cache operations interface Requires encryption to be enabled and a secret to be provided",
        "returns": "{ set(name: string, payload: any, meta?: any): Promise<any>; get(name: string): Promise<any> }",
        "examples": [
          {
            "language": "ts",
            "code": "// Initialize with encryption\nconst cache = container.feature('diskCache', { \n encrypt: true, \n secret: Buffer.from('my-secret-key') \n})\n\n// Use encrypted operations\nawait cache.securely.set('sensitive', 'secret data')\nconst decrypted = await cache.securely.get('sensitive')"
          }
        ]
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const diskCache = container.feature('diskCache', { path: '/tmp/cache' })\nawait diskCache.set('greeting', 'Hello World')\nconst value = await diskCache.get('greeting')"
      }
    ]
  },
  {
    "id": "features.postgres",
    "description": "Postgres feature for safe SQL execution through Bun's native SQL client. Supports: - parameterized query execution (`query` / `execute`) - tagged-template query execution (`sql`) to avoid manual placeholder wiring",
    "shortcut": "features.postgres",
    "className": "Postgres",
    "methods": {
      "query": {
        "description": "Executes a SELECT-like query and returns result rows. Use postgres placeholders (`$1`, `$2`, ...) for `params`.",
        "parameters": {
          "queryText": {
            "type": "string",
            "description": "The SQL query string with optional `$N` placeholders"
          },
          "params": {
            "type": "SqlValue[]",
            "description": "Ordered array of values to bind to the placeholders"
          }
        },
        "required": [
          "queryText"
        ],
        "returns": "Promise<T[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })\nconst users = await pg.query<{ id: number; email: string }>(\n 'SELECT id, email FROM users WHERE active = $1',\n [true]\n)"
          }
        ]
      },
      "execute": {
        "description": "Executes a write/update/delete statement and returns metadata. Use postgres placeholders (`$1`, `$2`, ...) for `params`.",
        "parameters": {
          "queryText": {
            "type": "string",
            "description": "The SQL statement string with optional `$N` placeholders"
          },
          "params": {
            "type": "SqlValue[]",
            "description": "Ordered array of values to bind to the placeholders"
          }
        },
        "required": [
          "queryText"
        ],
        "returns": "Promise<{ rowCount: number }>",
        "examples": [
          {
            "language": "ts",
            "code": "const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })\nconst { rowCount } = await pg.execute(\n 'UPDATE users SET active = $1 WHERE last_login < $2',\n [false, '2024-01-01']\n)\nconsole.log(`Deactivated ${rowCount} users`)"
          }
        ]
      },
      "sql": {
        "description": "Safe tagged-template SQL helper. Values become bound parameters automatically, preventing SQL injection.",
        "parameters": {
          "strings": {
            "type": "TemplateStringsArray",
            "description": "Template literal string segments"
          },
          "values": {
            "type": "SqlValue[]",
            "description": "Interpolated values that become bound `$N` parameters"
          }
        },
        "required": [
          "strings",
          "values"
        ],
        "returns": "Promise<T[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })\nconst email = 'hello@example.com'\nconst rows = await pg.sql<{ id: number }>`\n SELECT id FROM users WHERE email = ${email}\n`"
          }
        ]
      },
      "close": {
        "description": "Closes the postgres connection and updates feature state. Emits `closed` after the connection is torn down.",
        "parameters": {},
        "required": [],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const pg = container.feature('postgres', { url: process.env.DATABASE_URL! })\n// ... run queries ...\nawait pg.close()"
          }
        ]
      }
    },
    "getters": {
      "client": {
        "description": "Returns the underlying Bun SQL postgres client.",
        "returns": "any"
      }
    },
    "events": {
      "query": {
        "name": "query",
        "description": "Event emitted by Postgres",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by Postgres",
        "arguments": {}
      },
      "execute": {
        "name": "execute",
        "description": "Event emitted by Postgres",
        "arguments": {}
      },
      "closed": {
        "name": "closed",
        "description": "Event emitted by Postgres",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const postgres = container.feature('postgres', { url: process.env.DATABASE_URL! })\n\nconst users = await postgres.query<{ id: number; email: string }>(\n 'select id, email from users where id = $1',\n [123]\n)\n\nconst rows = await postgres.sql<{ id: number }>`\n select id from users where email = ${'hello@example.com'}\n`"
      }
    ]
  },
  {
    "id": "features.python",
    "description": "The Python VM feature provides Python virtual machine capabilities for executing Python code. This feature automatically detects Python environments (uv, conda, venv, system) and provides methods to install dependencies and execute Python scripts. It can manage project-specific Python environments and maintain context between executions. Supports two modes: - **Stateless** (default): `execute()` and `executeFile()` spawn a fresh process per call - **Persistent session**: `startSession()` spawns a long-lived bridge process that maintains state across `run()` calls, enabling real codebase interaction with imports and session variables",
    "shortcut": "features.python",
    "className": "Python",
    "methods": {
      "enable": {
        "description": "",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "detectEnvironment": {
        "description": "Detects the Python environment type and sets the appropriate Python path. This method checks for various Python environment managers in order of preference: uv, conda, venv, then falls back to system Python. It sets the pythonPath and environmentType in the state.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await python.detectEnvironment()\nconsole.log(python.state.get('environmentType')) // 'uv' | 'conda' | 'venv' | 'system'\nconsole.log(python.state.get('pythonPath')) // '/path/to/python/executable'"
          }
        ]
      },
      "installDependencies": {
        "description": "Installs dependencies for the Python project. This method automatically detects the appropriate package manager and install command based on the environment type. If a custom installCommand is provided in options, it will use that instead.",
        "parameters": {},
        "required": [],
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>",
        "examples": [
          {
            "language": "ts",
            "code": "// Auto-detect and install\nconst result = await python.installDependencies()\n\n// With custom install command\nconst python = container.feature('python', { \n installCommand: 'pip install -r requirements.txt' \n})\nconst result = await python.installDependencies()"
          }
        ]
      },
      "execute": {
        "description": "Executes Python code and returns the result. This method creates a temporary Python script with the provided code and variables, executes it using the detected Python environment, and captures the output.",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The Python code to execute"
          },
          "variables": {
            "type": "Record<string, any>",
            "description": "Variables to make available to the Python code"
          },
          "options": {
            "type": "{ captureLocals?: boolean }",
            "description": "Execution options",
            "properties": {
              "captureLocals": {
                "type": "any",
                "description": "Whether to capture and return local variables after execution"
              }
            }
          }
        },
        "required": [
          "code"
        ],
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number; locals?: any }>",
        "examples": [
          {
            "language": "ts",
            "code": "// Simple execution\nconst result = await python.execute('print(\"Hello World\")')\nconsole.log(result.stdout) // 'Hello World'\n\n// With variables\nconst result = await python.execute('print(f\"Hello {name}!\")', { name: 'Alice' })\n\n// Capture locals\nconst result = await python.execute('x = 42\\ny = x * 2', {}, { captureLocals: true })\nconsole.log(result.locals) // { x: 42, y: 84 }"
          }
        ]
      },
      "executeFile": {
        "description": "Executes a Python file and returns the result.",
        "parameters": {
          "filePath": {
            "type": "string",
            "description": "Path to the Python file to execute"
          },
          "variables": {
            "type": "Record<string, any>",
            "description": "Variables to make available via command line arguments"
          }
        },
        "required": [
          "filePath"
        ],
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>",
        "examples": [
          {
            "language": "ts",
            "code": "const result = await python.executeFile('/path/to/script.py')\nconsole.log(result.stdout)"
          }
        ]
      },
      "getEnvironmentInfo": {
        "description": "Gets information about the current Python environment.",
        "parameters": {},
        "required": [],
        "returns": "Promise<{ version: string; path: string; packages: string[] }>"
      },
      "startSession": {
        "description": "Starts a persistent Python session by spawning the bridge process. The bridge sets up sys.path for the project directory, then enters a JSON-line REPL loop. State (variables, imports) persists across run() calls until stopSession() or resetSession() is called.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "const python = container.feature('python', { dir: '/path/to/project' })\nawait python.enable()\nawait python.startSession()\nawait python.run('x = 42')\nconst result = await python.run('print(x)')\nconsole.log(result.stdout) // '42\\n'\nawait python.stopSession()"
          }
        ]
      },
      "stopSession": {
        "description": "Stops the persistent Python session and cleans up the bridge process.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await python.stopSession()"
          }
        ]
      },
      "run": {
        "description": "Executes Python code in the persistent session. Variables and imports survive across calls. This is the session equivalent of execute().",
        "parameters": {
          "code": {
            "type": "string",
            "description": "Python code to execute"
          },
          "variables": {
            "type": "Record<string, any>",
            "description": "Variables to inject into the namespace before execution"
          }
        },
        "required": [
          "code"
        ],
        "returns": "Promise<RunResult>",
        "examples": [
          {
            "language": "ts",
            "code": "await python.startSession()\n\n// State persists across calls\nawait python.run('x = 42')\nconst result = await python.run('print(x * 2)')\nconsole.log(result.stdout) // '84\\n'\n\n// Inject variables from JS\nconst result2 = await python.run('print(f\"Hello {name}!\")', { name: 'World' })\nconsole.log(result2.stdout) // 'Hello World!\\n'"
          }
        ]
      },
      "eval": {
        "description": "Evaluates a Python expression in the persistent session and returns its value.",
        "parameters": {
          "expression": {
            "type": "string",
            "description": "Python expression to evaluate"
          }
        },
        "required": [
          "expression"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "await python.run('x = 42')\nconst result = await python.eval('x * 2')\nconsole.log(result) // 84"
          }
        ]
      },
      "importModule": {
        "description": "Imports a Python module into the persistent session namespace.",
        "parameters": {
          "moduleName": {
            "type": "string",
            "description": "Dotted module path (e.g. 'myapp.models')"
          },
          "alias": {
            "type": "string",
            "description": "Optional alias for the import (defaults to the last segment)"
          }
        },
        "required": [
          "moduleName"
        ],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await python.importModule('json')\nawait python.importModule('myapp.models', 'models')\nconst result = await python.eval('models.User')"
          }
        ]
      },
      "call": {
        "description": "Calls a function by dotted path in the persistent session namespace.",
        "parameters": {
          "funcPath": {
            "type": "string",
            "description": "Dotted path to the function (e.g. 'json.dumps' or 'my_func')"
          },
          "args": {
            "type": "any[]",
            "description": "Positional arguments"
          },
          "kwargs": {
            "type": "Record<string, any>",
            "description": "Keyword arguments"
          }
        },
        "required": [
          "funcPath"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "await python.importModule('json')\nconst result = await python.call('json.dumps', [{ a: 1 }], { indent: 2 })"
          }
        ]
      },
      "getLocals": {
        "description": "Returns all non-dunder variables from the persistent session namespace.",
        "parameters": {},
        "required": [],
        "returns": "Promise<Record<string, any>>",
        "examples": [
          {
            "language": "ts",
            "code": "await python.run('x = 42\\ny = \"hello\"')\nconst locals = await python.getLocals()\nconsole.log(locals) // { x: 42, y: 'hello' }"
          }
        ]
      },
      "resetSession": {
        "description": "Clears all variables and imports from the persistent session namespace. The session remains active — you can continue calling run() after reset.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "await python.run('x = 42')\nawait python.resetSession()\n// x is now undefined"
          }
        ]
      }
    },
    "getters": {
      "projectDir": {
        "description": "Returns the root directory of the Python project.",
        "returns": "any"
      },
      "pythonPath": {
        "description": "Returns the path to the Python executable for this environment.",
        "returns": "any"
      },
      "environmentType": {
        "description": "Returns the detected environment type: 'uv', 'conda', 'venv', or 'system'.",
        "returns": "any"
      }
    },
    "events": {
      "ready": {
        "name": "ready",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "environmentDetected": {
        "name": "environmentDetected",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "installingDependencies": {
        "name": "installingDependencies",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "dependenciesInstalled": {
        "name": "dependenciesInstalled",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "dependencyInstallFailed": {
        "name": "dependencyInstallFailed",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "localsParseError": {
        "name": "localsParseError",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "codeExecuted": {
        "name": "codeExecuted",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "fileExecuted": {
        "name": "fileExecuted",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "sessionError": {
        "name": "sessionError",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "sessionStarted": {
        "name": "sessionStarted",
        "description": "Event emitted by Python",
        "arguments": {}
      },
      "sessionStopped": {
        "name": "sessionStopped",
        "description": "Event emitted by Python",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const python = container.feature('python', {\n dir: \"/path/to/python/project\",\n})\n\n// Stateless execution\nconst result = await python.execute('print(\"Hello from Python!\")')\n\n// Persistent session\nawait python.startSession()\nawait python.run('import myapp.models')\nawait python.run('users = myapp.models.User.objects.all()')\nconst result = await python.run('print(len(users))')\nawait python.stopSession()"
      }
    ],
    "types": {
      "RunResult": {
        "description": "Result from a persistent session run() call.",
        "properties": {
          "ok": {
            "type": "boolean",
            "description": ""
          },
          "result": {
            "type": "any",
            "description": ""
          },
          "stdout": {
            "type": "string",
            "description": ""
          },
          "error": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "traceback": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.jsonTree",
    "description": "JsonTree Feature - A powerful JSON file tree loader and processor This feature provides functionality to recursively load JSON files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive JSON file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Native JSON parsing for optimal performance **Path Processing:** Files are processed to create a nested object structure: - Directory names become object properties (camelCased) - File names become the final property names (without .json extension) - Nested directories create nested objects **Usage Example:** ```typescript const jsonTree = container.feature('jsonTree', { enable: true }); await jsonTree.loadTree('data', 'appData'); const userData = jsonTree.tree.appData.users.profiles; ``` **Directory Structure Example:** ``` data/ users/ profiles.json    -> tree.data.users.profiles settings.json    -> tree.data.users.settings config/ app-config.json  -> tree.data.config.appConfig ```",
    "shortcut": "features.jsonTree",
    "className": "JsonTree",
    "methods": {
      "loadTree": {
        "description": "Loads a tree of JSON files from the specified base path and stores them in state. This method recursively scans the provided directory for JSON files, processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Processing Steps:** 1. Uses FileManager to discover all .json files recursively 2. Reads each file's content using the file system feature 3. Parses JSON content using native JSON.parse() 4. Converts file paths to nested object properties 5. Stores the complete tree in feature state **Path Transformation:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes .json file extension **Example Transformation:** ``` config/ database/ production.json  -> tree.config.database.production staging.json     -> tree.config.database.staging api/ endpoints.json   -> tree.config.api.endpoints ```",
        "parameters": {
          "basePath": {
            "type": "string",
            "description": "The root directory path to scan for JSON files"
          },
          "key": {
            "type": "string",
            "description": "The key to store the tree under in state (defaults to first segment of basePath)"
          }
        },
        "required": [
          "basePath"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "// Load all JSON files from 'data' directory into state.data\nawait jsonTree.loadTree('data');\n\n// Load with custom key\nawait jsonTree.loadTree('app/config', 'configuration');\n\n// Access the loaded data\nconst dbConfig = jsonTree.tree.data.database.production;\nconst apiEndpoints = jsonTree.tree.data.api.endpoints;"
          }
        ]
      }
    },
    "getters": {
      "tree": {
        "description": "Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the JSON tree data that has been loaded through loadTree().",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "await jsonTree.loadTree('data');\nawait jsonTree.loadTree('config', 'appConfig');\n\nconst allTrees = jsonTree.tree;\n// Returns: { \n//   data: { users: { ... }, products: { ... } },\n//   appConfig: { database: { ... }, api: { ... } }\n// }\n\n// Access specific trees\nconst userData = jsonTree.tree.data.users;\nconst dbConfig = jsonTree.tree.appConfig.database;"
          }
        ]
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.packageFinder",
    "description": "PackageFinder Feature - Comprehensive package discovery and analysis tool This feature provides powerful capabilities for discovering, indexing, and analyzing npm packages across the entire project workspace. It recursively scans all node_modules directories and builds a comprehensive index of packages, enabling: **Core Functionality:** - Recursive node_modules scanning across the workspace - Package manifest parsing and indexing - Duplicate package detection and analysis - Dependency relationship mapping - Scoped package organization (@scope/package) - Package count and statistics **Use Cases:** - Dependency auditing and analysis - Duplicate package identification - Package version conflict detection - Dependency tree analysis - Workspace package inventory **Performance Features:** - Parallel manifest reading for fast scanning - Efficient duplicate detection using unique paths - Lazy initialization - only scans when started - In-memory indexing for fast queries **Usage Example:** ```typescript const finder = container.feature('packageFinder'); await finder.start(); // Find duplicates console.log('Duplicate packages:', finder.duplicates); // Find package by name const lodash = finder.findByName('lodash'); // Find dependents of a package const dependents = finder.findDependentsOf('react'); ```",
    "shortcut": "features.packageFinder",
    "className": "PackageFinder",
    "methods": {
      "afterInitialize": {
        "description": "Initializes the feature state after construction. Sets the started flag to false, indicating the initial scan hasn't completed.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "addPackage": {
        "description": "Adds a package manifest to the internal index. This method ensures uniqueness based on file path and maintains an array of all versions/instances of each package found across the workspace. Packages with the same name but different paths (versions) are tracked separately.",
        "parameters": {
          "manifest": {
            "type": "PartialManifest",
            "description": "The package manifest data from package.json",
            "properties": {
              "name": {
                "type": "string",
                "description": "The package name (e.g., 'lodash', '@types/node')"
              },
              "version": {
                "type": "string",
                "description": "The package version (e.g., '1.0.0', '^2.1.3')"
              },
              "description": {
                "type": "string",
                "description": "Optional package description"
              },
              "dependencies": {
                "type": "Record<string, Record<string,string>>",
                "description": "Runtime dependencies with version constraints"
              },
              "devDependencies": {
                "type": "Record<string, Record<string,string>>",
                "description": "Development dependencies with version constraints"
              },
              "peerDependencies": {
                "type": "Record<string, Record<string,string>>",
                "description": "Peer dependencies with version constraints"
              },
              "optionalDependencies": {
                "type": "Record<string, Record<string,string>>",
                "description": "Optional dependencies with version constraints"
              }
            }
          },
          "path": {
            "type": "string",
            "description": "The file system path to the package.json file"
          }
        },
        "required": [
          "manifest",
          "path"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "finder.addPackage({\n name: 'lodash',\n version: '4.17.21',\n description: 'A modern JavaScript utility library'\n}, '/project/node_modules/lodash/package.json');"
          }
        ]
      },
      "start": {
        "description": "Starts the package finder and performs the initial workspace scan. This method is idempotent - calling it multiple times will not re-scan if already started. It triggers the complete workspace scanning process.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this | undefined>",
        "examples": [
          {
            "language": "ts",
            "code": "await finder.start();\nconsole.log(`Found ${finder.packageNames.length} unique packages`);"
          }
        ]
      },
      "scan": {
        "description": "Performs a comprehensive scan of all node_modules directories in the workspace. This method orchestrates the complete scanning process: 1. Discovers all node_modules directories recursively 2. Finds all package directories (including scoped packages) 3. Reads and parses all package.json files in parallel 4. Indexes all packages for fast querying The scan is performed in parallel for optimal performance, reading multiple package.json files simultaneously.",
        "parameters": {
          "options": {
            "type": "{ exclude?: string | string[] }",
            "description": "Scanning options (currently unused)",
            "properties": {
              "exclude": {
                "type": "any",
                "description": "Optional exclusion patterns (not implemented)"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<this>",
        "examples": [
          {
            "language": "ts",
            "code": "// Manual scan (usually called automatically by start())\nawait finder.scan();\n\n// Check results\nconsole.log(`Scanned ${finder.manifests.length} packages`);"
          }
        ]
      },
      "findByName": {
        "description": "Finds the first package manifest matching the given name. If multiple versions of the package exist, returns the first one found. Use the packages property directly if you need all versions.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The exact package name to search for"
          }
        },
        "required": [
          "name"
        ],
        "returns": "PartialManifest | undefined",
        "examples": [
          {
            "language": "ts",
            "code": "const lodash = finder.findByName('lodash');\nif (lodash) {\n console.log(`Found lodash version ${lodash.version}`);\n}"
          }
        ]
      },
      "findDependentsOf": {
        "description": "Finds all packages that declare the specified package as a dependency. Searches through dependencies and devDependencies of all packages to find which ones depend on the target package. Useful for impact analysis when considering package updates or removals.",
        "parameters": {
          "packageName": {
            "type": "string",
            "description": "The name of the package to find dependents for"
          }
        },
        "required": [
          "packageName"
        ],
        "returns": "PartialManifest[]",
        "examples": [
          {
            "language": "ts",
            "code": "const reactDependents = finder.findDependentsOf('react');\nconsole.log(`${reactDependents.length} packages depend on React:`);\nreactDependents.forEach(pkg => {\n console.log(`- ${pkg.name}@${pkg.version}`);\n});"
          }
        ]
      },
      "find": {
        "description": "Finds the first package manifest matching the provided filter function.",
        "parameters": {
          "filter": {
            "type": "(manifest: PartialManifest) => boolean",
            "description": "Function that returns true for matching packages"
          }
        },
        "required": [
          "filter"
        ],
        "returns": "PartialManifest | undefined",
        "examples": [
          {
            "language": "ts",
            "code": "// Find a package with specific version\nconst specific = finder.find(pkg => pkg.name === 'lodash' && pkg.version.startsWith('4.'));\n\n// Find a package with description containing keyword\nconst utility = finder.find(pkg => pkg.description?.includes('utility'));"
          }
        ]
      },
      "filter": {
        "description": "Finds all package manifests matching the provided filter function.",
        "parameters": {
          "filter": {
            "type": "(manifest: PartialManifest) => boolean",
            "description": "Function that returns true for matching packages"
          }
        },
        "required": [
          "filter"
        ],
        "returns": "PartialManifest[]",
        "examples": [
          {
            "language": "ts",
            "code": "// Find all packages with 'babel' in the name\nconst babelPackages = finder.filter(pkg => pkg.name.includes('babel'));\n\n// Find all packages with no description\nconst undocumented = finder.filter(pkg => !pkg.description);\n\n// Find all scoped packages\nconst scoped = finder.filter(pkg => pkg.name.startsWith('@'));"
          }
        ]
      },
      "exclude": {
        "description": "Returns all packages that do NOT match the provided filter function. This is the inverse of filter() - returns packages where filter returns false.",
        "parameters": {
          "filter": {
            "type": "(manifest: PartialManifest) => boolean",
            "description": "Function that returns true for packages to exclude"
          }
        },
        "required": [
          "filter"
        ],
        "returns": "PartialManifest[]",
        "examples": [
          {
            "language": "ts",
            "code": "// Get all non-development packages (those not in devDependencies)\nconst prodPackages = finder.exclude(pkg => isDevDependency(pkg.name));\n\n// Get all non-scoped packages\nconst unscoped = finder.exclude(pkg => pkg.name.startsWith('@'));"
          }
        ]
      },
      "findLocalPackageFolders": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>"
      }
    },
    "getters": {
      "duplicates": {
        "description": "Gets a list of package names that have multiple versions/instances installed. This is useful for identifying potential dependency conflicts or opportunities for deduplication in the project.",
        "returns": "string[]",
        "examples": [
          {
            "language": "ts",
            "code": "const duplicates = finder.duplicates;\n// ['lodash', 'react', '@types/node'] - packages with multiple versions\n\nduplicates.forEach(name => {\n console.log(`${name} has ${finder.packages[name].length} versions`);\n});"
          }
        ]
      },
      "isStarted": {
        "description": "Checks if the package finder has completed its initial scan.",
        "returns": "boolean"
      },
      "packageNames": {
        "description": "Gets an array of all unique package names discovered in the workspace.",
        "returns": "string[]",
        "examples": [
          {
            "language": "ts",
            "code": "const names = finder.packageNames;\nconsole.log(`Found ${names.length} unique packages`);"
          }
        ]
      },
      "scopes": {
        "description": "Gets an array of all scoped package prefixes found in the workspace. Scoped packages are those starting with '@' (e.g., @types/node, @babel/core). This returns just the scope part (e.g., '@types', '@babel').",
        "returns": "string[]",
        "examples": [
          {
            "language": "ts",
            "code": "const scopes = finder.scopes;\n// ['@types', '@babel', '@angular'] - all scopes in use\n\nscopes.forEach(scope => {\n const scopedPackages = finder.packageNames.filter(name => name.startsWith(scope));\n console.log(`${scope}: ${scopedPackages.length} packages`);\n});"
          }
        ]
      },
      "manifests": {
        "description": "Gets a flat array of all package manifests found in the workspace. This includes all versions/instances of packages, unlike packageNames which returns unique names only.",
        "returns": "(PartialManifest & { __path: string })[]",
        "examples": [
          {
            "language": "ts",
            "code": "const all = finder.manifests;\nconsole.log(`Total package instances: ${all.length}`);\n\n// Group by name to see duplicates\nconst grouped = all.reduce((acc, pkg) => {\n acc[pkg.name] = (acc[pkg.name] || 0) + 1;\n return acc;\n}, {});"
          }
        ]
      },
      "counts": {
        "description": "Gets a count of instances for each package name. Useful for quickly identifying which packages have multiple versions and how many instances of each exist.",
        "returns": "Record<string, number>",
        "examples": [
          {
            "language": "ts",
            "code": "const counts = finder.counts;\n// { 'lodash': 3, 'react': 2, 'express': 1 }\n\nObject.entries(counts)\n .filter(([name, count]) => count > 1)\n .forEach(([name, count]) => {\n   console.log(`${name}: ${count} versions installed`);\n });"
          }
        ]
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "types": {
      "PartialManifest": {
        "description": "Partial representation of a package.json manifest file. Contains the most commonly used fields for package analysis and dependency management.",
        "properties": {
          "name": {
            "type": "string",
            "description": "The package name (e.g., 'lodash', '@types/node')"
          },
          "version": {
            "type": "string",
            "description": "The package version (e.g., '1.0.0', '^2.1.3')"
          },
          "description": {
            "type": "string",
            "description": "Optional package description",
            "optional": true
          },
          "dependencies": {
            "type": "Record<string, Record<string,string>>",
            "description": "Runtime dependencies with version constraints",
            "optional": true
          },
          "devDependencies": {
            "type": "Record<string, Record<string,string>>",
            "description": "Development dependencies with version constraints",
            "optional": true
          },
          "peerDependencies": {
            "type": "Record<string, Record<string,string>>",
            "description": "Peer dependencies with version constraints",
            "optional": true
          },
          "optionalDependencies": {
            "type": "Record<string, Record<string,string>>",
            "description": "Optional dependencies with version constraints",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.processManager",
    "description": "Manages long-running child processes with tracking, events, and automatic cleanup. Unlike the `proc` feature whose spawn methods block until the child exits, ProcessManager returns a SpawnHandler immediately — a handle object with its own state, events, and lifecycle methods. The feature tracks all spawned processes, maintains observable state, and can automatically kill them on parent exit. Each handler maintains a memory-efficient output buffer: the first 20 lines (head) and last 50 lines (tail) of stdout/stderr are kept, everything in between is discarded.",
    "shortcut": "features.processManager",
    "className": "ProcessManager",
    "methods": {
      "spawnProcess": {
        "description": "Tool handler: spawn a long-running background process.",
        "parameters": {
          "args": {
            "type": "{ command: string; args?: string; tag?: string; cwd?: string }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "runCommand": {
        "description": "Tool handler: run a command to completion and return its output.",
        "parameters": {
          "args": {
            "type": "{ command: string; cwd?: string }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "listProcesses": {
        "description": "Tool handler: list all tracked processes.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "getProcessOutput": {
        "description": "Tool handler: peek at a process's buffered output.",
        "parameters": {
          "args": {
            "type": "{ id?: string; tag?: string; stream?: string }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "killProcess": {
        "description": "Tool handler: kill a process by ID or tag.",
        "parameters": {
          "args": {
            "type": "{ id?: string; tag?: string; signal?: string }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "setupToolsConsumer": {
        "description": "When an assistant uses processManager, inject system prompt guidance about how to manage processes safely and effectively.",
        "parameters": {
          "consumer": {
            "type": "Helper",
            "description": "Parameter consumer"
          }
        },
        "required": [
          "consumer"
        ],
        "returns": "void"
      },
      "spawn": {
        "description": "Spawn a long-running process and return a handle immediately. The returned SpawnHandler provides events for stdout/stderr streaming, exit/crash notifications, and methods to kill or await the process.",
        "parameters": {
          "command": {
            "type": "string",
            "description": "The command to execute (e.g. 'node', 'bun', 'python')"
          },
          "args": {
            "type": "string[]",
            "description": "Arguments to pass to the command"
          },
          "options": {
            "type": "SpawnOptions",
            "description": "Spawn configuration",
            "properties": {
              "tag": {
                "type": "string",
                "description": "User-defined tag for later lookups via getByTag()"
              },
              "cwd": {
                "type": "string",
                "description": "Working directory for the spawned process (defaults to container cwd)"
              },
              "env": {
                "type": "Record<string, string>",
                "description": "Additional environment variables merged with process.env"
              },
              "stdin": {
                "type": "'pipe' | 'inherit' | 'ignore' | null",
                "description": "stdin mode: 'pipe' to write to the process, 'inherit', or 'ignore' (default: 'ignore')"
              },
              "stdout": {
                "type": "'pipe' | 'inherit' | 'ignore' | null",
                "description": "stdout mode: 'pipe' to capture output, 'inherit', or 'ignore' (default: 'pipe')"
              },
              "stderr": {
                "type": "'pipe' | 'inherit' | 'ignore' | null",
                "description": "stderr mode: 'pipe' to capture errors, 'inherit', or 'ignore' (default: 'pipe')"
              }
            }
          }
        },
        "required": [
          "command"
        ],
        "returns": "SpawnHandler"
      },
      "get": {
        "description": "Get a SpawnHandler by its unique ID.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The process ID returned by spawn"
          }
        },
        "required": [
          "id"
        ],
        "returns": "SpawnHandler | undefined"
      },
      "getByTag": {
        "description": "Find a SpawnHandler by its user-defined tag.",
        "parameters": {
          "tag": {
            "type": "string",
            "description": "The tag passed to spawn()"
          }
        },
        "required": [
          "tag"
        ],
        "returns": "SpawnHandler | undefined"
      },
      "list": {
        "description": "List all tracked SpawnHandlers (running and finished).",
        "parameters": {},
        "required": [],
        "returns": "SpawnHandler[]"
      },
      "killAll": {
        "description": "Kill all running processes.",
        "parameters": {
          "signal": {
            "type": "NodeJS.Signals | number",
            "description": "Signal to send (default: SIGTERM)"
          }
        },
        "required": [],
        "returns": "void"
      },
      "stop": {
        "description": "Stop the process manager: kill all running processes and remove cleanup handlers.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "remove": {
        "description": "Remove a finished handler from tracking.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The process ID to remove"
          }
        },
        "required": [
          "id"
        ],
        "returns": "boolean"
      },
      "enable": {
        "description": "",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "_onHandlerDone": {
        "description": "Called by SpawnHandler when a process finishes. Updates feature-level state.",
        "parameters": {
          "handler": {
            "type": "SpawnHandler",
            "description": "Parameter handler"
          },
          "status": {
            "type": "'exited' | 'crashed' | 'killed'",
            "description": "Parameter status"
          },
          "exitCode": {
            "type": "number",
            "description": "Parameter exitCode"
          }
        },
        "required": [
          "handler",
          "status"
        ],
        "returns": "void"
      }
    },
    "getters": {},
    "events": {
      "spawned": {
        "name": "spawned",
        "description": "Event emitted by ProcessManager",
        "arguments": {}
      },
      "exited": {
        "name": "exited",
        "description": "Event emitted by ProcessManager",
        "arguments": {}
      },
      "crashed": {
        "name": "crashed",
        "description": "Event emitted by ProcessManager",
        "arguments": {}
      },
      "killed": {
        "name": "killed",
        "description": "Event emitted by ProcessManager",
        "arguments": {}
      },
      "allStopped": {
        "name": "allStopped",
        "description": "Event emitted by ProcessManager",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const pm = container.feature('processManager', { enable: true })\n\nconst server = pm.spawn('node', ['server.js'], { tag: 'api', cwd: '/app' })\nserver.on('stdout', (data) => console.log('[api]', data))\nserver.on('crash', (code) => console.error('API crashed:', code))\n\n// Peek at buffered output\nconst { head, tail } = server.peek()\n\n// Kill one\nserver.kill()\n\n// Kill all tracked processes\npm.killAll()\n\n// List and lookup\npm.list()              // SpawnHandler[]\npm.getByTag('api')     // SpawnHandler | undefined"
      }
    ],
    "types": {
      "SpawnOptions": {
        "description": "",
        "properties": {
          "tag": {
            "type": "string",
            "description": "User-defined tag for later lookups via getByTag()",
            "optional": true
          },
          "cwd": {
            "type": "string",
            "description": "Working directory for the spawned process (defaults to container cwd)",
            "optional": true
          },
          "env": {
            "type": "Record<string, string>",
            "description": "Additional environment variables merged with process.env",
            "optional": true
          },
          "stdin": {
            "type": "'pipe' | 'inherit' | 'ignore' | null",
            "description": "stdin mode: 'pipe' to write to the process, 'inherit', or 'ignore' (default: 'ignore')",
            "optional": true
          },
          "stdout": {
            "type": "'pipe' | 'inherit' | 'ignore' | null",
            "description": "stdout mode: 'pipe' to capture output, 'inherit', or 'ignore' (default: 'pipe')",
            "optional": true
          },
          "stderr": {
            "type": "'pipe' | 'inherit' | 'ignore' | null",
            "description": "stderr mode: 'pipe' to capture errors, 'inherit', or 'ignore' (default: 'pipe')",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.googleSheets",
    "description": "Google Sheets feature for reading spreadsheet data as JSON, CSV, or raw arrays. Depends on the googleAuth feature for authentication. Creates a Sheets v4 API client lazily and provides convenient methods for reading tabular data.",
    "shortcut": "features.googleSheets",
    "className": "GoogleSheets",
    "methods": {
      "getSpreadsheet": {
        "description": "Get spreadsheet metadata including title, locale, and sheet list.",
        "parameters": {
          "spreadsheetId": {
            "type": "string",
            "description": "The spreadsheet ID (defaults to options.defaultSpreadsheetId)"
          }
        },
        "required": [],
        "returns": "Promise<SpreadsheetMeta>"
      },
      "listSheets": {
        "description": "List all sheets (tabs) in a spreadsheet.",
        "parameters": {
          "spreadsheetId": {
            "type": "string",
            "description": "The spreadsheet ID"
          }
        },
        "required": [],
        "returns": "Promise<SheetInfo[]>"
      },
      "getRange": {
        "description": "Read a range of values from a sheet.",
        "parameters": {
          "range": {
            "type": "string",
            "description": "A1 notation range (e.g. \"Sheet1!A1:D10\" or \"Sheet1\" for entire sheet)"
          },
          "spreadsheetId": {
            "type": "string",
            "description": "The spreadsheet ID"
          }
        },
        "required": [
          "range"
        ],
        "returns": "Promise<string[][]>"
      },
      "getAsJson": {
        "description": "Read a sheet as an array of JSON objects. The first row is treated as headers; subsequent rows become objects keyed by those headers.",
        "parameters": {
          "sheetName": {
            "type": "string",
            "description": "Name of the sheet tab (if omitted, reads the first sheet)"
          },
          "spreadsheetId": {
            "type": "string",
            "description": "The spreadsheet ID"
          }
        },
        "required": [],
        "returns": "Promise<T[]>"
      },
      "getAsCsv": {
        "description": "Read a sheet and return it as a CSV string.",
        "parameters": {
          "sheetName": {
            "type": "string",
            "description": "Name of the sheet tab (if omitted, reads the first sheet)"
          },
          "spreadsheetId": {
            "type": "string",
            "description": "The spreadsheet ID"
          }
        },
        "required": [],
        "returns": "Promise<string>"
      },
      "saveAsJson": {
        "description": "Download sheet data as JSON and save to a local file.",
        "parameters": {
          "localPath": {
            "type": "string",
            "description": "Local file path (resolved relative to container cwd)"
          },
          "sheetName": {
            "type": "string",
            "description": "Sheet tab name (defaults to first sheet)"
          },
          "spreadsheetId": {
            "type": "string",
            "description": "The spreadsheet ID"
          }
        },
        "required": [
          "localPath"
        ],
        "returns": "Promise<string>"
      },
      "saveAsCsv": {
        "description": "Download sheet data as CSV and save to a local file.",
        "parameters": {
          "localPath": {
            "type": "string",
            "description": "Local file path (resolved relative to container cwd)"
          },
          "sheetName": {
            "type": "string",
            "description": "Sheet tab name (defaults to first sheet)"
          },
          "spreadsheetId": {
            "type": "string",
            "description": "The spreadsheet ID"
          }
        },
        "required": [
          "localPath"
        ],
        "returns": "Promise<string>"
      }
    },
    "getters": {
      "auth": {
        "description": "Access the google-auth feature lazily.",
        "returns": "GoogleAuth"
      }
    },
    "events": {
      "error": {
        "name": "error",
        "description": "Event emitted by GoogleSheets",
        "arguments": {}
      },
      "dataFetched": {
        "name": "dataFetched",
        "description": "Event emitted by GoogleSheets",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const sheets = container.feature('googleSheets', {\n defaultSpreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'\n})\n\n// Read as JSON objects (first row = headers)\nconst data = await sheets.getAsJson('Sheet1')\n// => [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]\n\n// Read as CSV string\nconst csv = await sheets.getAsCsv('Revenue')\n\n// Read a specific range\nconst values = await sheets.getRange('Sheet1!A1:D10')\n\n// Save to file\nawait sheets.saveAsJson('./data/export.json')"
      }
    ],
    "types": {
      "SpreadsheetMeta": {
        "description": "",
        "properties": {
          "spreadsheetId": {
            "type": "string",
            "description": ""
          },
          "title": {
            "type": "string",
            "description": ""
          },
          "locale": {
            "type": "string",
            "description": ""
          },
          "sheets": {
            "type": "SheetInfo[]",
            "description": ""
          }
        }
      },
      "SheetInfo": {
        "description": "",
        "properties": {
          "sheetId": {
            "type": "number",
            "description": ""
          },
          "title": {
            "type": "string",
            "description": ""
          },
          "index": {
            "type": "number",
            "description": ""
          },
          "rowCount": {
            "type": "number",
            "description": ""
          },
          "columnCount": {
            "type": "number",
            "description": ""
          }
        }
      }
    }
  },
  {
    "id": "features.secureShell",
    "description": "SecureShell Feature -- SSH command execution and SCP file transfers. Uses the system `ssh` and `scp` binaries to run commands on remote hosts and transfer files. Supports key-based and password-based authentication through the container's `proc` feature.",
    "shortcut": "features.secureShell",
    "className": "SecureShell",
    "methods": {
      "testConnection": {
        "description": "Test the SSH connection by running a simple echo command on the remote host. Updates `state.connected` based on the result.",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })\nconst ok = await ssh.testConnection()\nif (!ok) console.error('SSH connection failed')"
          }
        ]
      },
      "exec": {
        "description": "Executes a command on the remote host.",
        "parameters": {
          "command": {
            "type": "string",
            "description": "The command to execute on the remote shell"
          }
        },
        "required": [
          "command"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })\nconst listing = await ssh.exec('ls -la /var/log')\nconsole.log(listing)"
          }
        ]
      },
      "download": {
        "description": "Downloads a file from the remote host via SCP.",
        "parameters": {
          "source": {
            "type": "string",
            "description": "The source file path on the remote host"
          },
          "target": {
            "type": "string",
            "description": "The target file path on the local machine"
          }
        },
        "required": [
          "source",
          "target"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })\nawait ssh.download('/var/log/app.log', './logs/app.log')"
          }
        ]
      },
      "upload": {
        "description": "Uploads a file to the remote host via SCP.",
        "parameters": {
          "source": {
            "type": "string",
            "description": "The source file path on the local machine"
          },
          "target": {
            "type": "string",
            "description": "The target file path on the remote host"
          }
        },
        "required": [
          "source",
          "target"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })\nawait ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')"
          }
        ]
      }
    },
    "getters": {
      "sshPath": {
        "description": "Resolved path to the ssh binary",
        "returns": "string"
      },
      "scpPath": {
        "description": "Resolved path to the scp binary",
        "returns": "string"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const ssh = container.feature('secureShell', {\n host: '192.168.1.100',\n username: 'deploy',\n key: '~/.ssh/id_ed25519',\n})\n\nif (await ssh.testConnection()) {\n const uptime = await ssh.exec('uptime')\n console.log(uptime)\n}"
      }
    ]
  },
  {
    "id": "features.semanticSearch",
    "description": "Semantic search feature providing BM25 keyword search, vector similarity search, and hybrid search with Reciprocal Rank Fusion over a SQLite-backed index. Uses bun:sqlite for FTS5 keyword search and BLOB-stored embeddings with JavaScript cosine similarity for vector search.",
    "shortcut": "features.semanticSearch",
    "className": "SemanticSearch",
    "methods": {
      "initDb": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "insertDocument": {
        "description": "",
        "parameters": {
          "doc": {
            "type": "DocumentInput",
            "description": "Parameter doc",
            "properties": {
              "pathId": {
                "type": "string",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "title": {
                "type": "string",
                "description": ""
              },
              "slug": {
                "type": "string",
                "description": ""
              },
              "meta": {
                "type": "Record<string, any>",
                "description": ""
              },
              "content": {
                "type": "string",
                "description": ""
              },
              "sections": {
                "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
                "description": ""
              }
            }
          }
        },
        "required": [
          "doc"
        ],
        "returns": "void"
      },
      "insertChunk": {
        "description": "",
        "parameters": {
          "chunk": {
            "type": "Chunk",
            "description": "Parameter chunk",
            "properties": {
              "pathId": {
                "type": "string",
                "description": ""
              },
              "section": {
                "type": "string",
                "description": ""
              },
              "headingPath": {
                "type": "string",
                "description": ""
              },
              "seq": {
                "type": "number",
                "description": ""
              },
              "content": {
                "type": "string",
                "description": ""
              },
              "contentHash": {
                "type": "string",
                "description": ""
              }
            }
          },
          "embedding": {
            "type": "Float32Array",
            "description": "Parameter embedding"
          }
        },
        "required": [
          "chunk",
          "embedding"
        ],
        "returns": "void"
      },
      "removeDocument": {
        "description": "",
        "parameters": {
          "pathId": {
            "type": "string",
            "description": "Parameter pathId"
          }
        },
        "required": [
          "pathId"
        ],
        "returns": "void"
      },
      "getStats": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "IndexStatus"
      },
      "embed": {
        "description": "",
        "parameters": {
          "texts": {
            "type": "string[]",
            "description": "Parameter texts"
          }
        },
        "required": [
          "texts"
        ],
        "returns": "Promise<number[][]>"
      },
      "ensureModel": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "disposeModel": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "getDimensions": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "number"
      },
      "chunkDocument": {
        "description": "",
        "parameters": {
          "doc": {
            "type": "DocumentInput",
            "description": "Parameter doc",
            "properties": {
              "pathId": {
                "type": "string",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "title": {
                "type": "string",
                "description": ""
              },
              "slug": {
                "type": "string",
                "description": ""
              },
              "meta": {
                "type": "Record<string, any>",
                "description": ""
              },
              "content": {
                "type": "string",
                "description": ""
              },
              "sections": {
                "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
                "description": ""
              }
            }
          },
          "strategy": {
            "type": "'section' | 'fixed' | 'document'",
            "description": "Parameter strategy"
          }
        },
        "required": [
          "doc"
        ],
        "returns": "Chunk[]"
      },
      "search": {
        "description": "",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Parameter query"
          },
          "options": {
            "type": "SearchOptions",
            "description": "Parameter options",
            "properties": {
              "limit": {
                "type": "number",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "where": {
                "type": "Record<string, any>",
                "description": ""
              }
            }
          }
        },
        "required": [
          "query"
        ],
        "returns": "Promise<SearchResult[]>"
      },
      "vectorSearch": {
        "description": "",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Parameter query"
          },
          "options": {
            "type": "SearchOptions",
            "description": "Parameter options",
            "properties": {
              "limit": {
                "type": "number",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "where": {
                "type": "Record<string, any>",
                "description": ""
              }
            }
          }
        },
        "required": [
          "query"
        ],
        "returns": "Promise<SearchResult[]>"
      },
      "hybridSearch": {
        "description": "",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Parameter query"
          },
          "options": {
            "type": "HybridSearchOptions",
            "description": "Parameter options",
            "properties": {
              "ftsWeight": {
                "type": "number",
                "description": ""
              },
              "vecWeight": {
                "type": "number",
                "description": ""
              }
            }
          }
        },
        "required": [
          "query"
        ],
        "returns": "Promise<SearchResult[]>"
      },
      "deepSearch": {
        "description": "",
        "parameters": {
          "_query": {
            "type": "string",
            "description": "Parameter _query"
          },
          "_options": {
            "type": "SearchOptions",
            "description": "Parameter _options",
            "properties": {
              "limit": {
                "type": "number",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "where": {
                "type": "Record<string, any>",
                "description": ""
              }
            }
          }
        },
        "required": [
          "_query"
        ],
        "returns": "Promise<SearchResult[]>"
      },
      "indexDocuments": {
        "description": "",
        "parameters": {
          "docs": {
            "type": "DocumentInput[]",
            "description": "Parameter docs",
            "properties": {
              "pathId": {
                "type": "string",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "title": {
                "type": "string",
                "description": ""
              },
              "slug": {
                "type": "string",
                "description": ""
              },
              "meta": {
                "type": "Record<string, any>",
                "description": ""
              },
              "content": {
                "type": "string",
                "description": ""
              },
              "sections": {
                "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
                "description": ""
              }
            }
          }
        },
        "required": [
          "docs"
        ],
        "returns": "Promise<void>"
      },
      "reindex": {
        "description": "",
        "parameters": {
          "pathIds": {
            "type": "string[]",
            "description": "Parameter pathIds"
          }
        },
        "required": [],
        "returns": "Promise<void>"
      },
      "removeStale": {
        "description": "",
        "parameters": {
          "currentPathIds": {
            "type": "string[]",
            "description": "Parameter currentPathIds"
          }
        },
        "required": [
          "currentPathIds"
        ],
        "returns": "void"
      },
      "needsReindex": {
        "description": "",
        "parameters": {
          "doc": {
            "type": "DocumentInput",
            "description": "Parameter doc",
            "properties": {
              "pathId": {
                "type": "string",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "title": {
                "type": "string",
                "description": ""
              },
              "slug": {
                "type": "string",
                "description": ""
              },
              "meta": {
                "type": "Record<string, any>",
                "description": ""
              },
              "content": {
                "type": "string",
                "description": ""
              },
              "sections": {
                "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
                "description": ""
              }
            }
          }
        },
        "required": [
          "doc"
        ],
        "returns": "boolean"
      },
      "status": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "IndexStatus"
      },
      "installLocalEmbeddings": {
        "description": "Install node-llama-cpp into the user's project for local embedding support. Detects package manager from lockfile presence and verifies the native addon loads.",
        "parameters": {
          "cwd": {
            "type": "string",
            "description": "Parameter cwd"
          }
        },
        "required": [
          "cwd"
        ],
        "returns": "Promise<void>"
      },
      "close": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      }
    },
    "getters": {
      "db": {
        "description": "",
        "returns": "Database"
      },
      "dimensions": {
        "description": "",
        "returns": "number"
      }
    },
    "events": {
      "dbReady": {
        "name": "dbReady",
        "description": "Event emitted by SemanticSearch",
        "arguments": {}
      },
      "modelLoaded": {
        "name": "modelLoaded",
        "description": "Event emitted by SemanticSearch",
        "arguments": {}
      },
      "modelDisposed": {
        "name": "modelDisposed",
        "description": "Event emitted by SemanticSearch",
        "arguments": {}
      },
      "indexed": {
        "name": "indexed",
        "description": "Event emitted by SemanticSearch",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const search = container.feature('semanticSearch', {\n dbPath: '.contentbase/search.sqlite',\n embeddingProvider: 'local',\n})\nawait search.initDb()\nawait search.indexDocuments(docs)\nconst results = await search.hybridSearch('how does authentication work')"
      }
    ],
    "types": {
      "DocumentInput": {
        "description": "",
        "properties": {
          "pathId": {
            "type": "string",
            "description": ""
          },
          "model": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "title": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "slug": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "meta": {
            "type": "Record<string, any>",
            "description": "",
            "optional": true
          },
          "content": {
            "type": "string",
            "description": ""
          },
          "sections": {
            "type": "Array<{ heading: string; headingPath: string; content: string; level: number }>",
            "description": "",
            "optional": true
          }
        }
      },
      "Chunk": {
        "description": "── Types ───────────────────────────────────────────────────────────",
        "properties": {
          "pathId": {
            "type": "string",
            "description": ""
          },
          "section": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "headingPath": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "seq": {
            "type": "number",
            "description": ""
          },
          "content": {
            "type": "string",
            "description": ""
          },
          "contentHash": {
            "type": "string",
            "description": ""
          }
        }
      },
      "IndexStatus": {
        "description": "",
        "properties": {
          "documentCount": {
            "type": "number",
            "description": ""
          },
          "chunkCount": {
            "type": "number",
            "description": ""
          },
          "embeddingCount": {
            "type": "number",
            "description": ""
          },
          "lastIndexedAt": {
            "type": "string | null",
            "description": ""
          },
          "provider": {
            "type": "string",
            "description": ""
          },
          "model": {
            "type": "string",
            "description": ""
          },
          "dimensions": {
            "type": "number",
            "description": ""
          },
          "dbSizeBytes": {
            "type": "number",
            "description": ""
          }
        }
      },
      "SearchOptions": {
        "description": "",
        "properties": {
          "limit": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "model": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "where": {
            "type": "Record<string, any>",
            "description": "",
            "optional": true
          }
        }
      },
      "SearchResult": {
        "description": "",
        "properties": {
          "pathId": {
            "type": "string",
            "description": ""
          },
          "model": {
            "type": "string",
            "description": ""
          },
          "title": {
            "type": "string",
            "description": ""
          },
          "meta": {
            "type": "Record<string, any>",
            "description": ""
          },
          "score": {
            "type": "number",
            "description": ""
          },
          "snippet": {
            "type": "string",
            "description": ""
          },
          "matchedSection": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "headingPath": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      },
      "HybridSearchOptions": {
        "description": "",
        "properties": {
          "ftsWeight": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "vecWeight": {
            "type": "number",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.runpod",
    "description": "RunPod feature — manage GPU cloud pods, templates, volumes, and SSH connections via the RunPod REST API. Provides a complete interface for provisioning and managing RunPod GPU instances. Supports creating pods from templates, managing network storage volumes, SSH access via the SecureShell feature, file transfers, and polling for pod readiness.",
    "shortcut": "features.runpod",
    "className": "Runpod",
    "methods": {
      "listTemplates": {
        "description": "List available pod templates.",
        "parameters": {
          "options": {
            "type": "{ includePublic?: boolean, includeRunpod?: boolean }",
            "description": "Filter options for templates",
            "properties": {
              "includePublic": {
                "type": "any",
                "description": "Include public community templates (default: false)"
              },
              "includeRunpod": {
                "type": "any",
                "description": "Include RunPod official templates (default: true)"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<TemplateInfo[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const templates = await runpod.listTemplates({ includeRunpod: true })\nconsole.log(templates.map(t => t.name))"
          }
        ]
      },
      "getTemplate": {
        "description": "Get details for a specific template by ID.",
        "parameters": {
          "templateId": {
            "type": "string",
            "description": "The template ID to look up"
          }
        },
        "required": [
          "templateId"
        ],
        "returns": "Promise<TemplateInfo>",
        "examples": [
          {
            "language": "ts",
            "code": "const template = await runpod.getTemplate('abc123')\nconsole.log(template.imageName)"
          }
        ]
      },
      "createPod": {
        "description": "Create a new GPU pod on RunPod.",
        "parameters": {
          "options": {
            "type": "CreatePodOptions",
            "description": "Pod configuration options",
            "properties": {
              "name": {
                "type": "string",
                "description": "Pod display name (default: 'luca-pod')"
              },
              "imageName": {
                "type": "string",
                "description": "Docker image name to run"
              },
              "gpuTypeId": {
                "type": "string | string[]",
                "description": "GPU type ID or array of acceptable GPU types"
              },
              "gpuCount": {
                "type": "number",
                "description": "Number of GPUs to allocate (default: 1)"
              },
              "templateId": {
                "type": "string",
                "description": "Template ID to use for pod configuration"
              },
              "cloudType": {
                "type": "'SECURE' | 'COMMUNITY'",
                "description": "Cloud type: 'SECURE' for dedicated or 'COMMUNITY' for shared (default: 'SECURE')"
              },
              "containerDiskInGb": {
                "type": "number",
                "description": "Container disk size in GB (default: 50)"
              },
              "volumeInGb": {
                "type": "number",
                "description": "Persistent volume size in GB (default: 20)"
              },
              "volumeMountPath": {
                "type": "string",
                "description": "Mount path for the volume (default: '/workspace')"
              },
              "ports": {
                "type": "string[]",
                "description": "Port mappings like ['8888/http', '22/tcp']"
              },
              "env": {
                "type": "Record<string, string>",
                "description": "Environment variables to set in the container"
              },
              "interruptible": {
                "type": "boolean",
                "description": "Whether the pod can be preempted for spot pricing"
              },
              "networkVolumeId": {
                "type": "string",
                "description": "ID of an existing network volume to attach"
              },
              "minRAMPerGPU": {
                "type": "number",
                "description": "Minimum RAM per GPU in GB"
              }
            }
          }
        },
        "required": [
          "options"
        ],
        "returns": "Promise<PodInfo>",
        "examples": [
          {
            "language": "ts",
            "code": "const pod = await runpod.createPod({\n gpuTypeId: 'NVIDIA RTX 4090',\n templateId: 'abc123',\n volumeInGb: 50,\n})\nconsole.log(`Pod ${pod.id} created`)"
          }
        ]
      },
      "stopPod": {
        "description": "Stop a running pod.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID to stop"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "await runpod.stopPod('pod-abc123')"
          }
        ]
      },
      "startPod": {
        "description": "Start a stopped pod.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID to start"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "await runpod.startPod('pod-abc123')"
          }
        ]
      },
      "removePod": {
        "description": "Permanently delete a pod.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID to remove"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "await runpod.removePod('pod-abc123')"
          }
        ]
      },
      "getpods": {
        "description": "Get all pods via the REST API.",
        "parameters": {
          "filters": {
            "type": "{ name?: string; imageName?: string; desiredStatus?: string }",
            "description": "Optional filters for name, image, or status",
            "properties": {
              "name": {
                "type": "any",
                "description": "Filter by pod name"
              },
              "imageName": {
                "type": "any",
                "description": "Filter by Docker image name"
              },
              "desiredStatus": {
                "type": "any",
                "description": "Filter by status (RUNNING, EXITED, TERMINATED)"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<RestPodInfo[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const pods = await runpod.getpods({ desiredStatus: 'RUNNING' })\nconsole.log(pods.map(p => `${p.name}: ${p.desiredStatus}`))"
          }
        ]
      },
      "getPod": {
        "description": "Get detailed pod info via the REST API. Returns richer data than the CLI-based `getPodInfo`, including port mappings and public IP.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID to look up"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "Promise<RestPodInfo>",
        "examples": [
          {
            "language": "ts",
            "code": "const pod = await runpod.getPod('pod-abc123')\nconsole.log(`${pod.name} - ${pod.desiredStatus} - $${pod.costPerHr}/hr`)"
          }
        ]
      },
      "waitForPod": {
        "description": "Poll until a pod reaches a desired status.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID to monitor"
          },
          "status": {
            "type": "string",
            "description": "Target status to wait for (default: 'RUNNING')"
          },
          "{ interval = 5000, timeout = 300000 }": {
            "type": "any",
            "description": "Parameter { interval = 5000, timeout = 300000 }"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "Promise<RestPodInfo>",
        "examples": [
          {
            "language": "ts",
            "code": "const pod = await runpod.createPod({ gpuTypeId: 'NVIDIA RTX 4090', templateId: 'abc' })\nconst ready = await runpod.waitForPod(pod.id, 'RUNNING', { timeout: 120000 })"
          }
        ]
      },
      "listVolumes": {
        "description": "List all network storage volumes on your account.",
        "parameters": {},
        "required": [],
        "returns": "Promise<VolumeInfo[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const volumes = await runpod.listVolumes()\nconsole.log(volumes.map(v => `${v.name}: ${v.size}GB`))"
          }
        ]
      },
      "getVolume": {
        "description": "Get details for a specific network volume.",
        "parameters": {
          "volumeId": {
            "type": "string",
            "description": "The volume ID to look up"
          }
        },
        "required": [
          "volumeId"
        ],
        "returns": "Promise<VolumeInfo>",
        "examples": [
          {
            "language": "ts",
            "code": "const vol = await runpod.getVolume('vol-abc123')\nconsole.log(`${vol.name}: ${vol.size}GB in ${vol.dataCenterId}`)"
          }
        ]
      },
      "createVolume": {
        "description": "Create a new network storage volume.",
        "parameters": {
          "options": {
            "type": "CreateVolumeOptions",
            "description": "Volume configuration",
            "properties": {
              "name": {
                "type": "string",
                "description": "Display name for the volume"
              },
              "size": {
                "type": "number",
                "description": "Size in GB"
              },
              "dataCenterId": {
                "type": "string",
                "description": "Data center to create in (defaults to feature's dataCenterId)"
              }
            }
          }
        },
        "required": [
          "options"
        ],
        "returns": "Promise<VolumeInfo>",
        "examples": [
          {
            "language": "ts",
            "code": "const vol = await runpod.createVolume({ name: 'my-models', size: 100 })\nconsole.log(`Created volume ${vol.id}`)"
          }
        ]
      },
      "removeVolume": {
        "description": "Delete a network storage volume.",
        "parameters": {
          "volumeId": {
            "type": "string",
            "description": "The volume ID to delete"
          }
        },
        "required": [
          "volumeId"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "await runpod.removeVolume('vol-abc123')"
          }
        ]
      },
      "createRemoteShell": {
        "description": "Create an SSH connection to a pod using the runpodctl CLI. Prefer `getShell()` which uses the REST API and is more reliable.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID to connect to"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const shell = await runpod.createRemoteShell('pod-abc123')\nconst output = await shell.exec('nvidia-smi')"
          }
        ]
      },
      "getShell": {
        "description": "Get an SSH connection to a pod using the REST API. Uses port mappings and public IP from the REST API, which is more reliable than the CLI-based `createRemoteShell`.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID to connect to"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const shell = await runpod.getShell('pod-abc123')\nconst output = await shell.exec('ls /workspace')"
          }
        ]
      },
      "ensureFileExists": {
        "description": "Ensure a file exists on a pod's filesystem. If missing, kicks off a background download via a helper script and polls until the file appears.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID"
          },
          "remotePath": {
            "type": "string",
            "description": "Absolute path on the pod where the file should exist"
          },
          "fallbackUrl": {
            "type": "string",
            "description": "URL to download from (inside the pod) if the file doesn't exist"
          },
          "options": {
            "type": "{\n\t\t\tpollInterval?: number\n\t\t\ttimeout?: number\n\t\t\tonProgress?: (bytes: number) => void\n\t\t}",
            "description": "Parameter options",
            "properties": {
              "pollInterval": {
                "type": "any",
                "description": "How often to check in ms (default 5000)"
              },
              "timeout": {
                "type": "any",
                "description": "Max time to wait for download in ms (default 600000 / 10 min)"
              },
              "onProgress": {
                "type": "any",
                "description": "Called each poll with current file size in bytes"
              }
            }
          }
        },
        "required": [
          "podId",
          "remotePath",
          "fallbackUrl"
        ],
        "returns": "Promise<{ existed: boolean; path: string }>",
        "examples": [
          {
            "language": "ts",
            "code": "await runpod.ensureFileExists(\n podId,\n '/workspace/ComfyUI/models/checkpoints/juggernaut_xl.safetensors',\n 'https://civitai.com/api/download/models/456789',\n { onProgress: (bytes) => console.log(`${(bytes / 1e9).toFixed(2)} GB downloaded`) }\n)"
          }
        ]
      },
      "getPodHttpURLs": {
        "description": "Get the public HTTP proxy URLs for a pod's exposed HTTP ports.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const urls = await runpod.getPodHttpURLs('pod-abc123')\n// ['https://pod-abc123-8888.proxy.runpod.net']"
          }
        ]
      },
      "listPods": {
        "description": "List all pods using the runpodctl CLI. Parses the tabular output from `runpodctl get pod`. For richer data, use `getpods()`.",
        "parameters": {
          "detailed": {
            "type": "any",
            "description": "Reserved for future use"
          }
        },
        "required": [],
        "returns": "Promise<PodInfo[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const pods = await runpod.listPods()\npods.forEach(p => console.log(`${p.name} (${p.gpu}): ${p.status}`))"
          }
        ]
      },
      "getPodInfo": {
        "description": "Get pod info using the runpodctl CLI. For richer data including port mappings and public IP, use `getPod()`.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "The pod ID to look up"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "Promise<PodInfo>",
        "examples": [
          {
            "language": "ts",
            "code": "const info = await runpod.getPodInfo('pod-abc123')\nconsole.log(`${info.name}: ${info.status}`)"
          }
        ]
      },
      "listSecureGPUs": {
        "description": "List available secure GPU types with pricing. Uses the runpodctl CLI to query available secure cloud GPUs, filtering out reserved instances.",
        "parameters": {},
        "required": [],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const gpus = await runpod.listSecureGPUs()\ngpus.forEach(g => console.log(`${g.gpuType}: $${g.ondemandPrice}/hr`))"
          }
        ]
      }
    },
    "getters": {
      "proc": {
        "description": "The proc feature used for executing CLI commands like runpodctl.",
        "returns": "any"
      },
      "runpodctlPath": {
        "description": "Resolve the runpodctl binary path, caching the result.",
        "returns": "string"
      },
      "apiKey": {
        "description": "RunPod API key from options or the RUNPOD_API_KEY environment variable.",
        "returns": "any"
      },
      "dataCenterId": {
        "description": "Preferred data center ID, defaults to 'US-TX-3'.",
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
        "code": "const runpod = container.feature('runpod', { enable: true })\nconst pod = await runpod.createPod({ gpuTypeId: 'NVIDIA RTX 4090', templateId: 'abc123' })\nconst ready = await runpod.waitForPod(pod.id)\nconst shell = await runpod.getShell(pod.id)\nawait shell.exec('nvidia-smi')"
      }
    ],
    "types": {
      "TemplateInfo": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "category": {
            "type": "string",
            "description": ""
          },
          "imageName": {
            "type": "string",
            "description": ""
          },
          "isPublic": {
            "type": "boolean",
            "description": ""
          },
          "isRunpod": {
            "type": "boolean",
            "description": ""
          },
          "isServerless": {
            "type": "boolean",
            "description": ""
          },
          "containerDiskInGb": {
            "type": "number",
            "description": ""
          },
          "volumeInGb": {
            "type": "number",
            "description": ""
          },
          "volumeMountPath": {
            "type": "string",
            "description": ""
          },
          "ports": {
            "type": "string[]",
            "description": ""
          },
          "env": {
            "type": "Record<string, string>",
            "description": ""
          },
          "readme": {
            "type": "string",
            "description": ""
          }
        }
      },
      "CreatePodOptions": {
        "description": "",
        "properties": {
          "name": {
            "type": "string",
            "description": "Pod display name (default: 'luca-pod')",
            "optional": true
          },
          "imageName": {
            "type": "string",
            "description": "Docker image name to run",
            "optional": true
          },
          "gpuTypeId": {
            "type": "string | string[]",
            "description": "GPU type ID or array of acceptable GPU types"
          },
          "gpuCount": {
            "type": "number",
            "description": "Number of GPUs to allocate (default: 1)",
            "optional": true
          },
          "templateId": {
            "type": "string",
            "description": "Template ID to use for pod configuration",
            "optional": true
          },
          "cloudType": {
            "type": "'SECURE' | 'COMMUNITY'",
            "description": "Cloud type: 'SECURE' for dedicated or 'COMMUNITY' for shared (default: 'SECURE')",
            "optional": true
          },
          "containerDiskInGb": {
            "type": "number",
            "description": "Container disk size in GB (default: 50)",
            "optional": true
          },
          "volumeInGb": {
            "type": "number",
            "description": "Persistent volume size in GB (default: 20)",
            "optional": true
          },
          "volumeMountPath": {
            "type": "string",
            "description": "Mount path for the volume (default: '/workspace')",
            "optional": true
          },
          "ports": {
            "type": "string[]",
            "description": "Port mappings like ['8888/http', '22/tcp']",
            "optional": true
          },
          "env": {
            "type": "Record<string, string>",
            "description": "Environment variables to set in the container",
            "optional": true
          },
          "interruptible": {
            "type": "boolean",
            "description": "Whether the pod can be preempted for spot pricing",
            "optional": true
          },
          "networkVolumeId": {
            "type": "string",
            "description": "ID of an existing network volume to attach",
            "optional": true
          },
          "minRAMPerGPU": {
            "type": "number",
            "description": "Minimum RAM per GPU in GB",
            "optional": true
          }
        }
      },
      "PodInfo": {
        "description": "{ \"id\": \"vv32fbi9y21cxz\", \"name\": \"RunPod Stable Diffusion\", \"gpu\": \"1 RTX 4090\", \"imageName\": \"runpod/stable-diffusion:web-ui-10.2.1\", \"status\": \"RUNNING\", \"podType\": \"RESERVED\", \"cpu\": \"21\", \"memory\": \"41\", \"containerDisk\": \"10\", \"volumeDisk\": \"0\", \"spotPrice\": \"0.690\", \"ports\": [ { \"ip\": \"100.65.22.197\", \"internal\": \"60014\", \"external\": \"8888\", \"serviceType\": \"http\", \"isPublic\": false }, { \"ip\": \"100.65.22.197\", \"internal\": \"60013\", \"external\": \"19123\", \"serviceType\": \"http\", \"isPublic\": false }, { \"ip\": \"203.57.40.89\", \"internal\": \"10020\", \"external\": \"22\", \"serviceType\": \"tcp\", \"isPublic\": true }, { \"ip\": \"100.65.22.197\", \"internal\": \"60015\", \"external\": \"3001\", \"serviceType\": \"http\", \"isPublic\": false } ] }",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "gpu": {
            "type": "string",
            "description": ""
          },
          "imageName": {
            "type": "string",
            "description": ""
          },
          "status": {
            "type": "string",
            "description": ""
          },
          "podType": {
            "type": "string",
            "description": ""
          },
          "cpu": {
            "type": "string",
            "description": ""
          },
          "memory": {
            "type": "string",
            "description": ""
          },
          "containerDisk": {
            "type": "string",
            "description": ""
          },
          "volumeDisk": {
            "type": "string",
            "description": ""
          },
          "spotPrice": {
            "type": "string",
            "description": ""
          },
          "ports": {
            "type": "PortInfo[]",
            "description": ""
          }
        }
      },
      "PortInfo": {
        "description": "",
        "properties": {
          "ip": {
            "type": "string",
            "description": ""
          },
          "internal": {
            "type": "number",
            "description": ""
          },
          "external": {
            "type": "number",
            "description": ""
          },
          "serviceType": {
            "type": "string",
            "description": ""
          },
          "isPublic": {
            "type": "boolean",
            "description": ""
          }
        }
      },
      "RestPodInfo": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "desiredStatus": {
            "type": "'RUNNING' | 'EXITED' | 'TERMINATED'",
            "description": ""
          },
          "costPerHr": {
            "type": "number",
            "description": ""
          },
          "adjustedCostPerHr": {
            "type": "number",
            "description": ""
          },
          "gpu": {
            "type": "{ id: string; count: number; displayName: string }",
            "description": ""
          },
          "machine": {
            "type": "{ dataCenterId: string; location: string; gpuTypeId: string }",
            "description": ""
          },
          "publicIp": {
            "type": "string | null",
            "description": "Public IP for SSH/TCP connections"
          },
          "ports": {
            "type": "string[]",
            "description": ""
          },
          "portMappings": {
            "type": "Record<string, number> | null",
            "description": "Maps internal port (e.g. \"22\") to external port number (e.g. 22122)"
          },
          "containerDiskInGb": {
            "type": "number",
            "description": ""
          },
          "volumeInGb": {
            "type": "number",
            "description": ""
          },
          "memoryInGb": {
            "type": "number",
            "description": ""
          },
          "vcpuCount": {
            "type": "number",
            "description": ""
          },
          "image": {
            "type": "string",
            "description": ""
          }
        }
      },
      "VolumeInfo": {
        "description": "",
        "properties": {
          "id": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "size": {
            "type": "number",
            "description": ""
          },
          "dataCenterId": {
            "type": "string",
            "description": ""
          }
        }
      },
      "CreateVolumeOptions": {
        "description": "",
        "properties": {
          "name": {
            "type": "string",
            "description": "Display name for the volume"
          },
          "size": {
            "type": "number",
            "description": "Size in GB"
          },
          "dataCenterId": {
            "type": "string",
            "description": "Data center to create in (defaults to feature's dataCenterId)",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.helpers",
    "description": "The Helpers feature is a unified gateway for discovering and registering project-level helpers from conventional folder locations. It scans known folder names (features/, clients/, servers/, commands/, endpoints/, selectors/) and handles registration differently based on the helper type: - Class-based (features, clients, servers): Dynamic import, validate subclass, register - Config-based (commands, endpoints, selectors): Delegate to existing discovery mechanisms",
    "shortcut": "features.helpers",
    "className": "Helpers",
    "methods": {
      "seedVirtualModules": {
        "description": "Seeds the VM feature with virtual modules so that project-level files can `import` / `require('@soederpop/luca')`, `zod`, etc. without needing them in `node_modules`. Called automatically when `useNativeImport` is false. Can also be called externally (e.g. from the CLI) to pre-seed before discovery.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "discover": {
        "description": "Discover and register project-level helpers of the given type. Idempotent: the first caller triggers the actual scan. Subsequent callers receive the cached results. If discovery is in-flight, callers await the same promise — no duplicate work.",
        "parameters": {
          "type": {
            "type": "RegistryType",
            "description": "Which type of helpers to discover"
          },
          "options": {
            "type": "{ directory?: string }",
            "description": "Optional overrides",
            "properties": {
              "directory": {
                "type": "any",
                "description": "Override the directory to scan"
              }
            }
          }
        },
        "required": [
          "type"
        ],
        "returns": "Promise<string[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const names = await container.helpers.discover('features')\nconsole.log(names) // ['myCustomFeature']"
          }
        ]
      },
      "discoverAll": {
        "description": "Discover all helper types from their conventional folder locations. Idempotent: safe to call from multiple places (luca.cli.ts, commands, etc.). The first caller triggers discovery; all others receive the same results.",
        "parameters": {},
        "required": [],
        "returns": "Promise<Record<string, string[]>>",
        "examples": [
          {
            "language": "ts",
            "code": "const results = await container.helpers.discoverAll()\n// { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }"
          }
        ]
      },
      "lookup": {
        "description": "Look up a helper class by type and name.",
        "parameters": {
          "type": {
            "type": "RegistryType",
            "description": "The registry type (features, clients, servers, commands, endpoints)"
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
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const FsClass = container.helpers.lookup('features', 'fs')"
          }
        ]
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
      },
      "loadModuleExports": {
        "description": "Load a module either via native `import()` or the VM's virtual module system. Uses the same `useNativeImport` check as discovery to decide the loading strategy.",
        "parameters": {
          "absPath": {
            "type": "string",
            "description": "Absolute path to the module file"
          },
          "options": {
            "type": "{ cacheBust?: boolean }",
            "description": "Optional settings",
            "properties": {
              "cacheBust": {
                "type": "any",
                "description": "When true, appends a timestamp query to bypass the native import cache (useful for hot reload)"
              }
            }
          }
        },
        "required": [
          "absPath"
        ],
        "returns": "Promise<Record<string, any>>"
      }
    },
    "getters": {
      "rootDir": {
        "description": "The root directory to scan for helper folders.",
        "returns": "string"
      },
      "useNativeImport": {
        "description": "Whether to use native `import()` for loading project helpers. True only if `@soederpop/luca` is actually resolvable in `node_modules`. Warns when `node_modules` exists but the package is missing.",
        "returns": "boolean"
      },
      "available": {
        "description": "Returns a unified view of all available helpers across all registries. Each key is a registry type, each value is the list of helper names in that registry.",
        "returns": "Record<string, string[]>",
        "examples": [
          {
            "language": "ts",
            "code": "container.helpers.available\n// { features: ['fs', 'git', ...], clients: ['rest', 'websocket'], ... }"
          }
        ]
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const helpers = container.feature('helpers', { enable: true })\n\n// Discover all helper types\nawait helpers.discoverAll()\n\n// Discover a specific type\nawait helpers.discover('features')\n\n// Unified view of all available helpers\nconsole.log(helpers.available)"
      }
    ]
  },
  {
    "id": "features.fileManager",
    "description": "The FileManager feature creates a database like index of all of the files in the project, and provides metadata about these files, and also provides a way to watch for changes to the files.",
    "shortcut": "features.fileManager",
    "className": "FileManager",
    "methods": {
      "match": {
        "description": "Matches the file IDs against the pattern(s) provided",
        "parameters": {
          "patterns": {
            "type": "string | string[]",
            "description": "The patterns to match against the file IDs"
          }
        },
        "required": [
          "patterns"
        ],
        "returns": "string[]"
      },
      "matchFiles": {
        "description": "Matches the file IDs against the pattern(s) provided and returns the file objects for each.",
        "parameters": {
          "patterns": {
            "type": "string | string[]",
            "description": "The patterns to match against the file IDs"
          }
        },
        "required": [
          "patterns"
        ],
        "returns": "(File | undefined)[]"
      },
      "start": {
        "description": "Starts the file manager and scans the files in the project.",
        "parameters": {
          "options": {
            "type": "{ exclude?: string | string[] }",
            "description": "Options for the file manager",
            "properties": {
              "exclude": {
                "type": "any",
                "description": "The patterns to exclude from the scan"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "scanFiles": {
        "description": "Scans the files in the project and updates the file manager state.",
        "parameters": {
          "options": {
            "type": "{ exclude?: string | string[] }",
            "description": "Options for the file manager",
            "properties": {
              "exclude": {
                "type": "any",
                "description": "The patterns to exclude from the scan"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "watch": {
        "description": "Watches directories for file changes. Can be called multiple times to add more directories to an existing watcher. Tracks all watched paths in state. When called without `paths`, watches the project's `directoryIds` (default behavior). When called with `paths`, watches only those specific directories/globs. Subsequent calls add to the existing watcher — they never replace what's already watched.",
        "parameters": {
          "options": {
            "type": "{ paths?: string | string[]; exclude?: string | string[] }",
            "description": "Options for the file manager",
            "properties": {
              "paths": {
                "type": "any",
                "description": "Specific directories or globs to watch. Defaults to project directoryIds."
              },
              "exclude": {
                "type": "any",
                "description": "The patterns to exclude from the watch"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<void>"
      },
      "stopWatching": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "updateFile": {
        "description": "",
        "parameters": {
          "path": {
            "type": "string",
            "description": "Parameter path"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<void>"
      },
      "removeFile": {
        "description": "",
        "parameters": {
          "path": {
            "type": "string",
            "description": "Parameter path"
          }
        },
        "required": [
          "path"
        ],
        "returns": "Promise<void>"
      }
    },
    "getters": {
      "fileIds": {
        "description": "Returns an array of all relative file paths indexed by the file manager.",
        "returns": "string[]"
      },
      "fileObjects": {
        "description": "Returns an array of all file metadata objects indexed by the file manager.",
        "returns": "File[]"
      },
      "directoryIds": {
        "description": "Returns the directory IDs for all of the files in the project.",
        "returns": "string[]"
      },
      "uniqueExtensions": {
        "description": "Returns an array of unique file extensions found across all indexed files.",
        "returns": "string[]"
      },
      "isStarted": {
        "description": "Whether the file manager has completed its initial scan.",
        "returns": "boolean"
      },
      "isStarting": {
        "description": "Whether the file manager is currently performing its initial scan.",
        "returns": "boolean"
      },
      "isWatching": {
        "description": "Whether the file watcher is actively monitoring for changes.",
        "returns": "boolean"
      },
      "watchedPaths": {
        "description": "Returns the list of directories currently being watched.",
        "returns": "string[]"
      },
      "watchedFiles": {
        "description": "Returns the directories and files currently being watched by chokidar.",
        "returns": "Record<string, string[]>"
      }
    },
    "events": {
      "file:change": {
        "name": "file:change",
        "description": "Event emitted by FileManager",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const fileManager = container.feature('fileManager')\nawait fileManager.start()\n\nconst fileIds = fileManager.fileIds\nconst typescriptFiles = fileManager.matchFiles(\"**ts\")"
      }
    ],
    "types": {
      "File": {
        "description": "",
        "properties": {
          "absolutePath": {
            "type": "string",
            "description": ""
          },
          "relativePath": {
            "type": "string",
            "description": ""
          },
          "relativeDirname": {
            "type": "string",
            "description": ""
          },
          "dirname": {
            "type": "string",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "extension": {
            "type": "string",
            "description": ""
          },
          "size": {
            "type": "number",
            "description": ""
          },
          "modifiedAt": {
            "type": "Date",
            "description": ""
          },
          "createdAt": {
            "type": "Date",
            "description": ""
          }
        }
      }
    }
  },
  {
    "id": "features.contentDb",
    "description": "Provides access to a Contentbase Collection for a folder of structured markdown files. Models are defined in the collection's models.ts file and auto-discovered on load. This feature is a thin wrapper that manages the collection lifecycle and provides convenience accessors for models and documents.",
    "shortcut": "features.contentDb",
    "className": "ContentDb",
    "methods": {
      "setupToolsConsumer": {
        "description": "When an assistant uses contentDb, inject system prompt guidance about progressive document exploration.",
        "parameters": {
          "consumer": {
            "type": "Helper",
            "description": "Parameter consumer"
          }
        },
        "required": [
          "consumer"
        ],
        "returns": "void"
      },
      "renderTree": {
        "description": "Render a tree view of the collection directory structure. Built with container.fs so it works without the `tree` binary.",
        "parameters": {
          "options": {
            "type": "{ depth?: number; dirsOnly?: boolean }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "string"
      },
      "grep": {
        "description": "",
        "parameters": {
          "options": {
            "type": "string | GrepOptions",
            "description": "Parameter options"
          }
        },
        "required": [
          "options"
        ],
        "returns": "void"
      },
      "query": {
        "description": "Query documents belonging to a specific model definition.",
        "parameters": {
          "model": {
            "type": "T",
            "description": "The model definition to query against"
          }
        },
        "required": [
          "model"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const contentDb = container.feature('contentDb', { rootPath: './docs' })\nawait contentDb.load()\nconst articles = await contentDb.query(contentDb.models.Article).fetchAll()"
          }
        ]
      },
      "parseMarkdownAtPath": {
        "description": "Parse a markdown file at the given path without loading the full collection.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "Absolute or relative path to the markdown file"
          }
        },
        "required": [
          "path"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const doc = contentDb.parseMarkdownAtPath('./docs/getting-started.md')\nconsole.log(doc.frontmatter, doc.content)"
          }
        ]
      },
      "load": {
        "description": "Load the collection, discovering models from models.ts and parsing all documents.",
        "parameters": {},
        "required": [],
        "returns": "Promise<ContentDb>",
        "examples": [
          {
            "language": "ts",
            "code": "const contentDb = container.feature('contentDb', { rootPath: './docs' })\nawait contentDb.load()\nconsole.log(contentDb.isLoaded) // true"
          }
        ]
      },
      "reload": {
        "description": "Force-reload the collection from disk, picking up new/changed/deleted documents.",
        "parameters": {},
        "required": [],
        "returns": "Promise<ContentDb>"
      },
      "read": {
        "description": "Read a single document by its path ID, optionally filtering to specific sections. The document title (H1) is always included in the output. When using `include`, the leading content (paragraphs between the H1 and first H2) is also included by default, controlled by the `leadingContent` option. When `include` is provided, only those sections are returned (via extractSections in flat mode). When `exclude` is provided, those sections are removed from the full document. If both are set, `include` takes precedence.",
        "parameters": {
          "idStringOrObject": {
            "type": "string | { id: string }",
            "description": "Document path ID string, or an object with an `id` property"
          },
          "options": {
            "type": "{ exclude?: string[], include?: string[], meta?: boolean, leadingContent?: boolean }",
            "description": "Optional filtering and formatting options",
            "properties": {
              "include": {
                "type": "any",
                "description": "Only return sections matching these heading names"
              },
              "exclude": {
                "type": "any",
                "description": "Remove sections matching these heading names"
              },
              "meta": {
                "type": "any",
                "description": "Whether to include YAML frontmatter in the output (default: false)"
              },
              "leadingContent": {
                "type": "any",
                "description": "Include content between the H1 and first H2 when using include filter (default: true)"
              }
            }
          }
        },
        "required": [
          "idStringOrObject"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "await contentDb.read('guides/intro')\nawait contentDb.read('guides/intro', { include: ['Installation', 'Usage'] })\nawait contentDb.read('guides/intro', { exclude: ['Changelog'], meta: true })\nawait contentDb.read('guides/intro', { include: ['API'], leadingContent: false })"
          }
        ]
      },
      "readMultiple": {
        "description": "Read multiple documents by their path IDs, concatenated into a single string. By default each document is wrapped in `<!-- BEGIN: id -->` / `<!-- END: id -->` dividers for easy identification. Supports the same filtering options as {@link read}.",
        "parameters": {
          "ids": {
            "type": "string[] | { id: string }[]",
            "description": "Array of document path ID strings or objects with `id` properties"
          },
          "options": {
            "type": "{ exclude?: string[], include?: string[], meta?: boolean, leadingContent?: boolean, dividers?: boolean }",
            "description": "Optional filtering and formatting options (applied to each document)",
            "properties": {
              "dividers": {
                "type": "any",
                "description": "Wrap each document in BEGIN/END comment dividers showing the ID (default: true)"
              }
            }
          }
        },
        "required": [
          "ids"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "await contentDb.readMultiple(['guides/intro', 'guides/setup'])\nawait contentDb.readMultiple([{ id: 'guides/intro' }], { include: ['Overview'], dividers: false })"
          }
        ]
      },
      "generateTableOfContents": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "generateModelSummary": {
        "description": "",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [
          "options"
        ],
        "returns": "void"
      },
      "search": {
        "description": "BM25 keyword search across indexed documents. If no search index exists, throws with an actionable message.",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Parameter query"
          },
          "options": {
            "type": "{ limit?: number; model?: string; where?: Record<string, any> }",
            "description": "Parameter options"
          }
        },
        "required": [
          "query"
        ],
        "returns": "void"
      },
      "vectorSearch": {
        "description": "Vector similarity search using embeddings. Finds conceptually related documents even without keyword matches.",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Parameter query"
          },
          "options": {
            "type": "{ limit?: number; model?: string; where?: Record<string, any> }",
            "description": "Parameter options"
          }
        },
        "required": [
          "query"
        ],
        "returns": "void"
      },
      "hybridSearch": {
        "description": "Combined keyword + semantic search with Reciprocal Rank Fusion. Best for general questions about the collection.",
        "parameters": {
          "query": {
            "type": "string",
            "description": "Parameter query"
          },
          "options": {
            "type": "{ limit?: number; model?: string; where?: Record<string, any>; ftsWeight?: number; vecWeight?: number }",
            "description": "Parameter options"
          }
        },
        "required": [
          "query"
        ],
        "returns": "void"
      },
      "buildSearchIndex": {
        "description": "Build the search index from all documents in the collection. Chunks documents and generates embeddings.",
        "parameters": {
          "options": {
            "type": "{ force?: boolean; embeddingProvider?: string; embeddingModel?: string; onProgress?: (indexed: number, total: number) => void }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "void"
      },
      "rebuildSearchIndex": {
        "description": "Rebuild the entire search index from scratch.",
        "parameters": {
          "options": {
            "type": "{ embeddingProvider?: string; embeddingModel?: string; onProgress?: (indexed: number, total: number) => void }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "void"
      },
      "getCollectionOverview": {
        "description": "Returns a high-level overview of the collection.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "listDocuments": {
        "description": "List document IDs, optionally filtered by model or glob.",
        "parameters": {
          "args": {
            "type": "{ model?: string; glob?: string }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "readDocument": {
        "description": "Read a single document with optional section filtering.",
        "parameters": {
          "args": {
            "type": "{ id: string; include?: string[]; exclude?: string[]; meta?: boolean }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "readMultipleDocuments": {
        "description": "Read multiple documents with optional section filtering.",
        "parameters": {
          "args": {
            "type": "{ ids: string[]; include?: string[]; exclude?: string[]; meta?: boolean }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "queryDocuments": {
        "description": "Query documents by model with filters, sort, limit.",
        "parameters": {
          "args": {
            "type": "{ model: string; where?: string; sort?: string; limit?: number; offset?: number; select?: string[] }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "searchContent": {
        "description": "Grep/text search across the collection.",
        "parameters": {
          "args": {
            "type": "{ pattern: string; caseSensitive?: boolean }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      },
      "semanticSearch": {
        "description": "Hybrid semantic search with graceful fallback to grep.",
        "parameters": {
          "args": {
            "type": "{ query: string; limit?: number }",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "isLoaded": {
        "description": "Whether the content database has been loaded.",
        "returns": "boolean"
      },
      "collection": {
        "description": "Returns the lazily-initialized Collection instance for the configured rootPath.",
        "returns": "Collection"
      },
      "collectionPath": {
        "description": "Returns the absolute resolved path to the collection root directory.",
        "returns": "string"
      },
      "models": {
        "description": "Returns an object mapping model names to their model definitions, sourced from the collection.",
        "returns": "Record<string, ModelDefinition>"
      },
      "modelNames": {
        "description": "Returns an array of all registered model names from the collection.",
        "returns": "string[]"
      },
      "available": {
        "description": "Returns the available document ids in the collection",
        "returns": "string[]"
      },
      "modelDefinitionTable": {
        "description": "",
        "returns": "Record<string, { description: string; glob: string; routePatterns: string[] }>"
      },
      "fileTree": {
        "description": "",
        "returns": "string"
      },
      "searchIndexStatus": {
        "description": "Get the current search index status.",
        "returns": "{ exists: boolean; documentCount: number; chunkCount: number; embeddingCount: number; lastIndexedAt: any; provider: any; model: any; dimensions: number; dbSizeBytes: number }"
      },
      "queries": {
        "description": "Returns an object with query builders keyed by model name (singular and plural, lowercased). Provides a convenient shorthand for querying without looking up model definitions manually.",
        "returns": "Record<string, ReturnType<typeof this.query>>",
        "examples": [
          {
            "language": "ts",
            "code": "const contentDb = container.feature('contentDb', { rootPath: './docs' })\nawait contentDb.load()\nconst allArticles = await contentDb.queries.articles.fetchAll()\nconst firstTask = await contentDb.queries.task.first()"
          }
        ]
      }
    },
    "events": {
      "reloaded": {
        "name": "reloaded",
        "description": "Event emitted by ContentDb",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const contentDb = container.feature('contentDb', { rootPath: './docs' })\nawait contentDb.load()\nconsole.log(contentDb.modelNames) // ['Article', 'Page', ...]"
      }
    ]
  },
  {
    "id": "clients.graph",
    "description": "GraphQL client that wraps RestClient with convenience methods for executing queries and mutations. Automatically handles the GraphQL request envelope (query/variables/operationName) and unwraps responses, extracting the `data` field and emitting events for GraphQL-level errors.",
    "shortcut": "clients.graph",
    "className": "GraphClient",
    "methods": {
      "query": {
        "description": "Execute a GraphQL query and return the unwrapped data.",
        "parameters": {
          "query": {
            "type": "string",
            "description": "The GraphQL query string"
          },
          "variables": {
            "type": "Record<string, any>",
            "description": "Optional variables for the query"
          },
          "operationName": {
            "type": "string",
            "description": "Optional operation name when the query contains multiple operations"
          }
        },
        "required": [
          "query"
        ],
        "returns": "Promise<R>"
      },
      "mutate": {
        "description": "Execute a GraphQL mutation and return the unwrapped data. Semantically identical to query() but named for clarity when performing mutations.",
        "parameters": {
          "mutation": {
            "type": "string",
            "description": "The GraphQL mutation string"
          },
          "variables": {
            "type": "Record<string, any>",
            "description": "Optional variables for the mutation"
          },
          "operationName": {
            "type": "string",
            "description": "Optional operation name when the mutation contains multiple operations"
          }
        },
        "required": [
          "mutation"
        ],
        "returns": "Promise<R>"
      }
    },
    "getters": {
      "endpoint": {
        "description": "The GraphQL endpoint path. Defaults to '/graphql'.",
        "returns": "any"
      }
    },
    "events": {
      "graphqlError": {
        "name": "graphqlError",
        "description": "Event emitted by GraphClient",
        "arguments": {}
      },
      "failure": {
        "name": "failure",
        "description": "Event emitted by GraphClient",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const gql = container.client('graph', { baseURL: 'https://api.example.com' })\nconst data = await gql.query(`{ users { id name } }`)\nawait gql.mutate(`mutation($name: String!) { createUser(name: $name) { id } }`, { name: 'Alice' })"
      }
    ]
  },
  {
    "id": "clients.rest",
    "description": "HTTP REST client built on top of axios. Provides convenience methods for GET, POST, PUT, PATCH, and DELETE requests with automatic JSON handling, configurable base URL, and error event emission.",
    "shortcut": "clients.rest",
    "className": "RestClient",
    "methods": {
      "beforeRequest": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "patch": {
        "description": "Send a PATCH request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
        "parameters": {
          "url": {
            "type": "string",
            "description": "Request path relative to baseURL"
          },
          "data": {
            "type": "any",
            "description": "Request body"
          },
          "options": {
            "type": "AxiosRequestConfig",
            "description": "Additional axios request config"
          }
        },
        "required": [
          "url"
        ],
        "returns": "Promise<any>"
      },
      "put": {
        "description": "Send a PUT request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
        "parameters": {
          "url": {
            "type": "string",
            "description": "Request path relative to baseURL"
          },
          "data": {
            "type": "any",
            "description": "Request body"
          },
          "options": {
            "type": "AxiosRequestConfig",
            "description": "Additional axios request config"
          }
        },
        "required": [
          "url"
        ],
        "returns": "Promise<any>"
      },
      "post": {
        "description": "Send a POST request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
        "parameters": {
          "url": {
            "type": "string",
            "description": "Request path relative to baseURL"
          },
          "data": {
            "type": "any",
            "description": "Request body"
          },
          "options": {
            "type": "AxiosRequestConfig",
            "description": "Additional axios request config"
          }
        },
        "required": [
          "url"
        ],
        "returns": "Promise<any>"
      },
      "delete": {
        "description": "Send a DELETE request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
        "parameters": {
          "url": {
            "type": "string",
            "description": "Request path relative to baseURL"
          },
          "params": {
            "type": "any",
            "description": "Query parameters"
          },
          "options": {
            "type": "AxiosRequestConfig",
            "description": "Additional axios request config"
          }
        },
        "required": [
          "url"
        ],
        "returns": "Promise<any>"
      },
      "get": {
        "description": "Send a GET request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.",
        "parameters": {
          "url": {
            "type": "string",
            "description": "Request path relative to baseURL"
          },
          "params": {
            "type": "any",
            "description": "Query parameters"
          },
          "options": {
            "type": "AxiosRequestConfig",
            "description": "Additional axios request config"
          }
        },
        "required": [
          "url"
        ],
        "returns": "Promise<any>"
      },
      "handleError": {
        "description": "Handle an axios error by emitting 'failure' and returning the error as JSON.",
        "parameters": {
          "error": {
            "type": "AxiosError",
            "description": "Parameter error"
          }
        },
        "required": [
          "error"
        ],
        "returns": "Promise<object>"
      }
    },
    "getters": {
      "useJSON": {
        "description": "Whether JSON content-type headers should be set automatically.",
        "returns": "any"
      },
      "baseURL": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {
      "failure": {
        "name": "failure",
        "description": "Event emitted by RestClient",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })\nconst users = await api.get('/users')\nawait api.post('/users', { name: 'Alice' })"
      }
    ]
  },
  {
    "id": "clients.websocket",
    "description": "WebSocketClient helper",
    "shortcut": "clients.websocket",
    "className": "WebSocketClient",
    "methods": {
      "connect": {
        "description": "Establish a WebSocket connection to the configured baseURL. Wires all raw WebSocket events (open, message, close, error) to the Helper event bus and updates connection state accordingly. Resolves once the connection is open; rejects on error.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "send": {
        "description": "Send data over the WebSocket connection. Automatically JSON-serializes the payload. If not currently connected, attempts to connect first.",
        "parameters": {
          "data": {
            "type": "any",
            "description": "The data to send (will be JSON.stringify'd)"
          }
        },
        "required": [
          "data"
        ],
        "returns": "Promise<void>"
      },
      "ask": {
        "description": "Send a request and wait for a correlated response. The message is sent with a unique `requestId`; the remote side is expected to reply with a message containing `replyTo` set to that same ID.",
        "parameters": {
          "type": {
            "type": "string",
            "description": "A string identifying the request type"
          },
          "data": {
            "type": "any",
            "description": "Optional payload to include with the request"
          },
          "timeout": {
            "type": "any",
            "description": "How long to wait for a response (default 10 000 ms)"
          }
        },
        "required": [
          "type"
        ],
        "returns": "Promise<R>",
        "examples": [
          {
            "language": "ts",
            "code": "const result = await ws.ask('getUser', { id: 42 })"
          }
        ]
      },
      "disconnect": {
        "description": "Gracefully close the WebSocket connection. Suppresses auto-reconnect and updates connection state to disconnected.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      }
    },
    "getters": {
      "hasError": {
        "description": "Whether the client is in an error state.",
        "returns": "any"
      }
    },
    "events": {
      "open": {
        "name": "open",
        "description": "Event emitted by WebSocketClient",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by WebSocketClient",
        "arguments": {}
      },
      "message": {
        "name": "message",
        "description": "Event emitted by WebSocketClient",
        "arguments": {}
      },
      "close": {
        "name": "close",
        "description": "Event emitted by WebSocketClient",
        "arguments": {}
      },
      "reconnecting": {
        "name": "reconnecting",
        "description": "Event emitted by WebSocketClient",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "clients.openai",
    "description": "OpenAI client — wraps the OpenAI SDK for chat completions, responses API, embeddings, and image generation. Provides convenience methods for common operations while tracking token usage and request counts. Supports both the Chat Completions API and the newer Responses API.",
    "shortcut": "clients.openai",
    "className": "OpenAIClient",
    "methods": {
      "connect": {
        "description": "Test the API connection by listing models.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>",
        "examples": [
          {
            "language": "ts",
            "code": "await openai.connect()"
          }
        ]
      },
      "createChatCompletion": {
        "description": "Create a chat completion using the Chat Completions API.",
        "parameters": {
          "messages": {
            "type": "OpenAI.Chat.Completions.ChatCompletionMessageParam[]",
            "description": "Array of chat messages"
          },
          "options": {
            "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
            "description": "Additional parameters for the completion"
          }
        },
        "required": [
          "messages"
        ],
        "returns": "Promise<OpenAI.Chat.Completions.ChatCompletion>",
        "examples": [
          {
            "language": "ts",
            "code": "const response = await openai.createChatCompletion([\n { role: 'system', content: 'You are a helpful assistant.' },\n { role: 'user', content: 'Hello!' }\n])\nconsole.log(response.choices[0]?.message?.content)"
          }
        ]
      },
      "createResponse": {
        "description": "Create a response using the Responses API.",
        "parameters": {
          "input": {
            "type": "OpenAI.Responses.ResponseInput | string",
            "description": "The input prompt or message array"
          },
          "options": {
            "type": "Partial<OpenAI.Responses.ResponseCreateParamsNonStreaming>",
            "description": "Additional parameters for the response"
          }
        },
        "required": [
          "input"
        ],
        "returns": "Promise<OpenAI.Responses.Response>",
        "examples": [
          {
            "language": "ts",
            "code": "const response = await openai.createResponse('Explain quantum computing')"
          }
        ]
      },
      "streamResponse": {
        "description": "Stream a response using the Responses API.",
        "parameters": {
          "input": {
            "type": "OpenAI.Responses.ResponseInput | string",
            "description": "The input prompt or message array"
          },
          "options": {
            "type": "Partial<OpenAI.Responses.ResponseCreateParamsStreaming>",
            "description": "Additional parameters for the streaming response"
          }
        },
        "required": [
          "input"
        ],
        "returns": "Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>",
        "examples": [
          {
            "language": "ts",
            "code": "const stream = await openai.streamResponse('Write a poem')\nfor await (const event of stream) {\n if (event.type === 'response.output_text.delta') {\n   process.stdout.write(event.delta)\n }\n}"
          }
        ]
      },
      "createCompletion": {
        "description": "Create a legacy text completion.",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "The text prompt to complete"
          },
          "options": {
            "type": "Partial<OpenAI.Completions.CompletionCreateParams>",
            "description": "Additional parameters for the completion"
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<OpenAI.Completions.Completion>",
        "examples": [
          {
            "language": "ts",
            "code": "const response = await openai.createCompletion('Once upon a time')"
          }
        ]
      },
      "createEmbedding": {
        "description": "Create text embeddings for semantic search or similarity comparisons.",
        "parameters": {
          "input": {
            "type": "string | string[]",
            "description": "A string or array of strings to embed"
          },
          "options": {
            "type": "Partial<OpenAI.Embeddings.EmbeddingCreateParams>",
            "description": "Additional parameters (model, etc.)"
          }
        },
        "required": [
          "input"
        ],
        "returns": "Promise<OpenAI.Embeddings.CreateEmbeddingResponse>",
        "examples": [
          {
            "language": "ts",
            "code": "const response = await openai.createEmbedding('Hello world')\nconsole.log(response.data[0].embedding.length)"
          }
        ]
      },
      "createImage": {
        "description": "Generate an image from a text prompt using DALL-E.",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "Description of the image to generate"
          },
          "options": {
            "type": "Partial<OpenAI.Images.ImageGenerateParams>",
            "description": "Additional parameters (size, n, etc.)"
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<OpenAI.Images.ImagesResponse>",
        "examples": [
          {
            "language": "ts",
            "code": "const response = await openai.createImage('A sunset over mountains')\nconsole.log(response.data[0].url)"
          }
        ]
      },
      "listModels": {
        "description": "List all available models.",
        "parameters": {},
        "required": [],
        "returns": "Promise<OpenAI.Models.ModelsPage>",
        "examples": [
          {
            "language": "ts",
            "code": "const models = await openai.listModels()"
          }
        ]
      },
      "ask": {
        "description": "Ask a single question and get a text response. Convenience wrapper around `createChatCompletion` for simple Q&A.",
        "parameters": {
          "question": {
            "type": "string",
            "description": "The question to ask"
          },
          "options": {
            "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
            "description": "Additional completion parameters"
          }
        },
        "required": [
          "question"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const answer = await openai.ask('What is 2 + 2?')\nconsole.log(answer) // '4'"
          }
        ]
      },
      "chat": {
        "description": "Send a multi-turn conversation and get a text response. Convenience wrapper around `createChatCompletion` that returns just the text.",
        "parameters": {
          "messages": {
            "type": "OpenAI.Chat.Completions.ChatCompletionMessageParam[]",
            "description": "Array of chat messages"
          },
          "options": {
            "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
            "description": "Additional completion parameters"
          }
        },
        "required": [
          "messages"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const reply = await openai.chat([\n { role: 'system', content: 'You are a pirate.' },\n { role: 'user', content: 'Hello!' }\n])"
          }
        ]
      }
    },
    "getters": {
      "defaultModel": {
        "description": "The default model used for completions, from options or 'gpt-4o'.",
        "returns": "string"
      },
      "raw": {
        "description": "The underlying OpenAI SDK instance for advanced use cases.",
        "returns": "OpenAI"
      }
    },
    "events": {
      "connected": {
        "name": "connected",
        "description": "Event emitted by OpenAIClient",
        "arguments": {}
      },
      "failure": {
        "name": "failure",
        "description": "Event emitted by OpenAIClient",
        "arguments": {}
      },
      "completion": {
        "name": "completion",
        "description": "Event emitted by OpenAIClient",
        "arguments": {}
      },
      "embedding": {
        "name": "embedding",
        "description": "Event emitted by OpenAIClient",
        "arguments": {}
      },
      "image": {
        "name": "image",
        "description": "Event emitted by OpenAIClient",
        "arguments": {}
      },
      "models": {
        "name": "models",
        "description": "Event emitted by OpenAIClient",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const openai = container.client('openai', { defaultModel: 'gpt-4o' })\nconst answer = await openai.ask('What is the meaning of life?')\nconsole.log(answer)"
      }
    ]
  },
  {
    "id": "clients.voicebox",
    "description": "VoiceBox client — local TTS synthesis via VoiceBox.sh REST API (Qwen3-TTS). Provides methods for managing voice profiles and generating speech audio locally. Uses the streaming endpoint for synchronous synthesis (returns WAV buffer).",
    "shortcut": "clients.voicebox",
    "className": "VoiceBoxClient",
    "methods": {
      "connect": {
        "description": "Validate the VoiceBox server is reachable by hitting the health endpoint.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "listProfiles": {
        "description": "List all voice profiles.",
        "parameters": {},
        "required": [],
        "returns": "Promise<any[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const profiles = await vb.listProfiles()\nconsole.log(profiles.map(p => `${p.name} (${p.sample_count} samples)`))"
          }
        ]
      },
      "getProfile": {
        "description": "Get a single voice profile by ID.",
        "parameters": {
          "profileId": {
            "type": "string",
            "description": "Parameter profileId"
          }
        },
        "required": [
          "profileId"
        ],
        "returns": "Promise<any>"
      },
      "createProfile": {
        "description": "Create a new voice profile.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Parameter name"
          },
          "options": {
            "type": "{ description?: string; language?: string }",
            "description": "Parameter options"
          }
        },
        "required": [
          "name"
        ],
        "returns": "Promise<any>"
      },
      "listEffects": {
        "description": "List available audio effects and their parameter definitions.",
        "parameters": {},
        "required": [],
        "returns": "Promise<any>"
      },
      "synthesize": {
        "description": "Synthesize speech from text using the streaming endpoint. Returns audio as a WAV Buffer (synchronous — blocks until audio is ready).",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to convert to speech"
          },
          "options": {
            "type": "SynthesizeOptions",
            "description": "Profile, engine, model, and other synthesis options",
            "properties": {
              "profileId": {
                "type": "string",
                "description": ""
              },
              "engine": {
                "type": "string",
                "description": ""
              },
              "modelSize": {
                "type": "string",
                "description": ""
              },
              "language": {
                "type": "string",
                "description": ""
              },
              "instruct": {
                "type": "string",
                "description": ""
              },
              "seed": {
                "type": "number",
                "description": ""
              },
              "maxChunkChars": {
                "type": "number",
                "description": ""
              },
              "crossfadeMs": {
                "type": "number",
                "description": ""
              },
              "normalize": {
                "type": "boolean",
                "description": ""
              },
              "effectsChain": {
                "type": "EffectConfig[]",
                "description": ""
              },
              "disableCache": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "text"
        ],
        "returns": "Promise<Buffer>",
        "examples": [
          {
            "language": "ts",
            "code": "const audio = await vb.synthesize('Hello world', { profileId: 'abc-123' })\n// audio is a Buffer of WAV data"
          }
        ]
      },
      "generate": {
        "description": "Generate speech asynchronously (returns metadata, not audio). Use getAudio() to fetch the audio after generation completes.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          },
          "options": {
            "type": "SynthesizeOptions",
            "description": "Parameter options",
            "properties": {
              "profileId": {
                "type": "string",
                "description": ""
              },
              "engine": {
                "type": "string",
                "description": ""
              },
              "modelSize": {
                "type": "string",
                "description": ""
              },
              "language": {
                "type": "string",
                "description": ""
              },
              "instruct": {
                "type": "string",
                "description": ""
              },
              "seed": {
                "type": "number",
                "description": ""
              },
              "maxChunkChars": {
                "type": "number",
                "description": ""
              },
              "crossfadeMs": {
                "type": "number",
                "description": ""
              },
              "normalize": {
                "type": "boolean",
                "description": ""
              },
              "effectsChain": {
                "type": "EffectConfig[]",
                "description": ""
              },
              "disableCache": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "text"
        ],
        "returns": "Promise<any>"
      },
      "getAudio": {
        "description": "Fetch generated audio by generation ID. Returns WAV Buffer.",
        "parameters": {
          "generationId": {
            "type": "string",
            "description": "Parameter generationId"
          }
        },
        "required": [
          "generationId"
        ],
        "returns": "Promise<Buffer>"
      },
      "say": {
        "description": "Synthesize and write audio to a file.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          },
          "outputPath": {
            "type": "string",
            "description": "Parameter outputPath"
          },
          "options": {
            "type": "SynthesizeOptions",
            "description": "Parameter options",
            "properties": {
              "profileId": {
                "type": "string",
                "description": ""
              },
              "engine": {
                "type": "string",
                "description": ""
              },
              "modelSize": {
                "type": "string",
                "description": ""
              },
              "language": {
                "type": "string",
                "description": ""
              },
              "instruct": {
                "type": "string",
                "description": ""
              },
              "seed": {
                "type": "number",
                "description": ""
              },
              "maxChunkChars": {
                "type": "number",
                "description": ""
              },
              "crossfadeMs": {
                "type": "number",
                "description": ""
              },
              "normalize": {
                "type": "boolean",
                "description": ""
              },
              "effectsChain": {
                "type": "EffectConfig[]",
                "description": ""
              },
              "disableCache": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "text",
          "outputPath"
        ],
        "returns": "Promise<string>"
      }
    },
    "getters": {},
    "events": {
      "failure": {
        "name": "failure",
        "description": "Event emitted by VoiceBoxClient",
        "arguments": {}
      },
      "profiles": {
        "name": "profiles",
        "description": "Event emitted by VoiceBoxClient",
        "arguments": {}
      },
      "speech": {
        "name": "speech",
        "description": "Event emitted by VoiceBoxClient",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const vb = container.client('voicebox')\nawait vb.connect()\nconst profiles = await vb.listProfiles()\nconst audio = await vb.synthesize('Hello world', { profileId: profiles[0].id })\n// audio is a Buffer of WAV data"
      }
    ],
    "types": {
      "SynthesizeOptions": {
        "description": "",
        "properties": {
          "profileId": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "engine": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "modelSize": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "language": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "instruct": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "seed": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "maxChunkChars": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "crossfadeMs": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "normalize": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "effectsChain": {
            "type": "EffectConfig[]",
            "description": "",
            "optional": true
          },
          "disableCache": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      },
      "EffectConfig": {
        "description": "",
        "properties": {
          "type": {
            "type": "string",
            "description": ""
          },
          "enabled": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "params": {
            "type": "Record<string, any>",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "clients.supabase",
    "description": "Supabase client for the Luca container system. Wraps the official `@supabase/supabase-js` SDK and exposes it through Luca's typed state, events, and introspection system. The SDK is isomorphic so this single implementation works in both Node and browser containers. Use `client.sdk` for full SDK access, or use the convenience wrappers for common operations (auth, database queries, storage, edge functions, realtime).",
    "shortcut": "clients.supabase",
    "className": "SupabaseClient",
    "methods": {
      "from": {
        "description": "Start a query on a Postgres table or view.",
        "parameters": {
          "table": {
            "type": "string",
            "description": "The table or view name to query"
          }
        },
        "required": [
          "table"
        ],
        "returns": "void"
      },
      "rpc": {
        "description": "Call a Postgres function (RPC).",
        "parameters": {
          "fn": {
            "type": "string",
            "description": "The function name"
          },
          "params": {
            "type": "Record<string, unknown>",
            "description": "Arguments to pass to the function"
          },
          "options": {
            "type": "{ head?: boolean; get?: boolean; count?: \"exact\" | \"planned\" | \"estimated\" }",
            "description": "Optional settings (head, get, count)"
          }
        },
        "required": [
          "fn"
        ],
        "returns": "void"
      },
      "signInWithPassword": {
        "description": "Sign in with email and password.",
        "parameters": {
          "email": {
            "type": "string",
            "description": "Parameter email"
          },
          "password": {
            "type": "string",
            "description": "Parameter password"
          }
        },
        "required": [
          "email",
          "password"
        ],
        "returns": "void"
      },
      "signUp": {
        "description": "Create a new user account with email and password.",
        "parameters": {
          "email": {
            "type": "string",
            "description": "Parameter email"
          },
          "password": {
            "type": "string",
            "description": "Parameter password"
          }
        },
        "required": [
          "email",
          "password"
        ],
        "returns": "void"
      },
      "signOut": {
        "description": "Sign the current user out.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "getSession": {
        "description": "Get the current session, if any.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "getUser": {
        "description": "Get the current user, if any.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "invoke": {
        "description": "Invoke a Supabase Edge Function by name.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Parameter name"
          },
          "body": {
            "type": "any",
            "description": "Parameter body"
          }
        },
        "required": [
          "name"
        ],
        "returns": "void"
      },
      "subscribe": {
        "description": "Subscribe to realtime changes on a Postgres table.",
        "parameters": {
          "channelName": {
            "type": "string",
            "description": "A name for this subscription channel"
          },
          "table": {
            "type": "string",
            "description": "The table to listen to"
          },
          "callback": {
            "type": "(payload: any) => void",
            "description": "Called with the payload on each change"
          },
          "event": {
            "type": "\"INSERT\" | \"UPDATE\" | \"DELETE\" | \"*\"",
            "description": "The event type to listen for (default: all changes)"
          }
        },
        "required": [
          "channelName",
          "table",
          "callback"
        ],
        "returns": "RealtimeChannel"
      },
      "unsubscribe": {
        "description": "Unsubscribe and remove a realtime channel by name.",
        "parameters": {
          "channelName": {
            "type": "string",
            "description": "The channel name to remove"
          }
        },
        "required": [
          "channelName"
        ],
        "returns": "void"
      },
      "unsubscribeAll": {
        "description": "Unsubscribe and remove all realtime channels.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "connect": {
        "description": "Connect is a no-op since the Supabase SDK initializes on construction. The client is ready to use immediately after creation.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "disconnect": {
        "description": "Disconnect by signing out and removing all realtime channels.",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "sdk": {
        "description": "Returns the raw Supabase SDK client for full access to all SDK methods.",
        "returns": "SupabaseSDKClient<any, any>"
      },
      "storage": {
        "description": "Returns the Supabase Storage client for managing buckets and files.",
        "returns": "any"
      },
      "functions": {
        "description": "Returns the Supabase Functions client.",
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
        "code": "const supabase = container.client('supabase', {\n supabaseUrl: 'https://xyz.supabase.co',\n supabaseKey: 'your-anon-key',\n})\n\n// Query data\nconst { data } = await supabase.from('users').select('*')\n\n// Auth\nawait supabase.signInWithPassword('user@example.com', 'password')\n\n// Realtime\nsupabase.subscribe('changes', 'users', (payload) => {\n console.log('Change:', payload)\n})"
      }
    ]
  },
  {
    "id": "clients.comfyui",
    "description": "ComfyUI client — execute Stable Diffusion workflows via the ComfyUI API. Connects to a ComfyUI instance to queue prompts, track execution via WebSocket or polling, and download generated images. Supports both UI-format and API-format workflows with automatic conversion.",
    "shortcut": "clients.comfyui",
    "className": "ComfyUIClient",
    "methods": {
      "queuePrompt": {
        "description": "Queue a prompt (API-format workflow) for execution.",
        "parameters": {
          "prompt": {
            "type": "Record<string, any>",
            "description": "The API-format workflow object"
          },
          "clientId": {
            "type": "string",
            "description": "Override the client ID for this request"
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<{ prompt_id: string; number: number }>",
        "examples": [
          {
            "language": "ts",
            "code": "const { prompt_id } = await comfy.queuePrompt(apiWorkflow)"
          }
        ]
      },
      "getQueue": {
        "description": "Get the current prompt queue status.",
        "parameters": {},
        "required": [],
        "returns": "Promise<{ queue_running: any[]; queue_pending: any[] }>"
      },
      "getHistory": {
        "description": "Get execution history, optionally for a specific prompt.",
        "parameters": {
          "promptId": {
            "type": "string",
            "description": "If provided, returns history for this prompt only"
          }
        },
        "required": [],
        "returns": "Promise<Record<string, any>>"
      },
      "getSystemStats": {
        "description": "Get system stats including GPU memory and queue info.",
        "parameters": {},
        "required": [],
        "returns": "Promise<any>"
      },
      "getObjectInfo": {
        "description": "Get node type info with input/output schemas.",
        "parameters": {
          "nodeClass": {
            "type": "string",
            "description": "If provided, returns info for this node type only"
          }
        },
        "required": [],
        "returns": "Promise<any>"
      },
      "interrupt": {
        "description": "Interrupt the currently executing prompt.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "getModels": {
        "description": "List available models, optionally filtered by type.",
        "parameters": {
          "type": {
            "type": "string",
            "description": "Model type filter (e.g., 'checkpoints', 'loras')"
          }
        },
        "required": [],
        "returns": "Promise<string[]>"
      },
      "getEmbeddings": {
        "description": "List available embedding models.",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>"
      },
      "uploadImage": {
        "description": "Upload an image to ComfyUI's input directory.",
        "parameters": {
          "file": {
            "type": "Buffer | Blob",
            "description": "The image data as Buffer or Blob"
          },
          "filename": {
            "type": "string",
            "description": "File name for the upload"
          },
          "opts": {
            "type": "{ subfolder?: string; type?: string; overwrite?: boolean }",
            "description": "Upload options (subfolder, type, overwrite)"
          }
        },
        "required": [
          "file",
          "filename"
        ],
        "returns": "Promise<any>"
      },
      "viewImage": {
        "description": "Download a generated image from ComfyUI as a Buffer.",
        "parameters": {
          "filename": {
            "type": "string",
            "description": "The image filename"
          },
          "subfolder": {
            "type": "any",
            "description": "Subfolder within the output directory"
          },
          "type": {
            "type": "any",
            "description": "Image type ('output', 'input', 'temp')"
          }
        },
        "required": [
          "filename"
        ],
        "returns": "Promise<Buffer>"
      },
      "connectWs": {
        "description": "Open a WebSocket connection to ComfyUI for real-time execution tracking. Events emitted: `execution_start`, `executing`, `progress`, `executed`, `execution_cached`, `execution_error`, `execution_complete`.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "disconnectWs": {
        "description": "Close the WebSocket connection.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "toApiFormat": {
        "description": "Convert a UI-format workflow to the API format that /prompt expects. Requires a running ComfyUI instance to fetch `object_info` so we can map positional `widgets_values` to their named input fields. If the workflow is already in API format, it's returned as-is.",
        "parameters": {
          "workflow": {
            "type": "Record<string, any>",
            "description": "Parameter workflow"
          }
        },
        "required": [
          "workflow"
        ],
        "returns": "Promise<Record<string, any>>"
      },
      "runWorkflow": {
        "description": "Run a ComfyUI workflow with optional runtime input overrides. Inputs can be provided in two forms: **Direct node mapping** (when no `inputMap` in options): ``` { '3': { seed: 42 }, '6': { text: 'a cat' } } ``` **Named inputs** (when `inputMap` is provided in options): ``` inputs: { positive_prompt: 'a cat', seed: 42 } options.inputMap: { positive_prompt: { nodeId: '6', field: 'text' }, seed: { nodeId: '3', field: 'seed' } } ```",
        "parameters": {
          "workflow": {
            "type": "Record<string, any>",
            "description": "Parameter workflow"
          },
          "inputs": {
            "type": "Record<string, any>",
            "description": "Parameter inputs"
          },
          "options": {
            "type": "WorkflowRunOptions",
            "description": "Parameter options",
            "properties": {
              "poll": {
                "type": "boolean",
                "description": "Use polling instead of WebSocket for tracking execution"
              },
              "pollInterval": {
                "type": "number",
                "description": "Polling interval in ms (default 1000)"
              },
              "inputMap": {
                "type": "InputMapping",
                "description": "Named input mapping: semantic name -> { nodeId, field }"
              },
              "outputDir": {
                "type": "string",
                "description": "If provided, output images are downloaded to this directory"
              }
            }
          }
        },
        "required": [
          "workflow"
        ],
        "returns": "Promise<WorkflowResult>"
      }
    },
    "getters": {
      "clientId": {
        "description": "The unique client ID used for WebSocket session tracking.",
        "returns": "string"
      },
      "wsURL": {
        "description": "The WebSocket URL derived from baseURL or overridden via options.",
        "returns": "string"
      }
    },
    "events": {
      "execution_start": {
        "name": "execution_start",
        "description": "Event emitted by ComfyUIClient",
        "arguments": {}
      },
      "execution_complete": {
        "name": "execution_complete",
        "description": "Event emitted by ComfyUIClient",
        "arguments": {}
      },
      "executing": {
        "name": "executing",
        "description": "Event emitted by ComfyUIClient",
        "arguments": {}
      },
      "progress": {
        "name": "progress",
        "description": "Event emitted by ComfyUIClient",
        "arguments": {}
      },
      "executed": {
        "name": "executed",
        "description": "Event emitted by ComfyUIClient",
        "arguments": {}
      },
      "execution_cached": {
        "name": "execution_cached",
        "description": "Event emitted by ComfyUIClient",
        "arguments": {}
      },
      "execution_error": {
        "name": "execution_error",
        "description": "Event emitted by ComfyUIClient",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const comfy = container.client('comfyui', { baseURL: 'http://localhost:8188' })\nconst result = await comfy.runWorkflow(workflow, {\n '6': { text: 'a beautiful sunset' }\n})\nconsole.log(result.images)"
      }
    ],
    "types": {
      "WorkflowRunOptions": {
        "description": "",
        "properties": {
          "poll": {
            "type": "boolean",
            "description": "Use polling instead of WebSocket for tracking execution",
            "optional": true
          },
          "pollInterval": {
            "type": "number",
            "description": "Polling interval in ms (default 1000)",
            "optional": true
          },
          "inputMap": {
            "type": "InputMapping",
            "description": "Named input mapping: semantic name -> { nodeId, field }",
            "optional": true
          },
          "outputDir": {
            "type": "string",
            "description": "If provided, output images are downloaded to this directory",
            "optional": true
          }
        }
      },
      "WorkflowResult": {
        "description": "",
        "properties": {
          "promptId": {
            "type": "string",
            "description": ""
          },
          "outputs": {
            "type": "Record<string, any>",
            "description": ""
          },
          "images": {
            "type": "Array<{ filename: string; subfolder: string; type: string; localPath?: string }>",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "clients.elevenlabs",
    "description": "ElevenLabs client — text-to-speech synthesis via the ElevenLabs REST API. Provides methods for listing voices, listing models, and generating speech audio. Audio is returned as a Buffer; use `say()` for a convenience method that writes to disk.",
    "shortcut": "clients.elevenlabs",
    "className": "ElevenLabsClient",
    "methods": {
      "beforeRequest": {
        "description": "Inject the xi-api-key header before each request.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "connect": {
        "description": "Validate the API key by listing available models.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>",
        "examples": [
          {
            "language": "ts",
            "code": "await el.connect()"
          }
        ]
      },
      "listVoices": {
        "description": "List available voices with optional search and filtering.",
        "parameters": {
          "options": {
            "type": "{\n    search?: string\n    category?: string\n    voice_type?: string\n    page_size?: number\n    next_page_token?: string\n  }",
            "description": "Query parameters for filtering voices"
          }
        },
        "required": [],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "const voices = await el.listVoices()\nconst premade = await el.listVoices({ category: 'premade' })"
          }
        ]
      },
      "getVoice": {
        "description": "Get details for a single voice.",
        "parameters": {
          "voiceId": {
            "type": "string",
            "description": "The voice ID to look up"
          }
        },
        "required": [
          "voiceId"
        ],
        "returns": "Promise<any>",
        "examples": [
          {
            "language": "ts",
            "code": "const voice = await el.getVoice('21m00Tcm4TlvDq8ikWAM')\nconsole.log(voice.name, voice.settings)"
          }
        ]
      },
      "listModels": {
        "description": "List available TTS models.",
        "parameters": {},
        "required": [],
        "returns": "Promise<any[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const models = await el.listModels()\nconsole.log(models.map(m => m.model_id))"
          }
        ]
      },
      "synthesize": {
        "description": "Synthesize speech from text, returning audio as a Buffer.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to convert to speech"
          },
          "options": {
            "type": "SynthesizeOptions",
            "description": "Voice, model, format, and voice settings overrides",
            "properties": {
              "voiceId": {
                "type": "string",
                "description": ""
              },
              "modelId": {
                "type": "string",
                "description": ""
              },
              "outputFormat": {
                "type": "string",
                "description": ""
              },
              "voiceSettings": {
                "type": "ElevenLabsVoiceSettings",
                "description": ""
              },
              "disableCache": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "text"
        ],
        "returns": "Promise<Buffer>",
        "examples": [
          {
            "language": "ts",
            "code": "const audio = await el.synthesize('Hello world')\n// audio is a Buffer of mp3 data\n\nconst custom = await el.synthesize('Hello', {\n voiceId: '21m00Tcm4TlvDq8ikWAM',\n voiceSettings: { stability: 0.5, similarityBoost: 0.8 }\n})"
          }
        ]
      },
      "say": {
        "description": "Synthesize speech and write the audio to a file.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "The text to convert to speech"
          },
          "outputPath": {
            "type": "string",
            "description": "File path to write the audio to"
          },
          "options": {
            "type": "SynthesizeOptions",
            "description": "Voice, model, format, and voice settings overrides",
            "properties": {
              "voiceId": {
                "type": "string",
                "description": ""
              },
              "modelId": {
                "type": "string",
                "description": ""
              },
              "outputFormat": {
                "type": "string",
                "description": ""
              },
              "voiceSettings": {
                "type": "ElevenLabsVoiceSettings",
                "description": ""
              },
              "disableCache": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "text",
          "outputPath"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const path = await el.say('Hello world', './hello.mp3')\nconsole.log(`Audio saved to ${path}`)"
          }
        ]
      }
    },
    "getters": {
      "apiKey": {
        "description": "The resolved API key from options or environment.",
        "returns": "string"
      }
    },
    "events": {
      "failure": {
        "name": "failure",
        "description": "Event emitted by ElevenLabsClient",
        "arguments": {}
      },
      "voices": {
        "name": "voices",
        "description": "Event emitted by ElevenLabsClient",
        "arguments": {}
      },
      "speech": {
        "name": "speech",
        "description": "Event emitted by ElevenLabsClient",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const el = container.client('elevenlabs')\nawait el.connect()\nconst voices = await el.listVoices()\nconst audio = await el.synthesize('Hello world')\n// audio is a Buffer of mp3 data"
      }
    ],
    "types": {
      "SynthesizeOptions": {
        "description": "",
        "properties": {
          "voiceId": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "modelId": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "outputFormat": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "voiceSettings": {
            "type": "ElevenLabsVoiceSettings",
            "description": "",
            "optional": true
          },
          "disableCache": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      },
      "ElevenLabsVoiceSettings": {
        "description": "",
        "properties": {
          "stability": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "similarityBoost": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "style": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "speed": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "useSpeakerBoost": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "servers.mcp",
    "description": "MCP (Model Context Protocol) server for exposing tools, resources, and prompts to AI clients like Claude Code. Uses the low-level MCP SDK Server class directly with Zod 4 native JSON Schema conversion. Register tools, resources, and prompts programmatically, then start the server over stdio (for CLI integration) or HTTP (for remote access).",
    "shortcut": "servers.mcp",
    "className": "MCPServer",
    "methods": {
      "tool": {
        "description": "Register an MCP tool. The tool's Zod schema is converted to JSON Schema for the protocol listing, and used for runtime argument validation. Tool handlers can return a string (auto-wrapped as text content) or a full CallToolResult object for advanced responses (images, errors, etc).",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Unique tool name"
          },
          "options": {
            "type": "ToolRegistrationOptions",
            "description": "Tool schema, description, and handler",
            "properties": {
              "schema": {
                "type": "z.ZodType",
                "description": ""
              },
              "description": {
                "type": "string",
                "description": ""
              },
              "handler": {
                "type": "Function | ((args: any, ctx: any) => any)",
                "description": ""
              }
            }
          }
        },
        "required": [
          "name",
          "options"
        ],
        "returns": "this"
      },
      "resource": {
        "description": "Register an MCP resource. Resources expose data (files, configs, etc) that AI clients can read by URI. Accepts either a handler function directly or an options object with additional metadata (name, description, mimeType).",
        "parameters": {
          "uri": {
            "type": "string",
            "description": "Unique resource URI (e.g. \"project://readme\")"
          },
          "handlerOrOptions": {
            "type": "ResourceRegistrationOptions['handler'] | ResourceRegistrationOptions",
            "description": "Handler function or options object with handler"
          }
        },
        "required": [
          "uri",
          "handlerOrOptions"
        ],
        "returns": "this"
      },
      "prompt": {
        "description": "Register an MCP prompt. Prompts are reusable message templates that AI clients can invoke with optional string arguments.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Unique prompt name"
          },
          "options": {
            "type": "PromptRegistrationOptions",
            "description": "Prompt handler, optional args schema, and description",
            "properties": {
              "description": {
                "type": "string",
                "description": ""
              },
              "args": {
                "type": "Record<string, z.ZodType>",
                "description": ""
              },
              "handler": {
                "type": "(args: Record<string, string | undefined>, ctx: MCPContext) => Promise<PromptMessage[]> | PromptMessage[]",
                "description": ""
              }
            }
          }
        },
        "required": [
          "name",
          "options"
        ],
        "returns": "this"
      },
      "configure": {
        "description": "Configure the MCP protocol server and register all protocol handlers. Called automatically before start() if not already configured.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "start": {
        "description": "Start the MCP server with the specified transport.",
        "parameters": {
          "options": {
            "type": "{\n    transport?: 'stdio' | 'http'\n    port?: number\n    host?: string\n    mcpCompat?: MCPCompatMode\n    stdioCompat?: StdioCompatMode\n  }",
            "description": "Transport configuration. Defaults to stdio.",
            "properties": {
              "transport": {
                "type": "any",
                "description": "'stdio' for CLI integration, 'http' for remote access"
              },
              "port": {
                "type": "any",
                "description": "Port for HTTP transport (default 3001)"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "stop": {
        "description": "Stop the MCP server and close all connections.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      }
    },
    "getters": {
      "mcpServer": {
        "description": "The underlying MCP protocol server instance. Created during configure().",
        "returns": "MCPProtocolServer"
      },
      "handlerContext": {
        "description": "The handler context passed to all tool, resource, and prompt handlers.",
        "returns": "MCPContext"
      }
    },
    "events": {
      "toolRegistered": {
        "name": "toolRegistered",
        "description": "Event emitted by MCPServer",
        "arguments": {}
      },
      "resourceRegistered": {
        "name": "resourceRegistered",
        "description": "Event emitted by MCPServer",
        "arguments": {}
      },
      "promptRegistered": {
        "name": "promptRegistered",
        "description": "Event emitted by MCPServer",
        "arguments": {}
      },
      "toolCalled": {
        "name": "toolCalled",
        "description": "Event emitted by MCPServer",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const mcp = container.server('mcp', { serverName: 'my-server', serverVersion: '1.0.0' })\n\nmcp.tool('search_files', {\n schema: z.object({ pattern: z.string() }),\n description: 'Search for files',\n handler: async (args, ctx) => {\n   return ctx.container.feature('fs').walk('.', { include: [args.pattern] }).files.join('\\n')\n }\n})\n\nawait mcp.start()"
      }
    ],
    "types": {
      "ToolRegistrationOptions": {
        "description": "",
        "properties": {
          "schema": {
            "type": "z.ZodType",
            "description": "",
            "optional": true
          },
          "description": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "handler": {
            "type": "Function | ((args: any, ctx: any) => any)",
            "description": "",
            "optional": true
          }
        }
      },
      "ResourceRegistrationOptions": {
        "description": "",
        "properties": {
          "name": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "description": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "mimeType": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "handler": {
            "type": "(uri: string, ctx: MCPContext) => Promise<string> | string",
            "description": ""
          }
        }
      },
      "MCPContext": {
        "description": "Context object passed to all MCP tool, resource, and prompt handlers.",
        "properties": {
          "container": {
            "type": "NodeContainer",
            "description": ""
          }
        }
      },
      "PromptRegistrationOptions": {
        "description": "",
        "properties": {
          "description": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "args": {
            "type": "Record<string, z.ZodType>",
            "description": "",
            "optional": true
          },
          "handler": {
            "type": "(args: Record<string, string | undefined>, ctx: MCPContext) => Promise<PromptMessage[]> | PromptMessage[]",
            "description": ""
          }
        }
      },
      "PromptMessage": {
        "description": "",
        "properties": {
          "role": {
            "type": "'user' | 'assistant'",
            "description": ""
          },
          "content": {
            "type": "string",
            "description": ""
          }
        }
      }
    }
  },
  {
    "id": "servers.express",
    "description": "Express.js HTTP server with automatic endpoint mounting, CORS, and SPA history fallback. Wraps an Express application with convention-based endpoint discovery. Endpoints defined as modules are automatically mounted as routes. Supports static file serving, CORS configuration, and single-page app history fallback out of the box.",
    "shortcut": "servers.express",
    "className": "ExpressServer",
    "methods": {
      "start": {
        "description": "Start the Express HTTP server. A runtime `port` overrides the constructor option and is written to state so `server.port` always reflects reality.",
        "parameters": {
          "options": {
            "type": "StartOptions",
            "description": "Optional runtime overrides for port and host"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "stop": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "configure": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "useEndpoint": {
        "description": "",
        "parameters": {
          "endpoint": {
            "type": "Endpoint",
            "description": "Parameter endpoint"
          }
        },
        "required": [
          "endpoint"
        ],
        "returns": "this"
      },
      "useEndpoints": {
        "description": "",
        "parameters": {
          "dir": {
            "type": "string",
            "description": "Parameter dir"
          }
        },
        "required": [
          "dir"
        ],
        "returns": "Promise<this>"
      },
      "reloadEndpoint": {
        "description": "Reload a mounted endpoint by its file path. Re-reads the module through the helpers VM loader so the next request picks up the new handlers.",
        "parameters": {
          "filePath": {
            "type": "string",
            "description": "Absolute path to the endpoint file"
          }
        },
        "required": [
          "filePath"
        ],
        "returns": "Promise<Endpoint | null>"
      },
      "useEndpointModules": {
        "description": "",
        "parameters": {
          "modules": {
            "type": "EndpointModule[]",
            "description": "Parameter modules"
          }
        },
        "required": [
          "modules"
        ],
        "returns": "Promise<this>"
      },
      "serveOpenAPISpec": {
        "description": "",
        "parameters": {
          "options": {
            "type": "{ title?: string; version?: string; description?: string }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "this"
      },
      "generateOpenAPISpec": {
        "description": "",
        "parameters": {
          "options": {
            "type": "{ title?: string; version?: string; description?: string }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Record<string, any>"
      }
    },
    "getters": {
      "express": {
        "description": "",
        "returns": "typeof express"
      },
      "hooks": {
        "description": "",
        "returns": "{ create: (app: Express, server: Server) => Express; beforeStart: (options: any, server: Server) => any }"
      },
      "app": {
        "description": "",
        "returns": "Express"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const server = container.server('express', { cors: true, static: './public' })\nawait server.start({ port: 3000 })\n\n// Mount endpoints programmatically\nserver.mount(myEndpoint)\n\n// Access the underlying Express app\nserver.app.get('/health', (req, res) => res.json({ ok: true }))"
      }
    ]
  },
  {
    "id": "servers.websocket",
    "description": "WebSocket server built on the `ws` library with optional JSON message framing. Manages WebSocket connections, tracks connected clients, and bridges messages to Luca's event bus. When `json` mode is enabled, incoming messages are automatically JSON-parsed (with `.toString()` for Buffer data) and outgoing messages via `send()` / `broadcast()` are JSON-stringified. When `json` mode is disabled, raw message data is emitted as-is and `send()` / `broadcast()` still JSON-stringify for safety. Supports ask/reply semantics when paired with the Luca WebSocket client. The server can `ask(ws, type, data)` a connected client and await a typed response, or handle incoming asks from clients by listening for messages with a `requestId` and replying via `send(ws, { replyTo, data })`. Requests time out if no reply arrives within the configurable window.",
    "shortcut": "servers.websocket",
    "className": "WebsocketServer",
    "methods": {
      "broadcast": {
        "description": "",
        "parameters": {
          "message": {
            "type": "any",
            "description": "Parameter message"
          }
        },
        "required": [
          "message"
        ],
        "returns": "Promise<this>"
      },
      "send": {
        "description": "",
        "parameters": {
          "ws": {
            "type": "any",
            "description": "Parameter ws"
          },
          "message": {
            "type": "any",
            "description": "Parameter message"
          }
        },
        "required": [
          "ws",
          "message"
        ],
        "returns": "Promise<this>"
      },
      "ask": {
        "description": "Send a request to a specific client and wait for a correlated response. The client is expected to reply with a message whose `replyTo` matches the `requestId` of this message.",
        "parameters": {
          "ws": {
            "type": "any",
            "description": "The WebSocket client to ask"
          },
          "type": {
            "type": "string",
            "description": "A string identifying the request type"
          },
          "data": {
            "type": "any",
            "description": "Optional payload"
          },
          "timeout": {
            "type": "any",
            "description": "How long to wait (default 10 000 ms)"
          }
        },
        "required": [
          "ws",
          "type"
        ],
        "returns": "Promise<R>",
        "examples": [
          {
            "language": "ts",
            "code": "ws.on('connection', async (client) => {\n const info = await ws.ask(client, 'identify')\n console.log('Client says:', info)\n})"
          }
        ]
      },
      "start": {
        "description": "Start the WebSocket server. A runtime `port` overrides the constructor option and is written to state before the underlying `ws.Server` is created, so the server binds to the correct port.",
        "parameters": {
          "options": {
            "type": "StartOptions",
            "description": "Optional runtime overrides for port and host"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "stop": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      }
    },
    "getters": {
      "wss": {
        "description": "",
        "returns": "BaseServer"
      },
      "port": {
        "description": "The port this server will bind to. Defaults to 8081 if not set via constructor options or start().",
        "returns": "number"
      }
    },
    "events": {
      "connection": {
        "name": "connection",
        "description": "Event emitted by WebsocketServer",
        "arguments": {}
      },
      "message": {
        "name": "message",
        "description": "Event emitted by WebsocketServer",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const ws = container.server('websocket', { json: true })\nawait ws.start({ port: 8080 })\n\nws.on('message', (data, client) => {\n console.log('Received:', data)\n ws.broadcast({ echo: data })\n})\n\n// ask/reply: request info from a connected client\nws.on('connection', async (client) => {\n const info = await ws.ask(client, 'identify')\n console.log('Client says:', info)\n})"
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
    "className": "NodeContainer",
    "description": "Server-side container for Node.js and Bun environments. Extends the base Container with file system access, process management, git integration, and other server-side capabilities. Auto-enables core features on construction: fs, proc, git, grep, os, networking, ui, vm, transpiler, helpers. Also attaches Client, Server, Command, Endpoint, and Selector helper types, providing `container.client()`, `container.server()`, `container.command()`, etc. factory methods.",
    "methods": {},
    "getters": {
      "cwd": {
        "description": "Returns the current working directory, from options or process.cwd().",
        "returns": "string"
      },
      "manifest": {
        "description": "Returns the parsed package.json manifest for the current working directory.",
        "returns": "Record<string, any>"
      },
      "argv": {
        "description": "Returns the parsed command-line arguments (from minimist).",
        "returns": "Record<string, any> & { _: string[] }"
      },
      "urlUtils": {
        "description": "Returns URL utility functions for parsing URIs.",
        "returns": "{ parse: (uri: string) => url.UrlWithStringQuery }"
      },
      "paths": {
        "description": "Returns path utility functions scoped to the current working directory (join, resolve, relative, dirname, parse).",
        "returns": "{ dirname: (path: string) => string; join: (...paths: string[]) => string; resolve: (...paths: string[]) => string; relative: (...paths: string[]) => string; basename: typeof basename; parse: typeof parse }"
      }
    },
    "events": {}
  }
];
