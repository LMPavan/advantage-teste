import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { AttendantRankingRow, Badge, Challenge, Goal, XpSummary } from "../types";
import { AchievementBadge, ProgressBar } from "../components/ProgressBar";
import { BadgeShelf } from "../components/BadgeGrid";
import { Medal, tierForRank } from "../components/Leaderboard";
import { Avatar } from "../components/Avatar";
import { UnreadMessagesPopup } from "../components/UnreadMessagesPopup";
import { CommissionInfoButton } from "../components/CommissionInfoButton";
import { XpBar } from "../components/XpBar";
import { ChallengeCard } from "../components/ChallengeCard";
import { CelebrationModal } from "../components/CelebrationModal";
import { StretchGoalInput } from "../components/StretchGoalInput";
import { itemIcon } from "../utils/itemIcon";
import { markCelebrated, wasCelebrated } from "../utils/localGoalPrefs";

const PERIOD_LABEL: Record<string, string> = { DAILY: "Diária", WEEKLY: "Semanal", MONTHLY: "Mensal" };

function remainingMessage(goal: Goal): { text: string; done: boolean } {
  const { actualValue, targetValue, achievementPercent } = goal.progress;
  if (achievementPercent >= 100) return { text: "Meta batida! 🎉", done: true };
  if (goal.item.direction === "LOWER_IS_BETTER") {
    const diff = Math.round((actualValue - targetValue) * 100) / 100;
    return { text: `Reduza mais ${diff} para bater a meta`, done: false };
  }
  const diff = Math.round((targetValue - actualValue) * 100) / 100;
  return { text: `Faltam ${diff} ${goal.item.unit} para bater a meta`, done: false };
}

