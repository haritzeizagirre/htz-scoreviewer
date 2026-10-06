import React, { useState } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { GameLogo } from './GameLogo';
import { SportCategory, TournamentTier } from '../services/types';
import { htzTokens } from './htz/tokens';
import { Trophy } from 'lucide-react-native';

interface TournamentLogoProps {
  logo?: string;
  game: SportCategory | string;
  tier?: TournamentTier | string;
  size?: number;
  name?: string;
  style?: StyleProp<ViewStyle>;
}

export const TournamentLogo: React.FC<TournamentLogoProps> = ({
  logo,
  game,
  tier,
  size = 40,
  name,
  style,
}) => {
  const [hasError, setHasError] = useState(false);
  const cleanGame = (game || '').toString().toUpperCase().trim();

  // Si hay logo y no ha dado error de carga
  if (logo && !hasError && !logo.includes('seeklogo.com')) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Image
          source={{ uri: logo }}
          style={{ width: size, height: size, borderRadius: size * 0.2 }}
          resizeMode="contain"
          onError={() => setHasError(true)}
        />
      </View>
    );
  }

  // Paleta temática según el juego para el emblema institucional
  let bgColor = 'rgba(255, 255, 255, 0.06)';
  let borderColor = 'rgba(255, 255, 255, 0.12)';

  if (cleanGame === 'VALORANT') {
    bgColor = 'rgba(255, 70, 85, 0.15)';
    borderColor = 'rgba(255, 70, 85, 0.4)';
  } else if (cleanGame === 'LOL') {
    bgColor = 'rgba(200, 155, 60, 0.15)';
    borderColor = 'rgba(200, 155, 60, 0.4)';
  } else if (cleanGame === 'CS2') {
    bgColor = 'rgba(255, 153, 0, 0.15)';
    borderColor = 'rgba(255, 153, 0, 0.4)';
  } else if (cleanGame === 'R6') {
    bgColor = 'rgba(0, 212, 255, 0.15)';
    borderColor = 'rgba(0, 212, 255, 0.4)';
  } else if (cleanGame === 'DOTA2') {
    bgColor = 'rgba(231, 57, 36, 0.15)';
    borderColor = 'rgba(231, 57, 36, 0.4)';
  } else if (cleanGame === 'FÚTBOL' || cleanGame === 'FOOTBALL') {
    bgColor = 'rgba(16, 185, 129, 0.15)';
    borderColor = 'rgba(16, 185, 129, 0.4)';
  }

  const iconSize = Math.round(size * 0.55);

  return (
    <View
      style={[
        styles.fallbackBox,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: bgColor,
          borderColor: borderColor,
        },
        style,
      ]}
    >
      <GameLogo game={cleanGame} size={iconSize} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
  },
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
