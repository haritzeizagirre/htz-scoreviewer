import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Watch,
  Copy,
  CheckCircle2,
  Sliders,
  QrCode,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react-native';
import { Gtr3ConfigState } from '../services/types';
import { Gtr3SyncService } from '../services/gtr3SyncService';
import {
  HtzCard,
  HtzToggle,
  HtzButton,
  HtzTabs,
  HtzBadge,
} from './htz';
import { htzTokens } from './htz/tokens';

interface WatchCompanionViewProps {
  config: Gtr3ConfigState;
  onUpdateConfig: (newConfig: Gtr3ConfigState) => void;
}

export const WatchCompanionView: React.FC<WatchCompanionViewProps> = ({
  config,
  onUpdateConfig,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'guide' | 'preview'>('config');
  const [copied, setCopied] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const steps = Gtr3SyncService.getInstallationSteps();

  const handleToggleGame = (gameKey: string) => {
    const updated = {
      ...config,
      enabledGames: {
        ...config.enabledGames,
        [gameKey]: !config.enabledGames[gameKey],
      },
    };
    onUpdateConfig(updated);
  };

  const handleCopyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    Alert.alert(
      'Configuración Lista para GTR 3',
      'El código ha sido preparado. Puedes copiarlo o guardarlo para tu archivo score-tracker-gtr3/app-side/config.js.'
    );
  };

  const codeContent = Gtr3SyncService.generateConfigFileContent(config);

  const watchTabs = [
    {
      id: 'config',
      label: 'Ajustes Reloj',
      icon: (
        <Sliders
          size={15}
          color={activeSubTab === 'config' ? htzTokens.colors.primary : htzTokens.colors.outline}
        />
      ),
    },
    {
      id: 'guide',
      label: 'Instalar en Reloj',
      icon: (
        <QrCode
          size={15}
          color={activeSubTab === 'guide' ? htzTokens.colors.primary : htzTokens.colors.outline}
        />
      ),
    },
    {
      id: 'preview',
      label: 'Ver config.js',
      icon: (
        <FileCode
          size={15}
          color={activeSubTab === 'preview' ? htzTokens.colors.primary : htzTokens.colors.outline}
        />
      ),
    },
  ];

  const sportsList = [
    { key: 'football', label: 'Fútbol (LaLiga, Champions, etc.)' },
    { key: 'valorant', label: 'Valorant (VCT, Masters)' },
    { key: 'lol', label: 'League of Legends (LEC, Worlds)' },
    { key: 'r6', label: 'Rainbow Six Siege (Majors)' },
    { key: 'cs2', label: 'Counter-Strike 2' },
    { key: 'dota2', label: 'Dota 2' },
    { key: 'rocket_league', label: 'Rocket League' },
  ];

  return (
    <View style={styles.container}>
      {/* Sub Navigation Bar using HtzTabs */}
      <View style={styles.subNavBarWrapper}>
        <HtzTabs
          tabs={watchTabs}
          activeTab={activeSubTab}
          onChange={(id) => setActiveSubTab(id as 'config' | 'guide' | 'preview')}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* TAB 1: CONFIGURACIÓN DEL RELOJ */}
        {activeSubTab === 'config' && (
          <View>
            <HtzCard style={styles.bannerCard}>
              <View style={styles.bannerRow}>
                <Watch size={30} color={htzTokens.colors.primary} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.bannerTitle}>Amazfit GTR 3 (Zepp OS 1.0)</Text>
                  <Text style={styles.bannerDesc}>
                    Configura tus deportes, equipos y opciones sin necesidad de editar código manualmente.
                  </Text>
                </View>
              </View>
            </HtzCard>

            {/* Deportes Activos */}
            <Text style={styles.sectionHeader}>Deportes Activos en el Reloj</Text>
            <HtzCard style={styles.cardContainer}>
              {sportsList.map((item, idx) => (
                <View
                  key={item.key}
                  style={[
                    styles.toggleRow,
                    idx < sportsList.length - 1 && styles.rowDivider,
                  ]}
                >
                  <HtzToggle
                    label={item.label}
                    checked={!!config.enabledGames[item.key]}
                    onChange={() => handleToggleGame(item.key)}
                  />
                </View>
              ))}
            </HtzCard>

            {/* Opciones Avanzadas del Reloj */}
            <Text style={styles.sectionHeader}>Opciones de Pantalla AMOLED</Text>
            <HtzCard style={styles.cardContainer}>
              <View style={[styles.toggleRow, styles.rowDivider]}>
                <HtzToggle
                  label="Mostrar Próximos Partidos"
                  sublabel="Muestra partidos de hoy si no hay en directo"
                  checked={config.showUpcoming}
                  onChange={(val) => onUpdateConfig({ ...config, showUpcoming: val })}
                />
              </View>

              <View style={[styles.toggleRow, styles.rowDivider]}>
                <HtzToggle
                  label="Resultados Recientes (24h)"
                  sublabel="Solo de tus equipos favoritos"
                  checked={config.showFavoriteRecentResults}
                  onChange={(val) =>
                    onUpdateConfig({ ...config, showFavoriteRecentResults: val })
                  }
                />
              </View>

              <View style={styles.toggleRow}>
                <HtzToggle
                  label="Mostrar Escudos de Equipos"
                  sublabel="Si se desactiva, activa el modo minimalista solo texto"
                  checked={config.showTeamLogos}
                  onChange={(val) => onUpdateConfig({ ...config, showTeamLogos: val })}
                />
              </View>
            </HtzCard>

            {/* Botón Acción Sincronizar */}
            <HtzButton
              variant="primary"
              size="lg"
              icon={
                copied ? (
                  <CheckCircle2 size={18} color="#FFFFFF" />
                ) : (
                  <Copy size={18} color="#FFFFFF" />
                )
              }
              onPress={handleCopyCode}
              style={styles.syncBtn}
            >
              {copied ? '¡Configuración Actualizada!' : 'Generar y Actualizar config.js'}
            </HtzButton>
          </View>
        )}

        {/* TAB 2: GUÍA DE INSTALACIÓN EN EL RELOJ */}
        {activeSubTab === 'guide' && (
          <View>
            <Text style={styles.guideTitle}>Cómo instalar la Mini-App en tu Amazfit GTR 3</Text>
            <Text style={styles.guideSubtitle}>
              Sigue estos 4 sencillos pasos para enviar la aplicación a tu reloj por Bluetooth:
            </Text>

            <View style={styles.stepsList}>
              {steps.map((st) => {
                const isExpanded = expandedStep === st.step;
                return (
                  <HtzCard
                    key={st.step}
                    style={styles.stepCard}
                    onPress={() => setExpandedStep(isExpanded ? null : st.step)}
                  >
                    <View style={styles.stepHeader}>
                      <HtzBadge
                        variant="primary"
                        label={String(st.step)}
                        style={styles.stepBadge}
                      />
                      <Text style={styles.stepTitle}>{st.title}</Text>
                      {isExpanded ? (
                        <ChevronUp size={18} color={htzTokens.colors.outline} />
                      ) : (
                        <ChevronDown size={18} color={htzTokens.colors.outline} />
                      )}
                    </View>

                    {isExpanded && (
                      <View style={styles.stepBody}>
                        <Text style={styles.stepDesc}>{st.desc}</Text>
                        {st.tip && (
                          <View style={styles.tipBox}>
                            <Sparkles size={14} color={htzTokens.colors.primary} />
                            <Text style={styles.tipText}>{st.tip}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </HtzCard>
                );
              })}
            </View>
          </View>
        )}

        {/* TAB 3: VISOR DE CONFIG.JS */}
        {activeSubTab === 'preview' && (
          <View>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Código Autogenerado para Zepp OS</Text>
              <HtzButton
                variant="outline"
                size="sm"
                icon={<Copy size={14} color={htzTokens.colors.primary} />}
                onPress={handleCopyCode}
              >
                {copied ? 'Copiado' : 'Copiar'}
              </HtzButton>
            </View>
            <TextInput
              style={styles.codeBox}
              value={codeContent}
              editable={false}
              multiline
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subNavBarWrapper: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outline,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bannerCard: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.35)',
    backgroundColor: htzTokens.colors.surfaceVariant,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerDesc: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHeader: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },
  cardContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  toggleRow: {
    paddingVertical: 2,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.outline,
  },
  syncBtn: {
    marginTop: 8,
  },
  guideTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  guideSubtitle: {
    color: htzTokens.colors.outline,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  stepsList: {
    gap: 12,
  },
  stepCard: {
    marginBottom: 8,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  stepBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: htzTokens.colors.outline,
  },
  stepDesc: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    gap: 6,
  },
  tipText: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  codeBox: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    color: '#86efac',
    borderRadius: 12,
    padding: 14,
    height: 380,
    fontSize: 11,
    fontFamily: 'monospace',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: htzTokens.colors.outline,
  },
});
