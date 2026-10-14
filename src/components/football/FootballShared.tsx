import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { MatchTeam } from '../../services/types';
import { htzTokens } from '../htz/tokens';

/** Aro/carga compartidos por las páginas del partido de fútbol. */
export const FootballLoading: React.FC<{ label?: string }> = ({
  label = 'Consultando datos del partido...',
}) => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="small" color={htzTokens.colors.primary} />
    <Text style={styles.loadingText}>{label}</Text>
  </View>
);

/** Escudo del equipo; si la fuente no trae logo, cae a las siglas. */
export const TeamCrest: React.FC<{ team: MatchTeam; size?: number }> = ({ team, size = 22 }) => {
  if (team.logo) {
    return (
      <Image source={{ uri: team.logo }} style={{ width: size, height: size }} resizeMode="contain" />
    );
  }
  return (
    <View
      style={[
        styles.crestFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.crestFallbackText, { fontSize: size * 0.36 }]} numberOfLines={1}>
        {(team.shortName || team.name || '?').slice(0, 3).toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  loadingText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  crestFallback: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestFallbackText: {
    color: htzTokens.colors.onSurface,
    fontWeight: '800',
  },
});
