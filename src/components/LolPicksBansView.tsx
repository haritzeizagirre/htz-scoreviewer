import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { ExternalLink, Shield, RefreshCw, AlertTriangle, Clock, Ban, Sparkles } from 'lucide-react-native';
import { LolTeamGame, LolPick } from '../services/types';
import { LolScraperService, LolMatchResult } from '../services/lolScraperService';
import { MarqueeText } from './MarqueeText';
import { HtzChip, HtzButton } from './htz';
import { htzTokens } from './htz/tokens';

interface LolPicksBansViewProps {
  teamAName: string;
  teamBName: string;
  startTimeIso?: string;
  leagueName?: string;
}

export const LolPicksBansView: React.FC<LolPicksBansViewProps> = ({
  teamAName,
  teamBName,
  startTimeIso,
  leagueName,
}) => {
  const requestKey = `${teamAName}|${teamBName}|${startTimeIso || ''}|${leagueName || ''}`;

  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [loaded, setLoaded] = useState<{
    sig: string;
    requestKey: string;
    result: LolMatchResult;
  } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  const sig = `${requestKey}|${reloadNonce}`;
  const pending = !loaded || loaded.sig !== sig;
  const result = loaded && loaded.requestKey === requestKey ? loaded.result : null;
  const data = result && result.reason === 'ok' ? result.data : null;
  const showSpinner = pending && !data;

  useEffect(() => {
    let mounted = true;
    const effectSig = sig;

    LolScraperService.getMatchData(teamAName, teamBName, startTimeIso, leagueName)
      .then((res) => {
        if (!mounted) return;
        setLoaded({ sig: effectSig, requestKey, result: res });
      })
      .catch((err) => {
        console.warn('Error loading LoL stats (gol.gg):', err);
        if (!mounted) return;
        setLoaded({ sig: effectSig, requestKey, result: { data: null, reason: 'error' } });
      });

    return () => {
      mounted = false;
    };
  }, [teamAName, teamBName, startTimeIso, leagueName, requestKey, reloadNonce, sig]);

  const retry = () => {
    setDiagnostic(null);
    LolScraperService.clearCache(teamAName, teamBName, startTimeIso);
    setReloadNonce((n) => n + 1);
  };

  const runDiagnostic = async () => {
    setDiagnostic('Consultando gol.gg...');
    const text = await LolScraperService.diagnose(teamAName, teamBName, startTimeIso, leagueName);
    setDiagnostic(text);
  };

  const onIconFail = (url: string) => setFailedIcons((prev) => ({ ...prev, [url]: true }));

  // 1. Cargando
  if (showSpinner) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={htzTokens.colors.primary} />
        <Text style={styles.loadingText}>Consultando picks, bans y K/D/A en gol.gg...</Text>
      </View>
    );
  }

  // 2. Sin datos
  if (!data || data.games.length === 0) {
    const reason = result?.reason;
    const info =
      reason === 'timeout'
        ? {
            Icon: Clock,
            title: 'La consulta tardó demasiado',
            subtitle: 'gol.gg no respondió a tiempo. Comprueba tu red y reintenta.',
          }
        : reason === 'error'
        ? {
            Icon: AlertTriangle,
            title: 'No se pudo consultar gol.gg',
            subtitle: 'Hubo un problema al obtener los datos. Vuelve a intentarlo en unos segundos.',
          }
        : {
            Icon: Shield,
            title: 'Picks y bans no disponibles',
            subtitle:
              'No se encontró este partido en gol.gg. Puede ser un partido aún sin jugar, una liga no cubierta, o que el nombre del torneo no coincida.',
          };

    const { Icon } = info;
    return (
      <View style={styles.emptyContainer}>
        <Icon size={36} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>{info.title}</Text>
        <Text style={styles.emptySubtitle}>{info.subtitle}</Text>
        <Text style={styles.reasonText}>detalle: {reason || 'sin datos'}</Text>
        <View style={styles.emptyButtons}>
          <HtzButton
            variant="primary"
            size="sm"
            icon={<RefreshCw size={14} color={htzTokens.colors.onPrimary} />}
            onPress={retry}
          >
            Reintentar
          </HtzButton>
          <HtzButton
            variant="secondary"
            size="sm"
            icon={<ExternalLink size={14} color={htzTokens.colors.onSurface} />}
            onPress={() =>
              Linking.openURL(
                `https://gol.gg/esports/home/`
              )
            }
          >
            Abrir gol.gg
          </HtzButton>
          <HtzButton
            variant="ghost"
            size="sm"
            icon={<AlertTriangle size={14} color={htzTokens.colors.outline} />}
            onPress={runDiagnostic}
          >
            Diagnóstico
          </HtzButton>
        </View>
        {diagnostic ? (
          <View style={styles.diagBox}>
            <Text style={styles.diagText}>{diagnostic}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // 3. Datos
  // Si la fuente aún no ha publicado los campeones (habitual en partidos en directo
  // o recién terminados), mostrar un aviso claro en lugar de una tabla vacía/rota.
  const hasAnyPicks = data.games.some(
    (g) => g.teamA.picks.length > 0 || g.teamB.picks.length > 0
  );
  if (!hasAnyPicks) {
    return (
      <View style={styles.emptyContainer}>
        <Shield size={36} color={htzTokens.colors.outline} />
        <Text style={styles.emptyTitle}>Picks y bans no disponibles</Text>
        <Text style={styles.emptySubtitle}>
          La fuente (gol.gg) todavía no ha publicado los campeones de este partido. Es
          habitual en encuentros en directo o recién terminados; vuelve a intentarlo en
          unos minutos.
        </Text>
        <View style={styles.emptyButtons}>
          <HtzButton
            variant="primary"
            size="sm"
            icon={<RefreshCw size={14} color={htzTokens.colors.onPrimary} />}
            onPress={retry}
          >
            Reintentar
          </HtzButton>
          <HtzButton
            variant="secondary"
            size="sm"
            icon={<ExternalLink size={14} color={htzTokens.colors.onSurface} />}
            onPress={() => Linking.openURL('https://gol.gg/esports/home/')}
          >
            Abrir gol.gg
          </HtzButton>
        </View>
      </View>
    );
  }

  const safeIndex = Math.min(selectedGameIndex, data.games.length - 1);
  const currentGame = data.games[safeIndex] || data.games[0];
  const hasKda = [...currentGame.teamA.picks, ...currentGame.teamB.picks].some(
    (p) => p.kills !== undefined
  );

  return (
    <View style={styles.container}>
      {/* Resultado + torneo */}
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreTeams} numberOfLines={2}>
          {teamAName}
          <Text style={styles.scoreNums}>
            {'  '}
            {data.scoreA ?? '-'} - {data.scoreB ?? '-'}
          </Text>
          {'  '}
          {teamBName}
        </Text>
        {data.tournament ? (
          <MarqueeText
            text={data.tournament}
            textStyle={styles.tournamentText}
            align="center"
          />
        ) : null}
      </View>

      {/* Selector de game */}
      {data.games.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.gamesScroll}
          contentContainerStyle={styles.gamesScrollContent}
        >
          {data.games.map((g, idx) => (
            <HtzChip
              key={idx}
              label={`Game ${g.gameNumber}`}
              selected={safeIndex === idx}
              onPress={() => setSelectedGameIndex(idx)}
            />
          ))}
        </ScrollView>
      )}

      {/* Info del game */}
      <View style={styles.gameMetaRow}>
        <Sparkles size={11} color={htzTokens.colors.outline} />
        <Text style={styles.gameMetaText}>
          {currentGame.patch ? `Patch ${currentGame.patch}` : ''}
          {currentGame.patch && currentGame.gameLength ? ' · ' : ''}
          {currentGame.gameLength ? `Duración ${currentGame.gameLength}` : ''}
          {!hasKda ? ' · (K/D/A no disponible)' : ''}
        </Text>
      </View>

      {/* Bloques de equipo */}
      <TeamGameBlock
        team={currentGame.teamA}
        failedIcons={failedIcons}
        onIconFail={onIconFail}
      />
      <View style={{ height: 16 }} />
      <TeamGameBlock
        team={currentGame.teamB}
        failedIcons={failedIcons}
        onIconFail={onIconFail}
      />
    </View>
  );
};

