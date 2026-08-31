/** Marca do app: bomba de combustível estilizada, usada na sidebar e na tela de login. */
export function FuelPumpLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="var(--primary)" />
      <path
        d="M13 38V14a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v24"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="10" y1="38" x2="29" y2="38" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="16.5" y1="20" x2="22.5" y2="20" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M27 18h3.2c1.3 0 2.3 1 2.3 2.3v11.2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V21"
        stroke="#7dd3fc"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M32.5 15.5 36.5 19.5" stroke="#7dd3fc" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
