/** Toggle leve (liga/desliga) com cor sutil para diferenciar o estado, ex.: ativar/desativar um item. */
export function Switch({
  checked,
  onChange,
  disabled,
  labelOn = "Ativo",
  labelOff = "Inativo",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" />
      <span className="switch-label">{checked ? labelOn : labelOff}</span>
    </label>
  );
}
