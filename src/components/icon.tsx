import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'plus'
  | 'chart'
  | 'back'
  | 'close'
  | 'pencil'
  | 'sparkle'
  | 'send'
  | 'trash'
  | 'clock'
  | 'pin'
  | 'check'
  | 'sliders'
  | 'share'
  | 'undo'
  | 'chevron'
  | 'cloud'
  | 'cloudOff'
  | 'minus'
  | 'sun'
  | 'moon'
  | 'phone'
  | 'list'
  | 'bubbles'
  | 'gear';

type Props = { name: IconName; size?: number; color: string; strokeWidth?: number };

/** A tiny hand-drawn icon set (24×24, round strokes) so the look stays consistent everywhere. */
export function Icon({ name, size = 22, color, strokeWidth = 1.9 }: Props) {
  const s = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...s} />}
      {name === 'chart' && <Path d="M5 20v-8M12 20V5M19 20v-5" {...s} />}
      {name === 'back' && <Path d="M15 5l-7 7 7 7" {...s} />}
      {name === 'chevron' && <Path d="M9 5l7 7-7 7" {...s} />}
      {name === 'close' && <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...s} />}
      {name === 'pencil' && <Path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4zM13.5 6.5l4 4" {...s} />}
      {name === 'sparkle' && (
        <Path
          d="M12 3.5l1.7 5.1a1.5 1.5 0 001 1l5.1 1.7-5.1 1.7a1.5 1.5 0 00-1 1L12 19.1l-1.7-5.1a1.5 1.5 0 00-1-1L4.2 11.3l5.1-1.7a1.5 1.5 0 001-1z"
          fill={color}
        />
      )}
      {name === 'send' && <Path d="M12 19V5M6 11l6-6 6 6" {...s} />}
      {name === 'trash' && <Path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" {...s} />}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...s} />
          <Path d="M12 7.5V12l3 2" {...s} />
        </>
      )}
      {name === 'pin' && (
        <>
          <Path d="M12 21s-6.5-5.6-6.5-11.2a6.5 6.5 0 0113 0C18.5 15.4 12 21 12 21z" {...s} />
          <Circle cx={12} cy={9.8} r={2.2} {...s} />
        </>
      )}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7" {...s} />}
      {name === 'sliders' && (
        <>
          <Path d="M4 7h9M19 7h1M4 17h3M13 17h7" {...s} />
          <Circle cx={16} cy={7} r={2.4} {...s} />
          <Circle cx={10} cy={17} r={2.4} {...s} />
        </>
      )}
      {name === 'share' && <Path d="M12 3.5v11M7.5 8L12 3.5 16.5 8M5 13v6.5h14V13" {...s} />}
      {name === 'undo' && <Path d="M9 14L4.5 9.5 9 5M4.5 9.5H14a5.5 5.5 0 010 11h-3" {...s} />}
      {name === 'minus' && <Path d="M5 12h14" {...s} />}
      {name === 'sun' && (
        <>
          <Circle cx={12} cy={12} r={4} {...s} />
          <Path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
            {...s}
          />
        </>
      )}
      {name === 'moon' && <Path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" {...s} />}
      {name === 'phone' && (
        <>
          <Path
            d="M8 2.8h8a1.8 1.8 0 011.8 1.8v14.8a1.8 1.8 0 01-1.8 1.8H8a1.8 1.8 0 01-1.8-1.8V4.6A1.8 1.8 0 018 2.8z"
            {...s}
          />
          <Path d="M10.5 18h3" {...s} />
        </>
      )}
      {name === 'list' && <Path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" {...s} />}
      {name === 'bubbles' && (
        <>
          <Circle cx={9} cy={10} r={5.5} {...s} />
          <Circle cx={17} cy={16.5} r={3.5} {...s} />
          <Circle cx={17.5} cy={5.5} r={2} {...s} />
        </>
      )}
      {name === 'gear' && (
        <>
          <Circle cx={12} cy={12} r={3} {...s} />
          <Path
            d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
            {...s}
          />
        </>
      )}
      {name === 'cloud' && <Path d="M7 18.5h10a4 4 0 00.6-7.95A5.5 5.5 0 006.8 9.6 4.5 4.5 0 007 18.5z" {...s} />}
      {name === 'cloudOff' && (
        <Path
          d="M7 18.5h10a4 4 0 001.9-.48M20.6 15A4 4 0 0017.6 10.55 5.5 5.5 0 009.3 6.2M6.8 9.6A4.5 4.5 0 007 18.5M3.5 3.5l17 17"
          {...s}
        />
      )}
    </Svg>
  );
}

export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}
