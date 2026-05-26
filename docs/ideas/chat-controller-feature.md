# Chat Controller Feature

The Chat Controller feature uses the tmux feature to spawn several coding assistant features.

The Chat Controller should be able to drive coding assistants who are in interactive mode through to completion, basically automating saying yes, yes, beyond the initial prompt.  Perhaps surfacing questions when actually absolutely required

In one mode, I imagine spawning `luca chat-controller /path/to/prompt.md /path/to/other-prompt.md and they open up in splits. 

I don't know if an external process, outside of tmux, can control an existing tmux workspace say if I had one open in another terminal

maybe if it runs INSIDE of tmux then it could organize the splits such that it is the top sort of toolbar and the rest are split panels.

another form it could run in is focusing the one at a time and keeping the others in the backgroun

## Open Questions

I don't want to run this from inside of tmux? or do I? why not? the main barrier is my resistance to learning the keystrokes again.

