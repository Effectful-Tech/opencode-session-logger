import path from "node:path"
import { mkdir, writeFile } from "node:fs/promises"

type PluginInput = {
  directory: string
}

type PluginOptions = {
  outputDir?: string
}

type Event = {
  type: "message.updated" | "message.removed" | "message.part.updated" | "message.part.removed" | string
  properties?: Record<string, unknown>
}

type LoggedToolCall = {
  id: string
  tool: string
  status?: string
  input?: unknown
  output?: unknown
  error?: string
}

type LoggedMessage = {
  id: string
  role: string
  content: string
  toolCalls: Array<LoggedToolCall>
}

type SessionLog = {
  sessionID: string
  cwd: string
  updatedAt: string
  messages: Array<LoggedMessage>
}

const watchedEvents = new Set([
  "message.updated",
  "message.removed",
  "message.part.updated",
  "message.part.removed"
])

export default async function sessionLoggerPlugin(input: PluginInput, options?: PluginOptions) {
  const sessionCwd = path.resolve(input.directory)
  const outputDir = path.resolve(input.directory, options?.outputDir ?? ".opencode/session-logs")
  const writes = new Map<string, Promise<void>>()
  const sessions = new Map<string, SessionLog>()

  return {
    event: async ({ event }: { event: Event }) => {
      if (!watchedEvents.has(event.type)) {
        return
      }

      const sessionID = typeof event.properties?.sessionID === "string" ? event.properties.sessionID : undefined
      if (!sessionID) {
        return
      }

      const previous = writes.get(sessionID) ?? Promise.resolve()
      const next = previous
        .catch(() => undefined)
        .then(async () => {
          const current = sessions.get(sessionID) ?? { sessionID, cwd: sessionCwd, updatedAt: "", messages: [] }
          const next = applyEvent(current, event)
          next.updatedAt = new Date().toISOString()
          sessions.set(sessionID, next)

          await mkdir(outputDir, { recursive: true })
          await writeFile(path.join(outputDir, `${sessionID}.json`), JSON.stringify(next, null, 2) + "\n", "utf8")
        })
        .catch((error) => {
          console.error(`[opencode-session-logger] failed to log ${sessionID}`, error)
        })
        .finally(() => {
          if (writes.get(sessionID) === next) {
            writes.delete(sessionID)
          }
        })
      writes.set(sessionID, next)
    }
  }
}

function applyEvent(session: SessionLog, event: Event): SessionLog {
  if (event.type === "message.updated") {
    const info = isMessageInfo(event.properties?.info) ? event.properties.info : undefined
    if (!info) return session
    const index = session.messages.findIndex((message) => message.id === info.id)
    if (index === -1) {
      return {
        ...session,
        messages: [
          ...session.messages,
          {
            id: info.id,
            role: typeof info.role === "string" ? info.role : "unknown",
            content: "",
            toolCalls: [],
          },
        ],
      }
    }
    return {
      ...session,
      messages: session.messages.map((message, messageIndex) =>
        messageIndex === index
          ? { ...message, role: typeof info.role === "string" ? info.role : message.role }
          : message,
      ),
    }
  }

  if (event.type === "message.removed") {
    const messageID = typeof event.properties?.messageID === "string" ? event.properties.messageID : undefined
    if (!messageID) return session
    return {
      ...session,
      messages: session.messages.filter((message) => message.id !== messageID),
    }
  }

  if (event.type === "message.part.updated") {
    const part = isMessagePart(event.properties?.part) ? event.properties.part : undefined
    if (!part) return session
    const index = session.messages.findIndex((message) => message.id === part.messageID)
    if (index === -1) return session
    return {
      ...session,
      messages: session.messages.map((message, messageIndex) => {
        if (messageIndex !== index) return message

        if (part.type === "text" && typeof part.text === "string") {
          return { ...message, content: part.text }
        }

        if (part.type === "tool" && typeof part.tool === "string") {
          const toolCall = {
            id: part.id,
            tool: part.tool,
            status: isRecord(part.state) && typeof part.state.status === "string" ? part.state.status : undefined,
            input: isRecord(part.state) ? part.state.input : undefined,
            output: isRecord(part.state) ? part.state.output : undefined,
            error: isRecord(part.state) && typeof part.state.error === "string" ? part.state.error : undefined,
          }
          const toolIndex = message.toolCalls.findIndex((item) => item.id === toolCall.id)
          if (toolIndex === -1) {
            return { ...message, toolCalls: [...message.toolCalls, toolCall] }
          }
          return {
            ...message,
            toolCalls: message.toolCalls.map((item, itemIndex) => (itemIndex === toolIndex ? toolCall : item)),
          }
        }

        return message
      }),
    }
  }

  if (event.type === "message.part.removed") {
    const messageID = typeof event.properties?.messageID === "string" ? event.properties.messageID : undefined
    const partID = typeof event.properties?.partID === "string" ? event.properties.partID : undefined
    if (!messageID || !partID) return session
    return {
      ...session,
      messages: session.messages.map((message) =>
        message.id === messageID
          ? { ...message, toolCalls: message.toolCalls.filter((toolCall) => toolCall.id !== partID) }
          : message,
      ),
    }
  }

  return session
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isMessageInfo(value: unknown): value is { id: string; role?: unknown } {
  return isRecord(value) && typeof value.id === "string"
}

function isMessagePart(value: unknown): value is {
  id: string
  messageID: string
  type?: unknown
  text?: unknown
  tool?: unknown
  state?: unknown
} {
  return isRecord(value) && typeof value.id === "string" && typeof value.messageID === "string"
}
