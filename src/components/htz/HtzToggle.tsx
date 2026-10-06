import React from 'react';
import { View, Text, StyleSheet, Switch, StyleProp, ViewStyle } from 'react-native';
import { htzTokens } from './tokens';

export interface HtzToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  sublabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const HtzToggle: React.FC<HtzToggleProps> = ({
  checked,
  onChange,
  label,
  sublabel,
  disabled = false,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {(label || sublabel) && (
        <View style={styles.textContainer}>
          {label && <Text style={styles.label}>{label}</Text>}
          {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
        </View>
      )}
      <Switch
        trackColor={{
          false: htzTokens.colors.surfaceVariant,
          true: htzTokens.colors.primary,
        }}
        thumbColor="#FFFFFF"
        value={checked}
        onValueChange={onChange}
        disabled={disabled}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: htzTokens.colors.onSurface,
  },
  sublabel: {
    fontSize: 12,
    color: htzTokens.colors.onSurfaceVariant,
    marginTop: 2,
  },
});
