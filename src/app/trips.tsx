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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
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

type TripLocation = {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  name?: string;
};

type TripUser = {
  _id?: string;
  fullName?: string;
  phone?: string;
};

type Trip = {
  _id?: string;

  tripId?: string;

  vehicleType?: string;

  kekeRideType?: string;

  pickup?: TripLocation;

  destination?: TripLocation;

  fare?: number;

  currency?: string;

  distanceKm?: number;

  estimatedMinutes?: number;

  paymentMethod?: string;

  paymentStatus?: string;

  status?: string;

  createdAt?: string;

  updatedAt?: string;

  completedAt?: string;

  driver?: TripUser;

  rider?: TripUser;
};


/*
=========================================================
ACTIVE STATUSES
=========================================================
*/

const ACTIVE_STATUSES = [
  'SEARCHING_DRIVER',
  'DRIVER_ASSIGNED',
  'DRIVER_ARRIVING',
  'DRIVER_ARRIVED',
  'TRIP_STARTED',
];


/*
=========================================================
HELPERS
=========================================================
*/

function formatMoney(
  amount: number
): string {

  return `₦${Number(
    amount || 0
  ).toLocaleString(
    'en-NG'
  )}`;

}


function formatDate(
  value?: string
): string {

  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return date.toLocaleDateString(
    'en-NG',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );

}


function formatTime(
  value?: string
): string {

  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return date.toLocaleTimeString(
    'en-NG',
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  );

}


function locationName(
  location?: TripLocation
): string {

  if (!location) {
    return 'Location unavailable';
  }

  return (
    location.address ||
    location.name ||
    'Location'
  );

}


function vehicleLabel(
  trip: Trip
): string {

  if (
    trip.vehicleType === 'keke'
  ) {

    if (
      trip.kekeRideType === 'private'
    ) {

      return 'Private Keke';

    }

    return 'Keke';

  }


  if (
    trip.vehicleType === 'car'
  ) {

    return 'Car';

  }


  if (
    trip.vehicleType === 'bike'
  ) {

    return 'Bike';

  }


  if (
    trip.vehicleType === 'suv'
  ) {

    return 'SUV';

  }


  return (
    trip.vehicleType ||
    'Ride'
  );

}


function statusLabel(
  status?: string
): string {

  switch (status) {

    case 'SEARCHING_DRIVER':
      return 'Finding driver';

    case 'DRIVER_ASSIGNED':
      return 'Driver assigned';

    case 'DRIVER_ARRIVING':
      return 'Driver arriving';

    case 'DRIVER_ARRIVED':
      return 'Driver arrived';

    case 'TRIP_STARTED':
      return 'Trip in progress';

    case 'COMPLETION_REQUESTED':
      return 'Waiting for confirmation';

    case 'TRIP_COMPLETED':
      return 'Completed';

    case 'CANCELLED':
      return 'Cancelled';

    default:
      return (
        status ||
        'Unknown'
      );

  }

}


function isActiveStatus(
  status?: string
): boolean {

  return ACTIVE_STATUSES.includes(
    status || ''
  );

}


/*
=========================================================
NORMALIZE TRIP RESPONSE
=========================================================
*/

function extractTrips(
  response: any
): Trip[] {

  const data =
    response?.data?.data;

  if (
    Array.isArray(data)
  ) {

    return data;

  }


  if (
    Array.isArray(
      data?.trips
    )
  ) {

    return data.trips;

  }


  if (
    Array.isArray(
      response?.data?.trips
    )
  ) {

    return response.data.trips;

  }


  return [];

}


/*
=========================================================
EXTRACT ACTIVE TRIP
=========================================================
*/

