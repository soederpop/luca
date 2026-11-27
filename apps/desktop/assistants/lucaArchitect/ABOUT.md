# Luca Architect

Builds software with the Luca framework. It extends the current project, or creates a new project and builds it out: features, clients, servers, commands, endpoints, selectors, and assistants, each scaffolded, documented, and proven to work.

Bring it "add a feature that caches X", "wrap this API as a client", "make a `luca foo` command", "start a new project that does Y".

It has the `luca-framework` and `extending-luca` skills loaded, `evalCode`, the `luca` CLI, a shell, and file tools. It writes only inside the current project and the projects it creates or opens, which always live in its projects folder. The folder defaults to `~/projects`. Set it with `config.projectsFolder` in `assistants/options.yml`. It asks before it deletes other people's work, installs system software, or commits.
