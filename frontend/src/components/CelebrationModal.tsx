import { useEffect, useRef } from "react";
import type { Goal } from "../types";

const CARD_WIDTH = 720;
const CARD_HEIGHT = 405;

function drawCard(canvas: HTMLCanvasElement, goal: Goal, attendantName: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, "#f97316");
  gradient.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * CARD_WIDTH, Math.random() * CARD_HEIGHT, Math.random() * 3 + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px sans-serif";
  ctx.fillText("⛽ Metas Posto", 40, 56);

  ctx.font = "800 44px sans-serif";
  ctx.fillText("Meta batida! 🎉", 40, 140);

  ctx.font = "600 26px sans-serif";
  ctx.fillText(`${attendantName}`, 40, 190);

  ctx.font = "500 22px sans-serif";
  ctx.fillText(`${goal.item.name}`, 40, 228);

  ctx.font = "800 64px sans-serif";
  ctx.fillText(`${Math.round(goal.progress.achievementPercent)}%`, 40, 320);

  ctx.font = "600 24px sans-serif";
  ctx.fillText(`da meta · R$ ${goal.progress.commissionAmount.toFixed(2)} de comissão`, 40, 360);
}

export function CelebrationModal({ goal, attendantName, onClose }: { goal: Goal; attendantName: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, goal, attendantName);
  }, [goal, attendantName]);

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "meta-batida.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Meta batida!", text: "Bati minha meta no Metas Posto! 🎉" });
          return;
        } catch {
          // usuário cancelou ou share falhou — cai pro download
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "meta-batida.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 760, width: "100%", textAlign: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>🎉 Parabéns, você bateu a meta!</h2>
        <p className="subtitle">
          {goal.item.name} · {Math.round(goal.progress.achievementPercent)}% da meta · R$ {goal.progress.commissionAmount.toFixed(2)} de
          comissão
        </p>
        <canvas ref={canvasRef} style={{ width: "100%", maxWidth: 640, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }} />
        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", marginTop: "1rem", flexWrap: "wrap" }}>
          <button className="btn" onClick={share}>
            📤 Compartilhar conquista
          </button>
          <button className="btn secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
