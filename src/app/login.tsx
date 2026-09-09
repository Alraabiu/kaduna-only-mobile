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
      `kaduna-mobile-${Platform.OS}`;


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



    console.log(
      '[MOBILE LOGIN RESPONSE]',
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
        'Login failed. Invalid server response.'
      );

    }



    const token =
      result.data.token;



    const user =
      result.data.user;



    /*
    =====================================================
    SAVE AUTH
    =====================================================
    */


    await saveAuth(
      user,
      token
    );



    setAuthToken(
      token
    );



    console.log(
      '[MOBILE LOGIN] Authentication saved'
    );


    console.log(
      '[MOBILE LOGIN] Role:',
      user.role
    );



    /*
    =====================================================
    ROLE ROUTING
    =====================================================
    */


    const role =
      String(
        user?.role || ''
      )
        .trim()
        .toLowerCase();



    if (
      role === 'driver'
    ) {

      router.replace(
        '/driver'
      );

      return;

    }



    if (
      role === 'rider'
    ) {

      router.replace(
        '/rider'
      );

      return;

    }



    if (
      role === 'admin'
    ) {

      Alert.alert(
        'Login Successful',
        'Admin account detected. The mobile admin dashboard will be added next.'
      );

      return;

    }



    Alert.alert(
      'Login Error',
      `Unknown account role: ${user.role}`
    );


  } catch (
    error: any
  ) {


    console.log(
      '[MOBILE LOGIN ERROR]',
      error
    );



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

          <Text
            style={styles.backIcon}
          >
            ‹
          </Text>

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
              >

                <Text
                  style={styles.eyeIcon}
                >
                  {showPassword ? '◉' : '◌'}
                </Text>

              </Pressable>

            </View>

          </View>


          {/* -----------------------------------------------
              FORGOT PASSWORD
          ----------------------------------------------- */}

          <Pressable
            onPress={() =>
              Alert.alert(
                'Forgot Password',
                'Password recovery will be connected to the Kaduna Only account system.'
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

              <Text
                style={styles.googleText}
              >
                G
              </Text>

            </Pressable>


            <Pressable
              disabled={loading}
              style={styles.socialButton}
            >

              <Text
                style={styles.appleText}
              >
                
              </Text>

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


    backIcon: {

      fontSize:
        34,

      lineHeight:
        34,

      fontWeight:
        '300',

      color:
        BrandColors.text,

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


    eyeIcon: {

      fontSize:
        18,

      color:
        BrandColors.textSecondary,

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


    googleText: {

      fontSize:
        19,

      fontWeight:
        '800',

      color:
        '#4285F4',

    },


    appleText: {

      fontSize:
        22,

      color:
        BrandColors.text,

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

  });