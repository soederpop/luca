export { Command, commands, CommandsRegistry, type AvailableCommands, type CommandsInterface, type CommandHandler, type CommandState, type CommandOptions } from '../command.js'

// Side-effect imports register each command
import './run.js'
import './chat.js'
import './console.js'
import './serve.js'
