# Results, 2026-11-26

Provider `deepseek-v4-local` (deepseek-v4-flash-vision-exp on spark-f941) for every run.
`old` = lucaExpert at 0fe5d45, `new` = at 3270838, `new-fixed` = 3270838 with the
`building-assistants` frontmatter colon quoted so the skill actually loads.
Shell = runShellCommand + runLucaCommand. Cap: 40 tool turns per ask.

| prompt | version | tool calls | shell | evalCode | time | completed |
|---|---|---|---|---|---|---|
| todoScout | old | 57 | 34 | 0 | 9m43s | no: hit the 40-turn cap, no answer, left a stray `features/todoScoutProbe.ts` and a `voice.yml` |
| todoScout | new | 28 | 2 | 20 | 5m44s | yes, verified with `luca eval` in a new process |
| todoScout | new-fixed | 42 | 8 | 25 | 9m02s | yes, verified; also ran `testAssistant` twice |
| untested | old | 11 | 5 | 0 | 1m18s | yes (correct: no tests) |
| untested | new | 3 | 0 | 3 | 0m55s | yes (correct) |
| httpCache | old | 43+ | 15+ | 11+ | >12m, stopped by hand | wrote `features/http-cache.ts`, still verifying when stopped |
| httpCache | new | 41 | 17 | 16 | 9m18s | yes, wrote `features/http-cache.ts` + proof script |

## Reading

- Lookups moved off the shell. Old version: 34 and 5 shell calls on the two
  finished prompts, 0 evalCode. New version: 2 and 0 shell, 20 and 3 evalCode.
- Total calls roughly halved on the first two prompts (57→28, 11→3) and the
  old version failed todoScout outright.
- httpCache is a wash: 41 vs 43+ calls, similar shell count. Both versions used
  the shell for what the prompt says it is for (scaffold, `luca eval` of the new
  feature in a fresh process, `introspect --lint`, tests). The new one also ran
  `luca describe` through the shell a few times.
- The old version also reached for evalCode once it got stuck (11 calls on
  httpCache), so evalCode availability was never the problem; the prompt was.
- new-fixed on todoScout used more calls than new because it followed the
  skill's recipe literally and verified more (testAssistant, discover loops).
  Single run per cell: expect noise of several calls either way.

Raw reports: `results/*.json` (every call with args summary and result size, the
final answer, files created). `old-httpCache.partial.log` is the stopped run.
