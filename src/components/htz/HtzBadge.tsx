import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { htzTokens } from './tokens';

export type HtzBadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error';

export interface HtzBadgeProps {
  label?: string;
  variant?: HtzBadgeVariant;
  dot?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const HtzBadge: React.FC<HtzBadgeProps> = ({
  label,
  variant = 'primary',
  dot = false,
  icon,
  children,
  style,
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primary;
      case 'secondary':
        return styles.secondary;
      case 'success':
        return styles.success;
      case 'warning':
        return styles.warning;
      case 'error':
        return styles.error;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'success':
        return styles.successText;
      case 'warning':
        return styles.warningText;
      case 'error':
        return styles.errorText;
    }
  };

  return (
    <View style={[styles.base, getBadgeStyle(), style]}>
      {dot && <View style={[styles.dot, { backgroundColor: getTextStyle().color }]} />}
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      {typeof (children || label) === 'string' ? (
        <Text style={[styles.text, getTextStyle()]}>{children || label}</Text>
      ) : (
        children || label
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: htzTokens.radius.sm,
    gap: 4,
  },
  primary: {
    backgroundColor: htzTokens.colors.primary,
  },
  primaryText: {
    color: '#ffffff',
  },
  secondary: {
    backgroundColor: htzTokens.colors.surfaceVariant,
  },
  secondaryText: {
    color: htzTokens.colors.onSurface,
  },
  success: {
    backgroundColor: 'rgba(74, 124, 89, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 89, 0.4)',
  },
  successText: {
    color: '#a2cfae',
  },
  warning: {
    backgroundColor: 'rgba(229, 169, 61, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(229, 169, 61, 0.5)',
  },
  warningText: {
    color: htzTokens.colors.warning,
  },
  error: {
    backgroundColor: 'rgba(255, 180, 171, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 171, 0.4)',
  },
  errorText: {
    color: htzTokens.colors.error,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
