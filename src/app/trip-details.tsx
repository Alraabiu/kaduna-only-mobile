import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
  useFocusEffect,
} from 'expo-router';

import api, {
  setAuthToken,
} from '../services/api';

import {
  getStoredToken,
} from '../storage/auth';

import {
  BrandColors,
} from '../constants/theme';


/*
=========================================================
TYPES
=========================================================
*/

type Person = {
  _id?: string;
  id?: string;
  fullName?: string;
  phone?: string;
};

type LocationPoint = {
  label?: string;
  shortLabel?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
};

type DriverLocation = {
  latitude?: number;
  longitude?: number;
};

type Trip = {
  _id?: string;
  tripId?: string;

  status?: string;

  vehicleType?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  plateNumber?: string;

  pickup?: LocationPoint;
  destination?: LocationPoint;

  fare?: number;
  farePerPassenger?: number;
  privateFare?: number;
  singleSeatFare?: number;

  currency?: string;

  distanceKm?: number;
  estimatedMinutes?: number;

  paymentMethod?: string;
  paymentStatus?: string;

  routingSource?: string;
  pricingBasis?: string;
  pricingVersion?: string;

  kekeRideType?: string;
  passengerCapacity?: number;
  seatsRequested?: number;
  seatsOccupied?: number;

  rider?: Person;
  driver?: Person;

  createdAt?: string;
  updatedAt?: string;

  [key: string]: any;
};


/*
=========================================================
HELPERS
=========================================================
*/

function formatMoney(
  value: number | undefined
): string {

  const amount =
    Number(value || 0);

  return `₦${amount.toLocaleString('en-NG')}`;

}


function formatStatus(
  status?: string
): string {

  if (!status) {
    return 'Unknown';
  }

  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char =>
      char.toUpperCase()
    );

}


function formatPaymentMethod(
  value?: string
): string {

  if (!value) {
    return 'Not specified';
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char =>
      char.toUpperCase()
    );

}


function getLocationLabel(
  location?: LocationPoint
): string {

  if (!location) {
    return 'Not available';
  }

  return (
    location.label ||
    location.shortLabel ||
    'Location'
  );

}


function getStatusMessage(
  status?: string
): string {

  switch (status) {

    case 'SEARCHING_DRIVER':
      return 'We are finding a driver for your ride.';

    case 'DRIVER_ASSIGNED':
      return 'A driver has accepted your ride.';

    case 'DRIVER_ARRIVING':
      return 'Your driver is on the way to the pickup point.';

    case 'DRIVER_ARRIVED':
      return 'Your driver has arrived at the pickup point.';

    case 'TRIP_STARTED':
      return 'Your trip is currently in progress.';

    case 'COMPLETED':
      return 'Your trip has been completed.';

    case 'CANCELLED':
      return 'This trip has been cancelled.';

    default:
      return 'Trip status is being updated.';

  }

}


/*
=========================================================
SCREEN
=========================================================
*/

