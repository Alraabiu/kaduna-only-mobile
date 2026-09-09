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

import { router } from 'expo-router';

import api, {
  setAuthToken,
} from '../services/api';

import {
  saveAuth,
} from '../storage/auth';

import {
  BrandColors,
} from '../constants/theme';


export default function Register() {

  const [fullName, setFullName] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [role, setRole] =
    useState<'rider' | 'driver'>('rider');

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);


  async function handleRegister() {

    const cleanName =
      fullName.trim();

    const cleanPhone =
      phone.trim();

    const cleanEmail =
      email.trim().toLowerCase();


    if (!cleanName) {
      Alert.alert(
        'Registration',
        'Please enter your full name.'
      );
      return;
    }


    if (!cleanPhone) {
      Alert.alert(
        'Registration',
        'Please enter your phone number.'
      );
      return;
    }


    if (!password) {
      Alert.alert(
        'Registration',
        'Please enter a password.'
      );
      return;
    }


    if (password.length < 8) {
      Alert.alert(
        'Registration',
        'Password must be at least 8 characters.'
      );
      return;
    }


    if (password !== confirmPassword) {
      Alert.alert(
        'Registration',
        'Passwords do not match.'
      );
      return;
    }


    setLoading(true);


    try {

      console.log(
        '[MOBILE REGISTER] Starting registration'
      );


      const response =
        await api.post(
          '/auth/register',
          {
            fullName: cleanName,
            phone: cleanPhone,
            email:
              cleanEmail || undefined,
            password,
            role,
          }
        );


      console.log(
        '[MOBILE REGISTER RESPONSE]',
        response.data
      );


      const result =
        response?.data;


      if (
        !result?.success ||
        !result?.data?.token ||
        !result?.data?.user
      ) {

        throw new Error(
          result?.message ||
          'Registration failed.'
        );

      }


      const token =
        result.data.token;

      const user =
        result.data.user;


      await saveAuth(
        user,
        token
      );


      setAuthToken(
        token
      );


      console.log(
        '[MOBILE REGISTER] Account created'
      );

      console.log(
        '[MOBILE REGISTER] Role:',
        user.role
      );


      if (
        user.role === 'driver'
      ) {

        router.replace('/driver');

        return;

      }


      router.replace('/rider');


    } catch (error: any) {

      console.log(
        '[MOBILE REGISTER ERROR]',
        error
      );


      let message =
        'Unable to create your account.';


      if (
        error?.response?.data?.message
      ) {

        message =
          error.response.data.message;

      } else if (
        error?.message
      ) {

        message =
          error.message;

      }


      Alert.alert(
        'Registration Failed',
        message
      );


    } finally {

      setLoading(false);

    }

  }


  function goToLogin() {

    router.replace('/login');

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

        <View style={styles.logo}>

          <Text style={styles.logoText}>
            K
          </Text>

        </View>


        <Text style={styles.brand}>
          KADUNA ONLY
        </Text>


        <Text style={styles.tagline}>
          Your City. Your Ride.
        </Text>


        <View style={styles.header}>

          <Text style={styles.title}>
            Create account
          </Text>

          <Text style={styles.subtitle}>
            Join Kaduna Only today
          </Text>

        </View>


        <View style={styles.field}>

          <Text style={styles.label}>
            Full name
          </Text>

          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor="#999"
            style={styles.input}
            editable={!loading}
          />

        </View>


        <View style={styles.field}>

          <Text style={styles.label}>
            Phone number
          </Text>

          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            style={styles.input}
            editable={!loading}
          />

        </View>


        <View style={styles.field}>

          <Text style={styles.label}>
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email (optional)"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            editable={!loading}
          />

        </View>


        <View style={styles.field}>

          <Text style={styles.label}>
            Account type
          </Text>


          <View style={styles.roleRow}>

            <Pressable
              onPress={() =>
                setRole('rider')
              }
              disabled={loading}
              style={[
                styles.roleButton,
                role === 'rider' &&
                  styles.roleButtonActive,
              ]}
            >

              <Text
                style={[
                  styles.roleText,
                  role === 'rider' &&
                    styles.roleTextActive,
                ]}
              >
                Rider
              </Text>

            </Pressable>


            <Pressable
              onPress={() =>
                setRole('driver')
              }
              disabled={loading}
              style={[
                styles.roleButton,
                role === 'driver' &&
                  styles.roleButtonActive,
              ]}
            >

              <Text
                style={[
                  styles.roleText,
                  role === 'driver' &&
                    styles.roleTextActive,
                ]}
              >
                Driver
              </Text>

            </Pressable>

          </View>

        </View>


        <View style={styles.field}>

          <Text style={styles.label}>
            Password
          </Text>

          <View
            style={
              styles.passwordContainer
            }
          >

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 8 characters"
              placeholderTextColor="#999"
              secureTextEntry={
                !showPassword
              }
              autoCapitalize="none"
              style={styles.passwordInput}
              editable={!loading}
            />

            <Pressable
              onPress={() =>
                setShowPassword(
                  !showPassword
                )
              }
            >

              <Text style={styles.showText}>
                {
                  showPassword
                    ? 'Hide'
                    : 'Show'
                }
              </Text>

            </Pressable>

          </View>

        </View>


        <View style={styles.field}>

          <Text style={styles.label}>
            Confirm password
          </Text>

          <View
            style={
              styles.passwordContainer
            }
          >

            <TextInput
              value={confirmPassword}
              onChangeText={
                setConfirmPassword
              }
              placeholder="Repeat your password"
              placeholderTextColor="#999"
              secureTextEntry={
                !showConfirmPassword
              }
              autoCapitalize="none"
              style={styles.passwordInput}
              editable={!loading}
            />

            <Pressable
              onPress={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }
            >

              <Text style={styles.showText}>
                {
                  showConfirmPassword
                    ? 'Hide'
                    : 'Show'
                }
              </Text>

            </Pressable>

          </View>

        </View>


        <Pressable
          style={[
            styles.registerButton,
            loading &&
              styles.disabledButton,
          ]}
          onPress={handleRegister}
          disabled={loading}
        >

          {loading ? (

            <ActivityIndicator
              color="#ffffff"
            />

          ) : (

            <Text
              style={
                styles.registerButtonText
              }
            >
              Create Account
            </Text>

          )}

        </Pressable>


        <View style={styles.loginRow}>

          <Text style={styles.loginText}>
            Already have an account?
          </Text>

          <Pressable
            onPress={goToLogin}
            disabled={loading}
          >

            <Text style={styles.loginLink}>
              Sign In
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },


  logo: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor:
      BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },


  logoText: {
    color:
      BrandColors.white,
    fontSize: 36,
    fontWeight: '800',
  },


  brand: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0.8,
    color:
      BrandColors.primary,
  },


  tagline: {
    marginTop: 4,
    color:
      BrandColors.textSecondary,
    fontSize: 14,
  },


  header: {
    width: '100%',
    marginTop: 30,
    marginBottom: 20,
  },


  title: {
    fontSize: 27,
    fontWeight: '800',
    color:
      BrandColors.text,
  },


  subtitle: {
    marginTop: 6,
    color:
      BrandColors.textSecondary,
    fontSize: 15,
  },


  field: {
    width: '100%',
    marginBottom: 16,
  },


  label: {
    fontSize: 14,
    fontWeight: '700',
    color:
      BrandColors.text,
    marginBottom: 7,
  },


  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor:
      BrandColors.border,
    borderRadius: 12,
    backgroundColor:
      BrandColors.backgroundSoft,
    paddingHorizontal: 15,
    fontSize: 16,
    color:
      BrandColors.text,
  },


  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },


  roleButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor:
      BrandColors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      BrandColors.backgroundSoft,
  },


  roleButtonActive: {
    backgroundColor:
      BrandColors.primary,
    borderColor:
      BrandColors.primary,
  },


  roleText: {
    fontSize: 15,
    fontWeight: '700',
    color:
      BrandColors.textSecondary,
  },


  roleTextActive: {
    color:
      BrandColors.white,
  },


  passwordContainer: {
    height: 52,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor:
      BrandColors.border,
    borderRadius: 12,
    backgroundColor:
      BrandColors.backgroundSoft,
  },


  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
    fontSize: 16,
    color:
      BrandColors.text,
  },


  showText: {
    paddingHorizontal: 15,
    fontSize: 14,
    fontWeight: '700',
    color:
      BrandColors.primary,
  },


  registerButton: {
    width: '100%',
    height: 54,
    borderRadius: 12,
    backgroundColor:
      BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },


  disabledButton: {
    opacity: 0.6,
  },


  registerButtonText: {
    color:
      BrandColors.white,
    fontSize: 16,
    fontWeight: '700',
  },


  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },


  loginText: {
    color:
      BrandColors.textSecondary,
    fontSize: 14,
  },


  loginLink: {
    marginLeft: 5,
    color:
      BrandColors.primary,
    fontSize: 14,
    fontWeight: '800',
  },

});