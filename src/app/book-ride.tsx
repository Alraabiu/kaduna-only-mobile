import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { router } from 'expo-router';

import api, {
  setAuthToken,
} from '../services/api';

import {
  getStoredToken,
} from '../storage/auth';


/*
=========================================================
KADUNA ONLY BRAND
=========================================================
*/

const PURPLE = '#4B24A8';
const DARK_PURPLE = '#321276';
const LIGHT_PURPLE = '#F2EEFF';
const PALE_PURPLE = '#F8F6FF';

const GOLD = '#F5B800';
const LIGHT_GOLD = '#FFF7D6';

const WHITE = '#FFFFFF';

const BACKGROUND = '#F7F7FA';

const TEXT = '#202124';
const MUTED = '#7A7D85';
const BORDER = '#E5E3EA';

const GREEN = '#20A36A';
const RED = '#D64545';


/*
=========================================================
TYPES
=========================================================
*/

type VehicleType =
  | 'keke'
  | 'car'
  | 'motorcycle';

type KekeRideType =
  | 'single_seat'
  | 'private';

type PaymentMethod =
  | 'cash'
  | 'wallet';


type LocationResult = {

  placeId: string;

  label: string;

  shortLabel: string;

  lat: number;

  lng: number;

  type?: string;

};


type Quote = {

  currency: string;

  distanceKm: number;

  estimatedMinutes: number;

  fare: number;

  farePerPassenger?: number;

  kekeRideType?: string;

  passengerCapacity?: number;

  pricingBasis?: string;

  pricingVersion?: string;

  privateFare?: number;

  routeGeometry?: any;

  routingSource?: string;

  singleSeatFare?: number;

  vehicleType?: string;

};


/*
=========================================================
HELPERS
=========================================================
*/

function formatMoney(
  amount: number
) {

  return `₦${Number(
    amount || 0
  ).toLocaleString('en-NG')}`;

}


function formatDistance(
  distance: number
) {

  if (
    !Number.isFinite(
      Number(distance)
    )
  ) {

    return '--';

  }

  return `${Number(
    distance
  ).toFixed(1)} km`;

}


function formatDuration(
  minutes: number
) {

  const value =
    Number(minutes);


  if (
    !Number.isFinite(value)
  ) {

    return '--';

  }


  if (
    value < 60
  ) {

    return `${Math.round(value)} min`;

  }


  const hours =
    Math.floor(value / 60);


  const remaining =
    Math.round(value % 60);


  if (
    remaining === 0
  ) {

    return `${hours} hr`;

  }


  return `${hours} hr ${remaining} min`;

}


/*
=========================================================
VEHICLE BUTTON
=========================================================
*/

