import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Match, MatchPreviewData, TeamFormEntry } from '../services/types';
import { ScoreService } from '../services/scoreService';
import { HtzCard } from './htz';
import { htzTokens } from './htz/tokens';

interface MatchPreviewSectionProps {
  match: Match;
  pandaToken?: string;
  footballToken?: string;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const RESULT_LETTER: Record<TeamFormEntry['result'], string> = { W: 'V', L: 'D', D: 'E' };
const RESULT_WORD: Record<TeamFormEntry['result'], string> = {
  W: 'Victoria',
  L: 'Derrota',
  D: 'Empate',
};

/** Una fila de forma reciente: nombre del equipo + chips V/E/D. */
const FormRow: React.FC<{ teamName: string; entries: TeamFormEntry[] }> = ({ teamName, entries }) => (
  <View style={styles.formRow}>
    <Text style={styles.formTeam} numberOfLines={1}>
      {teamName}
    </Text>
    <View style={styles.formChips}>
      {entries.length === 0 ? (
        <Text style={styles.formEmpty}>Sin datos</Text>
      ) : (
        entries.map((e, i) => (
          <View
            key={`${e.dateIso}-${i}`}
            style={[
              styles.formChip,
              e.result === 'W' ? styles.chipW : e.result === 'L' ? styles.chipL : styles.chipD,
            ]}
            accessibilityLabel={`${RESULT_WORD[e.result]} ${e.scoreFor}-${e.scoreAgainst} contra ${
              e.opponentName
            }${e.league ? ` (${e.league})` : ''}`}
          >
            <Text
              style={[
                styles.formChipText,
                e.result === 'W'
                  ? styles.chipTextW
                  : e.result === 'L'
                  ? styles.chipTextL
                  : styles.chipTextD,
              ]}
            >
              {RESULT_LETTER[e.result]}
            </Text>
          </View>
        ))
      )}
    </View>
  </View>
);

/**
 * Previa de un partido: forma reciente de ambos equipos y cara a cara.
 * Se muestra solo cuando hay fuente aplicable (ids de equipo + token):
 * PandaScore para esports, Football-Data para fútbol. Se monta con
 * key={match.id} para reiniciar la consulta en cada partido.
 */
export const MatchPreviewSection: React.FC<MatchPreviewSectionProps> = ({
  match,
  pandaToken,
  footballToken,
}) => {
  const canLoad =
    match.teamA?.id != null &&
    match.teamB?.id != null &&
    (match.game === 'FÚTBOL' ? Boolean(footballToken?.trim()) : Boolean(pandaToken?.trim()));

  // loading arranca en true: el componente se remonta por partido, así el efecto
  // no necesita hacer setState síncrono al empezar.
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MatchPreviewData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canLoad) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await ScoreService.fetchMatchPreview(match, { pandaToken, footballToken });
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [match, pandaToken, footballToken, canLoad]);

  const retry = () => {
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const res = await ScoreService.fetchMatchPreview(match, { pandaToken, footballToken });
        setData(res);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  };

  if (!canLoad) return null;

  const hasData = Boolean(
    data && (data.formA.length > 0 || data.formB.length > 0 || data.h2h.length > 0)
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionHeader}>Previa</Text>
      <HtzCard style={styles.card}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={htzTokens.colors.primary} />
            <Text style={styles.loadingText}>Consultando forma y cara a cara…</Text>
          </View>
        ) : failed ? (
          <TouchableOpacity
            onPress={retry}
            style={styles.retryRow}
            accessibilityRole="button"
            accessibilityLabel="Reintentar la consulta de la previa"
          >
            <Text style={styles.retryText}>
              No se pudo consultar la previa. Toca para reintentar.
            </Text>
          </TouchableOpacity>
        ) : !hasData ? (
          <Text style={styles.emptyText}>Sin enfrentamientos anteriores registrados.</Text>
        ) : (
          <>
            <Text style={styles.blockTitle}>Forma reciente (últimos 5)</Text>
            <FormRow teamName={match.teamA.shortName || match.teamA.name} entries={data!.formA} />
            <FormRow teamName={match.teamB.shortName || match.teamB.name} entries={data!.formB} />

            {data!.h2h.length > 0 && (
              <>
                <Text style={[styles.blockTitle, styles.blockTitleSpaced]}>Cara a cara</Text>
                {data!.h2h.map((h, i) => (
                  <View
                    key={`h2h-${i}`}
                    style={[styles.h2hRow, i === data!.h2h.length - 1 && styles.h2hRowLast]}
                    accessibilityLabel={`${formatShortDate(h.dateIso)}: ${h.teamA} ${h.scoreA} - ${h.scoreB} ${h.teamB}`}
                  >
                    <Text style={styles.h2hDate}>{formatShortDate(h.dateIso)}</Text>
                    <Text style={styles.h2hTeams} numberOfLines={1}>
                      {h.teamA} vs {h.teamB}
                    </Text>
                    <Text style={styles.h2hScore}>
                      {h.scoreA} - {h.scoreB}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </HtzCard>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
  },
  sectionHeader: {
    color: htzTokens.colors.onSurface,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  card: {
    padding: 14,
    gap: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
  },
  retryRow: {
    paddingVertical: 8,
  },
  retryText: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    paddingVertical: 4,
  },
  blockTitle: {
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  blockTitleSpaced: {
    marginTop: 14,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  formTeam: {
    width: 64,
    color: htzTokens.colors.onSurface,
    fontSize: 11,
    fontWeight: '700',
  },
  formChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  formEmpty: {
    color: htzTokens.colors.outline,
    fontSize: 11,
  },
  formChip: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipW: {
    backgroundColor: 'rgba(74, 222, 128, 0.16)',
    borderColor: 'rgba(74, 222, 128, 0.5)',
  },
  chipL: {
    backgroundColor: 'rgba(248, 113, 113, 0.14)',
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
  chipD: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  formChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  chipTextW: {
    color: '#4ADE80',
  },
  chipTextL: {
    color: '#F87171',
  },
  chipTextD: {
    color: '#9CA3AF',
  },
  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  h2hRowLast: {
    borderBottomWidth: 0,
  },
  h2hDate: {
    width: 52,
    color: htzTokens.colors.outline,
    fontSize: 10,
    fontWeight: '600',
  },
  h2hTeams: {
    flex: 1,
    color: htzTokens.colors.onSurfaceVariant,
    fontSize: 12,
  },
  h2hScore: {
    color: htzTokens.colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
  },
});
