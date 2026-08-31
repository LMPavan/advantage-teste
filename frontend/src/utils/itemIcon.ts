import type { Item } from "../types";

/** Ícone temático por item, para reconhecimento visual rápido nos cards e listas. */
export function itemIcon(item: Pick<Item, "name" | "calculationType">): string {
  const name = item.name.toLowerCase();
  if (item.calculationType === "MIX_RATIO" || name.includes("mix") || name.includes("aditiv")) return "🔵";
  if (name.includes("lubrific") || name.includes("óleo") || name.includes("oleo")) return "🟠";
  if (name.includes("cheirinho") || name.includes("perfum")) return "🌸";
  if (name.includes("palheta") || name.includes("limp")) return "🧹";
  if (name.includes("diesel")) return "⚫";
  if (name.includes("etanol") || name.includes("álcool") || name.includes("alcool")) return "🟢";
  if (name.includes("volume") || name.includes("litro")) return "⛽";
  if (name.includes("bônus") || name.includes("bonus")) return "🎁";
  return "⛽";
}