const ChampImage: React.FC<{
  pick: LolPick;
  size: number;
  failedIcons: Record<string, boolean>;
  onIconFail: (url: string) => void;
}> = ({ pick, size, failedIcons, onIconFail }) => {
  const url = pick.championIconUrl;
  const radius = size / 2;
  if (url && !failedIcons[url]) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#333' }}
        onError={() => onIconFail(url)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFF', fontSize: Math.max(8, size * 0.34), fontWeight: '700' }}>
        {pick.champion.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
};

const TeamGameBlock: React.FC<{
  team: LolTeamGame;
  failedIcons: Record<string, boolean>;
  onIconFail: (url: string) => void;
}> = ({ team, failedIcons, onIconFail }) => (
  <View style={styles.teamSection}>
    <View style={styles.teamHeaderRow}>
      <MarqueeText
        text={team.teamName}
        textStyle={styles.teamTitle}
        containerStyle={styles.teamTitleMarquee}
      />
      {team.kills || team.gold ? (
        <Text style={styles.teamStats}>
          {team.kills ? `${team.kills} kills` : ''}
          {team.kills && team.gold ? ' · ' : ''}
          {team.gold ? `${team.gold} oro` : ''}
        </Text>
      ) : null}
      {team.won ? (
        <View style={styles.winBadge}>
          <Text style={styles.winBadgeText}>WIN</Text>
        </View>
      ) : null}
    </View>

    {/* Picks */}
    {team.picks.map((p, idx) => (
      <View
        key={idx}
        style={[
          styles.pickRow,
          idx % 2 === 1 && styles.pickRowAlt,
          idx === team.picks.length - 1 && team.bans.length === 0 && styles.pickRowLast,
        ]}
      >
        <ChampImage pick={p} size={30} failedIcons={failedIcons} onIconFail={onIconFail} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <MarqueeText text={p.playerName || '-'} textStyle={styles.playerName} />
          <MarqueeText
            text={`${p.champion}${p.cs ? ` · ${p.cs} CS` : ''}`}
            textStyle={styles.champName}
          />
        </View>
        {p.kills !== undefined ? (
          <Text style={styles.kdaText}>
            {p.kills} <Text style={styles.kdaSlash}>/</Text> {p.deaths}{' '}
            <Text style={styles.kdaSlash}>/</Text> {p.assists}
          </Text>
        ) : null}
      </View>
    ))}

    {/* Bans */}
    {team.bans.length > 0 && (
      <View style={styles.bansRow}>
        <Ban size={11} color={htzTokens.colors.outline} />
        <View style={styles.bansIcons}>
          {team.bans.map((b, i) => (
            <View key={i} style={styles.banIconWrap}>
              <ChampImage pick={b} size={22} failedIcons={failedIcons} onIconFail={onIconFail} />
            </View>
          ))}
        </View>
        <Text style={styles.bansLabel}>BANS</Text>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36 },
  loadingText: { color: htzTokens.colors.outline, fontSize: 12, marginTop: 10, textAlign: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyTitle: {
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: { color: htzTokens.colors.outline, fontSize: 12, textAlign: 'center', lineHeight: 16 },
  reasonText: { color: htzTokens.colors.outline, fontSize: 10, marginTop: 10, opacity: 0.7 },
  emptyButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  diagBox: {
    marginTop: 14,
    alignSelf: 'stretch',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  diagText: { color: htzTokens.colors.outline, fontSize: 10, lineHeight: 15 },
  scoreHeader: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  scoreTeams: { color: htzTokens.colors.onSurface, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  scoreNums: { color: htzTokens.colors.primary, fontWeight: '800' },
  tournamentText: { color: htzTokens.colors.outline, fontSize: 11, textAlign: 'center', marginTop: 3 },
  gamesScroll: { marginBottom: 12 },
  gamesScrollContent: { gap: 8 },
  gameMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  gameMetaText: { color: htzTokens.colors.outline, fontSize: 11 },
  teamSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    overflow: 'hidden',
  },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#222222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    gap: 8,
  },
  teamTitle: { color: htzTokens.colors.onSurface, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  teamTitleMarquee: { flex: 1, minWidth: 0 },
  teamStats: { color: htzTokens.colors.outline, fontSize: 10, fontWeight: '600' },
  winBadge: { backgroundColor: '#0C5A29', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  winBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
    gap: 10,
  },
  pickRowAlt: { backgroundColor: '#1C1C1C' },
  pickRowLast: { borderBottomWidth: 0 },
  playerName: { color: htzTokens.colors.onSurface, fontSize: 12, fontWeight: '700' },
  champName: { color: htzTokens.colors.outline, fontSize: 10, fontWeight: '600', marginTop: 1 },
  kdaText: { color: htzTokens.colors.onSurface, fontSize: 12, fontWeight: '700' },
  kdaSlash: { color: htzTokens.colors.outline, fontWeight: '400' },
  bansRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#161616',
  },
  bansLabel: { color: htzTokens.colors.outline, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  bansIcons: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, flexWrap: 'wrap' },
  banIconWrap: { opacity: 0.9 },
});

export default LolPicksBansView;
