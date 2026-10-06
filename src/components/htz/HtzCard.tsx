import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { htzTokens } from './tokens';

export interface HtzCardProps {
  elevated?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const HtzCard: React.FC<HtzCardProps> = ({
  elevated = false,
  onPress,
  children,
  style,
}) => {
  const cardStyles: StyleProp<ViewStyle>[] = [
    styles.card,
    elevated ? styles.elevated : styles.flat,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} style={cardStyles} onPress={onPress}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
};

export const HtzCardTitle: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}> = ({ children, style }) => {
  return <Text style={[styles.title, style]}>{children}</Text>;
};

export const HtzCardBody: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  return <View style={[styles.body, style]}>{children}</View>;
};

export const HtzCardAction: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  return <View style={[styles.action, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: htzTokens.colors.surface,
    borderRadius: htzTokens.radius.lg,
    borderWidth: 1,
    borderColor: htzTokens.colors.surfaceVariant,
    padding: htzTokens.spacing.md,
    overflow: 'hidden',
  },
  flat: {
    backgroundColor: htzTokens.colors.surface,
  },
  elevated: {
    backgroundColor: htzTokens.colors.surfaceContainer,
    ...htzTokens.elevation.card,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: htzTokens.colors.onSurface,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  body: {
    marginVertical: 4,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: htzTokens.colors.surfaceVariant,
  },
});
