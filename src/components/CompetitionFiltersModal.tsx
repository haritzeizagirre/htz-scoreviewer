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
  SlidersHorizontal,
  CheckCircle2,
  RotateCcw,
  Globe,
  Trophy,
} from 'lucide-react-native';
import { HtzButton, HtzBadge } from './htz';
import { htzTokens } from './htz/tokens';
import { MatchRegion } from '../services/types';

export type TierFilterOption = 'TODOS' | 'TIER_A_PLUS' | 'TIER_S' | 'TIER_A' | 'TIER_B';
export type RegionFilterOption = 'TODOS' | MatchRegion;

export interface TierOptionItem {
  key: TierFilterOption;
  label: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
}

export interface RegionOptionItem {
  key: RegionFilterOption;
  label: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
}

export const TIER_OPTIONS: TierOptionItem[] = [
  {
    key: 'TODOS',
    label: 'Todos los Tiers',
    badge: 'ALL',
    badgeColor: htzTokens.colors.outline,
    badgeBg: htzTokens.colors.surfaceVariant,
    description: 'Muestra todas las competiciones y divisiones sin restricciones',
  },
  {
    key: 'TIER_S',
    label: 'Tier S (Élite)',
    badge: 'S',
    badgeColor: '#ffd700',
    badgeBg: 'rgba(255, 215, 0, 0.15)',
    description: 'Champions, Masters VCT, Worlds LoL, Majors CS2, LaLiga EA Sports',
  },
  {
    key: 'TIER_A_PLUS',
    label: 'Tier A+ o superior',
    badge: 'TOP',
    badgeColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    description: 'Competiciones Élite y Ligas regulares oficiales combinadas',
  },
  {
    key: 'TIER_A',
    label: 'Tier A (Ligas Oficiales)',
    badge: 'A',
    badgeColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    description: 'Ligas de primera división (VCT Challengers, Superliga, etc.)',
  },
  {
    key: 'TIER_B',
    label: 'Tier B (Copas y Clasificatorios)',
    badge: 'B',
    badgeColor: '#94a3b8',
    badgeBg: 'rgba(148, 163, 184, 0.15)',
    description: 'Clasificatorios abiertos, copas secundarias y torneos de cantera',
  },
];

export const REGION_OPTIONS: RegionOptionItem[] = [
  {
    key: 'TODOS',
    label: 'Todas las Regiones',
    badge: 'ALL',
    badgeColor: htzTokens.colors.outline,
    badgeBg: htzTokens.colors.surfaceVariant,
    description: 'Cualquier circuito geográfico o torneo mundial',
  },
  {
    key: 'ESPAÑA',
    label: 'España',
    badge: 'ES',
    badgeColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    description: 'Competiciones y ligas nacionales españolas (Superliga, LaLiga)',
  },
  {
    key: 'GLOBAL',
    label: 'Internacional / Global',
    badge: 'GLO',
    badgeColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    description: 'Torneos mundiales, Champions, Masters e intercontinentales',
  },
  {
    key: 'EMEA',
    label: 'EMEA / Europa',
    badge: 'EU',
    badgeColor: '#818cf8',
    badgeBg: 'rgba(129, 140, 248, 0.15)',
    description: 'Circuito europeo, EMEA y ligas continentales',
  },
  {
    key: 'AMERICAS',
    label: 'Américas',
    badge: 'AME',
    badgeColor: '#f43f5e',
    badgeBg: 'rgba(244, 63, 94, 0.15)',
    description: 'Competiciones de Norteamérica, Brasil y Latinoamérica',
  },
  {
    key: 'ASIA',
    label: 'Asia-Pacífico',
    badge: 'ASIA',
    badgeColor: '#a855f7',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    description: 'Competiciones oficiales de Corea (LCK), China y Asia-Pacífico',
  },
];

export function getTierShortLabel(tier: TierFilterOption): string {
  switch (tier) {
    case 'TIER_S':
      return 'Tier S';
    case 'TIER_A_PLUS':
      return 'Tier A+';
    case 'TIER_A':
      return 'Tier A';
    case 'TIER_B':
      return 'Tier B';
    default:
      return 'Todos';
  }
}

export function getRegionShortLabel(region: RegionFilterOption): string {
  switch (region) {
    case 'ESPAÑA':
      return 'España';
    case 'GLOBAL':
      return 'Global';
    case 'EMEA':
      return 'EMEA';
    case 'AMERICAS':
      return 'Américas';
    case 'ASIA':
      return 'Asia';
    default:
      return 'Todas';
  }
}

