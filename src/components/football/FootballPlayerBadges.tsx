import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Footprints } from 'lucide-react-native';
import { GameLogo } from '../GameLogo';
import { PlayerContribution, ratingColor } from './helpers';

interface FootballPlayerBadgesProps {
  /** Goles, asistencias y tarjetas del jugador (puede venir vacío). */
  contribution?: PlayerContribution;
  /** Valoración (0-10); se pinta como primera píldora, si está publicada. */
  rating?: number | null;
  /** Tamaño base de los iconos (por defecto 10). */
  size?: number;
}

/**
 * Insignias de aportación de un jugador: valoración, balón (gol), botas
 * (asistencia) y tarjetas amarilla/roja. Con más de un gol o asistencia se
 * añade el número. Se usa sobre el campo y en la lista de suplentes.
 */
export const FootballPlayerBadges: React.FC<FootballPlayerBadgesProps> = ({
  contribution,
  rating,
  size = 10,
}) => {
  const { goals, assists, yellow, red } = contribution || {
    goals: 0,
    assists: 0,
    yellow: 0,
    red: 0,
  };
  const hasRating = typeof rating === 'number';
  if (!hasRating && goals === 0 && assists === 0 && yellow === 0 && red === 0) return null;

  const label = [
    hasRating ? `valoración ${rating.toFixed(1)}` : null,
    goals > 0 ? `${goals} ${goals === 1 ? 'gol' : 'goles'}` : null,
    assists > 0 ? `${assists} ${assists === 1 ? 'asistencia' : 'asistencias'}` : null,
    yellow > 0 ? 'tarjeta amarilla' : null,
    red > 0 ? 'tarjeta roja' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const countStyle = { fontSize: Math.max(8, size * 0.85) };
  const cardW = Math.max(5, Math.round(size * 0.62));
  const cardH = Math.max(8, Math.round(size));

  return (
    <View style={styles.row} accessibilityLabel={label}>
      {hasRating && (
        <View style={[styles.pill, styles.ratingPill, { backgroundColor: ratingColor(rating) }]}>
          <Text style={[styles.ratingText, { fontSize: Math.max(8, size * 0.9) }]}>
            {rating.toFixed(1)}
          </Text>
        </View>
      )}
      {goals > 0 && (
        <View style={styles.pill}>
          <GameLogo game="FÚTBOL" size={size} />
          {goals > 1 && <Text style={[styles.count, countStyle]}>{goals}</Text>}
        </View>
      )}
      {assists > 0 && (
        <View style={styles.pill}>
          <Footprints size={size} color="#7DD3FC" />
          {assists > 1 && <Text style={[styles.count, countStyle]}>{assists}</Text>}
        </View>
      )}
      {yellow > 0 && (
        <View style={[styles.card, { width: cardW, height: cardH }, styles.yellow]} />
      )}
      {red > 0 && <View style={[styles.card, { width: cardW, height: cardH }, styles.red]} />}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  ratingPill: {
    borderColor: 'rgba(0, 0, 0, 0.35)',
    minWidth: 22,
    justifyContent: 'center',
  },
  ratingText: {
    color: '#0F1A12',
    fontWeight: '900',
  },
  count: {
    color: '#FFFFFF',
    fontWeight: '900',
    lineHeight: 11,
  },
  card: {
    borderRadius: 1.5,
  },
  yellow: {
    backgroundColor: '#FBBF24',
  },
  red: {
    backgroundColor: '#EF4444',
  },
});
