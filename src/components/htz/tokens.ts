/**
 * Htz Design Tokens — Verde Sage Dark Mode (React Native Edition)
 * Portado desde C:\VSCode\haritz-components\projects\htz\src\lib\styles\_tokens.scss
 */

export const htzTokens = {
  colors: {
    // Primary Verde Sage
    primary: '#4a7c59',
    onPrimary: '#ffffff',
    primaryContainer: '#2d5a3b',
    onPrimaryContainer: '#c2e5cc',
    inversePrimary: '#a2cfae',

    // Secondary
    secondary: '#4b6352',
    onSecondary: '#ffffff',
    secondaryContainer: '#cce8d3',
    onSecondaryContainer: '#072012',

    // Tertiary
    tertiary: '#3d6470',
    onTertiary: '#ffffff',
    tertiaryContainer: '#c0e9fa',
    onTertiaryContainer: '#001f28',

    // Error
    error: '#ffb4ab',
    onError: '#690005',
    errorContainer: '#93000a',
    onErrorContainer: '#ffdad6',

    // Surfaces & Background
    background: '#1a1a1a',
    onBackground: '#e5e5e5',
    surface: '#2f2f2f',
    onSurface: '#f3f4f6',
    surfaceVariant: '#3f3f3f',
    onSurfaceVariant: '#a3a3a3',
    surfaceContainerLowest: '#0f0f0f',
    surfaceContainerLow: '#1a1a1a',
    surfaceContainer: '#262626',
    surfaceContainerHigh: '#333333',
    surfaceContainerHighest: '#404040',

    // Outline
    outline: '#737373',
    outlineVariant: '#525252',

    // Semantics
    success: '#4a7c59',
    onSuccess: '#ffffff',
    warning: '#e5a93d',
    onWarning: '#1a1a1a',
    info: '#3d6470',
    onInfo: '#ffffff',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 40,
    '2xl': 64,
  },
  radius: {
    sm: 4,
    default: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  elevation: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
  },
} as const;

export type HtzTokens = typeof htzTokens;
