import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { PhotoUpload } from "../components/PhotoUpload";
import { FuelPumpLogo } from "../components/FuelPumpLogo";
import type { Role } from "../types";

type Mode = "login" | "register";
type RegisterRole = Role;

const ROLE_OPTIONS: { value: RegisterRole; label: string }[] = [
  { value: "OWNER", label: "Sou dono de rede/posto" },
  { value: "MANAGER", label: "Sou gerente" },
  { value: "ATTENDANT", label: "Sou frentista" },
];

export function LoginPage() {
  const { login, registerOwner, registerWithCode } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [registerRole, setRegisterRole] = useState<RegisterRole>("OWNER");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else if (registerRole === "OWNER") {
        await registerOwner({ name, email, password, networkName, photoUrl });
      } else {
        await registerWithCode({
          role: registerRole,
          name,
          email,
          password,
          inviteCode,
          photoUrl,
        });
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível continuar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-hero">
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <FuelPumpLogo size={38} />
            <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.3rem", fontWeight: 700 }}>Metas Posto</div>
          </div>
          <div>
            <h2>Metas, comissão e ranking na palma da mão.</h2>
            <p>
              Feito para o dia a dia do posto: o frentista acompanha a comissão em tempo real, o gerente cuida
              da equipe e o dono enxerga a rede inteira — tudo simples, tudo no celular.
            </p>
          </div>
          <div className="auth-hero-points">
            <div className="auth-hero-point">
              <span className="icon">⛽</span> Lance a venda do dia em segundos
            </div>
            <div className="auth-hero-point">
              <span className="icon">💰</span> Veja a comissão crescer ao vivo
            </div>
            <div className="auth-hero-point">
              <span className="icon">🏆</span> Dispute o ranking com o time
            </div>
          </div>
        </div>
        <div className="auth-card">
          <div className="card">
          <p className="subtitle">{mode === "login" ? "Entre com sua conta" : "Crie sua conta"}</p>

          {mode === "register" && (
            <div className="role-picker">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={registerRole === opt.value ? "active" : ""}
                  onClick={() => setRegisterRole(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="field">
                <label>Seu nome</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="field">
              <label>E-mail</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Senha</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {mode === "register" && registerRole === "OWNER" && (
              <div className="field">
                <label>Nome da rede/posto</label>
                <input
                  className="input"
                  value={networkName}
                  onChange={(e) => setNetworkName(e.target.value)}
                  required
                />
              </div>
            )}

            {mode === "register" && (registerRole === "MANAGER" || registerRole === "ATTENDANT") && (
              <div className="field">
                <label>Código de convite do posto</label>
                <input
                  className="input"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Peça ao dono do posto"
                  required
                />
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {registerRole === "MANAGER"
                    ? "Código específico de gerente, fornecido pelo dono da rede."
                    : "Código de frentista, fornecido pelo dono ou pelo gerente do posto."}
                </span>
              </div>
            )}

            {mode === "register" && <PhotoUpload name={name} value={photoUrl} onChange={setPhotoUrl} />}

            {error && <p className="error-text">{error}</p>}
            <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                Ainda não tem conta? <button onClick={() => setMode("register")}>Cadastre-se</button>
              </>
            ) : (
              <>
                Já tem conta? <button onClick={() => setMode("login")}>Entrar</button>
              </>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
