# opencode-session-logger

Local `opencode` plugin that writes one JSON file per session containing a normalized conversation log.

## Install

Clone this repo into your project plugin directory so OpenCode loads it automatically:

```sh
git clone <repo-url> .opencode/plugins/opencode-session-logger
```

Install the development dependencies for the plugin:

```sh
cd .opencode/plugins/opencode-session-logger
npm install
```

Validate that `index.ts` type-checks:

```sh
npm run typecheck
```

## What it logs

- user messages
- assistant messages
- tool calls
- tool results

It does not log reasoning parts, summaries, patch metadata, provider wire traffic, or the assembled system prompt.

## Output

By default it writes files to:

```text
.opencode/session-logs/<sessionID>.json
```

Each file contains normalized messages like:

```json
{
  "sessionID": "...",
  "updatedAt": "...",
  "messages": [
    {
      "id": "...",
      "role": "user",
      "content": "...",
      "toolCalls": []
    }
  ]
}
```

## Configure in opencode

No `opencode.json` entry is required for a local plugin in `.opencode/plugins/`.

If you want to change the output directory, edit the plugin source or publish the plugin as an npm package and configure it through `opencode.json`.

## Options

- `outputDir`: relative to the session directory unless absolute
