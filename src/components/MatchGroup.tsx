import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star, Globe } from 'lucide-react-native';
import { Match, MatchRegion, SportCategory } from '../services/types';
import { MatchRow } from './MatchRow';
import { GameLogo } from './GameLogo';
import { MarqueeText } from './MarqueeText';
import { HtzCard, htzTokens } from './htz';

function getRegionBadge(region?: MatchRegion): string | null {
  switch (region) {
    case 'GLOBAL':
      return 'GLO';
    case 'EMEA':
      return 'EU';
    case 'ESPAÑA':
      return 'ES';
    case 'AMERICAS':
      return 'AME';
    case 'ASIA':
      return 'ASIA';
    default:
      return null;
  }
}

interface MatchGroupProps {
  /** Partidos del mismo torneo (o de la sección de favoritos), en orden de visualización. */
  matches: Match[];
  onSelectMatch: (match: Match) => void;
  onSelectTournament?: (leagueName: string, game?: SportCategory) => void;
  /**
   * 'tournament' (por defecto): cabecera con los datos de la competición.
   * 'favorites': sección especial de partidos de equipos favoritos.
   */
  variant?: 'tournament' | 'favorites';
}

/**
 * Tarjeta única de un grupo: una cabecera y, debajo, sus partidos como filas
 * compactas separadas por líneas (sin una tarjeta por partido).
 */
export const MatchGroup: React.FC<MatchGroupProps> = ({
  matches,
  onSelectMatch,
  onSelectTournament,
  variant = 'tournament',
}) => {
  if (matches.length === 0) return null;

  const sample = matches[0];
  const isFavorites = variant === 'favorites';

  const handleSelectTournament = () => {
    if (!onSelectTournament) return;
    const fullLeagueStr = sample.details?.tournamentStage
      ? `${sample.league} • ${sample.details.tournamentStage}`
      : sample.league;
    onSelectTournament(fullLeagueStr, sample.game);
  };

  return (
    <HtzCard elevated style={styles.group}>
      {/* Cabecera del grupo */}
      <View style={styles.header}>
        {isFavorites ? (
          <>
            <Star size={16} color="#FBBF24" fill="#FBBF24" style={styles.headerStar} />
            <Text style={styles.favTitle} numberOfLines={1}>
              Equipos favoritos
            </Text>
          </>
        ) : (
          <>
            <View style={styles.gameLogoBadge}>
              <GameLogo game={sample.game} size={14} />
            </View>

            {sample.tier && (
              <View
                style={[
                  styles.tierBadge,
                  sample.tier === 'S'
                    ? styles.tierBadgeS
                    : sample.tier === 'A'
                    ? styles.tierBadgeA
                    : styles.tierBadgeOther,
                ]}
              >
                <Text
                  style={[
                    styles.tierBadgeText,
                    sample.tier === 'S'
                      ? styles.tierTextS
                      : sample.tier === 'A'
                      ? styles.tierTextA
                      : styles.tierTextOther,
                  ]}
                >
                  {sample.tier}
                </Text>
              </View>
            )}

            {sample.region && (
              <View style={styles.regionBadge}>
                {sample.region === 'GLOBAL' ? (
                  <Globe size={11} color={htzTokens.colors.onSurfaceVariant} />
                ) : (
                  <Text style={styles.regionBadgeText}>{getRegionBadge(sample.region)}</Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.leagueNameWrapper}
              disabled={!onSelectTournament}
              onPress={handleSelectTournament}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MarqueeText
                text={sample.league}
                textStyle={styles.leagueName}
                containerStyle={styles.leagueNameWrapper}
              />
            </TouchableOpacity>

            {sample.isFavTournament && (
              <Star size={13} color="#FBBF24" fill="#FBBF24" style={styles.favStar} />
            )}
          </>
        )}

        <View style={styles.countBadge}>
          <Text style={styles.countText}>{matches.length}</Text>
        </View>
      </View>

      {/* Partidos del grupo como filas compactas */}
      <View>
        {matches.map((m, i) => (
          <MatchRow
            key={m.id}
            match={m}
            isLast={i === matches.length - 1}
            showGame={isFavorites}
            onPress={() => onSelectMatch(m)}
          />
        ))}
      </View>
    </HtzCard>
  );
};

const styles = StyleSheet.create({
  group: {
    marginBottom: 14,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.surfaceVariant,
  },
  headerStar: {
    marginRight: 7,
    flexShrink: 0,
  },
  favTitle: {
    flex: 1,
    minWidth: 0,
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  gameLogoBadge: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    flexShrink: 0,
  },
  tierBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tierBadgeS: {
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderColor: 'rgba(251, 191, 36, 0.55)',
  },
  tierBadgeA: {
    backgroundColor: 'rgba(74, 124, 89, 0.22)',
    borderColor: 'rgba(74, 124, 89, 0.5)',
  },
  tierBadgeOther: {
    backgroundColor: 'rgba(115, 115, 115, 0.15)',
    borderColor: 'rgba(115, 115, 115, 0.35)',
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tierTextS: {
    color: '#FBBF24',
  },
  tierTextA: {
    color: htzTokens.colors.inversePrimary,
  },
  tierTextOther: {
    color: htzTokens.colors.outline,
  },
  regionBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  regionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: htzTokens.colors.onSurfaceVariant,
    letterSpacing: 0.2,
  },
  leagueNameWrapper: {
    flex: 1,
    minWidth: 0,
  },
  leagueName: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  favStar: {
    marginLeft: 6,
    flexShrink: 0,
  },
  countBadge: {
    marginLeft: 6,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: htzTokens.colors.onSurfaceVariant,
  },
});
