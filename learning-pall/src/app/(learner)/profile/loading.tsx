export default function ProfileLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-vand-gold/30 border-t-vand-gold rounded-full animate-spin mx-auto mb-3" />
        <p className="text-vand-sand/50 text-sm">Loading profile…</p>
      </div>
    </div>
  );
}