function RankPositionCard({ rows, ownId }: { rows: AttendantRankingRow[]; ownId: string }) {
  const index = rows.findIndex((r) => r.attendantId === ownId);
  if (index === -1) return null;
  const rank = index + 1;
  const tier = tierForRank(rank, true);
  const own = rows[index];
  const ahead = rank > 1 ? rows[index - 1] : null;
  const gapToNext = ahead ? Math.max(0, Math.round((ahead.avgAchievement - own.avgAchievement) * 10) / 10) : 0;

  return (
    <div className={`card section rank-position ${tier ?? ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <Avatar name={own.name} photoUrl={own.photoUrl} size={48} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {tier ? <Medal tier={tier} /> : <span className="rank-plain">{rank}º</span>}
            <strong>
              Você está em {rank}º lugar no posto{tier ? "! 🎉" : ""}
            </strong>
          </div>
          <p className="subtitle" style={{ margin: "0.2rem 0 0" }}>
            {rank === 1
              ? "Você está na liderança — continue assim para manter a posição!"
              : `Faltam ${gapToNext} pontos de atingimento médio para alcançar o ${rank - 1}º lugar.`}
          </p>
        </div>
        <Link to="/attendant/ranking" className="btn secondary small">
          Ver ranking completo →
        </Link>
      </div>
    </div>
  );
}

function EntryForm({ goal, onSaved }: { goal: Goal; onSaved: () => void }) {
  const isMix = goal.item.calculationType === "MIX_RATIO";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [comumLiters, setComumLiters] = useState("");
  const [aditivadaLiters, setAditivadaLiters] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/entries`, {
        goalId: goal.id,
        date,
        value: isMix ? undefined : Number(value),
        comumLiters: isMix ? Number(comumLiters) : undefined,
        aditivadaLiters: isMix ? Number(aditivadaLiters) : undefined,
      });
      setValue("");
      setComumLiters("");
      setAditivadaLiters("");
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao lançar.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn secondary small" onClick={() => setOpen(true)}>
        Lançar venda de hoje
      </button>
    );
  }

  return (
    <div className="inline-form" style={{ marginTop: "0.6rem" }}>
      <div className="field">
        <label>Data</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {isMix ? (
        <>
          <div className="field">
            <label>Litros gasolina comum</label>
            <input className="input" type="number" step="0.01" value={comumLiters} onChange={(e) => setComumLiters(e.target.value)} />
          </div>
          <div className="field">
            <label>Litros gasolina aditivada</label>
            <input className="input" type="number" step="0.01" value={aditivadaLiters} onChange={(e) => setAditivadaLiters(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="field">
          <label>Valor ({goal.item.unit})</label>
          <input className="input" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
      )}
      <button className="btn small" onClick={submit} disabled={saving}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
      <button className="btn secondary small" onClick={() => setOpen(false)}>
        Cancelar
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function AttendantGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [ranking, setRanking] = useState<AttendantRankingRow[] | null>(null);
  const [xp, setXp] = useState<XpSummary | null>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<Goal | null>(null);

  function load() {
    api
      .get<Goal[]>("/goals")
      .then((fetched) => {
        setGoals(fetched);
        const newlyHit = fetched.find(
          (g) => g.progress.achievementPercent >= 100 && !wasCelebrated(g.id, g.endDate)
        );
        if (newlyHit) {
          markCelebrated(newlyHit.id, newlyHit.endDate);
          setCelebrating(newlyHit);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar metas."));
    api.get<Badge[]>("/badges").then(setBadges);
    api.get<AttendantRankingRow[]>("/dashboard/station-ranking").then(setRanking);
    api.get<XpSummary>("/badges/xp").then(setXp);
    api.get<Challenge[]>("/challenges").then(setChallenges);
  }

  useEffect(load, []);

  const totalCommission = goals?.reduce((sum, g) => sum + g.progress.commissionAmount, 0) ?? 0;
  const goalsHit = goals?.filter((g) => g.progress.achievementPercent >= 100).length ?? 0;

  return (
    <div>
      <UnreadMessagesPopup />
      {celebrating && user && (
        <CelebrationModal goal={celebrating} attendantName={user.name} onClose={() => setCelebrating(null)} />
      )}
      <h1>Minhas metas</h1>
      <p className="subtitle">Acompanhe atingimento, o que falta e a comissão de cada item.</p>

      <div className="section grid cols-3">
        <div className="card stat">
          <span className="value">R$ {totalCommission.toFixed(2)}</span>
          <span className="label">Comissão acumulada no período</span>
        </div>
        <div className="card stat">
          <span className="value">
            {goalsHit}/{goals?.length ?? 0}
          </span>
          <span className="label">Metas batidas no período</span>
        </div>
      </div>

      {xp && <XpBar xp={xp} />}

      {ranking && user && <RankPositionCard rows={ranking} ownId={user.id} />}

      {challenges && challenges.filter((c) => c.status === "ACTIVE").length > 0 && (
        <div className="section">
          <h2>⚡ Desafios e duelos ativos</h2>
          <div className="grid cols-2">
            {challenges
              .filter((c) => c.status === "ACTIVE")
              .map((c) => (
                <ChallengeCard key={c.id} challenge={c} />
              ))}
          </div>
        </div>
      )}

      {badges && (
        <div className="card section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem" }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>🎖️ Suas conquistas</div>
            <BadgeShelf badges={badges} />
            {badges.every((b) => !b.achieved) && <p className="subtitle" style={{ margin: 0 }}>Ainda sem medalhas — comece lançando suas vendas!</p>}
          </div>
          <Link to="/attendant/badges" className="btn secondary small">
            Ver todas →
          </Link>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {!goals && !error && <p>Carregando...</p>}

      <div className="grid cols-2 section">
        {goals?.map((goal) => {
          const remaining = remainingMessage(goal);
          return (
            <div className="card" key={goal.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.6rem" }}>
                <div style={{ display: "flex", alignItems: "start", gap: "0.7rem", minWidth: 0 }}>
                  <span className="item-icon">{itemIcon(goal.item)}</span>
                  <div>
                    <h2 style={{ marginBottom: "0.1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {goal.item.name} <CommissionInfoButton item={goal.item} />
                    </h2>
                    <span className="badge neutral">{PERIOD_LABEL[goal.period]}</span>{" "}
                    {!goal.item.linkedToGoal && (
                      <span className="badge ok" title="Você recebe por unidade vendida, mesmo sem bater a meta.">
                        Paga por unidade
                      </span>
                    )}
                  </div>
                </div>
                <AchievementBadge percent={goal.progress.achievementPercent} />
              </div>

              <div className="grid cols-2" style={{ margin: "0.6rem 0", gap: "0.5rem" }}>
                <div className="card stat" style={{ padding: "0.5rem 0.7rem" }}>
                  <span className="value" style={{ fontSize: "1.1rem" }}>
                    {goal.today.actualValue} {goal.item.unit}
                  </span>
                  <span className="label">Hoje · R$ {goal.today.estimatedCommission.toFixed(2)} de ritmo</span>
                </div>
                <div className="card stat" style={{ padding: "0.5rem 0.7rem" }}>
                  <span className="value" style={{ fontSize: "1.1rem" }}>
                    {goal.progress.actualValue} / {goal.progress.targetValue} {goal.item.unit}
                  </span>
                  <span className="label">Acumulado do mês</span>
                </div>
              </div>
              <ProgressBar percent={goal.progress.achievementPercent} />
              <p className={`goal-remaining ${remaining.done ? "done" : "pending"}`}>{remaining.text}</p>

              <p style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>
                Comissão gerada no mês: <strong>R$ {goal.progress.commissionAmount.toFixed(2)}</strong>
              </p>
              {goal.projection && goal.progress.achievementPercent < 100 && (
                <p className="subtitle" style={{ margin: "0.2rem 0 0" }}>
                  No ritmo de hoje, fecha o mês em <strong>{goal.projection.projectedAchievementPercent}%</strong> da
                  meta (R$ {goal.projection.projectedCommission.toFixed(2)})
                </p>
              )}

              <StretchGoalInput goal={goal} />

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                <EntryForm goal={goal} onSaved={load} />
                <Link to={`/attendant/goals/${goal.id}`} className="btn secondary small">
                  Ver detalhes diários →
                </Link>
              </div>
            </div>
          );
        })}
        {goals && goals.length === 0 && <p>Nenhuma meta atribuída ainda. Fale com seu gerente.</p>}
      </div>
    </div>
  );
}
