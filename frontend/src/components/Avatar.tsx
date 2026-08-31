const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#ef4444"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, photoUrl, size = 40 }: { name: string; photoUrl?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ ...style, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        ...style,
        borderRadius: "50%",
        background: colorFor(name),
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials(name) || "?"}
    </div>
  );
}
