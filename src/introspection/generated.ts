import { __MAIN_INTROSPECTION_REGISTRY__ } from './index.js';

// Auto-generated introspection registry data
// Generated at: 2025-06-10T04:36:27.678Z

__MAIN_INTROSPECTION_REGISTRY__.set('features.yamlTree', {
  "id": "features.yamlTree",
  "description": "YamlTree Feature - A powerful YAML file tree loader and processor This feature provides functionality to recursively load YAML files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive YAML file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Support for both .yml and .yaml file extensions",
  "shortcut": "features.yamlTree",
  "methods": {
    "attach": {
      "description": "Attaches the YamlTree feature to a NodeContainer instance. Registers the feature and creates an auto-enabled instance.",
      "parameters": {
        "container": {
          "type": "NodeContainer & { yamlTree?: YamlTree }",
          "description": "Parameter container"
        }
      },
      "required": [
        "container"
      ],
      "returns": "void"
    },
    "loadTree": {
      "description": "Loads a tree of YAML files from the specified base path and stores them in state. This method recursively scans the provided directory for YAML files (.yml and .yaml), processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Path Processing:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes file extensions (.yml/.yaml) **Example:** ``` config/ database/ production.yml  -> tree.config.database.production staging.yml     -> tree.config.database.staging api/ endpoints.yaml  -> tree.config.api.endpoints ```",
      "parameters": {
        "basePath": {
          "type": "string",
          "description": "Parameter basePath"
        },
        "key": {
          "type": "string",
          "description": "Parameter key"
        }
      },
      "required": [
        "basePath"
      ],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.git', {
  "id": "features.git",
  "description": "The Git feature provides utilities for interacting with Git repositories. This feature allows you to check repository status, list files, get branch information, and access Git metadata for projects within a Git repository.",
  "shortcut": "features.git",
  "methods": {
    "lsFiles": {
      "description": "Lists files in the Git repository using git ls-files command. This method provides a flexible interface to the git ls-files command, allowing you to filter files by various criteria such as cached, deleted, modified, untracked, and ignored files.",
      "parameters": {
        "options": {
          "type": "LsFilesOptions",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.esbuild', {
  "id": "features.esbuild",
  "description": "A Feature for compiling typescript / esm modules, etc to JavaScript that the container can run at runtime.",
  "shortcut": "features.esbuild",
  "methods": {
    "attach": {
      "description": "",
      "parameters": {
        "c": {
          "type": "NodeContainer",
          "description": "Parameter c"
        }
      },
      "required": [
        "c"
      ],
      "returns": "void"
    },
    "transformSync": {
      "description": "Transform code synchronously",
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
    "transform": {
      "description": "Transform code asynchronously",
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
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.downloader', {
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
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.proc', {
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
          "description": "Parameter options"
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
          "description": "Parameter options"
        }
      },
      "required": [
        "command",
        "args"
      ],
      "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>"
    },
    "exec": {
      "description": "Executes a command synchronously and returns its output. This method runs a command and waits for it to complete before returning. It's useful for simple commands where you need the result immediately and don't require real-time output monitoring.",
      "parameters": {
        "command": {
          "type": "string",
          "description": "The command to execute"
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
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.vm', {
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
          "description": "Parameter options"
        }
      },
      "required": [
        "code"
      ],
      "returns": "void"
    },
    "createContext": {
      "description": "Creates a new execution context for running VM scripts. This method creates an isolated JavaScript execution context that combines the container's context with any additional context variables provided. The resulting context can be used to run scripts with controlled variable access.",
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
          "description": "Parameter ctx"
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

__MAIN_INTROSPECTION_REGISTRY__.set('features.ui', {
  "id": "features.ui",
  "description": "UI Feature - Interactive Terminal User Interface Builder This feature provides comprehensive tools for creating beautiful, interactive terminal experiences. It combines several popular libraries (chalk, figlet, inquirer) into a unified interface for building professional CLI applications with colors, ASCII art, and interactive prompts. **Core Capabilities:** - Rich color management using chalk library - ASCII art generation with multiple fonts - Interactive prompts and wizards - Automatic color assignment for consistent theming - Text padding and formatting utilities - Gradient text effects (horizontal and vertical) - Banner creation with styled ASCII art **Color System:** - Full chalk API access for complex styling - Automatic color assignment with palette cycling - Consistent color mapping for named entities - Support for hex colors and gradients **ASCII Art Features:** - Multiple font options via figlet - Automatic font discovery and caching - Banner creation with color gradients - Text styling and effects **Interactive Elements:** - Wizard creation with inquirer integration - External editor integration - User input validation and processing **Usage Examples:** **Basic Colors:** ```typescript const ui = container.feature('ui'); // Direct color usage ui.print.red('Error message'); ui.print.green('Success!'); // Complex styling console.log(ui.colors.blue.bold.underline('Important text')); ``` **ASCII Art Banners:** ```typescript const banner = ui.banner('MyApp', { font: 'Big', colors: ['red', 'white', 'blue'] }); console.log(banner); ``` **Interactive Wizards:** ```typescript const answers = await ui.wizard([ { type: 'input', name: 'name', message: 'Your name?' }, { type: 'confirm', name: 'continue', message: 'Continue?' } ]); ``` **Automatic Color Assignment:** ```typescript const userColor = ui.assignColor('john'); const adminColor = ui.assignColor('admin'); console.log(userColor('John\\'s message')); console.log(adminColor('Admin notice')); ```",
  "shortcut": "features.ui",
  "methods": {
    "afterInitialize": {
      "description": "Initializes the UI feature after construction. Sets up the enhanced print function with color methods and hides internal state.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "assignColor": {
      "description": "Assigns a consistent color to a named entity. This method provides automatic color assignment that remains consistent across the application session. Each unique name gets assigned a color from the palette, and subsequent calls with the same name return the same color function. **Assignment Strategy:** - First call with a name assigns the next available palette color - Subsequent calls return the previously assigned color - Colors cycle through the palette when all colors are used - Returns a chalk hex color function for styling text",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Parameter name"
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
          "description": "Parameter questions"
        },
        "initialAnswers": {
          "type": "any",
          "description": "Parameter initialAnswers"
        }
      },
      "required": [
        "questions"
      ],
      "returns": "void"
    },
    "openInEditor": {
      "description": "Opens text in the user's external editor for editing. This method integrates with the user's configured editor (via $EDITOR or $VISUAL environment variables) to allow editing of text content. The edited content is returned when the user saves and closes the editor. **Editor Integration:** - Respects $EDITOR and $VISUAL environment variables - Creates temporary file with specified extension - Returns modified content after editor closes - Handles editor cancellation gracefully",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        },
        "extension": {
          "type": "any",
          "description": "Parameter extension"
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
          "description": "Parameter text"
        },
        "font": {
          "type": "Fonts",
          "description": "Parameter font"
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
          "description": "Parameter text"
        },
        "options": {
          "type": "{ font: Fonts; colors: Color[] }",
          "description": "Parameter options"
        }
      },
      "required": [
        "text",
        "options"
      ],
      "returns": "void"
    },
    "applyGradient": {
      "description": "Applies color gradients to text with configurable direction. This method creates smooth color transitions across text content, supporting both horizontal (character-by-character) and vertical (line-by-line) gradients. Perfect for creating visually appealing terminal output and ASCII art effects. **Gradient Types:** - Horizontal: Colors transition across characters in each line - Vertical: Colors transition across lines of text - Customizable color sequences and transitions - Automatic color cycling for long content",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        },
        "lineColors": {
          "type": "Color[]",
          "description": "Parameter lineColors"
        },
        "direction": {
          "type": "\"horizontal\" | \"vertical\"",
          "description": "Parameter direction"
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
          "description": "Parameter text"
        },
        "lineColors": {
          "type": "Color[]",
          "description": "Parameter lineColors"
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
          "description": "Parameter text"
        },
        "lineColors": {
          "type": "Color[]",
          "description": "Parameter lineColors"
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
          "description": "Parameter str"
        },
        "length": {
          "type": "number",
          "description": "Parameter length"
        },
        "padChar": {
          "type": "any",
          "description": "Parameter padChar"
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
          "description": "Parameter str"
        },
        "length": {
          "type": "number",
          "description": "Parameter length"
        },
        "padChar": {
          "type": "any",
          "description": "Parameter padChar"
        }
      },
      "required": [
        "str",
        "length"
      ],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.repl', {
  "id": "features.repl",
  "description": "Repl Feature - Interactive Node.js REPL (Read-Eval-Print Loop) server This feature provides a fully-featured REPL server with support for: - Custom evaluation context with container access - Persistent command history - Promise-aware evaluation (async/await support) - Customizable prompts and settings - Integration with the container's context and features The REPL runs in a sandboxed VM context but provides access to the container and all its features, making it perfect for interactive debugging and exploration. **Key Features:** - VM-based evaluation for security - Automatic promise resolution in REPL output - Persistent history across sessions - Full container context access - Colored terminal output support **Usage Example:** ```typescript const repl = container.feature('repl'); await repl.start({ historyPath: '.repl_history', context: { customVar: 'value' } }); // REPL is now running and accessible ```",
  "shortcut": "features.repl",
  "methods": {
    "createServer": {
      "description": "Creates and configures a new REPL server instance. This method sets up the REPL with custom evaluation logic that: - Runs code in a VM context for isolation - Automatically handles Promise resolution - Provides colored terminal output - Uses the configured prompt The REPL evaluation supports both synchronous and asynchronous code execution, automatically detecting and awaiting Promises in the result.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "start": {
      "description": "Starts the REPL server with the specified configuration. This method initializes the REPL server, sets up command history persistence, and configures the evaluation context. The context includes: - All container features and properties - Custom context variables passed in options - Helper functions like `client()` for creating clients **History Management:** - Creates history file directory if it doesn't exist - Uses provided historyPath or defaults to node_modules/.cache/.repl_history - Persists command history across sessions **Context Setup:** - Inherits full container context - Adds custom context variables - Provides convenience methods for container interaction",
      "parameters": {
        "options": {
          "type": "{ historyPath?: string, context?: any, exclude?: string | string[] }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.scriptRunner', {
  "id": "features.scriptRunner",
  "description": "The ScriptRunner feature provides convenient access to npm scripts defined in package.json. This feature automatically generates camelCase methods for each script in the package.json file, allowing you to execute them programmatically with additional arguments and options.",
  "shortcut": "features.scriptRunner",
  "methods": {},
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.os', {
  "id": "features.os",
  "description": "The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.",
  "shortcut": "features.os",
  "methods": {},
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.yaml', {
  "id": "features.yaml",
  "description": "The YAML feature provides utilities for parsing and stringifying YAML data. This feature wraps the js-yaml library to provide convenient methods for converting between YAML strings and JavaScript objects. It's automatically attached to Node containers for easy access.",
  "shortcut": "features.yaml",
  "methods": {
    "attach": {
      "description": "Automatically attaches the YAML feature to Node containers. This static method ensures the YAML feature is automatically available on Node containers without needing manual registration.",
      "parameters": {
        "c": {
          "type": "NodeContainer",
          "description": "The Node container to attach to"
        }
      },
      "required": [
        "c"
      ],
      "returns": "void"
    },
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
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.networking', {
  "id": "features.networking",
  "description": "The Networking feature provides utilities for network-related operations. This feature includes utilities for port detection and availability checking, which are commonly needed when setting up servers or network services.",
  "shortcut": "features.networking",
  "methods": {
    "findOpenPort": {
      "description": "Finds the next available port starting from the specified port number. This method will search for the first available port starting from the given port number. If the specified port is available, it returns that port. Otherwise, it returns the next available port.",
      "parameters": {
        "startAt": {
          "type": "any",
          "description": "Parameter startAt"
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
          "description": "Parameter checkPort"
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.vault', {
  "id": "features.vault",
  "description": "The Vault feature provides encryption and decryption capabilities using AES-256-GCM. This feature allows you to securely encrypt and decrypt sensitive data using industry-standard encryption. It manages secret keys and provides a simple interface for cryptographic operations.",
  "shortcut": "features.vault",
  "methods": {
    "attach": {
      "description": "",
      "parameters": {
        "c": {
          "type": "NodeContainer",
          "description": "Parameter c"
        }
      },
      "required": [
        "c"
      ],
      "returns": "void"
    },
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
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.fs', {
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
          "description": "Options to configure the walk behavior"
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
          "description": "Options to configure the walk behavior"
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
          "description": "Parameter overwrite"
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
          "description": "Parameter overwrite"
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
          "description": "Parameter options"
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
          "description": "Parameter options"
        }
      },
      "required": [
        "fileName"
      ],
      "returns": "Promise<string | string[] | null>"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.ipcSocket', {
  "id": "features.ipcSocket",
  "description": "IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Dual-mode operation: server and client functionality - JSON message serialization/deserialization - Multiple client connection support (server mode) - Event-driven message handling - Automatic socket cleanup and management - Broadcast messaging to all connected clients - Lock file management for socket paths **Communication Pattern:** - Messages are automatically JSON-encoded with unique IDs - Both server and client emit 'message' events for incoming data - Server can broadcast to all connected clients - Client maintains single connection to server **Socket Management:** - Automatic cleanup of stale socket files - Connection tracking and management - Graceful shutdown procedures - Lock file protection against conflicts **Usage Examples:** **Server Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/myapp.sock', true); // removeLock=true ipc.on('connection', (socket) => { console.log('Client connected'); }); ipc.on('message', (data) => { console.log('Received:', data); ipc.broadcast({ reply: 'ACK', original: data }); }); ``` **Client Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/myapp.sock'); ipc.on('message', (data) => { console.log('Server says:', data); }); await ipc.send({ type: 'request', payload: 'hello' }); ```",
  "shortcut": "features.ipcSocket",
  "methods": {
    "attach": {
      "description": "Attaches the IpcSocket feature to a NodeContainer instance. Registers the feature and creates an auto-enabled instance.",
      "parameters": {
        "container": {
          "type": "NodeContainer & { ipcSocket?: IpcSocket }",
          "description": "Parameter container"
        }
      },
      "required": [
        "container"
      ],
      "returns": "void"
    },
    "listen": {
      "description": "Starts the IPC server listening on the specified socket path. This method sets up a Unix domain socket server that can accept multiple client connections. Each connected client is tracked, and the server automatically handles connection lifecycle events. Messages received from clients are JSON-parsed and emitted as 'message' events. **Server Behavior:** - Tracks all connected clients in the sockets Set - Automatically removes clients when they disconnect - JSON-parses incoming messages and emits 'message' events - Emits 'connection' events when clients connect - Prevents starting multiple servers on the same instance **Socket File Management:** - Resolves the socket path relative to the container's working directory - Optionally removes existing socket files to prevent \"address in use\" errors - Throws error if socket file exists and removeLock is false",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "Parameter socketPath"
        },
        "removeLock": {
          "type": "any",
          "description": "Parameter removeLock"
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
          "description": "Parameter message"
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
          "description": "Parameter message"
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
          "description": "Parameter socketPath"
        }
      },
      "required": [
        "socketPath"
      ],
      "returns": "Promise<Socket>"
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
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.diskCache', {
  "id": "features.diskCache",
  "description": "DiskCache helper",
  "shortcut": "features.diskCache",
  "methods": {
    "attach": {
      "description": "",
      "parameters": {
        "c": {
          "type": "NodeContainer",
          "description": "Parameter c"
        }
      },
      "required": [
        "c"
      ],
      "returns": "void"
    },
    "saveFile": {
      "description": "Retrieve a file from the disk cache and save it to the local disk",
      "parameters": {
        "key": {
          "type": "string",
          "description": "Parameter key"
        },
        "outputPath": {
          "type": "string",
          "description": "Parameter outputPath"
        },
        "isBase64": {
          "type": "any",
          "description": "Parameter isBase64"
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
          "description": "Parameter key"
        },
        "content": {
          "type": "string",
          "description": "Parameter content"
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
          "description": "Parameter source"
        },
        "destination": {
          "type": "string",
          "description": "Parameter destination"
        },
        "overwrite": {
          "type": "boolean",
          "description": "Parameter overwrite"
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
          "description": "Parameter source"
        },
        "destination": {
          "type": "string",
          "description": "Parameter destination"
        },
        "overwrite": {
          "type": "boolean",
          "description": "Parameter overwrite"
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
          "description": "Parameter key"
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
          "description": "Parameter key"
        },
        "json": {
          "type": "any",
          "description": "Parameter json"
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
          "description": "Parameter key"
        },
        "value": {
          "type": "any",
          "description": "Parameter value"
        },
        "meta": {
          "type": "any",
          "description": "Parameter meta"
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
          "description": "Parameter key"
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
          "description": "Parameter confirm"
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
          "description": "Parameter path"
        }
      },
      "required": [],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.jsonTree', {
  "id": "features.jsonTree",
  "description": "JsonTree Feature - A powerful JSON file tree loader and processor This feature provides functionality to recursively load JSON files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive JSON file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Native JSON parsing for optimal performance **Path Processing:** Files are processed to create a nested object structure: - Directory names become object properties (camelCased) - File names become the final property names (without .json extension) - Nested directories create nested objects **Usage Example:** ```typescript const jsonTree = container.feature('jsonTree', { enable: true }); await jsonTree.loadTree('data', 'appData'); const userData = jsonTree.tree.appData.users.profiles; ``` **Directory Structure Example:** ``` data/ users/ profiles.json    -> tree.data.users.profiles settings.json    -> tree.data.users.settings config/ app-config.json  -> tree.data.config.appConfig ```",
  "shortcut": "features.jsonTree",
  "methods": {
    "attach": {
      "description": "Attaches the JsonTree feature to a NodeContainer instance. Registers the feature in the container's feature registry for later use.",
      "parameters": {
        "container": {
          "type": "NodeContainer & { jsonTree?: JsonTree }",
          "description": "Parameter container"
        }
      },
      "required": [
        "container"
      ],
      "returns": "void"
    },
    "loadTree": {
      "description": "Loads a tree of JSON files from the specified base path and stores them in state. This method recursively scans the provided directory for JSON files, processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Processing Steps:** 1. Uses FileManager to discover all .json files recursively 2. Reads each file's content using the file system feature 3. Parses JSON content using native JSON.parse() 4. Converts file paths to nested object properties 5. Stores the complete tree in feature state **Path Transformation:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes .json file extension **Example Transformation:** ``` config/ database/ production.json  -> tree.config.database.production staging.json     -> tree.config.database.staging api/ endpoints.json   -> tree.config.api.endpoints ```",
      "parameters": {
        "basePath": {
          "type": "string",
          "description": "Parameter basePath"
        },
        "key": {
          "type": "string",
          "description": "Parameter key"
        }
      },
      "required": [
        "basePath"
      ],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.packageFinder', {
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
          "description": "Parameter manifest"
        },
        "path": {
          "type": "string",
          "description": "Parameter path"
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
          "description": "Parameter options"
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
          "description": "Parameter name"
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
          "description": "Parameter packageName"
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
          "description": "Parameter filter"
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
          "description": "Parameter filter"
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
          "description": "Parameter filter"
        }
      },
      "required": [
        "filter"
      ],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('features.mdxBundler', {
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
          "description": "Parameter options"
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

__MAIN_INTROSPECTION_REGISTRY__.set('features.fileManager', {
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
          "description": "Parameter options"
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
          "description": "Parameter options"
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
          "description": "Parameter options"
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
  "events": {
    "file:change": {
      "name": "file:change",
      "description": "Event emitted by FileManager",
      "arguments": {}
    }
  },
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('clients.openai', {
  "id": "clients.openai",
  "description": "OpenAIClient helper",
  "shortcut": "clients.openai",
  "methods": {
    "attach": {
      "description": "",
      "parameters": {
        "container": {
          "type": "Container & ClientsInterface",
          "description": "Parameter container"
        }
      },
      "required": [
        "container"
      ],
      "returns": "any"
    },
    "connect": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "createChatCompletion": {
      "description": "",
      "parameters": {
        "messages": {
          "type": "OpenAI.Chat.Completions.ChatCompletionMessageParam[]",
          "description": "Parameter messages"
        },
        "options": {
          "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
          "description": "Parameter options"
        }
      },
      "required": [
        "messages"
      ],
      "returns": "Promise<OpenAI.Chat.Completions.ChatCompletion>"
    },
    "createCompletion": {
      "description": "",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "Parameter prompt"
        },
        "options": {
          "type": "Partial<OpenAI.Completions.CompletionCreateParams>",
          "description": "Parameter options"
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<OpenAI.Completions.Completion>"
    },
    "createEmbedding": {
      "description": "",
      "parameters": {
        "input": {
          "type": "string | string[]",
          "description": "Parameter input"
        },
        "options": {
          "type": "Partial<OpenAI.Embeddings.EmbeddingCreateParams>",
          "description": "Parameter options"
        }
      },
      "required": [
        "input"
      ],
      "returns": "Promise<OpenAI.Embeddings.CreateEmbeddingResponse>"
    },
    "createImage": {
      "description": "",
      "parameters": {
        "prompt": {
          "type": "string",
          "description": "Parameter prompt"
        },
        "options": {
          "type": "Partial<OpenAI.Images.ImageGenerateParams>",
          "description": "Parameter options"
        }
      },
      "required": [
        "prompt"
      ],
      "returns": "Promise<OpenAI.Images.ImagesResponse>"
    },
    "listModels": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<OpenAI.Models.ModelsPage>"
    },
    "ask": {
      "description": "",
      "parameters": {
        "question": {
          "type": "string",
          "description": "Parameter question"
        },
        "options": {
          "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
          "description": "Parameter options"
        }
      },
      "required": [
        "question"
      ],
      "returns": "Promise<string>"
    },
    "chat": {
      "description": "",
      "parameters": {
        "messages": {
          "type": "OpenAI.Chat.Completions.ChatCompletionMessageParam[]",
          "description": "Parameter messages"
        },
        "options": {
          "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
          "description": "Parameter options"
        }
      },
      "required": [
        "messages"
      ],
      "returns": "Promise<string>"
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
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('servers.express', {
  "id": "servers.express",
  "description": "ExpressServer helper",
  "shortcut": "servers.express",
  "methods": {
    "attach": {
      "description": "",
      "parameters": {
        "container": {
          "type": "NodeContainer & ServersInterface",
          "description": "Parameter container"
        }
      },
      "required": [
        "container"
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
    },
    "configure": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "events": {},
  "state": {}
});

__MAIN_INTROSPECTION_REGISTRY__.set('servers.websocket', {
  "id": "servers.websocket",
  "description": "WebsocketServer helper",
  "shortcut": "servers.websocket",
  "methods": {
    "attach": {
      "description": "",
      "parameters": {
        "container": {
          "type": "NodeContainer & ServersInterface",
          "description": "Parameter container"
        }
      },
      "required": [
        "container"
      ],
      "returns": "void"
    },
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
  "state": {}
});
export const introspectionData = [
  {
    "id": "features.yamlTree",
    "description": "YamlTree Feature - A powerful YAML file tree loader and processor This feature provides functionality to recursively load YAML files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive YAML file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Support for both .yml and .yaml file extensions",
    "shortcut": "features.yamlTree",
    "methods": {
      "attach": {
        "description": "Attaches the YamlTree feature to a NodeContainer instance. Registers the feature and creates an auto-enabled instance.",
        "parameters": {
          "container": {
            "type": "NodeContainer & { yamlTree?: YamlTree }",
            "description": "Parameter container"
          }
        },
        "required": [
          "container"
        ],
        "returns": "void"
      },
      "loadTree": {
        "description": "Loads a tree of YAML files from the specified base path and stores them in state. This method recursively scans the provided directory for YAML files (.yml and .yaml), processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Path Processing:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes file extensions (.yml/.yaml) **Example:** ``` config/ database/ production.yml  -> tree.config.database.production staging.yml     -> tree.config.database.staging api/ endpoints.yaml  -> tree.config.api.endpoints ```",
        "parameters": {
          "basePath": {
            "type": "string",
            "description": "Parameter basePath"
          },
          "key": {
            "type": "string",
            "description": "Parameter key"
          }
        },
        "required": [
          "basePath"
        ],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
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
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
  },
  {
    "id": "features.esbuild",
    "description": "A Feature for compiling typescript / esm modules, etc to JavaScript that the container can run at runtime.",
    "shortcut": "features.esbuild",
    "methods": {
      "attach": {
        "description": "",
        "parameters": {
          "c": {
            "type": "NodeContainer",
            "description": "Parameter c"
          }
        },
        "required": [
          "c"
        ],
        "returns": "void"
      },
      "transformSync": {
        "description": "Transform code synchronously",
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
      "transform": {
        "description": "Transform code asynchronously",
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
      }
    },
    "events": {},
    "state": {}
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
    "events": {},
    "state": {}
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
            "description": "Parameter options"
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
            "description": "Parameter options"
          }
        },
        "required": [
          "command",
          "args"
        ],
        "returns": "Promise<{\n    stderr: string;\n    stdout: string;\n    error: null | any;\n    exitCode: number;\n    pid: number | null;\n  }>"
      },
      "exec": {
        "description": "Executes a command synchronously and returns its output. This method runs a command and waits for it to complete before returning. It's useful for simple commands where you need the result immediately and don't require real-time output monitoring.",
        "parameters": {
          "command": {
            "type": "string",
            "description": "The command to execute"
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
    "events": {},
    "state": {}
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
            "description": "Parameter options"
          }
        },
        "required": [
          "code"
        ],
        "returns": "void"
      },
      "createContext": {
        "description": "Creates a new execution context for running VM scripts. This method creates an isolated JavaScript execution context that combines the container's context with any additional context variables provided. The resulting context can be used to run scripts with controlled variable access.",
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
            "description": "Parameter ctx"
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
    "id": "features.ui",
    "description": "UI Feature - Interactive Terminal User Interface Builder This feature provides comprehensive tools for creating beautiful, interactive terminal experiences. It combines several popular libraries (chalk, figlet, inquirer) into a unified interface for building professional CLI applications with colors, ASCII art, and interactive prompts. **Core Capabilities:** - Rich color management using chalk library - ASCII art generation with multiple fonts - Interactive prompts and wizards - Automatic color assignment for consistent theming - Text padding and formatting utilities - Gradient text effects (horizontal and vertical) - Banner creation with styled ASCII art **Color System:** - Full chalk API access for complex styling - Automatic color assignment with palette cycling - Consistent color mapping for named entities - Support for hex colors and gradients **ASCII Art Features:** - Multiple font options via figlet - Automatic font discovery and caching - Banner creation with color gradients - Text styling and effects **Interactive Elements:** - Wizard creation with inquirer integration - External editor integration - User input validation and processing **Usage Examples:** **Basic Colors:** ```typescript const ui = container.feature('ui'); // Direct color usage ui.print.red('Error message'); ui.print.green('Success!'); // Complex styling console.log(ui.colors.blue.bold.underline('Important text')); ``` **ASCII Art Banners:** ```typescript const banner = ui.banner('MyApp', { font: 'Big', colors: ['red', 'white', 'blue'] }); console.log(banner); ``` **Interactive Wizards:** ```typescript const answers = await ui.wizard([ { type: 'input', name: 'name', message: 'Your name?' }, { type: 'confirm', name: 'continue', message: 'Continue?' } ]); ``` **Automatic Color Assignment:** ```typescript const userColor = ui.assignColor('john'); const adminColor = ui.assignColor('admin'); console.log(userColor('John\\'s message')); console.log(adminColor('Admin notice')); ```",
    "shortcut": "features.ui",
    "methods": {
      "afterInitialize": {
        "description": "Initializes the UI feature after construction. Sets up the enhanced print function with color methods and hides internal state.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "assignColor": {
        "description": "Assigns a consistent color to a named entity. This method provides automatic color assignment that remains consistent across the application session. Each unique name gets assigned a color from the palette, and subsequent calls with the same name return the same color function. **Assignment Strategy:** - First call with a name assigns the next available palette color - Subsequent calls return the previously assigned color - Colors cycle through the palette when all colors are used - Returns a chalk hex color function for styling text",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Parameter name"
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
            "description": "Parameter questions"
          },
          "initialAnswers": {
            "type": "any",
            "description": "Parameter initialAnswers"
          }
        },
        "required": [
          "questions"
        ],
        "returns": "void"
      },
      "openInEditor": {
        "description": "Opens text in the user's external editor for editing. This method integrates with the user's configured editor (via $EDITOR or $VISUAL environment variables) to allow editing of text content. The edited content is returned when the user saves and closes the editor. **Editor Integration:** - Respects $EDITOR and $VISUAL environment variables - Creates temporary file with specified extension - Returns modified content after editor closes - Handles editor cancellation gracefully",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          },
          "extension": {
            "type": "any",
            "description": "Parameter extension"
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
            "description": "Parameter text"
          },
          "font": {
            "type": "Fonts",
            "description": "Parameter font"
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
            "description": "Parameter text"
          },
          "options": {
            "type": "{ font: Fonts; colors: Color[] }",
            "description": "Parameter options"
          }
        },
        "required": [
          "text",
          "options"
        ],
        "returns": "void"
      },
      "applyGradient": {
        "description": "Applies color gradients to text with configurable direction. This method creates smooth color transitions across text content, supporting both horizontal (character-by-character) and vertical (line-by-line) gradients. Perfect for creating visually appealing terminal output and ASCII art effects. **Gradient Types:** - Horizontal: Colors transition across characters in each line - Vertical: Colors transition across lines of text - Customizable color sequences and transitions - Automatic color cycling for long content",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          },
          "lineColors": {
            "type": "Color[]",
            "description": "Parameter lineColors"
          },
          "direction": {
            "type": "\"horizontal\" | \"vertical\"",
            "description": "Parameter direction"
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
            "description": "Parameter text"
          },
          "lineColors": {
            "type": "Color[]",
            "description": "Parameter lineColors"
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
            "description": "Parameter text"
          },
          "lineColors": {
            "type": "Color[]",
            "description": "Parameter lineColors"
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
            "description": "Parameter str"
          },
          "length": {
            "type": "number",
            "description": "Parameter length"
          },
          "padChar": {
            "type": "any",
            "description": "Parameter padChar"
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
            "description": "Parameter str"
          },
          "length": {
            "type": "number",
            "description": "Parameter length"
          },
          "padChar": {
            "type": "any",
            "description": "Parameter padChar"
          }
        },
        "required": [
          "str",
          "length"
        ],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
  },
  {
    "id": "features.repl",
    "description": "Repl Feature - Interactive Node.js REPL (Read-Eval-Print Loop) server This feature provides a fully-featured REPL server with support for: - Custom evaluation context with container access - Persistent command history - Promise-aware evaluation (async/await support) - Customizable prompts and settings - Integration with the container's context and features The REPL runs in a sandboxed VM context but provides access to the container and all its features, making it perfect for interactive debugging and exploration. **Key Features:** - VM-based evaluation for security - Automatic promise resolution in REPL output - Persistent history across sessions - Full container context access - Colored terminal output support **Usage Example:** ```typescript const repl = container.feature('repl'); await repl.start({ historyPath: '.repl_history', context: { customVar: 'value' } }); // REPL is now running and accessible ```",
    "shortcut": "features.repl",
    "methods": {
      "createServer": {
        "description": "Creates and configures a new REPL server instance. This method sets up the REPL with custom evaluation logic that: - Runs code in a VM context for isolation - Automatically handles Promise resolution - Provides colored terminal output - Uses the configured prompt The REPL evaluation supports both synchronous and asynchronous code execution, automatically detecting and awaiting Promises in the result.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "start": {
        "description": "Starts the REPL server with the specified configuration. This method initializes the REPL server, sets up command history persistence, and configures the evaluation context. The context includes: - All container features and properties - Custom context variables passed in options - Helper functions like `client()` for creating clients **History Management:** - Creates history file directory if it doesn't exist - Uses provided historyPath or defaults to node_modules/.cache/.repl_history - Persists command history across sessions **Context Setup:** - Inherits full container context - Adds custom context variables - Provides convenience methods for container interaction",
        "parameters": {
          "options": {
            "type": "{ historyPath?: string, context?: any, exclude?: string | string[] }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
  },
  {
    "id": "features.scriptRunner",
    "description": "The ScriptRunner feature provides convenient access to npm scripts defined in package.json. This feature automatically generates camelCase methods for each script in the package.json file, allowing you to execute them programmatically with additional arguments and options.",
    "shortcut": "features.scriptRunner",
    "methods": {},
    "events": {},
    "state": {}
  },
  {
    "id": "features.os",
    "description": "The OS feature provides access to operating system utilities and information. This feature wraps Node.js's built-in `os` module and provides convenient getters for system information like architecture, platform, directories, network interfaces, and hardware details.",
    "shortcut": "features.os",
    "methods": {},
    "events": {},
    "state": {}
  },
  {
    "id": "features.yaml",
    "description": "The YAML feature provides utilities for parsing and stringifying YAML data. This feature wraps the js-yaml library to provide convenient methods for converting between YAML strings and JavaScript objects. It's automatically attached to Node containers for easy access.",
    "shortcut": "features.yaml",
    "methods": {
      "attach": {
        "description": "Automatically attaches the YAML feature to Node containers. This static method ensures the YAML feature is automatically available on Node containers without needing manual registration.",
        "parameters": {
          "c": {
            "type": "NodeContainer",
            "description": "The Node container to attach to"
          }
        },
        "required": [
          "c"
        ],
        "returns": "void"
      },
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
    "events": {},
    "state": {}
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
            "description": "Parameter startAt"
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
            "description": "Parameter checkPort"
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
  },
  {
    "id": "features.vault",
    "description": "The Vault feature provides encryption and decryption capabilities using AES-256-GCM. This feature allows you to securely encrypt and decrypt sensitive data using industry-standard encryption. It manages secret keys and provides a simple interface for cryptographic operations.",
    "shortcut": "features.vault",
    "methods": {
      "attach": {
        "description": "",
        "parameters": {
          "c": {
            "type": "NodeContainer",
            "description": "Parameter c"
          }
        },
        "required": [
          "c"
        ],
        "returns": "void"
      },
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
    "events": {},
    "state": {}
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
            "description": "Options to configure the walk behavior"
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
            "description": "Options to configure the walk behavior"
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
            "description": "Parameter overwrite"
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
            "description": "Parameter overwrite"
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
            "description": "Parameter options"
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
            "description": "Parameter options"
          }
        },
        "required": [
          "fileName"
        ],
        "returns": "Promise<string | string[] | null>"
      }
    },
    "events": {},
    "state": {}
  },
  {
    "id": "features.ipcSocket",
    "description": "IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Dual-mode operation: server and client functionality - JSON message serialization/deserialization - Multiple client connection support (server mode) - Event-driven message handling - Automatic socket cleanup and management - Broadcast messaging to all connected clients - Lock file management for socket paths **Communication Pattern:** - Messages are automatically JSON-encoded with unique IDs - Both server and client emit 'message' events for incoming data - Server can broadcast to all connected clients - Client maintains single connection to server **Socket Management:** - Automatic cleanup of stale socket files - Connection tracking and management - Graceful shutdown procedures - Lock file protection against conflicts **Usage Examples:** **Server Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/myapp.sock', true); // removeLock=true ipc.on('connection', (socket) => { console.log('Client connected'); }); ipc.on('message', (data) => { console.log('Received:', data); ipc.broadcast({ reply: 'ACK', original: data }); }); ``` **Client Mode:** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/myapp.sock'); ipc.on('message', (data) => { console.log('Server says:', data); }); await ipc.send({ type: 'request', payload: 'hello' }); ```",
    "shortcut": "features.ipcSocket",
    "methods": {
      "attach": {
        "description": "Attaches the IpcSocket feature to a NodeContainer instance. Registers the feature and creates an auto-enabled instance.",
        "parameters": {
          "container": {
            "type": "NodeContainer & { ipcSocket?: IpcSocket }",
            "description": "Parameter container"
          }
        },
        "required": [
          "container"
        ],
        "returns": "void"
      },
      "listen": {
        "description": "Starts the IPC server listening on the specified socket path. This method sets up a Unix domain socket server that can accept multiple client connections. Each connected client is tracked, and the server automatically handles connection lifecycle events. Messages received from clients are JSON-parsed and emitted as 'message' events. **Server Behavior:** - Tracks all connected clients in the sockets Set - Automatically removes clients when they disconnect - JSON-parses incoming messages and emits 'message' events - Emits 'connection' events when clients connect - Prevents starting multiple servers on the same instance **Socket File Management:** - Resolves the socket path relative to the container's working directory - Optionally removes existing socket files to prevent \"address in use\" errors - Throws error if socket file exists and removeLock is false",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "Parameter socketPath"
          },
          "removeLock": {
            "type": "any",
            "description": "Parameter removeLock"
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
            "description": "Parameter message"
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
            "description": "Parameter message"
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
            "description": "Parameter socketPath"
          }
        },
        "required": [
          "socketPath"
        ],
        "returns": "Promise<Socket>"
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
    "state": {}
  },
  {
    "id": "features.diskCache",
    "description": "DiskCache helper",
    "shortcut": "features.diskCache",
    "methods": {
      "attach": {
        "description": "",
        "parameters": {
          "c": {
            "type": "NodeContainer",
            "description": "Parameter c"
          }
        },
        "required": [
          "c"
        ],
        "returns": "void"
      },
      "saveFile": {
        "description": "Retrieve a file from the disk cache and save it to the local disk",
        "parameters": {
          "key": {
            "type": "string",
            "description": "Parameter key"
          },
          "outputPath": {
            "type": "string",
            "description": "Parameter outputPath"
          },
          "isBase64": {
            "type": "any",
            "description": "Parameter isBase64"
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
            "description": "Parameter key"
          },
          "content": {
            "type": "string",
            "description": "Parameter content"
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
            "description": "Parameter source"
          },
          "destination": {
            "type": "string",
            "description": "Parameter destination"
          },
          "overwrite": {
            "type": "boolean",
            "description": "Parameter overwrite"
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
            "description": "Parameter source"
          },
          "destination": {
            "type": "string",
            "description": "Parameter destination"
          },
          "overwrite": {
            "type": "boolean",
            "description": "Parameter overwrite"
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
            "description": "Parameter key"
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
            "description": "Parameter key"
          },
          "json": {
            "type": "any",
            "description": "Parameter json"
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
            "description": "Parameter key"
          },
          "value": {
            "type": "any",
            "description": "Parameter value"
          },
          "meta": {
            "type": "any",
            "description": "Parameter meta"
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
            "description": "Parameter key"
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
            "description": "Parameter confirm"
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
            "description": "Parameter path"
          }
        },
        "required": [],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
  },
  {
    "id": "features.jsonTree",
    "description": "JsonTree Feature - A powerful JSON file tree loader and processor This feature provides functionality to recursively load JSON files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive JSON file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Native JSON parsing for optimal performance **Path Processing:** Files are processed to create a nested object structure: - Directory names become object properties (camelCased) - File names become the final property names (without .json extension) - Nested directories create nested objects **Usage Example:** ```typescript const jsonTree = container.feature('jsonTree', { enable: true }); await jsonTree.loadTree('data', 'appData'); const userData = jsonTree.tree.appData.users.profiles; ``` **Directory Structure Example:** ``` data/ users/ profiles.json    -> tree.data.users.profiles settings.json    -> tree.data.users.settings config/ app-config.json  -> tree.data.config.appConfig ```",
    "shortcut": "features.jsonTree",
    "methods": {
      "attach": {
        "description": "Attaches the JsonTree feature to a NodeContainer instance. Registers the feature in the container's feature registry for later use.",
        "parameters": {
          "container": {
            "type": "NodeContainer & { jsonTree?: JsonTree }",
            "description": "Parameter container"
          }
        },
        "required": [
          "container"
        ],
        "returns": "void"
      },
      "loadTree": {
        "description": "Loads a tree of JSON files from the specified base path and stores them in state. This method recursively scans the provided directory for JSON files, processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Processing Steps:** 1. Uses FileManager to discover all .json files recursively 2. Reads each file's content using the file system feature 3. Parses JSON content using native JSON.parse() 4. Converts file paths to nested object properties 5. Stores the complete tree in feature state **Path Transformation:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes .json file extension **Example Transformation:** ``` config/ database/ production.json  -> tree.config.database.production staging.json     -> tree.config.database.staging api/ endpoints.json   -> tree.config.api.endpoints ```",
        "parameters": {
          "basePath": {
            "type": "string",
            "description": "Parameter basePath"
          },
          "key": {
            "type": "string",
            "description": "Parameter key"
          }
        },
        "required": [
          "basePath"
        ],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
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
            "description": "Parameter manifest"
          },
          "path": {
            "type": "string",
            "description": "Parameter path"
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
            "description": "Parameter options"
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
            "description": "Parameter name"
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
            "description": "Parameter packageName"
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
            "description": "Parameter filter"
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
            "description": "Parameter filter"
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
            "description": "Parameter filter"
          }
        },
        "required": [
          "filter"
        ],
        "returns": "void"
      }
    },
    "events": {},
    "state": {}
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
            "description": "Parameter options"
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
            "description": "Parameter options"
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
            "description": "Parameter options"
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
            "description": "Parameter options"
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
    "events": {
      "file:change": {
        "name": "file:change",
        "description": "Event emitted by FileManager",
        "arguments": {}
      }
    },
    "state": {}
  },
  {
    "id": "clients.openai",
    "description": "OpenAIClient helper",
    "shortcut": "clients.openai",
    "methods": {
      "attach": {
        "description": "",
        "parameters": {
          "container": {
            "type": "Container & ClientsInterface",
            "description": "Parameter container"
          }
        },
        "required": [
          "container"
        ],
        "returns": "any"
      },
      "connect": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "createChatCompletion": {
        "description": "",
        "parameters": {
          "messages": {
            "type": "OpenAI.Chat.Completions.ChatCompletionMessageParam[]",
            "description": "Parameter messages"
          },
          "options": {
            "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
            "description": "Parameter options"
          }
        },
        "required": [
          "messages"
        ],
        "returns": "Promise<OpenAI.Chat.Completions.ChatCompletion>"
      },
      "createCompletion": {
        "description": "",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "Parameter prompt"
          },
          "options": {
            "type": "Partial<OpenAI.Completions.CompletionCreateParams>",
            "description": "Parameter options"
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<OpenAI.Completions.Completion>"
      },
      "createEmbedding": {
        "description": "",
        "parameters": {
          "input": {
            "type": "string | string[]",
            "description": "Parameter input"
          },
          "options": {
            "type": "Partial<OpenAI.Embeddings.EmbeddingCreateParams>",
            "description": "Parameter options"
          }
        },
        "required": [
          "input"
        ],
        "returns": "Promise<OpenAI.Embeddings.CreateEmbeddingResponse>"
      },
      "createImage": {
        "description": "",
        "parameters": {
          "prompt": {
            "type": "string",
            "description": "Parameter prompt"
          },
          "options": {
            "type": "Partial<OpenAI.Images.ImageGenerateParams>",
            "description": "Parameter options"
          }
        },
        "required": [
          "prompt"
        ],
        "returns": "Promise<OpenAI.Images.ImagesResponse>"
      },
      "listModels": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<OpenAI.Models.ModelsPage>"
      },
      "ask": {
        "description": "",
        "parameters": {
          "question": {
            "type": "string",
            "description": "Parameter question"
          },
          "options": {
            "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
            "description": "Parameter options"
          }
        },
        "required": [
          "question"
        ],
        "returns": "Promise<string>"
      },
      "chat": {
        "description": "",
        "parameters": {
          "messages": {
            "type": "OpenAI.Chat.Completions.ChatCompletionMessageParam[]",
            "description": "Parameter messages"
          },
          "options": {
            "type": "Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>",
            "description": "Parameter options"
          }
        },
        "required": [
          "messages"
        ],
        "returns": "Promise<string>"
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
    "state": {}
  },
  {
    "id": "servers.express",
    "description": "ExpressServer helper",
    "shortcut": "servers.express",
    "methods": {
      "attach": {
        "description": "",
        "parameters": {
          "container": {
            "type": "NodeContainer & ServersInterface",
            "description": "Parameter container"
          }
        },
        "required": [
          "container"
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
      },
      "configure": {
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
    "id": "servers.websocket",
    "description": "WebsocketServer helper",
    "shortcut": "servers.websocket",
    "methods": {
      "attach": {
        "description": "",
        "parameters": {
          "container": {
            "type": "NodeContainer & ServersInterface",
            "description": "Parameter container"
          }
        },
        "required": [
          "container"
        ],
        "returns": "void"
      },
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
    "state": {}
  }
];
