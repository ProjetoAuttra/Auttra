import * as React from "react";

const BASE = 200;

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width={BASE}
      height={BASE}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IllustrationOS() {
  return (
    <Svg>
      {/* clipboard */}
      <rect x="44" y="36" width="112" height="136" rx="10" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="2" />
      <rect x="72" y="26" width="56" height="20" rx="6" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.5" />
      {/* lines */}
      <rect x="60" y="72" width="80" height="8" rx="4" fill="#BFDBFE" />
      <rect x="60" y="90" width="56" height="8" rx="4" fill="#DBEAFE" />
      <rect x="60" y="108" width="68" height="8" rx="4" fill="#DBEAFE" />
      {/* wrench */}
      <circle cx="148" cy="148" r="28" fill="#1D4ED8" />
      <path
        d="M138 158l14-14m0 0a6 6 0 000-8.485 6 6 0 00-8.485 0l-5.515 5.515 8.485 8.485 5.515-5.515zm0 0l6 6"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IllustrationClientes() {
  return (
    <Svg>
      {/* people */}
      <circle cx="80" cy="76" r="22" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="2" />
      <path d="M44 136c0-19.882 16.118-36 36-36s36 16.118 36 36" stroke="#93C5FD" strokeWidth="2" fill="#EFF6FF" />
      <circle cx="128" cy="84" r="18" fill="#BFDBFE" stroke="#60A5FA" strokeWidth="2" />
      <path d="M96 136c0-17.673 14.327-32 32-32s32 14.327 32 32" stroke="#60A5FA" strokeWidth="2" fill="#DBEAFE" />
      {/* plus badge */}
      <circle cx="156" cy="52" r="18" fill="#1D4ED8" />
      <path d="M156 44v16M148 52h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IllustrationOrcamentos() {
  return (
    <Svg>
      {/* document */}
      <rect x="52" y="28" width="96" height="124" rx="8" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="2" />
      {/* fold */}
      <path d="M124 28l24 24h-24V28z" fill="#A7F3D0" />
      {/* lines */}
      <rect x="68" y="68" width="64" height="7" rx="3.5" fill="#6EE7B7" />
      <rect x="68" y="84" width="48" height="7" rx="3.5" fill="#A7F3D0" />
      <rect x="68" y="100" width="56" height="7" rx="3.5" fill="#A7F3D0" />
      {/* R$ badge */}
      <circle cx="148" cy="148" r="28" fill="#047481" />
      <text x="148" y="155" textAnchor="middle" fill="white" fontSize="20" fontWeight="800" fontFamily="sans-serif">R$</text>
    </Svg>
  );
}

export function IllustrationEstoque() {
  return (
    <Svg>
      {/* box */}
      <rect x="36" y="80" width="128" height="88" rx="8" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="2" />
      {/* lid */}
      <path d="M36 88l28-40h72l28 40H36z" fill="#FFEDD5" stroke="#FED7AA" strokeWidth="2" />
      {/* tape */}
      <rect x="88" y="48" width="24" height="40" rx="4" fill="#F97316" opacity="0.4" />
      {/* lines on box */}
      <rect x="60" y="108" width="80" height="7" rx="3.5" fill="#FED7AA" />
      <rect x="60" y="124" width="56" height="7" rx="3.5" fill="#FFEDD5" stroke="#FED7AA" strokeWidth="1" />
      {/* exclamation badge */}
      <circle cx="152" cy="148" r="24" fill="#D97706" />
      <rect x="150" y="136" width="4" height="12" rx="2" fill="white" />
      <circle cx="152" cy="154" r="2.5" fill="white" />
    </Svg>
  );
}

export function IllustrationVeiculos() {
  return (
    <Svg>
      {/* car body */}
      <rect x="28" y="108" width="144" height="52" rx="10" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="2" />
      {/* roof */}
      <path d="M56 108l24-44h40l24 44H56z" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="2" />
      {/* windows */}
      <rect x="68" y="76" width="28" height="28" rx="4" fill="#BFDBFE" />
      <rect x="104" y="76" width="28" height="28" rx="4" fill="#BFDBFE" />
      {/* wheels */}
      <circle cx="68" cy="160" r="20" fill="#1D4ED8" />
      <circle cx="68" cy="160" r="10" fill="#EFF6FF" />
      <circle cx="132" cy="160" r="20" fill="#1D4ED8" />
      <circle cx="132" cy="160" r="10" fill="#EFF6FF" />
    </Svg>
  );
}

export function IllustrationFeed() {
  return (
    <Svg>
      {/* bell */}
      <path
        d="M100 32a12 12 0 0112 12v4c12 4 20 16 20 30v16l12 16H56l12-16V78c0-14 8-26 20-30v-4a12 12 0 0112-12z"
        fill="#EFF6FF"
        stroke="#BFDBFE"
        strokeWidth="2"
      />
      <path d="M88 164a12 12 0 0024 0H88z" fill="#BFDBFE" />
      {/* zz */}
      <text x="130" y="72" fill="#93C5FD" fontSize="16" fontWeight="700" fontFamily="sans-serif">z</text>
      <text x="144" y="58" fill="#BFDBFE" fontSize="12" fontWeight="700" fontFamily="sans-serif">z</text>
      <text x="154" y="46" fill="#DBEAFE" fontSize="9" fontWeight="700" fontFamily="sans-serif">z</text>
    </Svg>
  );
}
