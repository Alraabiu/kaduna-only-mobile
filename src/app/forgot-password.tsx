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
} from 'expo-router';

import api from '../services/api';

import {
  BrandColors,
} from '../constants/theme';


export default function ForgotPassword() {

  const [phone, setPhone] =
    useState('');

  const [loading, setLoading] =
    useState(false);


  async function handleContinue() {

    const cleanPhone =
      phone.trim();

    if (!cleanPhone) {

      Alert.alert(
        'Forgot Password',
        'Please enter your registered phone number.'
      );

      return;
    }


    setLoading(true);


    try {

      const response =
        await api.post(
          '/auth/forgot-password',
          {
            phone: cleanPhone,
          }
        );


      const result =
        response?.data;


      if (!result?.success) {

        throw new Error(
          result?.message ||
          'Unable to start password recovery.'
        );

      }


      router.push({
        pathname:
          '/verify-reset-code',
        params: {
          phone:
            cleanPhone,
        },
      });


    } catch (error: any) {

      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to start password recovery. Please try again.';


      Alert.alert(
        'Password Recovery',
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
            router.back()
          }
          disabled={loading}
          style={styles.backButton}
        >

          <Text
            style={styles.backIcon}
          >
            ‹
          </Text>

        </Pressable>


        <View style={styles.header}>

          <View style={styles.headerCopy}>

            <Text style={styles.title}>
              Forgot password?
            </Text>

            <Text style={styles.subtitle}>
              Enter the phone number linked to your Kaduna Only account.
              We will send you a 6-digit verification code.
            </Text>

          </View>


          <View style={styles.headerArt}>

            <View style={styles.artTowerOne} />
            <View style={styles.artTowerTwo} />
            <View style={styles.artTowerThree} />

          </View>

        </View>


        <View style={styles.form}>

          <View style={styles.field}>

            <Text style={styles.label}>
              Phone Number
            </Text>

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="080 XXX XXX XX"
              placeholderTextColor={
                BrandColors.textLight
              }
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              style={styles.input}
            />

          </View>


          <Pressable
            onPress={handleContinue}
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
                Send verification code
              </Text>

            )}

          </Pressable>


          <Pressable
            onPress={() =>
              router.replace('/login')
            }
            disabled={loading}
            style={styles.loginLinkButton}
          >

            <Text style={styles.loginLink}>
              Back to Login
            </Text>

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
    width: '100%',
    minHeight: 125,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 12,
    marginBottom: 30,
  },

  headerCopy: {
    flex: 1,
    paddingRight: 16,
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    color: BrandColors.text,
    letterSpacing: -0.4,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: BrandColors.textSecondary,
  },

  headerArt: {
    width: 82,
    height: 70,
    position: 'relative',
    opacity: 0.7,
  },

  artTowerOne: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    width: 18,
    height: 38,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor:
      BrandColors.primaryLight,
  },

  artTowerTwo: {
    position: 'absolute',
    bottom: 0,
    left: 31,
    width: 21,
    height: 50,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor:
      BrandColors.primaryLight,
  },

  artTowerThree: {
    position: 'absolute',
    bottom: 8,
    right: 4,
    width: 18,
    height: 32,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor:
      BrandColors.primaryLight,
  },

  form: {
    width: '100%',
  },

  field: {
    width: '100%',
    marginBottom: 22,
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.text,
    marginBottom: 8,
  },

  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 9,
    paddingHorizontal: 13,
    backgroundColor:
      BrandColors.background,
    fontSize: 14,
    color: BrandColors.text,
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

  loginLinkButton: {
    alignSelf: 'center',
    marginTop: 22,
    padding: 8,
  },

  loginLink: {
    fontSize: 12,
    fontWeight: '800',
    color: BrandColors.primary,
  },

});
