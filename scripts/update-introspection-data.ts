/**
 * Generates per-container introspection metadata files.
 *
 * Each container type gets its own generated file containing only the
 * metadata relevant to that environment:
 *
 * - generated.node.ts: node features + servers
 * - generated.web.ts: web features
 * - generated.agi.ts: node features + servers + agi features
 */
import '../src/introspection/scan.js';
import { NodeContainer } from '../src/node/container.js';

const targets = [
  {
    name: 'node',
    src: ['src/node/features', 'src/servers', 'src/container.ts', 'src/node/container.ts'],
    outputPath: 'src/introspection/generated.node.ts',
  },
  {
    name: 'web',
    src: ['src/web/features', 'src/container.ts', 'src/web/container.ts'],
    outputPath: 'src/introspection/generated.web.ts',
  },
  {
    name: 'agi',
    src: ['src/node/features', 'src/servers', 'src/agi/features', 'src/container.ts', 'src/node/container.ts', 'src/agi/container.server.ts'],
    outputPath: 'src/introspection/generated.agi.ts',
  },
];

async function main() {
  const container = new NodeContainer();

  for (const target of targets) {
    console.log(`\n📦 Generating ${target.name} introspection data...`);
    console.log(`   📁 Sources: ${target.src.join(', ')}`);
    console.log(`   📄 Output: ${target.outputPath}`);

    const scanner = container.feature('introspectionScanner', {
      src: target.src,
      outputPath: target.outputPath,
    });

    scanner.on('scanCompleted', (data) => {
      console.log(`   ✅ Found ${data.results} helpers in ${data.files} files (${data.duration}ms)`);
    });

    await scanner.scan();
    await scanner.generateRegistryScript();

    console.log(`   📝 Wrote ${target.outputPath}`);
  }

  console.log('\n✨ All introspection data generated.');
}

main().catch(console.error);
