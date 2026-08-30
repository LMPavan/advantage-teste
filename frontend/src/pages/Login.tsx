import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function LoginPage() {
  const { login, registerOwner } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await registerOwner({ name, email, password, networkName });
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
      <div className="auth-card">
        <div className="card">
          <h1>⛽ Metas Posto</h1>
          <p className="subtitle">
            {mode === "login" ? "Entre com sua conta" : "Cadastre sua rede/posto como dono"}
          </p>
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
            {mode === "register" && (
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
            {error && <p className="error-text">{error}</p>}
            <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta de dono"}
            </button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                É dono de posto e ainda não tem conta?{" "}
                <button onClick={() => setMode("register")}>Cadastre sua rede</button>
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
  );
}