export default function TripDetails() {

  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();


  const tripId =
    Array.isArray(params.id)
      ? params.id[0]
      : params.id;


  const [
    trip,
    setTrip,
  ] = useState<Trip | null>(
    null
  );


  const [
    driverLocation,
    setDriverLocation,
  ] = useState<DriverLocation | null>(
    null
  );


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );


  /*
  =======================================================
  AUTHENTICATION
  =======================================================
  */

  async function prepareAuthentication() {

    const token =
      await getStoredToken();

    if (!token) {

      Alert.alert(
        'Session expired',
        'Please log in again.',
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace(
                '/login' as any
              ),
          },
        ]
      );

      return false;

    }

    setAuthToken(token);

    return true;

  }


  /*
  =======================================================
  LOAD TRIP
  =======================================================
  */

  const loadTrip =
    useCallback(
      async (
        showLoader = true
      ) => {

        if (!tripId) {

          setError(
            'No trip ID was provided.'
          );

          setLoading(false);

          return;

        }


        try {

          if (showLoader) {
            setLoading(true);
          }


          setError(null);


          console.log(
            '[RIDER TRIP DETAILS] Loading trip:',
            tripId
          );


          const authenticated =
            await prepareAuthentication();


          if (!authenticated) {
            return;
          }


          const response =
            await api.get(
              `/trips/${tripId}`
            );


          console.log(
            '[RIDER TRIP DETAILS] Trip loaded'
          );


          const data =
            response?.data?.data;


          const receivedTrip =
            data?.trip ||
            null;


          setTrip(
            receivedTrip
          );


          setDriverLocation(
            data?.driverLocation ||
            null
          );


        } catch (e: any) {

          console.log(
            '[RIDER TRIP DETAILS ERROR]',
            e
          );


          const message =
            e?.response?.data?.message ||
            'Unable to load this trip.';


          setError(
            message
          );

        } finally {

          setLoading(false);
          setRefreshing(false);

        }

      },
      [
        tripId,
      ]
    );


  /*
  =======================================================
  INITIAL / FOCUS LOAD
  =======================================================
  */

  useFocusEffect(
    useCallback(
      () => {

        loadTrip(
          true
        );

      },
      [
        loadTrip,
      ]
    )
  );


  /*
  =======================================================
  REFRESH
  =======================================================
  */

  async function refreshTrip() {

    setRefreshing(true);

    await loadTrip(
      false
    );

  }


  /*
  =======================================================
  BACK
  =======================================================
  */

  function goBack() {

    if (
      router.canGoBack()
    ) {

      router.back();

      return;

    }

    router.replace(
      '/trips' as any
    );

  }


  /*
  =======================================================
  LOADING
  =======================================================
  */

  if (loading) {

    return (

      <SafeAreaView
        style={
          styles.loading
        }
      >

        <ActivityIndicator
          size="large"
          color={
            BrandColors.primary
          }
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading trip...
        </Text>

      </SafeAreaView>

    );

  }


  /*
  =======================================================
  ERROR
  =======================================================
  */

  if (
    error ||
    !trip
  ) {

    return (

      <SafeAreaView
        style={
          styles.loading
        }
      >

        <Text
          style={
            styles.errorTitle
          }
        >
          Trip unavailable
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          {
            error ||
            'This trip could not be found.'
          }
        </Text>

        <Pressable
          onPress={() =>
            loadTrip(true)
          }
          style={
            styles.retryButton
          }
        >

          <Text
            style={
              styles.retryText
            }
          >
            Try Again
          </Text>

        </Pressable>

        <Pressable
          onPress={
            goBack
          }
          style={
            styles.backSecondary
          }
        >

          <Text
            style={
              styles.backSecondaryText
            }
          >
            Back to Trips
          </Text>

        </Pressable>

      </SafeAreaView>

    );

  }


  const status =
    trip.status;


  const isSearching =
    status ===
    'SEARCHING_DRIVER';


  const hasDriver =
    !!trip.driver;


  /*
  =======================================================
  MAIN SCREEN
  =======================================================
  */

  return (

    <SafeAreaView
      style={
        styles.safe
      }
    >

      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              refreshTrip
            }
          />
        }
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={
            styles.header
          }
        >

          <Pressable
            onPress={
              goBack
            }
            style={
              styles.backButton
            }
          >

            <Text
              style={
                styles.backIcon
              }
            >
              ‹
            </Text>

          </Pressable>


          <View
            style={
              styles.headerTextWrap
            }
          >

            <Text
              style={
                styles.headerTitle
              }
            >
              Trip Details
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              {
                trip.tripId ||
                trip._id ||
                'Trip'
              }
            </Text>

          </View>

        </View>


        {/* =================================================
            STATUS CARD
        ================================================= */}

        <View
          style={
            styles.statusCard
          }
        >

          <View
            style={
              styles.statusTop
            }
          >

            <Text
              style={
                styles.statusLabel
              }
            >
              CURRENT STATUS
            </Text>

            <View
              style={
                styles.statusBadge
              }
            >

              <Text
                style={
                  styles.statusBadgeText
                }
              >
                {
                  formatStatus(
                    status
                  )
                }
              </Text>

            </View>

          </View>


          <Text
            style={
              styles.statusMessage
            }
          >
            {
              getStatusMessage(
                status
              )
            }
          </Text>

        </View>


        {/* =================================================
            ROUTE
        ================================================= */}

        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            ROUTE
          </Text>


          <View
            style={
              styles.routeRow
            }
          >

            <View
              style={
                styles.routeMarkerColumn
              }
            >

              <View
                style={
                  styles.pickupDot
                }
              />

              <View
                style={
                  styles.routeLine
                }
              />

              <View
                style={
                  styles.destinationDot
                }
              />

            </View>


            <View
              style={
                styles.routeTextColumn
              }
            >

              <Text
                style={
                  styles.locationCaption
                }
              >
                PICKUP
              </Text>

              <Text
                style={
                  styles.locationText
                }
              >
                {
                  getLocationLabel(
                    trip.pickup
                  )
                }
              </Text>


              <View
                style={
                  styles.routeSpacer
                }
              />


              <Text
                style={
                  styles.locationCaption
                }
              >
                DESTINATION
              </Text>

              <Text
                style={
                  styles.locationText
                }
              >
                {
                  getLocationLabel(
                    trip.destination
                  )
                }
              </Text>

            </View>

          </View>

        </View>


        {/* =================================================
            FARE
        ================================================= */}

        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            FARE
          </Text>


          <View
            style={
              styles.fareRow
            }
          >

            <Text
              style={
                styles.fareLabel
              }
            >
              Total fare
            </Text>

            <Text
              style={
                styles.fareValue
              }
            >
              {
                formatMoney(
                  trip.fare
                )
              }
            </Text>

          </View>


          {
            trip.distanceKm != null &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Distance
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    trip.distanceKm
                  }
                  km
                </Text>

              </View>
            )
          }


          {
            trip.estimatedMinutes != null &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Estimated time
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    trip.estimatedMinutes
                  }
                  min
                </Text>

              </View>
            )
          }


          {
            trip.farePerPassenger != null &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Fare per passenger
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    formatMoney(
                      trip.farePerPassenger
                    )
                  }
                </Text>

              </View>
            )
          }

        </View>


        {/* =================================================
            RIDE INFORMATION
        ================================================= */}

        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            RIDE INFORMATION
          </Text>


          <View
            style={
              styles.infoRow
            }
          >

            <Text
              style={
                styles.infoLabel
              }
            >
              Vehicle
            </Text>

            <Text
              style={
                styles.infoValue
              }
            >
              {
                trip.vehicleType ||
                'Not specified'
              }
            </Text>

          </View>


          {
            trip.kekeRideType &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Ride type
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    formatPaymentMethod(
                      trip.kekeRideType
                    )
                  }
                </Text>

              </View>
            )
          }


          {
            trip.seatsRequested != null &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Seats
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    trip.seatsRequested
                  }
                </Text>

              </View>
            )
          }


          {
            trip.paymentMethod &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Payment
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    formatPaymentMethod(
                      trip.paymentMethod
                    )
                  }
                </Text>

              </View>
            )
          }

        </View>


        {/* =================================================
            DRIVER
        ================================================= */}

        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            DRIVER
          </Text>


          {
            hasDriver
              ? (

                <View
                  style={
                    styles.driverRow
                  }
                >

                  <View
                    style={
                      styles.driverAvatar
                    }
                  >

                    <Text
                      style={
                        styles.driverAvatarText
                      }
                    >
                      {
                        (
                          trip.driver?.fullName ||
                          'D'
                        )
                          .charAt(0)
                          .toUpperCase()
                      }
                    </Text>

                  </View>


                  <View
                    style={
                      styles.driverInfo
                    }
                  >

                    <Text
                      style={
                        styles.driverName
                      }
                    >
                      {
                        trip.driver?.fullName ||
                        'Driver'
                      }
                    </Text>

                    <Text
                      style={
                        styles.driverPhone
                      }
                    >
                      {
                        trip.driver?.phone ||
                        'Phone unavailable'
                      }
                    </Text>

                  </View>

                </View>

              )
              : (

                <View
                  style={
                    styles.noDriver
                  }
                >

                  <Text
                    style={
                      styles.noDriverTitle
                    }
                  >
                    {
                      isSearching
                        ? 'Finding your driver'
                        : 'Driver not assigned yet'
                    }
                  </Text>

                  <Text
                    style={
                      styles.noDriverText
                    }
                  >
                    {
                      isSearching
                        ? 'Nearby approved drivers will receive your ride request.'
                        : 'Driver information will appear here once assigned.'
                    }
                  </Text>

                </View>

              )
          }


          {
            driverLocation &&
            (
              <View
                style={
                  styles.locationStatus
                }
              >

                <Text
                  style={
                    styles.locationStatusText
                  }
                >
                  Driver location available
                </Text>

              </View>
            )
          }

        </View>


        {/* =================================================
            TRIP RECORD
        ================================================= */}

        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            TRIP RECORD
          </Text>


          {
            trip.routingSource &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Routing
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    trip.routingSource
                  }
                </Text>

              </View>
            )
          }


          {
            trip.pricingBasis &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Pricing basis
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    formatPaymentMethod(
                      trip.pricingBasis
                    )
                  }
                </Text>

              </View>
            )
          }


          {
            trip.createdAt &&
            (
              <View
                style={
                  styles.infoRow
                }
              >

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Created
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    new Date(
                      trip.createdAt
                    ).toLocaleString(
                      'en-NG'
                    )
                  }
                </Text>

              </View>
            )
          }

        </View>


        {/* =================================================
            REFRESH
        ================================================= */}

        <Pressable
          onPress={
            refreshTrip
          }
          style={
            styles.refreshButton
          }
        >

          <Text
            style={
              styles.refreshButtonText
            }
          >
            Refresh Trip
          </Text>

        </Pressable>


        <Text
          style={
            styles.footer
          }
        >
          Kaduna Only
        </Text>

      </ScrollView>

    </SafeAreaView>

  );

}


