import React, { useState } from 'react';

import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import api from '../services/api';

import {
  BrandColors,
} from '../constants/theme';


export default function ResetPassword() {

  const params =
    useLocalSearchParams<{
      phone?: string;
      resetToken?: string;
    }>();


  const phone =
    typeof params.phone === 'string'
      ? params.phone
      : '';

  const resetToken =
    typeof params.resetToken === 'string'
      ? params.resetToken
      : '';


  const [password, setPassword] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);


  async function handleReset() {

    if (
      !phone ||
      !resetToken
    ) {

      Alert.alert(
        'Reset Password',
        'Your password recovery session has expired. Please start again.'
      );

      router.replace(
        '/forgot-password'
      );

      return;
    }


    if (password.length < 8) {

      Alert.alert(
        'Reset Password',
        'Your new password must be at least 8 characters.'
      );

      return;
    }


    if (
      password !==
      confirmPassword
    ) {

      Alert.alert(
        'Reset Password',
        'The passwords do not match.'
      );

      return;
    }


    setLoading(true);


    try {

      const response =
        await api.post(
          '/auth/reset-password',
          {
            phone,
            resetToken,
            newPassword:
              password,
          }
        );


      const result =
        response?.data;


      if (!result?.success) {

        throw new Error(
          result?.message ||
          'Unable to update your password.'
        );

      }


      Alert.alert(
        'Password Updated',
        'Your password has been changed successfully. You can now log in with your new password.',
        [
          {
            text: 'Login',
            onPress: () =>
              router.replace(
                '/login'
              ),
          },
        ]
      );


    } catch (error: any) {

      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to update your password. Please try again.';


      Alert.alert(
        'Reset Password',
        message
      );


    } finally {

      setLoading(false);

    }

  }


  return (

    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >

      <ScrollView
        contentContainerStyle={
          styles.container
        }
        keyboardShouldPersistTaps="handled"
      >

        <Pressable
          onPress={() =>
            router.replace(
              '/forgot-password'
            )
          }
          disabled={loading}
          style={styles.backButton}
        >

          <Text style={styles.backIcon}>
            ‹
          </Text>

        </Pressable>


        <View style={styles.header}>

          <Text style={styles.title}>
            Create new password
          </Text>

          <Text style={styles.subtitle}>
            Choose a new password for your Kaduna Only account.
          </Text>

        </View>


        <View style={styles.form}>

          <View style={styles.field}>

            <Text style={styles.label}>
              New Password
            </Text>


            <View
              style={
                styles.passwordContainer
              }
            >

              <TextInput
                value={password}
                onChangeText={
                  setPassword
                }
                placeholder="At least 8 characters"
                placeholderTextColor={
                  BrandColors.textLight
                }
                secureTextEntry={
                  !showPassword
                }
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                style={
                  styles.passwordInput
                }
              />


              <Pressable
                onPress={() =>
                  setShowPassword(
                    previous =>
                      !previous
                  )
                }
                disabled={loading}
                style={styles.eyeButton}
              >

                <Text style={styles.eyeText}>
                  {showPassword
                    ? 'Hide'
                    : 'Show'}
                </Text>

              </Pressable>

            </View>

          </View>


          <View style={styles.field}>

            <Text style={styles.label}>
              Confirm New Password
            </Text>


            <View
              style={
                styles.passwordContainer
              }
            >

              <TextInput
                value={
                  confirmPassword
                }
                onChangeText={
                  setConfirmPassword
                }
                placeholder="Enter the password again"
                placeholderTextColor={
                  BrandColors.textLight
                }
                secureTextEntry={
                  !showConfirmPassword
                }
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                style={
                  styles.passwordInput
                }
              />


              <Pressable
                onPress={() =>
                  setShowConfirmPassword(
                    previous =>
                      !previous
                  )
                }
                disabled={loading}
                style={styles.eyeButton}
              >

                <Text style={styles.eyeText}>
                  {showConfirmPassword
                    ? 'Hide'
                    : 'Show'}
                </Text>

              </Pressable>

            </View>

          </View>


          <Text style={styles.helper}>
            Use at least 8 characters. Avoid using a password you share with another account.
          </Text>


          <Pressable
            onPress={handleReset}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.buttonPressed,
              loading &&
                styles.disabledButton,
            ]}
          >

            {loading ? (

              <ActivityIndicator
                color={
                  BrandColors.white
                }
              />

            ) : (

              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Update password
              </Text>

            )}

          </Pressable>

        </View>

      </ScrollView>

    </KeyboardAvoidingView>

  );

}


const styles = StyleSheet.create({

  screen: {
    flex: 1,
    backgroundColor:
      BrandColors.background,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 35,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  backIcon: {
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '300',
    color: BrandColors.text,
  },

  header: {
    marginTop: 15,
    marginBottom: 32,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: BrandColors.text,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color:
      BrandColors.textSecondary,
  },

  form: {
    width: '100%',
  },

  field: {
    width: '100%',
    marginBottom: 18,
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.text,
    marginBottom: 8,
  },

  passwordContainer: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor:
      BrandColors.border,
    borderRadius: 9,
    backgroundColor:
      BrandColors.background,
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 13,
    fontSize: 14,
    color: BrandColors.text,
  },

  eyeButton: {
    minWidth: 55,
    height: '100%',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eyeText: {
    fontSize: 11,
    fontWeight: '800',
    color: BrandColors.primary,
  },

  helper: {
    marginTop: -3,
    marginBottom: 22,
    fontSize: 11,
    lineHeight: 17,
    color:
      BrandColors.textSecondary,
  },

  primaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      BrandColors.primary,
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: BrandColors.white,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonPressed: {
    opacity: 0.82,
  },

});
