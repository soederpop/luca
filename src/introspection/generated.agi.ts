import { setBuildTimeData, setContainerBuildTimeData } from './index.js';

// Auto-generated introspection registry data
// Generated at: 2026-02-16T06:57:53.400Z

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
      "returns": "void"
    }
  },
  "getters": {
    "tree": {
      "description": "Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the YAML tree data that has been loaded.",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
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
      "returns": "void"
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
      "returns": "void"
    },
    "unmount": {
      "description": "Unmount the currently mounted Ink app.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "waitUntilExit": {
      "description": "Returns a promise that resolves when the mounted app exits.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "clear": {
      "description": "Clear the terminal output of the mounted app.",
      "parameters": {},
      "required": [],
      "returns": "void"
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
  "options": {}
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "string"
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
      "returns": "void"
    }
  },
  "getters": {
    "branch": {
      "description": "Gets the current Git branch name.",
      "returns": "any"
    },
    "sha": {
      "description": "Gets the current Git commit SHA hash.",
      "returns": "any"
    },
    "isRepo": {
      "description": "Checks if the current directory is within a Git repository.",
      "returns": "any"
    },
    "isRepoRoot": {
      "description": "Checks if the current working directory is the root of the Git repository.",
      "returns": "any"
    },
    "repoRoot": {
      "description": "Gets the absolute path to the Git repository root directory. This method caches the repository root path for performance. It searches upward from the current directory to find the .git directory.",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
});

setBuildTimeData('features.esbuild', {
  "id": "features.esbuild",
  "description": "A Feature for compiling typescript / esm modules, etc to JavaScript that the container can run at runtime.",
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
  "options": {}
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
      "returns": "void"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
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
      "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>"
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
              "description": ""
            },
            "stdout": {
              "type": "\"ignore\" | \"inherit\"",
              "description": ""
            },
            "stderr": {
              "type": "\"ignore\" | \"inherit\"",
              "description": ""
            },
            "cwd": {
              "type": "string",
              "description": "Working directory for the process"
            },
            "environment": {
              "type": "Record<string, any>",
              "description": ""
            },
            "onError": {
              "type": "(data: string) => void",
              "description": "Callback for stderr data"
            },
            "onOutput": {
              "type": "(data: string) => void",
              "description": "Callback for stdout data"
            },
            "onExit": {
              "type": "(code: number) => void",
              "description": "Callback for process exit"
            }
          }
        }
      },
      "required": [
        "command",
        "args"
      ],
      "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>"
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
      "returns": "Promise<{ exitCode: number; stderr: string[] }>"
    },
    "exec": {
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
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
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
      "returns": "void"
    },
    "isContext": {
      "description": "Returns true if the given object has already been contextified by `vm.createContext()`. Use this to avoid double-contextifying when you're not sure if the caller passed a plain object or an existing context.",
      "parameters": {
        "ctx": {
          "type": "unknown",
          "description": "Parameter ctx"
        }
      },
      "required": [
        "ctx"
      ],
      "returns": "ctx is vm.Context"
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
      "returns": "Promise<T>"
    },
    "perform": {
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
      "returns": "Promise<{ result: T, context: vm.Context }>"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
});

