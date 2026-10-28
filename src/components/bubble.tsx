import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Stop } from 'react-native-svg';

import { font } from '@/theme';
import { alpha, type Swatch } from '@/theme/palette';
import { Icon } from './icon';
import { Text } from './text';

export type BubbleProps = {
  size: number;
  swatch: Swatch;
  emoji?: string;
  name?: string;
  count?: number | string;
  /**
   * Times of today's events as fractional hours (0–24). Drawn as dots on the
   * bubble's rim, which doubles as a 24-hour clock face (midnight at the top) —
   * so the home screen answers both "how many" and "when" at a glance.
   */
  dots?: number[];
  /** current time as a fractional hour, drawn as a faint clock hand */
  nowHour?: number;
  dimCount?: boolean;
};

/** Pure visual. Interactivity lives in TapBubble. */
export function Bubble({ size, swatch, emoji, name, count, dots, nowHour, dimCount }: BubbleProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = size / 2;
  const showDial = dots !== undefined && size >= 84;
  const dialR = r - Math.max(7, size * 0.055);
  const dotR = Math.max(2.1, size * 0.017);
  const ink = swatch.ink;

  // stack dots that land on (almost) the same minute so they stay visible
  const placed: { x: number; y: number }[] = [];
  if (showDial && dots) {
    const sorted = [...dots].sort((a, b) => a - b);
    let lastAngle = -999;
    let stack = 0;
    for (const h of sorted) {
      const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
      stack = Math.abs(a - lastAngle) < (dotR * 2.2) / dialR ? stack + 1 : 0;
      lastAngle = a;
      const rr = dialR - stack * dotR * 2.3;
      placed.push({ x: r + Math.cos(a) * rr, y: r + Math.sin(a) * rr });
    }
  }

  const emojiSize = size * (name ? 0.17 : 0.3);
  const countSize = size * 0.28;
  const nameSize = Math.max(12, size * 0.09);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: swatch.base,
          shadowColor: swatch.deep,
          shadowOpacity: 0.38,
          shadowRadius: size * 0.09,
          shadowOffset: { width: 0, height: size * 0.06 },
        },
      ]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`g${id}`} cx="36%" cy="30%" rx="78%" ry="78%" fx="34%" fy="26%">
            <Stop offset="0" stopColor={swatch.light} />
            <Stop offset="0.5" stopColor={swatch.base} />
            <Stop offset="1" stopColor={swatch.deep} />
          </RadialGradient>
          <RadialGradient id={`h${id}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#g${id})`} />
        {/* soft specular highlight */}
        <Ellipse
          cx={r * 0.68}
          cy={r * 0.52}
          rx={r * 0.36}
          ry={r * 0.22}
          fill={`url(#h${id})`}
          transform={`rotate(-28 ${r * 0.68} ${r * 0.52})`}
        />
        {showDial && (
          <>
            <Circle cx={r} cy={r} r={dialR} stroke={alpha(ink, 0.12)} strokeWidth={1} fill="none" />
            {[0, 6, 12, 18].map((h) => {
              const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
              return (
                <Line
                  key={h}
                  x1={r + Math.cos(a) * (dialR - 3)}
                  y1={r + Math.sin(a) * (dialR - 3)}
                  x2={r + Math.cos(a) * (dialR + 3)}
                  y2={r + Math.sin(a) * (dialR + 3)}
                  stroke={alpha(ink, 0.28)}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                />
              );
            })}
            {nowHour !== undefined &&
              (() => {
                const a = (nowHour / 24) * Math.PI * 2 - Math.PI / 2;
                return (
                  <Line
                    x1={r + Math.cos(a) * (dialR - 7)}
                    y1={r + Math.sin(a) * (dialR - 7)}
                    x2={r + Math.cos(a) * (dialR + 4)}
                    y2={r + Math.sin(a) * (dialR + 4)}
                    stroke={alpha(ink, 0.45)}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                );
              })()}
            {placed.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={dotR} fill={alpha(ink, 0.82)} />
            ))}
          </>
        )}
      </Svg>

      <View style={styles.content} pointerEvents="none">
        {!!emoji && <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.18 }}>{emoji}</Text>}
        {count !== undefined && (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              maxWidth: size * 0.72,
              textAlign: 'center',
              fontFamily: font.display,
              fontSize: countSize,
              lineHeight: countSize * 1.18,
              color: ink,
              opacity: dimCount ? 0.38 : 1,
              marginTop: -size * 0.02,
            }}>
            {count}
          </Text>
        )}
        {!!name && (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: font.bold,
              fontSize: nameSize,
              color: ink,
              opacity: 0.9,
              maxWidth: size * 0.74,
              textAlign: 'center',
            }}>
            {name}
          </Text>
        )}
      </View>
    </View>
  );
}

/** The dashed "+" bubble. */
export function AddBubble({ size, color, label }: { size: number; color: string; label?: string }) {
  const r = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={r}
          cy={r}
          r={r - 1.5}
          stroke={alpha(color, 0.6)}
          strokeWidth={2}
          strokeDasharray={[6, 6]}
          strokeLinecap="round"
          fill={alpha(color, 0.06)}
        />
      </Svg>
      <Icon name="plus" size={size * (label ? 0.3 : 0.36)} color={color} strokeWidth={2.4} />
      {!!label && (
        <Text
          style={{
            fontFamily: font.bold,
            fontSize: Math.max(13, size * 0.11),
            lineHeight: Math.max(17, size * 0.14),
            color,
            marginTop: 2,
            textAlign: 'center',
            maxWidth: size * 0.72,
          }}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', justifyContent: 'center' },
});
