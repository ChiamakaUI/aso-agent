import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const THREAD_ID = crypto.randomUUID();

type Message = {
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
};

const WELCOME = `Paste an Apple App Store URL to get a full ASO audit.

**Example:**
\`https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580\`

I'll confirm the app, then run a scored audit across 10 dimensions with specific recommendations.`;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (loading) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    const updatedMessages = [
      ...messages.filter((m) => !m.loading),
      { role: "user" as const, content: userMessage },
    ];

    setMessages([
      ...updatedMessages,
      { role: "assistant" as const, content: "", loading: true },
    ]);
    setLoading(true);

    try {
      const response = await fetch("/api/agents/aso-agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          threadId: THREAD_ID,
          resourceId: "user",
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]")
            continue;

          try {
            const json = JSON.parse(trimmed.slice(6));

            if (
              (json.type === "step-finish" || json.type === "finish") &&
              json.payload?.output?.text &&
              json.payload.output.text.length > assistantText.length
            ) {
              assistantText = json.payload.output.text;
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "assistant" as const, content: assistantText },
              ]);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (!assistantText) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant" as const,
            content: "Something went wrong. Please try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant" as const,
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: 860,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0" }}>
          ASO Audit Agent
        </div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
          App Store Optimization powered by Mastra + Claude
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 0" }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 16,
            }}
          >
            {msg.role === "assistant" && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#1a1a2e",
                  border: "1px solid #333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  marginRight: 10,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                ✦
              </div>
            )}

            <div
              style={{
                maxWidth: "80%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  background: msg.role === "user" ? "#1a1a2e" : "transparent",
                  border: msg.role === "user" ? "1px solid #2a2a4a" : "none",
                  borderRadius: 12,
                  padding: msg.role === "user" ? "10px 14px" : "4px 0",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#e0e0e0",
                }}
              >
                {msg.loading ? (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <div style={dotStyle(0)} />
                      <div style={dotStyle(1)} />
                      <div style={dotStyle(2)} />
                      <span
                        style={{ fontSize: 12, color: "#666", marginLeft: 4 }}
                      >
                        {elapsed < 5
                          ? "Starting audit..."
                          : elapsed < 25
                            ? "Scraping App Store listing..."
                            : elapsed < 60
                              ? "Analysing listing content..."
                              : elapsed < 120
                                ? `Scoring across 10 ASO dimensions... (${elapsed}s)`
                                : `Generating recommendations... usually done by ${Math.ceil(elapsed / 60) + 1} min (${elapsed}s)`}
                      </span>
                    </div>
                    {elapsed > 10 && (
                      <span
                        style={{ fontSize: 11, color: "#444", paddingLeft: 24 }}
                      >
                        Full audits take 2–3 minutes. Hang tight.
                      </span>
                    )}
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div style={{ overflowX: "auto", margin: "12px 0" }}>
                          <table
                            style={{
                              borderCollapse: "collapse",
                              width: "100%",
                              fontSize: 13,
                            }}
                          >
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th
                          style={{
                            padding: "8px 12px",
                            borderBottom: "1px solid #333",
                            textAlign: "left",
                            color: "#888",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td
                          style={{
                            padding: "8px 12px",
                            borderBottom: "1px solid #1e1e1e",
                            verticalAlign: "top",
                          }}
                        >
                          {children}
                        </td>
                      ),
                      h2: ({ children }) => (
                        <h2
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#fff",
                            margin: "20px 0 10px",
                            paddingBottom: 6,
                            borderBottom: "1px solid #1e1e1e",
                          }}
                        >
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#ddd",
                            margin: "14px 0 6px",
                          }}
                        >
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p style={{ margin: "6px 0" }}>{children}</p>
                      ),
                      code: ({ children }) => (
                        <code
                          style={{
                            background: "#1a1a1a",
                            border: "1px solid #2a2a2a",
                            borderRadius: 4,
                            padding: "1px 6px",
                            fontSize: 12,
                            color: "#a0c4ff",
                          }}
                        >
                          {children}
                        </code>
                      ),
                      strong: ({ children }) => (
                        <strong style={{ color: "#fff", fontWeight: 600 }}>
                          {children}
                        </strong>
                      ),
                      li: ({ children }) => (
                        <li style={{ margin: "4px 0", paddingLeft: 4 }}>
                          {children}
                        </li>
                      ),
                      ul: ({ children }) => (
                        <ul style={{ paddingLeft: 20, margin: "6px 0" }}>
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol style={{ paddingLeft: 20, margin: "6px 0" }}>
                          {children}
                        </ol>
                      ),
                      hr: () => (
                        <hr
                          style={{
                            border: "none",
                            borderTop: "1px solid #1e1e1e",
                            margin: "16px 0",
                          }}
                        />
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>

              {msg.role === "assistant" && !msg.loading && msg.content && (
                <button
                  onClick={() => handleCopy(msg.content, i)}
                  style={{
                    marginTop: 6,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: copiedIndex === i ? "#6ee7b7" : "#444",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 0",
                    transition: "color 0.2s",
                    alignSelf: "flex-start",
                  }}
                >
                  {copiedIndex === i ? (
                    <>✓ Copied</>
                  ) : (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="13"
                          height="13"
                          rx="2"
                          ry="2"
                        />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} style={{ height: 24 }} />
      </div>

      {/* Input */}
      <div style={{ padding: 16, borderTop: "1px solid #1e1e1e" }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: "10px 14px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste an App Store URL..."
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#e0e0e0",
              fontSize: 14,
              resize: "none",
              lineHeight: 1.5,
              fontFamily: "inherit",
              opacity: loading ? 0.5 : 1,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? "#1e1e1e" : "#3a3af0",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              color: loading || !input.trim() ? "#444" : "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#444",
            marginTop: 8,
          }}
        >
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

function dotStyle(i: number): React.CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#444",
    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
  };
}
