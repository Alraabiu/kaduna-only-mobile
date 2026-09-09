/**
 * Kaduna Only App Theme
 *
 * Centralized brand and UI design system.
 *
 * All screens should use BrandColors instead of
 * hard-coded colours such as #111111 or #000000.
 */

import '@/global.css';

import { Platform } from 'react-native';


/*
=========================================================
KADUNA ONLY BRAND COLORS
=========================================================
*/

export const BrandColors = {

  /*
   * PRIMARY BRAND
   */

  primary: '#6C2BD9',

  primaryDark: '#5520B5',

  primaryLight: '#F1E9FF',

  primarySoft: '#F7F2FF',


  /*
   * BASIC COLORS
   */

  white: '#FFFFFF',

  black: '#000000',


  /*
   * TEXT
   */

  text: '#171717',

  textSecondary: '#666666',

  textMuted: '#8A8A8A',

  textLight: '#A0A0A0',


  /*
   * BACKGROUNDS
   */

  background: '#FFFFFF',

  backgroundSoft: '#F7F7F9',

  backgroundMuted: '#F2F2F5',

  backgroundCard: '#FFFFFF',


  /*
   * BORDERS
   */

  border: '#E5E5E5',

  borderLight: '#EEEEEE',

  borderFocused: '#6C2BD9',


  /*
   * STATUS COLORS
   */

  success: '#16803C',

  successLight: '#EAF7EF',

  danger: '#D92D20',

  dangerLight: '#FDECEC',

  warning: '#F59E0B',

  warningLight: '#FFF5DD',

  info: '#2563EB',

  infoLight: '#EFF6FF',


  /*
   * TRANSPARENT BRAND COLORS
   */

  overlay: 'rgba(0,0,0,0.45)',

  primaryOverlay:
    'rgba(108,43,217,0.10)',

} as const;


/*
=========================================================
THEME COLORS
=========================================================
*/

export const Colors = {

  /*
   * -----------------------------------------------------
   * LIGHT MODE
   * -----------------------------------------------------
   */

  light: {

    text:
      BrandColors.text,

    background:
      BrandColors.background,

    backgroundElement:
      BrandColors.backgroundSoft,

    backgroundSelected:
      BrandColors.primaryLight,

    textSecondary:
      BrandColors.textSecondary,

    primary:
      BrandColors.primary,

    primaryDark:
      BrandColors.primaryDark,

    primaryLight:
      BrandColors.primaryLight,

    border:
      BrandColors.border,

    borderLight:
      BrandColors.borderLight,

    success:
      BrandColors.success,

    danger:
      BrandColors.danger,

    warning:
      BrandColors.warning,

  },


  /*
   * -----------------------------------------------------
   * DARK MODE
   * -----------------------------------------------------
   *
   * Kaduna Only intentionally keeps the main application
   * surface light rather than switching the entire app
   * to black.
   *
   * This prevents the splash, login, register and
   * navigation experience from becoming black when the
   * device is using dark mode.
   */

  dark: {

    text:
      BrandColors.text,

    background:
      BrandColors.background,

    backgroundElement:
      BrandColors.backgroundSoft,

    backgroundSelected:
      BrandColors.primaryLight,

    textSecondary:
      BrandColors.textSecondary,

    primary:
      BrandColors.primary,

    primaryDark:
      BrandColors.primaryDark,

    primaryLight:
      BrandColors.primaryLight,

    border:
      BrandColors.border,

    borderLight:
      BrandColors.borderLight,

    success:
      BrandColors.success,

    danger:
      BrandColors.danger,

    warning:
      BrandColors.warning,

  },

} as const;


/*
=========================================================
THEME TYPE
=========================================================
*/

export type ThemeColor =
  keyof typeof Colors.light &
  keyof typeof Colors.dark;


/*
=========================================================
FONTS
=========================================================
*/

export const Fonts = Platform.select({

  ios: {

    sans:
      'system-ui',

    serif:
      'ui-serif',

    rounded:
      'ui-rounded',

    mono:
      'ui-monospace',

  },


  default: {

    sans:
      'normal',

    serif:
      'serif',

    rounded:
      'normal',

    mono:
      'monospace',

  },


  web: {

    sans:
      'var(--font-display)',

    serif:
      'var(--font-serif)',

    rounded:
      'var(--font-rounded)',

    mono:
      'var(--font-mono)',

  },

});


/*
=========================================================
SPACING
=========================================================
*/

export const Spacing = {

  half: 2,

  one: 4,

  two: 8,

  three: 16,

  four: 24,

  five: 32,

  six: 64,

} as const;


/*
=========================================================
LAYOUT
=========================================================
*/

export const BottomTabInset =
  Platform.select({

    ios: 50,

    android: 80,

  }) ?? 0;


export const MaxContentWidth = 800;


/*
=========================================================
BORDER RADIUS
=========================================================
*/

export const Radius = {

  small: 8,

  medium: 12,

  large: 16,

  xlarge: 20,

  xxlarge: 28,

  pill: 999,

} as const;


/*
=========================================================
SHADOWS
=========================================================
*/

export const Shadows = {

  small: {

    shadowColor:
      '#000000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity:
      0.06,

    shadowRadius:
      5,

    elevation:
      2,

  },

  medium: {

    shadowColor:
      '#000000',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity:
      0.10,

    shadowRadius:
      10,

    elevation:
      4,

  },

  large: {

    shadowColor:
      '#000000',

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity:
      0.14,

    shadowRadius:
      18,

    elevation:
      8,

  },

} as const;