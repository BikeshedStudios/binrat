type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  shapeRendering: "crispEdges" as const,
  "aria-hidden": true,
  focusable: "false" as const,
});

export function RatMark({ size = 22, eye = "#ff5347" }: { size?: number; eye?: string }) {
  return (
    <svg {...base(size)}>
      <g fill="currentColor">
        <rect x="1" y="3" width="4" height="4" />
        <rect x="2" y="2" width="2" height="2" />
        <rect x="11" y="3" width="4" height="4" />
        <rect x="12" y="2" width="2" height="2" />
      </g>
      <g fill="#c98b7a" opacity="0.6">
        <rect x="2" y="4" width="2" height="2" />
        <rect x="12" y="4" width="2" height="2" />
      </g>
      <g fill="currentColor">
        <rect x="4" y="4" width="8" height="1" />
        <rect x="3" y="5" width="10" height="6" />
        <rect x="5" y="11" width="6" height="2" />
        <rect x="7" y="13" width="2" height="1" />
      </g>
      <rect x="5" y="7" width="2" height="2" fill="#0b0906" />
      <rect x="9" y="7" width="2" height="2" fill={eye} />
      <rect x="7" y="10" width="2" height="1" fill="#d98a86" />
      <g stroke="currentColor" strokeWidth="0.7" opacity="0.45">
        <line x1="0" y1="9" x2="3" y2="9" />
        <line x1="0" y1="12" x2="3" y2="11" />
        <line x1="16" y1="9" x2="13" y2="9" />
        <line x1="16" y1="12" x2="13" y2="11" />
      </g>
    </svg>
  );
}

export function IconDen({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="2" y="2" width="12" height="2" />
      <rect x="2" y="4" width="2" height="10" />
      <rect x="12" y="4" width="2" height="10" />
      <rect x="5" y="7" width="6" height="7" fill="#0b0906" />
      <rect x="5" y="5" width="6" height="2" />
      <rect x="9" y="10" width="1" height="1" />
    </svg>
  );
}

export function IconPile({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="2" y="3" width="12" height="2" />
      <rect x="3" y="6" width="10" height="2" />
      <rect x="1" y="9" width="14" height="4" />
      <rect x="4" y="10" width="2" height="2" fill="#0b0906" />
      <rect x="10" y="10" width="2" height="2" fill="#0b0906" />
    </svg>
  );
}

export function IconFile({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="2" y="3" width="5" height="2" />
      <rect x="2" y="3" width="12" height="11" />
      <rect x="4" y="7" width="8" height="1" fill="#0b0906" />
      <rect x="4" y="9" width="6" height="1" fill="#0b0906" />
      <rect x="4" y="11" width="7" height="1" fill="#0b0906" />
    </svg>
  );
}

export function IconWire({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="1" y="5" width="2" height="6" />
      <rect x="1" y="3" width="4" height="2" />
      <rect x="1" y="11" width="4" height="2" />
      <rect x="5" y="7" width="6" height="2" />
      <rect x="11" y="5" width="4" height="6" />
      <rect x="12" y="7" width="2" height="2" fill="#0b0906" />
    </svg>
  );
}

export function IconDesk({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="6" y="2" width="4" height="2" />
      <rect x="5" y="4" width="6" height="2" />
      <rect x="4" y="6" width="8" height="4" />
      <rect x="3" y="10" width="10" height="2" />
      <rect x="7" y="12" width="2" height="2" />
      <rect x="7" y="3" width="2" height="2" fill="#0b0906" />
    </svg>
  );
}

export function IconManual({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="2" y="2" width="3" height="12" />
      <rect x="3" y="1" width="11" height="2" />
      <rect x="3" y="13" width="11" height="2" />
      <rect x="3" y="3" width="11" height="10" />
      <rect x="5" y="5" width="7" height="1" fill="#0b0906" />
      <rect x="5" y="7" width="5" height="1" fill="#0b0906" />
      <rect x="5" y="9" width="6" height="1" fill="#0b0906" />
    </svg>
  );
}

export function IconArrow({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="2" y="7" width="9" height="2" />
      <rect x="10" y="5" width="2" height="6" />
      <rect x="12" y="6" width="1" height="4" />
      <rect x="13" y="7" width="1" height="2" />
    </svg>
  );
}

export function IconSearch({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="3" y="2" width="7" height="2" />
      <rect x="2" y="3" width="2" height="7" />
      <rect x="9" y="3" width="2" height="2" />
      <rect x="9" y="8" width="2" height="2" />
      <rect x="3" y="10" width="7" height="2" />
      <rect x="10" y="10" width="4" height="3" transform="rotate(45 12 11.5)" />
    </svg>
  );
}

export function IconCheck({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="2" y="8" width="3" height="2" />
      <rect x="4" y="10" width="3" height="2" />
      <rect x="6" y="8" width="3" height="2" />
      <rect x="8" y="6" width="3" height="2" />
      <rect x="10" y="4" width="3" height="2" />
      <rect x="12" y="2" width="2" height="2" />
    </svg>
  );
}

export function IconCross({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="3" y="3" width="2" height="2" />
      <rect x="5" y="5" width="2" height="2" />
      <rect x="7" y="7" width="2" height="2" />
      <rect x="9" y="9" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="9" y="5" width="2" height="2" />
      <rect x="5" y="9" width="2" height="2" />
      <rect x="3" y="11" width="2" height="2" />
    </svg>
  );
}

export function IconEye({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="2" y="6" width="2" height="4" />
      <rect x="4" y="4" width="2" height="8" />
      <rect x="6" y="3" width="4" height="10" />
      <rect x="10" y="4" width="2" height="8" />
      <rect x="12" y="6" width="2" height="4" />
      <rect x="7" y="6" width="2" height="4" fill="#0b0906" />
    </svg>
  );
}

export function IconPin({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="6" y="2" width="4" height="2" />
      <rect x="5" y="4" width="6" height="2" />
      <rect x="6" y="6" width="4" height="4" />
      <rect x="7" y="10" width="2" height="4" />
      <circle cx="8" cy="7" r="1" fill="#0b0906" />
    </svg>
  );
}

export const ROOM_ICONS = {
  den: IconDen,
  pile: IconPile,
  file: IconFile,
  wire: IconWire,
  desk: IconDesk,
  manual: IconManual,
};
