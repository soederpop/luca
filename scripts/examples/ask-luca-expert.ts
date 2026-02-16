import container from '@/agi'
import * as readline from 'readline'

const { ui } = container

const assistant = container.feature('assistant', {
  folder: 'assistants/luca-expert',
  model: 'gpt-5.2',
})

assistant.on('preview', (text: string) => {
  process.stdout.write('\x1B[2J\x1B[H')
  console.log(ui.markdown(text))
})

assistant.on('toolCall', (name: string, args: any) => {
  process.stdout.write(ui.colors.dim(`\n  ⟳ ${name}(${JSON.stringify(args).slice(0, 80)})\n`))
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function prompt(): Promise<string> {
  return new Promise((resolve) => {
    rl.question(ui.colors.dim('\nluca-expert > '), (answer) => resolve(answer.trim()))
  })
}

console.log(ui.colors.dim('Ask the Luca expert anything. Type .exit to quit.\n'))

while (true) {
  const question = await prompt()

  if (!question) continue
  if (question === '.exit') break

  await assistant.ask(question)
}

rl.close()
