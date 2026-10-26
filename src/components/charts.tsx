import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { countsByDay } from '@/lib/stats';
import { MONTHS_SHORT, WEEKDAYS_SHORT, addDays, dayKey, formatHourCompact, startOfDay, startOfWeek } from '@/lib/time';
import type { OccurEvent } from '@/lib/types';
import { font, useTheme } from '@/theme';
import { alpha, type Swatch } from '@/theme/palette';

export function useWidth(initial = 0) {
  const [w, setW] = useState(initial);
  const onLayout = (e: LayoutChangeEvent) => {
    const nw = Math.round(e.nativeEvent.layout.width);
    if (nw !== w) setW(nw);
  };
  return [w, onLayout] as const;
}

/**
 * 24-hour radial chart — the "when" of a habit at a glance. Midnight at the
 * top, noon at the bottom, like the rim of the home-screen bubbles.
 */
export function ClockChart({
  values,
  size,
  swatch,
  children,
}: {
  values: number[];
  size: number;
  swatch: Swatch;
  children?: ReactNode;
}) {
  const t = useTheme();
  const r = size / 2;
  const ri = r * 0.46;
  const ro = r * 0.86;
  const max = Math.max(1, ...values);
  const top = values.indexOf(Math.max(...values));
  const stroke = ((2 * Math.PI * ri) / 24) * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={r} cy={r} r={ri - stroke * 0.9} fill={alpha(swatch.base, 0.12)} />
        {values.map((v, i) => {
          const a = ((i + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
          const len = v > 0 ? Math.max(stroke * 0.2, (v / max) * (ro - ri)) : 0;
          return (
            <G key={i}>
              <Line
                x1={r + Math.cos(a) * ri}
                y1={r + Math.sin(a) * ri}
                x2={r + Math.cos(a) * ro}
                y2={r + Math.sin(a) * ro}
                stroke={t.line}
                strokeWidth={stroke}
                strokeLinecap="round"
              />
              {len > 0 && (
                <Line
                  x1={r + Math.cos(a) * ri}
                  y1={r + Math.sin(a) * ri}
                  x2={r + Math.cos(a) * (ri + len)}
                  y2={r + Math.sin(a) * (ri + len)}
                  stroke={i === top ? swatch.deep : swatch.base}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                />
              )}
            </G>
          );
        })}
        {[0, 6, 12, 18].map((h) => {
          const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
          const lr = ro + r * 0.1;
          return (
            <SvgText
              key={h}
              x={r + Math.cos(a) * lr}
              y={r + Math.sin(a) * lr + 4}
              fontSize={11}
              fontFamily={font.semibold}
              fill={t.inkFaint}
              textAnchor="middle">
              {formatHourCompact(h)}
            </SvgText>
          );
        })}
      </Svg>
      <View style={{ width: ri * 1.55, alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/** Simple vertical bars with an optional highlighted bar. */
export function Bars({
  values,
  labels,
  height = 120,
  color,
  highlight,
  showValues,
}: {
  values: number[];
  labels?: string[];
  height?: number;
  color: string;
  highlight?: number;
  showValues?: boolean;
}) {
  const t = useTheme();
  const [w, onLayout] = useWidth();
  const n = Math.max(1, values.length);
  const max = Math.max(1, ...values);
  const labelH = labels ? 18 : 0;
  const valueH = showValues ? 16 : 0;
  const slot = w / n;
  const bw = Math.max(3, Math.min(34, slot * 0.62));
  const chartH = height - labelH - valueH;
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {values.map((v, i) => {
            const h = v > 0 ? Math.max(4, (v / max) * chartH) : 2;
            const x = i * slot + (slot - bw) / 2;
            const y = valueH + chartH - h;
            const hi = highlight === i;
            return (
              <G key={i}>
                <Rect
                  x={x}
                  y={y}
                  width={bw}
                  height={h}
                  rx={Math.min(bw / 2, 8)}
                  fill={v > 0 ? (hi ? color : alpha(color, highlight === undefined ? 0.9 : 0.42)) : t.line}
                />
                {showValues && v > 0 && (
                  <SvgText
                    x={x + bw / 2}
                    y={y - 4}
                    fontSize={11}
                    fontFamily={font.bold}
                    fill={hi ? t.ink : t.inkFaint}
                    textAnchor="middle">
                    {String(v)}
                  </SvgText>
                )}
                {labels?.[i] ? (
                  <SvgText
                    x={x + bw / 2}
                    y={height - 3}
                    fontSize={labels[i].length > 3 ? 10 : 11}
                    fontFamily={font.semibold}
                    fill={hi ? t.ink : t.inkFaint}
                    textAnchor="middle">
                    {labels[i]}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** GitHub-style calendar of the last N weeks, Monday-first rows. */
export function Heatmap({
  events,
  weeks = 15,
  swatch,
  now = new Date(),
}: {
  events: OccurEvent[];
  weeks?: number;
  swatch: Swatch;
  now?: Date;
}) {
  const t = useTheme();
  const [w, onLayout] = useWidth();
  const counts = countsByDay(events);
  const leftLabel = 22;
  const gap = 3;
  const cell = w > 0 ? Math.floor((w - leftLabel - gap * (weeks - 1)) / weeks) : 0;
  const start = addDays(startOfWeek(now), -(weeks - 1) * 7);
  const today = startOfDay(now).getTime();
  const vals = [...counts.values()].sort((a, b) => a - b);
  const q = (p: number) => vals[Math.floor((vals.length - 1) * p)] ?? 1;
  const levels = [q(0.25), q(0.5), q(0.8)];
  const level = (v: number) => (v <= 0 ? 0 : v <= levels[0] ? 1 : v <= levels[1] ? 2 : v <= levels[2] ? 3 : 4);
  const fills = [t.line, alpha(swatch.base, 0.35), alpha(swatch.base, 0.6), swatch.base, swatch.deep];
  const height = 16 + 7 * (cell + gap);

  return (
    <View onLayout={onLayout} style={{ height: cell ? height : 120 }}>
      {cell > 0 && (
        <Svg width={w} height={height}>
          {Array.from({ length: weeks }, (_, wi) => {
            const weekStart = addDays(start, wi * 7);
            const x = leftLabel + wi * (cell + gap);
            const showMonth = wi === 0 || weekStart.getDate() <= 7;
            return (
              <G key={wi}>
                {showMonth && (
                  <SvgText x={x} y={10} fontSize={10} fontFamily={font.semibold} fill={t.inkFaint}>
                    {MONTHS_SHORT[weekStart.getMonth()]}
                  </SvgText>
                )}
                {Array.from({ length: 7 }, (_, di) => {
                  const d = addDays(weekStart, di);
                  if (d.getTime() > today) return null;
                  const v = counts.get(dayKey(d)) ?? 0;
                  return (
                    <Rect
                      key={di}
                      x={x}
                      y={16 + di * (cell + gap)}
                      width={cell}
                      height={cell}
                      rx={Math.min(5, cell / 3)}
                      fill={fills[level(v)]}
                      stroke={d.getTime() === today ? t.ink : 'none'}
                      strokeWidth={d.getTime() === today ? 1.4 : 0}
                    />
                  );
                })}
              </G>
            );
          })}
          {[0, 2, 4].map((di) => (
            <SvgText
              key={di}
              x={0}
              y={16 + di * (cell + gap) + cell * 0.75}
              fontSize={10}
              fontFamily={font.semibold}
              fill={t.inkFaint}>
              {WEEKDAYS_SHORT[(di + 1) % 7].slice(0, 1)}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

/** A day as a 24h line, each event a dot in its category colour. */
export function DayStrip({
  items,
  now = new Date(),
}: {
  items: { hour: number; color: string; key: string }[];
  now?: Date;
}) {
  const t = useTheme();
  const [w, onLayout] = useWidth();
  const h = 64;
  const pad = 10;
  const x = (hour: number) => pad + (hour / 24) * (w - pad * 2);
  const nowH = now.getHours() + now.getMinutes() / 60;
  // stack dots that collide
  const placed: { cx: number; cy: number; color: string; key: string }[] = [];
  for (const it of [...items].sort((a, b) => a.hour - b.hour)) {
    const cx = x(it.hour);
    let row = 0;
    while (placed.some((p) => Math.abs(p.cx - cx) < 11 && p.cy === 30 - row * 11)) row++;
    placed.push({ cx, cy: 30 - row * 11, color: it.color, key: it.key });
  }
  return (
    <View onLayout={onLayout} style={{ height: h }}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Line x1={pad} x2={w - pad} y1={30} y2={30} stroke={t.lineStrong} strokeWidth={1.5} strokeLinecap="round" />
          <Line
            x1={x(nowH)}
            x2={x(nowH)}
            y1={14}
            y2={40}
            stroke={t.ink}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.5}
          />
          {[0, 6, 12, 18, 24].map((hh) => (
            <G key={hh}>
              <Line x1={x(hh)} x2={x(hh)} y1={34} y2={38} stroke={t.inkFaint} strokeWidth={1.2} />
              <SvgText x={x(hh)} y={54} fontSize={10} fontFamily={font.semibold} fill={t.inkFaint} textAnchor="middle">
                {formatHourCompact(hh % 24)}
              </SvgText>
            </G>
          ))}
          {placed.map((p) => (
            <Circle key={p.key} cx={p.cx} cy={p.cy} r={5} fill={p.color} stroke={t.surface} strokeWidth={1.5} />
          ))}
        </Svg>
      )}
    </View>
  );
}
