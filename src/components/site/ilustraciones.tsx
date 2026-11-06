/** Las ilustraciones de la portada: el estanque con su volcán, la red hasta cada casa y el medidor. Son SVG propios, sin imágenes. */

export function Paisaje() {
  const alamos = [860, 892, 926, 958, 1296, 1330, 1362, 1396];
  const postes = [120, 300, 480, 660];
  return (
    <svg
      viewBox="0 0 1440 340"
      preserveAspectRatio="xMaxYMax slice"
      role="img"
      aria-label="Estanque de agua elevado en un campo del sur de Chile, con un volcán de fondo"
      className="relative mt-6 block h-[190px] w-full md:mt-2 md:h-[320px]"
    >
      <path d="M180 250 L420 62 Q440 48 460 62 L720 250 Z" fill="#232A78" />
      <path d="M392 84 L420 62 Q440 48 460 62 L492 86 L470 100 L450 88 L432 104 L414 90 Z" fill="#AEB8FF" />
      <path d="M0 240 C200 170 380 215 560 200 C780 182 960 150 1180 186 C1290 204 1380 200 1440 188 V340 H0 Z" fill="#2B348F" />
      <path d="M0 278 C260 226 520 268 760 246 C980 226 1200 214 1440 246 V340 H0 Z" fill="#3B46B5" />
      {alamos.map((x, i) => (
        <g key={x}>
          <rect x={x - 1.5} y="205" width="3" height="30" fill="#141750" />
          <ellipse cx={x} cy={178 + (i % 2) * 5} rx="13" ry={44 - (i % 2) * 5} fill="#1A1F66" />
        </g>
      ))}
      <g fill="none" stroke="#141750" strokeLinecap="round">
        <path d="M1098 262 L1110 118 M1182 262 L1170 118" strokeWidth="6" />
        <path d="M1105 172 L1175 172 M1101 222 L1179 222" strokeWidth="4" />
        <path d="M1110 122 L1177 222 M1170 122 L1103 222 M1104 172 L1179 262 M1176 172 L1101 262" strokeWidth="2.5" />
        <path d="M1140 104 V262 H1060" stroke="#AEB8FF" strokeWidth="3.5" />
      </g>
      <rect x="1090" y="52" width="100" height="70" rx="9" fill="#141750" />
      <path d="M1084 56 Q1140 18 1196 56 Z" fill="#20267A" />
      <rect x="1104" y="66" width="7" height="42" rx="3.5" fill="#5B7CFF" />
      <rect x="1076" y="120" width="128" height="6" rx="3" fill="#141750" />
      <rect x="985" y="226" width="72" height="42" fill="#141750" />
      <path d="M977 228 L1021 204 L1065 228 Z" fill="#20267A" />
      <rect x="1014" y="240" width="15" height="28" fill="#AEB8FF" />
      {postes.map((x) => (
        <rect key={x} x={x} y="232" width="4" height="46" fill="#232A78" />
      ))}
      <path d="M122 236 Q212 252 302 236 Q392 252 482 236 Q572 252 662 236" fill="none" stroke="#232A78" strokeWidth="1.5" />
      <path d="M0 310 C240 264 560 294 860 280 C1110 268 1300 256 1440 276 V340 H0 Z" fill="#F6F6FB" />
    </svg>
  );
}

