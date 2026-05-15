# opencode-session-logger

Local `opencode` plugin that writes one JSON file per session containing a normalized conversation log.

## Install

Clone this repo into your project plugin directory so OpenCode loads it automatically:

```sh
git clone <repo-url> .opencode/plugins/opencode-session-logger
```

Add to gitignore

```
# OpenCode
.opencode/session-logs
.opencode/plugins
```

Add to opencode.jsonc

```
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      ".opencode/plugins/opencode-session-logger",
      {
        "outputDir": ".opencode/session-logs"
      }
    ]
  ]
}
```