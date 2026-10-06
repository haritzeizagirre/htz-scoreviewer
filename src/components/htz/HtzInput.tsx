import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { htzTokens } from './tokens';

export interface HtzInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const HtzInput: React.FC<HtzInputProps> = ({
  label,
  error,
  icon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.container,
          isFocused && styles.focused,
          !!error && styles.errorBorder,
        ]}
      >
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={htzTokens.colors.outline}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: htzTokens.colors.onSurface,
    marginBottom: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: htzTokens.colors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: htzTokens.colors.surfaceVariant,
    borderRadius: htzTokens.radius.default,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  focused: {
    borderColor: htzTokens.colors.primary,
  },
  errorBorder: {
    borderColor: htzTokens.colors.error,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: htzTokens.colors.onSurface,
    fontSize: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 11,
    color: htzTokens.colors.error,
    marginTop: 4,
  },
});
