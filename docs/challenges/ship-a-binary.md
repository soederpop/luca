---
difficulty: hard
maxTime: 25
---
# Ship a Consumer Binary

Take a product from nothing to a standalone compiled binary, using only the luca CLI and the features available in luca.

1. Bootstrap a **brand-new luca project** in a subfolder named `fortune-teller`. (Your current workspace is itself a luca project — the new one must be its own separate project, and all following steps happen inside it.)
2. Build a custom container feature named `fortunes`:
   - `random()` returns a random fortune from a built-in list of at least five
   - `history()` returns every fortune handed out so far, and the history must survive between separate process invocations
3. Add a project command so `luca tell` prints a fortune — through the feature, not its own copy of the logic.
4. Create an assistant named `oracle` whose tools let it tell a fortune and recount the history. The tools must call the `fortunes` feature — don't reimplement fortune logic inside the tools file.
5. Bundle the project into a standalone binary named `fortune`. Then verify **from the produced binary itself**:
   - `tell` prints a fortune
   - it can execute a script that calls `container.feature('fortunes')`
   - the `oracle` assistant is registered inside the binary (actually chatting with it is a bonus, not a requirement)

## After you are done

Write a LESSONS.md in the project root that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