interface CompetitionFiltersModalProps {
  visible: boolean;
  onClose: () => void;
  tierFilter: TierFilterOption;
  onSelectTier: (tier: TierFilterOption) => void;
  regionFilter: RegionFilterOption;
  onSelectRegion: (region: RegionFilterOption) => void;
  onResetFilters: () => void;
}

export const CompetitionFiltersModal: React.FC<CompetitionFiltersModalProps> = ({
  visible,
  onClose,
  tierFilter,
  onSelectTier,
  regionFilter,
  onSelectRegion,
  onResetFilters,
}) => {
  const hasActiveFilters =
    tierFilter !== 'TODOS' || regionFilter !== 'TODOS';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <SlidersHorizontal size={18} color={htzTokens.colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Filtros de Competición</Text>
                <Text style={styles.headerSubtitle}>
                  {hasActiveFilters
                    ? 'Filtros personalizados activos'
                    : 'Personaliza el nivel y la región de los partidos'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {hasActiveFilters && (
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={onResetFilters}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={13} color={htzTokens.colors.primary} />
                  <Text style={styles.resetText}>Limpiar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={htzTokens.colors.outline} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body Content */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Section 0: Tier de Torneo */}
            <View style={styles.sectionHeaderRow}>
              <Trophy size={15} color={htzTokens.colors.primary} />
              <Text style={styles.sectionTitle}>Nivel de Torneo (Tier)</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Selecciona el rango de relevancia o división de la competición
            </Text>

            <View style={styles.optionsList}>
              {TIER_OPTIONS.map((item) => {
                const isSelected = tierFilter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => onSelectTier(item.key)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.badgeBox,
                        {
                          backgroundColor: item.badgeBg,
                          borderColor: item.badgeColor,
                        },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: item.badgeColor }]}>
                        {item.badge}
                      </Text>
                    </View>

                    <View style={styles.optionInfo}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {item.description}
                      </Text>
                    </View>

                    <View style={styles.checkCol}>
                      {isSelected ? (
                        <CheckCircle2 size={18} color={htzTokens.colors.primary} />
                      ) : (
                        <View style={styles.radioPlaceholder} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Section 1: Región Geográfica */}
            <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
              <Globe size={15} color={htzTokens.colors.primary} />
              <Text style={styles.sectionTitle}>Región / Circuito</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Filtra los eventos según su ámbito territorial o liga continental
            </Text>

            <View style={styles.optionsList}>
              {REGION_OPTIONS.map((item) => {
                const isSelected = regionFilter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                    ]}
                    onPress={() => onSelectRegion(item.key)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.badgeBox,
                        {
                          backgroundColor: item.badgeBg,
                          borderColor: item.badgeColor,
                        },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: item.badgeColor }]}>
                        {item.badge}
                      </Text>
                    </View>

                    <View style={styles.optionInfo}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {item.description}
                      </Text>
                    </View>

                    <View style={styles.checkCol}>
                      {isSelected ? (
                        <CheckCircle2 size={18} color={htzTokens.colors.primary} />
                      ) : (
                        <View style={styles.radioPlaceholder} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <HtzButton variant="primary" size="md" onPress={onClose} style={{ flex: 1 }}>
              Aplicar Filtros
            </HtzButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: htzTokens.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: htzTokens.colors.outlineVariant,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outlineVariant,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: htzTokens.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: htzTokens.colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 12,
    color: htzTokens.colors.outline,
    marginTop: 1,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.35)',
  },
  resetText: {
    fontSize: 12,
    fontWeight: '600',
    color: htzTokens.colors.primary,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: htzTokens.colors.onSurface,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: htzTokens.colors.outline,
    marginBottom: 12,
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: htzTokens.colors.surfaceVariant,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: 'rgba(74, 124, 89, 0.12)',
    borderColor: htzTokens.colors.primary,
  },
  badgeBox: {
    minWidth: 38,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  optionInfo: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: htzTokens.colors.onSurface,
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: htzTokens.colors.primary,
    fontWeight: '700',
  },
  optionDescription: {
    fontSize: 11,
    color: htzTokens.colors.outline,
    lineHeight: 15,
  },
  checkCol: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: htzTokens.colors.outlineVariant,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: htzTokens.colors.outlineVariant,
  },
});
