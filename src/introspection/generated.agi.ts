import { setBuildTimeData, setContainerBuildTimeData } from './index.js';

// Auto-generated introspection registry data
// Generated at: 2026-02-23T05:53:41.714Z

setBuildTimeData('features.googleDocs', {
  "id": "features.googleDocs",
  "description": "Google Docs feature for reading documents and converting them to Markdown. Depends on googleAuth for authentication and optionally googleDrive for listing docs. The markdown converter handles headings, text formatting, links, lists, tables, and images.",
  "shortcut": "features.googleDocs",
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
  "methods": {
    "loadModules": {
      "description": "Pre-load ink + react modules so the sync getters work. Called automatically by render(), but you can call it early.",
      "parameters": {},
      "required": [],
      "returns": "void",
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
      "returns": "void"
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
    }
  },
  "getters": {
    "React": {
      "description": "The React module (createElement, useState, useEffect, etc.) Exposed so consumers don't need a separate react import. Lazy-loaded — first access triggers the import.",
      "returns": "any"
    },
    "components": {
      "description": "All Ink components as a single object for destructuring. ```ts const { Box, Text, Static, Spacer } = ink.components ```",
      "returns": "any"
    },
    "hooks": {
      "description": "All Ink hooks as a single object for destructuring. ```ts const { useInput, useApp, useFocus } = ink.hooks ```",
      "returns": "any"
    },
    "measureElement": {
      "description": "The Ink measureElement utility.",
      "returns": "any"
    },
    "isMounted": {
      "description": "Whether an ink app is currently mounted.",
      "returns": "boolean"
    },
    "instance": {
      "description": "The raw ink render instance if you need low-level access.",
      "returns": "any"
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

setBuildTimeData('features.git', {
  "id": "features.git",
  "description": "The Git feature provides utilities for interacting with Git repositories. This feature allows you to check repository status, list files, get branch information, and access Git metadata for projects within a Git repository.",
  "shortcut": "features.git",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const history = git.getChangeHistoryForFiles('src/container.ts', 'src/helper.ts')\nconst history = git.getChangeHistoryForFiles('src/node/features/*.ts')"
        }
      ]
    }
  },
  "getters": {
    "branch": {
      "description": "Gets the current Git branch name.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const currentBranch = git.branch\nif (currentBranch) {\n console.log(`Currently on branch: ${currentBranch}`)\n}"
        }
      ]
    },
    "sha": {
      "description": "Gets the current Git commit SHA hash.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const commitSha = git.sha\nif (commitSha) {\n console.log(`Current commit: ${commitSha}`)\n}"
        }
      ]
    },
    "isRepo": {
      "description": "Checks if the current directory is within a Git repository.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "if (git.isRepo) {\n console.log('This is a Git repository!')\n} else {\n console.log('Not in a Git repository')\n}"
        }
      ]
    },
    "isRepoRoot": {
      "description": "Checks if the current working directory is the root of the Git repository.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "if (git.isRepoRoot) {\n console.log('At the repository root')\n} else {\n console.log('In a subdirectory of the repository')\n}"
        }
      ]
    },
    "repoRoot": {
      "description": "Gets the absolute path to the Git repository root directory. This method caches the repository root path for performance. It searches upward from the current directory to find the .git directory.",
      "returns": "any",
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
  ]
});

setBuildTimeData('features.esbuild', {
  "id": "features.esbuild",
  "description": "A Feature for compiling typescript / esm modules, etc to JavaScript that the container can run at runtime. Uses esbuild for fast, reliable TypeScript/ESM transformation with full format support (esm, cjs, iife).",
  "shortcut": "features.esbuild",
  "methods": {
    "transformSync": {
      "description": "Transform code synchronously",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The code to transform"
        },
        "options": {
          "type": "esbuild.TransformOptions",
          "description": "The options to pass to esbuild"
        }
      },
      "required": [
        "code"
      ],
      "returns": "void"
    },
    "transform": {
      "description": "Transform code asynchronously",
      "parameters": {
        "code": {
          "type": "string",
          "description": "The code to transform"
        },
        "options": {
          "type": "esbuild.TransformOptions",
          "description": "The options to pass to esbuild"
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
      "code": "const esbuild = container.feature('esbuild')\nconst result = esbuild.transformSync('const x: number = 1')\nconsole.log(result.code) // 'const x = 1;\\n'"
    }
  ]
});

setBuildTimeData('features.downloader', {
  "id": "features.downloader",
  "description": "A feature that provides file downloading capabilities from URLs. The Downloader feature allows you to fetch files from remote URLs and save them to the local filesystem. It handles the network request, buffering, and file writing operations automatically.",
  "shortcut": "features.downloader",
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
      "returns": "void",
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

setBuildTimeData('features.windowManager', {
  "id": "features.windowManager",
  "description": "WindowManager Feature — Native window control via LucaVoiceLauncher Acts as an IPC server that the native macOS launcher app connects to. Communicates over a Unix domain socket using NDJSON (newline-delimited JSON). **Protocol:** - Bun listens on a Unix domain socket; the native app connects as a client - Window dispatch commands are sent as NDJSON with a `window` field - The app executes window commands and sends back `windowAck` messages - Any non-windowAck message from the app is emitted as a `message` event - Other features can use `send()` to write arbitrary NDJSON to the app **Capabilities:** - Spawn native browser windows with configurable chrome - Navigate, focus, close, and eval JavaScript in windows - Automatic socket file cleanup and fallback paths",
  "shortcut": "features.windowManager",
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
    "listen": {
      "description": "Start listening on the Unix domain socket for the native app to connect. Fire-and-forget — binds the socket and returns immediately. Sits quietly until the native app connects; does nothing visible if it never does.",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "Override the configured socket path"
        }
      },
      "required": [],
      "returns": "this"
    },
    "stop": {
      "description": "Stop the IPC server and clean up all connections. Rejects any pending window operation requests.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "spawn": {
      "description": "Spawn a new native browser window. Sends a window dispatch to the app and waits for the ack.",
      "parameters": {
        "opts": {
          "type": "SpawnOptions",
          "description": "Window configuration (url, dimensions, chrome options)",
          "properties": {
            "url": {
              "type": "string",
              "description": ""
            },
            "width": {
              "type": "number",
              "description": ""
            },
            "height": {
              "type": "number",
              "description": ""
            },
            "x": {
              "type": "number",
              "description": ""
            },
            "y": {
              "type": "number",
              "description": ""
            },
            "alwaysOnTop": {
              "type": "boolean",
              "description": ""
            },
            "window": {
              "type": "{\n    decorations?: 'normal' | 'hiddenTitleBar' | 'none'\n    transparent?: boolean\n    shadow?: boolean\n    alwaysOnTop?: boolean\n    opacity?: number\n    clickThrough?: boolean\n  }",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<WindowAckResult>"
    },
    "spawnTTY": {
      "description": "Spawn a native terminal window running a command. The terminal is read-only — stdout/stderr are rendered with ANSI support. Closing the window terminates the process.",
      "parameters": {
        "opts": {
          "type": "SpawnTTYOptions",
          "description": "Terminal configuration (command, args, cwd, dimensions, etc.)",
          "properties": {
            "command": {
              "type": "string",
              "description": "Executable name or path (required)."
            },
            "args": {
              "type": "string[]",
              "description": "Arguments passed after the command."
            },
            "cwd": {
              "type": "string",
              "description": "Working directory for the process."
            },
            "env": {
              "type": "Record<string, string>",
              "description": "Environment variable overrides."
            },
            "cols": {
              "type": "number",
              "description": "Initial terminal columns."
            },
            "rows": {
              "type": "number",
              "description": "Initial terminal rows."
            },
            "title": {
              "type": "string",
              "description": "Window title."
            },
            "width": {
              "type": "number",
              "description": "Window width in points."
            },
            "height": {
              "type": "number",
              "description": "Window height in points."
            },
            "x": {
              "type": "number",
              "description": "Window x position."
            },
            "y": {
              "type": "number",
              "description": "Window y position."
            },
            "window": {
              "type": "SpawnOptions['window']",
              "description": "Chrome options (decorations, alwaysOnTop, etc.)"
            }
          }
        }
      },
      "required": [
        "opts"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "focus": {
      "description": "Bring a window to the front.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID. If omitted, the app uses the most recent window."
        }
      },
      "required": [],
      "returns": "Promise<WindowAckResult>"
    },
    "close": {
      "description": "Close a window.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID. If omitted, the app closes the most recent window."
        }
      },
      "required": [],
      "returns": "Promise<WindowAckResult>"
    },
    "navigate": {
      "description": "Navigate a window to a new URL.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        },
        "url": {
          "type": "string",
          "description": "The URL to navigate to"
        }
      },
      "required": [
        "windowId",
        "url"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "eval": {
      "description": "Evaluate JavaScript in a window's web view.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        },
        "code": {
          "type": "string",
          "description": "JavaScript code to evaluate"
        },
        "opts": {
          "type": "{ timeoutMs?: number; returnJson?: boolean }",
          "description": "timeoutMs (default 5000), returnJson (default true)"
        }
      },
      "required": [
        "windowId",
        "code"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "screengrab": {
      "description": "Capture a PNG screenshot from a window.",
      "parameters": {
        "opts": {
          "type": "WindowScreenGrabOptions",
          "description": "Window target and output path",
          "properties": {
            "windowId": {
              "type": "string",
              "description": "Window ID. If omitted, the launcher uses the most recent window."
            },
            "path": {
              "type": "string",
              "description": "Output file path for the PNG image."
            }
          }
        }
      },
      "required": [
        "opts"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "video": {
      "description": "Record a video from a window to disk.",
      "parameters": {
        "opts": {
          "type": "WindowVideoOptions",
          "description": "Window target, output path, and optional duration",
          "properties": {
            "windowId": {
              "type": "string",
              "description": "Window ID. If omitted, the launcher uses the most recent window."
            },
            "path": {
              "type": "string",
              "description": "Output file path for the video file."
            },
            "durationMs": {
              "type": "number",
              "description": "Recording duration in milliseconds."
            }
          }
        }
      },
      "required": [
        "opts"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "window": {
      "description": "Get a WindowHandle for chainable operations on a specific window.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        }
      },
      "required": [
        "windowId"
      ],
      "returns": "WindowHandle"
    },
    "send": {
      "description": "Write an NDJSON message to the connected app client. Public so other features can send arbitrary protocol messages over the same socket.",
      "parameters": {
        "msg": {
          "type": "Record<string, any>",
          "description": "The message object to send (will be JSON-serialized + newline)"
        }
      },
      "required": [
        "msg"
      ],
      "returns": "boolean"
    }
  },
  "getters": {
    "isListening": {
      "description": "Whether the IPC server is currently listening.",
      "returns": "boolean"
    },
    "isClientConnected": {
      "description": "Whether the native app client is currently connected.",
      "returns": "boolean"
    }
  },
  "events": {
    "listening": {
      "name": "listening",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "clientConnected": {
      "name": "clientConnected",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "clientDisconnected": {
      "name": "clientDisconnected",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "windowAck": {
      "name": "windowAck",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "message": {
      "name": "message",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const wm = container.feature('windowManager', { enable: true, autoListen: true })\n\nconst result = await wm.spawn({ url: 'https://google.com', width: 800, height: 600 })\nconst handle = wm.window(result.windowId)\nawait handle.navigate('https://news.ycombinator.com')\nconst title = await handle.eval('document.title')\nawait handle.close()\n\n// Other features can listen for non-window messages\nwm.on('message', (msg) => console.log('App says:', msg))\n\n// Other features can write raw NDJSON to the app\nwm.send({ id: 'abc', status: 'processing', speech: 'Working on it' })"
    }
  ]
});

setBuildTimeData('features.proc', {
  "id": "features.proc",
  "description": "The ChildProcess feature provides utilities for executing external processes and commands. This feature wraps Node.js child process functionality to provide convenient methods for executing shell commands, spawning processes, and capturing their output. It supports both synchronous and asynchronous execution with various options.",
  "shortcut": "features.proc",
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
    "runScript": {
      "description": "Runs a script file with Bun, inheriting stdout for full TTY passthrough (animations, colors, cursor movement) while capturing stderr in a rolling buffer.",
      "parameters": {
        "scriptPath": {
          "type": "string",
          "description": "Absolute path to the script file"
        },
        "options": {
          "type": "{ cwd?: string; maxLines?: number; env?: Record<string, string> }",
          "description": "Options",
          "properties": {
            "cwd": {
              "type": "any",
              "description": "Working directory"
            },
            "maxLines": {
              "type": "any",
              "description": "Max stderr lines to keep"
            },
            "env": {
              "type": "any",
              "description": "Extra environment variables"
            }
          }
        }
      },
      "required": [
        "scriptPath"
      ],
      "returns": "Promise<{ exitCode: number; stderr: string[] }>",
      "examples": [
        {
          "language": "ts",
          "code": "const { exitCode, stderr } = await proc.runScript('/path/to/script.ts')\nif (exitCode !== 0) {\n console.log('Error:', stderr.join('\\n'))\n}"
        }
      ]
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
  ]
});

setBuildTimeData('features.launcherAppCommandListener', {
  "id": "features.launcherAppCommandListener",
  "description": "LauncherAppCommandListener — IPC transport for commands from the LucaVoiceLauncher app Listens on a Unix domain socket for the native macOS launcher app to connect. When a command event arrives (voice, hotkey, text input), it wraps it in a `CommandHandle` and emits a `command` event. The consumer is responsible for acknowledging, processing, and finishing the command via the handle. Uses NDJSON (newline-delimited JSON) over the socket per the CLIENT_SPEC protocol.",
  "shortcut": "features.launcherAppCommandListener",
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
    "listen": {
      "description": "Start listening on the Unix domain socket for the native app to connect. Fire-and-forget — binds the socket and returns immediately. Sits quietly until the native app connects; does nothing visible if it never does.",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "Override the configured socket path"
        }
      },
      "required": [],
      "returns": "this"
    },
    "stop": {
      "description": "Stop the IPC server and clean up all connections.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "send": {
      "description": "Write an NDJSON message to the connected app client.",
      "parameters": {
        "msg": {
          "type": "Record<string, any>",
          "description": "The message object to send (will be JSON-serialized + newline)"
        }
      },
      "required": [
        "msg"
      ],
      "returns": "boolean"
    }
  },
  "getters": {
    "isListening": {
      "description": "Whether the IPC server is currently listening.",
      "returns": "boolean"
    },
    "isClientConnected": {
      "description": "Whether the native app client is currently connected.",
      "returns": "boolean"
    }
  },
  "events": {
    "listening": {
      "name": "listening",
      "description": "Event emitted by LauncherAppCommandListener",
      "arguments": {}
    },
    "clientConnected": {
      "name": "clientConnected",
      "description": "Event emitted by LauncherAppCommandListener",
      "arguments": {}
    },
    "clientDisconnected": {
      "name": "clientDisconnected",
      "description": "Event emitted by LauncherAppCommandListener",
      "arguments": {}
    },
    "command": {
      "name": "command",
      "description": "Event emitted by LauncherAppCommandListener",
      "arguments": {}
    },
    "message": {
      "name": "message",
      "description": "Event emitted by LauncherAppCommandListener",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const listener = container.feature('launcherAppCommandListener', {\n enable: true,\n autoListen: true,\n})\n\nlistener.on('command', async (cmd) => {\n cmd.ack('Working on it!')     // or just cmd.ack() for silent\n\n // ... do your actual work ...\n cmd.progress(0.5, 'Halfway there')\n\n cmd.finish()                   // silent finish\n cmd.finish({ result: { action: 'completed' }, speech: 'All done!' })\n // or: cmd.fail({ error: 'not found', speech: 'Sorry, that failed.' })\n})"
    }
  ]
});

setBuildTimeData('features.vm', {
  "id": "features.vm",
  "description": "The VM feature provides Node.js virtual machine capabilities for executing JavaScript code. This feature wraps Node.js's built-in `vm` module to provide secure code execution in isolated contexts. It's useful for running untrusted code, creating sandboxed environments, or dynamically executing code with controlled access to variables and modules.",
  "shortcut": "features.vm",
  "methods": {
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
      "returns": "void",
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const context = vm.createContext({ user: { name: 'John' } })\nconst result = vm.runSync('user.name', context)"
        }
      ]
    },
    "run": {
      "description": "Executes JavaScript code in a controlled environment. This method creates a script from the provided code, sets up an execution context with the specified variables, and runs the code safely. It handles errors gracefully and returns either the result or the error object.",
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
      "returns": "Promise<T>",
      "examples": [
        {
          "language": "ts",
          "code": "// Simple calculation\nconst result = vm.run('2 + 3 * 4')\nconsole.log(result) // 14\n\n// Using context variables\nconst greeting = vm.run('`Hello ${name}!`', { name: 'Alice' })\nconsole.log(greeting) // 'Hello Alice!'\n\n// Array operations\nconst sum = vm.run('numbers.reduce((a, b) => a + b, 0)', { \n numbers: [1, 2, 3, 4, 5] \n})\nconsole.log(sum) // 15\n\n// Error handling\nconst error = vm.run('invalidFunction()')\nif (error instanceof Error) {\n console.log('Execution failed:', error.message)\n}"
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
  ]
});

setBuildTimeData('features.ui', {
  "id": "features.ui",
  "description": "UI Feature - Interactive Terminal User Interface Builder This feature provides comprehensive tools for creating beautiful, interactive terminal experiences. It combines several popular libraries (chalk, figlet, inquirer) into a unified interface for building professional CLI applications with colors, ASCII art, and interactive prompts. **Core Capabilities:** - Rich color management using chalk library - ASCII art generation with multiple fonts - Interactive prompts and wizards - Automatic color assignment for consistent theming - Text padding and formatting utilities - Gradient text effects (horizontal and vertical) - Banner creation with styled ASCII art **Color System:** - Full chalk API access for complex styling - Automatic color assignment with palette cycling - Consistent color mapping for named entities - Support for hex colors and gradients **ASCII Art Features:** - Multiple font options via figlet - Automatic font discovery and caching - Banner creation with color gradients - Text styling and effects **Interactive Elements:** - Wizard creation with inquirer integration - External editor integration - User input validation and processing **Usage Examples:** **Basic Colors:** ```typescript const ui = container.feature('ui'); // Direct color usage ui.print.red('Error message'); ui.print.green('Success!'); // Complex styling console.log(ui.colors.blue.bold.underline('Important text')); ``` **ASCII Art Banners:** ```typescript const banner = ui.banner('MyApp', { font: 'Big', colors: ['red', 'white', 'blue'] }); console.log(banner); ``` **Interactive Wizards:** ```typescript const answers = await ui.wizard([ { type: 'input', name: 'name', message: 'Your name?' }, { type: 'confirm', name: 'continue', message: 'Continue?' } ]); ``` **Automatic Color Assignment:** ```typescript const userColor = ui.assignColor('john'); const adminColor = ui.assignColor('admin'); console.log(userColor('John\\'s message')); console.log(adminColor('Admin notice')); ```",
  "shortcut": "features.ui",
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
      "returns": "void"
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
      "returns": "void",
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
      "returns": "void"
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void"
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "any",
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
              "description": "Custom path for the history file (defaults to node_modules/.cache/.repl_history)"
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

setBuildTimeData('features.tmux', {
  "id": "features.tmux",
  "description": "Terminal multiplexer feature that wraps tmux to provide programmatic control over terminal panes. Allows scripts to split the terminal into multiple panes, run commands in each pane with full process handles (await, cancel, observe output), and collapse everything back to a single pane when done.",
  "shortcut": "features.tmux",
  "methods": {
    "executeTmuxCommand": {
      "description": "Execute a tmux command and return the result. Follows the same pattern as Docker.executeDockerCommand.",
      "parameters": {
        "args": {
          "type": "string[]",
          "description": "Parameter args"
        }
      },
      "required": [
        "args"
      ],
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>"
    },
    "checkAvailability": {
      "description": "Check if tmux is available on this system.",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>"
    },
    "enable": {
      "description": "Initialize the tmux feature. Verifies tmux is available. Throws if tmux is not installed.",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "ensureSession": {
      "description": "Ensure we are running inside a tmux session. If already inside tmux, uses the current session. If not, re-execs the current script inside a new tmux session so the user actually sees panes. The current process is replaced (via execSync) — code after `ensureSession()` only runs inside tmux.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Session name. Defaults to `luca-{uuid}`."
        }
      },
      "required": [],
      "returns": "Promise<string>"
    },
    "killSession": {
      "description": "Kill the current session (or a named one).",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Parameter name"
        }
      },
      "required": [],
      "returns": "Promise<void>"
    },
    "split": {
      "description": "Split the current window into multiple panes.",
      "parameters": {
        "options": {
          "type": "SplitOptions",
          "description": "Split configuration",
          "properties": {
            "count": {
              "type": "number",
              "description": "Number of panes to create (splits the current pane this many times)"
            },
            "orientation": {
              "type": "'horizontal' | 'vertical'",
              "description": "Split direction: 'horizontal' splits side-by-side, 'vertical' splits top/bottom"
            },
            "size": {
              "type": "number",
              "description": "Percentage size for each new pane"
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<TmuxLayout>"
    },
    "runInPane": {
      "description": "Run a command in a specific pane. Returns a PaneProcess handle.",
      "parameters": {
        "paneId": {
          "type": "string",
          "description": "The tmux pane ID (e.g. \"%5\")"
        },
        "command": {
          "type": "string",
          "description": "The command string to execute"
        }
      },
      "required": [
        "paneId",
        "command"
      ],
      "returns": "Promise<PaneProcess>"
    },
    "capture": {
      "description": "Capture the current content of a pane.",
      "parameters": {
        "paneId": {
          "type": "string",
          "description": "The tmux pane ID"
        }
      },
      "required": [
        "paneId"
      ],
      "returns": "Promise<string>"
    },
    "sendKeys": {
      "description": "Send keys to a pane. If `literal` is provided, it's sent as a tmux key name (e.g. \"C-c\", \"Enter\"). Otherwise `text` is sent followed by Enter.",
      "parameters": {
        "paneId": {
          "type": "string",
          "description": "The tmux pane ID"
        },
        "text": {
          "type": "string",
          "description": "Text to type (followed by Enter)"
        },
        "literal": {
          "type": "string",
          "description": "A literal tmux key name (sent without Enter)"
        }
      },
      "required": [
        "paneId",
        "text"
      ],
      "returns": "Promise<void>"
    },
    "isPaneAlive": {
      "description": "Check if a pane is still alive.",
      "parameters": {
        "paneId": {
          "type": "string",
          "description": "Parameter paneId"
        }
      },
      "required": [
        "paneId"
      ],
      "returns": "Promise<boolean>"
    },
    "collapse": {
      "description": "Kill all managed panes except the first one, returning to a single pane view.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    }
  },
  "getters": {},
  "events": {
    "sessionCreated": {
      "name": "sessionCreated",
      "description": "Event emitted by Tmux",
      "arguments": {}
    },
    "sessionKilled": {
      "name": "sessionKilled",
      "description": "Event emitted by Tmux",
      "arguments": {}
    },
    "paneSplit": {
      "name": "paneSplit",
      "description": "Event emitted by Tmux",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const tmux = container.feature('tmux', { enable: true })\nawait tmux.ensureSession()\n\nconst layout = tmux.split({ count: 2, orientation: 'horizontal' })\n\nconst tests = await layout.panes[0].run('bun test')\nconst build = await layout.panes[1].run('bun run build')\n\ntests.events.on('output', (data) => console.log('tests:', data))\n\nawait layout.awaitAll()\nawait layout.collapse()"
    }
  ]
});

setBuildTimeData('features.scriptRunner', {
  "id": "features.scriptRunner",
  "description": "The ScriptRunner feature provides convenient access to npm scripts defined in package.json. This feature automatically generates camelCase methods for each script in the package.json file, allowing you to execute them programmatically with additional arguments and options.",
  "shortcut": "features.scriptRunner",
  "methods": {},
  "getters": {
    "scripts": {
      "description": "Gets an object containing executable functions for each npm script. Each script name from package.json is converted to camelCase and becomes a method that can be called with additional arguments and spawn options. Script names with colons (e.g., \"build:dev\") are converted by replacing colons with underscores before camelCasing.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const runner = scriptRunner.scripts\n\n// For a script named \"build:dev\" in package.json:\nawait runner.buildDev(['--watch'], { stdio: 'inherit' })\n\n// For a script named \"test\":\nconst result = await runner.test(['--coverage'])\nconsole.log(result.stdout)"
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
      "code": "const scriptRunner = container.feature('scriptRunner')\n\n// If package.json has \"build:dev\" script, you can call:\nawait scriptRunner.scripts.buildDev(['--watch'], { cwd: '/custom/path' })\n\n// If package.json has \"test\" script:\nawait scriptRunner.scripts.test(['--verbose'])"
    }
  ]
});

setBuildTimeData('features.os', {
  "id": "features.os",
  "description": "The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.",
  "shortcut": "features.os",
  "methods": {},
  "getters": {
    "arch": {
      "description": "Gets the operating system CPU architecture.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const arch = os.arch\nconsole.log(`Running on ${arch} architecture`)"
        }
      ]
    },
    "tmpdir": {
      "description": "Gets the operating system's default directory for temporary files.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const tempDir = os.tmpdir\nconsole.log(`Temp directory: ${tempDir}`)"
        }
      ]
    },
    "homedir": {
      "description": "Gets the current user's home directory path.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const home = os.homedir\nconsole.log(`User home: ${home}`)"
        }
      ]
    },
    "cpuCount": {
      "description": "Gets the number of logical CPU cores available on the system.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const cores = os.cpuCount\nconsole.log(`System has ${cores} CPU cores`)"
        }
      ]
    },
    "hostname": {
      "description": "Gets the hostname of the operating system.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const hostname = os.hostname\nconsole.log(`Hostname: ${hostname}`)"
        }
      ]
    },
    "platform": {
      "description": "Gets the operating system platform.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const platform = os.platform\nif (platform === 'darwin') {\n console.log('Running on macOS')\n}"
        }
      ]
    },
    "networkInterfaces": {
      "description": "Gets information about the system's network interfaces.",
      "returns": "any",
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
  ]
});

setBuildTimeData('features.tts', {
  "id": "features.tts",
  "description": "TTS feature — synthesizes text to audio files via RunPod's Chatterbox Turbo endpoint. Generates high-quality speech audio by calling the Chatterbox Turbo public endpoint on RunPod, downloads the resulting audio, and saves it locally. Supports 20 preset voices and voice cloning via a reference audio URL.",
  "shortcut": "features.tts",
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
  ]
});

setBuildTimeData('features.googleAuth', {
  "id": "features.googleAuth",
  "description": "Google authentication feature supporting OAuth2 browser flow and service account auth. Handles the complete OAuth2 lifecycle: authorization URL generation, local callback server, token exchange, refresh token storage (via diskCache), and automatic token refresh. Also supports non-interactive service account authentication via JSON key files. Other Google features (drive, sheets, calendar, docs) depend on this feature and access it lazily via `container.feature('googleAuth')`.",
  "shortcut": "features.googleAuth",
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
      "description": "Get the proc feature for executing shell commands",
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
      "code": "const docker = container.feature('docker', { enable: true })\nawait docker.checkDockerAvailability()\nconst containers = await docker.listContainers({ all: true })"
    }
  ]
});

