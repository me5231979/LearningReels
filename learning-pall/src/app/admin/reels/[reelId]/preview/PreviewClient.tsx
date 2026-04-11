"use client";

import ReelView from "@/components/reels/ReelView";
import type { ReelData } from "@/components/reels/ReelFeed";

type Props = {
  reel: ReelData;
  userId: string;
  status: string;
};

export default function PreviewClient({ reel, userId, status }: Props) {
  return (
    <div className="min-h-screen bg-vand-black text-vand-sand flex flex-col items-center">
      <div className="w-full px-4 py-3 bg-black/60 border-b border-white/10 flex items-center justify-between text-xs">
        <span className="text-vand-sand/60 truncate">
          Admin preview · <span className="text-vand-gold uppercase">{status}</span>
        </span>
        <button
          onClick={() => window.close()}
          className="text-vand-sand/60 hover:text-vand-sand"
        >
          Close ✕
        </button>
      </div>
      <div className="relative w-full max-w-[420px] h-[calc(100vh-44px)]">
        <ReelView reel={reel} isActive={true} userId={userId} />
      </div>
    </div>
  );
}
