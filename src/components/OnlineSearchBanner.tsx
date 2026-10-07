import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { htzTokens } from './htz/tokens';

/** Estado de la última búsqueda online: sin tokens, sin resultados o con resultados. */
export type OnlineSearchStatus = 'idle' | 'no-token' | 'empty' | 'results';

interface OnlineSearchBannerProps {
  query: string;
  searching: boolean;
  status: OnlineSearchStatus;
  count: number;
  onPress: () => void;
}

/**
 * Banner compartido "¿No lo encuentras? Buscar en APIs online" con su mensaje de
 * estado. Se usa tanto en Explorar como en Torneos para que la búsqueda online
 * se comporte igual en ambas pestañas.
 */
export const OnlineSearchBanner: React.FC<OnlineSearchBannerProps> = ({
  query,
  searching,
  status,
  count,
  onPress,
}) => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.banner}
        onPress={onPress}
        disabled={searching}
        activeOpacity={0.8}
      >
        {searching ? (
          <ActivityIndicator size="small" color={htzTokens.colors.primary} />
        ) : (
          <Sparkles size={16} color={htzTokens.colors.primary} />
        )}
        <Text style={styles.bannerText}>
          {searching
            ? 'Buscando en APIs oficiales...'
            : `¿No lo encuentras? Buscar "${trimmed}" en APIs online`}
        </Text>
      </TouchableOpacity>

      {!searching && status !== 'idle' && (
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            {status === 'no-token'
              ? 'Configura tus tokens en la pestaña APIs para buscar en línea.'
              : status === 'empty'
              ? `Sin resultados en línea para "${trimmed}".`
              : `${count} resultado${count === 1 ? '' : 's'} en línea añadido${count === 1 ? '' : 's'} a la lista.`}
          </Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(74, 124, 89, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.35)',
    marginBottom: 12,
  },
  bannerText: {
    color: htzTokens.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  statusRow: {
    paddingHorizontal: 4,
    marginTop: -4,
    marginBottom: 12,
  },
  statusText: {
    color: htzTokens.colors.outline,
    fontSize: 12,
    textAlign: 'center',
  },
});
