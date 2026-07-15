// Build metadata for `luca --version`.
//
// When compiling the binary, real values are baked in via `bun build --define`
// (see scripts/compile-binary.sh). When running from source (lucadev), the
// defines are absent and these fall back to dev placeholders.
export const BUILD_SHA: string = process.env.LUCA_BUILD_SHA ?? 'dev'
export const BUILD_BRANCH: string = process.env.LUCA_BUILD_BRANCH ?? 'dev'
export const BUILD_DATE: string = process.env.LUCA_BUILD_DATE ?? 'unstamped'
