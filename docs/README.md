# Models

## Overview



## Summary

```
Collection: /Users/jonathansoeder/@soederpop/projects/luca/docs
Root: /Users/jonathansoeder/@soederpop/projects/luca/docs
Items: 208

  Model: Challenge
    Description: challenges are used by our evaluation suite to measure the quality of the introspection content and tool, as well as the SKILL.md that gets generated to help coding assistants work with the luca framework
    Path prefix: docs/challenges/*.md
    Meta: difficulty(enum(`easy`, `medium`, `hard`)), maxTime(number)
    Sections: (none)
    Relationships: (none)

  Model: Example
    Description: Runnable composition patterns that combine multiple luca helpers (single-feature usage lives in JSDoc @example blocks, surfaced by `luca describe`)
    Path prefix: docs/examples/*.md
    Meta: tags(string[]), lastTested(string | null), lastTestPassed(boolean | null)
    Sections: (none)
    Relationships: (none)

  Model: Report
    Description: Used for e.g. documentation audits, usability audits for agents, or anything else long form project related
    Path prefix: docs/reports/*.md
    Meta: tags(string[])
    Sections: (none)
    Relationships: (none)

  Model: Tutorial
    Description: Tutorials on how to compose things together to do neat things
    Path prefix: docs/tutorials/*.md
    Meta: tags(string[])
    Sections: (none)
    Relationships: (none)

  Model: Base
    Description: A Base document.
    Path prefix: docs/*.md
    Meta: (none)
    Sections: (none)
    Relationships: (none)
```
