import React from 'react';
import { Modal, View, StyleSheet, SafeAreaView } from 'react-native';
import { TournamentItem } from '../services/types';
import { TournamentDetailView } from './TournamentDetailView';
import { htzTokens } from './htz/tokens';

interface TournamentDetailModalProps {
  tournament: TournamentItem | null;
  visible: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (tournament: TournamentItem | string) => void;
  pandaToken?: string;
  footballToken?: string;
  favoriteTeams?: string[];
}

export const TournamentDetailModal: React.FC<TournamentDetailModalProps> = ({
  tournament,
  visible,
  onClose,
  isFavorite,
  onToggleFavorite,
  pandaToken,
  footballToken,
  favoriteTeams = [],
}) => {
  if (!tournament) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <TournamentDetailView
            tournament={tournament}
            onBack={onClose}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            pandaToken={pandaToken}
            footballToken={footballToken}
            favoriteTeams={favoriteTeams}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: htzTokens.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: htzTokens.colors.background,
  },
});
