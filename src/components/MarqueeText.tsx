import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

interface MarqueeTextProps {
  text: string;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Pausa inicial antes de empezar a desplazar (ms). */
  delayMs?: number;
  /** Pausa al llegar a cada extremo (ms). */
  gapMs?: number;
  /** Velocidad de desplazamiento en píxeles por segundo. */
  speed?: number;
}

// En web react-native no soporta el driver nativo de animaciones.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Texto de una sola línea que se desplaza (ida y vuelta) únicamente cuando no
 * cabe en el ancho disponible. Si cabe, se muestra estático.
 *
 * Se apoya en un ScrollView horizontal deshabilitado (y sin recepción de toques)
 * como medidor: así se conoce el ancho real del texto aunque supere el contenedor.
 */
export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  textStyle,
  containerStyle,
  delayMs = 1400,
  gapMs = 900,
  speed = 35,
}) => {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  // Animated.Value estable durante toda la vida del componente.
  const [translateX] = useState(() => new Animated.Value(0));

  const distance = Math.max(0, contentWidth - viewportWidth);
  const shouldScroll = viewportWidth > 0 && contentWidth > viewportWidth + 1;

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    if (!shouldScroll) return;

    const duration = Math.max(2000, (distance / speed) * 1000);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(translateX, {
          toValue: -distance,
          duration,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(gapMs),
        Animated.timing(translateX, {
          toValue: 0,
          duration,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(gapMs),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shouldScroll, distance, delayMs, gapMs, speed, text, translateX]);

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={(e: LayoutChangeEvent) => setViewportWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        scrollEnabled={false}
        pointerEvents="none"
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={(w: number) => setContentWidth(w)}
      >
        <Animated.View style={{ transform: [{ translateX }] }}>
          <Text style={textStyle} numberOfLines={1}>
            {text}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  scroll: {
    flexGrow: 0,
    width: '100%',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