setBuildTimeData('features.yaml', {
  "id": "features.yaml",
  "description": "The YAML feature provides utilities for parsing and stringifying YAML data. This feature wraps the js-yaml library to provide convenient methods for converting between YAML strings and JavaScript objects. It's automatically attached to Node containers for easy access.",
  "shortcut": "features.yaml",
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
      "returns": "void",
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "// Check if port 8080 is available\nconst isAvailable = await networking.isPortOpen(8080)\nif (isAvailable) {\n console.log('Port 8080 is free to use')\n} else {\n console.log('Port 8080 is already in use')\n}"
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
      "code": "const networking = container.feature('networking')\n\n// Find an available port starting from 3000\nconst port = await networking.findOpenPort(3000)\nconsole.log(`Available port: ${port}`)\n\n// Check if a specific port is available\nconst isAvailable = await networking.isPortOpen(8080)\nif (isAvailable) {\n console.log('Port 8080 is available')\n}"
    }
  ]
});

setBuildTimeData('features.vault', {
  "id": "features.vault",
  "description": "The Vault feature provides encryption and decryption capabilities using AES-256-GCM. This feature allows you to securely encrypt and decrypt sensitive data using industry-standard encryption. It manages secret keys and provides a simple interface for cryptographic operations.",
  "shortcut": "features.vault",
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
      "returns": "void"
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
      "returns": "void"
    }
  },
  "getters": {
    "secretText": {
      "description": "Gets the secret key as a base64-encoded string.",
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
      "code": "const vault = container.feature('vault')\n\n// Encrypt sensitive data\nconst encrypted = vault.encrypt('sensitive information')\nconsole.log(encrypted) // Base64 encoded encrypted data\n\n// Decrypt the data\nconst decrypted = vault.decrypt(encrypted)\nconsole.log(decrypted) // 'sensitive information'"
    }
  ]
});

setBuildTimeData('features.googleCalendar', {
  "id": "features.googleCalendar",
  "description": "Google Calendar feature for listing calendars and reading events. Depends on the googleAuth feature for authentication. Creates a Calendar v3 API client lazily. Provides convenience methods for today's events and upcoming days.",
  "shortcut": "features.googleCalendar",
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
  ]
});

setBuildTimeData('features.fs', {
  "id": "features.fs",
  "description": "The FS feature provides methods for interacting with the file system, relative to the container's cwd.",
  "shortcut": "features.fs",
  "methods": {
    "readFileAsync": {
      "description": "Asynchronously reads a file and returns its contents as a Buffer.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path relative to the container's working directory"
        }
      },
      "required": [
        "path"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const fs = container.feature('fs')\nconst buffer = await fs.readFileAsync('data.txt')\nconsole.log(buffer.toString())"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const fs = container.feature('fs')\nconst entries = await fs.readdir('src')\nconsole.log(entries) // ['index.ts', 'utils.ts', 'components']"
        }
      ]
    },
    "walk": {
      "description": "Recursively walks a directory and returns an array of relative path names for each file and directory.",
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
              "description": "] - Patterns to exclude from results"
            },
            "include": {
              "type": "string | string[]",
              "description": "] - Patterns to include in results"
            }
          }
        }
      },
      "required": [
        "basePath"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const result = fs.walk('src', { files: true, directories: false })\nconsole.log(result.files) // ['src/index.ts', 'src/utils.ts', 'src/components/Button.tsx']"
        }
      ]
    },
    "walkAsync": {
      "description": "Asynchronously and recursively walks a directory and returns an array of relative path names.",
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
              "description": "] - Patterns to exclude from results"
            },
            "include": {
              "type": "string | string[]",
              "description": "] - Patterns to include in results"
            }
          }
        }
      },
      "required": [
        "baseDir"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const result = await fs.walkAsync('src', { exclude: ['node_modules'] })\nconsole.log(`Found ${result.files.length} files and ${result.directories.length} directories`)"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.ensureFileAsync('config/settings.json', '{}', true)\n// Creates config directory and settings.json file with '{}' content"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.writeFileAsync('output.txt', 'Hello World')\nawait fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.ensureFolder('logs/debug')\n// Creates logs and logs/debug directories if they don't exist"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "fs.ensureFile('logs/app.log', '', false)\n// Creates logs directory and app.log file if they don't exist"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "if (await fs.existsAsync('config.json')) {\n console.log('Config file exists!')\n}"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.rm('temp/cache.tmp')"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const config = fs.readJson('config.json')\nconsole.log(config.version)"
        }
      ]
    },
    "readFile": {
      "description": "Synchronously reads a file and returns its contents as a string.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The path to the file"
        }
      },
      "required": [
        "path"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const content = fs.readFile('README.md')\nconsole.log(content)"
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "await fs.rmdir('temp/cache')\n// Removes the cache directory and all its contents"
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
      "code": "const fs = container.feature('fs')\nconst content = fs.readFile('package.json')\nconst exists = fs.exists('tsconfig.json')\nawait fs.ensureFileAsync('output/result.json', '{}')"
    }
  ]
});

setBuildTimeData('features.ipcSocket', {
  "id": "features.ipcSocket",
  "description": "IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Dual-mode operation: server and client functionality - JSON message serialization/deserialization - Multiple client connection support (server mode) - Event-driven message handling - Automatic socket cleanup and management - Broadcast messaging to all connected clients - Lock file management for socket paths **Communication Pattern:** - Messages are automatically JSON-encoded with unique IDs - Both server and client emit 'message' events for incoming data - Server can broadcast to all connected clients - Client maintains single connection to server **Socket Management:** - Automatic cleanup of stale socket files - Connection tracking and management - Graceful shutdown procedures - Lock file protection against conflicts **Usage Examples:** **Server Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/myapp.sock', true); // removeLock=true ipc.on('connection', (socket) => { console.log('Client connected'); }); ipc.on('message', (data) => { console.log('Received:', data); ipc.broadcast({ reply: 'ACK', original: data }); }); ``` **Client Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/myapp.sock'); ipc.on('message', (data) => { console.log('Server says:', data); }); await ipc.send({ type: 'request', payload: 'hello' }); ```",
  "shortcut": "features.ipcSocket",
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
      "description": "Broadcasts a message to all connected clients (server mode only). This method sends a JSON-encoded message with a unique ID to every client currently connected to the server. Each message is automatically wrapped with metadata including a UUID for tracking. **Message Format:** Messages are automatically wrapped in the format: ```json { \"data\": <your_message>, \"id\": \"<uuid>\" } ```",
      "parameters": {
        "message": {
          "type": "any",
          "description": "The message object to broadcast to all clients"
        }
      },
      "required": [
        "message"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "// Broadcast to all connected clients\nipc.broadcast({ \n type: 'notification',\n message: 'Server is shutting down in 30 seconds',\n timestamp: Date.now()\n});\n\n// Chain multiple operations\nipc.broadcast({ status: 'ready' })\n  .broadcast({ time: new Date().toISOString() });"
        }
      ]
    },
    "send": {
      "description": "Sends a message to the server (client mode only). This method sends a JSON-encoded message with a unique ID to the connected server. The message is automatically wrapped with metadata for tracking purposes. **Message Format:** Messages are automatically wrapped in the format: ```json { \"data\": <your_message>, \"id\": \"<uuid>\" } ```",
      "parameters": {
        "message": {
          "type": "any",
          "description": "The message object to send to the server"
        }
      },
      "required": [
        "message"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "// Send a simple message\nawait ipc.send({ type: 'ping' });\n\n// Send complex data\nawait ipc.send({\n type: 'data_update',\n payload: { users: [...], timestamp: Date.now() }\n});"
        }
      ]
    },
    "connect": {
      "description": "Connects to an IPC server at the specified socket path (client mode). This method establishes a client connection to an existing IPC server. Once connected, the client can send messages to the server and receive responses. The connection is maintained until explicitly closed or the server terminates. **Connection Behavior:** - Sets the socket mode to 'client' - Returns existing connection if already connected - Automatically handles connection events and cleanup - JSON-parses incoming messages and emits 'message' events - Cleans up connection reference when socket closes **Error Handling:** - Throws error if already in server mode - Rejects promise on connection failures - Automatically cleans up on connection close",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "The file system path to the server's Unix domain socket"
        }
      },
      "required": [
        "socketPath"
      ],
      "returns": "Promise<Socket>",
      "examples": [
        {
          "language": "ts",
          "code": "// Connect to server\nconst socket = await ipc.connect('/tmp/myapp.sock');\nconsole.log('Connected to IPC server');\n\n// Handle incoming messages\nipc.on('message', (data) => {\n console.log('Server message:', data);\n});\n\n// Send messages\nawait ipc.send({ type: 'hello', client_id: 'client_001' });"
        }
      ]
    }
  },
  "getters": {
    "isClient": {
      "description": "Checks if the IPC socket is operating in client mode.",
      "returns": "any"
    },
    "isServer": {
      "description": "Checks if the IPC socket is operating in server mode.",
      "returns": "any"
    },
    "connection": {
      "description": "Gets the current client connection socket.",
      "returns": "any"
    }
  },
  "events": {
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
          "description": "Optional cache directory path (defaults to options.path or node_modules/.cache/luca-disk-cache)"
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
      "returns": "any"
    },
    "securely": {
      "description": "Get encrypted cache operations interface Requires encryption to be enabled and a secret to be provided",
      "returns": "any",
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
  "description": "The Python VM feature provides Python virtual machine capabilities for executing Python code. This feature automatically detects Python environments (uv, conda, venv, system) and provides methods to install dependencies and execute Python scripts. It can manage project-specific Python environments and maintain context between executions.",
  "shortcut": "features.python",
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
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const python = container.feature('python', { \n dir: \"/path/to/python/project\",\n contextScript: \"/path/to/setup-context.py\"\n})\n\n// Auto-install dependencies\nawait python.installDependencies()\n\n// Execute Python code\nconst result = await python.execute('print(\"Hello from Python!\")')\n\n// Execute with custom variables\nconst result2 = await python.execute('print(f\"Hello {name}!\")', { name: 'World' })"
    }
  ]
});

setBuildTimeData('features.jsonTree', {
  "id": "features.jsonTree",
  "description": "JsonTree Feature - A powerful JSON file tree loader and processor This feature provides functionality to recursively load JSON files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive JSON file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Native JSON parsing for optimal performance **Path Processing:** Files are processed to create a nested object structure: - Directory names become object properties (camelCased) - File names become the final property names (without .json extension) - Nested directories create nested objects **Usage Example:** ```typescript const jsonTree = container.feature('jsonTree', { enable: true }); await jsonTree.loadTree('data', 'appData'); const userData = jsonTree.tree.appData.users.profiles; ``` **Directory Structure Example:** ``` data/ users/ profiles.json    -> tree.data.users.profiles settings.json    -> tree.data.users.settings config/ app-config.json  -> tree.data.config.appConfig ```",
  "shortcut": "features.jsonTree",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
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
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "// Get all non-development packages (those not in devDependencies)\nconst prodPackages = finder.exclude(pkg => isDevDependency(pkg.name));\n\n// Get all non-scoped packages\nconst unscoped = finder.exclude(pkg => pkg.name.startsWith('@'));"
        }
      ]
    }
  },
  "getters": {
    "duplicates": {
      "description": "Gets a list of package names that have multiple versions/instances installed. This is useful for identifying potential dependency conflicts or opportunities for deduplication in the project.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const duplicates = finder.duplicates;\n// ['lodash', 'react', '@types/node'] - packages with multiple versions\n\nduplicates.forEach(name => {\n console.log(`${name} has ${finder.packages[name].length} versions`);\n});"
        }
      ]
    },
    "isStarted": {
      "description": "Checks if the package finder has completed its initial scan.",
      "returns": "any"
    },
    "packageNames": {
      "description": "Gets an array of all unique package names discovered in the workspace.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const names = finder.packageNames;\nconsole.log(`Found ${names.length} unique packages`);"
        }
      ]
    },
    "scopes": {
      "description": "Gets an array of all scoped package prefixes found in the workspace. Scoped packages are those starting with '@' (e.g., @types/node, @babel/core). This returns just the scope part (e.g., '@types', '@babel').",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const scopes = finder.scopes;\n// ['@types', '@babel', '@angular'] - all scopes in use\n\nscopes.forEach(scope => {\n const scopedPackages = finder.packageNames.filter(name => name.startsWith(scope));\n console.log(`${scope}: ${scopedPackages.length} packages`);\n});"
        }
      ]
    },
    "manifests": {
      "description": "Gets a flat array of all package manifests found in the workspace. This includes all versions/instances of packages, unlike packageNames which returns unique names only.",
      "returns": "any",
      "examples": [
        {
          "language": "ts",
          "code": "const all = finder.manifests;\nconsole.log(`Total package instances: ${all.length}`);\n\n// Group by name to see duplicates\nconst grouped = all.reduce((acc, pkg) => {\n acc[pkg.name] = (acc[pkg.name] || 0) + 1;\n return acc;\n}, {});"
        }
      ]
    },
    "counts": {
      "description": "Gets a count of instances for each package name. Useful for quickly identifying which packages have multiple versions and how many instances of each exist.",
      "returns": "any",
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
  "envVars": []
});

setBuildTimeData('features.processManager', {
  "id": "features.processManager",
  "description": "Manages long-running child processes with tracking, events, and automatic cleanup. Unlike the `proc` feature whose spawn methods block until the child exits, ProcessManager returns a SpawnHandler immediately — a handle object with its own state, events, and lifecycle methods. The feature tracks all spawned processes, maintains observable state, and can automatically kill them on parent exit.",
  "shortcut": "features.processManager",
  "methods": {
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
      "code": "const pm = container.feature('processManager', { enable: true })\n\nconst server = pm.spawn('node', ['server.js'], { tag: 'api', cwd: '/app' })\nserver.on('stdout', (data) => console.log('[api]', data))\nserver.on('crash', (code) => console.error('API crashed:', code))\n\n// Kill one\nserver.kill()\n\n// Kill all tracked processes\npm.killAll()\n\n// List and lookup\npm.list()              // SpawnHandler[]\npm.getByTag('api')     // SpawnHandler | undefined"
    }
  ]
});

setBuildTimeData('portExposer', {
  "id": "portExposer",
  "description": "Port Exposer Feature Exposes local HTTP services via ngrok with SSL-enabled public URLs. Perfect for development, testing, and sharing local services securely. Features: - SSL-enabled public URLs for local services - Custom subdomains and domains (with paid plans) - Authentication options (basic auth, OAuth) - Regional endpoint selection - Connection state management",
  "shortcut": "portExposer",
  "methods": {
    "expose": {
      "description": "Expose the local port via ngrok. Creates an ngrok tunnel to the specified local port and returns the SSL-enabled public URL. Emits `exposed` on success or `error` on failure.",
      "parameters": {
        "port": {
          "type": "number",
          "description": "Optional port override; falls back to `options.port`"
        }
      },
      "required": [],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const exposer = container.feature('portExposer', { port: 3000 })\nconst url = await exposer.expose()\nconsole.log(`Public URL: ${url}`)\n\n// Override port at call time\nconst url2 = await exposer.expose(8080)"
        }
      ]
    },
    "close": {
      "description": "Stop exposing the port and close the ngrok tunnel. Tears down the ngrok listener, resets connection state, and emits `closed`. Safe to call when no tunnel is active (no-op).",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>",
      "examples": [
        {
          "language": "ts",
          "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\n// ... later\nawait exposer.close()\nconsole.log(exposer.isConnected()) // false"
        }
      ]
    },
    "getPublicUrl": {
      "description": "Get the current public URL if connected. Returns the live URL from the ngrok listener, or `undefined` if no tunnel is active.",
      "parameters": {},
      "required": [],
      "returns": "string | undefined",
      "examples": [
        {
          "language": "ts",
          "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\nconsole.log(exposer.getPublicUrl()) // 'https://abc123.ngrok.io'"
        }
      ]
    },
    "isConnected": {
      "description": "Check if the ngrok tunnel is currently connected.",
      "parameters": {},
      "required": [],
      "returns": "boolean",
      "examples": [
        {
          "language": "ts",
          "code": "const exposer = container.feature('portExposer', { port: 3000 })\nconsole.log(exposer.isConnected()) // false\nawait exposer.expose()\nconsole.log(exposer.isConnected()) // true"
        }
      ]
    },
    "getConnectionInfo": {
      "description": "Get a snapshot of the current connection information. Returns an object with the tunnel's connected status, public URL, local port, connection timestamp, and session metadata.",
      "parameters": {},
      "required": [],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\nconst info = exposer.getConnectionInfo()\nconsole.log(info.publicUrl, info.localPort, info.connectedAt)"
        }
      ]
    },
    "reconnect": {
      "description": "Close the existing tunnel and re-expose with optionally updated options. Calls `close()` first, merges any new options, then calls `expose()`.",
      "parameters": {
        "newOptions": {
          "type": "Partial<PortExposerOptions>",
          "description": "Optional partial options to merge before reconnecting"
        }
      },
      "required": [],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\n// Switch to a different port\nconst newUrl = await exposer.reconnect({ port: 8080 })"
        }
      ]
    },
    "disable": {
      "description": "Disable the feature, ensuring the ngrok tunnel is closed first. Overrides the base `disable()` to guarantee that the tunnel is torn down before the feature is marked as disabled.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>",
      "examples": [
        {
          "language": "ts",
          "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\nawait exposer.disable()"
        }
      ]
    }
  },
  "getters": {},
  "events": {
    "exposed": {
      "name": "exposed",
      "description": "Event emitted by PortExposer",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by PortExposer",
      "arguments": {}
    },
    "closed": {
      "name": "closed",
      "description": "Event emitted by PortExposer",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "// Basic usage\nconst exposer = container.feature('portExposer', { port: 3000 })\nconst url = await exposer.expose()\nconsole.log(`Service available at: ${url}`)\n\n// With custom subdomain\nconst exposer = container.feature('portExposer', {\n port: 8080,\n subdomain: 'my-app',\n authToken: 'your-ngrok-token'\n})"
    }
  ]
});

setBuildTimeData('features.googleSheets', {
  "id": "features.googleSheets",
  "description": "Google Sheets feature for reading spreadsheet data as JSON, CSV, or raw arrays. Depends on the googleAuth feature for authentication. Creates a Sheets v4 API client lazily and provides convenient methods for reading tabular data.",
  "shortcut": "features.googleSheets",
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
  ]
});