function VehicleButton({
  active,
  icon,
  title,
  subtitle,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {

  return (

    <Pressable
      onPress={onPress}
      style={[
        styles.vehicleButton,
        active &&
          styles.vehicleButtonActive,
      ]}
    >

      <View
        style={[
          styles.vehicleIcon,
          active &&
            styles.vehicleIconActive,
        ]}
      >

        <Ionicons
          name={icon}
          size={22}
          color={
            active
              ? WHITE
              : PURPLE
          }
        />

      </View>


      <View style={styles.vehicleText}>

        <Text
          style={[
            styles.vehicleTitle,
            active &&
              styles.vehicleTitleActive,
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.vehicleSubtitle,
            active &&
              styles.vehicleSubtitleActive,
          ]}
        >
          {subtitle}
        </Text>

      </View>


      {active && (

        <View style={styles.vehicleCheck}>

          <Ionicons
            name="checkmark"
            size={15}
            color={PURPLE}
          />

        </View>

      )}

    </Pressable>

  );

}


/*
=========================================================
BOOK RIDE
=========================================================
*/

export default function BookRide() {

  /*
  =======================================================
  LOCATIONS
  =======================================================
  */

  const [
    pickupText,
    setPickupText,
  ] = useState('');

  const [
    destinationText,
    setDestinationText,
  ] = useState('');


  const [
    pickup,
    setPickup,
  ] = useState<LocationResult | null>(
    null
  );


  const [
    destination,
    setDestination,
  ] = useState<LocationResult | null>(
    null
  );


  /*
  =======================================================
  SEARCH RESULTS
  =======================================================
  */

  const [
    pickupResults,
    setPickupResults,
  ] = useState<LocationResult[]>(
    []
  );


  const [
    destinationResults,
    setDestinationResults,
  ] = useState<LocationResult[]>(
    []
  );


  const [
    searchingPickup,
    setSearchingPickup,
  ] = useState(false);


  const [
    searchingDestination,
    setSearchingDestination,
  ] = useState(false);


  const [
    activeField,
    setActiveField,
  ] = useState<
    'pickup' |
    'destination' |
    null
  >(null);


  /*
  =======================================================
  VEHICLE
  =======================================================
  */

  const [
    vehicleType,
    setVehicleType,
  ] = useState<VehicleType>(
    'keke'
  );


  const [
    kekeRideType,
    setKekeRideType,
  ] = useState<KekeRideType>(
    'single_seat'
  );


  /*
  =======================================================
  PAYMENT
  =======================================================
  */

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>(
    'wallet'
  );


  /*
  =======================================================
  QUOTE
  =======================================================
  */

  const [
    quote,
    setQuote,
  ] = useState<Quote | null>(
    null
  );


  const [
    loadingQuote,
    setLoadingQuote,
  ] = useState(false);


  const [
    booking,
    setBooking,
  ] = useState(false);


  /*
  =======================================================
  SEARCH TIMERS
  =======================================================
  */

  const pickupTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);


  const destinationTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);


  /*
  =======================================================
  AUTHENTICATION
  =======================================================
  */

  async function prepareAuthentication() {

    const token =
      await getStoredToken();


    if (!token) {

      setAuthToken();


      Alert.alert(
        'Session expired',
        'Please log in again.',
        [
          {
            text: 'OK',

            onPress: () =>
              router.replace(
                '/login'
              ),
          },
        ]
      );


      return false;

    }


    setAuthToken(
      token
    );


    return true;

  }


  /*
  =======================================================
  LOCATION SEARCH
  =======================================================
  */

  async function searchLocation(
    query: string,
    field:
      'pickup' |
      'destination'
  ) {

    const cleanQuery =
      query.trim();


    if (
      cleanQuery.length < 3
    ) {

      if (
        field === 'pickup'
      ) {

        setPickupResults([]);

      } else {

        setDestinationResults([]);

      }

      return;

    }


    const authenticated =
      await prepareAuthentication();


    if (!authenticated) {

      return;

    }


    if (
      field === 'pickup'
    ) {

      setSearchingPickup(true);

    } else {

      setSearchingDestination(true);

    }


    try {

      console.log(
        `[MOBILE MAP SEARCH] Searching ${field}:`,
        cleanQuery
      );


      const response =
        await api.get(
          '/maps/search',
          {
            params: {
              q: cleanQuery,
            },
          }
        );


      const results =
        response?.data?.data?.results ||
        response?.data?.results ||
        [];


      if (
        field === 'pickup'
      ) {

        setPickupResults(
          results
        );

      } else {

        setDestinationResults(
          results
        );

      }


    } catch (
      error: any
    ) {

      console.log(
        '[MOBILE MAP SEARCH ERROR]',
        error
      );


      const status =
        error?.response?.status;


      if (
        status === 401
      ) {

        setAuthToken();


        Alert.alert(
          'Session expired',
          'Please log in again.',
          [
            {
              text: 'OK',

              onPress: () =>
                router.replace(
                  '/login'
                ),
            },
          ]
        );


        return;

      }


      /*
       * Do not repeatedly interrupt the user
       * while typing.
       */

      if (
        status !== 400
      ) {

        Alert.alert(
          'Location search',
          'Unable to search this location right now. Please try again.'
        );

      }


    } finally {

      if (
        field === 'pickup'
      ) {

        setSearchingPickup(false);

      } else {

        setSearchingDestination(false);

      }

    }

  }


  /*
  =======================================================
  PICKUP CHANGE
  =======================================================
  */

  function handlePickupChange(
    value: string
  ) {

    setPickupText(
      value
    );

    setPickup(
      null
    );

    setQuote(
      null
    );


    if (
      pickupTimer.current
    ) {

      clearTimeout(
        pickupTimer.current
      );

    }


    pickupTimer.current =
      setTimeout(
        () => {

          searchLocation(
            value,
            'pickup'
          );

        },
        650
      );

  }


  /*
  =======================================================
  DESTINATION CHANGE
  =======================================================
  */

  function handleDestinationChange(
    value: string
  ) {

    setDestinationText(
      value
    );

    setDestination(
      null
    );

    setQuote(
      null
    );


    if (
      destinationTimer.current
    ) {

      clearTimeout(
        destinationTimer.current
      );

    }


    destinationTimer.current =
      setTimeout(
        () => {

          searchLocation(
            value,
            'destination'
          );

        },
        650
      );

  }


  /*
  =======================================================
  SELECT PICKUP
  =======================================================
  */

  function selectPickup(
    location: LocationResult
  ) {

    console.log(
      '[MOBILE MAP] Pickup selected:',
      location
    );


    setPickup(
      location
    );


    setPickupText(
      location.shortLabel ||
      location.label
    );


    setPickupResults([]);

    setActiveField(
      null
    );

    setQuote(
      null
    );

  }


  /*
  =======================================================
  SELECT DESTINATION
  =======================================================
  */

  function selectDestination(
    location: LocationResult
  ) {

    console.log(
      '[MOBILE MAP] Destination selected:',
      location
    );


    setDestination(
      location
    );


    setDestinationText(
      location.shortLabel ||
      location.label
    );


    setDestinationResults([]);

    setActiveField(
      null
    );

    setQuote(
      null
    );

  }


  /*
  =======================================================
  REQUEST QUOTE
  =======================================================
  */

  async function requestQuote() {

    if (!pickup) {

      Alert.alert(
        'Pickup required',
        'Please select your pickup location from the search results.'
      );

      return;

    }


    if (!destination) {

      Alert.alert(
        'Destination required',
        'Please select your destination from the search results.'
      );

      return;

    }


    const authenticated =
      await prepareAuthentication();


    if (!authenticated) {

      return;

    }


    setLoadingQuote(
      true
    );


    setQuote(
      null
    );


    try {

      console.log(
        '[MOBILE BOOK RIDE] Requesting quote'
      );


      const response =
        await api.post(
         '/trips/quote',
          {
            vehicleType,

            kekeRideType:
              vehicleType === 'keke'
                ? kekeRideType
                : 'single_seat',

            pickup: {
              label:
                pickup.label,

              lat:
                pickup.lat,

              lng:
                pickup.lng,
            },

            destination: {
              label:
                destination.label,

              lat:
                destination.lat,

              lng:
                destination.lng,
            },
          }
        );


      console.log(
        '[MOBILE BOOK RIDE] Quote response',
        response.data
      );


      const receivedQuote =
        response?.data?.data?.quote ||
        response?.data?.quote;


      if (!receivedQuote) {

        throw new Error(
          'No quote returned by server'
        );

      }


      setQuote(
        receivedQuote
      );


    } catch (
      error: any
    ) {

      console.log(
        '[MOBILE BOOK RIDE QUOTE ERROR]',
        error
      );


      const status =
        error?.response?.status;


      const message =
        error?.response?.data?.message;


      if (
        status === 401
      ) {

        setAuthToken();


        Alert.alert(
          'Session expired',
          'Please log in again.',
          [
            {
              text: 'OK',

              onPress: () =>
                router.replace(
                  '/login'
                ),
            },
          ]
        );


        return;

      }


      Alert.alert(
        'Unable to get fare',
        message ||
          'We could not calculate the fare for this route.'
      );


    } finally {

      setLoadingQuote(
        false
      );

    }

  }


  /*
  =======================================================
  CREATE TRIP
  =======================================================
  */

  async function createTrip() {

    if (
      !pickup ||
      !destination
    ) {

      Alert.alert(
        'Locations required',
        'Please select both pickup and destination.'
      );

      return;

    }


    /*
     * If the quote is not available,
     * the button acts as the first step
     * and gets the authoritative quote.
     */

    if (!quote) {

      await requestQuote();

      return;

    }


    const authenticated =
      await prepareAuthentication();


    if (!authenticated) {

      return;

    }


    setBooking(
      true
    );


    try {

      console.log(
        '[MOBILE BOOK RIDE] Creating trip'
      );


      const response =
        await api.post(
          '/trips',
          {
            vehicleType,

            kekeRideType:
              vehicleType === 'keke'
                ? kekeRideType
                : 'single_seat',

            pickup: {
              label:
                pickup.label,

              lat:
                pickup.lat,

              lng:
                pickup.lng,
            },

            destination: {
              label:
                destination.label,

              lat:
                destination.lat,

              lng:
                destination.lng,
            },

            paymentMethod,
          }
        );


      console.log(
        '[MOBILE BOOK RIDE] Trip created',
        response.data
      );


      const trip =
        response?.data?.data?.trip;


      Alert.alert(
        'Ride requested',
        'Your ride request has been created successfully.',
        [
          {
            text: 'View Ride',

            onPress: () => {

              if (
                trip?._id
              ) {

                router.replace(
                  `/trip/${trip._id}` as any
                );

              } else {

                router.replace(
                  '/rider'
                );

              }

            },
          },
        ]
      );


    } catch (
      error: any
    ) {

      console.log(
        '[MOBILE BOOK RIDE ERROR]',
        error
      );


      const status =
        error?.response?.status;


      const message =
        error?.response?.data?.message;


      if (
        status === 401
      ) {

        setAuthToken();


        Alert.alert(
          'Session expired',
          'Please log in again.',
          [
            {
              text: 'OK',

              onPress: () =>
                router.replace(
                  '/login'
                ),
            },
          ]
        );


        return;

      }


      if (
        status === 402
      ) {

        Alert.alert(
          'Insufficient wallet balance',

          message ||
            'Your wallet balance is not enough to pay for this ride.',

          [
            {
              text: 'Cancel',
              style: 'cancel',
            },

            {
              text: 'Fund Wallet',

              onPress: () =>
                router.push(
                  '/wallet'
                ),
            },
          ]
        );


        return;

      }


      if (
        status === 409
      ) {

        Alert.alert(
          'Active ride exists',

          message ||
            'You already have an active trip.'
        );


        return;

      }


      if (
        status === 400
      ) {

        Alert.alert(
          'Unable to book ride',

          message ||
            'Please check your pickup and destination.'
        );


        return;

      }


      Alert.alert(
        'Booking failed',

        message ||
          'We could not create the ride. Please try again.'
      );

    } finally {

      setBooking(
        false
      );

    }

  }


  /*
  =======================================================
  CHANGE VEHICLE
  =======================================================
  */

  function changeVehicle(
    type: VehicleType
  ) {

    setVehicleType(
      type
    );

    setQuote(
      null
    );

  }


  /*
  =======================================================
  CHANGE KEKE RIDE TYPE
  =======================================================
  */

  function changeKekeType(
    type: KekeRideType
  ) {

    setKekeRideType(
      type
    );

    setQuote(
      null
    );

  }


  /*
  =======================================================
  CLEANUP
  =======================================================
  */

  useEffect(
    () => {

      return () => {

        if (
          pickupTimer.current
        ) {

          clearTimeout(
            pickupTimer.current
          );

        }


        if (
          destinationTimer.current
        ) {

          clearTimeout(
            destinationTimer.current
          );

        }

      };

    },
    []
  );


  /*
  =======================================================
  CTA STATE
  =======================================================
  */

  const canContinue =
    Boolean(
      pickup &&
      destination
    );


  const buttonBusy =
    loadingQuote ||
    booking;


  /*
  =======================================================
  RENDER
  =======================================================
  */

  return (

    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <View style={styles.header}>

        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
          hitSlop={8}
        >

          <Ionicons
            name="chevron-back"
            size={23}
            color={TEXT}
          />

        </Pressable>


        <View style={styles.headerCenter}>

          <Text style={styles.headerTitle}>
            Book a Ride
          </Text>

          <Text style={styles.headerSubtitle}>
            Your City. Your Ride.
          </Text>

        </View>


        <View style={styles.headerRight} />

      </View>


      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          styles.content
        }
      >

        {/* =================================================
            TITLE
        ================================================= */}

        <View style={styles.intro}>

          <Text style={styles.pageTitle}>
            Where are you going?
          </Text>

          <Text style={styles.pageSubtitle}>
            Choose your pickup and destination.
          </Text>

        </View>


        {/* =================================================
            LOCATION CARD
        ================================================= */}

        <View style={styles.locationCard}>

          <View style={styles.locationTimeline}>

            <View
              style={
                styles.pickupTimelineDot
              }
            />

            <View
              style={
                styles.timelineLine
              }
            />

            <View
              style={
                styles.destinationTimelineDot
              }
            />

          </View>


          <View style={styles.locationContent}>

            {/* PICKUP */}

            <Text style={styles.fieldLabel}>
              PICKUP LOCATION
            </Text>


            <View
              style={[
                styles.locationInputBox,
                activeField === 'pickup' &&
                  styles.locationInputBoxActive,
              ]}
            >

              <Ionicons
                name="location"
                size={19}
                color={PURPLE}
              />


              <TextInput
                value={pickupText}
                onChangeText={
                  handlePickupChange
                }
                onFocus={() =>
                  setActiveField(
                    'pickup'
                  )
                }
                placeholder="Enter pickup location"
                placeholderTextColor="#9B9DA4"
                style={
                  styles.locationInput
                }
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="next"
              />


              {searchingPickup && (

                <ActivityIndicator
                  size="small"
                  color={PURPLE}
                />

              )}

            </View>


            {/* PICKUP RESULTS */}

            {activeField === 'pickup' &&
              pickupResults.length > 0 && (

                <View
                  style={
                    styles.resultsCard
                  }
                >

                  {pickupResults
                    .slice(0, 5)
                    .map(
                      (
                        item,
                        index
                      ) => (

                        <Pressable
                          key={
                            `${item.placeId}-${index}`
                          }
                          onPress={() =>
                            selectPickup(
                              item
                            )
                          }
                          style={
                            styles.resultItem
                          }
                        >

                          <View
                            style={
                              styles.resultIcon
                            }
                          >

                            <Ionicons
                              name="location-outline"
                              size={18}
                              color={PURPLE}
                            />

                          </View>


                          <View
                            style={
                              styles.resultText
                            }
                          >

                            <Text
                              style={
                                styles.resultTitle
                              }
                              numberOfLines={1}
                            >
                              {
                                item.shortLabel ||
                                item.label
                              }
                            </Text>


                            <Text
                              style={
                                styles.resultSubtitle
                              }
                              numberOfLines={2}
                            >
                              {item.label}
                            </Text>

                          </View>


                          <Ionicons
                            name="chevron-forward"
                            size={17}
                            color="#A2A3A8"
                          />

                        </Pressable>

                      )
                    )}

                </View>

              )}


            <View style={styles.fieldSpacing} />


            {/* DESTINATION */}

            <Text style={styles.fieldLabel}>
              DESTINATION
            </Text>


            <View
              style={[
                styles.locationInputBox,
                activeField === 'destination' &&
                  styles.locationInputBoxActive,
              ]}
            >

              <Ionicons
                name="navigate"
                size={18}
                color={RED}
              />


              <TextInput
                value={destinationText}
                onChangeText={
                  handleDestinationChange
                }
                onFocus={() =>
                  setActiveField(
                    'destination'
                  )
                }
                placeholder="Where are you going?"
                placeholderTextColor="#9B9DA4"
                style={
                  styles.locationInput
                }
                autoCorrect={false}
                autoCapitalize="words"
                returnKeyType="done"
              />


              {searchingDestination && (

                <ActivityIndicator
                  size="small"
                  color={PURPLE}
                />

              )}

            </View>


            {/* DESTINATION RESULTS */}

            {activeField === 'destination' &&
              destinationResults.length > 0 && (

                <View
                  style={
                    styles.resultsCard
                  }
                >

                  {destinationResults
                    .slice(0, 5)
                    .map(
                      (
                        item,
                        index
                      ) => (

                        <Pressable
                          key={
                            `${item.placeId}-${index}`
                          }
                          onPress={() =>
                            selectDestination(
                              item
                            )
                          }
                          style={
                            styles.resultItem
                          }
                        >

                          <View
                            style={
                              styles.resultIcon
                            }
                          >

                            <Ionicons
                              name="navigate-outline"
                              size={18}
                              color={RED}
                            />

                          </View>


                          <View
                            style={
                              styles.resultText
                            }
                          >

                            <Text
                              style={
                                styles.resultTitle
                              }
                              numberOfLines={1}
                            >
                              {
                                item.shortLabel ||
                                item.label
                              }
                            </Text>


                            <Text
                              style={
                                styles.resultSubtitle
                              }
                              numberOfLines={2}
                            >
                              {item.label}
                            </Text>

                          </View>


                          <Ionicons
                            name="chevron-forward"
                            size={17}
                            color="#A2A3A8"
                          />

                        </Pressable>

                      )
                    )}

                </View>

              )}

          </View>

        </View>


        {/* =================================================
            VEHICLE
        ================================================= */}

        <View style={styles.sectionHeader}>

          <Text style={styles.sectionTitle}>
            Choose your ride
          </Text>

        </View>


        <View style={styles.vehicleCard}>

       <VehicleButton
  active={
    vehicleType === 'keke'
  }
  icon="bus-outline"
  title="Keke"
  subtitle="Affordable city ride"
  onPress={() =>
    changeVehicle(
      'keke'
    )
  }
/>


          <VehicleButton
            active={
              vehicleType === 'car'
            }
            icon="car-sport-outline"
            title="Car"
            subtitle="Comfortable private ride"
            onPress={() =>
              changeVehicle(
                'car'
              )
            }
          />


          <VehicleButton
            active={
              vehicleType === 'motorcycle'
            }
            icon="bicycle-outline"
            title="Bike"
            subtitle="Fast and convenient"
            onPress={() =>
              changeVehicle(
                'motorcycle'
              )
            }
          />

        </View>


        {/* =================================================
            KEKE OPTIONS
        ================================================= */}

        {vehicleType === 'keke' && (

          <View style={styles.optionCard}>

            <View style={styles.optionHeader}>

              <View>

                <Text style={styles.optionTitle}>
                  Keke ride type
                </Text>

                <Text style={styles.optionSubtitle}>
                  Choose how you want to ride.
                </Text>

              </View>

            </View>


            <View style={styles.segmentedControl}>

              <Pressable
                onPress={() =>
                  changeKekeType(
                    'single_seat'
                  )
                }
                style={[
                  styles.segment,
                  kekeRideType ===
                    'single_seat' &&
                    styles.segmentActive,
                ]}
              >

                <Text
                  style={[
                    styles.segmentTitle,
                    kekeRideType ===
                      'single_seat' &&
                      styles.segmentTitleActive,
                  ]}
                >
                  Single Seat
                </Text>

                <Text
                  style={[
                    styles.segmentPrice,
                    kekeRideType ===
                      'single_seat' &&
                      styles.segmentPriceActive,
                  ]}
                >
                  ₦500
                </Text>

              </Pressable>


              <Pressable
                onPress={() =>
                  changeKekeType(
                    'private'
                  )
                }
                style={[
                  styles.segment,
                  kekeRideType ===
                    'private' &&
                    styles.segmentActive,
                ]}
              >

                <Text
                  style={[
                    styles.segmentTitle,
                    kekeRideType ===
                      'private' &&
                      styles.segmentTitleActive,
                  ]}
                >
                  Private
                </Text>

                <Text
                  style={[
                    styles.segmentPrice,
                    kekeRideType ===
                      'private' &&
                      styles.segmentPriceActive,
                  ]}
                >
                  ₦2,000
                </Text>

              </Pressable>

            </View>

          </View>

        )}


        {/* =================================================
            PAYMENT
        ================================================= */}

        <View style={styles.sectionHeader}>

          <Text style={styles.sectionTitle}>
            Payment method
          </Text>

        </View>


        <View style={styles.paymentCard}>

          <Pressable
            onPress={() =>
              setPaymentMethod(
                'wallet'
              )
            }
            style={[
              styles.paymentOption,
              paymentMethod ===
                'wallet' &&
                styles.paymentOptionActive,
            ]}
          >

            <View
              style={[
                styles.paymentIcon,
                paymentMethod ===
                  'wallet' &&
                  styles.paymentIconActive,
              ]}
            >

              <Ionicons
                name="wallet-outline"
                size={21}
                color={
                  paymentMethod ===
                  'wallet'
                    ? WHITE
                    : PURPLE
                }
              />

            </View>


            <View
              style={
                styles.paymentText
              }
            >

              <Text
                style={
                  styles.paymentTitle
                }
              >
                Wallet
              </Text>

              <Text
                style={
                  styles.paymentSubtitle
                }
              >
                Pay from your Kaduna Only wallet
              </Text>

            </View>


            <View
              style={[
                styles.radio,
                paymentMethod ===
                  'wallet' &&
                  styles.radioActive,
              ]}
            >

              {paymentMethod ===
                'wallet' && (

                <View
                  style={
                    styles.radioInner
                  }
                />

              )}

            </View>

          </Pressable>


          <View
            style={
              styles.paymentDivider
            }
          />


          <Pressable
            onPress={() =>
              setPaymentMethod(
                'cash'
              )
            }
            style={[
              styles.paymentOption,
              paymentMethod ===
                'cash' &&
                styles.paymentOptionActive,
            ]}
          >

            <View
              style={[
                styles.paymentIcon,
                paymentMethod ===
                  'cash' &&
                  styles.paymentIconActive,
              ]}
            >

              <Ionicons
                name="cash-outline"
                size={21}
                color={
                  paymentMethod ===
                  'cash'
                    ? WHITE
                    : PURPLE
                }
              />

            </View>


            <View
              style={
                styles.paymentText
              }
            >

              <Text
                style={
                  styles.paymentTitle
                }
              >
                Cash
              </Text>

              <Text
                style={
                  styles.paymentSubtitle
                }
              >
                Pay the driver directly
              </Text>

            </View>


            <View
              style={[
                styles.radio,
                paymentMethod ===
                  'cash' &&
                  styles.radioActive,
              ]}
            >

              {paymentMethod ===
                'cash' && (

                <View
                  style={
                    styles.radioInner
                  }
                />

              )}

            </View>

          </Pressable>

        </View>


        {/* =================================================
            FARE PREVIEW
        ================================================= */}

        {quote && (

          <View style={styles.fareCard}>

            <View style={styles.fareHeader}>

              <View>

                <Text
                  style={
                    styles.fareLabel
                  }
                >
                  ESTIMATED FARE
                </Text>


                <Text
                  style={
                    styles.fareAmount
                  }
                >
                  {formatMoney(
                    quote.fare
                  )}
                </Text>

              </View>


              <View
                style={
                  styles.readyBadge
                }
              >

                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={GREEN}
                />

                <Text
                  style={
                    styles.readyText
                  }
                >
                  READY
                </Text>

              </View>

            </View>


            <View
              style={
                styles.fareDivider
              }
            />


            <View
              style={
                styles.fareStats
              }
            >

              <View
                style={
                  styles.fareStat
                }
              >

                <View
                  style={
                    styles.fareStatIcon
                  }
                >

                  <Ionicons
                    name="navigate-outline"
                    size={17}
                    color={PURPLE}
                  />

                </View>


                <View>

                  <Text
                    style={
                      styles.fareStatLabel
                    }
                  >
                    Distance
                  </Text>

                  <Text
                    style={
                      styles.fareStatValue
                    }
                  >
                    {formatDistance(
                      quote.distanceKm
                    )}
                  </Text>

                </View>

              </View>


              <View
                style={
                  styles.fareStat
                }
              >

                <View
                  style={
                    styles.fareStatIcon
                  }
                >

                  <Ionicons
                    name="time-outline"
                    size={17}
                    color={PURPLE}
                  />

                </View>


                <View>

                  <Text
                    style={
                      styles.fareStatLabel
                    }
                  >
                    ETA
                  </Text>

                  <Text
                    style={
                      styles.fareStatValue
                    }
                  >
                    {formatDuration(
                      quote.estimatedMinutes
                    )}
                  </Text>

                </View>

              </View>


              <View
                style={
                  styles.fareStat
                }
              >

                <View
                  style={
                    styles.fareStatIcon
                  }
                >

                  <Ionicons
                    name={
                      paymentMethod ===
                      'wallet'
                        ? 'wallet-outline'
                        : 'cash-outline'
                    }
                    size={17}
                    color={PURPLE}
                  />

                </View>


                <View>

                  <Text
                    style={
                      styles.fareStatLabel
                    }
                  >
                    Payment
                  </Text>

                  <Text
                    style={
                      styles.fareStatValue
                    }
                  >
                    {
                      paymentMethod ===
                      'wallet'
                        ? 'Wallet'
                        : 'Cash'
                    }
                  </Text>

                </View>

              </View>

            </View>

          </View>

        )}


        {/* =================================================
            BOOK A RIDE CTA
        ================================================= */}

        <View
          style={
            styles.ctaContainer
          }
        >

          <Pressable
            onPress={
              createTrip
            }
            disabled={
              buttonBusy
            }
            style={[
              styles.bookButton,

              !canContinue &&
                styles.bookButtonDisabled,

              buttonBusy &&
                styles.bookButtonLoading,
            ]}
          >

            {buttonBusy ? (

              <ActivityIndicator
                size="small"
                color={WHITE}
              />

            ) : (

              <>

                <Ionicons
                  name="car-outline"
                  size={21}
                  color={WHITE}
                />


                <Text
                  style={
                    styles.bookButtonText
                  }
                >
                  BOOK A RIDE
                </Text>


                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color={WHITE}
                />

              </>

            )}

          </Pressable>


          {!canContinue && (

            <Text
              style={
                styles.ctaHint
              }
            >
              Select your pickup and destination to continue.
            </Text>

          )}


          <View
            style={
              styles.securityNote
            }
          >

            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={GREEN}
            />

            <Text
              style={
                styles.securityText
              }
            >
              Secure booking and payment processing
            </Text>

          </View>

        </View>


        <View
          style={
            styles.bottomSpace
          }
        />

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

    /*
    =====================================================
    SCREEN
    =====================================================
    */

    screen: {

      flex: 1,

      backgroundColor:
        BACKGROUND,

    },


    /*
    =====================================================
    HEADER
    =====================================================
    */

    header: {

      height: 82,

      backgroundColor:
        WHITE,

      borderBottomWidth: 1,

      borderBottomColor:
        '#ECEAF0',

      paddingHorizontal: 18,

      paddingTop:
        Platform.OS === 'android'
          ? 17
          : 12,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

    },


    backButton: {

      width: 42,

      height: 42,

      borderRadius: 21,

      alignItems: 'center',

      justifyContent: 'center',

      backgroundColor:
        PALE_PURPLE,

    },


    headerCenter: {

      flex: 1,

      alignItems: 'center',

      justifyContent:
        'center',

    },


    headerTitle: {

      fontSize: 17,

      fontWeight: '800',

      color: TEXT,

    },


    headerSubtitle: {

      marginTop: 2,

      fontSize: 9,

      fontWeight: '600',

      color: MUTED,

    },


    headerRight: {

      width: 42,

    },


    /*
    =====================================================
    CONTENT
    =====================================================
    */

    content: {

      paddingHorizontal: 18,

      paddingTop: 20,

      paddingBottom: 120,

    },


    intro: {

      marginBottom: 17,

    },


    pageTitle: {

      fontSize: 25,

      fontWeight: '900',

      color: TEXT,

      letterSpacing: -0.4,

    },


    pageSubtitle: {

      marginTop: 5,

      fontSize: 13,

      color: MUTED,

    },


    /*
    =====================================================
    LOCATION CARD
    =====================================================
    */

    locationCard: {

      backgroundColor: WHITE,

      borderRadius: 18,

      padding: 16,

      flexDirection: 'row',

      borderWidth: 1,

      borderColor:
        '#EBE9F0',

      shadowColor:
        '#000000',

      shadowOpacity: 0.04,

      shadowRadius: 12,

      shadowOffset: {
        width: 0,
        height: 5,
      },

      elevation: 2,

    },


    locationTimeline: {

      width: 24,

      alignItems: 'center',

      paddingTop: 9,

    },


    pickupTimelineDot: {

      width: 11,

      height: 11,

      borderRadius: 6,

      borderWidth: 3,

      borderColor: PURPLE,

      backgroundColor: WHITE,

    },


    timelineLine: {

      width: 2,

      height: 61,

      backgroundColor:
        '#D7D0E8',

      marginVertical: 2,

    },


    destinationTimelineDot: {

      width: 11,

      height: 11,

      borderRadius: 6,

      backgroundColor: RED,

      borderWidth: 2,

      borderColor: WHITE,

    },


    locationContent: {

      flex: 1,

    },


    fieldLabel: {

      fontSize: 10,

      fontWeight: '800',

      letterSpacing: 0.7,

      color: MUTED,

      marginBottom: 7,

    },


    locationInputBox: {

      minHeight: 49,

      borderRadius: 12,

      backgroundColor:
        '#F8F8FA',

      borderWidth: 1,

      borderColor:
        '#E9E8ED',

      paddingHorizontal: 12,

      flexDirection: 'row',

      alignItems: 'center',

    },


    locationInputBoxActive: {

      borderColor:
        PURPLE,

      backgroundColor:
        '#FBFAFF',

    },


    locationInput: {

      flex: 1,

      marginLeft: 9,

      paddingVertical: 9,

      fontSize: 14,

      fontWeight: '600',

      color: TEXT,

    },


    fieldSpacing: {

      height: 18,

    },


    /*
    =====================================================
    SEARCH RESULTS
    =====================================================
    */

    resultsCard: {

      marginTop: 7,

      borderRadius: 13,

      backgroundColor: WHITE,

      borderWidth: 1,

      borderColor:
        '#E8E6ED',

      overflow: 'hidden',

    },


    resultItem: {

      minHeight: 61,

      paddingHorizontal: 11,

      paddingVertical: 9,

      flexDirection: 'row',

      alignItems: 'center',

      borderBottomWidth: 1,

      borderBottomColor:
        '#F0EFF3',

    },


    resultIcon: {

      width: 36,

      height: 36,

      borderRadius: 18,

      backgroundColor:
        LIGHT_PURPLE,

      alignItems: 'center',

      justifyContent: 'center',

      marginRight: 10,

    },


    resultText: {

      flex: 1,

    },


    resultTitle: {

      fontSize: 13,

      fontWeight: '800',

      color: TEXT,

    },


    resultSubtitle: {

      marginTop: 3,

      fontSize: 10,

      lineHeight: 14,

      color: MUTED,

    },


    /*
    =====================================================
    SECTION
    =====================================================
    */

    sectionHeader: {

      marginTop: 21,

      marginBottom: 10,

    },


    sectionTitle: {

      fontSize: 16,

      fontWeight: '800',

      color: TEXT,

    },


    /*
    =====================================================
    VEHICLE
    =====================================================
    */

    vehicleCard: {

      backgroundColor: WHITE,

      borderRadius: 17,

      borderWidth: 1,

      borderColor:
        '#E9E7EE',

      overflow: 'hidden',

    },


    vehicleButton: {

      minHeight: 72,

      paddingHorizontal: 13,

      flexDirection: 'row',

      alignItems: 'center',

      borderBottomWidth: 1,

      borderBottomColor:
        '#F0EEF3',

    },


    vehicleButtonActive: {

      backgroundColor:
        '#F7F3FF',

    },


    vehicleIcon: {

      width: 43,

      height: 43,

      borderRadius: 13,

      backgroundColor:
        LIGHT_PURPLE,

      alignItems: 'center',

      justifyContent: 'center',

      marginRight: 12,

    },


    vehicleIconActive: {

      backgroundColor: PURPLE,

    },


    vehicleText: {

      flex: 1,

    },


    vehicleTitle: {

      fontSize: 14,

      fontWeight: '800',

      color: TEXT,

    },


    vehicleTitleActive: {

      color: PURPLE,

    },


    vehicleSubtitle: {

      marginTop: 3,

      fontSize: 10,

      color: MUTED,

    },


    vehicleSubtitleActive: {

      color: '#777084',

    },


    vehicleCheck: {

      width: 25,

      height: 25,

      borderRadius: 13,

      backgroundColor: GOLD,

      alignItems: 'center',

      justifyContent: 'center',

    },


    /*
    =====================================================
    OPTION CARD
    =====================================================
    */

    optionCard: {

      marginTop: 12,

      backgroundColor: WHITE,

      borderRadius: 16,

      padding: 14,

      borderWidth: 1,

      borderColor:
        '#E9E7EE',

    },


    optionHeader: {

      marginBottom: 12,

    },


    optionTitle: {

      fontSize: 13,

      fontWeight: '800',

      color: TEXT,

    },


    optionSubtitle: {

      marginTop: 3,

      fontSize: 10,

      color: MUTED,

    },


    segmentedControl: {

      flexDirection: 'row',

      gap: 9,

    },


    segment: {

      flex: 1,

      minHeight: 57,

      borderRadius: 12,

      borderWidth: 1,

      borderColor:
        '#E4E2E9',

      alignItems: 'center',

      justifyContent: 'center',

      backgroundColor:
        '#FAFAFB',

    },


    segmentActive: {

      borderColor: PURPLE,

      backgroundColor:
        LIGHT_PURPLE,

    },


    segmentTitle: {

      fontSize: 12,

      fontWeight: '800',

      color: TEXT,

    },


    segmentTitleActive: {

      color: PURPLE,

    },


    segmentPrice: {

      marginTop: 3,

      fontSize: 11,

      color: MUTED,

      fontWeight: '700',

    },


    segmentPriceActive: {

      color: PURPLE,

    },


    /*
    =====================================================
    PAYMENT
    =====================================================
    */

    paymentCard: {

      backgroundColor: WHITE,

      borderRadius: 17,

      borderWidth: 1,

      borderColor:
        '#E9E7EE',

      overflow: 'hidden',

    },


    paymentOption: {

      minHeight: 73,

      paddingHorizontal: 13,

      flexDirection: 'row',

      alignItems: 'center',

    },


    paymentOptionActive: {

      backgroundColor:
        '#FAF8FF',

    },


    paymentIcon: {

      width: 42,

      height: 42,

      borderRadius: 13,

      backgroundColor:
        LIGHT_PURPLE,

      alignItems: 'center',

      justifyContent: 'center',

      marginRight: 11,

    },


    paymentIconActive: {

      backgroundColor: PURPLE,

    },


    paymentText: {

      flex: 1,

    },


    paymentTitle: {

      fontSize: 13,

      fontWeight: '800',

      color: TEXT,

    },


    paymentSubtitle: {

      marginTop: 3,

      fontSize: 10,

      color: MUTED,

    },


    radio: {

      width: 21,

      height: 21,

      borderRadius: 11,

      borderWidth: 2,

      borderColor:
        '#C9C6D0',

      alignItems: 'center',

      justifyContent: 'center',

    },


    radioActive: {

      borderColor: PURPLE,

    },


    radioInner: {

      width: 10,

      height: 10,

      borderRadius: 5,

      backgroundColor: PURPLE,

    },


    paymentDivider: {

      height: 1,

      backgroundColor:
        '#F0EFF3',

      marginLeft: 66,

    },


    /*
    =====================================================
    FARE
    =====================================================
    */

    fareCard: {

      marginTop: 16,

      borderRadius: 18,

      backgroundColor: DARK_PURPLE,

      padding: 17,

    },


    fareHeader: {

      flexDirection: 'row',

      alignItems: 'flex-start',

      justifyContent: 'space-between',

    },


    fareLabel: {

      color: '#DCD4EE',

      fontSize: 9,

      fontWeight: '800',

      letterSpacing: 0.8,

    },


    fareAmount: {

      marginTop: 4,

      color: WHITE,

      fontSize: 30,

      fontWeight: '900',

    },


    readyBadge: {

      height: 28,

      paddingHorizontal: 9,

      borderRadius: 14,

      backgroundColor:
        '#E6F7EF',

      flexDirection: 'row',

      alignItems: 'center',

      gap: 4,

    },


    readyText: {

      color: GREEN,

      fontSize: 9,

      fontWeight: '900',

      letterSpacing: 0.4,

    },


    fareDivider: {

      height: 1,

      backgroundColor:
        '#6042A0',

      marginVertical: 15,

    },


    fareStats: {

      flexDirection: 'row',

      gap: 9,

    },


    fareStat: {

      flex: 1,

      flexDirection: 'row',

      alignItems: 'center',

    },


    fareStatIcon: {

      width: 29,

      height: 29,

      borderRadius: 9,

      backgroundColor:
        '#5A3AA0',

      alignItems: 'center',

      justifyContent: 'center',

      marginRight: 7,

    },


    fareStatLabel: {

      fontSize: 9,

      color: '#D8D0E9',

    },


    fareStatValue: {

      marginTop: 2,

      fontSize: 11,

      fontWeight: '800',

      color: WHITE,

    },


    /*
    =====================================================
    CTA
    =====================================================
    */

    ctaContainer: {

      marginTop: 18,

    },


    bookButton: {

      minHeight: 56,

      borderRadius: 15,

      backgroundColor: PURPLE,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'center',

      paddingHorizontal: 18,

      gap: 9,

      shadowColor:
        PURPLE,

      shadowOpacity: 0.22,

      shadowRadius: 10,

      shadowOffset: {
        width: 0,
        height: 5,
      },

      elevation: 4,

    },


    bookButtonDisabled: {

      backgroundColor:
        '#B9ACD9',

      shadowOpacity: 0,

      elevation: 0,

    },


    bookButtonLoading: {

      opacity: 0.78,

    },


    bookButtonText: {

      color: WHITE,

      fontSize: 15,

      fontWeight: '900',

      letterSpacing: 0.4,

    },


    ctaHint: {

      marginTop: 8,

      textAlign: 'center',

      color: MUTED,

      fontSize: 10,

    },


    securityNote: {

      marginTop: 12,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'center',

      gap: 5,

    },


    securityText: {

      fontSize: 9,

      color: MUTED,

      fontWeight: '600',

    },


    bottomSpace: {

      height: 20,

    },

  });