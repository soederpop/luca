export { Command, commands, CommandsRegistry, type AvailableCommands, type CommandsInterface, type CommandHandler, type CommandState, type CommandOptions } from '../command.js'

// Side-effect imports register each command
import './run.js'
import './console.js'
import './serve.js'
import './chat.js'
import './prompt.js'
import './mcp.js'
import './sandbox-mcp.js'
import './describe.js'
import './eval.js'
import './help.js'
