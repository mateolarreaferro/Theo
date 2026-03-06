import React, { useRef, useEffect } from "react";

export default function FreeformInput({
  value,
  onChange,
  onGenerate,
  generating,
  chatMessages,
  onChatReply,
  chatLoading,
  onStartChat,
  onClearChat,
}) {
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const hasChat = chatMessages && chatMessages.length > 0;
  const lastMsg = hasChat ? chatMessages[chatMessages.length - 1] : null;
  const awaitingReply = lastMsg?.role === "agent";
  const userReplied = lastMsg?.role === "user" && chatMessages.length > 1;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = inputRef.current?.value?.trim();
      if (text) {
        onChatReply(text);
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="freeform-panel">
      {!hasChat ? (
        <textarea
          className="freeform-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your ideas, notes, rough prose here...&#10;&#10;Click 'chat' to discuss before generating, or 'generate' to convert directly."
          spellCheck={false}
        />
      ) : (
        <div className="chat-view">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`chat-message chat-message--${msg.role}`}>
              <div className="chat-message-label">{msg.role === "agent" ? "agent" : "you"}</div>
              <div className="chat-message-text">{msg.text}</div>
            </div>
          ))}
          {chatLoading && (
            <div className="chat-message chat-message--agent">
              <div className="chat-message-label">agent</div>
              <div className="chat-message-text"><span className="spinner" /> thinking…</div>
            </div>
          )}
          {userReplied && !generating && !chatLoading && (
            <div className="chat-hint">
              ready to generate — click "generate →" or keep typing to add more context
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      <div className="freeform-action">
        {!hasChat ? (
          <>
            <button onClick={onStartChat} disabled={generating || chatLoading || !value.trim()}>
              {chatLoading ? (
                <><span className="spinner" />asking…</>
              ) : (
                "chat →"
              )}
            </button>
            <button onClick={onGenerate} disabled={generating || !value.trim()}>
              {generating ? (
                <><span className="spinner" />generating…</>
              ) : (
                "generate →"
              )}
            </button>
          </>
        ) : (
          <>
            <input
              ref={inputRef}
              className="chat-reply-input"
              type="text"
              placeholder={awaitingReply ? "Answer the agent…" : "Add more context…"}
              onKeyDown={handleKeyDown}
              disabled={chatLoading || generating}
            />
            <button onClick={onGenerate} disabled={generating || chatLoading}>
              {generating ? (
                <><span className="spinner" />generating…</>
              ) : (
                "generate →"
              )}
            </button>
            <button className="chat-back-btn" onClick={onClearChat} disabled={generating || chatLoading}>
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}
