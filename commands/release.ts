import { z } from "zod";
import type { ContainerContext } from "luca";
import { CommandOptionsSchema } from "luca/schemas";
import { publishRelease } from '../scripts/lib/local-release';

export const positionals = ['tag'];

export const argsSchema = CommandOptionsSchema.extend({
  tag: z.string().optional().describe('Release tag to wait for and publish locally to npm and GitHub'),
  dryRun: z.boolean().default(false).describe('Validate and pack an existing tag without publishing'),
  waitTimeout: z.number().nonnegative().default(1800).describe('Seconds to wait for the tag, workflow, and release assets (0 checks once)'),
  pollInterval: z.number().positive().default(15).describe('Seconds between release readiness checks'),
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
  if (options.tag) return publishRelease(container, options.tag, options.dryRun, options);
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
    return publishRelease(container, tag, false, options);
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
  await publishRelease(container, tag, false, options);
}

export default {
  description: "Create or resume a release, wait for its binaries, and publish locally to npm and GitHub",
  positionals,
  argsSchema,
  handler: release,
};
