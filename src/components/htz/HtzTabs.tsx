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
          isActive && styles.activeTab,
        ]}
        onPress={() => onChange(tab.id)}
      >
        {tab.icon && (
          <View style={styles.iconWrapper}>
            {tab.icon}
          </View>
        )}
        <Text
          style={[
            styles.label,
            isActive && styles.activeLabel,
            scrollable && styles.scrollableLabel,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
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
  activeTab: {
    backgroundColor: htzTokens.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
    flexShrink: 1,
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