export function Red() {
  const casas = [
    { x: 560, y: 262 },
    { x: 780, y: 248 },
    { x: 1000, y: 262 },
    { x: 1220, y: 244 },
  ];
  return (
    <svg viewBox="0 0 1440 420" role="img" aria-label="Cañería que lleva agua desde un estanque hasta varias casas rurales, cada una con su medidor" className="block h-auto w-full">
      <defs>
        <linearGradient id="red-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C4CAFF" />
          <stop offset="1" stopColor="#F0F1FF" />
        </linearGradient>
      </defs>
      <rect width="1440" height="420" fill="url(#red-cielo)" />
      <circle cx="1240" cy="86" r="46" fill="#FFFFFF" opacity="0.85" />
      <path d="M0 250 C240 170 420 230 640 208 C900 182 1160 150 1440 214 V420 H0 Z" fill="#A9B3F6" />
      <path d="M0 300 C300 258 620 306 900 286 C1120 270 1300 262 1440 282 V420 H0 Z" fill="#7C89EE" />
      <g fill="none" stroke="#2A2F8F" strokeLinecap="round">
        <path d="M118 306 L130 160 M202 306 L190 160" strokeWidth="6" />
        <path d="M125 214 L195 214 M121 262 L199 262" strokeWidth="4" />
        <path d="M130 164 L197 262 M190 164 L123 262" strokeWidth="2.5" />
      </g>
      <rect x="110" y="92" width="100" height="70" rx="9" fill="#2A2F8F" />
      <path d="M104 96 Q160 58 216 96 Z" fill="#3A0CE3" />
      <rect x="124" y="106" width="7" height="42" rx="3.5" fill="#AEB8FF" />
      <path d="M160 150 V348 H1262" fill="none" stroke="#3A0CE3" strokeWidth="6" strokeLinejoin="round" />
      {casas.map((c) => (
        <g key={c.x}>
          <path d={`M${c.x + 40} 348 V${c.y + 52}`} stroke="#3A0CE3" strokeWidth="4" />
          <rect x={c.x} y={c.y} width="82" height="54" fill="#FFFFFF" />
          <path d={`M${c.x - 10} ${c.y + 2} L${c.x + 41} ${c.y - 32} L${c.x + 92} ${c.y + 2} Z`} fill="#2A2F8F" />
          <rect x={c.x + 14} y={c.y + 18} width="17" height="36" fill="#7C89EE" />
          <rect x={c.x + 46} y={c.y + 16} width="20" height="16" fill="#C4CAFF" />
          <circle cx={c.x + 40} cy="348" r="13" fill="#FFFFFF" stroke="#3A0CE3" strokeWidth="4" />
          <path d={`M${c.x + 40} 348 L${c.x + 47} 342`} stroke="#3A0CE3" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
      <path d="M0 392 C300 372 700 398 1040 382 C1220 374 1340 372 1440 382 V420 H0 Z" fill="#FFFFFF" />
    </svg>
  );
}

export function Medidor() {
  const marcas = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);
  return (
    <svg viewBox="0 0 360 360" role="img" aria-label="Medidor de agua con su dial y contador en metros cúbicos" className="mx-auto mt-8 hidden w-full max-w-[300px] lg:mx-0 lg:block">
      <rect x="0" y="152" width="44" height="56" rx="8" fill="#AEB8FF" />
      <rect x="316" y="152" width="44" height="56" rx="8" fill="#AEB8FF" />
      <circle cx="180" cy="180" r="150" fill="#3A0CE3" />
      <circle cx="180" cy="180" r="126" fill="#FFFFFF" />
      {marcas.map((a) => (
        <rect key={a} x="178" y="66" width="4" height="14" rx="2" fill="#C4CAFF" transform={`rotate(${a} 180 180)`} />
      ))}
      <rect x="112" y="122" width="136" height="44" rx="10" fill="#15132B" />
      <text x="180" y="153" textAnchor="middle" fontSize="28" fontFamily="monospace" fontWeight="600" letterSpacing="4" fill="#FFFFFF">
        01250
      </text>
      <text x="180" y="190" textAnchor="middle" fontSize="16" fill="#5B5970">
        m³
      </text>
      <circle cx="180" cy="248" r="30" fill="#F1EEFD" />
      <path d="M180 248 L198 232" stroke="#3A0CE3" strokeWidth="5" strokeLinecap="round" />
      <circle cx="180" cy="248" r="6" fill="#3A0CE3" />
    </svg>
  );
}
