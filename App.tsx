import React from 'react';
import { BackHandler, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ScoreViewerApp } from './src/ScoreViewerApp';
import { AppStorage } from './src/storage/appStorage';
import { htzTokens } from './src/components/htz';

/**
 * Score Viewer Pro — app independiente.
 *
 * Ya no vive dentro del Hub: no recibe `appId` ni `onExitToHub` inyectados.
 * El storage es propio de la app (AsyncStorage con prefijo de Score Viewer) y el
 * botón de "volver" cierra la app en lugar de regresar al Hub.
 */
export default function App() {
  const handleExit = () => {
    BackHandler.exitApp();
  };

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={htzTokens.colors.background}
      />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: htzTokens.colors.background }}
        edges={['top', 'bottom']}
      >
        <ScoreViewerApp onExitToHub={handleExit} storage={AppStorage} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
