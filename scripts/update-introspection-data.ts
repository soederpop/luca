/** 
 * The purpose of this script is to generate metadata about the vrious components of LUCA
 * and save them to a file that can be loaded at runtime to make this information available to the AGI
*/
import '../src/introspection/scan.js';
import { NodeContainer } from '../src/node/container.js';

async function main() {
  console.log('🔍 Testing Introspection Scanner Feature...\n');

  // Create a container
  const container = new NodeContainer();

  try {
    // Create the introspection scanner feature
    const scanner = container.feature('introspectionScanner', {
      src: ['src/node/features', 'src/agi/features', 'src/servers', 'src/web/features'],
      outputPath: 'src/introspection/generated.ts',
      enable: true
    });

    console.log('📊 Scanner created successfully!');
    console.log('📁 Scanning directories:', scanner.options.src);
    console.log('📄 Output path:', scanner.options.outputPath);
    console.log('');

    // Listen for scan events
    scanner.on('scanStarted', (data) => {
      console.log('🚀 Scan started for:', data.directories);
    });

    scanner.on('scanCompleted', (data) => {
      console.log(`✅ Scan completed!`);
      console.log(`   📊 Found ${data.results} helpers in ${data.files} files`);
      console.log(`   ⏱️  Duration: ${data.duration}ms`);
    });

    scanner.on('scriptGenerated', (data) => {
      console.log(`📝 Generated registry script at: ${data.path}`);
    });

    scanner.on('scanFailed', (error) => {
      console.error('❌ Scan failed:', error);
    });

    // Perform the scan
    console.log('🔍 Starting scan...\n');
    const results = await scanner.scan();

    console.log('\n📋 Scan Results:');
    console.log('==================');
    
    if (results.length === 0) {
      console.log('No helpers found.');
    } else {
      results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.shortcut} (${result.id})`);
        console.log(`   Description: ${result.description}`);
        console.log(`   Methods: ${Object.keys(result.methods).length}`);
        console.log(`   Events: ${Object.keys(result.events).length}`);
        console.log(`   State props: ${Object.keys(result.state).length}`);
        
        if (Object.keys(result.methods).length > 0) {
          console.log('   Method names:', Object.keys(result.methods).join(', '));
        }
        
        if (Object.keys(result.events).length > 0) {
          console.log('   Event names:', Object.keys(result.events).join(', '));
        }
      });
    }

    // Generate the registry script
    console.log('\n📝 Generating registry script...');
    const script = await scanner.generateRegistryScript();
    
    console.log(`\n📄 Generated script (${script.length} characters)`);
    console.log('Script preview (first 500 chars):');
    console.log('─'.repeat(50));
    console.log(script.substring(0, 500) + '...');
    console.log('─'.repeat(50));

    console.log('\n✨ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error during demo:', error);
    process.exit(1);
  }
}

main().catch(console.error); 