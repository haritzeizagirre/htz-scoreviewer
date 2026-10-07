import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { htzTokens } from './tokens';
import { GameLogo } from '../GameLogo';

export interface HtzSportChipProps {
  /** 'TODOS' o el nombre del deporte/juego (FÚTBOL, VALORANT, LOL, CS2, R6, DOTA2...). */
  id: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * Chip de selección de deporte o juego con el estilo unificado de la app
 * (el mismo que en Torneos): fondo neutro con borde fino y, al seleccionar,
 * verde sage con texto blanco. Incluye el icono del deporte a la izquierda.
 */
export const HtzSportChip: React.FC<HtzSportChipProps> = ({
  id,
  label,
  selected,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {id === 'TODOS' ? (
        <Trophy size={13} color={selected ? '#FFFFFF' : htzTokens.colors.outline} />
      ) : (
        <GameLogo game={id} size={14} />
      )}
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: htzTokens.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  chipSelected: {
    backgroundColor: htzTokens.colors.primary,
    borderColor: htzTokens.colors.primary,
  },
  text: {
    color: htzTokens.colors.outline,
    fontSize: 11,
    fontWeight: '700',
  },
  textSelected: {
    color: '#FFFFFF',
  },
});
