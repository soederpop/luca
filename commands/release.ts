import { z } from "zod";
import type { ContainerContext } from "@soederpop/luca";
import { CommandOptionsSchema } from "@soederpop/luca/schemas";

export const argsSchema = CommandOptionsSchema.extend({
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
  const proc = container.feature("proc");
  const fileSystem = container.feature("fs");
  const ui = container.feature("ui");

  const pkg = JSON.parse(await fileSystem.readFileAsync("package.json"));
  const version = pkg.version;
  const tag = `v${version}`;

  ui.banner(`Luca Release ${tag}`);

  // Check if tag already exists
  const tagCheck = await proc.execAndCapture(`git tag -l "${tag}"`, {
    silent: true,
  });
  if (tagCheck.stdout.trim() === tag) {
    console.error(
      `\nTag ${tag} already exists. Bump the version in package.json first.`,
    );
    return;
  }

  // Run tests
  if (!options.skipTests) {
    console.log("\n→ Running tests...");
    const testResult = await proc.execAndCapture("bun test test/*.test.ts", {
      silent: false,
    });
    if (testResult.exitCode !== 0) {
      console.error("Tests failed. Fix them before releasing.");
      return;
    }
  }

  // Create and push git tag — triggers the GitHub Actions release workflow
  console.log(`\n→ Creating tag ${tag}...`);
  const tagResult = await proc.execAndCapture(
    `git tag -a "${tag}" -m "Release ${tag}"`,
    { silent: true },
  );
  if (tagResult.exitCode !== 0) {
    console.error(`Failed to create tag:\n${tagResult.stderr}`);
    return;
  }

  console.log(`→ Pushing tag ${tag}...`);
  const pushResult = await proc.execAndCapture(`git push origin "${tag}"`, {
    silent: true,
  });
  if (pushResult.exitCode !== 0) {
    console.error(`Failed to push tag:\n${pushResult.stderr}`);
    return;
  }

  console.log(
    `\n✓ Tag ${tag} pushed. GitHub Actions will build, sign, and create the draft release.`,
  );
  console.log(`  https://github.com/soederpop/luca/actions`);
}

export default {
  description: "Run tests and trigger a GitHub Actions release via git tag",
  argsSchema,
  handler: release,
};
