import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { FootballTeamLineup } from '../../services/types';
import { htzTokens } from '../htz/tokens';
import { FootballPlayerBadges } from './FootballPlayerBadges';
import { PlayerContribution, computePitchSpots, contributionOf, shortPlayerName } from './helpers';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Líneas del campo (medio campo vertical, portería propia abajo). */
const PitchLines: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const line = 'rgba(255, 255, 255, 0.24)';
  const s = w / 68; // 1 metro en píxeles (el campo mide 68 m de ancho)
  const cx = w / 2;
  const boxW = 40.32 * s; // área grande (40,32 x 16,5 m)
  const boxH = 16.5 * s;
  const goalW = 18.32 * s; // área pequeña (18,32 x 5,5 m)
  const goalH = 5.5 * s;
  const spotY = h - 11 * s; // punto de penalti (11 m)
  const boxTopY = h - boxH;
  const arcR = 9.15 * s;
  const arcDx = Math.sqrt(Math.max(0, arcR * arcR - (boxTopY - spotY) * (boxTopY - spotY)));
  const centerR = 9.15 * s;
  const bandH = h / 7;

  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={w} height={h} rx={10} fill="#1d3b2a" />
      {/* Franjas de siega */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <Rect
          key={`band-${i}`}
          x={0}
          y={i * bandH}
          width={w}
          height={bandH}
          fill={i % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent'}
        />
      ))}
      {/* Perímetro */}
      <Rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} rx={10} stroke={line} strokeWidth={1.5} fill="none" />
      {/* Área grande */}
      <Rect x={(w - boxW) / 2} y={boxTopY} width={boxW} height={boxH + 0.75} stroke={line} strokeWidth={1.5} fill="none" />
      {/* Área pequeña */}
      <Rect x={(w - goalW) / 2} y={h - goalH - 0.75} width={goalW} height={goalH} stroke={line} strokeWidth={1.5} fill="none" />
      {/* Punto de penalti y arco */}
      <Circle cx={cx} cy={spotY} r={Math.max(1.8, 0.35 * s)} fill={line} />
      {arcDx > 0 && (
        <Path
          d={`M ${cx - arcDx} ${boxTopY} A ${arcR} ${arcR} 0 0 1 ${cx + arcDx} ${boxTopY}`}
          stroke={line}
          strokeWidth={1.5}
          fill="none"
        />
      )}
      {/* Línea de medio campo y círculo central */}
      <Line x1={0.75} y1={0.75} x2={w - 0.75} y2={0.75} stroke={line} strokeWidth={1.5} />
      {centerR < h && (
        <Path
          d={`M ${cx - centerR} 0.75 A ${centerR} ${centerR} 0 0 0 ${cx + centerR} 0.75`}
          stroke={line}
          strokeWidth={1.5}
          fill="none"
        />
      )}
    </Svg>
  );
};

export interface FootballPitchProps {
  lineup?: FootballTeamLineup;
  /** Color del aro de las fichas (por defecto el verde de la app). */
  accentColor?: string;
  /** Goles/asistencias/tarjetas por jugador para marcar a los protagonistas. */
  contributions?: Map<string, PlayerContribution>;
}

/**
 * Medio campo vertical con los titulares en su posición: portería propia abajo.
 * Usa las coordenadas reales de la fuente (`verticalLayout` de FotMob) y, si no
 * están publicadas (p. ej. Football-Data), reparte por líneas según la posición.
 */
export const FootballPitch: React.FC<FootballPitchProps> = ({
  lineup,
  accentColor = htzTokens.colors.primary,
  contributions,
}) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pitchRef = useRef<View>(null);
  const spots = useMemo(() => computePitchSpots(lineup), [lineup]);

  const applySize = useCallback((w: number, h: number) => {
    if (!(w > 0) || !(h > 0)) return;
    setSize((prev) =>
      Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }
    );
  }, []);

  // El onLayout de RN Web depende de ResizeObserver y puede no dispararse al
  // montar dentro del modal; se mide también a mano con unos reintentos.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (cancelled) return;
      attempts += 1;
      const retry = () => {
        if (!cancelled && attempts < 15) timer = setTimeout(tick, 150);
      };
      const node: any = pitchRef.current;
      if (!node) {
        retry();
        return;
      }
      if (typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) applySize(rect.width, rect.height);
        else retry();
      } else if (typeof node.measure === 'function') {
        node.measure((_x: number, _y: number, w: number, h: number) => {
          if (w > 0 && h > 0) applySize(w, h);
          else retry();
        });
      }
    };
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [applySize]);

  // Tamaño de las fichas proporcional al campo: en pantallas pequeñas se
  // reducen (y el campo se estira un poco en vertical) para que nombres,
  // valoraciones e insignias no se solapen entre líneas.
  const w = size.w;
  const h = Math.min(Math.max(w / 1.05, 360), 620);
  const scale = clamp(w / 620, 0.7, 1.25);
  const circle = Math.round(30 * scale);
  // El ancho de la ficha se limita también por el ancho del campo para que dos
  // jugadores de la misma línea no se toquen en pantallas estrechas.
  const nameW = Math.round(Math.min(96 * scale, w * 0.23));
  const nameSize = Math.max(8, Math.round(9.5 * scale));
  const nameLine = Math.round(nameSize * 1.15);
  const badgeSize = Math.max(8, Math.round(9 * scale));
  const badgeH = badgeSize + 6;
  const topPad = circle / 2 + 8;
  const bottomPad = circle / 2 + 2 + nameLine + 2 + badgeH + 4;
  const usable = Math.max(80, h - topPad - bottomPad);

  return (
    <View
      ref={pitchRef}
      style={[styles.pitch, { height: h }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        applySize(width, height);
      }}
    >
      {w > 0 && <PitchLines w={w} h={h} />}
      {w > 0 &&
        spots.map((spot, idx) => {
          const p = spot.player;
          const px = clamp(spot.x * w, nameW / 2 + 2, w - nameW / 2 - 2);
          const py = clamp(topPad + spot.y * usable, topPad, h - bottomPad);
          const rating = typeof p.rating === 'number' ? p.rating : null;
          const contribution = contributions ? contributionOf(contributions, p.name) : undefined;
          return (
            <View
              key={`spot-${p.id ?? p.name}-${idx}`}
              style={[styles.marker, { left: px - nameW / 2, top: py - circle / 2, width: nameW }]}
            >
              <View
                style={[
                  styles.markerCircle,
                  { borderColor: accentColor, width: circle, height: circle, borderRadius: circle / 2 },
                ]}
              >
                <Text style={[styles.markerNumber, { fontSize: Math.round(12 * scale) }]}>
                  {p.shirtNumber ?? '–'}
                </Text>
              </View>
              <Text
                style={[styles.markerName, { fontSize: nameSize, lineHeight: nameLine, width: nameW }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {shortPlayerName(p.name)}
              </Text>
              {(contribution || rating != null) && (
                <View style={styles.markerBadges}>
                  <FootballPlayerBadges
                    contribution={contribution}
                    rating={rating}
                    size={badgeSize}
                  />
                </View>
              )}
            </View>
          );
        })}
    </View>
  );
};

const styles = StyleSheet.create({
  pitch: {
    width: '100%',
    marginBottom: 16,
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerCircle: {
    backgroundColor: '#123020',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerNumber: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  markerBadges: {
    marginTop: 2,
  },
  markerName: {
    marginTop: 2,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