setBuildTimeData('features.secureShell', {
  "id": "features.secureShell",
  "description": "SecureShell Feature -- SSH command execution and SCP file transfers. Uses the system `ssh` and `scp` binaries to run commands on remote hosts and transfer files. Supports key-based and password-based authentication through the container's `proc` feature.",
  "shortcut": "features.secureShell",
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
  "getters": {},
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

setBuildTimeData('features.runpod', {
  "id": "features.runpod",
  "description": "RunPod feature — manage GPU cloud pods, templates, volumes, and SSH connections via the RunPod REST API. Provides a complete interface for provisioning and managing RunPod GPU instances. Supports creating pods from templates, managing network storage volumes, SSH access via the SecureShell feature, file transfers, and polling for pod readiness.",
  "shortcut": "features.runpod",
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
  ]
});

setBuildTimeData('features.helpers', {
  "id": "features.helpers",
  "description": "The Helpers feature is a unified gateway for discovering and registering project-level helpers from conventional folder locations. It scans known folder names (features/, clients/, servers/, commands/, endpoints/) and handles registration differently based on the helper type: - Class-based (features, clients, servers): Dynamic import, validate subclass, register - Config-based (commands, endpoints): Delegate to existing discovery mechanisms",
  "shortcut": "features.helpers",
  "methods": {
    "discover": {
      "description": "Discover and register project-level helpers of the given type. For class-based types (features, clients, servers), scans the matching directory for .ts files, dynamically imports each, validates the default export is a subclass of the registry's base class, and registers it. For config-based types (commands, endpoints), delegates to existing discovery mechanisms.",
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
      "description": "Discover all helper types from their conventional folder locations.",
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
    }
  },
  "getters": {
    "rootDir": {
      "description": "The root directory to scan for helper folders.",
      "returns": "string"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
    },
    "watch": {
      "description": "Watches the files in the project and updates the file manager state.",
      "parameters": {
        "options": {
          "type": "{ exclude?: string | string[] }",
          "description": "Options for the file manager",
          "properties": {
            "exclude": {
              "type": "any",
              "description": "The patterns to exclude from the watch"
            }
          }
        }
      },
      "required": [],
      "returns": "void"
    },
    "stopWatching": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
    }
  },
  "getters": {
    "fileIds": {
      "description": "Returns an array of all relative file paths indexed by the file manager.",
      "returns": "any"
    },
    "fileObjects": {
      "description": "Returns an array of all file metadata objects indexed by the file manager.",
      "returns": "any"
    },
    "directoryIds": {
      "description": "Returns the directory IDs for all of the files in the project.",
      "returns": "any"
    },
    "uniqueExtensions": {
      "description": "Returns an array of unique file extensions found across all indexed files.",
      "returns": "any"
    },
    "isStarted": {
      "description": "Whether the file manager has completed its initial scan.",
      "returns": "any"
    },
    "isStarting": {
      "description": "Whether the file manager is currently performing its initial scan.",
      "returns": "any"
    },
    "isWatching": {
      "description": "Whether the file watcher is actively monitoring for changes.",
      "returns": "any"
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
  ]
});

setBuildTimeData('features.contentDb', {
  "id": "features.contentDb",
  "description": "Provides access to a Contentbase Collection for a folder of structured markdown files. Models are defined in the collection's models.ts file and auto-discovered on load. This feature is a thin wrapper that manages the collection lifecycle and provides convenience accessors for models and documents.",
  "shortcut": "features.contentDb",
  "methods": {
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
    }
  },
  "getters": {
    "isLoaded": {
      "description": "Whether the content database has been loaded.",
      "returns": "any"
    },
    "collection": {
      "description": "Returns the lazily-initialized Collection instance for the configured rootPath.",
      "returns": "any"
    },
    "collectionPath": {
      "description": "Returns the absolute resolved path to the collection root directory.",
      "returns": "any"
    },
    "models": {
      "description": "Returns an object mapping model names to their model definitions, sourced from the collection.",
      "returns": "Record<string, ModelDefinition>"
    },
    "modelNames": {
      "description": "Returns an array of all registered model names from the collection.",
      "returns": "string[]"
    }
  },
  "events": {},
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

setBuildTimeData('servers.mcp', {
  "id": "servers.mcp",
  "description": "MCP (Model Context Protocol) server for exposing tools, resources, and prompts to AI clients like Claude Code. Uses the low-level MCP SDK Server class directly with Zod 4 native JSON Schema conversion. Register tools, resources, and prompts programmatically, then start the server over stdio (for CLI integration) or HTTP (for remote access).",
  "shortcut": "servers.mcp",
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
              "type": "z.ZodObject<any>",
              "description": ""
            },
            "description": {
              "type": "string",
              "description": ""
            },
            "handler": {
              "type": "(args: any, ctx: MCPContext) => any",
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
      "returns": "void"
    },
    "start": {
      "description": "Start the MCP server with the specified transport.",
      "parameters": {
        "options": {
          "type": "{ transport?: 'stdio' | 'http', port?: number, host?: string }",
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
      "returns": "void"
    },
    "stop": {
      "description": "Stop the MCP server and close all connections.",
      "parameters": {},
      "required": [],
      "returns": "void"
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
  ]
});

setBuildTimeData('servers.express', {
  "id": "servers.express",
  "description": "ExpressServer helper",
  "shortcut": "servers.express",
  "methods": {
    "start": {
      "description": "",
      "parameters": {
        "options": {
          "type": "StartOptions",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "void"
    },
    "configure": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
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
      "returns": "any"
    },
    "hooks": {
      "description": "",
      "returns": "any"
    },
    "app": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('servers.websocket', {
  "id": "servers.websocket",
  "description": "WebsocketServer helper",
  "shortcut": "servers.websocket",
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
      "returns": "void"
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
      "returns": "void"
    },
    "start": {
      "description": "",
      "parameters": {
        "options": {
          "type": "StartOptions",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "wss": {
      "description": "",
      "returns": "any"
    },
    "port": {
      "description": "",
      "returns": "any"
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
  "envVars": []
});

setBuildTimeData('features.assistantsManager', {
  "id": "features.assistantsManager",
  "description": "Discovers and manages assistant definitions from a local directory. Each subdirectory in the configured folder is treated as an assistant definition that can contain CORE.md, tools.ts, hooks.ts, and a docs/ folder. Use `discover()` to scan for available assistants, `list()` to enumerate them, and `create(name)` to instantiate one as a running Assistant feature.",
  "shortcut": "features.assistantsManager",
  "methods": {
    "afterInitialize": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "discover": {
      "description": "Scans the assistants folder for subdirectories and probes each for CORE.md, tools.ts, hooks.ts, and docs/. Populates the internal entries map.",
      "parameters": {},
      "required": [],
      "returns": "this"
    },
    "list": {
      "description": "Returns all discovered assistant entries as an array.",
      "parameters": {},
      "required": [],
      "returns": "AssistantEntry[]"
    },
    "get": {
      "description": "Looks up a single assistant entry by name.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The assistant subdirectory name"
        }
      },
      "required": [
        "name"
      ],
      "returns": "AssistantEntry | undefined"
    },
    "create": {
      "description": "Creates and returns a new Assistant feature instance for the given name. The assistant is configured with the discovered folder path. Any additional options are merged in.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The assistant name (must match a discovered entry)"
        },
        "options": {
          "type": "Record<string, any>",
          "description": "Additional options to pass to the Assistant constructor"
        }
      },
      "required": [
        "name"
      ],
      "returns": "Assistant",
      "examples": [
        {
          "language": "ts",
          "code": "const assistant = manager.create('my-helper', { model: 'gpt-4.1' })"
        }
      ]
    },
    "getInstance": {
      "description": "Returns a previously created assistant instance by name.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The assistant name"
        }
      },
      "required": [
        "name"
      ],
      "returns": "Assistant | undefined"
    },
    "toSummary": {
      "description": "Generates a markdown summary of all discovered assistants, listing their names and which definition files are present.",
      "parameters": {},
      "required": [],
      "returns": "string"
    }
  },
  "getters": {
    "assistantsFolder": {
      "description": "The absolute path to the assistants folder.",
      "returns": "string"
    }
  },
  "events": {
    "discovered": {
      "name": "discovered",
      "description": "Event emitted by AssistantsManager",
      "arguments": {}
    },
    "assistantCreated": {
      "name": "assistantCreated",
      "description": "Event emitted by AssistantsManager",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const manager = container.feature('assistantsManager', { folder: 'assistants' })\nawait manager.discover()\nconsole.log(manager.list()) // [{ name: 'my-helper', folder: '...', ... }]\nconst assistant = manager.create('my-helper')\nconst answer = await assistant.ask('Hello!')"
    }
  ]
});

setBuildTimeData('features.conversation', {
  "id": "features.conversation",
  "description": "A self-contained conversation with OpenAI that supports streaming, tool calling, and message state management.",
  "shortcut": "features.conversation",
  "methods": {
    "ask": {
      "description": "Send a message and get a streamed response. Automatically handles tool calls by invoking the registered handlers and feeding results back to the model until a final text response is produced.",
      "parameters": {
        "content": {
          "type": "string | ContentPart[]",
          "description": "The user message, either a string or array of content parts (text + images)"
        }
      },
      "required": [
        "content"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const reply = await conversation.ask(\"What's the weather in SF?\")\n// With image:\nconst reply = await conversation.ask([\n { type: 'text', text: 'What is in this diagram?' },\n { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }\n])"
        }
      ]
    },
    "save": {
      "description": "Persist this conversation to disk via conversationHistory. Creates a new record if this conversation hasn't been saved before, or updates the existing one.",
      "parameters": {
        "opts": {
          "type": "{ title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }",
          "description": "Optional overrides for title, tags, thread, or metadata"
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "tools": {
      "description": "Returns the registered tools available for the model to call.",
      "returns": "Record<string, any>"
    },
    "mcpServers": {
      "description": "Returns configured remote MCP servers keyed by server label.",
      "returns": "Record<string, ConversationMCPServer>"
    },
    "messages": {
      "description": "Returns the full message history of the conversation.",
      "returns": "Message[]"
    },
    "model": {
      "description": "Returns the OpenAI model name being used for completions.",
      "returns": "string"
    },
    "apiMode": {
      "description": "Returns the active completion API mode after resolving auto/local behavior.",
      "returns": "'responses' | 'chat'"
    },
    "isStreaming": {
      "description": "Whether a streaming response is currently in progress.",
      "returns": "boolean"
    },
    "openai": {
      "description": "Returns the OpenAI client instance from the container.",
      "returns": "any"
    },
    "history": {
      "description": "Returns the conversationHistory feature for persistence.",
      "returns": "ConversationHistory"
    }
  },
  "events": {
    "userMessage": {
      "name": "userMessage",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "turnStart": {
      "name": "turnStart",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "rawEvent": {
      "name": "rawEvent",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "mcpEvent": {
      "name": "mcpEvent",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "chunk": {
      "name": "chunk",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "preview": {
      "name": "preview",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "responseCompleted": {
      "name": "responseCompleted",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "toolCallsStart": {
      "name": "toolCallsStart",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "toolError": {
      "name": "toolError",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "toolCall": {
      "name": "toolCall",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "toolResult": {
      "name": "toolResult",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "toolCallsEnd": {
      "name": "toolCallsEnd",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "turnEnd": {
      "name": "turnEnd",
      "description": "Event emitted by Conversation",
      "arguments": {}
    },
    "response": {
      "name": "response",
      "description": "Event emitted by Conversation",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const conversation = container.feature('conversation', {\n model: 'gpt-4.1',\n tools: myToolMap,\n history: [{ role: 'system', content: 'You are a helpful assistant.' }]\n})\nconst reply = await conversation.ask('What is the meaning of life?')"
    }
  ]
});

setBuildTimeData('features.openapi', {
  "id": "features.openapi",
  "description": "The OpenAPI feature loads an OpenAPI/Swagger spec from a URL and provides inspection and conversion utilities. Works in both browser and node environments since it uses fetch.",
  "shortcut": "features.openapi",
  "methods": {
    "load": {
      "description": "Fetches and parses the OpenAPI spec from the configured URL. Populates `endpoints`, updates state with spec metadata.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "endpoint": {
      "description": "Get a single endpoint by its friendly name or operationId.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The friendly name or operationId to look up"
        }
      },
      "required": [
        "name"
      ],
      "returns": "EndpointInfo | undefined"
    },
    "toTools": {
      "description": "Convert all endpoints into OpenAI-compatible tool definitions.",
      "parameters": {
        "filter": {
          "type": "(ep: EndpointInfo) => boolean",
          "description": "Optional predicate to select which endpoints to include"
        }
      },
      "required": [],
      "returns": "OpenAIToolDef[]"
    },
    "toTool": {
      "description": "Convert a single endpoint (by name) to an OpenAI-compatible tool definition.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The endpoint friendly name or operationId"
        }
      },
      "required": [
        "name"
      ],
      "returns": "OpenAIToolDef | undefined"
    },
    "toFunctions": {
      "description": "Convert all endpoints into OpenAI-compatible function definitions.",
      "parameters": {
        "filter": {
          "type": "(ep: EndpointInfo) => boolean",
          "description": "Optional predicate to select which endpoints to include"
        }
      },
      "required": [],
      "returns": "OpenAIFunctionDef[]"
    },
    "toFunction": {
      "description": "Convert a single endpoint (by name) to an OpenAI function definition.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The endpoint friendly name or operationId"
        }
      },
      "required": [
        "name"
      ],
      "returns": "OpenAIFunctionDef | undefined"
    },
    "toJSON": {
      "description": "Return a compact JSON summary of all endpoints, useful for logging or REPL inspection.",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "serverUrl": {
      "description": "The base server URL derived from options, normalizing the openapi.json suffix",
      "returns": "string"
    },
    "specUrl": {
      "description": "The URL that will be fetched for the spec document",
      "returns": "string"
    },
    "spec": {
      "description": "The raw spec object. Null before load() is called.",
      "returns": "any"
    },
    "endpoints": {
      "description": "All parsed endpoints as an array",
      "returns": "EndpointInfo[]"
    },
    "endpointNames": {
      "description": "All endpoint friendly names",
      "returns": "string[]"
    },
    "endpointsByTag": {
      "description": "Map of endpoints grouped by tag",
      "returns": "Record<string, EndpointInfo[]>"
    }
  },
  "events": {
    "loaded": {
      "name": "loaded",
      "description": "Event emitted by OpenAPI",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const api = container.feature('openapi', { url: 'https://petstore.swagger.io/v2' })\nawait api.load()\n\n// Inspect all endpoints\napi.endpoints\n\n// Get a single endpoint by its friendly name\napi.endpoint('getPetById')\n\n// Convert to OpenAI tool definitions\napi.toTools()\n\n// Convert a single endpoint to a function definition\napi.toFunction('getPetById')"
    }
  ]
});

setBuildTimeData('features.docsReader', {
  "id": "features.docsReader",
  "description": "A docs reader that wraps a ContentDb and provides a Conversation with tools to list, outline, and read documents. Ask it a question and it will find and read the relevant docs to answer it.",
  "shortcut": "features.docsReader",
  "methods": {
    "buildTools": {
      "description": "Build the tool definitions (listDocs, readDoc, readDocOutline, readDocs) that the conversation model uses to query the content database.",
      "parameters": {},
      "required": [],
      "returns": "Record<string, ConversationTool>"
    },
    "buildSystemPrompt": {
      "description": "Build the system prompt by combining the optional prefix with a table of contents generated from the content database.",
      "parameters": {},
      "required": [],
      "returns": "string"
    },
    "createConversation": {
      "description": "Create and return a new Conversation feature configured with the docs reader's system prompt and tools.",
      "parameters": {},
      "required": [],
      "returns": "Conversation"
    },
    "start": {
      "description": "Initialize the docs reader by loading the content database, creating the conversation, and emitting the start event.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "ask": {
      "description": "Ask the docs reader a question. It will read relevant documents and return an answer based on their content.",
      "parameters": {
        "question": {
          "type": "string",
          "description": "The question to ask"
        }
      },
      "required": [
        "question"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "contentDb": {
      "description": "The ContentDb instance this reader draws from.",
      "returns": "ContentDb"
    },
    "isStarted": {
      "description": "Whether the reader has been started and is ready to answer questions.",
      "returns": "any"
    }
  },
  "events": {
    "start": {
      "name": "start",
      "description": "Event emitted by DocsReader",
      "arguments": {}
    },
    "preview": {
      "name": "preview",
      "description": "Event emitted by DocsReader",
      "arguments": {}
    },
    "answered": {
      "name": "answered",
      "description": "Event emitted by DocsReader",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const reader = container.feature('docsReader', {\n contentDb: myContentDb,\n model: 'gpt-4.1'\n})\nawait reader.start()\nconst answer = await reader.ask('How does authentication work?')"
    }
  ]
});

setBuildTimeData('features.skillsLibrary', {
  "id": "features.skillsLibrary",
  "description": "Manages two contentbase collections of skills following the Claude Code SKILL.md format. Project-level skills live in .claude/skills/ and user-level skills live in ~/.luca/skills/. Skills can be discovered, searched, created, updated, and removed at runtime.",
  "shortcut": "features.skillsLibrary",
  "methods": {
    "load": {
      "description": "Loads both project and user skill collections from disk. Gracefully handles missing directories.",
      "parameters": {},
      "required": [],
      "returns": "Promise<SkillsLibrary>"
    },
    "list": {
      "description": "Lists all skills from both collections. Project skills come first.",
      "parameters": {},
      "required": [],
      "returns": "SkillEntry[]"
    },
    "find": {
      "description": "Finds a skill by name. Project skills take precedence over user skills.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The skill name to find (case-insensitive)"
        }
      },
      "required": [
        "name"
      ],
      "returns": "SkillEntry | undefined"
    },
    "search": {
      "description": "Searches skills by substring match against name and description.",
      "parameters": {
        "query": {
          "type": "string",
          "description": "The search query"
        }
      },
      "required": [
        "query"
      ],
      "returns": "SkillEntry[]"
    },
    "getSkill": {
      "description": "Gets a skill by name. Alias for find().",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The skill name"
        }
      },
      "required": [
        "name"
      ],
      "returns": "SkillEntry | undefined"
    },
    "create": {
      "description": "Creates a new SKILL.md file in the specified collection. Maintains the directory-per-skill structure (skill-name/SKILL.md).",
      "parameters": {
        "skill": {
          "type": "{\n\t\t\tname: string\n\t\t\tdescription: string\n\t\t\tbody: string\n\t\t\tmeta?: Record<string, unknown>\n\t\t}",
          "description": "The skill to create"
        },
        "target": {
          "type": "'project' | 'user'",
          "description": "Which collection to write to (default: 'project')"
        }
      },
      "required": [
        "skill"
      ],
      "returns": "Promise<SkillEntry>"
    },
    "update": {
      "description": "Updates an existing skill's content or metadata.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The skill name to update"
        },
        "updates": {
          "type": "{\n\t\t\tdescription?: string\n\t\t\tbody?: string\n\t\t\tmeta?: Record<string, unknown>\n\t\t}",
          "description": "Fields to update"
        }
      },
      "required": [
        "name",
        "updates"
      ],
      "returns": "Promise<SkillEntry>"
    },
    "remove": {
      "description": "Removes a skill by name, deleting its SKILL.md and cleaning up the directory.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "The skill name to remove"
        }
      },
      "required": [
        "name"
      ],
      "returns": "Promise<boolean>"
    },
    "toConversationTools": {
      "description": "Converts all skills into ConversationTool format for use with Conversation. Each skill becomes a tool that returns its instruction body when invoked.",
      "parameters": {},
      "required": [],
      "returns": "Record<string, ConversationTool>"
    },
    "toSystemPromptBlock": {
      "description": "Generates a markdown block listing all available skills with names and descriptions. Suitable for injecting into a system prompt.",
      "parameters": {},
      "required": [],
      "returns": "string"
    }
  },
  "getters": {
    "projectCollection": {
      "description": "Returns the project-level contentbase Collection, lazily initialized.",
      "returns": "Collection"
    },
    "userCollection": {
      "description": "Returns the user-level contentbase Collection, lazily initialized.",
      "returns": "Collection"
    },
    "isLoaded": {
      "description": "Whether the skills library has been loaded.",
      "returns": "boolean"
    },
    "skillNames": {
      "description": "Array of all skill names across both collections.",
      "returns": "string[]"
    }
  },
  "events": {
    "loaded": {
      "name": "loaded",
      "description": "Event emitted by SkillsLibrary",
      "arguments": {}
    },
    "skillCreated": {
      "name": "skillCreated",
      "description": "Event emitted by SkillsLibrary",
      "arguments": {}
    },
    "skillUpdated": {
      "name": "skillUpdated",
      "description": "Event emitted by SkillsLibrary",
      "arguments": {}
    },
    "skillRemoved": {
      "name": "skillRemoved",
      "description": "Event emitted by SkillsLibrary",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const skills = container.feature('skillsLibrary')\nawait skills.load()\n\n// List and search\nconst allSkills = skills.list()\nconst matches = skills.search('code review')\n\n// Create a new skill\nawait skills.create({\n name: 'summarize',\n description: 'Summarize a document',\n body: '## Instructions\\nRead the document and produce a concise summary.'\n})"
    }
  ]
});

setBuildTimeData('features.assistant', {
  "id": "features.assistant",
  "description": "An Assistant is a combination of a system prompt and tool calls that has a conversation with an LLM. You define an assistant by creating a folder with CORE.md (system prompt), tools.ts (tool implementations), hooks.ts (event handlers), and a docs/ subfolder of structured markdown the assistant can research. Every assistant automatically gets a researchInternalDocs tool backed by a DocsReader that can query the assistant's docs/ folder.",
  "shortcut": "features.assistant",
  "methods": {
    "afterInitialize": {
      "description": "Called immediately after the assistant is constructed. Synchronously loads the system prompt, tools, and hooks using the VM's runSync, creates the contentDb if a docs/ folder exists, then fires the `created` hook.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "loadSystemPrompt": {
      "description": "Load the system prompt from CORE.md, applying any prepend/append options.",
      "parameters": {},
      "required": [],
      "returns": "string"
    },
    "loadTools": {
      "description": "Load tools from tools.ts using the container's VM feature, injecting the container and assistant as globals. Merges with any tools provided in the constructor options. Runs synchronously via vm.loadModule.",
      "parameters": {},
      "required": [],
      "returns": "Record<string, ConversationTool>"
    },
    "loadHooks": {
      "description": "Load event hooks from hooks.ts. Each exported function name should match an event the assistant emits. When that event fires, the corresponding hook function is called. Runs synchronously via vm.loadModule.",
      "parameters": {},
      "required": [],
      "returns": "Record<string, (...args: any[]) => any>"
    },
    "initDocsReader": {
      "description": "Initialize the DocsReader for the assistant's docs/ folder, using the contentDb created during initialization. This loads documents and sets up the research tools.",
      "parameters": {},
      "required": [],
      "returns": "Promise<DocsReader | undefined>"
    },
    "start": {
      "description": "Start the assistant by loading the docs reader, creating the conversation, and wiring up events. The system prompt, tools, hooks, and contentDb are already loaded synchronously during initialization.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "ask": {
      "description": "Ask the assistant a question. It will use its tools and docs to produce a streamed response. The assistant auto-starts if needed.",
      "parameters": {
        "question": {
          "type": "string | ContentPart[]",
          "description": "The question to ask"
        }
      },
      "required": [
        "question"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const answer = await assistant.ask('What capabilities do you have?')"
        }
      ]
    },
    "save": {
      "description": "Save the conversation to disk via conversationHistory.",
      "parameters": {
        "opts": {
          "type": "{ title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }",
          "description": "Optional overrides for title, tags, thread, or metadata"
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "resolvedFolder": {
      "description": "The absolute resolved path to the assistant folder.",
      "returns": "string"
    },
    "docsFolder": {
      "description": "The path to the docs subfolder.",
      "returns": "string"
    },
    "corePromptPath": {
      "description": "The path to CORE.md which provides the system prompt.",
      "returns": "string"
    },
    "toolsModulePath": {
      "description": "The path to tools.ts which provides tool implementations and schemas.",
      "returns": "string"
    },
    "hooksModulePath": {
      "description": "The path to hooks.ts which provides event handler functions.",
      "returns": "string"
    },
    "contentDb": {
      "description": "",
      "returns": "ContentDb"
    },
    "isStarted": {
      "description": "Whether the assistant has been started and is ready to receive questions.",
      "returns": "boolean"
    },
    "systemPrompt": {
      "description": "The current system prompt text.",
      "returns": "string"
    },
    "tools": {
      "description": "The tools registered with this assistant.",
      "returns": "Record<string, ConversationTool>"
    }
  },
  "events": {
    "created": {
      "name": "created",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "turnStart": {
      "name": "turnStart",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "turnEnd": {
      "name": "turnEnd",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "chunk": {
      "name": "chunk",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "preview": {
      "name": "preview",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "response": {
      "name": "response",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "rawEvent": {
      "name": "rawEvent",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "mcpEvent": {
      "name": "mcpEvent",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "toolCall": {
      "name": "toolCall",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "toolResult": {
      "name": "toolResult",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "toolError": {
      "name": "toolError",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "started": {
      "name": "started",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "hookFired": {
      "name": "hookFired",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "hookError": {
      "name": "hookError",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "hookCompleted": {
      "name": "hookCompleted",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "answered": {
      "name": "answered",
      "description": "Event emitted by Assistant",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const assistant = container.feature('assistant', {\n folder: 'assistants/my-helper'\n})\nconst answer = await assistant.ask('What capabilities do you have?')"
    }
  ]
});

setBuildTimeData('features.claudeCode', {
  "id": "features.claudeCode",
  "description": "Claude Code CLI wrapper feature. Spawns and manages Claude Code sessions as subprocesses, streaming structured JSON events back through the container's event system. Sessions are long-lived: each call to `run()` spawns a `claude -p` process with `--output-format stream-json`, parses NDJSON from stdout line-by-line, and emits typed events on the feature's event bus.",
  "shortcut": "features.claudeCode",
  "methods": {
    "checkAvailability": {
      "description": "Check if the Claude CLI is available and capture its version.",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>",
      "examples": [
        {
          "language": "ts",
          "code": "const available = await cc.checkAvailability()\nif (!available) throw new Error('Claude CLI not found')"
        }
      ]
    },
    "writeMcpConfig": {
      "description": "Write an MCP server config map to a temp file suitable for `--mcp-config`.",
      "parameters": {
        "servers": {
          "type": "Record<string, McpServerConfig>",
          "description": "Server configs keyed by name"
        }
      },
      "required": [
        "servers"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const configPath = await cc.writeMcpConfig({\n 'my-api': { type: 'http', url: 'https://api.example.com/mcp' },\n 'local-tool': { type: 'stdio', command: 'bun', args: ['run', 'server.ts'] }\n})"
        }
      ]
    },
    "run": {
      "description": "Run a prompt in a new Claude Code session. Spawns a subprocess, streams NDJSON events, and resolves when the session completes.",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "The instruction/prompt to send"
        },
        "options": {
          "type": "RunOptions",
          "description": "Session configuration overrides",
          "properties": {
            "model": {
              "type": "string",
              "description": "Override model for this session."
            },
            "cwd": {
              "type": "string",
              "description": "Override working directory."
            },
            "systemPrompt": {
              "type": "string",
              "description": "System prompt for this session."
            },
            "appendSystemPrompt": {
              "type": "string",
              "description": "Append system prompt for this session."
            },
            "permissionMode": {
              "type": "'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'",
              "description": "Permission mode override."
            },
            "allowedTools": {
              "type": "string[]",
              "description": "Allowed tools override."
            },
            "disallowedTools": {
              "type": "string[]",
              "description": "Disallowed tools override."
            },
            "streaming": {
              "type": "boolean",
              "description": "Whether to stream partial messages."
            },
            "resumeSessionId": {
              "type": "string",
              "description": "Resume a previous session by ID."
            },
            "continue": {
              "type": "boolean",
              "description": "Continue the most recent conversation."
            },
            "addDirs": {
              "type": "string[]",
              "description": "Additional directories to allow tool access to."
            },
            "mcpConfig": {
              "type": "string[]",
              "description": "MCP config file paths."
            },
            "mcpServers": {
              "type": "Record<string, McpServerConfig>",
              "description": "MCP servers to inject, keyed by server name."
            },
            "dangerouslySkipPermissions": {
              "type": "boolean",
              "description": "Skip all permission checks (only for sandboxed environments)."
            },
            "extraArgs": {
              "type": "string[]",
              "description": "Additional arbitrary CLI flags."
            },
            "fileLogPath": {
              "type": "string",
              "description": "Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath."
            },
            "fileLogLevel": {
              "type": "FileLogLevel",
              "description": "Verbosity level for file logging. Overrides feature-level fileLogLevel."
            }
          }
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<ClaudeSession>",
      "examples": [
        {
          "language": "ts",
          "code": "// Simple one-shot\nconst session = await cc.run('What files are in this project?')\nconsole.log(session.result)\n\n// With options\nconst session = await cc.run('Refactor the auth module', {\n model: 'opus',\n cwd: '/path/to/project',\n permissionMode: 'acceptEdits',\n streaming: true\n})\n\n// With injected MCP servers\nconst session = await cc.run('Use the database tools to list tables', {\n mcpServers: {\n   'db-tools': { type: 'stdio', command: 'bun', args: ['run', 'db-mcp.ts'] },\n   'api': { type: 'http', url: 'https://api.example.com/mcp' }\n }\n})\n\n// Resume a previous session\nconst session = await cc.run('Now add tests for that', {\n resumeSessionId: previousSession.sessionId\n})"
        }
      ]
    },
    "start": {
      "description": "Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "The instruction/prompt to send"
        },
        "options": {
          "type": "RunOptions",
          "description": "Session configuration overrides",
          "properties": {
            "model": {
              "type": "string",
              "description": "Override model for this session."
            },
            "cwd": {
              "type": "string",
              "description": "Override working directory."
            },
            "systemPrompt": {
              "type": "string",
              "description": "System prompt for this session."
            },
            "appendSystemPrompt": {
              "type": "string",
              "description": "Append system prompt for this session."
            },
            "permissionMode": {
              "type": "'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'",
              "description": "Permission mode override."
            },
            "allowedTools": {
              "type": "string[]",
              "description": "Allowed tools override."
            },
            "disallowedTools": {
              "type": "string[]",
              "description": "Disallowed tools override."
            },
            "streaming": {
              "type": "boolean",
              "description": "Whether to stream partial messages."
            },
            "resumeSessionId": {
              "type": "string",
              "description": "Resume a previous session by ID."
            },
            "continue": {
              "type": "boolean",
              "description": "Continue the most recent conversation."
            },
            "addDirs": {
              "type": "string[]",
              "description": "Additional directories to allow tool access to."
            },
            "mcpConfig": {
              "type": "string[]",
              "description": "MCP config file paths."
            },
            "mcpServers": {
              "type": "Record<string, McpServerConfig>",
              "description": "MCP servers to inject, keyed by server name."
            },
            "dangerouslySkipPermissions": {
              "type": "boolean",
              "description": "Skip all permission checks (only for sandboxed environments)."
            },
            "extraArgs": {
              "type": "string[]",
              "description": "Additional arbitrary CLI flags."
            },
            "fileLogPath": {
              "type": "string",
              "description": "Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath."
            },
            "fileLogLevel": {
              "type": "FileLogLevel",
              "description": "Verbosity level for file logging. Overrides feature-level fileLogLevel."
            }
          }
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<string>",
      "examples": [
        {
          "language": "ts",
          "code": "const sessionId = cc.start('Build a REST API for users')\n\ncc.on('session:delta', ({ sessionId: sid, text }) => {\n if (sid === sessionId) process.stdout.write(text)\n})\n\ncc.on('session:result', ({ sessionId: sid, result }) => {\n if (sid === sessionId) console.log('\\nDone:', result)\n})"
        }
      ]
    },
    "abort": {
      "description": "Kill a running session's subprocess.",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "The local session ID to abort"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "void",
      "examples": [
        {
          "language": "ts",
          "code": "const sessionId = cc.start('Do something long')\n// ... later\ncc.abort(sessionId)"
        }
      ]
    },
    "getSession": {
      "description": "Get a session by its local ID.",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "The local session ID"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "ClaudeSession | undefined",
      "examples": [
        {
          "language": "ts",
          "code": "const session = cc.getSession(sessionId)\nif (session?.status === 'completed') {\n console.log(session.result)\n}"
        }
      ]
    },
    "waitForSession": {
      "description": "Wait for a running session to complete.",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "The local session ID"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "Promise<ClaudeSession>",
      "examples": [
        {
          "language": "ts",
          "code": "const id = cc.start('Build something cool')\nconst session = await cc.waitForSession(id)\nconsole.log(session.result)"
        }
      ]
    },
    "cleanupMcpTempFiles": {
      "description": "Clean up any temp MCP config files created during sessions.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "enable": {
      "description": "Initialize the feature.",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Enable options"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    }
  },
  "getters": {
    "claudePath": {
      "description": "Resolve the path to the claude CLI binary.",
      "returns": "string"
    }
  },
  "events": {
    "session:log-error": {
      "name": "session:log-error",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:event": {
      "name": "session:event",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:init": {
      "name": "session:init",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:delta": {
      "name": "session:delta",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:stream": {
      "name": "session:stream",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:message": {
      "name": "session:message",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:result": {
      "name": "session:result",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:start": {
      "name": "session:start",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:parse-error": {
      "name": "session:parse-error",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:error": {
      "name": "session:error",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    },
    "session:abort": {
      "name": "session:abort",
      "description": "Event emitted by ClaudeCode",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const cc = container.feature('claudeCode')\n\n// Listen for events\ncc.on('session:delta', ({ sessionId, text }) => process.stdout.write(text))\ncc.on('session:result', ({ sessionId, result }) => console.log('Done:', result))\n\n// Run a prompt\nconst session = await cc.run('Explain the architecture of this project')\nconsole.log(session.result)"
    }
  ]
});

setBuildTimeData('features.openaiCodex', {
  "id": "features.openaiCodex",
  "description": "OpenAI Codex CLI wrapper feature. Spawns and manages Codex sessions as subprocesses, streaming structured JSON events back through the container's event system. Mirrors the ClaudeCode feature pattern: each call to `run()` spawns a `codex exec --json` process, parses NDJSON from stdout line-by-line, and emits typed events on the feature's event bus.",
  "shortcut": "features.openaiCodex",
  "methods": {
    "checkAvailability": {
      "description": "Check if the Codex CLI is available and capture its version.",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>"
    },
    "run": {
      "description": "Run a prompt in a new Codex session. Spawns a subprocess, streams NDJSON events, and resolves when the session completes.",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "The natural language instruction for the Codex agent"
        },
        "options": {
          "type": "CodexRunOptions",
          "description": "Optional overrides for model, cwd, sandbox policy, etc.",
          "properties": {
            "model": {
              "type": "string",
              "description": ""
            },
            "cwd": {
              "type": "string",
              "description": ""
            },
            "sandbox": {
              "type": "'read-only' | 'workspace-write' | 'danger-full-access'",
              "description": ""
            },
            "approvalMode": {
              "type": "'suggest' | 'auto-edit' | 'full-auto'",
              "description": ""
            },
            "projectDoc": {
              "type": "string",
              "description": ""
            },
            "noProjectDoc": {
              "type": "boolean",
              "description": ""
            },
            "fullStdout": {
              "type": "boolean",
              "description": ""
            },
            "images": {
              "type": "string[]",
              "description": ""
            },
            "fullAuto": {
              "type": "boolean",
              "description": ""
            },
            "resumeSessionId": {
              "type": "string",
              "description": "Resume a previous session by ID."
            },
            "resumeLast": {
              "type": "boolean",
              "description": "Resume the most recent session."
            },
            "dangerouslyAutoApproveEverything": {
              "type": "boolean",
              "description": "Skip all approvals and sandboxing."
            },
            "extraArgs": {
              "type": "string[]",
              "description": "Additional CLI flags."
            }
          }
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<CodexSession>",
      "examples": [
        {
          "language": "ts",
          "code": "const session = await codex.run('Fix the failing tests')\nconsole.log(session.result)\n\nconst session = await codex.run('Refactor the auth module', {\n model: 'o4-mini',\n fullAuto: true,\n cwd: '/path/to/project'\n})"
        }
      ]
    },
    "start": {
      "description": "Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "The natural language instruction for the Codex agent"
        },
        "options": {
          "type": "CodexRunOptions",
          "description": "Optional overrides for model, cwd, sandbox policy, etc.",
          "properties": {
            "model": {
              "type": "string",
              "description": ""
            },
            "cwd": {
              "type": "string",
              "description": ""
            },
            "sandbox": {
              "type": "'read-only' | 'workspace-write' | 'danger-full-access'",
              "description": ""
            },
            "approvalMode": {
              "type": "'suggest' | 'auto-edit' | 'full-auto'",
              "description": ""
            },
            "projectDoc": {
              "type": "string",
              "description": ""
            },
            "noProjectDoc": {
              "type": "boolean",
              "description": ""
            },
            "fullStdout": {
              "type": "boolean",
              "description": ""
            },
            "images": {
              "type": "string[]",
              "description": ""
            },
            "fullAuto": {
              "type": "boolean",
              "description": ""
            },
            "resumeSessionId": {
              "type": "string",
              "description": "Resume a previous session by ID."
            },
            "resumeLast": {
              "type": "boolean",
              "description": "Resume the most recent session."
            },
            "dangerouslyAutoApproveEverything": {
              "type": "boolean",
              "description": "Skip all approvals and sandboxing."
            },
            "extraArgs": {
              "type": "string[]",
              "description": "Additional CLI flags."
            }
          }
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "string",
      "examples": [
        {
          "language": "ts",
          "code": "const sessionId = codex.start('Build a REST API for users')\n\ncodex.on('session:delta', ({ sessionId: sid, text }) => {\n if (sid === sessionId) process.stdout.write(text)\n})"
        }
      ]
    },
    "abort": {
      "description": "Kill a running session's subprocess.",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "The session ID to abort"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "void"
    },
    "getSession": {
      "description": "Retrieve the current state of a session by its ID.",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "The session ID to look up"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "CodexSession | undefined"
    },
    "waitForSession": {
      "description": "Wait for a running session to complete or error. Resolves immediately if the session is already in a terminal state.",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "The session ID to wait for"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "Promise<CodexSession>"
    },
    "enable": {
      "description": "Enable the feature. Delegates to the base Feature enable() lifecycle.",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Options to merge into the feature configuration"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    }
  },
  "getters": {
    "codexPath": {
      "description": "",
      "returns": "string"
    }
  },
  "events": {
    "session:event": {
      "name": "session:event",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:delta": {
      "name": "session:delta",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:message": {
      "name": "session:message",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:tool-call": {
      "name": "session:tool-call",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:tool-result": {
      "name": "session:tool-result",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:exec": {
      "name": "session:exec",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:patch": {
      "name": "session:patch",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:start": {
      "name": "session:start",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:parse-error": {
      "name": "session:parse-error",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:error": {
      "name": "session:error",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:result": {
      "name": "session:result",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    },
    "session:abort": {
      "name": "session:abort",
      "description": "Event emitted by OpenAICodex",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const codex = container.feature('openaiCodex')\n\n// Listen for events\ncodex.on('session:message', ({ sessionId, message }) => console.log(message))\ncodex.on('session:patch', ({ sessionId, patch }) => console.log('File changed:', patch.path))\n\n// Run a prompt\nconst session = await codex.run('Fix the failing tests in src/')\nconsole.log(session.result)"
    }
  ]
});

setBuildTimeData('features.conversationHistory', {
  "id": "features.conversationHistory",
  "description": "Persists conversations to disk using the diskCache feature (cacache). Each conversation is stored as a JSON blob keyed by ID, with metadata stored alongside for efficient listing and search without loading full message arrays.",
  "shortcut": "features.conversationHistory",
  "methods": {
    "save": {
      "description": "Save a conversation. Creates or overwrites by ID.",
      "parameters": {
        "record": {
          "type": "ConversationRecord",
          "description": "The full conversation record to persist",
          "properties": {
            "id": {
              "type": "string",
              "description": ""
            },
            "title": {
              "type": "string",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "messages": {
              "type": "Message[]",
              "description": ""
            },
            "tags": {
              "type": "string[]",
              "description": ""
            },
            "thread": {
              "type": "string",
              "description": ""
            },
            "createdAt": {
              "type": "string",
              "description": ""
            },
            "updatedAt": {
              "type": "string",
              "description": ""
            },
            "messageCount": {
              "type": "number",
              "description": ""
            },
            "metadata": {
              "type": "Record<string, any>",
              "description": ""
            }
          }
        }
      },
      "required": [
        "record"
      ],
      "returns": "Promise<void>"
    },
    "create": {
      "description": "Create a new conversation from messages, returning the saved record.",
      "parameters": {
        "opts": {
          "type": "{\n\t\tid?: string\n\t\ttitle?: string\n\t\tmodel?: string\n\t\tmessages: Message[]\n\t\ttags?: string[]\n\t\tthread?: string\n\t\tmetadata?: Record<string, any>\n\t}",
          "description": "Creation options including messages, optional title, model, tags, thread, and metadata"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "Promise<ConversationRecord>"
    },
    "load": {
      "description": "Load a full conversation by ID, including all messages.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The conversation ID"
        }
      },
      "required": [
        "id"
      ],
      "returns": "Promise<ConversationRecord | null>"
    },
    "getMeta": {
      "description": "Load just the metadata for a conversation (no messages).",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The conversation ID"
        }
      },
      "required": [
        "id"
      ],
      "returns": "Promise<ConversationMeta | null>"
    },
    "append": {
      "description": "Append messages to an existing conversation.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The conversation ID to append to"
        },
        "messages": {
          "type": "Message[]",
          "description": "The messages to append"
        }
      },
      "required": [
        "id",
        "messages"
      ],
      "returns": "Promise<ConversationRecord | null>"
    },
    "delete": {
      "description": "Delete a conversation by ID.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The conversation ID to delete"
        }
      },
      "required": [
        "id"
      ],
      "returns": "Promise<boolean>"
    },
    "list": {
      "description": "List all conversation metadata, with optional search/filter. Loads only the lightweight meta records, never the full messages.",
      "parameters": {
        "options": {
          "type": "SearchOptions",
          "description": "Optional filters for tag, thread, model, date range, and text query",
          "properties": {
            "tag": {
              "type": "string",
              "description": ""
            },
            "tags": {
              "type": "string[]",
              "description": ""
            },
            "thread": {
              "type": "string",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "before": {
              "type": "string | Date",
              "description": ""
            },
            "after": {
              "type": "string | Date",
              "description": ""
            },
            "query": {
              "type": "string",
              "description": ""
            },
            "limit": {
              "type": "number",
              "description": ""
            },
            "offset": {
              "type": "number",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<ConversationMeta[]>"
    },
    "search": {
      "description": "Search conversations by text query across titles, tags, and metadata. Also supports filtering by tag, thread, model, and date range.",
      "parameters": {
        "options": {
          "type": "SearchOptions",
          "description": "Search and filter criteria",
          "properties": {
            "tag": {
              "type": "string",
              "description": ""
            },
            "tags": {
              "type": "string[]",
              "description": ""
            },
            "thread": {
              "type": "string",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "before": {
              "type": "string | Date",
              "description": ""
            },
            "after": {
              "type": "string | Date",
              "description": ""
            },
            "query": {
              "type": "string",
              "description": ""
            },
            "limit": {
              "type": "number",
              "description": ""
            },
            "offset": {
              "type": "number",
              "description": ""
            }
          }
        }
      },
      "required": [
        "options"
      ],
      "returns": "Promise<ConversationMeta[]>"
    },
    "allTags": {
      "description": "Get all unique tags across all conversations.",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>"
    },
    "allThreads": {
      "description": "Get all unique threads across all conversations.",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>"
    },
    "tag": {
      "description": "Tag a conversation. Adds tags without duplicates.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The conversation ID"
        },
        "tags": {
          "type": "string[]",
          "description": "One or more tags to add"
        }
      },
      "required": [
        "id",
        "tags"
      ],
      "returns": "Promise<boolean>"
    },
    "untag": {
      "description": "Remove tags from a conversation.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The conversation ID"
        },
        "tags": {
          "type": "string[]",
          "description": "One or more tags to remove"
        }
      },
      "required": [
        "id",
        "tags"
      ],
      "returns": "Promise<boolean>"
    },
    "updateMeta": {
      "description": "Update metadata on a conversation without touching messages.",
      "parameters": {
        "id": {
          "type": "string",
          "description": "The conversation ID"
        },
        "updates": {
          "type": "Partial<Pick<ConversationRecord, 'title' | 'tags' | 'thread' | 'metadata'>>",
          "description": "Partial updates for title, tags, thread, and/or metadata"
        }
      },
      "required": [
        "id",
        "updates"
      ],
      "returns": "Promise<boolean>"
    }
  },
  "getters": {
    "diskCache": {
      "description": "",
      "returns": "DiskCache"
    },
    "namespace": {
      "description": "",
      "returns": "string"
    }
  },
  "events": {
    "saved": {
      "name": "saved",
      "description": "Event emitted by ConversationHistory",
      "arguments": {}
    },
    "deleted": {
      "name": "deleted",
      "description": "Event emitted by ConversationHistory",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const history = container.feature('conversationHistory', {\n namespace: 'my-app',\n cachePath: '/tmp/conversations'\n})\n\n// Create and retrieve conversations\nconst record = await history.create({ messages, title: 'My Chat' })\nconst loaded = await history.load(record.id)\n\n// Search and filter\nconst results = await history.search({ tag: 'important', limit: 10 })"
    }
  ]
});

// Container introspection data
setContainerBuildTimeData('Container', {
  "className": "Container",
  "description": "Containers are single objects that contain state, an event bus, and registries of helpers such as: - features - clients - servers A Helper represents a category of components in your program which have a common interface, e.g. all servers can be started / stopped, all features can be enabled, if supported, all clients can connect to something. A Helper can be introspected at runtime to learn about the interface of the helper. A helper has state, and emits events. You can design your own containers and load them up with the helpers you want for that environment.",
  "methods": {
    "addContext": {
      "description": "Add a value to the container's shared context, which is passed to all helper instances.",
      "parameters": {
        "key": {
          "type": "K",
          "description": "The context key"
        },
        "value": {
          "type": "ContainerContext[K]",
          "description": "The context value"
        }
      },
      "required": [
        "key",
        "value"
      ],
      "returns": "void"
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

setContainerBuildTimeData('NodeContainer', {
  "className": "NodeContainer",
  "description": "NodeContainer container",
  "methods": {},
  "getters": {
    "cwd": {
      "description": "Returns the current working directory, from options or process.cwd().",
      "returns": "string"
    },
    "manifest": {
      "description": "Returns the parsed package.json manifest for the current working directory.",
      "returns": "any"
    },
    "argv": {
      "description": "Returns the parsed command-line arguments (from minimist).",
      "returns": "any"
    },
    "urlUtils": {
      "description": "Returns URL utility functions for parsing URIs.",
      "returns": "any"
    },
    "paths": {
      "description": "Returns path utility functions scoped to the current working directory (join, resolve, relative, dirname, parse).",
      "returns": "any"
    }
  },
  "events": {}
});

setContainerBuildTimeData('AGIContainer', {
  "className": "AGIContainer",
  "description": "AGI-specific container that extends NodeContainer with AI capabilities including OpenAI conversations, code generation, and self-modifying agent features.",
  "methods": {
    "conversation": {
      "description": "",
      "parameters": {
        "options": {
          "type": "ConversationFactoryOptions",
          "description": "Parameter options",
          "properties": {
            "tools": {
              "type": "{\n\t\thandlers: Record<string, ConversationTool['handler']>\n\t\tschemas: Record<string, ZodType>\n\t}",
              "description": ""
            },
            "systemPrompt": {
              "type": "string",
              "description": ""
            },
            "model": {
              "type": "string",
              "description": ""
            },
            "id": {
              "type": "string",
              "description": ""
            },
            "title": {
              "type": "string",
              "description": ""
            },
            "thread": {
              "type": "string",
              "description": ""
            },
            "tags": {
              "type": "string[]",
              "description": ""
            },
            "metadata": {
              "type": "Record<string, any>",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "getters": {},
  "events": {}
});
export const introspectionData = [
  {
    "id": "features.googleDocs",
    "description": "Google Docs feature for reading documents and converting them to Markdown. Depends on googleAuth for authentication and optionally googleDrive for listing docs. The markdown converter handles headings, text formatting, links, lists, tables, and images.",
    "shortcut": "features.googleDocs",
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
    "methods": {
      "loadModules": {
        "description": "Pre-load ink + react modules so the sync getters work. Called automatically by render(), but you can call it early.",
        "parameters": {},
        "required": [],
        "returns": "void",
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
        "returns": "void"
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
      }
    },
    "getters": {
      "React": {
        "description": "The React module (createElement, useState, useEffect, etc.) Exposed so consumers don't need a separate react import. Lazy-loaded — first access triggers the import.",
        "returns": "any"
      },
      "components": {
        "description": "All Ink components as a single object for destructuring. ```ts const { Box, Text, Static, Spacer } = ink.components ```",
        "returns": "any"
      },
      "hooks": {
        "description": "All Ink hooks as a single object for destructuring. ```ts const { useInput, useApp, useFocus } = ink.hooks ```",
        "returns": "any"
      },
      "measureElement": {
        "description": "The Ink measureElement utility.",
        "returns": "any"
      },
      "isMounted": {
        "description": "Whether an ink app is currently mounted.",
        "returns": "boolean"
      },
      "instance": {
        "description": "The raw ink render instance if you need low-level access.",
        "returns": "any"
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
    "id": "features.git",
    "description": "The Git feature provides utilities for interacting with Git repositories. This feature allows you to check repository status, list files, get branch information, and access Git metadata for projects within a Git repository.",
    "shortcut": "features.git",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const history = git.getChangeHistoryForFiles('src/container.ts', 'src/helper.ts')\nconst history = git.getChangeHistoryForFiles('src/node/features/*.ts')"
          }
        ]
      }
    },
    "getters": {
      "branch": {
        "description": "Gets the current Git branch name.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const currentBranch = git.branch\nif (currentBranch) {\n console.log(`Currently on branch: ${currentBranch}`)\n}"
          }
        ]
      },
      "sha": {
        "description": "Gets the current Git commit SHA hash.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const commitSha = git.sha\nif (commitSha) {\n console.log(`Current commit: ${commitSha}`)\n}"
          }
        ]
      },
      "isRepo": {
        "description": "Checks if the current directory is within a Git repository.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "if (git.isRepo) {\n console.log('This is a Git repository!')\n} else {\n console.log('Not in a Git repository')\n}"
          }
        ]
      },
      "isRepoRoot": {
        "description": "Checks if the current working directory is the root of the Git repository.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "if (git.isRepoRoot) {\n console.log('At the repository root')\n} else {\n console.log('In a subdirectory of the repository')\n}"
          }
        ]
      },
      "repoRoot": {
        "description": "Gets the absolute path to the Git repository root directory. This method caches the repository root path for performance. It searches upward from the current directory to find the .git directory.",
        "returns": "any",
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
    ]
  },
  {
    "id": "features.esbuild",
    "description": "A Feature for compiling typescript / esm modules, etc to JavaScript that the container can run at runtime. Uses esbuild for fast, reliable TypeScript/ESM transformation with full format support (esm, cjs, iife).",
    "shortcut": "features.esbuild",
    "methods": {
      "transformSync": {
        "description": "Transform code synchronously",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The code to transform"
          },
          "options": {
            "type": "esbuild.TransformOptions",
            "description": "The options to pass to esbuild"
          }
        },
        "required": [
          "code"
        ],
        "returns": "void"
      },
      "transform": {
        "description": "Transform code asynchronously",
        "parameters": {
          "code": {
            "type": "string",
            "description": "The code to transform"
          },
          "options": {
            "type": "esbuild.TransformOptions",
            "description": "The options to pass to esbuild"
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
        "code": "const esbuild = container.feature('esbuild')\nconst result = esbuild.transformSync('const x: number = 1')\nconsole.log(result.code) // 'const x = 1;\\n'"
      }
    ]
  },
  {
    "id": "features.downloader",
    "description": "A feature that provides file downloading capabilities from URLs. The Downloader feature allows you to fetch files from remote URLs and save them to the local filesystem. It handles the network request, buffering, and file writing operations automatically.",
    "shortcut": "features.downloader",
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
        "returns": "void",
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
    "id": "features.windowManager",
    "description": "WindowManager Feature — Native window control via LucaVoiceLauncher Acts as an IPC server that the native macOS launcher app connects to. Communicates over a Unix domain socket using NDJSON (newline-delimited JSON). **Protocol:** - Bun listens on a Unix domain socket; the native app connects as a client - Window dispatch commands are sent as NDJSON with a `window` field - The app executes window commands and sends back `windowAck` messages - Any non-windowAck message from the app is emitted as a `message` event - Other features can use `send()` to write arbitrary NDJSON to the app **Capabilities:** - Spawn native browser windows with configurable chrome - Navigate, focus, close, and eval JavaScript in windows - Automatic socket file cleanup and fallback paths",
    "shortcut": "features.windowManager",
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
      "listen": {
        "description": "Start listening on the Unix domain socket for the native app to connect. Fire-and-forget — binds the socket and returns immediately. Sits quietly until the native app connects; does nothing visible if it never does.",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "Override the configured socket path"
          }
        },
        "required": [],
        "returns": "this"
      },
      "stop": {
        "description": "Stop the IPC server and clean up all connections. Rejects any pending window operation requests.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "spawn": {
        "description": "Spawn a new native browser window. Sends a window dispatch to the app and waits for the ack.",
        "parameters": {
          "opts": {
            "type": "SpawnOptions",
            "description": "Window configuration (url, dimensions, chrome options)",
            "properties": {
              "url": {
                "type": "string",
                "description": ""
              },
              "width": {
                "type": "number",
                "description": ""
              },
              "height": {
                "type": "number",
                "description": ""
              },
              "x": {
                "type": "number",
                "description": ""
              },
              "y": {
                "type": "number",
                "description": ""
              },
              "alwaysOnTop": {
                "type": "boolean",
                "description": ""
              },
              "window": {
                "type": "{\n    decorations?: 'normal' | 'hiddenTitleBar' | 'none'\n    transparent?: boolean\n    shadow?: boolean\n    alwaysOnTop?: boolean\n    opacity?: number\n    clickThrough?: boolean\n  }",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<WindowAckResult>"
      },
      "spawnTTY": {
        "description": "Spawn a native terminal window running a command. The terminal is read-only — stdout/stderr are rendered with ANSI support. Closing the window terminates the process.",
        "parameters": {
          "opts": {
            "type": "SpawnTTYOptions",
            "description": "Terminal configuration (command, args, cwd, dimensions, etc.)",
            "properties": {
              "command": {
                "type": "string",
                "description": "Executable name or path (required)."
              },
              "args": {
                "type": "string[]",
                "description": "Arguments passed after the command."
              },
              "cwd": {
                "type": "string",
                "description": "Working directory for the process."
              },
              "env": {
                "type": "Record<string, string>",
                "description": "Environment variable overrides."
              },
              "cols": {
                "type": "number",
                "description": "Initial terminal columns."
              },
              "rows": {
                "type": "number",
                "description": "Initial terminal rows."
              },
              "title": {
                "type": "string",
                "description": "Window title."
              },
              "width": {
                "type": "number",
                "description": "Window width in points."
              },
              "height": {
                "type": "number",
                "description": "Window height in points."
              },
              "x": {
                "type": "number",
                "description": "Window x position."
              },
              "y": {
                "type": "number",
                "description": "Window y position."
              },
              "window": {
                "type": "SpawnOptions['window']",
                "description": "Chrome options (decorations, alwaysOnTop, etc.)"
              }
            }
          }
        },
        "required": [
          "opts"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "focus": {
        "description": "Bring a window to the front.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID. If omitted, the app uses the most recent window."
          }
        },
        "required": [],
        "returns": "Promise<WindowAckResult>"
      },
      "close": {
        "description": "Close a window.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID. If omitted, the app closes the most recent window."
          }
        },
        "required": [],
        "returns": "Promise<WindowAckResult>"
      },
      "navigate": {
        "description": "Navigate a window to a new URL.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          },
          "url": {
            "type": "string",
            "description": "The URL to navigate to"
          }
        },
        "required": [
          "windowId",
          "url"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "eval": {
        "description": "Evaluate JavaScript in a window's web view.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          },
          "code": {
            "type": "string",
            "description": "JavaScript code to evaluate"
          },
          "opts": {
            "type": "{ timeoutMs?: number; returnJson?: boolean }",
            "description": "timeoutMs (default 5000), returnJson (default true)"
          }
        },
        "required": [
          "windowId",
          "code"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "screengrab": {
        "description": "Capture a PNG screenshot from a window.",
        "parameters": {
          "opts": {
            "type": "WindowScreenGrabOptions",
            "description": "Window target and output path",
            "properties": {
              "windowId": {
                "type": "string",
                "description": "Window ID. If omitted, the launcher uses the most recent window."
              },
              "path": {
                "type": "string",
                "description": "Output file path for the PNG image."
              }
            }
          }
        },
        "required": [
          "opts"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "video": {
        "description": "Record a video from a window to disk.",
        "parameters": {
          "opts": {
            "type": "WindowVideoOptions",
            "description": "Window target, output path, and optional duration",
            "properties": {
              "windowId": {
                "type": "string",
                "description": "Window ID. If omitted, the launcher uses the most recent window."
              },
              "path": {
                "type": "string",
                "description": "Output file path for the video file."
              },
              "durationMs": {
                "type": "number",
                "description": "Recording duration in milliseconds."
              }
            }
          }
        },
        "required": [
          "opts"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "window": {
        "description": "Get a WindowHandle for chainable operations on a specific window.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          }
        },
        "required": [
          "windowId"
        ],
        "returns": "WindowHandle"
      },
      "send": {
        "description": "Write an NDJSON message to the connected app client. Public so other features can send arbitrary protocol messages over the same socket.",
        "parameters": {
          "msg": {
            "type": "Record<string, any>",
            "description": "The message object to send (will be JSON-serialized + newline)"
          }
        },
        "required": [
          "msg"
        ],
        "returns": "boolean"
      }
    },
    "getters": {
      "isListening": {
        "description": "Whether the IPC server is currently listening.",
        "returns": "boolean"
      },
      "isClientConnected": {
        "description": "Whether the native app client is currently connected.",
        "returns": "boolean"
      }
    },
    "events": {
      "listening": {
        "name": "listening",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "clientConnected": {
        "name": "clientConnected",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "clientDisconnected": {
        "name": "clientDisconnected",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "windowAck": {
        "name": "windowAck",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "message": {
        "name": "message",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const wm = container.feature('windowManager', { enable: true, autoListen: true })\n\nconst result = await wm.spawn({ url: 'https://google.com', width: 800, height: 600 })\nconst handle = wm.window(result.windowId)\nawait handle.navigate('https://news.ycombinator.com')\nconst title = await handle.eval('document.title')\nawait handle.close()\n\n// Other features can listen for non-window messages\nwm.on('message', (msg) => console.log('App says:', msg))\n\n// Other features can write raw NDJSON to the app\nwm.send({ id: 'abc', status: 'processing', speech: 'Working on it' })"
      }
    ]
  },
  {
    "id": "features.proc",
    "description": "The ChildProcess feature provides utilities for executing external processes and commands. This feature wraps Node.js child process functionality to provide convenient methods for executing shell commands, spawning processes, and capturing their output. It supports both synchronous and asynchronous execution with various options.",
    "shortcut": "features.proc",
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
      "runScript": {
        "description": "Runs a script file with Bun, inheriting stdout for full TTY passthrough (animations, colors, cursor movement) while capturing stderr in a rolling buffer.",
        "parameters": {
          "scriptPath": {
            "type": "string",
            "description": "Absolute path to the script file"
          },
          "options": {
            "type": "{ cwd?: string; maxLines?: number; env?: Record<string, string> }",
            "description": "Options",
            "properties": {
              "cwd": {
                "type": "any",
                "description": "Working directory"
              },
              "maxLines": {
                "type": "any",
                "description": "Max stderr lines to keep"
              },
              "env": {
                "type": "any",
                "description": "Extra environment variables"
              }
            }
          }
        },
        "required": [
          "scriptPath"
        ],
        "returns": "Promise<{ exitCode: number; stderr: string[] }>",
        "examples": [
          {
            "language": "ts",
            "code": "const { exitCode, stderr } = await proc.runScript('/path/to/script.ts')\nif (exitCode !== 0) {\n console.log('Error:', stderr.join('\\n'))\n}"
          }
        ]
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
    ]
  },
  {
    "id": "features.launcherAppCommandListener",
    "description": "LauncherAppCommandListener — IPC transport for commands from the LucaVoiceLauncher app Listens on a Unix domain socket for the native macOS launcher app to connect. When a command event arrives (voice, hotkey, text input), it wraps it in a `CommandHandle` and emits a `command` event. The consumer is responsible for acknowledging, processing, and finishing the command via the handle. Uses NDJSON (newline-delimited JSON) over the socket per the CLIENT_SPEC protocol.",
    "shortcut": "features.launcherAppCommandListener",
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
      "listen": {
        "description": "Start listening on the Unix domain socket for the native app to connect. Fire-and-forget — binds the socket and returns immediately. Sits quietly until the native app connects; does nothing visible if it never does.",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "Override the configured socket path"
          }
        },
        "required": [],
        "returns": "this"
      },
      "stop": {
        "description": "Stop the IPC server and clean up all connections.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "send": {
        "description": "Write an NDJSON message to the connected app client.",
        "parameters": {
          "msg": {
            "type": "Record<string, any>",
            "description": "The message object to send (will be JSON-serialized + newline)"
          }
        },
        "required": [
          "msg"
        ],
        "returns": "boolean"
      }
    },
    "getters": {
      "isListening": {
        "description": "Whether the IPC server is currently listening.",
        "returns": "boolean"
      },
      "isClientConnected": {
        "description": "Whether the native app client is currently connected.",
        "returns": "boolean"
      }
    },
    "events": {
      "listening": {
        "name": "listening",
        "description": "Event emitted by LauncherAppCommandListener",
        "arguments": {}
      },
      "clientConnected": {
        "name": "clientConnected",
        "description": "Event emitted by LauncherAppCommandListener",
        "arguments": {}
      },
      "clientDisconnected": {
        "name": "clientDisconnected",
        "description": "Event emitted by LauncherAppCommandListener",
        "arguments": {}
      },
      "command": {
        "name": "command",
        "description": "Event emitted by LauncherAppCommandListener",
        "arguments": {}
      },
      "message": {
        "name": "message",
        "description": "Event emitted by LauncherAppCommandListener",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const listener = container.feature('launcherAppCommandListener', {\n enable: true,\n autoListen: true,\n})\n\nlistener.on('command', async (cmd) => {\n cmd.ack('Working on it!')     // or just cmd.ack() for silent\n\n // ... do your actual work ...\n cmd.progress(0.5, 'Halfway there')\n\n cmd.finish()                   // silent finish\n cmd.finish({ result: { action: 'completed' }, speech: 'All done!' })\n // or: cmd.fail({ error: 'not found', speech: 'Sorry, that failed.' })\n})"
      }
    ]
  },
  {
    "id": "features.vm",
    "description": "The VM feature provides Node.js virtual machine capabilities for executing JavaScript code. This feature wraps Node.js's built-in `vm` module to provide secure code execution in isolated contexts. It's useful for running untrusted code, creating sandboxed environments, or dynamically executing code with controlled access to variables and modules.",
    "shortcut": "features.vm",
    "methods": {
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
        "returns": "void",
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const context = vm.createContext({ user: { name: 'John' } })\nconst result = vm.runSync('user.name', context)"
          }
        ]
      },
      "run": {
        "description": "Executes JavaScript code in a controlled environment. This method creates a script from the provided code, sets up an execution context with the specified variables, and runs the code safely. It handles errors gracefully and returns either the result or the error object.",
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
        "returns": "Promise<T>",
        "examples": [
          {
            "language": "ts",
            "code": "// Simple calculation\nconst result = vm.run('2 + 3 * 4')\nconsole.log(result) // 14\n\n// Using context variables\nconst greeting = vm.run('`Hello ${name}!`', { name: 'Alice' })\nconsole.log(greeting) // 'Hello Alice!'\n\n// Array operations\nconst sum = vm.run('numbers.reduce((a, b) => a + b, 0)', { \n numbers: [1, 2, 3, 4, 5] \n})\nconsole.log(sum) // 15\n\n// Error handling\nconst error = vm.run('invalidFunction()')\nif (error instanceof Error) {\n console.log('Execution failed:', error.message)\n}"
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
    ]
  },
  {
    "id": "features.ui",
    "description": "UI Feature - Interactive Terminal User Interface Builder This feature provides comprehensive tools for creating beautiful, interactive terminal experiences. It combines several popular libraries (chalk, figlet, inquirer) into a unified interface for building professional CLI applications with colors, ASCII art, and interactive prompts. **Core Capabilities:** - Rich color management using chalk library - ASCII art generation with multiple fonts - Interactive prompts and wizards - Automatic color assignment for consistent theming - Text padding and formatting utilities - Gradient text effects (horizontal and vertical) - Banner creation with styled ASCII art **Color System:** - Full chalk API access for complex styling - Automatic color assignment with palette cycling - Consistent color mapping for named entities - Support for hex colors and gradients **ASCII Art Features:** - Multiple font options via figlet - Automatic font discovery and caching - Banner creation with color gradients - Text styling and effects **Interactive Elements:** - Wizard creation with inquirer integration - External editor integration - User input validation and processing **Usage Examples:** **Basic Colors:** ```typescript const ui = container.feature('ui'); // Direct color usage ui.print.red('Error message'); ui.print.green('Success!'); // Complex styling console.log(ui.colors.blue.bold.underline('Important text')); ``` **ASCII Art Banners:** ```typescript const banner = ui.banner('MyApp', { font: 'Big', colors: ['red', 'white', 'blue'] }); console.log(banner); ``` **Interactive Wizards:** ```typescript const answers = await ui.wizard([ { type: 'input', name: 'name', message: 'Your name?' }, { type: 'confirm', name: 'continue', message: 'Continue?' } ]); ``` **Automatic Color Assignment:** ```typescript const userColor = ui.assignColor('john'); const adminColor = ui.assignColor('admin'); console.log(userColor('John\\'s message')); console.log(adminColor('Admin notice')); ```",
    "shortcut": "features.ui",
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
        "returns": "void"
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
        "returns": "void",
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
        "returns": "void"
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void"
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "any",
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
                "description": "Custom path for the history file (defaults to node_modules/.cache/.repl_history)"
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
    "id": "features.tmux",
    "description": "Terminal multiplexer feature that wraps tmux to provide programmatic control over terminal panes. Allows scripts to split the terminal into multiple panes, run commands in each pane with full process handles (await, cancel, observe output), and collapse everything back to a single pane when done.",
    "shortcut": "features.tmux",
    "methods": {
      "executeTmuxCommand": {
        "description": "Execute a tmux command and return the result. Follows the same pattern as Docker.executeDockerCommand.",
        "parameters": {
          "args": {
            "type": "string[]",
            "description": "Parameter args"
          }
        },
        "required": [
          "args"
        ],
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>"
      },
      "checkAvailability": {
        "description": "Check if tmux is available on this system.",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>"
      },
      "enable": {
        "description": "Initialize the tmux feature. Verifies tmux is available. Throws if tmux is not installed.",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "ensureSession": {
        "description": "Ensure we are running inside a tmux session. If already inside tmux, uses the current session. If not, re-execs the current script inside a new tmux session so the user actually sees panes. The current process is replaced (via execSync) — code after `ensureSession()` only runs inside tmux.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Session name. Defaults to `luca-{uuid}`."
          }
        },
        "required": [],
        "returns": "Promise<string>"
      },
      "killSession": {
        "description": "Kill the current session (or a named one).",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Parameter name"
          }
        },
        "required": [],
        "returns": "Promise<void>"
      },
      "split": {
        "description": "Split the current window into multiple panes.",
        "parameters": {
          "options": {
            "type": "SplitOptions",
            "description": "Split configuration",
            "properties": {
              "count": {
                "type": "number",
                "description": "Number of panes to create (splits the current pane this many times)"
              },
              "orientation": {
                "type": "'horizontal' | 'vertical'",
                "description": "Split direction: 'horizontal' splits side-by-side, 'vertical' splits top/bottom"
              },
              "size": {
                "type": "number",
                "description": "Percentage size for each new pane"
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<TmuxLayout>"
      },
      "runInPane": {
        "description": "Run a command in a specific pane. Returns a PaneProcess handle.",
        "parameters": {
          "paneId": {
            "type": "string",
            "description": "The tmux pane ID (e.g. \"%5\")"
          },
          "command": {
            "type": "string",
            "description": "The command string to execute"
          }
        },
        "required": [
          "paneId",
          "command"
        ],
        "returns": "Promise<PaneProcess>"
      },
      "capture": {
        "description": "Capture the current content of a pane.",
        "parameters": {
          "paneId": {
            "type": "string",
            "description": "The tmux pane ID"
          }
        },
        "required": [
          "paneId"
        ],
        "returns": "Promise<string>"
      },
      "sendKeys": {
        "description": "Send keys to a pane. If `literal` is provided, it's sent as a tmux key name (e.g. \"C-c\", \"Enter\"). Otherwise `text` is sent followed by Enter.",
        "parameters": {
          "paneId": {
            "type": "string",
            "description": "The tmux pane ID"
          },
          "text": {
            "type": "string",
            "description": "Text to type (followed by Enter)"
          },
          "literal": {
            "type": "string",
            "description": "A literal tmux key name (sent without Enter)"
          }
        },
        "required": [
          "paneId",
          "text"
        ],
        "returns": "Promise<void>"
      },
      "isPaneAlive": {
        "description": "Check if a pane is still alive.",
        "parameters": {
          "paneId": {
            "type": "string",
            "description": "Parameter paneId"
          }
        },
        "required": [
          "paneId"
        ],
        "returns": "Promise<boolean>"
      },
      "collapse": {
        "description": "Kill all managed panes except the first one, returning to a single pane view.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      }
    },
    "getters": {},
    "events": {
      "sessionCreated": {
        "name": "sessionCreated",
        "description": "Event emitted by Tmux",
        "arguments": {}
      },
      "sessionKilled": {
        "name": "sessionKilled",
        "description": "Event emitted by Tmux",
        "arguments": {}
      },
      "paneSplit": {
        "name": "paneSplit",
        "description": "Event emitted by Tmux",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const tmux = container.feature('tmux', { enable: true })\nawait tmux.ensureSession()\n\nconst layout = tmux.split({ count: 2, orientation: 'horizontal' })\n\nconst tests = await layout.panes[0].run('bun test')\nconst build = await layout.panes[1].run('bun run build')\n\ntests.events.on('output', (data) => console.log('tests:', data))\n\nawait layout.awaitAll()\nawait layout.collapse()"
      }
    ]
  },
  {
    "id": "features.scriptRunner",
    "description": "The ScriptRunner feature provides convenient access to npm scripts defined in package.json. This feature automatically generates camelCase methods for each script in the package.json file, allowing you to execute them programmatically with additional arguments and options.",
    "shortcut": "features.scriptRunner",
    "methods": {},
    "getters": {
      "scripts": {
        "description": "Gets an object containing executable functions for each npm script. Each script name from package.json is converted to camelCase and becomes a method that can be called with additional arguments and spawn options. Script names with colons (e.g., \"build:dev\") are converted by replacing colons with underscores before camelCasing.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const runner = scriptRunner.scripts\n\n// For a script named \"build:dev\" in package.json:\nawait runner.buildDev(['--watch'], { stdio: 'inherit' })\n\n// For a script named \"test\":\nconst result = await runner.test(['--coverage'])\nconsole.log(result.stdout)"
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
        "code": "const scriptRunner = container.feature('scriptRunner')\n\n// If package.json has \"build:dev\" script, you can call:\nawait scriptRunner.scripts.buildDev(['--watch'], { cwd: '/custom/path' })\n\n// If package.json has \"test\" script:\nawait scriptRunner.scripts.test(['--verbose'])"
      }
    ]
  },
  {
    "id": "features.os",
    "description": "The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.",
    "shortcut": "features.os",
    "methods": {},
    "getters": {
      "arch": {
        "description": "Gets the operating system CPU architecture.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const arch = os.arch\nconsole.log(`Running on ${arch} architecture`)"
          }
        ]
      },
      "tmpdir": {
        "description": "Gets the operating system's default directory for temporary files.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const tempDir = os.tmpdir\nconsole.log(`Temp directory: ${tempDir}`)"
          }
        ]
      },
      "homedir": {
        "description": "Gets the current user's home directory path.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const home = os.homedir\nconsole.log(`User home: ${home}`)"
          }
        ]
      },
      "cpuCount": {
        "description": "Gets the number of logical CPU cores available on the system.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const cores = os.cpuCount\nconsole.log(`System has ${cores} CPU cores`)"
          }
        ]
      },
      "hostname": {
        "description": "Gets the hostname of the operating system.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const hostname = os.hostname\nconsole.log(`Hostname: ${hostname}`)"
          }
        ]
      },
      "platform": {
        "description": "Gets the operating system platform.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const platform = os.platform\nif (platform === 'darwin') {\n console.log('Running on macOS')\n}"
          }
        ]
      },
      "networkInterfaces": {
        "description": "Gets information about the system's network interfaces.",
        "returns": "any",
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
    ]
  },
  {
    "id": "features.tts",
    "description": "TTS feature — synthesizes text to audio files via RunPod's Chatterbox Turbo endpoint. Generates high-quality speech audio by calling the Chatterbox Turbo public endpoint on RunPod, downloads the resulting audio, and saves it locally. Supports 20 preset voices and voice cloning via a reference audio URL.",
    "shortcut": "features.tts",
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
    ]
  },
  {
    "id": "features.googleAuth",
    "description": "Google authentication feature supporting OAuth2 browser flow and service account auth. Handles the complete OAuth2 lifecycle: authorization URL generation, local callback server, token exchange, refresh token storage (via diskCache), and automatic token refresh. Also supports non-interactive service account authentication via JSON key files. Other Google features (drive, sheets, calendar, docs) depend on this feature and access it lazily via `container.feature('googleAuth')`.",
    "shortcut": "features.googleAuth",
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
        "description": "Get the proc feature for executing shell commands",
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
        "code": "const docker = container.feature('docker', { enable: true })\nawait docker.checkDockerAvailability()\nconst containers = await docker.listContainers({ all: true })"
      }
    ]
  },
  {
    "id": "features.yaml",
    "description": "The YAML feature provides utilities for parsing and stringifying YAML data. This feature wraps the js-yaml library to provide convenient methods for converting between YAML strings and JavaScript objects. It's automatically attached to Node containers for easy access.",
    "shortcut": "features.yaml",
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
        "returns": "void",
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "// Check if port 8080 is available\nconst isAvailable = await networking.isPortOpen(8080)\nif (isAvailable) {\n console.log('Port 8080 is free to use')\n} else {\n console.log('Port 8080 is already in use')\n}"
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
        "code": "const networking = container.feature('networking')\n\n// Find an available port starting from 3000\nconst port = await networking.findOpenPort(3000)\nconsole.log(`Available port: ${port}`)\n\n// Check if a specific port is available\nconst isAvailable = await networking.isPortOpen(8080)\nif (isAvailable) {\n console.log('Port 8080 is available')\n}"
      }
    ]
  },
  {
    "id": "features.vault",
    "description": "The Vault feature provides encryption and decryption capabilities using AES-256-GCM. This feature allows you to securely encrypt and decrypt sensitive data using industry-standard encryption. It manages secret keys and provides a simple interface for cryptographic operations.",
    "shortcut": "features.vault",
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
        "returns": "void"
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
        "returns": "void"
      }
    },
    "getters": {
      "secretText": {
        "description": "Gets the secret key as a base64-encoded string.",
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
        "code": "const vault = container.feature('vault')\n\n// Encrypt sensitive data\nconst encrypted = vault.encrypt('sensitive information')\nconsole.log(encrypted) // Base64 encoded encrypted data\n\n// Decrypt the data\nconst decrypted = vault.decrypt(encrypted)\nconsole.log(decrypted) // 'sensitive information'"
      }
    ]
  },
  {
    "id": "features.googleCalendar",
    "description": "Google Calendar feature for listing calendars and reading events. Depends on the googleAuth feature for authentication. Creates a Calendar v3 API client lazily. Provides convenience methods for today's events and upcoming days.",
    "shortcut": "features.googleCalendar",
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
    ]
  },
  {
    "id": "features.fs",
    "description": "The FS feature provides methods for interacting with the file system, relative to the container's cwd.",
    "shortcut": "features.fs",
    "methods": {
      "readFileAsync": {
        "description": "Asynchronously reads a file and returns its contents as a Buffer.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path relative to the container's working directory"
          }
        },
        "required": [
          "path"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const fs = container.feature('fs')\nconst buffer = await fs.readFileAsync('data.txt')\nconsole.log(buffer.toString())"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const fs = container.feature('fs')\nconst entries = await fs.readdir('src')\nconsole.log(entries) // ['index.ts', 'utils.ts', 'components']"
          }
        ]
      },
      "walk": {
        "description": "Recursively walks a directory and returns an array of relative path names for each file and directory.",
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
                "description": "] - Patterns to exclude from results"
              },
              "include": {
                "type": "string | string[]",
                "description": "] - Patterns to include in results"
              }
            }
          }
        },
        "required": [
          "basePath"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const result = fs.walk('src', { files: true, directories: false })\nconsole.log(result.files) // ['src/index.ts', 'src/utils.ts', 'src/components/Button.tsx']"
          }
        ]
      },
      "walkAsync": {
        "description": "Asynchronously and recursively walks a directory and returns an array of relative path names.",
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
                "description": "] - Patterns to exclude from results"
              },
              "include": {
                "type": "string | string[]",
                "description": "] - Patterns to include in results"
              }
            }
          }
        },
        "required": [
          "baseDir"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const result = await fs.walkAsync('src', { exclude: ['node_modules'] })\nconsole.log(`Found ${result.files.length} files and ${result.directories.length} directories`)"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.ensureFileAsync('config/settings.json', '{}', true)\n// Creates config directory and settings.json file with '{}' content"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.writeFileAsync('output.txt', 'Hello World')\nawait fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.ensureFolder('logs/debug')\n// Creates logs and logs/debug directories if they don't exist"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "fs.ensureFile('logs/app.log', '', false)\n// Creates logs directory and app.log file if they don't exist"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "if (await fs.existsAsync('config.json')) {\n console.log('Config file exists!')\n}"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.rm('temp/cache.tmp')"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const config = fs.readJson('config.json')\nconsole.log(config.version)"
          }
        ]
      },
      "readFile": {
        "description": "Synchronously reads a file and returns its contents as a string.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The path to the file"
          }
        },
        "required": [
          "path"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const content = fs.readFile('README.md')\nconsole.log(content)"
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "await fs.rmdir('temp/cache')\n// Removes the cache directory and all its contents"
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
        "code": "const fs = container.feature('fs')\nconst content = fs.readFile('package.json')\nconst exists = fs.exists('tsconfig.json')\nawait fs.ensureFileAsync('output/result.json', '{}')"
      }
    ]
  },
  {
    "id": "features.ipcSocket",
    "description": "IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Dual-mode operation: server and client functionality - JSON message serialization/deserialization - Multiple client connection support (server mode) - Event-driven message handling - Automatic socket cleanup and management - Broadcast messaging to all connected clients - Lock file management for socket paths **Communication Pattern:** - Messages are automatically JSON-encoded with unique IDs - Both server and client emit 'message' events for incoming data - Server can broadcast to all connected clients - Client maintains single connection to server **Socket Management:** - Automatic cleanup of stale socket files - Connection tracking and management - Graceful shutdown procedures - Lock file protection against conflicts **Usage Examples:** **Server Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/myapp.sock', true); // removeLock=true ipc.on('connection', (socket) => { console.log('Client connected'); }); ipc.on('message', (data) => { console.log('Received:', data); ipc.broadcast({ reply: 'ACK', original: data }); }); ``` **Client Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/myapp.sock'); ipc.on('message', (data) => { console.log('Server says:', data); }); await ipc.send({ type: 'request', payload: 'hello' }); ```",
    "shortcut": "features.ipcSocket",
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
        "description": "Broadcasts a message to all connected clients (server mode only). This method sends a JSON-encoded message with a unique ID to every client currently connected to the server. Each message is automatically wrapped with metadata including a UUID for tracking. **Message Format:** Messages are automatically wrapped in the format: ```json { \"data\": <your_message>, \"id\": \"<uuid>\" } ```",
        "parameters": {
          "message": {
            "type": "any",
            "description": "The message object to broadcast to all clients"
          }
        },
        "required": [
          "message"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "// Broadcast to all connected clients\nipc.broadcast({ \n type: 'notification',\n message: 'Server is shutting down in 30 seconds',\n timestamp: Date.now()\n});\n\n// Chain multiple operations\nipc.broadcast({ status: 'ready' })\n  .broadcast({ time: new Date().toISOString() });"
          }
        ]
      },
      "send": {
        "description": "Sends a message to the server (client mode only). This method sends a JSON-encoded message with a unique ID to the connected server. The message is automatically wrapped with metadata for tracking purposes. **Message Format:** Messages are automatically wrapped in the format: ```json { \"data\": <your_message>, \"id\": \"<uuid>\" } ```",
        "parameters": {
          "message": {
            "type": "any",
            "description": "The message object to send to the server"
          }
        },
        "required": [
          "message"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "// Send a simple message\nawait ipc.send({ type: 'ping' });\n\n// Send complex data\nawait ipc.send({\n type: 'data_update',\n payload: { users: [...], timestamp: Date.now() }\n});"
          }
        ]
      },
      "connect": {
        "description": "Connects to an IPC server at the specified socket path (client mode). This method establishes a client connection to an existing IPC server. Once connected, the client can send messages to the server and receive responses. The connection is maintained until explicitly closed or the server terminates. **Connection Behavior:** - Sets the socket mode to 'client' - Returns existing connection if already connected - Automatically handles connection events and cleanup - JSON-parses incoming messages and emits 'message' events - Cleans up connection reference when socket closes **Error Handling:** - Throws error if already in server mode - Rejects promise on connection failures - Automatically cleans up on connection close",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "The file system path to the server's Unix domain socket"
          }
        },
        "required": [
          "socketPath"
        ],
        "returns": "Promise<Socket>",
        "examples": [
          {
            "language": "ts",
            "code": "// Connect to server\nconst socket = await ipc.connect('/tmp/myapp.sock');\nconsole.log('Connected to IPC server');\n\n// Handle incoming messages\nipc.on('message', (data) => {\n console.log('Server message:', data);\n});\n\n// Send messages\nawait ipc.send({ type: 'hello', client_id: 'client_001' });"
          }
        ]
      }
    },
    "getters": {
      "isClient": {
        "description": "Checks if the IPC socket is operating in client mode.",
        "returns": "any"
      },
      "isServer": {
        "description": "Checks if the IPC socket is operating in server mode.",
        "returns": "any"
      },
      "connection": {
        "description": "Gets the current client connection socket.",
        "returns": "any"
      }
    },
    "events": {
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
            "description": "Optional cache directory path (defaults to options.path or node_modules/.cache/luca-disk-cache)"
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
        "returns": "any"
      },
      "securely": {
        "description": "Get encrypted cache operations interface Requires encryption to be enabled and a secret to be provided",
        "returns": "any",
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
    "description": "The Python VM feature provides Python virtual machine capabilities for executing Python code. This feature automatically detects Python environments (uv, conda, venv, system) and provides methods to install dependencies and execute Python scripts. It can manage project-specific Python environments and maintain context between executions.",
    "shortcut": "features.python",
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
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const python = container.feature('python', { \n dir: \"/path/to/python/project\",\n contextScript: \"/path/to/setup-context.py\"\n})\n\n// Auto-install dependencies\nawait python.installDependencies()\n\n// Execute Python code\nconst result = await python.execute('print(\"Hello from Python!\")')\n\n// Execute with custom variables\nconst result2 = await python.execute('print(f\"Hello {name}!\")', { name: 'World' })"
      }
    ]
  },
  {
    "id": "features.jsonTree",
    "description": "JsonTree Feature - A powerful JSON file tree loader and processor This feature provides functionality to recursively load JSON files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive JSON file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Native JSON parsing for optimal performance **Path Processing:** Files are processed to create a nested object structure: - Directory names become object properties (camelCased) - File names become the final property names (without .json extension) - Nested directories create nested objects **Usage Example:** ```typescript const jsonTree = container.feature('jsonTree', { enable: true }); await jsonTree.loadTree('data', 'appData'); const userData = jsonTree.tree.appData.users.profiles; ``` **Directory Structure Example:** ``` data/ users/ profiles.json    -> tree.data.users.profiles settings.json    -> tree.data.users.settings config/ app-config.json  -> tree.data.config.appConfig ```",
    "shortcut": "features.jsonTree",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
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
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "// Get all non-development packages (those not in devDependencies)\nconst prodPackages = finder.exclude(pkg => isDevDependency(pkg.name));\n\n// Get all non-scoped packages\nconst unscoped = finder.exclude(pkg => pkg.name.startsWith('@'));"
          }
        ]
      }
    },
    "getters": {
      "duplicates": {
        "description": "Gets a list of package names that have multiple versions/instances installed. This is useful for identifying potential dependency conflicts or opportunities for deduplication in the project.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const duplicates = finder.duplicates;\n// ['lodash', 'react', '@types/node'] - packages with multiple versions\n\nduplicates.forEach(name => {\n console.log(`${name} has ${finder.packages[name].length} versions`);\n});"
          }
        ]
      },
      "isStarted": {
        "description": "Checks if the package finder has completed its initial scan.",
        "returns": "any"
      },
      "packageNames": {
        "description": "Gets an array of all unique package names discovered in the workspace.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const names = finder.packageNames;\nconsole.log(`Found ${names.length} unique packages`);"
          }
        ]
      },
      "scopes": {
        "description": "Gets an array of all scoped package prefixes found in the workspace. Scoped packages are those starting with '@' (e.g., @types/node, @babel/core). This returns just the scope part (e.g., '@types', '@babel').",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const scopes = finder.scopes;\n// ['@types', '@babel', '@angular'] - all scopes in use\n\nscopes.forEach(scope => {\n const scopedPackages = finder.packageNames.filter(name => name.startsWith(scope));\n console.log(`${scope}: ${scopedPackages.length} packages`);\n});"
          }
        ]
      },
      "manifests": {
        "description": "Gets a flat array of all package manifests found in the workspace. This includes all versions/instances of packages, unlike packageNames which returns unique names only.",
        "returns": "any",
        "examples": [
          {
            "language": "ts",
            "code": "const all = finder.manifests;\nconsole.log(`Total package instances: ${all.length}`);\n\n// Group by name to see duplicates\nconst grouped = all.reduce((acc, pkg) => {\n acc[pkg.name] = (acc[pkg.name] || 0) + 1;\n return acc;\n}, {});"
          }
        ]
      },
      "counts": {
        "description": "Gets a count of instances for each package name. Useful for quickly identifying which packages have multiple versions and how many instances of each exist.",
        "returns": "any",
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
    "envVars": []
  },
  {
    "id": "features.processManager",
    "description": "Manages long-running child processes with tracking, events, and automatic cleanup. Unlike the `proc` feature whose spawn methods block until the child exits, ProcessManager returns a SpawnHandler immediately — a handle object with its own state, events, and lifecycle methods. The feature tracks all spawned processes, maintains observable state, and can automatically kill them on parent exit.",
    "shortcut": "features.processManager",
    "methods": {
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
        "code": "const pm = container.feature('processManager', { enable: true })\n\nconst server = pm.spawn('node', ['server.js'], { tag: 'api', cwd: '/app' })\nserver.on('stdout', (data) => console.log('[api]', data))\nserver.on('crash', (code) => console.error('API crashed:', code))\n\n// Kill one\nserver.kill()\n\n// Kill all tracked processes\npm.killAll()\n\n// List and lookup\npm.list()              // SpawnHandler[]\npm.getByTag('api')     // SpawnHandler | undefined"
      }
    ]
  },
  {
    "id": "portExposer",
    "description": "Port Exposer Feature Exposes local HTTP services via ngrok with SSL-enabled public URLs. Perfect for development, testing, and sharing local services securely. Features: - SSL-enabled public URLs for local services - Custom subdomains and domains (with paid plans) - Authentication options (basic auth, OAuth) - Regional endpoint selection - Connection state management",
    "shortcut": "portExposer",
    "methods": {
      "expose": {
        "description": "Expose the local port via ngrok. Creates an ngrok tunnel to the specified local port and returns the SSL-enabled public URL. Emits `exposed` on success or `error` on failure.",
        "parameters": {
          "port": {
            "type": "number",
            "description": "Optional port override; falls back to `options.port`"
          }
        },
        "required": [],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const exposer = container.feature('portExposer', { port: 3000 })\nconst url = await exposer.expose()\nconsole.log(`Public URL: ${url}`)\n\n// Override port at call time\nconst url2 = await exposer.expose(8080)"
          }
        ]
      },
      "close": {
        "description": "Stop exposing the port and close the ngrok tunnel. Tears down the ngrok listener, resets connection state, and emits `closed`. Safe to call when no tunnel is active (no-op).",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>",
        "examples": [
          {
            "language": "ts",
            "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\n// ... later\nawait exposer.close()\nconsole.log(exposer.isConnected()) // false"
          }
        ]
      },
      "getPublicUrl": {
        "description": "Get the current public URL if connected. Returns the live URL from the ngrok listener, or `undefined` if no tunnel is active.",
        "parameters": {},
        "required": [],
        "returns": "string | undefined",
        "examples": [
          {
            "language": "ts",
            "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\nconsole.log(exposer.getPublicUrl()) // 'https://abc123.ngrok.io'"
          }
        ]
      },
      "isConnected": {
        "description": "Check if the ngrok tunnel is currently connected.",
        "parameters": {},
        "required": [],
        "returns": "boolean",
        "examples": [
          {
            "language": "ts",
            "code": "const exposer = container.feature('portExposer', { port: 3000 })\nconsole.log(exposer.isConnected()) // false\nawait exposer.expose()\nconsole.log(exposer.isConnected()) // true"
          }
        ]
      },
      "getConnectionInfo": {
        "description": "Get a snapshot of the current connection information. Returns an object with the tunnel's connected status, public URL, local port, connection timestamp, and session metadata.",
        "parameters": {},
        "required": [],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\nconst info = exposer.getConnectionInfo()\nconsole.log(info.publicUrl, info.localPort, info.connectedAt)"
          }
        ]
      },
      "reconnect": {
        "description": "Close the existing tunnel and re-expose with optionally updated options. Calls `close()` first, merges any new options, then calls `expose()`.",
        "parameters": {
          "newOptions": {
            "type": "Partial<PortExposerOptions>",
            "description": "Optional partial options to merge before reconnecting"
          }
        },
        "required": [],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\n// Switch to a different port\nconst newUrl = await exposer.reconnect({ port: 8080 })"
          }
        ]
      },
      "disable": {
        "description": "Disable the feature, ensuring the ngrok tunnel is closed first. Overrides the base `disable()` to guarantee that the tunnel is torn down before the feature is marked as disabled.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>",
        "examples": [
          {
            "language": "ts",
            "code": "const exposer = container.feature('portExposer', { port: 3000 })\nawait exposer.expose()\nawait exposer.disable()"
          }
        ]
      }
    },
    "getters": {},
    "events": {
      "exposed": {
        "name": "exposed",
        "description": "Event emitted by PortExposer",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by PortExposer",
        "arguments": {}
      },
      "closed": {
        "name": "closed",
        "description": "Event emitted by PortExposer",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "// Basic usage\nconst exposer = container.feature('portExposer', { port: 3000 })\nconst url = await exposer.expose()\nconsole.log(`Service available at: ${url}`)\n\n// With custom subdomain\nconst exposer = container.feature('portExposer', {\n port: 8080,\n subdomain: 'my-app',\n authToken: 'your-ngrok-token'\n})"
      }
    ]
  },
  {
    "id": "features.googleSheets",
    "description": "Google Sheets feature for reading spreadsheet data as JSON, CSV, or raw arrays. Depends on the googleAuth feature for authentication. Creates a Sheets v4 API client lazily and provides convenient methods for reading tabular data.",
    "shortcut": "features.googleSheets",
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
    ]
  },
  {
    "id": "features.secureShell",
    "description": "SecureShell Feature -- SSH command execution and SCP file transfers. Uses the system `ssh` and `scp` binaries to run commands on remote hosts and transfer files. Supports key-based and password-based authentication through the container's `proc` feature.",
    "shortcut": "features.secureShell",
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
    "getters": {},
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
    "id": "features.runpod",
    "description": "RunPod feature — manage GPU cloud pods, templates, volumes, and SSH connections via the RunPod REST API. Provides a complete interface for provisioning and managing RunPod GPU instances. Supports creating pods from templates, managing network storage volumes, SSH access via the SecureShell feature, file transfers, and polling for pod readiness.",
    "shortcut": "features.runpod",
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
    ]
  },
  {
    "id": "features.helpers",
    "description": "The Helpers feature is a unified gateway for discovering and registering project-level helpers from conventional folder locations. It scans known folder names (features/, clients/, servers/, commands/, endpoints/) and handles registration differently based on the helper type: - Class-based (features, clients, servers): Dynamic import, validate subclass, register - Config-based (commands, endpoints): Delegate to existing discovery mechanisms",
    "shortcut": "features.helpers",
    "methods": {
      "discover": {
        "description": "Discover and register project-level helpers of the given type. For class-based types (features, clients, servers), scans the matching directory for .ts files, dynamically imports each, validates the default export is a subclass of the registry's base class, and registers it. For config-based types (commands, endpoints), delegates to existing discovery mechanisms.",
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
        "description": "Discover all helper types from their conventional folder locations.",
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
      }
    },
    "getters": {
      "rootDir": {
        "description": "The root directory to scan for helper folders.",
        "returns": "string"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
      },
      "watch": {
        "description": "Watches the files in the project and updates the file manager state.",
        "parameters": {
          "options": {
            "type": "{ exclude?: string | string[] }",
            "description": "Options for the file manager",
            "properties": {
              "exclude": {
                "type": "any",
                "description": "The patterns to exclude from the watch"
              }
            }
          }
        },
        "required": [],
        "returns": "void"
      },
      "stopWatching": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
      }
    },
    "getters": {
      "fileIds": {
        "description": "Returns an array of all relative file paths indexed by the file manager.",
        "returns": "any"
      },
      "fileObjects": {
        "description": "Returns an array of all file metadata objects indexed by the file manager.",
        "returns": "any"
      },
      "directoryIds": {
        "description": "Returns the directory IDs for all of the files in the project.",
        "returns": "any"
      },
      "uniqueExtensions": {
        "description": "Returns an array of unique file extensions found across all indexed files.",
        "returns": "any"
      },
      "isStarted": {
        "description": "Whether the file manager has completed its initial scan.",
        "returns": "any"
      },
      "isStarting": {
        "description": "Whether the file manager is currently performing its initial scan.",
        "returns": "any"
      },
      "isWatching": {
        "description": "Whether the file watcher is actively monitoring for changes.",
        "returns": "any"
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
    ]
  },
  {
    "id": "features.contentDb",
    "description": "Provides access to a Contentbase Collection for a folder of structured markdown files. Models are defined in the collection's models.ts file and auto-discovered on load. This feature is a thin wrapper that manages the collection lifecycle and provides convenience accessors for models and documents.",
    "shortcut": "features.contentDb",
    "methods": {
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
      }
    },
    "getters": {
      "isLoaded": {
        "description": "Whether the content database has been loaded.",
        "returns": "any"
      },
      "collection": {
        "description": "Returns the lazily-initialized Collection instance for the configured rootPath.",
        "returns": "any"
      },
      "collectionPath": {
        "description": "Returns the absolute resolved path to the collection root directory.",
        "returns": "any"
      },
      "models": {
        "description": "Returns an object mapping model names to their model definitions, sourced from the collection.",
        "returns": "Record<string, ModelDefinition>"
      },
      "modelNames": {
        "description": "Returns an array of all registered model names from the collection.",
        "returns": "string[]"
      }
    },
    "events": {},
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
    "id": "servers.mcp",
    "description": "MCP (Model Context Protocol) server for exposing tools, resources, and prompts to AI clients like Claude Code. Uses the low-level MCP SDK Server class directly with Zod 4 native JSON Schema conversion. Register tools, resources, and prompts programmatically, then start the server over stdio (for CLI integration) or HTTP (for remote access).",
    "shortcut": "servers.mcp",
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
                "type": "z.ZodObject<any>",
                "description": ""
              },
              "description": {
                "type": "string",
                "description": ""
              },
              "handler": {
                "type": "(args: any, ctx: MCPContext) => any",
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
        "returns": "void"
      },
      "start": {
        "description": "Start the MCP server with the specified transport.",
        "parameters": {
          "options": {
            "type": "{ transport?: 'stdio' | 'http', port?: number, host?: string }",
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
        "returns": "void"
      },
      "stop": {
        "description": "Stop the MCP server and close all connections.",
        "parameters": {},
        "required": [],
        "returns": "void"
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
    ]
  },
  {
    "id": "servers.express",
    "description": "ExpressServer helper",
    "shortcut": "servers.express",
    "methods": {
      "start": {
        "description": "",
        "parameters": {
          "options": {
            "type": "StartOptions",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "void"
      },
      "configure": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
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
        "returns": "any"
      },
      "hooks": {
        "description": "",
        "returns": "any"
      },
      "app": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "servers.websocket",
    "description": "WebsocketServer helper",
    "shortcut": "servers.websocket",
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
        "returns": "void"
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
        "returns": "void"
      },
      "start": {
        "description": "",
        "parameters": {
          "options": {
            "type": "StartOptions",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "wss": {
        "description": "",
        "returns": "any"
      },
      "port": {
        "description": "",
        "returns": "any"
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
    "envVars": []
  },
  {
    "id": "features.assistantsManager",
    "description": "Discovers and manages assistant definitions from a local directory. Each subdirectory in the configured folder is treated as an assistant definition that can contain CORE.md, tools.ts, hooks.ts, and a docs/ folder. Use `discover()` to scan for available assistants, `list()` to enumerate them, and `create(name)` to instantiate one as a running Assistant feature.",
    "shortcut": "features.assistantsManager",
    "methods": {
      "afterInitialize": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "discover": {
        "description": "Scans the assistants folder for subdirectories and probes each for CORE.md, tools.ts, hooks.ts, and docs/. Populates the internal entries map.",
        "parameters": {},
        "required": [],
        "returns": "this"
      },
      "list": {
        "description": "Returns all discovered assistant entries as an array.",
        "parameters": {},
        "required": [],
        "returns": "AssistantEntry[]"
      },
      "get": {
        "description": "Looks up a single assistant entry by name.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The assistant subdirectory name"
          }
        },
        "required": [
          "name"
        ],
        "returns": "AssistantEntry | undefined"
      },
      "create": {
        "description": "Creates and returns a new Assistant feature instance for the given name. The assistant is configured with the discovered folder path. Any additional options are merged in.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The assistant name (must match a discovered entry)"
          },
          "options": {
            "type": "Record<string, any>",
            "description": "Additional options to pass to the Assistant constructor"
          }
        },
        "required": [
          "name"
        ],
        "returns": "Assistant",
        "examples": [
          {
            "language": "ts",
            "code": "const assistant = manager.create('my-helper', { model: 'gpt-4.1' })"
          }
        ]
      },
      "getInstance": {
        "description": "Returns a previously created assistant instance by name.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The assistant name"
          }
        },
        "required": [
          "name"
        ],
        "returns": "Assistant | undefined"
      },
      "toSummary": {
        "description": "Generates a markdown summary of all discovered assistants, listing their names and which definition files are present.",
        "parameters": {},
        "required": [],
        "returns": "string"
      }
    },
    "getters": {
      "assistantsFolder": {
        "description": "The absolute path to the assistants folder.",
        "returns": "string"
      }
    },
    "events": {
      "discovered": {
        "name": "discovered",
        "description": "Event emitted by AssistantsManager",
        "arguments": {}
      },
      "assistantCreated": {
        "name": "assistantCreated",
        "description": "Event emitted by AssistantsManager",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const manager = container.feature('assistantsManager', { folder: 'assistants' })\nawait manager.discover()\nconsole.log(manager.list()) // [{ name: 'my-helper', folder: '...', ... }]\nconst assistant = manager.create('my-helper')\nconst answer = await assistant.ask('Hello!')"
      }
    ]
  },
  {
    "id": "features.conversation",
    "description": "A self-contained conversation with OpenAI that supports streaming, tool calling, and message state management.",
    "shortcut": "features.conversation",
    "methods": {
      "ask": {
        "description": "Send a message and get a streamed response. Automatically handles tool calls by invoking the registered handlers and feeding results back to the model until a final text response is produced.",
        "parameters": {
          "content": {
            "type": "string | ContentPart[]",
            "description": "The user message, either a string or array of content parts (text + images)"
          }
        },
        "required": [
          "content"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const reply = await conversation.ask(\"What's the weather in SF?\")\n// With image:\nconst reply = await conversation.ask([\n { type: 'text', text: 'What is in this diagram?' },\n { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }\n])"
          }
        ]
      },
      "save": {
        "description": "Persist this conversation to disk via conversationHistory. Creates a new record if this conversation hasn't been saved before, or updates the existing one.",
        "parameters": {
          "opts": {
            "type": "{ title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }",
            "description": "Optional overrides for title, tags, thread, or metadata"
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "tools": {
        "description": "Returns the registered tools available for the model to call.",
        "returns": "Record<string, any>"
      },
      "mcpServers": {
        "description": "Returns configured remote MCP servers keyed by server label.",
        "returns": "Record<string, ConversationMCPServer>"
      },
      "messages": {
        "description": "Returns the full message history of the conversation.",
        "returns": "Message[]"
      },
      "model": {
        "description": "Returns the OpenAI model name being used for completions.",
        "returns": "string"
      },
      "apiMode": {
        "description": "Returns the active completion API mode after resolving auto/local behavior.",
        "returns": "'responses' | 'chat'"
      },
      "isStreaming": {
        "description": "Whether a streaming response is currently in progress.",
        "returns": "boolean"
      },
      "openai": {
        "description": "Returns the OpenAI client instance from the container.",
        "returns": "any"
      },
      "history": {
        "description": "Returns the conversationHistory feature for persistence.",
        "returns": "ConversationHistory"
      }
    },
    "events": {
      "userMessage": {
        "name": "userMessage",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "turnStart": {
        "name": "turnStart",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "rawEvent": {
        "name": "rawEvent",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "mcpEvent": {
        "name": "mcpEvent",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "chunk": {
        "name": "chunk",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "preview": {
        "name": "preview",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "responseCompleted": {
        "name": "responseCompleted",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "toolCallsStart": {
        "name": "toolCallsStart",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "toolError": {
        "name": "toolError",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "toolCall": {
        "name": "toolCall",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "toolResult": {
        "name": "toolResult",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "toolCallsEnd": {
        "name": "toolCallsEnd",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "turnEnd": {
        "name": "turnEnd",
        "description": "Event emitted by Conversation",
        "arguments": {}
      },
      "response": {
        "name": "response",
        "description": "Event emitted by Conversation",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const conversation = container.feature('conversation', {\n model: 'gpt-4.1',\n tools: myToolMap,\n history: [{ role: 'system', content: 'You are a helpful assistant.' }]\n})\nconst reply = await conversation.ask('What is the meaning of life?')"
      }
    ]
  },
  {
    "id": "features.openapi",
    "description": "The OpenAPI feature loads an OpenAPI/Swagger spec from a URL and provides inspection and conversion utilities. Works in both browser and node environments since it uses fetch.",
    "shortcut": "features.openapi",
    "methods": {
      "load": {
        "description": "Fetches and parses the OpenAPI spec from the configured URL. Populates `endpoints`, updates state with spec metadata.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "endpoint": {
        "description": "Get a single endpoint by its friendly name or operationId.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The friendly name or operationId to look up"
          }
        },
        "required": [
          "name"
        ],
        "returns": "EndpointInfo | undefined"
      },
      "toTools": {
        "description": "Convert all endpoints into OpenAI-compatible tool definitions.",
        "parameters": {
          "filter": {
            "type": "(ep: EndpointInfo) => boolean",
            "description": "Optional predicate to select which endpoints to include"
          }
        },
        "required": [],
        "returns": "OpenAIToolDef[]"
      },
      "toTool": {
        "description": "Convert a single endpoint (by name) to an OpenAI-compatible tool definition.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The endpoint friendly name or operationId"
          }
        },
        "required": [
          "name"
        ],
        "returns": "OpenAIToolDef | undefined"
      },
      "toFunctions": {
        "description": "Convert all endpoints into OpenAI-compatible function definitions.",
        "parameters": {
          "filter": {
            "type": "(ep: EndpointInfo) => boolean",
            "description": "Optional predicate to select which endpoints to include"
          }
        },
        "required": [],
        "returns": "OpenAIFunctionDef[]"
      },
      "toFunction": {
        "description": "Convert a single endpoint (by name) to an OpenAI function definition.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The endpoint friendly name or operationId"
          }
        },
        "required": [
          "name"
        ],
        "returns": "OpenAIFunctionDef | undefined"
      },
      "toJSON": {
        "description": "Return a compact JSON summary of all endpoints, useful for logging or REPL inspection.",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "serverUrl": {
        "description": "The base server URL derived from options, normalizing the openapi.json suffix",
        "returns": "string"
      },
      "specUrl": {
        "description": "The URL that will be fetched for the spec document",
        "returns": "string"
      },
      "spec": {
        "description": "The raw spec object. Null before load() is called.",
        "returns": "any"
      },
      "endpoints": {
        "description": "All parsed endpoints as an array",
        "returns": "EndpointInfo[]"
      },
      "endpointNames": {
        "description": "All endpoint friendly names",
        "returns": "string[]"
      },
      "endpointsByTag": {
        "description": "Map of endpoints grouped by tag",
        "returns": "Record<string, EndpointInfo[]>"
      }
    },
    "events": {
      "loaded": {
        "name": "loaded",
        "description": "Event emitted by OpenAPI",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const api = container.feature('openapi', { url: 'https://petstore.swagger.io/v2' })\nawait api.load()\n\n// Inspect all endpoints\napi.endpoints\n\n// Get a single endpoint by its friendly name\napi.endpoint('getPetById')\n\n// Convert to OpenAI tool definitions\napi.toTools()\n\n// Convert a single endpoint to a function definition\napi.toFunction('getPetById')"
      }
    ]
  },
  {
    "id": "features.docsReader",
    "description": "A docs reader that wraps a ContentDb and provides a Conversation with tools to list, outline, and read documents. Ask it a question and it will find and read the relevant docs to answer it.",
    "shortcut": "features.docsReader",
    "methods": {
      "buildTools": {
        "description": "Build the tool definitions (listDocs, readDoc, readDocOutline, readDocs) that the conversation model uses to query the content database.",
        "parameters": {},
        "required": [],
        "returns": "Record<string, ConversationTool>"
      },
      "buildSystemPrompt": {
        "description": "Build the system prompt by combining the optional prefix with a table of contents generated from the content database.",
        "parameters": {},
        "required": [],
        "returns": "string"
      },
      "createConversation": {
        "description": "Create and return a new Conversation feature configured with the docs reader's system prompt and tools.",
        "parameters": {},
        "required": [],
        "returns": "Conversation"
      },
      "start": {
        "description": "Initialize the docs reader by loading the content database, creating the conversation, and emitting the start event.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "ask": {
        "description": "Ask the docs reader a question. It will read relevant documents and return an answer based on their content.",
        "parameters": {
          "question": {
            "type": "string",
            "description": "The question to ask"
          }
        },
        "required": [
          "question"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "contentDb": {
        "description": "The ContentDb instance this reader draws from.",
        "returns": "ContentDb"
      },
      "isStarted": {
        "description": "Whether the reader has been started and is ready to answer questions.",
        "returns": "any"
      }
    },
    "events": {
      "start": {
        "name": "start",
        "description": "Event emitted by DocsReader",
        "arguments": {}
      },
      "preview": {
        "name": "preview",
        "description": "Event emitted by DocsReader",
        "arguments": {}
      },
      "answered": {
        "name": "answered",
        "description": "Event emitted by DocsReader",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const reader = container.feature('docsReader', {\n contentDb: myContentDb,\n model: 'gpt-4.1'\n})\nawait reader.start()\nconst answer = await reader.ask('How does authentication work?')"
      }
    ]
  },
  {
    "id": "features.skillsLibrary",
    "description": "Manages two contentbase collections of skills following the Claude Code SKILL.md format. Project-level skills live in .claude/skills/ and user-level skills live in ~/.luca/skills/. Skills can be discovered, searched, created, updated, and removed at runtime.",
    "shortcut": "features.skillsLibrary",
    "methods": {
      "load": {
        "description": "Loads both project and user skill collections from disk. Gracefully handles missing directories.",
        "parameters": {},
        "required": [],
        "returns": "Promise<SkillsLibrary>"
      },
      "list": {
        "description": "Lists all skills from both collections. Project skills come first.",
        "parameters": {},
        "required": [],
        "returns": "SkillEntry[]"
      },
      "find": {
        "description": "Finds a skill by name. Project skills take precedence over user skills.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The skill name to find (case-insensitive)"
          }
        },
        "required": [
          "name"
        ],
        "returns": "SkillEntry | undefined"
      },
      "search": {
        "description": "Searches skills by substring match against name and description.",
        "parameters": {
          "query": {
            "type": "string",
            "description": "The search query"
          }
        },
        "required": [
          "query"
        ],
        "returns": "SkillEntry[]"
      },
      "getSkill": {
        "description": "Gets a skill by name. Alias for find().",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The skill name"
          }
        },
        "required": [
          "name"
        ],
        "returns": "SkillEntry | undefined"
      },
      "create": {
        "description": "Creates a new SKILL.md file in the specified collection. Maintains the directory-per-skill structure (skill-name/SKILL.md).",
        "parameters": {
          "skill": {
            "type": "{\n\t\t\tname: string\n\t\t\tdescription: string\n\t\t\tbody: string\n\t\t\tmeta?: Record<string, unknown>\n\t\t}",
            "description": "The skill to create"
          },
          "target": {
            "type": "'project' | 'user'",
            "description": "Which collection to write to (default: 'project')"
          }
        },
        "required": [
          "skill"
        ],
        "returns": "Promise<SkillEntry>"
      },
      "update": {
        "description": "Updates an existing skill's content or metadata.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The skill name to update"
          },
          "updates": {
            "type": "{\n\t\t\tdescription?: string\n\t\t\tbody?: string\n\t\t\tmeta?: Record<string, unknown>\n\t\t}",
            "description": "Fields to update"
          }
        },
        "required": [
          "name",
          "updates"
        ],
        "returns": "Promise<SkillEntry>"
      },
      "remove": {
        "description": "Removes a skill by name, deleting its SKILL.md and cleaning up the directory.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "The skill name to remove"
          }
        },
        "required": [
          "name"
        ],
        "returns": "Promise<boolean>"
      },
      "toConversationTools": {
        "description": "Converts all skills into ConversationTool format for use with Conversation. Each skill becomes a tool that returns its instruction body when invoked.",
        "parameters": {},
        "required": [],
        "returns": "Record<string, ConversationTool>"
      },
      "toSystemPromptBlock": {
        "description": "Generates a markdown block listing all available skills with names and descriptions. Suitable for injecting into a system prompt.",
        "parameters": {},
        "required": [],
        "returns": "string"
      }
    },
    "getters": {
      "projectCollection": {
        "description": "Returns the project-level contentbase Collection, lazily initialized.",
        "returns": "Collection"
      },
      "userCollection": {
        "description": "Returns the user-level contentbase Collection, lazily initialized.",
        "returns": "Collection"
      },
      "isLoaded": {
        "description": "Whether the skills library has been loaded.",
        "returns": "boolean"
      },
      "skillNames": {
        "description": "Array of all skill names across both collections.",
        "returns": "string[]"
      }
    },
    "events": {
      "loaded": {
        "name": "loaded",
        "description": "Event emitted by SkillsLibrary",
        "arguments": {}
      },
      "skillCreated": {
        "name": "skillCreated",
        "description": "Event emitted by SkillsLibrary",
        "arguments": {}
      },
      "skillUpdated": {
        "name": "skillUpdated",
        "description": "Event emitted by SkillsLibrary",
        "arguments": {}
      },
      "skillRemoved": {
        "name": "skillRemoved",
        "description": "Event emitted by SkillsLibrary",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const skills = container.feature('skillsLibrary')\nawait skills.load()\n\n// List and search\nconst allSkills = skills.list()\nconst matches = skills.search('code review')\n\n// Create a new skill\nawait skills.create({\n name: 'summarize',\n description: 'Summarize a document',\n body: '## Instructions\\nRead the document and produce a concise summary.'\n})"
      }
    ]
  },
  {
    "id": "features.assistant",
    "description": "An Assistant is a combination of a system prompt and tool calls that has a conversation with an LLM. You define an assistant by creating a folder with CORE.md (system prompt), tools.ts (tool implementations), hooks.ts (event handlers), and a docs/ subfolder of structured markdown the assistant can research. Every assistant automatically gets a researchInternalDocs tool backed by a DocsReader that can query the assistant's docs/ folder.",
    "shortcut": "features.assistant",
    "methods": {
      "afterInitialize": {
        "description": "Called immediately after the assistant is constructed. Synchronously loads the system prompt, tools, and hooks using the VM's runSync, creates the contentDb if a docs/ folder exists, then fires the `created` hook.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "loadSystemPrompt": {
        "description": "Load the system prompt from CORE.md, applying any prepend/append options.",
        "parameters": {},
        "required": [],
        "returns": "string"
      },
      "loadTools": {
        "description": "Load tools from tools.ts using the container's VM feature, injecting the container and assistant as globals. Merges with any tools provided in the constructor options. Runs synchronously via vm.loadModule.",
        "parameters": {},
        "required": [],
        "returns": "Record<string, ConversationTool>"
      },
      "loadHooks": {
        "description": "Load event hooks from hooks.ts. Each exported function name should match an event the assistant emits. When that event fires, the corresponding hook function is called. Runs synchronously via vm.loadModule.",
        "parameters": {},
        "required": [],
        "returns": "Record<string, (...args: any[]) => any>"
      },
      "initDocsReader": {
        "description": "Initialize the DocsReader for the assistant's docs/ folder, using the contentDb created during initialization. This loads documents and sets up the research tools.",
        "parameters": {},
        "required": [],
        "returns": "Promise<DocsReader | undefined>"
      },
      "start": {
        "description": "Start the assistant by loading the docs reader, creating the conversation, and wiring up events. The system prompt, tools, hooks, and contentDb are already loaded synchronously during initialization.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "ask": {
        "description": "Ask the assistant a question. It will use its tools and docs to produce a streamed response. The assistant auto-starts if needed.",
        "parameters": {
          "question": {
            "type": "string | ContentPart[]",
            "description": "The question to ask"
          }
        },
        "required": [
          "question"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const answer = await assistant.ask('What capabilities do you have?')"
          }
        ]
      },
      "save": {
        "description": "Save the conversation to disk via conversationHistory.",
        "parameters": {
          "opts": {
            "type": "{ title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }",
            "description": "Optional overrides for title, tags, thread, or metadata"
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "resolvedFolder": {
        "description": "The absolute resolved path to the assistant folder.",
        "returns": "string"
      },
      "docsFolder": {
        "description": "The path to the docs subfolder.",
        "returns": "string"
      },
      "corePromptPath": {
        "description": "The path to CORE.md which provides the system prompt.",
        "returns": "string"
      },
      "toolsModulePath": {
        "description": "The path to tools.ts which provides tool implementations and schemas.",
        "returns": "string"
      },
      "hooksModulePath": {
        "description": "The path to hooks.ts which provides event handler functions.",
        "returns": "string"
      },
      "contentDb": {
        "description": "",
        "returns": "ContentDb"
      },
      "isStarted": {
        "description": "Whether the assistant has been started and is ready to receive questions.",
        "returns": "boolean"
      },
      "systemPrompt": {
        "description": "The current system prompt text.",
        "returns": "string"
      },
      "tools": {
        "description": "The tools registered with this assistant.",
        "returns": "Record<string, ConversationTool>"
      }
    },
    "events": {
      "created": {
        "name": "created",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "turnStart": {
        "name": "turnStart",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "turnEnd": {
        "name": "turnEnd",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "chunk": {
        "name": "chunk",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "preview": {
        "name": "preview",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "response": {
        "name": "response",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "rawEvent": {
        "name": "rawEvent",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "mcpEvent": {
        "name": "mcpEvent",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "toolCall": {
        "name": "toolCall",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "toolResult": {
        "name": "toolResult",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "toolError": {
        "name": "toolError",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "started": {
        "name": "started",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "hookFired": {
        "name": "hookFired",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "hookError": {
        "name": "hookError",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "hookCompleted": {
        "name": "hookCompleted",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "answered": {
        "name": "answered",
        "description": "Event emitted by Assistant",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const assistant = container.feature('assistant', {\n folder: 'assistants/my-helper'\n})\nconst answer = await assistant.ask('What capabilities do you have?')"
      }
    ]
  },
  {
    "id": "features.claudeCode",
    "description": "Claude Code CLI wrapper feature. Spawns and manages Claude Code sessions as subprocesses, streaming structured JSON events back through the container's event system. Sessions are long-lived: each call to `run()` spawns a `claude -p` process with `--output-format stream-json`, parses NDJSON from stdout line-by-line, and emits typed events on the feature's event bus.",
    "shortcut": "features.claudeCode",
    "methods": {
      "checkAvailability": {
        "description": "Check if the Claude CLI is available and capture its version.",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>",
        "examples": [
          {
            "language": "ts",
            "code": "const available = await cc.checkAvailability()\nif (!available) throw new Error('Claude CLI not found')"
          }
        ]
      },
      "writeMcpConfig": {
        "description": "Write an MCP server config map to a temp file suitable for `--mcp-config`.",
        "parameters": {
          "servers": {
            "type": "Record<string, McpServerConfig>",
            "description": "Server configs keyed by name"
          }
        },
        "required": [
          "servers"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const configPath = await cc.writeMcpConfig({\n 'my-api': { type: 'http', url: 'https://api.example.com/mcp' },\n 'local-tool': { type: 'stdio', command: 'bun', args: ['run', 'server.ts'] }\n})"
          }
        ]
      },
      "run": {
        "description": "Run a prompt in a new Claude Code session. Spawns a subprocess, streams NDJSON events, and resolves when the session completes.",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "The instruction/prompt to send"
          },
          "options": {
            "type": "RunOptions",
            "description": "Session configuration overrides",
            "properties": {
              "model": {
                "type": "string",
                "description": "Override model for this session."
              },
              "cwd": {
                "type": "string",
                "description": "Override working directory."
              },
              "systemPrompt": {
                "type": "string",
                "description": "System prompt for this session."
              },
              "appendSystemPrompt": {
                "type": "string",
                "description": "Append system prompt for this session."
              },
              "permissionMode": {
                "type": "'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'",
                "description": "Permission mode override."
              },
              "allowedTools": {
                "type": "string[]",
                "description": "Allowed tools override."
              },
              "disallowedTools": {
                "type": "string[]",
                "description": "Disallowed tools override."
              },
              "streaming": {
                "type": "boolean",
                "description": "Whether to stream partial messages."
              },
              "resumeSessionId": {
                "type": "string",
                "description": "Resume a previous session by ID."
              },
              "continue": {
                "type": "boolean",
                "description": "Continue the most recent conversation."
              },
              "addDirs": {
                "type": "string[]",
                "description": "Additional directories to allow tool access to."
              },
              "mcpConfig": {
                "type": "string[]",
                "description": "MCP config file paths."
              },
              "mcpServers": {
                "type": "Record<string, McpServerConfig>",
                "description": "MCP servers to inject, keyed by server name."
              },
              "dangerouslySkipPermissions": {
                "type": "boolean",
                "description": "Skip all permission checks (only for sandboxed environments)."
              },
              "extraArgs": {
                "type": "string[]",
                "description": "Additional arbitrary CLI flags."
              },
              "fileLogPath": {
                "type": "string",
                "description": "Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath."
              },
              "fileLogLevel": {
                "type": "FileLogLevel",
                "description": "Verbosity level for file logging. Overrides feature-level fileLogLevel."
              }
            }
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<ClaudeSession>",
        "examples": [
          {
            "language": "ts",
            "code": "// Simple one-shot\nconst session = await cc.run('What files are in this project?')\nconsole.log(session.result)\n\n// With options\nconst session = await cc.run('Refactor the auth module', {\n model: 'opus',\n cwd: '/path/to/project',\n permissionMode: 'acceptEdits',\n streaming: true\n})\n\n// With injected MCP servers\nconst session = await cc.run('Use the database tools to list tables', {\n mcpServers: {\n   'db-tools': { type: 'stdio', command: 'bun', args: ['run', 'db-mcp.ts'] },\n   'api': { type: 'http', url: 'https://api.example.com/mcp' }\n }\n})\n\n// Resume a previous session\nconst session = await cc.run('Now add tests for that', {\n resumeSessionId: previousSession.sessionId\n})"
          }
        ]
      },
      "start": {
        "description": "Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "The instruction/prompt to send"
          },
          "options": {
            "type": "RunOptions",
            "description": "Session configuration overrides",
            "properties": {
              "model": {
                "type": "string",
                "description": "Override model for this session."
              },
              "cwd": {
                "type": "string",
                "description": "Override working directory."
              },
              "systemPrompt": {
                "type": "string",
                "description": "System prompt for this session."
              },
              "appendSystemPrompt": {
                "type": "string",
                "description": "Append system prompt for this session."
              },
              "permissionMode": {
                "type": "'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'",
                "description": "Permission mode override."
              },
              "allowedTools": {
                "type": "string[]",
                "description": "Allowed tools override."
              },
              "disallowedTools": {
                "type": "string[]",
                "description": "Disallowed tools override."
              },
              "streaming": {
                "type": "boolean",
                "description": "Whether to stream partial messages."
              },
              "resumeSessionId": {
                "type": "string",
                "description": "Resume a previous session by ID."
              },
              "continue": {
                "type": "boolean",
                "description": "Continue the most recent conversation."
              },
              "addDirs": {
                "type": "string[]",
                "description": "Additional directories to allow tool access to."
              },
              "mcpConfig": {
                "type": "string[]",
                "description": "MCP config file paths."
              },
              "mcpServers": {
                "type": "Record<string, McpServerConfig>",
                "description": "MCP servers to inject, keyed by server name."
              },
              "dangerouslySkipPermissions": {
                "type": "boolean",
                "description": "Skip all permission checks (only for sandboxed environments)."
              },
              "extraArgs": {
                "type": "string[]",
                "description": "Additional arbitrary CLI flags."
              },
              "fileLogPath": {
                "type": "string",
                "description": "Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath."
              },
              "fileLogLevel": {
                "type": "FileLogLevel",
                "description": "Verbosity level for file logging. Overrides feature-level fileLogLevel."
              }
            }
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<string>",
        "examples": [
          {
            "language": "ts",
            "code": "const sessionId = cc.start('Build a REST API for users')\n\ncc.on('session:delta', ({ sessionId: sid, text }) => {\n if (sid === sessionId) process.stdout.write(text)\n})\n\ncc.on('session:result', ({ sessionId: sid, result }) => {\n if (sid === sessionId) console.log('\\nDone:', result)\n})"
          }
        ]
      },
      "abort": {
        "description": "Kill a running session's subprocess.",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "The local session ID to abort"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "void",
        "examples": [
          {
            "language": "ts",
            "code": "const sessionId = cc.start('Do something long')\n// ... later\ncc.abort(sessionId)"
          }
        ]
      },
      "getSession": {
        "description": "Get a session by its local ID.",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "The local session ID"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "ClaudeSession | undefined",
        "examples": [
          {
            "language": "ts",
            "code": "const session = cc.getSession(sessionId)\nif (session?.status === 'completed') {\n console.log(session.result)\n}"
          }
        ]
      },
      "waitForSession": {
        "description": "Wait for a running session to complete.",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "The local session ID"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "Promise<ClaudeSession>",
        "examples": [
          {
            "language": "ts",
            "code": "const id = cc.start('Build something cool')\nconst session = await cc.waitForSession(id)\nconsole.log(session.result)"
          }
        ]
      },
      "cleanupMcpTempFiles": {
        "description": "Clean up any temp MCP config files created during sessions.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "enable": {
        "description": "Initialize the feature.",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Enable options"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      }
    },
    "getters": {
      "claudePath": {
        "description": "Resolve the path to the claude CLI binary.",
        "returns": "string"
      }
    },
    "events": {
      "session:log-error": {
        "name": "session:log-error",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:event": {
        "name": "session:event",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:init": {
        "name": "session:init",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:delta": {
        "name": "session:delta",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:stream": {
        "name": "session:stream",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:message": {
        "name": "session:message",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:result": {
        "name": "session:result",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:start": {
        "name": "session:start",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:parse-error": {
        "name": "session:parse-error",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:error": {
        "name": "session:error",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      },
      "session:abort": {
        "name": "session:abort",
        "description": "Event emitted by ClaudeCode",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const cc = container.feature('claudeCode')\n\n// Listen for events\ncc.on('session:delta', ({ sessionId, text }) => process.stdout.write(text))\ncc.on('session:result', ({ sessionId, result }) => console.log('Done:', result))\n\n// Run a prompt\nconst session = await cc.run('Explain the architecture of this project')\nconsole.log(session.result)"
      }
    ]
  },
  {
    "id": "features.openaiCodex",
    "description": "OpenAI Codex CLI wrapper feature. Spawns and manages Codex sessions as subprocesses, streaming structured JSON events back through the container's event system. Mirrors the ClaudeCode feature pattern: each call to `run()` spawns a `codex exec --json` process, parses NDJSON from stdout line-by-line, and emits typed events on the feature's event bus.",
    "shortcut": "features.openaiCodex",
    "methods": {
      "checkAvailability": {
        "description": "Check if the Codex CLI is available and capture its version.",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>"
      },
      "run": {
        "description": "Run a prompt in a new Codex session. Spawns a subprocess, streams NDJSON events, and resolves when the session completes.",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "The natural language instruction for the Codex agent"
          },
          "options": {
            "type": "CodexRunOptions",
            "description": "Optional overrides for model, cwd, sandbox policy, etc.",
            "properties": {
              "model": {
                "type": "string",
                "description": ""
              },
              "cwd": {
                "type": "string",
                "description": ""
              },
              "sandbox": {
                "type": "'read-only' | 'workspace-write' | 'danger-full-access'",
                "description": ""
              },
              "approvalMode": {
                "type": "'suggest' | 'auto-edit' | 'full-auto'",
                "description": ""
              },
              "projectDoc": {
                "type": "string",
                "description": ""
              },
              "noProjectDoc": {
                "type": "boolean",
                "description": ""
              },
              "fullStdout": {
                "type": "boolean",
                "description": ""
              },
              "images": {
                "type": "string[]",
                "description": ""
              },
              "fullAuto": {
                "type": "boolean",
                "description": ""
              },
              "resumeSessionId": {
                "type": "string",
                "description": "Resume a previous session by ID."
              },
              "resumeLast": {
                "type": "boolean",
                "description": "Resume the most recent session."
              },
              "dangerouslyAutoApproveEverything": {
                "type": "boolean",
                "description": "Skip all approvals and sandboxing."
              },
              "extraArgs": {
                "type": "string[]",
                "description": "Additional CLI flags."
              }
            }
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<CodexSession>",
        "examples": [
          {
            "language": "ts",
            "code": "const session = await codex.run('Fix the failing tests')\nconsole.log(session.result)\n\nconst session = await codex.run('Refactor the auth module', {\n model: 'o4-mini',\n fullAuto: true,\n cwd: '/path/to/project'\n})"
          }
        ]
      },
      "start": {
        "description": "Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "The natural language instruction for the Codex agent"
          },
          "options": {
            "type": "CodexRunOptions",
            "description": "Optional overrides for model, cwd, sandbox policy, etc.",
            "properties": {
              "model": {
                "type": "string",
                "description": ""
              },
              "cwd": {
                "type": "string",
                "description": ""
              },
              "sandbox": {
                "type": "'read-only' | 'workspace-write' | 'danger-full-access'",
                "description": ""
              },
              "approvalMode": {
                "type": "'suggest' | 'auto-edit' | 'full-auto'",
                "description": ""
              },
              "projectDoc": {
                "type": "string",
                "description": ""
              },
              "noProjectDoc": {
                "type": "boolean",
                "description": ""
              },
              "fullStdout": {
                "type": "boolean",
                "description": ""
              },
              "images": {
                "type": "string[]",
                "description": ""
              },
              "fullAuto": {
                "type": "boolean",
                "description": ""
              },
              "resumeSessionId": {
                "type": "string",
                "description": "Resume a previous session by ID."
              },
              "resumeLast": {
                "type": "boolean",
                "description": "Resume the most recent session."
              },
              "dangerouslyAutoApproveEverything": {
                "type": "boolean",
                "description": "Skip all approvals and sandboxing."
              },
              "extraArgs": {
                "type": "string[]",
                "description": "Additional CLI flags."
              }
            }
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "string",
        "examples": [
          {
            "language": "ts",
            "code": "const sessionId = codex.start('Build a REST API for users')\n\ncodex.on('session:delta', ({ sessionId: sid, text }) => {\n if (sid === sessionId) process.stdout.write(text)\n})"
          }
        ]
      },
      "abort": {
        "description": "Kill a running session's subprocess.",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "The session ID to abort"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "void"
      },
      "getSession": {
        "description": "Retrieve the current state of a session by its ID.",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "The session ID to look up"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "CodexSession | undefined"
      },
      "waitForSession": {
        "description": "Wait for a running session to complete or error. Resolves immediately if the session is already in a terminal state.",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "The session ID to wait for"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "Promise<CodexSession>"
      },
      "enable": {
        "description": "Enable the feature. Delegates to the base Feature enable() lifecycle.",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Options to merge into the feature configuration"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      }
    },
    "getters": {
      "codexPath": {
        "description": "",
        "returns": "string"
      }
    },
    "events": {
      "session:event": {
        "name": "session:event",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:delta": {
        "name": "session:delta",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:message": {
        "name": "session:message",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:tool-call": {
        "name": "session:tool-call",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:tool-result": {
        "name": "session:tool-result",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:exec": {
        "name": "session:exec",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:patch": {
        "name": "session:patch",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:start": {
        "name": "session:start",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:parse-error": {
        "name": "session:parse-error",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:error": {
        "name": "session:error",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:result": {
        "name": "session:result",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      },
      "session:abort": {
        "name": "session:abort",
        "description": "Event emitted by OpenAICodex",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const codex = container.feature('openaiCodex')\n\n// Listen for events\ncodex.on('session:message', ({ sessionId, message }) => console.log(message))\ncodex.on('session:patch', ({ sessionId, patch }) => console.log('File changed:', patch.path))\n\n// Run a prompt\nconst session = await codex.run('Fix the failing tests in src/')\nconsole.log(session.result)"
      }
    ]
  },
  {
    "id": "features.conversationHistory",
    "description": "Persists conversations to disk using the diskCache feature (cacache). Each conversation is stored as a JSON blob keyed by ID, with metadata stored alongside for efficient listing and search without loading full message arrays.",
    "shortcut": "features.conversationHistory",
    "methods": {
      "save": {
        "description": "Save a conversation. Creates or overwrites by ID.",
        "parameters": {
          "record": {
            "type": "ConversationRecord",
            "description": "The full conversation record to persist",
            "properties": {
              "id": {
                "type": "string",
                "description": ""
              },
              "title": {
                "type": "string",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "messages": {
                "type": "Message[]",
                "description": ""
              },
              "tags": {
                "type": "string[]",
                "description": ""
              },
              "thread": {
                "type": "string",
                "description": ""
              },
              "createdAt": {
                "type": "string",
                "description": ""
              },
              "updatedAt": {
                "type": "string",
                "description": ""
              },
              "messageCount": {
                "type": "number",
                "description": ""
              },
              "metadata": {
                "type": "Record<string, any>",
                "description": ""
              }
            }
          }
        },
        "required": [
          "record"
        ],
        "returns": "Promise<void>"
      },
      "create": {
        "description": "Create a new conversation from messages, returning the saved record.",
        "parameters": {
          "opts": {
            "type": "{\n\t\tid?: string\n\t\ttitle?: string\n\t\tmodel?: string\n\t\tmessages: Message[]\n\t\ttags?: string[]\n\t\tthread?: string\n\t\tmetadata?: Record<string, any>\n\t}",
            "description": "Creation options including messages, optional title, model, tags, thread, and metadata"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "Promise<ConversationRecord>"
      },
      "load": {
        "description": "Load a full conversation by ID, including all messages.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The conversation ID"
          }
        },
        "required": [
          "id"
        ],
        "returns": "Promise<ConversationRecord | null>"
      },
      "getMeta": {
        "description": "Load just the metadata for a conversation (no messages).",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The conversation ID"
          }
        },
        "required": [
          "id"
        ],
        "returns": "Promise<ConversationMeta | null>"
      },
      "append": {
        "description": "Append messages to an existing conversation.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The conversation ID to append to"
          },
          "messages": {
            "type": "Message[]",
            "description": "The messages to append"
          }
        },
        "required": [
          "id",
          "messages"
        ],
        "returns": "Promise<ConversationRecord | null>"
      },
      "delete": {
        "description": "Delete a conversation by ID.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The conversation ID to delete"
          }
        },
        "required": [
          "id"
        ],
        "returns": "Promise<boolean>"
      },
      "list": {
        "description": "List all conversation metadata, with optional search/filter. Loads only the lightweight meta records, never the full messages.",
        "parameters": {
          "options": {
            "type": "SearchOptions",
            "description": "Optional filters for tag, thread, model, date range, and text query",
            "properties": {
              "tag": {
                "type": "string",
                "description": ""
              },
              "tags": {
                "type": "string[]",
                "description": ""
              },
              "thread": {
                "type": "string",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "before": {
                "type": "string | Date",
                "description": ""
              },
              "after": {
                "type": "string | Date",
                "description": ""
              },
              "query": {
                "type": "string",
                "description": ""
              },
              "limit": {
                "type": "number",
                "description": ""
              },
              "offset": {
                "type": "number",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<ConversationMeta[]>"
      },
      "search": {
        "description": "Search conversations by text query across titles, tags, and metadata. Also supports filtering by tag, thread, model, and date range.",
        "parameters": {
          "options": {
            "type": "SearchOptions",
            "description": "Search and filter criteria",
            "properties": {
              "tag": {
                "type": "string",
                "description": ""
              },
              "tags": {
                "type": "string[]",
                "description": ""
              },
              "thread": {
                "type": "string",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "before": {
                "type": "string | Date",
                "description": ""
              },
              "after": {
                "type": "string | Date",
                "description": ""
              },
              "query": {
                "type": "string",
                "description": ""
              },
              "limit": {
                "type": "number",
                "description": ""
              },
              "offset": {
                "type": "number",
                "description": ""
              }
            }
          }
        },
        "required": [
          "options"
        ],
        "returns": "Promise<ConversationMeta[]>"
      },
      "allTags": {
        "description": "Get all unique tags across all conversations.",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>"
      },
      "allThreads": {
        "description": "Get all unique threads across all conversations.",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>"
      },
      "tag": {
        "description": "Tag a conversation. Adds tags without duplicates.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The conversation ID"
          },
          "tags": {
            "type": "string[]",
            "description": "One or more tags to add"
          }
        },
        "required": [
          "id",
          "tags"
        ],
        "returns": "Promise<boolean>"
      },
      "untag": {
        "description": "Remove tags from a conversation.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The conversation ID"
          },
          "tags": {
            "type": "string[]",
            "description": "One or more tags to remove"
          }
        },
        "required": [
          "id",
          "tags"
        ],
        "returns": "Promise<boolean>"
      },
      "updateMeta": {
        "description": "Update metadata on a conversation without touching messages.",
        "parameters": {
          "id": {
            "type": "string",
            "description": "The conversation ID"
          },
          "updates": {
            "type": "Partial<Pick<ConversationRecord, 'title' | 'tags' | 'thread' | 'metadata'>>",
            "description": "Partial updates for title, tags, thread, and/or metadata"
          }
        },
        "required": [
          "id",
          "updates"
        ],
        "returns": "Promise<boolean>"
      }
    },
    "getters": {
      "diskCache": {
        "description": "",
        "returns": "DiskCache"
      },
      "namespace": {
        "description": "",
        "returns": "string"
      }
    },
    "events": {
      "saved": {
        "name": "saved",
        "description": "Event emitted by ConversationHistory",
        "arguments": {}
      },
      "deleted": {
        "name": "deleted",
        "description": "Event emitted by ConversationHistory",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const history = container.feature('conversationHistory', {\n namespace: 'my-app',\n cachePath: '/tmp/conversations'\n})\n\n// Create and retrieve conversations\nconst record = await history.create({ messages, title: 'My Chat' })\nconst loaded = await history.load(record.id)\n\n// Search and filter\nconst results = await history.search({ tag: 'important', limit: 10 })"
      }
    ]
  }
];

export const containerIntrospectionData = [
  {
    "className": "Container",
    "description": "Containers are single objects that contain state, an event bus, and registries of helpers such as: - features - clients - servers A Helper represents a category of components in your program which have a common interface, e.g. all servers can be started / stopped, all features can be enabled, if supported, all clients can connect to something. A Helper can be introspected at runtime to learn about the interface of the helper. A helper has state, and emits events. You can design your own containers and load them up with the helpers you want for that environment.",
    "methods": {
      "addContext": {
        "description": "Add a value to the container's shared context, which is passed to all helper instances.",
        "parameters": {
          "key": {
            "type": "K",
            "description": "The context key"
          },
          "value": {
            "type": "ContainerContext[K]",
            "description": "The context value"
          }
        },
        "required": [
          "key",
          "value"
        ],
        "returns": "void"
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
    "className": "NodeContainer",
    "description": "NodeContainer container",
    "methods": {},
    "getters": {
      "cwd": {
        "description": "Returns the current working directory, from options or process.cwd().",
        "returns": "string"
      },
      "manifest": {
        "description": "Returns the parsed package.json manifest for the current working directory.",
        "returns": "any"
      },
      "argv": {
        "description": "Returns the parsed command-line arguments (from minimist).",
        "returns": "any"
      },
      "urlUtils": {
        "description": "Returns URL utility functions for parsing URIs.",
        "returns": "any"
      },
      "paths": {
        "description": "Returns path utility functions scoped to the current working directory (join, resolve, relative, dirname, parse).",
        "returns": "any"
      }
    },
    "events": {}
  },
  {
    "className": "AGIContainer",
    "description": "AGI-specific container that extends NodeContainer with AI capabilities including OpenAI conversations, code generation, and self-modifying agent features.",
    "methods": {
      "conversation": {
        "description": "",
        "parameters": {
          "options": {
            "type": "ConversationFactoryOptions",
            "description": "Parameter options",
            "properties": {
              "tools": {
                "type": "{\n\t\thandlers: Record<string, ConversationTool['handler']>\n\t\tschemas: Record<string, ZodType>\n\t}",
                "description": ""
              },
              "systemPrompt": {
                "type": "string",
                "description": ""
              },
              "model": {
                "type": "string",
                "description": ""
              },
              "id": {
                "type": "string",
                "description": ""
              },
              "title": {
                "type": "string",
                "description": ""
              },
              "thread": {
                "type": "string",
                "description": ""
              },
              "tags": {
                "type": "string[]",
                "description": ""
              },
              "metadata": {
                "type": "Record<string, any>",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "getters": {},
    "events": {}
  }
];
