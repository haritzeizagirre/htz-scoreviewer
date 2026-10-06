import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { htzTokens } from './tokens';

export type HtzChipVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'error';

export interface HtzChipProps {
  label: string;
  variant?: HtzChipVariant;
  selected?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  onPress?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const HtzChip: React.FC<HtzChipProps> = ({
  label,
  variant = 'primary',
  selected = false,
  removable = false,
  onRemove,
  onPress,
  icon,
  style,
}) => {
  const getChipStyle = () => {
    if (selected) return styles.selected;
    switch (variant) {
      case 'primary':
        return styles.primary;
      case 'secondary':
        return styles.secondary;
      case 'outline':
        return styles.outline;
      case 'success':
        return styles.success;
      case 'warning':
        return styles.warning;
      case 'error':
        return styles.error;
    }
  };

  const getTextStyle = () => {
    if (selected) return styles.selectedText;
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'success':
        return styles.successText;
      case 'warning':
        return styles.warningText;
      case 'error':
        return styles.errorText;
    }
  };

  const content = (
    <View style={[styles.base, getChipStyle(), style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, getTextStyle()]}>{label}</Text>
      {removable && (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.removeBtn}
        >
          <Text style={[styles.removeText, getTextStyle()]}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 30,
    borderRadius: htzTokens.radius.full,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: 'rgba(74, 124, 89, 0.2)',
    borderColor: 'rgba(74, 124, 89, 0.45)',
  },
  primaryText: {
    color: htzTokens.colors.inversePrimary,
  },
  secondary: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    borderColor: htzTokens.colors.outlineVariant,
  },
  secondaryText: {
    color: htzTokens.colors.onSurface,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: htzTokens.colors.outline,
  },
  outlineText: {
    color: htzTokens.colors.onSurface,
  },
  success: {
    backgroundColor: 'rgba(74, 124, 89, 0.25)',
    borderColor: htzTokens.colors.primary,
  },
  successText: {
    color: '#a2cfae',
  },
  warning: {
    backgroundColor: 'rgba(229, 169, 61, 0.2)',
    borderColor: 'rgba(229, 169, 61, 0.5)',
  },
  warningText: {
    color: htzTokens.colors.warning,
  },
  error: {
    backgroundColor: 'rgba(255, 180, 171, 0.15)',
    borderColor: 'rgba(255, 180, 171, 0.4)',
  },
  errorText: {
    color: htzTokens.colors.error,
  },
  selected: {
    backgroundColor: htzTokens.colors.primary,
    borderColor: htzTokens.colors.primary,
  },
  selectedText: {
    color: htzTokens.colors.onPrimary,
    fontWeight: '800',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  icon: {
    marginRight: 6,
  },
  removeBtn: {
    marginLeft: 6,
    padding: 2,
  },
  removeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
