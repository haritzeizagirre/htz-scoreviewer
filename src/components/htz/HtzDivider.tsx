import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { htzTokens } from './tokens';

export interface HtzDividerProps {
  text?: string;
  style?: StyleProp<ViewStyle>;
}

export const HtzDivider: React.FC<HtzDividerProps> = ({ text, style }) => {
  if (text) {
    return (
      <View style={[styles.wrapper, style]}>
        <View style={styles.line} />
        <Text style={styles.text}>{text}</Text>
        <View style={styles.line} />
      </View>
    );
  }
  return <View style={[styles.line, styles.standalone, style]} />;
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: htzTokens.colors.surfaceVariant,
  },
  standalone: {
    marginVertical: 14,
  },
  text: {
    paddingHorizontal: 10,
    fontSize: 11,
    fontWeight: '700',
    color: htzTokens.colors.outline,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
