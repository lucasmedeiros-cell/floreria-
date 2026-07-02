"use client";

/** Logo: flor dibujada (SVG), equivalente al CustomPainter de Flutter. */
export function FlowerMark({ size = 40 }: { size?: number }) {
  const w = size;
  const h = size * 1.08;
  const cx = w * 0.5;
  const cy = h * 0.3;
  const R = w * 0.2;
  const petals = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 * Math.PI) / 180;
    petals.push(
      <ellipse
        key={i}
        cx={R * 0.78}
        cy={0}
        rx={(R * 1.15) / 2}
        ry={(R * 0.72) / 2}
        fill="#B11E4B"
        fillOpacity={0.92}
        transform={`translate(${cx} ${cy}) rotate(${(a * 180) / Math.PI})`}
      />
    );
  }
  const leaf = (t: number, left: boolean) => {
    const baseY = h * (0.58 + t);
    const dir = left ? -1 : 1;
    return `M ${cx} ${baseY} Q ${cx + dir * w * 0.2} ${baseY - h * 0.05} ${
      cx + dir * w * 0.26
    } ${baseY - h * 0.16} Q ${cx + dir * w * 0.1} ${baseY - h * 0.1} ${cx} ${baseY} Z`;
  };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <line
        x1={cx}
        y1={cy + R * 0.5}
        x2={cx}
        y2={h * 0.96}
        stroke="#2F6B4F"
        strokeWidth={w * 0.05}
        strokeLinecap="round"
      />
      <path d={leaf(0, true)} fill="#2F6B4F" fillOpacity={0.92} />
      <path d={leaf(0.1, false)} fill="#2F6B4F" fillOpacity={0.92} />
      {petals}
      <circle cx={cx} cy={cy} r={R * 0.52} fill="#B8924A" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  const c = light ? "text-white" : "text-ink";
  const sub = light ? "text-white/70" : "text-faint";
  return (
    <div className="flex flex-col">
      <span
        className={`font-serif text-[25px] font-semibold leading-none tracking-tight ${c}`}
      >
        <span className="font-normal">Flores</span>Online
      </span>
      <span className={`eyebrow text-[6.5px] font-semibold ${sub}`}>
        ARTE FLORAL EN CADA DETALLE
      </span>
    </div>
  );
}

export function GoldRule({ width = 54 }: { width?: number }) {
  return (
    <div
      className="h-[2px] rounded-full"
      style={{
        width,
        background: "linear-gradient(90deg,#B8924A,#CBA869)",
      }}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = false,
  light = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}) {
  return (
    <div className={`flex flex-col ${center ? "items-center text-center" : "items-start"}`}>
      <span className="eyebrow text-[11px] font-semibold text-gold">{eyebrow}</span>
      <h2
        className={`mt-2.5 font-serif text-[34px] font-semibold leading-tight ${
          light ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      <div className="mt-3.5">
        <GoldRule />
      </div>
      {subtitle && (
        <p
          className={`mt-3.5 max-w-[520px] text-[14px] ${
            light ? "text-white/70" : "text-ink2"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
