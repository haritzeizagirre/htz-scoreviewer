import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { htzTokens } from './tokens';

export interface HtzSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface HtzSelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  options: HtzSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export const HtzSelect: React.FC<HtzSelectProps> = ({
  label,
  placeholder = 'Seleccionar...',
  value,
  options,
  onChange,
  disabled = false,
  error,
  style,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.75}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={[
          styles.field,
          compact && styles.fieldCompact,
          isOpen && styles.fieldFocused,
          error ? styles.fieldError : null,
          disabled && styles.fieldDisabled,
        ]}
      >
        <View style={styles.fieldLeft}>
          {selectedOption?.icon ? (
            <View style={styles.iconContainer}>{selectedOption.icon}</View>
          ) : null}
          <Text
            style={[
              styles.fieldText,
              compact && styles.fieldTextCompact,
              !selectedOption && styles.placeholderText,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>

        <ChevronDown
          size={compact ? 16 : 18}
          color={htzTokens.colors.outline}
          style={[styles.chevron, isOpen && styles.chevronRotated]}
        />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Modal Dropdown Menu */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.dropdownCard}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{label || placeholder}</Text>
              <Text style={styles.dropdownSubtitle}>Selecciona una opción</Text>
            </View>

            <ScrollView
              style={styles.optionsList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.optionsListContent}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.7}
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                    ]}
                    onPress={() => handleSelect(option.value)}
                  >
                    <View style={styles.optionLeft}>
                      {option.icon ? (
                        <View style={styles.optionIconWrapper}>
                          {option.icon}
                        </View>
                      ) : null}
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>

                    {option.badge ? (
                      <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{option.badge}</Text>
                      </View>
                    ) : null}

                    {isSelected ? (
                      <Check
                        size={18}
                        color={htzTokens.colors.inversePrimary}
                        style={styles.checkIcon}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: htzTokens.colors.onSurfaceVariant,
    marginBottom: 6,
  },
  field: {
    backgroundColor: htzTokens.colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: htzTokens.colors.outlineVariant,
    borderRadius: htzTokens.radius.default,
    paddingHorizontal: 12,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldCompact: {
    height: 36,
    paddingHorizontal: 10,
    backgroundColor: htzTokens.colors.surfaceContainer,
  },
  fieldFocused: {
    borderColor: htzTokens.colors.primary,
  },
  fieldError: {
    borderColor: htzTokens.colors.error,
  },
  fieldDisabled: {
    opacity: 0.5,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconContainer: {
    marginRight: 8,
  },
  fieldText: {
    fontSize: 13,
    fontWeight: '600',
    color: htzTokens.colors.onSurface,
    flex: 1,
  },
  fieldTextCompact: {
    fontSize: 12,
  },
  placeholderText: {
    color: htzTokens.colors.outline,
    fontWeight: '400',
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  errorText: {
    fontSize: 11,
    color: htzTokens.colors.error,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: htzTokens.colors.surface,
    borderRadius: htzTokens.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  dropdownHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: htzTokens.colors.surfaceVariant,
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: htzTokens.colors.onSurface,
  },
  dropdownSubtitle: {
    fontSize: 11,
    color: htzTokens.colors.outline,
    marginTop: 2,
  },
  optionsList: {
    maxHeight: 320,
  },
  optionsListContent: {
    paddingVertical: 6,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  optionItemSelected: {
    backgroundColor: 'rgba(74, 124, 89, 0.22)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  optionIconWrapper: {
    marginRight: 10,
  },
  optionLabel: {
    fontSize: 13,
    color: htzTokens.colors.onSurface,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: htzTokens.colors.inversePrimary,
    fontWeight: '700',
  },
  badgeContainer: {
    backgroundColor: htzTokens.colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: htzTokens.colors.onSurfaceVariant,
  },
  checkIcon: {
    marginLeft: 6,
  },
});
