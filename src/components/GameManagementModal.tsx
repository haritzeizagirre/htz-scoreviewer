import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  X,
  Gamepad2,
  CheckCircle2,
  Sliders,
  Sparkles,
  ShieldAlert,
} from 'lucide-react-native';
import { HtzCard, HtzToggle, HtzButton, HtzChip } from './htz';
import { htzTokens } from './htz/tokens';
import { MarqueeText } from './MarqueeText';
import { SportCategory } from '../services/types';
import { GameLogo } from './GameLogo';

export interface GameOptionItem {
  key: string;
  sport: SportCategory;
  name: string;
  description: string;
}

export const GAME_OPTIONS: GameOptionItem[] = [
  {
    key: 'football',
    sport: 'FÚTBOL',
    name: 'Fútbol',
    description: 'LaLiga EA Sports, Champions League, Premier, etc.',
  },
  {
    key: 'valorant',
    sport: 'VALORANT',
    name: 'Valorant',
    description: 'VCT Champions, Masters, EMEA, Americas, etc.',
  },
  {
    key: 'lol',
    sport: 'LOL',
    name: 'League of Legends',
    description: 'LEC, Worlds, MSI, Superliga LVP, LCK, LPL',
  },
  {
    key: 'cs2',
    sport: 'CS2',
    name: 'Counter-Strike 2',
    description: 'Majors Valve, BLAST Premier, ESL Pro League, IEM',
  },
  {
    key: 'r6',
    sport: 'R6',
    name: 'Rainbow Six Siege',
    description: 'Six Invitational, Six Major, Europe League',
  },
  {
    key: 'dota2',
    sport: 'DOTA2',
    name: 'Dota 2',
    description: 'The International, Riyadh Masters / EWC',
  },
];

interface GameManagementModalProps {
  visible: boolean;
  onClose: () => void;
  enabledGames: Record<string, boolean>;
  onToggleGame: (gameKey: string) => void;
  onSetPreset: (preset: 'all' | 'esports' | 'football') => void;
}

export const GameManagementModal: React.FC<GameManagementModalProps> = ({
  visible,
  onClose,
  enabledGames,
  onToggleGame,
  onSetPreset,
}) => {
  const enabledCount = GAME_OPTIONS.filter((g) => enabledGames[g.key] !== false).length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <Gamepad2 size={18} color={htzTokens.colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Deportes y Juegos en la App</Text>
                <Text style={styles.headerSubtitle}>
                  {enabledCount} de {GAME_OPTIONS.length} activos
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <X size={20} color={htzTokens.colors.outline} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Presets rápidos */}
            <View style={styles.presetsRow}>
              <HtzChip
                label="Todos"
                selected={enabledCount === GAME_OPTIONS.length}
                onPress={() => onSetPreset('all')}
              />
              <HtzChip
                label="Solo Esports"
                selected={enabledCount === 5 && !enabledGames.football}
                onPress={() => onSetPreset('esports')}
              />
              <HtzChip
                label="Solo Fútbol"
                selected={enabledCount === 1 && !!enabledGames.football}
                onPress={() => onSetPreset('football')}
              />
            </View>

            {/* Listado de Juegos */}
            <HtzCard style={styles.card}>
              {GAME_OPTIONS.map((item, idx) => {
                const isEnabled = enabledGames[item.key] !== false;
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.gameRow,
                      idx < GAME_OPTIONS.length - 1 && styles.rowDivider,
                    ]}
                  >
                    <View style={styles.gameInfo}>
                      <View style={styles.gameIconContainer}>
                        <GameLogo game={item.sport} size={18} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                        <Text style={[styles.gameName, !isEnabled && styles.gameNameDisabled]}>
                          {item.name}
                        </Text>
                        <MarqueeText text={item.description} textStyle={styles.gameDesc} />
                      </View>
                    </View>
                    <HtzToggle
                      checked={isEnabled}
                      onChange={() => onToggleGame(item.key)}
                    />
                  </View>
                );
              })}
            </HtzCard>

            <View style={styles.noticeBox}>
              <Sparkles size={14} color={htzTokens.colors.primary} />
              <Text style={styles.noticeText}>
                Los deportes desactivados se ocultarán automáticamente de la lista de partidos, de los filtros y del catálogo de torneos.
              </Text>
            </View>

            <View style={{ height: 16 }} />

            {/* Botón Aplicar */}
            <HtzButton
              variant="primary"
              size="md"
              icon={<CheckCircle2 size={16} color="#FFFFFF" />}
              onPress={onClose}
            >
              Aplicar y Guardar
            </HtzButton>

            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: htzTokens.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: htzTokens.colors.surfaceVariant,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.surfaceVariant,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 124, 89, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: htzTokens.colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 12,
    color: htzTokens.colors.outline,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  card: {
    backgroundColor: htzTokens.colors.background,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: htzTokens.colors.surfaceVariant,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.surfaceVariant,
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  gameIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1E232B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameName: {
    fontSize: 14,
    fontWeight: '700',
    color: htzTokens.colors.onSurface,
  },
  gameNameDisabled: {
    color: htzTokens.colors.outline,
  },
  gameDesc: {
    fontSize: 11,
    color: htzTokens.colors.outline,
    marginTop: 2,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(74, 124, 89, 0.12)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.25)',
  },
  noticeText: {
    fontSize: 11,
    color: htzTokens.colors.onSurfaceVariant,
    flex: 1,
    lineHeight: 15,
  },
});
