import React, {
  useState,
} from 'react';

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

import { Ionicons } from '@expo/vector-icons';

import * as SecureStore from 'expo-secure-store';

import api, {
  setAuthToken,
} from '../services/api';

import {
  saveAuth,
} from '../storage/auth';

import {
  BrandColors,
} from '../constants/theme';


/*
=========================================================
KADUNA ONLY LOGIN
=========================================================
*/

export default function Login() {

  const [phone, setPhone] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);


  const [verificationRequired, setVerificationRequired] =
    useState(false);

  const [verificationCode, setVerificationCode] =
    useState('');

  const [verificationDeviceId, setVerificationDeviceId] =
    useState('');


  /*
  =======================================================
  DEVICE ID
  =======================================================
  */

  async function getOrCreateDeviceId() {

    const storageKey =
      'kaduna_only_installation_device_id';

    const existing =
      await SecureStore.getItemAsync(
        storageKey
      );

    if (existing) {

      return existing;

    }


    const randomPart =
      `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

    const newDeviceId =
      `kaduna-mobile-${Platform.OS}-${randomPart}`;


    await SecureStore.setItemAsync(
      storageKey,
      newDeviceId
    );


    return newDeviceId;

  }


  /*
  =======================================================
  COMPLETE AUTHENTICATION
  =======================================================
  */

  async function completeAuthentication(
    user: any,
    token: string
  ) {

    await saveAuth(
      user,
      token
    );


    setAuthToken(
      token
    );


    const role =
      String(
        user?.role || ''
      )
        .trim()
        .toLowerCase();


    if (role === 'driver') {

      router.replace(
        '/driver'
      );

      return;

    }


    if (role === 'rider') {

      router.replace(
        '/rider'
      );

      return;

    }


    Alert.alert(
      'Login Error',
      'This account cannot use the Kaduna Only mobile app.'
    );

  }


  /*
  =======================================================
  LOGIN
  =======================================================
  */

  async function handleLogin() {

    const cleanPhone =
      phone.trim();


    if (!cleanPhone) {

      Alert.alert(
        'Login',
        'Please enter your phone number.'
      );

      return;

    }


    if (!password) {

      Alert.alert(
        'Login',
        'Please enter your password.'
      );

      return;

    }


    setLoading(true);


    try {

      const deviceId =
        await getOrCreateDeviceId();


      const deviceName =
        Platform.OS === 'android'
          ? 'Android Mobile'
          : 'iPhone';


      const platform =
        Platform.OS;


      const response =
        await api.post(
          '/auth/login',
          {
            phone: cleanPhone,
            password,
            deviceId,
            deviceName,
            platform,
          }
        );


      const result =
        response?.data;


      if (
        result?.requiresDeviceVerification === true ||
        result?.code === 'OTP_REQUIRED'
      ) {

        const returnedDeviceId =
          String(
            result?.data?.deviceId ||
            deviceId
          ).trim();


        setVerificationDeviceId(
          returnedDeviceId
        );

        setVerificationCode('');

        setVerificationRequired(
          true
        );

        return;

      }


      if (
        !result?.success ||
        !result?.data?.token ||
        !result?.data?.user
      ) {

        throw new Error(
          result?.message ||
          'Login failed. Invalid server response.'
        );

      }


      await completeAuthentication(
        result.data.user,
        result.data.token
      );


    } catch (
      error: any
    ) {

      let message =
        'Unable to connect to Kaduna Only.';


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
        'Login Failed',
        message
      );

    } finally {

      setLoading(false);

    }

  }


  /*
  =======================================================
  VERIFY NEW DEVICE
  =======================================================
  */

  async function handleVerifyDevice() {

    const cleanPhone =
      phone.trim();

    const cleanCode =
      verificationCode.trim();


    if (!/^\d{6}$/.test(cleanCode)) {

      Alert.alert(
        'Verification',
        'Please enter the 6 digit verification code.'
      );

      return;

    }


    if (!verificationDeviceId) {

      Alert.alert(
        'Verification',
        'Device verification information is missing. Please log in again.'
      );

      setVerificationRequired(
        false
      );

      return;

    }


    setLoading(true);


    try {

      const response =
        await api.post(
          '/auth/verify-device',
          {
            phone:
              cleanPhone,

            deviceId:
              verificationDeviceId,

            otp:
              cleanCode,
          }
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
          'Device verification failed.'
        );

      }


      await completeAuthentication(
        result.data.user,
        result.data.token
      );


    } catch (
      error: any
    ) {

      let message =
        'Unable to verify this device.';


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
        'Verification Failed',
        message
      );

    } finally {

      setLoading(false);

    }

  }


  /*
  =======================================================
  NAVIGATION
  =======================================================
  */

  function goBack() {

    router.back();

  }


  function openRegister() {

    router.push(
      '/register'
    );

  }


  if (verificationRequired) {

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
          showsVerticalScrollIndicator={false}
        >

          <Pressable
            onPress={() => {
              if (loading) return;
              setVerificationRequired(false);
              setVerificationCode('');
              setVerificationDeviceId('');
            }}
            style={styles.backButton}
            disabled={loading}
          >

            <Ionicons
              name="chevron-back"
              size={28}
              color={BrandColors.text}
            />

          </Pressable>


          <View
            style={styles.verificationHeader}
          >

            <View
              style={styles.verificationIcon}
            >

              <Ionicons
                name="shield-checkmark-outline"
                size={32}
                color={BrandColors.primary}
              />

            </View>


            <Text
              style={styles.title}
            >
              Verify New Device
            </Text>


            <Text
              style={styles.verificationSubtitle}
            >
              We sent a 6 digit verification code to your registered phone number.
            </Text>

          </View>


          <View
            style={styles.form}
          >

            <View
              style={styles.field}
            >

              <Text
                style={styles.label}
              >
                Verification Code
              </Text>


              <TextInput
                value={verificationCode}
                onChangeText={(value) =>
                  setVerificationCode(
                    value
                      .replace(/\D/g, '')
                      .slice(0, 6)
                  )
                }
                placeholder="Enter 6 digit code"
                placeholderTextColor={
                  BrandColors.textLight
                }
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                maxLength={6}
                style={[
                  styles.input,
                  styles.verificationInput,
                ]}
              />

            </View>


            <Pressable
              onPress={handleVerifyDevice}
              disabled={
                loading ||
                verificationCode.length !== 6
              }
              style={({ pressed }) => [
                styles.loginButton,

                pressed &&
                  styles.buttonPressed,

                (
                  loading ||
                  verificationCode.length !== 6
                ) &&
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
                    styles.loginButtonText
                  }
                >
                  Verify Device
                </Text>

              )}

            </Pressable>


            <Text
              style={styles.verificationHelp}
            >
              The code expires in 5 minutes. If it expires, return to login and sign in again to request a new code.
            </Text>

          </View>

        </ScrollView>

      </KeyboardAvoidingView>

    );

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
        showsVerticalScrollIndicator={false}
      >

        {/* =================================================
            BACK
        ================================================= */}

        <Pressable
          onPress={goBack}
          style={styles.backButton}
          disabled={loading}
        >

          <Ionicons
            name="chevron-back"
            size={28}
            color={BrandColors.text}
          />

        </Pressable>


        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={styles.header}
        >

          <View>

            <Text
              style={styles.title}
            >
              Welcome Back
            </Text>


            <Text
              style={styles.subtitle}
            >
              Log in to your account
            </Text>

          </View>


          {/* Decorative Kaduna mark */}

          <View
            style={styles.headerArt}
          >

            <View
              style={styles.artTowerOne}
            />

            <View
              style={styles.artTowerTwo}
            />

            <View
              style={styles.artTowerThree}
            />

          </View>

        </View>


        {/* =================================================
            FORM
        ================================================= */}

        <View
          style={styles.form}
        >

          {/* -----------------------------------------------
              PHONE
          ----------------------------------------------- */}

          <View
            style={styles.field}
          >

            <Text
              style={styles.label}
            >
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


          {/* -----------------------------------------------
              PASSWORD
          ----------------------------------------------- */}

          <View
            style={styles.field}
          >

            <View
              style={styles.passwordLabelRow}
            >

              <Text
                style={styles.label}
              >
                Password
              </Text>

            </View>


            <View
              style={
                styles.passwordContainer
              }
            >

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
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
                style={
                  styles.eyeButton
                }
                hitSlop={8}
              >

                <Ionicons
                  name={
                    showPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={20}
                  color={
                    BrandColors.textSecondary
                  }
                />

              </Pressable>

            </View>

          </View>


          {/* -----------------------------------------------
              FORGOT PASSWORD
          ----------------------------------------------- */}

          <Pressable
            onPress={() =>
              router.push(
                '/forgot-password'
              )
            }
            disabled={loading}
            style={
              styles.forgotButton
            }
          >

            <Text
              style={
                styles.forgotText
              }
            >
              Forgot password?
            </Text>

          </Pressable>


          {/* -----------------------------------------------
              LOGIN
          ----------------------------------------------- */}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.loginButton,

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
                  styles.loginButtonText
                }
              >
                Login
              </Text>

            )}

          </Pressable>


          {/* =================================================
              SOCIAL DIVIDER
          ================================================= */}

          <View
            style={styles.orRow}
          >

            <View
              style={styles.divider}
            />

            <Text
              style={styles.orText}
            >
              or continue with
            </Text>

            <View
              style={styles.divider}
            />

          </View>


          {/* =================================================
              SOCIAL BUTTONS
          ================================================= */}

          <View
            style={styles.socialRow}
          >

            <Pressable
              disabled={loading}
              style={styles.socialButton}
            >

              <Ionicons
                name="logo-google"
                size={20}
                color="#4285F4"
              />

            </Pressable>


            <Pressable
              disabled={loading}
              style={styles.socialButton}
            >

              <Ionicons
                name="logo-apple"
                size={22}
                color={BrandColors.text}
              />

            </Pressable>

          </View>


          {/* =================================================
              REGISTER
          ================================================= */}

          <View
            style={styles.registerRow}
          >

            <Text
              style={styles.registerText}
            >
              Don't have an account?
            </Text>


            <Pressable
              onPress={openRegister}
              disabled={loading}
            >

              <Text
                style={
                  styles.registerLink
                }
              >
                Register
              </Text>

            </Pressable>

          </View>

        </View>

      </ScrollView>

    </KeyboardAvoidingView>

  );

}


/*
=========================================================
STYLES
=========================================================
*/

const styles =
  StyleSheet.create({

    screen: {

      flex: 1,

      backgroundColor:
        BrandColors.background,

    },


    container: {

      flexGrow: 1,

      paddingHorizontal:
        24,

      paddingTop:
        20,

      paddingBottom:
        35,

    },


    /*
    -------------------------------------------------------
    BACK
    -------------------------------------------------------
    */

    backButton: {

      width:
        40,

      height:
        40,

      justifyContent:
        'center',

      alignItems:
        'flex-start',

    },


    /*
    -------------------------------------------------------
    HEADER
    -------------------------------------------------------
    */

    header: {

      width:
        '100%',

      minHeight:
        105,

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'flex-start',

      marginTop:
        12,

      marginBottom:
        30,

    },


    title: {

      fontSize:
        25,

      fontWeight:
        '800',

      color:
        BrandColors.text,

      letterSpacing:
        -0.4,

    },


    subtitle: {

      marginTop:
        6,

      fontSize:
        13,

      color:
        BrandColors.textSecondary,

    },


    /*
    -------------------------------------------------------
    HEADER ART
    -------------------------------------------------------
    */

    headerArt: {

      width:
        92,

      height:
        70,

      position:
        'relative',

      opacity:
        0.7,

    },


    artTowerOne: {

      position:
        'absolute',

      bottom:
        5,

      left:
        5,

      width:
        20,

      height:
        38,

      borderTopLeftRadius:
        9,

      borderTopRightRadius:
        9,

      backgroundColor:
        BrandColors.primaryLight,

    },


    artTowerTwo: {

      position:
        'absolute',

      bottom:
        0,

      left:
        34,

      width:
        23,

      height:
        50,

      borderTopLeftRadius:
        10,

      borderTopRightRadius:
        10,

      backgroundColor:
        BrandColors.primaryLight,

    },


    artTowerThree: {

      position:
        'absolute',

      bottom:
        8,

      right:
        4,

      width:
        20,

      height:
        32,

      borderTopLeftRadius:
        9,

      borderTopRightRadius:
        9,

      backgroundColor:
        BrandColors.primaryLight,

    },


    /*
    -------------------------------------------------------
    FORM
    -------------------------------------------------------
    */

    form: {

      width:
        '100%',

    },


    field: {

      width:
        '100%',

      marginBottom:
        18,

    },


    label: {

      fontSize:
        12,

      fontWeight:
        '700',

      color:
        BrandColors.text,

      marginBottom:
        8,

    },


    input: {

      width:
        '100%',

      height:
        48,

      borderWidth:
        1,

      borderColor:
        BrandColors.border,

      borderRadius:
        9,

      paddingHorizontal:
        13,

      backgroundColor:
        BrandColors.background,

      fontSize:
        14,

      color:
        BrandColors.text,

    },


    /*
    -------------------------------------------------------
    PASSWORD
    -------------------------------------------------------
    */

    passwordLabelRow: {

      flexDirection:
        'row',

      alignItems:
        'center',

    },


    passwordContainer: {

      width:
        '100%',

      height:
        48,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderWidth:
        1,

      borderColor:
        BrandColors.border,

      borderRadius:
        9,

      backgroundColor:
        BrandColors.background,

    },


    passwordInput: {

      flex:
        1,

      height:
        '100%',

      paddingHorizontal:
        13,

      fontSize:
        14,

      color:
        BrandColors.text,

    },


    eyeButton: {

      width:
        44,

      height:
        '100%',

      alignItems:
        'center',

      justifyContent:
        'center',

    },


    /*
    -------------------------------------------------------
    FORGOT
    -------------------------------------------------------
    */

    forgotButton: {

      alignSelf:
        'flex-end',

      marginTop:
        -7,

      marginBottom:
        18,

    },


    forgotText: {

      fontSize:
        12,

      fontWeight:
        '700',

      color:
        BrandColors.primary,

    },


    /*
    -------------------------------------------------------
    LOGIN BUTTON
    -------------------------------------------------------
    */

    loginButton: {

      width:
        '100%',

      height:
        48,

      borderRadius:
        9,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        BrandColors.primary,

    },


    loginButtonText: {

      fontSize:
        14,

      fontWeight:
        '800',

      color:
        BrandColors.white,

    },


    disabledButton: {

      opacity:
        0.6,

    },


    buttonPressed: {

      opacity:
        0.82,

    },


    /*
    -------------------------------------------------------
    OR
    -------------------------------------------------------
    */

    orRow: {

      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop:
        22,

      marginBottom:
        17,

    },


    divider: {

      flex:
        1,

      height:
        1,

      backgroundColor:
        BrandColors.borderLight,

    },


    orText: {

      marginHorizontal:
        10,

      fontSize:
        11,

      color:
        BrandColors.textSecondary,

    },


    /*
    -------------------------------------------------------
    SOCIAL
    -------------------------------------------------------
    */

    socialRow: {

      flexDirection:
        'row',

      justifyContent:
        'center',

      gap:
        12,

    },


    socialButton: {

      width:
        54,

      height:
        42,

      borderWidth:
        1,

      borderColor:
        BrandColors.border,

      borderRadius:
        9,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        BrandColors.background,

    },


    /*
    -------------------------------------------------------
    REGISTER
    -------------------------------------------------------
    */

    registerRow: {

      flexDirection:
        'row',

      justifyContent:
        'center',

      alignItems:
        'center',

      marginTop:
        25,

    },


    registerText: {

      fontSize:
        12,

      color:
        BrandColors.textSecondary,

    },


    registerLink: {

      marginLeft:
        4,

      fontSize:
        12,

      fontWeight:
        '800',

      color:
        BrandColors.primary,

    },


    /*
    -------------------------------------------------------
    DEVICE VERIFICATION
    -------------------------------------------------------
    */

    verificationHeader: {

      width:
        '100%',

      alignItems:
        'center',

      marginTop:
        24,

      marginBottom:
        32,

    },


    verificationIcon: {

      width:
        64,

      height:
        64,

      borderRadius:
        32,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        BrandColors.primaryLight,

      marginBottom:
        18,

    },


    verificationSubtitle: {

      marginTop:
        10,

      maxWidth:
        310,

      textAlign:
        'center',

      fontSize:
        13,

      lineHeight:
        20,

      color:
        BrandColors.textSecondary,

    },


    verificationInput: {

      textAlign:
        'center',

      fontSize:
        20,

      fontWeight:
        '700',

      letterSpacing:
        6,

    },


    verificationHelp: {

      marginTop:
        18,

      textAlign:
        'center',

      fontSize:
        11,

      lineHeight:
        17,

      color:
        BrandColors.textSecondary,

    },

  });