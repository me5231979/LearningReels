"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, MessageCircle } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; ts: number };

export type CoachConversationView = {
  id: string;
  reelId: string;
  reelTitle: string;
  topicLabel: string;
  turnsUsed: number;
  updatedAt: string;
  messages: Message[];
};

export default function CoachHistory({
  conversations,
}: {
  conversations: CoachConversationView[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 border-dashed rounded-lg px-4 py-5 text-center">
        <MessageCircle className="w-5 h-5 text-vand-sand/40 mx-auto mb-2" />
        <p className="text-vand-sand/60 text-xs">
          No coaching sessions yet. Tap{" "}
          <span className="text-vand-gold">Talk to Coach</span> after finishing
          a reel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((c) => {
        const open = openId === c.id;
        return (
          <div
            key={c.id}
            className="bg-white/5 border border-white/10 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setOpenId(open ? null : c.id)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-white/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-vand-gold/15 border border-vand-gold/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={13} className="text-vand-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-bold leading-snug break-words">
                  {c.reelTitle}
                </p>
                <p className="text-vand-sand/40 text-[11px] mt-0.5 font-condensed uppercase tracking-wider">
                  {c.topicLabel} · {c.turnsUsed}{" "}
                  {c.turnsUsed === 1 ? "turn" : "turns"} ·{" "}
                  {new Date(c.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={`text-vand-sand/40 shrink-0 mt-1 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>
            {open && (
              <div className="border-t border-white/5 px-4 py-3 space-y-2 bg-black/30">
                {c.messages.length === 0 ? (
                  <p className="text-vand-sand/40 text-xs text-center py-2">
                    Coach said hello but you haven&apos;t replied yet.
                  </p>
                ) : (
                  c.messages.map((m, i) => (
                    <div
                      key={i}
                      className={
                        m.role === "user" ? "flex justify-end" : "flex justify-start"
                      }
                    >
                      <div
                        className={
                          m.role === "user"
                            ? "bg-vand-gold/20 border border-vand-gold/30 rounded-2xl rounded-tr-sm px-3 py-2 text-xs text-white max-w-[85%] whitespace-pre-wrap"
                            : "bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-vand-sand/90 max-w-[85%] whitespace-pre-wrap"
                        }
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