/*
=========================================================
STYLES
=========================================================
*/

const styles =
  StyleSheet.create({

    safe: {
      flex: 1,
      backgroundColor:
        BrandColors.background,
    },


    scroll: {
      flex: 1,
    },


    content: {
      paddingHorizontal: 18,
      paddingBottom: 30,
    },


    header: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
    },


    backButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },


    backIcon: {
      fontSize: 30,
      lineHeight: 31,
      color:
        BrandColors.primary,
      fontWeight: '400',
      marginTop: -3,
    },


    headerTextWrap: {
      marginLeft: 12,
      flex: 1,
    },


    headerTitle: {
      color:
        BrandColors.text,
      fontSize: 20,
      fontWeight: '900',
    },


    headerSubtitle: {
      color:
        BrandColors.textSecondary,
      fontSize: 10,
      marginTop: 3,
    },


    statusCard: {
      backgroundColor:
        BrandColors.primaryLight,
      borderRadius: 17,
      padding: 17,
      marginBottom: 14,
      borderWidth: 1,
      borderColor:
        '#DDEBE5',
    },


    statusTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },


    statusLabel: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.6,
    },


    statusBadge: {
      backgroundColor:
        BrandColors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },


    statusBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },


    statusMessage: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 12,
      lineHeight: 19,
    },


    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 17,
      padding: 17,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: '#EAEAEA',
    },


    sectionTitle: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.7,
      marginBottom: 15,
    },


    routeRow: {
      flexDirection: 'row',
    },


    routeMarkerColumn: {
      width: 24,
      alignItems: 'center',
    },


    pickupDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 3,
      borderColor:
        BrandColors.primary,
      backgroundColor:
        '#FFFFFF',
    },


    destinationDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor:
        BrandColors.primary,
    },


    routeLine: {
      width: 2,
      height: 47,
      backgroundColor:
        '#C9D8D1',
      marginVertical: 4,
    },


    routeTextColumn: {
      flex: 1,
      paddingLeft: 9,
    },


    locationCaption: {
      color:
        BrandColors.textSecondary,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.5,
    },


    locationText: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
      lineHeight: 19,
    },


    routeSpacer: {
      height: 26,
    },


    fareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 13,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EEEEEE',
    },


    fareLabel: {
      color:
        BrandColors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },


    fareValue: {
      color:
        BrandColors.primary,
      fontSize: 21,
      fontWeight: '900',
    },


    infoRow: {
      minHeight: 37,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor:
        '#F1F1F1',
    },


    infoLabel: {
      color:
        BrandColors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },


    infoValue: {
      color:
        BrandColors.text,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'right',
      maxWidth: '62%',
    },


    driverRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    driverAvatar: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },


    driverAvatarText: {
      color:
        BrandColors.primary,
      fontSize: 19,
      fontWeight: '900',
    },


    driverInfo: {
      marginLeft: 12,
      flex: 1,
    },


    driverName: {
      color:
        BrandColors.text,
      fontSize: 14,
      fontWeight: '900',
    },


    driverPhone: {
      color:
        BrandColors.textSecondary,
      fontSize: 11,
      marginTop: 4,
    },


    noDriver: {
      paddingVertical: 4,
    },


    noDriverTitle: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '900',
    },


    noDriverText: {
      color:
        BrandColors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 5,
    },


    locationStatus: {
      marginTop: 13,
      paddingTop: 11,
      borderTopWidth: 1,
      borderTopColor:
        '#EEEEEE',
    },


    locationStatusText: {
      color:
        BrandColors.primary,
      fontSize: 10,
      fontWeight: '800',
    },


    refreshButton: {
      minHeight: 47,
      borderRadius: 14,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },


    refreshButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },


    footer: {
      color:
        '#AAAAAA',
      textAlign: 'center',
      fontSize: 9,
      marginTop: 17,
    },


    loading: {
      flex: 1,
      backgroundColor:
        BrandColors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },


    loadingText: {
      color:
        BrandColors.textSecondary,
      fontSize: 11,
      marginTop: 10,
    },


    errorTitle: {
      color:
        BrandColors.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },


    errorText: {
      color:
        BrandColors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 18,
    },


    retryButton: {
      minWidth: 150,
      minHeight: 44,
      borderRadius: 13,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },


    retryText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },


    backSecondary: {
      marginTop: 10,
      minHeight: 42,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },


    backSecondaryText: {
      color:
        BrandColors.primary,
      fontSize: 11,
      fontWeight: '900',
    },

  });