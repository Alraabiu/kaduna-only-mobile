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


export default function VerifyResetCode() {

  const params =
    useLocalSearchParams<{
      phone?: string;
    }>();


  const phone =
    typeof params.phone === 'string'
      ? params.phone
      : '';


  const [otp, setOtp] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [resending, setResending] =
    useState(false);


  function handleOtpChange(
    value: string
  ) {

    const digits =
      value
        .replace(/\D/g, '')
        .slice(0, 6);

    setOtp(digits);

  }


  async function handleVerify() {

    if (!phone) {

      Alert.alert(
        'Verification',
        'Your recovery session is missing. Please start again.'
      );

      router.replace(
        '/forgot-password'
      );

      return;
    }


    if (otp.length !== 6) {

      Alert.alert(
        'Verification',
        'Please enter the complete 6-digit verification code.'
      );

      return;
    }


    setLoading(true);


    try {

      const response =
        await api.post(
          '/auth/verify-reset-code',
          {
            phone,
            otp,
          }
        );


      const result =
        response?.data;

      const resetToken =
        result?.data?.resetToken;


      if (
        !result?.success ||
        !resetToken
      ) {

        throw new Error(
          result?.message ||
          'Verification failed.'
        );

      }


      router.replace({
        pathname:
          '/reset-password',
        params: {
          phone,
          resetToken,
        },
      });


    } catch (error: any) {

      const message =
        error?.response?.data?.message ||
        error?.message ||
        'The verification code is invalid or expired.';


      Alert.alert(
        'Verification',
        message
      );


    } finally {

      setLoading(false);

    }

  }


  async function handleResend() {

    if (
      !phone ||
      resending ||
      loading
    ) {
      return;
    }


    setResending(true);


    try {

      const response =
        await api.post(
          '/auth/forgot-password',
          {
            phone,
          }
        );


      if (!response?.data?.success) {

        throw new Error(
          response?.data?.message ||
          'Unable to resend verification code.'
        );

      }


      setOtp('');


      Alert.alert(
        'Verification Code',
        'A new verification code has been requested.'
      );


    } catch (error: any) {

      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to resend the verification code.';


      Alert.alert(
        'Verification Code',
        message
      );


    } finally {

      setResending(false);

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
            router.back()
          }
          disabled={
            loading ||
            resending
          }
          style={styles.backButton}
        >

          <Text style={styles.backIcon}>
            ‹
          </Text>

        </Pressable>


        <View style={styles.header}>

          <Text style={styles.title}>
            Verify your number
          </Text>

          <Text style={styles.subtitle}>
            Enter the 6-digit verification code sent to your registered phone number.
          </Text>

          {!!phone && (

            <Text style={styles.phone}>
              {phone}
            </Text>

          )}

        </View>


        <View style={styles.form}>

          <Text style={styles.label}>
            Verification Code
          </Text>


          <TextInput
            value={otp}
            onChangeText={
              handleOtpChange
            }
            placeholder="000000"
            placeholderTextColor={
              BrandColors.textLight
            }
            keyboardType="number-pad"
            maxLength={6}
            editable={
              !loading &&
              !resending
            }
            autoFocus
            style={styles.otpInput}
          />


          <Text style={styles.helper}>
            The code expires after 10 minutes.
          </Text>


          <Pressable
            onPress={handleVerify}
            disabled={
              loading ||
              resending
            }
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.buttonPressed,
              (loading || resending) &&
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
                Verify code
              </Text>

            )}

          </Pressable>


          <View
            style={
              styles.resendRow
            }
          >

            <Text
              style={
                styles.resendLabel
              }
            >
              Didn't receive the code?
            </Text>


            <Pressable
              onPress={
                handleResend
              }
              disabled={
                loading ||
                resending
              }
            >

              {resending ? (

                <ActivityIndicator
                  size="small"
                  color={
                    BrandColors.primary
                  }
                />

              ) : (

                <Text
                  style={
                    styles.resendLink
                  }
                >
                  Resend
                </Text>

              )}

            </Pressable>

          </View>

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
    marginBottom: 34,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: BrandColors.text,
  },

  subtitle: {
    marginTop: 8,
    maxWidth: 330,
    fontSize: 13,
    lineHeight: 20,
    color:
      BrandColors.textSecondary,
  },

  phone: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '800',
    color: BrandColors.primary,
  },

  form: {
    width: '100%',
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.text,
    marginBottom: 8,
  },

  otpInput: {
    width: '100%',
    height: 58,
    borderWidth: 1,
    borderColor:
      BrandColors.border,
    borderRadius: 9,
    paddingHorizontal: 15,
    backgroundColor:
      BrandColors.background,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 12,
    textAlign: 'center',
    color: BrandColors.text,
  },

  helper: {
    marginTop: 9,
    marginBottom: 22,
    fontSize: 11,
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

  resendRow: {
    marginTop: 23,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },

  resendLabel: {
    fontSize: 12,
    color:
      BrandColors.textSecondary,
  },

  resendLink: {
    fontSize: 12,
    fontWeight: '800',
    color: BrandColors.primary,
  },

});
