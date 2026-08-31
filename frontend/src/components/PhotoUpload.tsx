import { useRef, useState } from "react";
import { resizeImageToDataUrl } from "../utils/image";
import { Avatar } from "./Avatar";

export function PhotoUpload({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      onChange(dataUrl);
    } catch {
      setError("Não foi possível processar a foto. Tente outra imagem.");
    }
  }

  return (
    <div className="field">
      <label>Foto de perfil (opcional)</label>
      <div className="avatar-upload">
        <div className="avatar-preview">
          <Avatar name={name || "?"} photoUrl={value} size={56} />
        </div>
        <button type="button" className="btn secondary small" onClick={() => inputRef.current?.click()}>
          {value ? "Trocar foto" : "Escolher foto"}
        </button>
        {value && (
          <button type="button" className="btn secondary small" onClick={() => onChange(null)}>
            Remover
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
