import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  StatusBar,
} from 'react-native';

import { router } from 'expo-router';

import {
  BrandColors,
} from '../constants/theme';


/*
=========================================================
KADUNA ONLY SPLASH SCREEN
=========================================================
*/

export default function WelcomeScreen() {

  function continueAsRider() {

    router.push('/login');

  }


  function continueAsDriver() {

    router.push('/login');

  }


  function createAccount() {

    router.push('/register');

  }


  return (

    <View style={styles.screen}>

      <StatusBar
        barStyle="light-content"
        backgroundColor={
          BrandColors.primary
        }
      />


      <SafeAreaView
        style={styles.safeArea}
      >

        <View
          style={styles.container}
        >

          {/* =================================================
              BRAND LOGO
          ================================================= */}

          <View
            style={styles.brandArea}
          >

            <View
              style={styles.logoMark}
            >

              <View
                style={styles.logoTowerLeft}
              />

              <View
                style={styles.logoTowerCenter}
              />

              <View
                style={styles.logoTowerRight}
              />

            </View>


            <Text
              style={styles.brandKaduna}
            >
              KADUNA
            </Text>


            <Text
              style={styles.brandOnly}
            >
              ONLY
            </Text>


            <Text
              style={styles.tagline}
            >
              Your City. Your Ride.
            </Text>

          </View>


          {/* =================================================
              SPACER
          ================================================= */}

          <View
            style={styles.middleSpace}
          />


          {/* =================================================
              ACTIONS
          ================================================= */}

          <View
            style={styles.actions}
          >

            {/* -----------------------------------------------
                RIDER
            ----------------------------------------------- */}

            <Pressable
              onPress={
                continueAsRider
              }
              style={({ pressed }) => [
                styles.riderButton,

                pressed &&
                  styles.buttonPressed,
              ]}
            >

              <Text
                style={
                  styles.riderButtonText
                }
              >
                Continue as Rider
              </Text>

            </Pressable>


            {/* -----------------------------------------------
                DRIVER
            ----------------------------------------------- */}

            <Pressable
              onPress={
                continueAsDriver
              }
              style={({ pressed }) => [
                styles.driverButton,

                pressed &&
                  styles.buttonPressed,
              ]}
            >

              <Text
                style={
                  styles.driverButtonText
                }
              >
                Continue as Driver
              </Text>

            </Pressable>


            {/* -----------------------------------------------
                REGISTER
            ----------------------------------------------- */}

            <Pressable
              onPress={
                createAccount
              }
              style={styles.registerButton}
            >

              <Text
                style={
                  styles.registerText
                }
              >
                New here?{' '}
                <Text
                  style={
                    styles.registerTextStrong
                  }
                >
                  Create an account
                </Text>
              </Text>

            </Pressable>

          </View>

        </View>

      </SafeAreaView>

    </View>

  );

}


/*
=========================================================
STYLES
=========================================================
*/

const styles =
  StyleSheet.create({

    /*
    -------------------------------------------------------
    SCREEN
    -------------------------------------------------------
    */

    screen: {

      flex: 1,

      backgroundColor:
        BrandColors.primary,

    },


    safeArea: {

      flex: 1,

    },


    container: {

      flex: 1,

      paddingHorizontal:
        30,

      paddingTop:
        55,

      paddingBottom:
        30,

    },


    /*
    -------------------------------------------------------
    BRAND
    -------------------------------------------------------
    */

    brandArea: {

      alignItems:
        'center',

      marginTop:
        35,

    },


    /*
    -------------------------------------------------------
    LOGO MARK
    -------------------------------------------------------
    */

    logoMark: {

      width:
        70,

      height:
        68,

      position:
        'relative',

      marginBottom:
        14,

    },


    logoTowerLeft: {

      position:
        'absolute',

      left:
        6,

      bottom:
        8,

      width:
        16,

      height:
        39,

      borderTopLeftRadius:
        7,

      borderTopRightRadius:
        7,

      backgroundColor:
        BrandColors.warning,

    },


    logoTowerCenter: {

      position:
        'absolute',

      left:
        27,

      bottom:
        4,

      width:
        17,

      height:
        48,

      borderTopLeftRadius:
        8,

      borderTopRightRadius:
        8,

      backgroundColor:
        BrandColors.warning,

    },


    logoTowerRight: {

      position:
        'absolute',

      right:
        5,

      bottom:
        8,

      width:
        16,

      height:
        39,

      borderTopLeftRadius:
        7,

      borderTopRightRadius:
        7,

      backgroundColor:
        BrandColors.warning,

    },


    /*
    -------------------------------------------------------
    BRAND TEXT
    -------------------------------------------------------
    */

    brandKaduna: {

      fontSize:
        29,

      lineHeight:
        31,

      fontWeight:
        '900',

      letterSpacing:
        1.1,

      color:
        BrandColors.white,

    },


    brandOnly: {

      fontSize:
        29,

      lineHeight:
        31,

      fontWeight:
        '900',

      letterSpacing:
        1.1,

      color:
        BrandColors.warning,

    },


    tagline: {

      marginTop:
        8,

      fontSize:
        14,

      fontWeight:
        '500',

      color:
        BrandColors.white,

      opacity:
        0.95,

    },


    /*
    -------------------------------------------------------
    SPACING
    -------------------------------------------------------
    */

    middleSpace: {

      flex: 1,

    },


    /*
    -------------------------------------------------------
    ACTIONS
    -------------------------------------------------------
    */

    actions: {

      width:
        '100%',

      alignItems:
        'center',

    },


    /*
    -------------------------------------------------------
    RIDER BUTTON
    -------------------------------------------------------
    */

    riderButton: {

      width:
        '100%',

      height:
        54,

      borderRadius:
        11,

      backgroundColor:
        BrandColors.warning,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        10,

    },


    riderButtonText: {

      fontSize:
        15,

      fontWeight:
        '800',

      color:
        '#171717',

    },


    /*
    -------------------------------------------------------
    DRIVER BUTTON
    -------------------------------------------------------
    */

    driverButton: {

      width:
        '100%',

      height:
        54,

      borderRadius:
        11,

      borderWidth:
        1,

      borderColor:
        BrandColors.white,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'transparent',

    },


    driverButtonText: {

      fontSize:
        15,

      fontWeight:
        '700',

      color:
        BrandColors.white,

    },


    /*
    -------------------------------------------------------
    REGISTER
    -------------------------------------------------------
    */

    registerButton: {

      marginTop:
        24,

      paddingVertical:
        8,

    },


    registerText: {

      fontSize:
        13,

      color:
        BrandColors.white,

      opacity:
        0.92,

    },


    registerTextStrong: {

      fontWeight:
        '800',

      color:
        BrandColors.white,

    },


    /*
    -------------------------------------------------------
    PRESS
    -------------------------------------------------------
    */

    buttonPressed: {

      opacity:
        0.82,

      transform: [
        {
          scale:
            0.985,
        },
      ],

    },

  });