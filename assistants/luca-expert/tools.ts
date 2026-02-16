const fs = require('fs')
const path = require('path')
const { z } = require('zod')

/**
 * Walk up from the assistant's folder to find the Luca package root.
 * Looks for a package.json with name "@soederpop/luca".
 */
function findLucaRoot() {
  let dir = me.resolvedFolder
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        if (pkg.name === '@soederpop/luca') return dir
      } catch {}
    }
    dir = path.dirname(dir)
  }
  return null
}

/**
 * Ask Claude Code a question about the Luca framework source code.
 * Spawns a read-only Claude Code session rooted at the Luca package directory.
 */
async function askAboutLucaSource({ question }) {
  const lucaRoot = findLucaRoot()

  if (!lucaRoot) {
    return { error: 'Could not locate the Luca source code directory.' }
  }

  const cc = container.feature('claudeCode')

  const session = await cc.run(question, {
    cwd: lucaRoot,
    allowedTools: ['Read', 'Glob', 'Grep'],
    systemPrompt:
      'You are a code research assistant. Answer questions about this TypeScript codebase by reading files and searching code. ' +
      'Be concise and precise. Include relevant file paths and code snippets in your answer. ' +
      'This is the Luca framework source — a container-based runtime for building applications with features, clients, servers, and helpers.',
  })

  if (session.status === 'error') {
    return { error: session.error }
  }

  return session.result
}

module.exports = {
  askAboutLucaSource,
  schemas: {
    askAboutLucaSource: z
      .object({
        question: z
          .string()
          .describe(
            'A specific question about the Luca framework source code, its internal implementation, architecture, or how a particular feature/class/method works under the hood'
          ),
      })
      .describe(
        'Ask Claude Code to research the Luca framework source code and answer a question about its internal implementation. Use this when a user asks about how Luca works internally, not just how to use it.'
      ),
  },
}
