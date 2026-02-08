# ContentBase

ContentBase is a modernization of my ActiveMDX idea that uses typescript and zod and functions instead of classes to define models.

It allows us to turn a organized folder of structured markdown writing into an ORM like ActiveRecord.  We can query it and work with each document in code, even persist them.

We can prompt the LLM with the requirements and relationships and ask it to generate us markdown that conforms.

## Usecases

### Multi-Claude Project Management through a folder of MDX

A `Collection` from contentbase that is a content model of `Projects` which are made up of `Tasks` can provide a queryable database to an `AGIContainer` that can be used to among other things visualize the status of each project and task and provide an interface to help prioritize or check in on them with the agent.

Actually executing a task will be a Claude Code session.
