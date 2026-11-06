/** El estanque elevado con su volcán de fondo: la ilustración de la portada y del acceso. `suelo` es el color de la franja de abajo, para que empalme con lo que sigue. */
export function Paisaje({ suelo = "#F6F6FB" }: { suelo?: string }) {
  const alamos = [860, 892, 926, 958, 1296, 1330, 1362, 1396]
  const postes = [120, 300, 480, 660]
  return (
    <svg viewBox="0 0 1440 340" preserveAspectRatio="xMaxYMax slice" role="img" aria-label="Estanque de agua elevado en un campo del sur de Chile, con un volcán de fondo" className="relative mt-6 block h-[190px] w-full md:mt-2 md:h-[320px]">
      <path d="M180 250 L420 62 Q440 48 460 62 L720 250 Z" fill="#232A78" />
      <path d="M392 84 L420 62 Q440 48 460 62 L492 86 L470 100 L450 88 L432 104 L414 90 Z" fill="#AEB8FF" />
      <path d="M0 240 C200 170 380 215 560 200 C780 182 960 150 1180 186 C1290 204 1380 200 1440 188 V340 H0 Z" fill="#2B348F" />
      <path d="M0 278 C260 226 520 268 760 246 C980 226 1200 214 1440 246 V340 H0 Z" fill="#3B46B5" />
      {alamos.map((x, i) => (
        <g key={x}>
          <rect x={x - 1.500} y="205" width="3" height="30" fill="#141750" />
          <ellipse cx={x} cy={178 + (i % 2) * 5} rx="13" ry={44 - (i % 2) * 5} fill="#1A1F66" />
        </g>
      ))}
      <g fill="none" stroke="#141750" strokeLinecap="round">
        <path d="M1098 262 L1110 118 M1182 262 L1170 118" strokeWidth="6" />
        <path d="M1105 172 L1175 172 M1101 222 L1179 222" strokeWidth="4" />
        <path d="M1110 122 L1177 222 M1170 122 L1103 222 M1104 172 L1179 262 M1176 172 L1101 262" strokeWidth="2.500" />
        <path d="M1140 104 V262 H1060" stroke="#AEB8FF" strokeWidth="3.500" />
      </g>
      <rect x="1090" y="52" width="100" height="70" rx="9" fill="#141750" />
      <path d="M1084 56 Q1140 18 1196 56 Z" fill="#20267A" />
      <rect x="1104" y="66" width="7" height="42" rx="3.500" fill="#5B7CFF" />
      <rect x="1076" y="120" width="128" height="6" rx="3" fill="#141750" />
      <rect x="985" y="226" width="72" height="42" fill="#141750" />
      <path d="M977 228 L1021 204 L1065 228 Z" fill="#20267A" />
      <rect x="1014" y="240" width="15" height="28" fill="#AEB8FF" />
      {postes.map((x) => (
        <rect key={x} x={x} y="232" width="4" height="46" fill="#232A78" />
      ))}
      <path d="M122 236 Q212 252 302 236 Q392 252 482 236 Q572 252 662 236" fill="none" stroke="#232A78" strokeWidth="1.500" />
      <path d="M0 310 C240 264 560 294 860 280 C1110 268 1300 256 1440 276 V340 H0 Z" fill={suelo} />
    </svg>
  )
}
