import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { htzTokens } from './tokens';

export type HtzButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'icon';
export type HtzButtonSize = 'sm' | 'md' | 'lg';

export interface HtzButtonProps {
  variant?: HtzButtonVariant;
  size?: HtzButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const HtzButton: React.FC<HtzButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  children,
  onPress,
  style,
  textStyle,
}) => {
  const getButtonStyles = (): StyleProp<ViewStyle>[] => {
    const list: StyleProp<ViewStyle>[] = [styles.base];

    // Sizes
    if (size === 'sm') list.push(styles.sizeSm);
    else if (size === 'lg') list.push(styles.sizeLg);
    else list.push(styles.sizeMd);

    // Variants
    switch (variant) {
      case 'primary':
        list.push(styles.primary);
        break;
      case 'secondary':
        list.push(styles.secondary);
        break;
      case 'outline':
        list.push(styles.outline);
        break;
      case 'ghost':
        list.push(styles.ghost);
        break;
      case 'icon':
        list.push(styles.iconVariant);
        break;
    }

    if (disabled || loading) list.push(styles.disabled);
    if (style) list.push(style);

    return list;
  };

  const getTextStyles = (): StyleProp<TextStyle>[] => {
    const list: StyleProp<TextStyle>[] = [styles.baseText];

    if (size === 'sm') list.push(styles.textSm);
    else if (size === 'lg') list.push(styles.textLg);
    else list.push(styles.textMd);

    switch (variant) {
      case 'primary':
        list.push(styles.primaryText);
        break;
      case 'secondary':
        list.push(styles.secondaryText);
        break;
      case 'outline':
        list.push(styles.outlineText);
        break;
      case 'ghost':
      case 'icon':
        list.push(styles.ghostText);
        break;
    }

    if (textStyle) list.push(textStyle);
    return list;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={getButtonStyles()}
      disabled={disabled || loading}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#ffffff' : htzTokens.colors.primary}
        />
      ) : (
        <>
          {icon && <View style={children ? styles.iconWrapper : undefined}>{icon}</View>}
          {typeof children === 'string' ? (
            <Text style={getTextStyles()}>{children}</Text>
          ) : (
            children
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: htzTokens.radius.default,
  },
  sizeSm: {
    paddingHorizontal: 12,
    height: 32,
  },
  sizeMd: {
    paddingHorizontal: 18,
    height: 44,
  },
  sizeLg: {
    paddingHorizontal: 24,
    height: 50,
  },
  primary: {
    backgroundColor: htzTokens.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  secondary: {
    backgroundColor: htzTokens.colors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: 'rgba(74, 124, 89, 0.4)',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: htzTokens.colors.outline,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  iconVariant: {
    paddingHorizontal: 0,
    width: 40,
    height: 40,
    borderRadius: htzTokens.radius.full,
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  baseText: {
    fontWeight: '700',
  },
  textSm: {
    fontSize: 12,
  },
  textMd: {
    fontSize: 14,
  },
  textLg: {
    fontSize: 16,
  },
  primaryText: {
    color: htzTokens.colors.onPrimary,
  },
  secondaryText: {
    color: htzTokens.colors.onSurface,
  },
  outlineText: {
    color: htzTokens.colors.inversePrimary,
  },
  ghostText: {
    color: htzTokens.colors.onSurface,
  },
  iconWrapper: {
    marginRight: 6,
  },
});