function extractActiveTrip(
  response: any
): Trip | null {

  const data =
    response?.data?.data;


  if (
    data?.trip &&
    typeof data.trip === 'object'
  ) {

    return data.trip;

  }


  if (
    data?.activeTrip &&
    typeof data.activeTrip === 'object'
  ) {

    return data.activeTrip;

  }


  if (
    response?.data?.trip &&
    typeof response.data.trip === 'object'
  ) {

    return response.data.trip;

  }


  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    (
      data._id ||
      data.tripId
    )
  ) {

    return data;

  }


  return null;

}


/*
=========================================================
TRIPS SCREEN
=========================================================
*/

export default function Trips() {

  const [
    trips,
    setTrips
  ] = useState<Trip[]>([]);


  const [
    activeTrip,
    setActiveTrip
  ] = useState<Trip | null>(
    null
  );


  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    refreshing,
    setRefreshing
  ] = useState(false);


  /*
  =======================================================
  AUTHENTICATION
  =======================================================
  */

  const prepareAuthentication =
    useCallback(
      async (): Promise<boolean> => {

        try {

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

        } catch (
          error
        ) {

          console.log(
            '[RIDER TRIPS AUTH ERROR]',
            error
          );


          setAuthToken();


          Alert.alert(
            'Session error',
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

      },
      []
    );


  /*
  =======================================================
  LOAD TRIPS
  =======================================================
  */

  const loadTrips =
    useCallback(
      async (
        showLoader = true
      ): Promise<void> => {

        try {

          if (
            showLoader
          ) {

            setLoading(
              true
            );

          }


          console.log(
            '[RIDER TRIPS] Loading trips'
          );


          const authenticated =
            await prepareAuthentication();


          if (
            !authenticated
          ) {

            return;

          }


          /*
          -------------------------------------------------
          LOAD HISTORY + ACTIVE TRIP
          -------------------------------------------------
          */

          const [
            historyResponse,
            activeResponse,
          ] = await Promise.all([
            api.get(
              '/trips'
            ),

            api.get(
              '/trips/active'
            ),
          ]);


          console.log(
            '[RIDER TRIPS] History loaded'
          );


          /*
          -------------------------------------------------
          HISTORY
          -------------------------------------------------
          */

          const history =
            extractTrips(
              historyResponse
            );


          /*
          -------------------------------------------------
          ACTIVE TRIP
          -------------------------------------------------
          */

          let current =
            extractActiveTrip(
              activeResponse
            );


          /*
          -------------------------------------------------
          FALLBACK
          -------------------------------------------------

          Some backend versions return the active trip
          inside the normal trip history instead of
          /trips/active.
          -------------------------------------------------
          */

          if (
            !current
          ) {

            current =
              history.find(
                trip =>
                  isActiveStatus(
                    trip.status
                  )
              ) ||
              null;

          }


          /*
          -------------------------------------------------
          UPDATE STATE
          -------------------------------------------------
          */

          setTrips(
            history
          );


          setActiveTrip(
            current
          );


          console.log(
            '[RIDER TRIPS] Active trip:',
            current?._id ||
            current?.tripId ||
            'none'
          );

        } catch (
          error: any
        ) {

          console.log(
            '[RIDER TRIPS ERROR]',
            error
          );


          const status =
            error?.response?.status;


          /*
          -------------------------------------------------
          SESSION EXPIRED
          -------------------------------------------------
          */

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
          -------------------------------------------------
          DO NOT INVENT TRIPS
          -------------------------------------------------
          */

          Alert.alert(
            'Unable to load trips',

            error?.response?.data?.message ||
            error?.message ||
            'Please try again.'
          );

        } finally {

          setLoading(
            false
          );


          setRefreshing(
            false
          );

        }

      },
      [
        prepareAuthentication,
      ]
    );


  /*
  =======================================================
  REFRESH WHEN SCREEN RECEIVES FOCUS
  =======================================================
  */

  useEffect(
    () => {

      loadTrips();

    },
    [
      loadTrips,
    ]
  );


  /*
  =======================================================
  REFRESH
  =======================================================
  */

  const refreshTrips =
    useCallback(
      async (): Promise<void> => {

        setRefreshing(
          true
        );


        await loadTrips(
          false
        );

      },
      [
        loadTrips,
      ]
    );


  /*
  =======================================================
  OPEN TRIP
  =======================================================
  */

  const openTrip =
    useCallback(
      (
        trip: Trip
      ): void => {

        const id =
          trip._id ||
          trip.tripId;


        if (!id) {

          Alert.alert(
            'Trip unavailable',
            'This trip does not have a valid trip ID.'
          );


          return;

        }


        router.push(
          `/trip/${id}` as any
        );

      },
      []
    );


  /*
  =======================================================
  OPEN ACTIVE TRIP
  =======================================================
  */

  const openActiveTrip =
    useCallback(
      (): void => {

        if (
          activeTrip
        ) {

          openTrip(
            activeTrip
          );

        }

      },
      [
        activeTrip,
        openTrip,
      ]
    );


  /*
  =======================================================
  EMPTY STATE
  =======================================================
  */

  function renderEmpty() {

    return (

      <View
        style={
          styles.emptyCard
        }
      >

        <View
          style={
            styles.emptyIcon
          }
        >

          <Text
            style={
              styles.emptyIconText
            }
          >
            K
          </Text>

        </View>


        <Text
          style={
            styles.emptyTitle
          }
        >
          No trips yet
        </Text>


        <Text
          style={
            styles.emptyText
          }
        >
          Your completed and cancelled
          rides will appear here.
        </Text>


        <Pressable
          onPress={() =>
            router.push(
              '/book-ride' as any
            )
          }
          style={
            styles.bookButton
          }
        >

          <Text
            style={
              styles.bookButtonText
            }
          >
            Book a Ride
          </Text>

        </Pressable>

      </View>

    );

  }


  /*
  =======================================================
  LOADING
  =======================================================
  */

  if (
    loading
  ) {

    return (

      <View
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
          Loading your trips...
        </Text>

      </View>

    );

  }


  /*
  =======================================================
  MAIN
  =======================================================
  */

  return (

    <View
      style={
        styles.screen
      }
    >

      <ScrollView
        showsVerticalScrollIndicator={
          false
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
              refreshTrips
            }

            colors={[
              BrandColors.primary,
            ]}

            tintColor={
              BrandColors.primary
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
            onPress={() =>
              router.back()
            }

            style={
              styles.backButton
            }
          >

            <Text
              style={
                styles.backText
              }
            >
              ‹
            </Text>

          </Pressable>


          <View
            style={
              styles.headerText
            }
          >

            <Text
              style={
                styles.eyebrow
              }
            >
              KADUNA ONLY
            </Text>


            <Text
              style={
                styles.title
              }
            >
              My Trips
            </Text>

          </View>

        </View>


        {/* =================================================
            ACTIVE TRIP
        ================================================= */}

        {
          activeTrip && (

            <View
              style={
                styles.activeCard
              }
            >

              <View
                style={
                  styles.activeTop
                }
              >

                <View>

                  <Text
                    style={
                      styles.activeEyebrow
                    }
                  >
                    ACTIVE RIDE
                  </Text>


                  <Text
                    style={
                      styles.activeTitle
                    }
                  >
                    {statusLabel(
                      activeTrip.status
                    )}
                  </Text>

                </View>


                <View
                  style={
                    styles.liveBadge
                  }
                >

                  <View
                    style={
                      styles.liveDot
                    }
                  />

                  <Text
                    style={
                      styles.liveText
                    }
                  >
                    LIVE
                  </Text>

                </View>

              </View>


              <View
                style={
                  styles.routeContainer
                }
              >

                <View
                  style={
                    styles.routeLine
                  }
                >

                  <View
                    style={
                      styles.pickupDot
                    }
                  />


                  <View
                    style={
                      styles.routeDash
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
                    styles.routeTextContainer
                  }
                >

                  <View
                    style={
                      styles.routeLocation
                    }
                  >

                    <Text
                      style={
                        styles.routeLabel
                      }
                    >
                      PICKUP
                    </Text>


                    <Text
                      style={
                        styles.routeValue
                      }

                      numberOfLines={
                        1
                      }
                    >
                      {locationName(
                        activeTrip.pickup
                      )}
                    </Text>

                  </View>


                  <View
                    style={
                      styles.routeLocation
                    }
                  >

                    <Text
                      style={
                        styles.routeLabel
                      }
                    >
                      DESTINATION
                    </Text>


                    <Text
                      style={
                        styles.routeValue
                      }

                      numberOfLines={
                        1
                      }
                    >
                      {locationName(
                        activeTrip.destination
                      )}
                    </Text>

                  </View>

                </View>

              </View>


              <View
                style={
                  styles.activeBottom
                }
              >

                <View>

                  <Text
                    style={
                      styles.vehicleText
                    }
                  >
                    {vehicleLabel(
                      activeTrip
                    )}
                  </Text>


                  <Text
                    style={
                      styles.fareText
                    }
                  >
                    {formatMoney(
                      Number(
                        activeTrip.fare ||
                        0
                      )
                    )}
                  </Text>

                </View>


                <Pressable
                  onPress={
                    openActiveTrip
                  }

                  style={
                    styles.viewActiveButton
                  }
                >

                  <Text
                    style={
                      styles.viewActiveText
                    }
                  >
                    View Ride
                  </Text>

                </Pressable>

              </View>

            </View>

          )
        }


        {/* =================================================
            SECTION HEADER
        ================================================= */}

        <View
          style={
            styles.sectionHeader
          }
        >

          <View>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Trip History
            </Text>


            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Your recent rides
            </Text>

          </View>


          <Text
            style={
              styles.tripCount
            }
          >
            {trips.length}
          </Text>

        </View>


        {/* =================================================
            HISTORY
        ================================================= */}

        {
          trips.length === 0

            ? renderEmpty()

            : (

              <View
                style={
                  styles.historyCard
                }
              >

                {
                  trips.map(
                    (
                      trip,
                      index
                    ) => (

                      <Pressable
                        key={
                          trip._id ||
                          trip.tripId ||
                          `trip-${index}`
                        }

                        onPress={() =>
                          openTrip(
                            trip
                          )
                        }

                        style={[
                          styles.tripRow,

                          index > 0 &&
                            styles.tripBorder,
                        ]}
                      >

                        {/* ICON */}

                        <View
                          style={
                            styles.tripIcon
                          }
                        >

                          <Text
                            style={
                              styles.tripIconText
                            }
                          >
                            {
                              trip.vehicleType ===
                              'keke'
                                ? 'K'
                                : 'C'
                            }
                          </Text>

                        </View>


                        {/* DETAILS */}

                        <View
                          style={
                            styles.tripInfo
                          }
                        >

                          <View
                            style={
                              styles.tripTopLine
                            }
                          >

                            <Text
                              style={
                                styles.tripVehicle
                              }
                            >
                              {vehicleLabel(
                                trip
                              )}
                            </Text>


                            <Text
                              style={
                                styles.tripFare
                              }
                            >
                              {formatMoney(
                                Number(
                                  trip.fare ||
                                  0
                                )
                              )}
                            </Text>

                          </View>


                          <View
                            style={
                              styles.miniRoute
                            }
                          >

                            <View
                              style={
                                styles.miniDotPickup
                              }
                            />


                            <Text
                              style={
                                styles.miniLocation
                              }

                              numberOfLines={
                                1
                              }
                            >
                              {locationName(
                                trip.pickup
                              )}
                            </Text>

                          </View>


                          <View
                            style={
                              styles.miniRoute
                            }
                          >

                            <View
                              style={
                                styles.miniDotDestination
                              }
                            />


                            <Text
                              style={
                                styles.miniLocation
                              }

                              numberOfLines={
                                1
                              }
                            >
                              {locationName(
                                trip.destination
                              )}
                            </Text>

                          </View>


                          <View
                            style={
                              styles.tripMeta
                            }
                          >

                            <Text
                              style={
                                styles.tripDate
                              }
                            >
                              {formatDate(
                                trip.createdAt
                              )}

                              {'  '}

                              {formatTime(
                                trip.createdAt
                              )}
                            </Text>


                            <View
                              style={[
                                styles.statusBadge,

                                trip.status ===
                                  'TRIP_COMPLETED' &&
                                  styles.completedBadge,

                                trip.status ===
                                  'CANCELLED' &&
                                  styles.cancelledBadge,
                              ]}
                            >

                              <Text
                                style={[
                                  styles.statusText,

                                  trip.status ===
                                    'TRIP_COMPLETED' &&
                                    styles.completedStatusText,

                                  trip.status ===
                                    'CANCELLED' &&
                                    styles.cancelledStatusText,
                                ]}
                              >
                                {statusLabel(
                                  trip.status
                                )}
                              </Text>

                            </View>

                          </View>

                        </View>


                        <Text
                          style={
                            styles.chevron
                          }
                        >
                          ›
                        </Text>

                      </Pressable>

                    )
                  )
                }

              </View>

            )
        }


        <View
          style={
            styles.bottomSpace
          }
        />

      </ScrollView>

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

    screen: {
      flex: 1,
      backgroundColor:
        BrandColors.background,
    },


    content: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 35,
    },


    loading: {
      flex: 1,
      backgroundColor:
        BrandColors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },


    loadingText: {
      marginTop: 12,
      color:
        BrandColors.textSecondary,
      fontSize: 13,
    },


    /*
    -------------------------------------------------------
    HEADER
    -------------------------------------------------------
    */

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 22,
    },


    backButton: {
      width: 38,
      height: 38,
      justifyContent: 'center',
      alignItems: 'flex-start',
      marginRight: 4,
    },


    backText: {
      fontSize: 34,
      lineHeight: 34,
      fontWeight: '300',
      color:
        BrandColors.text,
    },


    headerText: {
      flex: 1,
    },


    eyebrow: {
      color:
        BrandColors.primary,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.1,
    },


    title: {
      marginTop: 3,
      color:
        BrandColors.text,
      fontSize: 27,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    ACTIVE
    -------------------------------------------------------
    */

    activeCard: {
      backgroundColor:
        BrandColors.primary,
      borderRadius: 20,
      padding: 18,
      marginBottom: 25,
    },


    activeTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },


    activeEyebrow: {
      color: '#DDD2F5',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
    },


    activeTitle: {
      marginTop: 5,
      color:
        BrandColors.white,
      fontSize: 18,
      fontWeight: '900',
    },


    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        'rgba(255,255,255,0.14)',
      borderRadius: 20,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },


    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        BrandColors.warning,
      marginRight: 5,
    },


    liveText: {
      color:
        BrandColors.white,
      fontSize: 9,
      fontWeight: '900',
    },


    routeContainer: {
      flexDirection: 'row',
      marginTop: 19,
    },


    routeLine: {
      width: 18,
      alignItems: 'center',
      paddingTop: 4,
    },


    pickupDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        BrandColors.warning,
    },


    routeDash: {
      width: 1,
      height: 30,
      borderStyle: 'dashed',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.55)',
      marginVertical: 2,
    },


    destinationDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 2,
      borderColor:
        BrandColors.white,
      backgroundColor:
        'transparent',
    },


    routeTextContainer: {
      flex: 1,
      marginLeft: 9,
      gap: 15,
    },


    routeLocation: {
      minHeight: 32,
    },


    routeLabel: {
      color: '#CFC1EF',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.7,
    },


    routeValue: {
      marginTop: 3,
      color:
        BrandColors.white,
      fontSize: 12,
      fontWeight: '600',
    },


    activeBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 17,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor:
        'rgba(255,255,255,0.13)',
    },


    vehicleText: {
      color: '#DCD3F2',
      fontSize: 11,
      fontWeight: '600',
    },


    fareText: {
      marginTop: 2,
      color:
        BrandColors.white,
      fontSize: 16,
      fontWeight: '900',
    },


    viewActiveButton: {
      backgroundColor:
        BrandColors.warning,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },


    viewActiveText: {
      color:
        BrandColors.text,
      fontSize: 11,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    SECTION
    -------------------------------------------------------
    */

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 11,
    },


    sectionTitle: {
      color:
        BrandColors.text,
      fontSize: 18,
      fontWeight: '900',
    },


    sectionSubtitle: {
      marginTop: 3,
      color:
        BrandColors.textSecondary,
      fontSize: 11,
    },


    tripCount: {
      minWidth: 28,
      height: 28,
      paddingHorizontal: 7,
      borderRadius: 14,
      backgroundColor:
        BrandColors.primaryLight,
      color:
        BrandColors.primary,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontSize: 11,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    HISTORY
    -------------------------------------------------------
    */

    historyCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      paddingHorizontal: 14,
    },


    tripRow: {
      minHeight: 108,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
    },


    tripBorder: {
      borderTopWidth: 1,
      borderTopColor:
        '#EEEEEE',
    },


    tripIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    tripIconText: {
      color:
        BrandColors.primary,
      fontSize: 15,
      fontWeight: '900',
    },


    tripInfo: {
      flex: 1,
      minWidth: 0,
    },


    tripTopLine: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 7,
    },


    tripVehicle: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '800',
    },


    tripFare: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '900',
    },


    miniRoute: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },


    miniDotPickup: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        BrandColors.primary,
      marginRight: 7,
    },


    miniDotDestination: {
      width: 6,
      height: 6,
      borderRadius: 3,
      borderWidth: 1.5,
      borderColor:
        BrandColors.primary,
      marginRight: 7,
    },


    miniLocation: {
      flex: 1,
      color:
        BrandColors.textSecondary,
      fontSize: 10,
    },


    tripMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 5,
    },


    tripDate: {
      color:
        '#8A8A8A',
      fontSize: 9,
    },


    statusBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor:
        '#F0EBFF',
    },


    completedBadge: {
      backgroundColor:
        '#E8F7EF',
    },


    cancelledBadge: {
      backgroundColor:
        '#FDECEC',
    },


    statusText: {
      color:
        BrandColors.primary,
      fontSize: 8,
      fontWeight: '800',
    },


    completedStatusText: {
      color:
        BrandColors.success,
    },


    cancelledStatusText: {
      color:
        BrandColors.danger,
    },


    chevron: {
      marginLeft: 8,
      color:
        '#AAAAAA',
      fontSize: 25,
      fontWeight: '300',
    },


    /*
    -------------------------------------------------------
    EMPTY
    -------------------------------------------------------
    */

    emptyCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      alignItems: 'center',
      paddingHorizontal: 25,
      paddingVertical: 38,
    },


    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 13,
    },


    emptyIconText: {
      color:
        BrandColors.primary,
      fontSize: 20,
      fontWeight: '900',
    },


    emptyTitle: {
      color:
        BrandColors.text,
      fontSize: 16,
      fontWeight: '900',
    },


    emptyText: {
      marginTop: 6,
      color:
        BrandColors.textSecondary,
      fontSize: 11,
      textAlign: 'center',
      lineHeight: 17,
    },


    bookButton: {
      marginTop: 18,
      backgroundColor:
        BrandColors.primary,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 11,
    },


    bookButtonText: {
      color:
        BrandColors.white,
      fontSize: 12,
      fontWeight: '900',
    },


    bottomSpace: {
      height: 25,
    },

  });