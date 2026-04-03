import { z } from "zod";
import type { ContainerContext } from "@soederpop/luca";
import { CommandOptionsSchema } from "@soederpop/luca/schemas";

export const argsSchema = CommandOptionsSchema.extend({
  skipBuild: z
    .boolean()
    .optional()
    .describe("Skip pre-build steps (introspection, scaffolds, bootstrap)"),
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

  // 0. Check if tag already exists
  const tagCheck = await proc.execAndCapture(`git tag -l "${tag}"`, {
    silent: true,
  });
  if (tagCheck.stdout.trim() === tag) {
    console.error(
      `\nTag ${tag} already exists. Bump the version in package.json first.`,
    );
    return;
  }

  // 1. Run tests
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

  // 2. Pre-build steps
  if (!options.skipBuild) {
    console.log("\n→ Running pre-build steps...");
    const steps = [
      ["build:introspection", "bun run build:introspection"],
      ["build:scaffolds", "bun run build:scaffolds"],
      ["build:bootstrap", "bun run build:bootstrap"],
    ];
    for (const [label, cmd] of steps) {
      console.log(`  ${label}...`);
      const r = await proc.execAndCapture(cmd, { silent: true });
      if (r.exitCode !== 0) {
        console.error(`${label} failed:\n${r.stderr}`);
        return;
      }
    }
  }

  // 3. Check for clean working tree (allow untracked)
  const statusCheck = await proc.execAndCapture("git status --porcelain", {
    silent: true,
  });
  const dirtyFiles = statusCheck.stdout
    .trim()
    .split("\n")
    .filter((l: string) => l && !l.startsWith("??"));
  if (dirtyFiles.length > 0) {
    console.error(
      "\nWorking tree has uncommitted changes. Commit or stash them first.",
    );
    console.error(dirtyFiles.join("\n"));
    return;
  }

  // 4. Create and push git tag — this triggers the GitHub Actions release workflow
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
  description:
    "Run pre-build steps and trigger a GitHub Actions release via git tag",
  argsSchema,
  handler: release,
};
