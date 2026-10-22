# Read logs

One file per task, named `<task>.md` (for example `a0-bootstrap.md`). It lists everything the task
read from outside this repository, so anyone can confirm the work came only from allowed sources.
The rules are in [AGENTS.md](../../../AGENTS.md#clean-room-rules-mandatory).

Template:

```md
# <task>: read log

Task: <one line>
Builder: <who or which agent session>
Date: <YYYY-MM-DD>

## Files

- `<absolute path>` - <why>

## URLs

- <url> - <why>

## Forbidden sources opened

None.
```