setBuildTimeData('features.ui', {
  "id": "features.ui",
  "description": "UI Feature - Interactive Terminal User Interface Builder This feature provides comprehensive tools for creating beautiful, interactive terminal experiences. It combines several popular libraries (chalk, figlet, inquirer) into a unified interface for building professional CLI applications with colors, ASCII art, and interactive prompts. **Core Capabilities:** - Rich color management using chalk library - ASCII art generation with multiple fonts - Interactive prompts and wizards - Automatic color assignment for consistent theming - Text padding and formatting utilities - Gradient text effects (horizontal and vertical) - Banner creation with styled ASCII art **Color System:** - Full chalk API access for complex styling - Automatic color assignment with palette cycling - Consistent color mapping for named entities - Support for hex colors and gradients **ASCII Art Features:** - Multiple font options via figlet - Automatic font discovery and caching - Banner creation with color gradients - Text styling and effects **Interactive Elements:** - Wizard creation with inquirer integration - External editor integration - User input validation and processing **Usage Examples:** **Basic Colors:** ```typescript const ui = container.feature('ui'); // Direct color usage ui.print.red('Error message'); ui.print.green('Success!'); // Complex styling console.log(ui.colors.blue.bold.underline('Important text')); ``` **ASCII Art Banners:** ```typescript const banner = ui.banner('MyApp', { font: 'Big', colors: ['red', 'white', 'blue'] }); console.log(banner); ``` **Interactive Wizards:** ```typescript const answers = await ui.wizard([ { type: 'input', name: 'name', message: 'Your name?' }, { type: 'confirm', name: 'continue', message: 'Continue?' } ]); ``` **Automatic Color Assignment:** ```typescript const userColor = ui.assignColor('john'); const adminColor = ui.assignColor('admin'); console.log(userColor('John\\'s message')); console.log(adminColor('Admin notice')); ```",
  "shortcut": "features.ui",
  "methods": {
    "markdown": {
      "description": "",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
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
      "returns": "(str: string) => string"
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
      "returns": "void"
    },
    "askQuestion": {
      "description": "",
      "parameters": {
        "question": {
          "type": "string",
          "description": "Parameter question"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
    },
    "endent": {
      "description": "",
      "parameters": {
        "args": {
          "type": "any[]",
          "description": "Parameter args"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
    }
  },
  "getters": {
    "colors": {
      "description": "Provides access to the full chalk colors API. Chalk provides extensive color and styling capabilities including: - Basic colors: red, green, blue, yellow, etc. - Background colors: bgRed, bgGreen, etc. - Styles: bold, italic, underline, strikethrough - Advanced: rgb, hex, hsl color support Colors and styles can be chained for complex formatting.",
      "returns": "typeof colors"
    },
    "colorPalette": {
      "description": "Gets the current color palette used for automatic color assignment. The color palette is a predefined set of hex colors that are automatically assigned to named entities in a cycling fashion. This ensures consistent color assignment across the application.",
      "returns": "string[]"
    },
    "randomColor": {
      "description": "Gets a random color name from the available chalk colors. This provides access to a randomly selected color from chalk's built-in color set. Useful for adding variety to terminal output or testing.",
      "returns": "any"
    },
    "fonts": {
      "description": "Gets an array of available fonts for ASCII art generation. This method provides access to all fonts available through figlet for creating ASCII art. The fonts are automatically discovered and cached on first access for performance. **Font Discovery:** - Fonts are loaded from figlet's built-in font collection - Results are cached in state to avoid repeated file system access - Returns comprehensive list of available font names",
      "returns": "string[]"
    }
  },
  "events": {},
  "state": {},
  "options": {}
});

setBuildTimeData('features.opener', {
  "id": "features.opener",
  "description": "The Opener feature opens files and URLs using the system's default application. HTTP/HTTPS URLs are opened in Google Chrome. All other paths are opened with the platform's default handler (e.g. Preview for images, Finder for folders).",
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
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
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
      "returns": "this"
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
      "description": "",
      "returns": "boolean"
    },
    "mode": {
      "description": "",
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
  "options": {}
});

setBuildTimeData('features.repl', {
  "id": "features.repl",
  "description": "Repl helper",
  "shortcut": "features.repl",
  "methods": {
    "start": {
      "description": "",
      "parameters": {
        "options": {
          "type": "{ historyPath?: string, context?: any }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "isStarted": {
      "description": "",
      "returns": "any"
    },
    "vmContext": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
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
  "options": {}
});

setBuildTimeData('features.scriptRunner', {
  "id": "features.scriptRunner",
  "description": "The ScriptRunner feature provides convenient access to npm scripts defined in package.json. This feature automatically generates camelCase methods for each script in the package.json file, allowing you to execute them programmatically with additional arguments and options.",
  "shortcut": "features.scriptRunner",
  "methods": {},
  "getters": {
    "scripts": {
      "description": "Gets an object containing executable functions for each npm script. Each script name from package.json is converted to camelCase and becomes a method that can be called with additional arguments and spawn options. Script names with colons (e.g., \"build:dev\") are converted by replacing colons with underscores before camelCasing.",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
});

setBuildTimeData('features.os', {
  "id": "features.os",
  "description": "The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.",
  "shortcut": "features.os",
  "methods": {},
  "getters": {
    "arch": {
      "description": "Gets the operating system CPU architecture.",
      "returns": "any"
    },
    "tmpdir": {
      "description": "Gets the operating system's default directory for temporary files.",
      "returns": "any"
    },
    "homedir": {
      "description": "Gets the current user's home directory path.",
      "returns": "any"
    },
    "cpuCount": {
      "description": "Gets the number of logical CPU cores available on the system.",
      "returns": "any"
    },
    "hostname": {
      "description": "Gets the hostname of the operating system.",
      "returns": "any"
    },
    "platform": {
      "description": "Gets the operating system platform.",
      "returns": "any"
    },
    "networkInterfaces": {
      "description": "Gets information about the system's network interfaces.",
      "returns": "any"
    },
    "macAddresses": {
      "description": "Gets an array of MAC addresses for non-internal IPv4 network interfaces. This filters the network interfaces to only include external IPv4 interfaces and returns their MAC addresses, which can be useful for system identification.",
      "returns": "string[]"
    }
  },
  "events": {},
  "state": {},
  "options": {}
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
      "returns": "Promise<GrepMatch[]>"
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
      "returns": "Promise<string[]>"
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
      "returns": "Promise<GrepMatch[]>"
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
      "returns": "Promise<GrepMatch[]>"
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
      "returns": "Promise<GrepMatch[]>"
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
      "returns": "Promise<number>"
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
      "returns": "Promise<{ file: string, matches: GrepMatch[] }[]>"
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
  "options": {}
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
          "description": "Parameter queryText"
        },
        "params": {
          "type": "SqlValue[]",
          "description": "Parameter params"
        }
      },
      "required": [
        "queryText"
      ],
      "returns": "Promise<T[]>"
    },
    "execute": {
      "description": "Executes a write/update/delete statement and returns metadata. Use sqlite placeholders (`?`) for `params`.",
      "parameters": {
        "queryText": {
          "type": "string",
          "description": "Parameter queryText"
        },
        "params": {
          "type": "SqlValue[]",
          "description": "Parameter params"
        }
      },
      "required": [
        "queryText"
      ],
      "returns": "Promise<{ changes: number; lastInsertRowid: number | bigint | null }>"
    },
    "sql": {
      "description": "Safe tagged-template SQL helper. Values become bound parameters automatically.",
      "parameters": {
        "strings": {
          "type": "TemplateStringsArray",
          "description": "Parameter strings"
        },
        "values": {
          "type": "SqlValue[]",
          "description": "Parameter values"
        }
      },
      "required": [
        "strings",
        "values"
      ],
      "returns": "Promise<T[]>"
    },
    "close": {
      "description": "Closes the sqlite database and updates feature state.",
      "parameters": {},
      "required": [],
      "returns": "void"
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
  "options": {}
});

setBuildTimeData('features.docker', {
  "id": "features.docker",
  "description": "Docker CLI interface feature for managing containers, images, and executing Docker commands. Provides comprehensive Docker operations including: - Container management (list, start, stop, create, remove) - Image management (list, pull, build, remove) - Command execution inside containers - Docker system information",
  "shortcut": "features.docker",
  "methods": {
    "checkDockerAvailability": {
      "description": "Check if Docker is available and working",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>"
    },
    "listContainers": {
      "description": "List all containers (running and stopped)",
      "parameters": {
        "options": {
          "type": "{ all?: boolean }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<DockerContainer[]>"
    },
    "listImages": {
      "description": "List all images",
      "parameters": {},
      "required": [],
      "returns": "Promise<DockerImage[]>"
    },
    "startContainer": {
      "description": "Start a container",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Parameter containerIdOrName"
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<void>"
    },
    "stopContainer": {
      "description": "Stop a container",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Parameter containerIdOrName"
        },
        "timeout": {
          "type": "number",
          "description": "Parameter timeout"
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<void>"
    },
    "removeContainer": {
      "description": "Remove a container",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Parameter containerIdOrName"
        },
        "options": {
          "type": "{ force?: boolean }",
          "description": "Parameter options"
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<void>"
    },
    "runContainer": {
      "description": "Create and run a new container",
      "parameters": {
        "image": {
          "type": "string",
          "description": "Parameter image"
        },
        "options": {
          "type": "{\n      name?: string\n      ports?: string[]\n      volumes?: string[]\n      environment?: Record<string, string>\n      detach?: boolean\n      interactive?: boolean\n      tty?: boolean\n      command?: string[]\n      workdir?: string\n      user?: string\n      entrypoint?: string\n      network?: string\n      restart?: string\n    }",
          "description": "Parameter options"
        }
      },
      "required": [
        "image"
      ],
      "returns": "Promise<string>"
    },
    "execCommand": {
      "description": "Execute a command inside a running container",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Parameter containerIdOrName"
        },
        "command": {
          "type": "string[]",
          "description": "Parameter command"
        },
        "options": {
          "type": "{\n      interactive?: boolean\n      tty?: boolean\n      user?: string\n      workdir?: string\n      detach?: boolean\n    }",
          "description": "Parameter options"
        }
      },
      "required": [
        "containerIdOrName",
        "command"
      ],
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>"
    },
    "pullImage": {
      "description": "Pull an image from a registry",
      "parameters": {
        "image": {
          "type": "string",
          "description": "Parameter image"
        }
      },
      "required": [
        "image"
      ],
      "returns": "Promise<void>"
    },
    "removeImage": {
      "description": "Remove an image",
      "parameters": {
        "imageIdOrName": {
          "type": "string",
          "description": "Parameter imageIdOrName"
        },
        "options": {
          "type": "{ force?: boolean }",
          "description": "Parameter options"
        }
      },
      "required": [
        "imageIdOrName"
      ],
      "returns": "Promise<void>"
    },
    "buildImage": {
      "description": "Build an image from a Dockerfile",
      "parameters": {
        "contextPath": {
          "type": "string",
          "description": "Parameter contextPath"
        },
        "options": {
          "type": "{\n      tag?: string\n      dockerfile?: string\n      buildArgs?: Record<string, string>\n      target?: string\n      nocache?: boolean\n    }",
          "description": "Parameter options"
        }
      },
      "required": [
        "contextPath"
      ],
      "returns": "Promise<void>"
    },
    "getLogs": {
      "description": "Get container logs",
      "parameters": {
        "containerIdOrName": {
          "type": "string",
          "description": "Parameter containerIdOrName"
        },
        "options": {
          "type": "{\n      follow?: boolean\n      tail?: number\n      since?: string\n      timestamps?: boolean\n    }",
          "description": "Parameter options"
        }
      },
      "required": [
        "containerIdOrName"
      ],
      "returns": "Promise<string>"
    },
    "getSystemInfo": {
      "description": "Get Docker system information",
      "parameters": {},
      "required": [],
      "returns": "Promise<any>"
    },
    "prune": {
      "description": "Prune unused Docker resources",
      "parameters": {
        "options": {
          "type": "{\n    containers?: boolean\n    images?: boolean\n    volumes?: boolean\n    networks?: boolean\n    all?: boolean\n    force?: boolean\n  }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<void>"
    },
    "enable": {
      "description": "Initialize the Docker feature",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Parameter options"
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
  "options": {}
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
      "returns": "string"
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
      "returns": "T"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
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
      "returns": "void"
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
      "returns": "void"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
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
  "options": {}
});

setBuildTimeData('features.fs', {
  "id": "features.fs",
  "description": "The FS feature provides methods for interacting with the file system, relative to the container's cwd.",
  "shortcut": "features.fs",
  "methods": {
    "readFileAsync": {
      "description": "Asynchronously reads a file and returns its contents as a string.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "The file path relative to the container's working directory"
        }
      },
      "required": [
        "path"
      ],
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "string | null"
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
      "returns": "void"
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
      "returns": "boolean"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "Promise<string | string[] | null>"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
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
      "returns": "Promise<Server>"
    },
    "stopServer": {
      "description": "Stops the IPC server and cleans up all connections. This method gracefully shuts down the server by: 1. Closing the server listener 2. Destroying all active client connections 3. Clearing the sockets tracking set 4. Resetting the server instance",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "Promise<Socket>"
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
    "message": {
      "name": "message",
      "description": "Event emitted by IpcSocket",
      "arguments": {}
    },
    "connection": {
      "name": "connection",
      "description": "Event emitted by IpcSocket",
      "arguments": {}
    }
  },
  "state": {},
  "options": {}
});

setBuildTimeData('features.diskCache', {
  "id": "features.diskCache",
  "description": "DiskCache helper",
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
    },
    "keys": {
      "description": "Get all cache keys",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>"
    },
    "listKeys": {
      "description": "List all cache keys (alias for keys())",
      "parameters": {},
      "required": [],
      "returns": "Promise<string[]>"
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
      "returns": "void"
    }
  },
  "getters": {
    "cache": {
      "description": "Returns the underlying cacache instance configured with the cache directory path.",
      "returns": "any"
    },
    "securely": {
      "description": "Get encrypted cache operations interface Requires encryption to be enabled and a secret to be provided",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
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
          "description": "Parameter queryText"
        },
        "params": {
          "type": "SqlValue[]",
          "description": "Parameter params"
        }
      },
      "required": [
        "queryText"
      ],
      "returns": "Promise<T[]>"
    },
    "execute": {
      "description": "Executes a write/update/delete statement and returns metadata. Use postgres placeholders (`$1`, `$2`, ...) for `params`.",
      "parameters": {
        "queryText": {
          "type": "string",
          "description": "Parameter queryText"
        },
        "params": {
          "type": "SqlValue[]",
          "description": "Parameter params"
        }
      },
      "required": [
        "queryText"
      ],
      "returns": "Promise<{ rowCount: number }>"
    },
    "sql": {
      "description": "Safe tagged-template SQL helper. Values become bound parameters automatically.",
      "parameters": {
        "strings": {
          "type": "TemplateStringsArray",
          "description": "Parameter strings"
        },
        "values": {
          "type": "SqlValue[]",
          "description": "Parameter values"
        }
      },
      "required": [
        "strings",
        "values"
      ],
      "returns": "Promise<T[]>"
    },
    "close": {
      "description": "Closes the postgres connection and updates feature state.",
      "parameters": {},
      "required": [],
      "returns": "void"
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
  "options": {}
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
      "returns": "Promise<void>"
    },
    "installDependencies": {
      "description": "Installs dependencies for the Python project. This method automatically detects the appropriate package manager and install command based on the environment type. If a custom installCommand is provided in options, it will use that instead.",
      "parameters": {},
      "required": [],
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>"
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
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number; locals?: any }>"
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
      "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>"
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
  "options": {}
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
      "returns": "void"
    }
  },
  "getters": {
    "tree": {
      "description": "Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the JSON tree data that has been loaded through loadTree().",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
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
      "returns": "void"
    },
    "start": {
      "description": "Starts the package finder and performs the initial workspace scan. This method is idempotent - calling it multiple times will not re-scan if already started. It triggers the complete workspace scanning process.",
      "parameters": {},
      "required": [],
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
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
      "returns": "void"
    }
  },
  "getters": {
    "duplicates": {
      "description": "Gets a list of package names that have multiple versions/instances installed. This is useful for identifying potential dependency conflicts or opportunities for deduplication in the project.",
      "returns": "any"
    },
    "isStarted": {
      "description": "Checks if the package finder has completed its initial scan.",
      "returns": "any"
    },
    "packageNames": {
      "description": "Gets an array of all unique package names discovered in the workspace.",
      "returns": "any"
    },
    "scopes": {
      "description": "Gets an array of all scoped package prefixes found in the workspace. Scoped packages are those starting with '@' (e.g., @types/node, @babel/core). This returns just the scope part (e.g., '@types', '@babel').",
      "returns": "any"
    },
    "manifests": {
      "description": "Gets a flat array of all package manifests found in the workspace. This includes all versions/instances of packages, unlike packageNames which returns unique names only.",
      "returns": "any"
    },
    "counts": {
      "description": "Gets a count of instances for each package name. Useful for quickly identifying which packages have multiple versions and how many instances of each exist.",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
});

setBuildTimeData('portExposer', {
  "id": "portExposer",
  "description": "Port Exposer Feature Exposes local HTTP services via ngrok with SSL-enabled public URLs. Perfect for development, testing, and sharing local services securely. Features: - SSL-enabled public URLs for local services - Custom subdomains and domains (with paid plans) - Authentication options (basic auth, OAuth) - Regional endpoint selection - Connection state management",
  "shortcut": "portExposer",
  "methods": {
    "expose": {
      "description": "Expose the local port via ngrok",
      "parameters": {
        "port": {
          "type": "number",
          "description": "Optional port override"
        }
      },
      "required": [],
      "returns": "Promise<string>"
    },
    "close": {
      "description": "Stop exposing the port and close the ngrok tunnel",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "getPublicUrl": {
      "description": "Get the current public URL if connected",
      "parameters": {},
      "required": [],
      "returns": "string | undefined"
    },
    "isConnected": {
      "description": "Check if currently connected",
      "parameters": {},
      "required": [],
      "returns": "boolean"
    },
    "getConnectionInfo": {
      "description": "Get connection information",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "reconnect": {
      "description": "Reconnect with new options",
      "parameters": {
        "newOptions": {
          "type": "Partial<PortExposerOptions>",
          "description": "Parameter newOptions"
        }
      },
      "required": [],
      "returns": "Promise<string>"
    },
    "disable": {
      "description": "Override disable to ensure cleanup",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
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
  "options": {}
});

setBuildTimeData('features.mdxBundler', {
  "id": "features.mdxBundler",
  "description": "The MdxBundler feature provides MDX compilation capabilities. This feature wraps the mdx-bundler library to compile MDX content into executable JavaScript. MDX allows you to use JSX components within Markdown files, making it ideal for documentation and content that needs interactive elements.",
  "shortcut": "features.mdxBundler",
  "methods": {
    "compile": {
      "description": "Compiles MDX source code into executable JavaScript. This method takes MDX source code and optional file dependencies and compiles them into JavaScript code that can be executed in a React environment. The compilation process handles JSX transformation, import resolution, and bundling.",
      "parameters": {
        "source": {
          "type": "string",
          "description": "The MDX source code to compile"
        },
        "options": {
          "type": "CompileOptions",
          "description": "Compilation options",
          "properties": {
            "files": {
              "type": "Record<string, string>",
              "description": "Additional files to include in the bundle (path -> content mapping)"
            }
          }
        }
      },
      "required": [
        "source"
      ],
      "returns": "void"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
});

setBuildTimeData('features.secureShell', {
  "id": "features.secureShell",
  "description": "Uses ssh to run commands, or scp to transfer files between a remote host.",
  "shortcut": "features.secureShell",
  "methods": {
    "testConnection": {
      "description": "Test the SSH connection",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>"
    },
    "exec": {
      "description": "Executes a command on the remote host.",
      "parameters": {
        "command": {
          "type": "string",
          "description": "The command to execute."
        }
      },
      "required": [
        "command"
      ],
      "returns": "Promise<string>"
    },
    "download": {
      "description": "Downloads a file from the remote host.",
      "parameters": {
        "source": {
          "type": "string",
          "description": "The source file path on the remote host."
        },
        "target": {
          "type": "string",
          "description": "The target file path on the local machine."
        }
      },
      "required": [
        "source",
        "target"
      ],
      "returns": "Promise<string>"
    },
    "upload": {
      "description": "Uploads a file to the remote host.",
      "parameters": {
        "source": {
          "type": "string",
          "description": "The source file path on the local machine."
        },
        "target": {
          "type": "string",
          "description": "The target file path on the remote host."
        }
      },
      "required": [
        "source",
        "target"
      ],
      "returns": "Promise<string>"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {}
});

setBuildTimeData('features.runpod', {
  "id": "features.runpod",
  "description": "Manage RunPod GPU cloud pods: list templates, available GPUs, create and manage pods.",
  "shortcut": "features.runpod",
  "methods": {
    "listTemplates": {
      "description": "",
      "parameters": {
        "options": {
          "type": "{ includePublic?: boolean, includeRunpod?: boolean }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<TemplateInfo[]>"
    },
    "getTemplate": {
      "description": "",
      "parameters": {
        "templateId": {
          "type": "string",
          "description": "Parameter templateId"
        }
      },
      "required": [
        "templateId"
      ],
      "returns": "Promise<TemplateInfo>"
    },
    "createPod": {
      "description": "",
      "parameters": {
        "options": {
          "type": "CreatePodOptions",
          "description": "Parameter options",
          "properties": {
            "name": {
              "type": "string",
              "description": ""
            },
            "imageName": {
              "type": "string",
              "description": ""
            },
            "gpuTypeId": {
              "type": "string | string[]",
              "description": ""
            },
            "gpuCount": {
              "type": "number",
              "description": ""
            },
            "templateId": {
              "type": "string",
              "description": ""
            },
            "cloudType": {
              "type": "'SECURE' | 'COMMUNITY'",
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
            "interruptible": {
              "type": "boolean",
              "description": ""
            },
            "networkVolumeId": {
              "type": "string",
              "description": ""
            },
            "minRAMPerGPU": {
              "type": "number",
              "description": ""
            }
          }
        }
      },
      "required": [
        "options"
      ],
      "returns": "Promise<PodInfo>"
    },
    "stopPod": {
      "description": "",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void"
    },
    "startPod": {
      "description": "",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void"
    },
    "removePod": {
      "description": "",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void"
    },
    "getpods": {
      "description": "Get all pods via REST API",
      "parameters": {
        "filters": {
          "type": "{ name?: string; imageName?: string; desiredStatus?: string }",
          "description": "Parameter filters"
        }
      },
      "required": [],
      "returns": "Promise<RestPodInfo[]>"
    },
    "getPod": {
      "description": "Get pod details via REST API (richer than runpodctl output)",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "Promise<RestPodInfo>"
    },
    "waitForPod": {
      "description": "Poll until a pod reaches a desired status, returns the pod info",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        },
        "status": {
          "type": "string",
          "description": "Parameter status"
        },
        "{ interval = 5000, timeout = 300000 }": {
          "type": "any",
          "description": "Parameter { interval = 5000, timeout = 300000 }"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "Promise<RestPodInfo>"
    },
    "listVolumes": {
      "description": "List all network storage volumes on your account",
      "parameters": {},
      "required": [],
      "returns": "Promise<VolumeInfo[]>"
    },
    "getVolume": {
      "description": "Get details for a specific network volume",
      "parameters": {
        "volumeId": {
          "type": "string",
          "description": "Parameter volumeId"
        }
      },
      "required": [
        "volumeId"
      ],
      "returns": "Promise<VolumeInfo>"
    },
    "createVolume": {
      "description": "Create a new network storage volume",
      "parameters": {
        "options": {
          "type": "CreateVolumeOptions",
          "description": "Parameter options",
          "properties": {
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
        }
      },
      "required": [
        "options"
      ],
      "returns": "Promise<VolumeInfo>"
    },
    "removeVolume": {
      "description": "Delete a network storage volume",
      "parameters": {
        "volumeId": {
          "type": "string",
          "description": "Parameter volumeId"
        }
      },
      "required": [
        "volumeId"
      ],
      "returns": "void"
    },
    "createRemoteShell": {
      "description": "",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void"
    },
    "getShell": {
      "description": "Get a SecureShell for a pod using the REST API (portMappings + publicIp). Preferred over createRemoteShell which requires runpodctl CLI.",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void"
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
      "returns": "Promise<{ existed: boolean; path: string }>"
    },
    "getPodHttpURLs": {
      "description": "",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "void"
    },
    "listPods": {
      "description": "",
      "parameters": {
        "detailed": {
          "type": "any",
          "description": "Parameter detailed"
        }
      },
      "required": [],
      "returns": "Promise<PodInfo[]>"
    },
    "getPodInfo": {
      "description": "",
      "parameters": {
        "podId": {
          "type": "string",
          "description": "Parameter podId"
        }
      },
      "required": [
        "podId"
      ],
      "returns": "Promise<PodInfo>"
    },
    "listSecureGPUs": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "proc": {
      "description": "",
      "returns": "any"
    },
    "apiKey": {
      "description": "",
      "returns": "any"
    },
    "dataCenterId": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
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
  "options": {}
});

setBuildTimeData('features.contentDb', {
  "id": "features.contentDb",
  "description": "Turns an organized folder of structured markdown files into an ORM like database This is a wrapper around the Contentbase library essentially. You can access raw document objects and query them, without having to define models or anything.",
  "shortcut": "features.contentDb",
  "methods": {
    "parseMarkdownAtPath": {
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
    "load": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<ContentDb>"
    },
    "defineModel": {
      "description": "",
      "parameters": {
        "definerFunction": {
          "type": "(library: typeof this.library) => ModelDefinition",
          "description": "Parameter definerFunction"
        }
      },
      "required": [
        "definerFunction"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "library": {
      "description": "Returns the Contentbase library utilities: Collection, defineModel, section, hasMany, belongsTo.",
      "returns": "any"
    },
    "models": {
      "description": "Returns an object mapping model names to their model definitions.",
      "returns": "any"
    },
    "isLoaded": {
      "description": "Whether the content database has been loaded.",
      "returns": "any"
    },
    "modelNames": {
      "description": "Returns an array of all registered model names.",
      "returns": "any"
    },
    "collection": {
      "description": "Returns the lazily-initialized Collection instance for the configured rootPath.",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {}
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
  "options": {}
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
  "options": {}
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
  "options": {}
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
      "returns": "Assistant"
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
  "options": {}
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
      "returns": "Promise<string>"
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
    "messages": {
      "description": "Returns the full message history of the conversation.",
      "returns": "Message[]"
    },
    "model": {
      "description": "Returns the OpenAI model name being used for completions.",
      "returns": "string"
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
  "options": {}
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
          "description": "Parameter name"
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
          "description": "Optional predicate to select which endpoints to include."
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
          "description": "Parameter name"
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
          "description": "Optional predicate to select which endpoints to include."
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
          "description": "Parameter name"
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
  "options": {}
});

setBuildTimeData('features.docsReader', {
  "id": "features.docsReader",
  "description": "A docs reader that wraps a ContentDb and provides a Conversation with tools to list, outline, and read documents. Ask it a question and it will find and read the relevant docs to answer it.",
  "shortcut": "features.docsReader",
  "methods": {
    "buildTools": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Record<string, ConversationTool>"
    },
    "buildSystemPrompt": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "string"
    },
    "createConversation": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Conversation"
    },
    "start": {
      "description": "",
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
  "options": {}
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
  "options": {}
});

setBuildTimeData('features.assistant', {
  "id": "features.assistant",
  "description": "An Assistant is a combination of a system prompt and tool calls that has a conversation with an LLM. You define an assistant by creating a folder with CORE.md (system prompt), tools.ts (tool implementations), hooks.ts (event handlers), and a docs/ subfolder of structured markdown the assistant can research. Every assistant automatically gets a researchInternalDocs tool backed by a DocsReader that can query the assistant's docs/ folder.",
  "shortcut": "features.assistant",
  "methods": {
    "loadSystemPrompt": {
      "description": "Load the system prompt from CORE.md, applying any prepend/append options.",
      "parameters": {},
      "required": [],
      "returns": "string"
    },
    "loadTools": {
      "description": "Load tools from tools.ts using the container's VM feature, injecting the container and assistant as globals. Merges with any tools provided in the constructor options.",
      "parameters": {},
      "required": [],
      "returns": "Promise<Record<string, ConversationTool>>"
    },
    "loadHooks": {
      "description": "Load event hooks from hooks.ts. Each exported function name should match an event the assistant emits. When that event fires, the corresponding hook function is called.",
      "parameters": {},
      "required": [],
      "returns": "Promise<Record<string, (...args: any[]) => any>>"
    },
    "initDocsReader": {
      "description": "Initialize the DocsReader for the assistant's docs/ folder, providing the researchInternalDocs tool.",
      "parameters": {},
      "required": [],
      "returns": "Promise<DocsReader | undefined>"
    },
    "start": {
      "description": "Start the assistant by loading the system prompt, tools, uooks, and docs reader, then creating the underlying conversation.",
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
      "returns": "Promise<string>"
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
    "systemPromptLoaded": {
      "name": "systemPromptLoaded",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "toolsLoaded": {
      "name": "toolsLoaded",
      "description": "Event emitted by Assistant",
      "arguments": {}
    },
    "hooksLoaded": {
      "name": "hooksLoaded",
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
  "options": {}
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
      "returns": "Promise<boolean>"
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
              "description": "MCP config paths or JSON strings."
            },
            "dangerouslySkipPermissions": {
              "type": "boolean",
              "description": "Skip all permission checks (only for sandboxed environments)."
            },
            "extraArgs": {
              "type": "string[]",
              "description": "Additional arbitrary CLI flags."
            }
          }
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<ClaudeSession>"
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
              "description": "MCP config paths or JSON strings."
            },
            "dangerouslySkipPermissions": {
              "type": "boolean",
              "description": "Skip all permission checks (only for sandboxed environments)."
            },
            "extraArgs": {
              "type": "string[]",
              "description": "Additional arbitrary CLI flags."
            }
          }
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "string"
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
      "returns": "void"
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
      "returns": "ClaudeSession | undefined"
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
      "returns": "Promise<ClaudeSession>"
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
  "options": {}
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
          "description": "Parameter prompt"
        },
        "options": {
          "type": "CodexRunOptions",
          "description": "Parameter options",
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
      "returns": "Promise<CodexSession>"
    },
    "start": {
      "description": "Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "Parameter prompt"
        },
        "options": {
          "type": "CodexRunOptions",
          "description": "Parameter options",
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
      "returns": "string"
    },
    "abort": {
      "description": "Kill a running session's subprocess.",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "Parameter sessionId"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "void"
    },
    "getSession": {
      "description": "",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "Parameter sessionId"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "CodexSession | undefined"
    },
    "waitForSession": {
      "description": "",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "Parameter sessionId"
        }
      },
      "required": [
        "sessionId"
      ],
      "returns": "Promise<CodexSession>"
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
  "options": {}
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
          "description": "Parameter opts"
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
          "description": "Parameter id"
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
          "description": "Parameter id"
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
          "description": "Parameter id"
        },
        "messages": {
          "type": "Message[]",
          "description": "Parameter messages"
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
          "description": "Parameter id"
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
          "description": "Parameter options",
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
          "description": "Parameter options",
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
          "description": "Parameter id"
        },
        "tags": {
          "type": "string[]",
          "description": "Parameter tags"
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
          "description": "Parameter id"
        },
        "tags": {
          "type": "string[]",
          "description": "Parameter tags"
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
          "description": "Parameter id"
        },
        "updates": {
          "type": "Partial<Pick<ConversationRecord, 'title' | 'tags' | 'thread' | 'metadata'>>",
          "description": "Parameter updates"
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
  "options": {}
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
        "returns": "void"
      }
    },
    "getters": {
      "tree": {
        "description": "Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the YAML tree data that has been loaded.",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
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
        "returns": "void"
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
        "returns": "void"
      },
      "unmount": {
        "description": "Unmount the currently mounted Ink app.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "waitUntilExit": {
        "description": "Returns a promise that resolves when the mounted app exits.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "clear": {
        "description": "Clear the terminal output of the mounted app.",
        "parameters": {},
        "required": [],
        "returns": "void"
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
    "options": {}
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "string"
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
        "returns": "void"
      }
    },
    "getters": {
      "branch": {
        "description": "Gets the current Git branch name.",
        "returns": "any"
      },
      "sha": {
        "description": "Gets the current Git commit SHA hash.",
        "returns": "any"
      },
      "isRepo": {
        "description": "Checks if the current directory is within a Git repository.",
        "returns": "any"
      },
      "isRepoRoot": {
        "description": "Checks if the current working directory is the root of the Git repository.",
        "returns": "any"
      },
      "repoRoot": {
        "description": "Gets the absolute path to the Git repository root directory. This method caches the repository root path for performance. It searches upward from the current directory to find the .git directory.",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
  },
  {
    "id": "features.esbuild",
    "description": "A Feature for compiling typescript / esm modules, etc to JavaScript that the container can run at runtime.",
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
    "options": {}
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
        "returns": "void"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
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
        "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>"
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
                "description": ""
              },
              "stdout": {
                "type": "\"ignore\" | \"inherit\"",
                "description": ""
              },
              "stderr": {
                "type": "\"ignore\" | \"inherit\"",
                "description": ""
              },
              "cwd": {
                "type": "string",
                "description": "Working directory for the process"
              },
              "environment": {
                "type": "Record<string, any>",
                "description": ""
              },
              "onError": {
                "type": "(data: string) => void",
                "description": "Callback for stderr data"
              },
              "onOutput": {
                "type": "(data: string) => void",
                "description": "Callback for stdout data"
              },
              "onExit": {
                "type": "(code: number) => void",
                "description": "Callback for process exit"
              }
            }
          }
        },
        "required": [
          "command",
          "args"
        ],
        "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>"
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
        "returns": "Promise<{ exitCode: number; stderr: string[] }>"
      },
      "exec": {
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
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
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
        "returns": "void"
      },
      "isContext": {
        "description": "Returns true if the given object has already been contextified by `vm.createContext()`. Use this to avoid double-contextifying when you're not sure if the caller passed a plain object or an existing context.",
        "parameters": {
          "ctx": {
            "type": "unknown",
            "description": "Parameter ctx"
          }
        },
        "required": [
          "ctx"
        ],
        "returns": "ctx is vm.Context"
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
        "returns": "Promise<T>"
      },
      "perform": {
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
        "returns": "Promise<{ result: T, context: vm.Context }>"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
  },
  {
    "id": "features.ui",
    "description": "UI Feature - Interactive Terminal User Interface Builder This feature provides comprehensive tools for creating beautiful, interactive terminal experiences. It combines several popular libraries (chalk, figlet, inquirer) into a unified interface for building professional CLI applications with colors, ASCII art, and interactive prompts. **Core Capabilities:** - Rich color management using chalk library - ASCII art generation with multiple fonts - Interactive prompts and wizards - Automatic color assignment for consistent theming - Text padding and formatting utilities - Gradient text effects (horizontal and vertical) - Banner creation with styled ASCII art **Color System:** - Full chalk API access for complex styling - Automatic color assignment with palette cycling - Consistent color mapping for named entities - Support for hex colors and gradients **ASCII Art Features:** - Multiple font options via figlet - Automatic font discovery and caching - Banner creation with color gradients - Text styling and effects **Interactive Elements:** - Wizard creation with inquirer integration - External editor integration - User input validation and processing **Usage Examples:** **Basic Colors:** ```typescript const ui = container.feature('ui'); // Direct color usage ui.print.red('Error message'); ui.print.green('Success!'); // Complex styling console.log(ui.colors.blue.bold.underline('Important text')); ``` **ASCII Art Banners:** ```typescript const banner = ui.banner('MyApp', { font: 'Big', colors: ['red', 'white', 'blue'] }); console.log(banner); ``` **Interactive Wizards:** ```typescript const answers = await ui.wizard([ { type: 'input', name: 'name', message: 'Your name?' }, { type: 'confirm', name: 'continue', message: 'Continue?' } ]); ``` **Automatic Color Assignment:** ```typescript const userColor = ui.assignColor('john'); const adminColor = ui.assignColor('admin'); console.log(userColor('John\\'s message')); console.log(adminColor('Admin notice')); ```",
    "shortcut": "features.ui",
    "methods": {
      "markdown": {
        "description": "",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
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
        "returns": "(str: string) => string"
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
        "returns": "void"
      },
      "askQuestion": {
        "description": "",
        "parameters": {
          "question": {
            "type": "string",
            "description": "Parameter question"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
      },
      "endent": {
        "description": "",
        "parameters": {
          "args": {
            "type": "any[]",
            "description": "Parameter args"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
      }
    },
    "getters": {
      "colors": {
        "description": "Provides access to the full chalk colors API. Chalk provides extensive color and styling capabilities including: - Basic colors: red, green, blue, yellow, etc. - Background colors: bgRed, bgGreen, etc. - Styles: bold, italic, underline, strikethrough - Advanced: rgb, hex, hsl color support Colors and styles can be chained for complex formatting.",
        "returns": "typeof colors"
      },
      "colorPalette": {
        "description": "Gets the current color palette used for automatic color assignment. The color palette is a predefined set of hex colors that are automatically assigned to named entities in a cycling fashion. This ensures consistent color assignment across the application.",
        "returns": "string[]"
      },
      "randomColor": {
        "description": "Gets a random color name from the available chalk colors. This provides access to a randomly selected color from chalk's built-in color set. Useful for adding variety to terminal output or testing.",
        "returns": "any"
      },
      "fonts": {
        "description": "Gets an array of available fonts for ASCII art generation. This method provides access to all fonts available through figlet for creating ASCII art. The fonts are automatically discovered and cached on first access for performance. **Font Discovery:** - Fonts are loaded from figlet's built-in font collection - Results are cached in state to avoid repeated file system access - Returns comprehensive list of available font names",
        "returns": "string[]"
      }
    },
    "events": {},
    "state": {},
    "options": {}
  },
  {
    "id": "features.opener",
    "description": "The Opener feature opens files and URLs using the system's default application. HTTP/HTTPS URLs are opened in Google Chrome. All other paths are opened with the platform's default handler (e.g. Preview for images, Finder for folders).",
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
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
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
        "returns": "this"
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
        "description": "",
        "returns": "boolean"
      },
      "mode": {
        "description": "",
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
    "options": {}
  },
  {
    "id": "features.repl",
    "description": "Repl helper",
    "shortcut": "features.repl",
    "methods": {
      "start": {
        "description": "",
        "parameters": {
          "options": {
            "type": "{ historyPath?: string, context?: any }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "isStarted": {
        "description": "",
        "returns": "any"
      },
      "vmContext": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
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
    "options": {}
  },
  {
    "id": "features.scriptRunner",
    "description": "The ScriptRunner feature provides convenient access to npm scripts defined in package.json. This feature automatically generates camelCase methods for each script in the package.json file, allowing you to execute them programmatically with additional arguments and options.",
    "shortcut": "features.scriptRunner",
    "methods": {},
    "getters": {
      "scripts": {
        "description": "Gets an object containing executable functions for each npm script. Each script name from package.json is converted to camelCase and becomes a method that can be called with additional arguments and spawn options. Script names with colons (e.g., \"build:dev\") are converted by replacing colons with underscores before camelCasing.",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
  },
  {
    "id": "features.os",
    "description": "The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.",
    "shortcut": "features.os",
    "methods": {},
    "getters": {
      "arch": {
        "description": "Gets the operating system CPU architecture.",
        "returns": "any"
      },
      "tmpdir": {
        "description": "Gets the operating system's default directory for temporary files.",
        "returns": "any"
      },
      "homedir": {
        "description": "Gets the current user's home directory path.",
        "returns": "any"
      },
      "cpuCount": {
        "description": "Gets the number of logical CPU cores available on the system.",
        "returns": "any"
      },
      "hostname": {
        "description": "Gets the hostname of the operating system.",
        "returns": "any"
      },
      "platform": {
        "description": "Gets the operating system platform.",
        "returns": "any"
      },
      "networkInterfaces": {
        "description": "Gets information about the system's network interfaces.",
        "returns": "any"
      },
      "macAddresses": {
        "description": "Gets an array of MAC addresses for non-internal IPv4 network interfaces. This filters the network interfaces to only include external IPv4 interfaces and returns their MAC addresses, which can be useful for system identification.",
        "returns": "string[]"
      }
    },
    "events": {},
    "state": {},
    "options": {}
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
        "returns": "Promise<GrepMatch[]>"
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
        "returns": "Promise<string[]>"
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
        "returns": "Promise<GrepMatch[]>"
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
        "returns": "Promise<GrepMatch[]>"
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
        "returns": "Promise<GrepMatch[]>"
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
        "returns": "Promise<number>"
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
        "returns": "Promise<{ file: string, matches: GrepMatch[] }[]>"
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
    "options": {}
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
            "description": "Parameter queryText"
          },
          "params": {
            "type": "SqlValue[]",
            "description": "Parameter params"
          }
        },
        "required": [
          "queryText"
        ],
        "returns": "Promise<T[]>"
      },
      "execute": {
        "description": "Executes a write/update/delete statement and returns metadata. Use sqlite placeholders (`?`) for `params`.",
        "parameters": {
          "queryText": {
            "type": "string",
            "description": "Parameter queryText"
          },
          "params": {
            "type": "SqlValue[]",
            "description": "Parameter params"
          }
        },
        "required": [
          "queryText"
        ],
        "returns": "Promise<{ changes: number; lastInsertRowid: number | bigint | null }>"
      },
      "sql": {
        "description": "Safe tagged-template SQL helper. Values become bound parameters automatically.",
        "parameters": {
          "strings": {
            "type": "TemplateStringsArray",
            "description": "Parameter strings"
          },
          "values": {
            "type": "SqlValue[]",
            "description": "Parameter values"
          }
        },
        "required": [
          "strings",
          "values"
        ],
        "returns": "Promise<T[]>"
      },
      "close": {
        "description": "Closes the sqlite database and updates feature state.",
        "parameters": {},
        "required": [],
        "returns": "void"
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
    "options": {}
  },
  {
    "id": "features.docker",
    "description": "Docker CLI interface feature for managing containers, images, and executing Docker commands. Provides comprehensive Docker operations including: - Container management (list, start, stop, create, remove) - Image management (list, pull, build, remove) - Command execution inside containers - Docker system information",
    "shortcut": "features.docker",
    "methods": {
      "checkDockerAvailability": {
        "description": "Check if Docker is available and working",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>"
      },
      "listContainers": {
        "description": "List all containers (running and stopped)",
        "parameters": {
          "options": {
            "type": "{ all?: boolean }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<DockerContainer[]>"
      },
      "listImages": {
        "description": "List all images",
        "parameters": {},
        "required": [],
        "returns": "Promise<DockerImage[]>"
      },
      "startContainer": {
        "description": "Start a container",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Parameter containerIdOrName"
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<void>"
      },
      "stopContainer": {
        "description": "Stop a container",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Parameter containerIdOrName"
          },
          "timeout": {
            "type": "number",
            "description": "Parameter timeout"
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<void>"
      },
      "removeContainer": {
        "description": "Remove a container",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Parameter containerIdOrName"
          },
          "options": {
            "type": "{ force?: boolean }",
            "description": "Parameter options"
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<void>"
      },
      "runContainer": {
        "description": "Create and run a new container",
        "parameters": {
          "image": {
            "type": "string",
            "description": "Parameter image"
          },
          "options": {
            "type": "{\n      name?: string\n      ports?: string[]\n      volumes?: string[]\n      environment?: Record<string, string>\n      detach?: boolean\n      interactive?: boolean\n      tty?: boolean\n      command?: string[]\n      workdir?: string\n      user?: string\n      entrypoint?: string\n      network?: string\n      restart?: string\n    }",
            "description": "Parameter options"
          }
        },
        "required": [
          "image"
        ],
        "returns": "Promise<string>"
      },
      "execCommand": {
        "description": "Execute a command inside a running container",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Parameter containerIdOrName"
          },
          "command": {
            "type": "string[]",
            "description": "Parameter command"
          },
          "options": {
            "type": "{\n      interactive?: boolean\n      tty?: boolean\n      user?: string\n      workdir?: string\n      detach?: boolean\n    }",
            "description": "Parameter options"
          }
        },
        "required": [
          "containerIdOrName",
          "command"
        ],
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>"
      },
      "pullImage": {
        "description": "Pull an image from a registry",
        "parameters": {
          "image": {
            "type": "string",
            "description": "Parameter image"
          }
        },
        "required": [
          "image"
        ],
        "returns": "Promise<void>"
      },
      "removeImage": {
        "description": "Remove an image",
        "parameters": {
          "imageIdOrName": {
            "type": "string",
            "description": "Parameter imageIdOrName"
          },
          "options": {
            "type": "{ force?: boolean }",
            "description": "Parameter options"
          }
        },
        "required": [
          "imageIdOrName"
        ],
        "returns": "Promise<void>"
      },
      "buildImage": {
        "description": "Build an image from a Dockerfile",
        "parameters": {
          "contextPath": {
            "type": "string",
            "description": "Parameter contextPath"
          },
          "options": {
            "type": "{\n      tag?: string\n      dockerfile?: string\n      buildArgs?: Record<string, string>\n      target?: string\n      nocache?: boolean\n    }",
            "description": "Parameter options"
          }
        },
        "required": [
          "contextPath"
        ],
        "returns": "Promise<void>"
      },
      "getLogs": {
        "description": "Get container logs",
        "parameters": {
          "containerIdOrName": {
            "type": "string",
            "description": "Parameter containerIdOrName"
          },
          "options": {
            "type": "{\n      follow?: boolean\n      tail?: number\n      since?: string\n      timestamps?: boolean\n    }",
            "description": "Parameter options"
          }
        },
        "required": [
          "containerIdOrName"
        ],
        "returns": "Promise<string>"
      },
      "getSystemInfo": {
        "description": "Get Docker system information",
        "parameters": {},
        "required": [],
        "returns": "Promise<any>"
      },
      "prune": {
        "description": "Prune unused Docker resources",
        "parameters": {
          "options": {
            "type": "{\n    containers?: boolean\n    images?: boolean\n    volumes?: boolean\n    networks?: boolean\n    all?: boolean\n    force?: boolean\n  }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<void>"
      },
      "enable": {
        "description": "Initialize the Docker feature",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Parameter options"
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
    "options": {}
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
        "returns": "string"
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
        "returns": "T"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
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
        "returns": "void"
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
        "returns": "void"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
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
    "options": {}
  },
  {
    "id": "features.fs",
    "description": "The FS feature provides methods for interacting with the file system, relative to the container's cwd.",
    "shortcut": "features.fs",
    "methods": {
      "readFileAsync": {
        "description": "Asynchronously reads a file and returns its contents as a string.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "The file path relative to the container's working directory"
          }
        },
        "required": [
          "path"
        ],
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "string | null"
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
        "returns": "void"
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
        "returns": "boolean"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "Promise<string | string[] | null>"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
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
        "returns": "Promise<Server>"
      },
      "stopServer": {
        "description": "Stops the IPC server and cleans up all connections. This method gracefully shuts down the server by: 1. Closing the server listener 2. Destroying all active client connections 3. Clearing the sockets tracking set 4. Resetting the server instance",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "Promise<Socket>"
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
      "message": {
        "name": "message",
        "description": "Event emitted by IpcSocket",
        "arguments": {}
      },
      "connection": {
        "name": "connection",
        "description": "Event emitted by IpcSocket",
        "arguments": {}
      }
    },
    "state": {},
    "options": {}
  },
  {
    "id": "features.diskCache",
    "description": "DiskCache helper",
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
      },
      "keys": {
        "description": "Get all cache keys",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>"
      },
      "listKeys": {
        "description": "List all cache keys (alias for keys())",
        "parameters": {},
        "required": [],
        "returns": "Promise<string[]>"
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
        "returns": "void"
      }
    },
    "getters": {
      "cache": {
        "description": "Returns the underlying cacache instance configured with the cache directory path.",
        "returns": "any"
      },
      "securely": {
        "description": "Get encrypted cache operations interface Requires encryption to be enabled and a secret to be provided",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
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
            "description": "Parameter queryText"
          },
          "params": {
            "type": "SqlValue[]",
            "description": "Parameter params"
          }
        },
        "required": [
          "queryText"
        ],
        "returns": "Promise<T[]>"
      },
      "execute": {
        "description": "Executes a write/update/delete statement and returns metadata. Use postgres placeholders (`$1`, `$2`, ...) for `params`.",
        "parameters": {
          "queryText": {
            "type": "string",
            "description": "Parameter queryText"
          },
          "params": {
            "type": "SqlValue[]",
            "description": "Parameter params"
          }
        },
        "required": [
          "queryText"
        ],
        "returns": "Promise<{ rowCount: number }>"
      },
      "sql": {
        "description": "Safe tagged-template SQL helper. Values become bound parameters automatically.",
        "parameters": {
          "strings": {
            "type": "TemplateStringsArray",
            "description": "Parameter strings"
          },
          "values": {
            "type": "SqlValue[]",
            "description": "Parameter values"
          }
        },
        "required": [
          "strings",
          "values"
        ],
        "returns": "Promise<T[]>"
      },
      "close": {
        "description": "Closes the postgres connection and updates feature state.",
        "parameters": {},
        "required": [],
        "returns": "void"
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
    "options": {}
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
        "returns": "Promise<void>"
      },
      "installDependencies": {
        "description": "Installs dependencies for the Python project. This method automatically detects the appropriate package manager and install command based on the environment type. If a custom installCommand is provided in options, it will use that instead.",
        "parameters": {},
        "required": [],
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>"
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
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number; locals?: any }>"
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
        "returns": "Promise<{ stdout: string; stderr: string; exitCode: number }>"
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
    "options": {}
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
        "returns": "void"
      }
    },
    "getters": {
      "tree": {
        "description": "Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the JSON tree data that has been loaded through loadTree().",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
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
        "returns": "void"
      },
      "start": {
        "description": "Starts the package finder and performs the initial workspace scan. This method is idempotent - calling it multiple times will not re-scan if already started. It triggers the complete workspace scanning process.",
        "parameters": {},
        "required": [],
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
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
        "returns": "void"
      }
    },
    "getters": {
      "duplicates": {
        "description": "Gets a list of package names that have multiple versions/instances installed. This is useful for identifying potential dependency conflicts or opportunities for deduplication in the project.",
        "returns": "any"
      },
      "isStarted": {
        "description": "Checks if the package finder has completed its initial scan.",
        "returns": "any"
      },
      "packageNames": {
        "description": "Gets an array of all unique package names discovered in the workspace.",
        "returns": "any"
      },
      "scopes": {
        "description": "Gets an array of all scoped package prefixes found in the workspace. Scoped packages are those starting with '@' (e.g., @types/node, @babel/core). This returns just the scope part (e.g., '@types', '@babel').",
        "returns": "any"
      },
      "manifests": {
        "description": "Gets a flat array of all package manifests found in the workspace. This includes all versions/instances of packages, unlike packageNames which returns unique names only.",
        "returns": "any"
      },
      "counts": {
        "description": "Gets a count of instances for each package name. Useful for quickly identifying which packages have multiple versions and how many instances of each exist.",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
  },
  {
    "id": "portExposer",
    "description": "Port Exposer Feature Exposes local HTTP services via ngrok with SSL-enabled public URLs. Perfect for development, testing, and sharing local services securely. Features: - SSL-enabled public URLs for local services - Custom subdomains and domains (with paid plans) - Authentication options (basic auth, OAuth) - Regional endpoint selection - Connection state management",
    "shortcut": "portExposer",
    "methods": {
      "expose": {
        "description": "Expose the local port via ngrok",
        "parameters": {
          "port": {
            "type": "number",
            "description": "Optional port override"
          }
        },
        "required": [],
        "returns": "Promise<string>"
      },
      "close": {
        "description": "Stop exposing the port and close the ngrok tunnel",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "getPublicUrl": {
        "description": "Get the current public URL if connected",
        "parameters": {},
        "required": [],
        "returns": "string | undefined"
      },
      "isConnected": {
        "description": "Check if currently connected",
        "parameters": {},
        "required": [],
        "returns": "boolean"
      },
      "getConnectionInfo": {
        "description": "Get connection information",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "reconnect": {
        "description": "Reconnect with new options",
        "parameters": {
          "newOptions": {
            "type": "Partial<PortExposerOptions>",
            "description": "Parameter newOptions"
          }
        },
        "required": [],
        "returns": "Promise<string>"
      },
      "disable": {
        "description": "Override disable to ensure cleanup",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
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
    "options": {}
  },
  {
    "id": "features.mdxBundler",
    "description": "The MdxBundler feature provides MDX compilation capabilities. This feature wraps the mdx-bundler library to compile MDX content into executable JavaScript. MDX allows you to use JSX components within Markdown files, making it ideal for documentation and content that needs interactive elements.",
    "shortcut": "features.mdxBundler",
    "methods": {
      "compile": {
        "description": "Compiles MDX source code into executable JavaScript. This method takes MDX source code and optional file dependencies and compiles them into JavaScript code that can be executed in a React environment. The compilation process handles JSX transformation, import resolution, and bundling.",
        "parameters": {
          "source": {
            "type": "string",
            "description": "The MDX source code to compile"
          },
          "options": {
            "type": "CompileOptions",
            "description": "Compilation options",
            "properties": {
              "files": {
                "type": "Record<string, string>",
                "description": "Additional files to include in the bundle (path -> content mapping)"
              }
            }
          }
        },
        "required": [
          "source"
        ],
        "returns": "void"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
  },
  {
    "id": "features.secureShell",
    "description": "Uses ssh to run commands, or scp to transfer files between a remote host.",
    "shortcut": "features.secureShell",
    "methods": {
      "testConnection": {
        "description": "Test the SSH connection",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>"
      },
      "exec": {
        "description": "Executes a command on the remote host.",
        "parameters": {
          "command": {
            "type": "string",
            "description": "The command to execute."
          }
        },
        "required": [
          "command"
        ],
        "returns": "Promise<string>"
      },
      "download": {
        "description": "Downloads a file from the remote host.",
        "parameters": {
          "source": {
            "type": "string",
            "description": "The source file path on the remote host."
          },
          "target": {
            "type": "string",
            "description": "The target file path on the local machine."
          }
        },
        "required": [
          "source",
          "target"
        ],
        "returns": "Promise<string>"
      },
      "upload": {
        "description": "Uploads a file to the remote host.",
        "parameters": {
          "source": {
            "type": "string",
            "description": "The source file path on the local machine."
          },
          "target": {
            "type": "string",
            "description": "The target file path on the remote host."
          }
        },
        "required": [
          "source",
          "target"
        ],
        "returns": "Promise<string>"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {}
  },
  {
    "id": "features.runpod",
    "description": "Manage RunPod GPU cloud pods: list templates, available GPUs, create and manage pods.",
    "shortcut": "features.runpod",
    "methods": {
      "listTemplates": {
        "description": "",
        "parameters": {
          "options": {
            "type": "{ includePublic?: boolean, includeRunpod?: boolean }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<TemplateInfo[]>"
      },
      "getTemplate": {
        "description": "",
        "parameters": {
          "templateId": {
            "type": "string",
            "description": "Parameter templateId"
          }
        },
        "required": [
          "templateId"
        ],
        "returns": "Promise<TemplateInfo>"
      },
      "createPod": {
        "description": "",
        "parameters": {
          "options": {
            "type": "CreatePodOptions",
            "description": "Parameter options",
            "properties": {
              "name": {
                "type": "string",
                "description": ""
              },
              "imageName": {
                "type": "string",
                "description": ""
              },
              "gpuTypeId": {
                "type": "string | string[]",
                "description": ""
              },
              "gpuCount": {
                "type": "number",
                "description": ""
              },
              "templateId": {
                "type": "string",
                "description": ""
              },
              "cloudType": {
                "type": "'SECURE' | 'COMMUNITY'",
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
              "interruptible": {
                "type": "boolean",
                "description": ""
              },
              "networkVolumeId": {
                "type": "string",
                "description": ""
              },
              "minRAMPerGPU": {
                "type": "number",
                "description": ""
              }
            }
          }
        },
        "required": [
          "options"
        ],
        "returns": "Promise<PodInfo>"
      },
      "stopPod": {
        "description": "",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void"
      },
      "startPod": {
        "description": "",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void"
      },
      "removePod": {
        "description": "",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void"
      },
      "getpods": {
        "description": "Get all pods via REST API",
        "parameters": {
          "filters": {
            "type": "{ name?: string; imageName?: string; desiredStatus?: string }",
            "description": "Parameter filters"
          }
        },
        "required": [],
        "returns": "Promise<RestPodInfo[]>"
      },
      "getPod": {
        "description": "Get pod details via REST API (richer than runpodctl output)",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "Promise<RestPodInfo>"
      },
      "waitForPod": {
        "description": "Poll until a pod reaches a desired status, returns the pod info",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          },
          "status": {
            "type": "string",
            "description": "Parameter status"
          },
          "{ interval = 5000, timeout = 300000 }": {
            "type": "any",
            "description": "Parameter { interval = 5000, timeout = 300000 }"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "Promise<RestPodInfo>"
      },
      "listVolumes": {
        "description": "List all network storage volumes on your account",
        "parameters": {},
        "required": [],
        "returns": "Promise<VolumeInfo[]>"
      },
      "getVolume": {
        "description": "Get details for a specific network volume",
        "parameters": {
          "volumeId": {
            "type": "string",
            "description": "Parameter volumeId"
          }
        },
        "required": [
          "volumeId"
        ],
        "returns": "Promise<VolumeInfo>"
      },
      "createVolume": {
        "description": "Create a new network storage volume",
        "parameters": {
          "options": {
            "type": "CreateVolumeOptions",
            "description": "Parameter options",
            "properties": {
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
          }
        },
        "required": [
          "options"
        ],
        "returns": "Promise<VolumeInfo>"
      },
      "removeVolume": {
        "description": "Delete a network storage volume",
        "parameters": {
          "volumeId": {
            "type": "string",
            "description": "Parameter volumeId"
          }
        },
        "required": [
          "volumeId"
        ],
        "returns": "void"
      },
      "createRemoteShell": {
        "description": "",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void"
      },
      "getShell": {
        "description": "Get a SecureShell for a pod using the REST API (portMappings + publicIp). Preferred over createRemoteShell which requires runpodctl CLI.",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void"
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
        "returns": "Promise<{ existed: boolean; path: string }>"
      },
      "getPodHttpURLs": {
        "description": "",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "void"
      },
      "listPods": {
        "description": "",
        "parameters": {
          "detailed": {
            "type": "any",
            "description": "Parameter detailed"
          }
        },
        "required": [],
        "returns": "Promise<PodInfo[]>"
      },
      "getPodInfo": {
        "description": "",
        "parameters": {
          "podId": {
            "type": "string",
            "description": "Parameter podId"
          }
        },
        "required": [
          "podId"
        ],
        "returns": "Promise<PodInfo>"
      },
      "listSecureGPUs": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "proc": {
        "description": "",
        "returns": "any"
      },
      "apiKey": {
        "description": "",
        "returns": "any"
      },
      "dataCenterId": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
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
    "options": {}
  },
  {
    "id": "features.contentDb",
    "description": "Turns an organized folder of structured markdown files into an ORM like database This is a wrapper around the Contentbase library essentially. You can access raw document objects and query them, without having to define models or anything.",
    "shortcut": "features.contentDb",
    "methods": {
      "parseMarkdownAtPath": {
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
      "load": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<ContentDb>"
      },
      "defineModel": {
        "description": "",
        "parameters": {
          "definerFunction": {
            "type": "(library: typeof this.library) => ModelDefinition",
            "description": "Parameter definerFunction"
          }
        },
        "required": [
          "definerFunction"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "library": {
        "description": "Returns the Contentbase library utilities: Collection, defineModel, section, hasMany, belongsTo.",
        "returns": "any"
      },
      "models": {
        "description": "Returns an object mapping model names to their model definitions.",
        "returns": "any"
      },
      "isLoaded": {
        "description": "Whether the content database has been loaded.",
        "returns": "any"
      },
      "modelNames": {
        "description": "Returns an array of all registered model names.",
        "returns": "any"
      },
      "collection": {
        "description": "Returns the lazily-initialized Collection instance for the configured rootPath.",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {}
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
    "options": {}
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
    "options": {}
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
    "options": {}
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
        "returns": "Assistant"
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
    "options": {}
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
        "returns": "Promise<string>"
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
      "messages": {
        "description": "Returns the full message history of the conversation.",
        "returns": "Message[]"
      },
      "model": {
        "description": "Returns the OpenAI model name being used for completions.",
        "returns": "string"
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
    "options": {}
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
            "description": "Parameter name"
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
            "description": "Optional predicate to select which endpoints to include."
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
            "description": "Parameter name"
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
            "description": "Optional predicate to select which endpoints to include."
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
            "description": "Parameter name"
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
    "options": {}
  },
  {
    "id": "features.docsReader",
    "description": "A docs reader that wraps a ContentDb and provides a Conversation with tools to list, outline, and read documents. Ask it a question and it will find and read the relevant docs to answer it.",
    "shortcut": "features.docsReader",
    "methods": {
      "buildTools": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Record<string, ConversationTool>"
      },
      "buildSystemPrompt": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "string"
      },
      "createConversation": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Conversation"
      },
      "start": {
        "description": "",
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
    "options": {}
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
    "options": {}
  },
  {
    "id": "features.assistant",
    "description": "An Assistant is a combination of a system prompt and tool calls that has a conversation with an LLM. You define an assistant by creating a folder with CORE.md (system prompt), tools.ts (tool implementations), hooks.ts (event handlers), and a docs/ subfolder of structured markdown the assistant can research. Every assistant automatically gets a researchInternalDocs tool backed by a DocsReader that can query the assistant's docs/ folder.",
    "shortcut": "features.assistant",
    "methods": {
      "loadSystemPrompt": {
        "description": "Load the system prompt from CORE.md, applying any prepend/append options.",
        "parameters": {},
        "required": [],
        "returns": "string"
      },
      "loadTools": {
        "description": "Load tools from tools.ts using the container's VM feature, injecting the container and assistant as globals. Merges with any tools provided in the constructor options.",
        "parameters": {},
        "required": [],
        "returns": "Promise<Record<string, ConversationTool>>"
      },
      "loadHooks": {
        "description": "Load event hooks from hooks.ts. Each exported function name should match an event the assistant emits. When that event fires, the corresponding hook function is called.",
        "parameters": {},
        "required": [],
        "returns": "Promise<Record<string, (...args: any[]) => any>>"
      },
      "initDocsReader": {
        "description": "Initialize the DocsReader for the assistant's docs/ folder, providing the researchInternalDocs tool.",
        "parameters": {},
        "required": [],
        "returns": "Promise<DocsReader | undefined>"
      },
      "start": {
        "description": "Start the assistant by loading the system prompt, tools, uooks, and docs reader, then creating the underlying conversation.",
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
        "returns": "Promise<string>"
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
      "systemPromptLoaded": {
        "name": "systemPromptLoaded",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "toolsLoaded": {
        "name": "toolsLoaded",
        "description": "Event emitted by Assistant",
        "arguments": {}
      },
      "hooksLoaded": {
        "name": "hooksLoaded",
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
    "options": {}
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
        "returns": "Promise<boolean>"
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
                "description": "MCP config paths or JSON strings."
              },
              "dangerouslySkipPermissions": {
                "type": "boolean",
                "description": "Skip all permission checks (only for sandboxed environments)."
              },
              "extraArgs": {
                "type": "string[]",
                "description": "Additional arbitrary CLI flags."
              }
            }
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<ClaudeSession>"
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
                "description": "MCP config paths or JSON strings."
              },
              "dangerouslySkipPermissions": {
                "type": "boolean",
                "description": "Skip all permission checks (only for sandboxed environments)."
              },
              "extraArgs": {
                "type": "string[]",
                "description": "Additional arbitrary CLI flags."
              }
            }
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "string"
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
        "returns": "void"
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
        "returns": "ClaudeSession | undefined"
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
        "returns": "Promise<ClaudeSession>"
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
    "options": {}
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
            "description": "Parameter prompt"
          },
          "options": {
            "type": "CodexRunOptions",
            "description": "Parameter options",
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
        "returns": "Promise<CodexSession>"
      },
      "start": {
        "description": "Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "Parameter prompt"
          },
          "options": {
            "type": "CodexRunOptions",
            "description": "Parameter options",
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
        "returns": "string"
      },
      "abort": {
        "description": "Kill a running session's subprocess.",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "Parameter sessionId"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "void"
      },
      "getSession": {
        "description": "",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "Parameter sessionId"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "CodexSession | undefined"
      },
      "waitForSession": {
        "description": "",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "Parameter sessionId"
          }
        },
        "required": [
          "sessionId"
        ],
        "returns": "Promise<CodexSession>"
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
    "options": {}
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
            "description": "Parameter opts"
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
            "description": "Parameter id"
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
            "description": "Parameter id"
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
            "description": "Parameter id"
          },
          "messages": {
            "type": "Message[]",
            "description": "Parameter messages"
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
            "description": "Parameter id"
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
            "description": "Parameter options",
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
            "description": "Parameter options",
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
            "description": "Parameter id"
          },
          "tags": {
            "type": "string[]",
            "description": "Parameter tags"
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
            "description": "Parameter id"
          },
          "tags": {
            "type": "string[]",
            "description": "Parameter tags"
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
            "description": "Parameter id"
          },
          "updates": {
            "type": "Partial<Pick<ConversationRecord, 'title' | 'tags' | 'thread' | 'metadata'>>",
            "description": "Parameter updates"
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
    "options": {}
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
