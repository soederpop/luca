# Luca Portfolio

A small Luca project that Luca Desktop installs at `~/.luca/portfolio`. It holds `lucaPortfolio`, the assistant of the app's projects tile, and the `portfolio` feature it uses.

- `features/portfolio.ts`: scan, search and copy across the user's Luca projects.
- `assistants/lucaPortfolio/`: the assistant.
- `portfolio.yml`: which folders are scanned. The user's file.

The source is `apps/desktop/portfolio/` in the luca repo (github.com/soederpop/luca). Luca Desktop copies each file here on launch, and replaces a file only when it is still the copy the app put there. A file you changed is left alone.
