import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { htzTokens } from './tokens';
import { MarqueeText } from '../MarqueeText';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface HtzTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  style?: StyleProp<ViewStyle>;
  scrollable?: boolean;
  /** Los botones llenan todo el rectángulo contenedor (sin padding, gap ni bordes redondeados) */
  fill?: boolean;
}

export const HtzTabs: React.FC<HtzTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  style,
  scrollable = false,
  fill = false,
}) => {
  const content = tabs.map((tab) => {
    const isActive = tab.id === activeTab;
    return (
      <TouchableOpacity
        key={tab.id}
        activeOpacity={0.8}
        style={[
          styles.tab,
          scrollable && styles.scrollableTab,
          fill && styles.fillTab,
        ]}
        onPress={() => onChange(tab.id)}
      >
        {/* Fondo del tab activo montado ya opaco (nunca cambia de color): evita
            el bug de Android que pierde el borderRadius al pasar de fondo
            transparente a opaco (react-native#52415). */}
        {isActive && (
          <View style={[styles.activeTabBg, fill && styles.activeTabBgFill]} />
        )}
        {tab.icon && (
          <View style={styles.iconWrapper}>
            {tab.icon}
          </View>
        )}
        {scrollable ? (
          <Text
            style={[
              styles.label,
              isActive && styles.activeLabel,
              styles.scrollableLabel,
            ]}
            numberOfLines={1}
          >
            {tab.label}
          </Text>
        ) : (
          <MarqueeText
            text={tab.label}
            textStyle={[styles.label, isActive && styles.activeLabel]}
            containerStyle={styles.labelMarquee}
            align="center"
          />
        )}
      </TouchableOpacity>
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.scrollableContainer, style]}
        contentContainerStyle={styles.scrollableContent}
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, fill && styles.fillContainer, style]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: htzTokens.colors.surfaceContainerLowest,
    padding: 3,
    borderRadius: htzTokens.radius.md,
    gap: 3,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: htzTokens.radius.default,
    gap: 5,
  },
  activeTabBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: htzTokens.radius.default,
    backgroundColor: htzTokens.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  activeTabBgFill: {
    borderRadius: 0,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: htzTokens.colors.outline,
    textAlign: 'center',
  },
  labelMarquee: {
    flexShrink: 1,
    minWidth: 0,
  },
  activeLabel: {
    color: htzTokens.colors.onPrimary,
    fontWeight: '700',
  },
  scrollableContainer: {
    backgroundColor: htzTokens.colors.surfaceContainerLowest,
    borderRadius: htzTokens.radius.md,
  },
  scrollableContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    gap: 4,
  },
  scrollableTab: {
    flex: 0,
    minWidth: 'auto',
    paddingHorizontal: 12,
  },
  scrollableLabel: {
    flexShrink: 0,
  },
  fillContainer: {
    padding: 0,
    gap: 0,
    borderRadius: 0,
  },
  fillTab: {
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
});
