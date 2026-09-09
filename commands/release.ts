import { z } from "zod";
import type { ContainerContext } from "luca";
import { CommandOptionsSchema } from "luca/schemas";
import { publishRelease } from '../scripts/lib/local-release';

export const positionals = ['tag'];

export const argsSchema = CommandOptionsSchema.extend({
  tag: z.string().optional().describe('Existing successful release tag to publish locally to npm and GitHub'),
  dryRun: z.boolean().default(false).describe('Validate and pack an existing tag without publishing'),
  skipTests: z
    .boolean()
    .optional()
    .describe("Skip running tests before release"),
});

async function release(
  options: z.infer<typeof argsSchema>,
  context: ContainerContext,
) {
  const container = context.container as any;
  if (options.tag) return publishRelease(container, options.tag, options.dryRun);
  if (options.dryRun) throw new Error('Pass an existing tag with --dry-run');
  const proc = container.feature("proc");
  const fileSystem = container.feature("fs");
  const ui = container.feature("ui");

  const pkg = JSON.parse(await fileSystem.readFileAsync("package.json"));
  const version = pkg.version;
  const tag = `v${version}`;

  ui.banner(`Luca Release ${tag}`);

  // Check if tag already exists
  const tagCheck = await proc.spawnAndCapture('git', ['tag', '-l', tag], {
    silent: true,
  });
  if (tagCheck.stdout.trim() === tag) {
    console.error(
      `\nTag ${tag} already exists. Bump the version in package.json first.`,
    );
    throw new Error(`Tag exists. Use luca release ${tag} to publish it.`);
  }

  // Run tests
  if (!options.skipTests) {
    console.log("\n→ Running tests...");
    const testResult = await proc.spawnAndCapture('bun', ['run', 'test'], {
      silent: false,
    });
    if (testResult.exitCode !== 0) {
      console.error("Tests failed. Fix them before releasing.");
      throw new Error('Tests failed');
    }
  }

  // Create and push git tag — triggers the GitHub Actions release workflow
  console.log(`\n→ Creating tag ${tag}...`);
  const tagResult = await proc.spawnAndCapture(
    'git', ['tag', '-a', tag, '-m', `Release ${tag}`],
    { silent: true },
  );
  if (tagResult.exitCode !== 0) {
    console.error(`Failed to create tag:\n${tagResult.stderr}`);
    throw new Error('Failed to create tag');
  }

  console.log(`→ Pushing tag ${tag}...`);
  const pushResult = await proc.spawnAndCapture('git', ['push', 'origin', tag], {
    silent: true,
  });
  if (pushResult.exitCode !== 0) {
    console.error(`Failed to push tag:\n${pushResult.stderr}`);
    throw new Error('Failed to push tag');
  }

  console.log(
    `\n✓ Tag ${tag} pushed. GitHub Actions will build, sign, and create the draft release.`,
  );
  console.log(`  https://github.com/soederpop/luca/actions`);
}

export default {
  description: "Create a release tag, or publish an existing successful tag locally to npm and GitHub",
  positionals,
  argsSchema,
  handler: release,
};
