import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import api, {
  setAuthToken,
} from '../../services/api';

import {
  getStoredToken,
} from '../../storage/auth';

import {
  connectSocket,
  disconnectSocket,
  getSocket,
} from '../../services/socket';

import {
  BrandColors,
} from '../../constants/theme';


/*
=========================================================
TYPES
=========================================================
*/

type Location = {
  address?: string;
  latitude?: number;
  longitude?: number;
};

type Rider = {
  _id?: string;
  id?: string;
  fullName?: string;
  phone?: string;
};

type Trip = {
  _id?: string;
  tripId?: string;
  status?: string;
  vehicleType?: string;
  fare?: number;
  currency?: string;

  pickup?: Location;

  destination?: Location;

  rider?: Rider;

  createdAt?: string;
};


/*
=========================================================
HELPERS
=========================================================
*/

function formatMoney(
  value?: number
) {

  const amount =
    Number(value || 0);

  return `₦${amount.toLocaleString(
    'en-NG'
  )}`;
}


function getFirstName(
  name?: string
) {

  if (!name) {
    return 'Rider';
  }

  return name
    .trim()
    .split(' ')[0];
}


function formatTime(
  value?: string
) {

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


/*
=========================================================
DRIVER RIDES
=========================================================
*/

export default function DriverRides() {

  const [
    trips,
    setTrips
  ] = useState<Trip[]>([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    refreshing,
    setRefreshing
  ] = useState(false);

  const [
    acceptingId,
    setAcceptingId
  ] = useState<string | null>(
    null
  );


  /*
  =======================================================
  AUTHENTICATION
  =======================================================
  */

  const authenticate =
    useCallback(
      async () => {

        const token =
          await getStoredToken();

        if (!token) {

          setAuthToken();

          router.replace(
            '/login'
          );

          return false;
        }

        setAuthToken(
          token
        );

        return true;

      },
      []
    );


  /*
  =======================================================
  LOAD AVAILABLE RIDES
  =======================================================
  */

  const loadTrips =
    useCallback(
      async (
        showLoader = true
      ) => {

        try {

          if (showLoader) {
            setLoading(true);
          }

          console.log(
            '[DRIVER RIDES] Loading available trips'
          );


          const authenticated =
            await authenticate();

          if (!authenticated) {
            return;
          }


          const response =
            await api.get(
              '/trips/available'
            );


          const available =
            response?.data?.data
              ?.trips || [];


          setTrips(
            Array.isArray(
              available
            )
              ? available
              : []
          );


          console.log(
            '[DRIVER RIDES] Available trips:',
            available.length
          );

        } catch (
          error: any
        ) {

          console.log(
            '[DRIVER RIDES ERROR]',
            error
          );


          if (
            error?.response?.status ===
            401
          ) {

            setAuthToken();

            router.replace(
              '/login'
            );

            return;
          }


          if (
            error?.response?.status ===
            403
          ) {

            Alert.alert(
              'Unable to view rides',
              error?.response?.data?.message ||
              'Your driver account must be approved and online.'
            );

            return;
          }


          Alert.alert(
            'Unable to load rides',
            error?.response?.data?.message ||
            'Please check your connection and try again.'
          );

        } finally {

          setLoading(false);

          setRefreshing(false);

        }

      },
      [authenticate]
    );


  /*
  =======================================================
  SOCKET
  =======================================================
  */

  useEffect(() => {

    let mounted = true;


    async function setupSocket() {

      console.log(
        '[DRIVER RIDES SOCKET] Connecting'
      );


      await connectSocket();


      if (!mounted) {
        return;
      }


      const socket =
        getSocket();


      if (!socket) {
        return;
      }


      const handleNewTrip =
        (trip: Trip) => {

          console.log(
            '[DRIVER RIDES SOCKET] New trip received'
          );


          if (!trip) {
            return;
          }


          setTrips(
            previous => {

              const id =
                String(
                  trip._id ||
                  trip.tripId ||
                  ''
                );


              if (!id) {
                return previous;
              }


              const exists =
                previous.some(
                  item =>
                    String(
                      item._id ||
                      item.tripId ||
                      ''
                    ) === id
                );


              if (exists) {

                return previous.map(
                  item =>
                    String(
                      item._id ||
                      item.tripId ||
                      ''
                    ) === id
                      ? trip
                      : item
                );

              }


              return [
                trip,
                ...previous,
              ];

            }
          );

        };


      const handleTripUpdated =
        (trip: Trip) => {

          if (!trip) {
            return;
          }


          const id =
            String(
              trip._id ||
              trip.tripId ||
              ''
            );


          if (!id) {
            return;
          }


          setTrips(
            previous => {

              if (
                trip.status !==
                'SEARCHING_DRIVER'
              ) {

                return previous.filter(
                  item =>
                    String(
                      item._id ||
                      item.tripId ||
                      ''
                    ) !== id
                );

              }


              return previous.map(
                item =>
                  String(
                    item._id ||
                    item.tripId ||
                    ''
                  ) === id
                    ? trip
                    : item
              );

            }
          );

        };


      socket.on(
        'trip:new',
        handleNewTrip
      );


      socket.on(
        'trip:updated',
        handleTripUpdated
      );


      return () => {

        socket.off(
          'trip:new',
          handleNewTrip
        );

        socket.off(
          'trip:updated',
          handleTripUpdated
        );

      };

    }


    setupSocket();


    return () => {

      mounted = false;

      disconnectSocket();

    };

  }, []);


  /*
  =======================================================
  SCREEN FOCUS
  =======================================================
  */

  useFocusEffect(
    useCallback(() => {

      loadTrips();

    }, [loadTrips])
  );


  /*
  =======================================================
  REFRESH
  =======================================================
  */

  async function refresh() {

    setRefreshing(
      true
    );

    await loadTrips(
      false
    );

  }


  /*
  =======================================================
  ACCEPT RIDE
  =======================================================
  */

  async function acceptRide(
    trip: Trip
  ) {

    const id =
      trip._id ||
      trip.tripId;


    if (!id) {

      Alert.alert(
        'Unable to accept ride',
        'This ride does not have a valid trip ID.'
      );

      return;
    }


    if (
      acceptingId
    ) {
      return;
    }


    Alert.alert(
      'Accept this ride?',
      'You will be assigned to this trip and your availability will change to an active ride.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Accept Ride',

          onPress: async () => {

            try {

              setAcceptingId(
                id
              );


              console.log(
                '[DRIVER RIDES] Accepting:',
                id
              );


              const response =
                await api.post(
                  `/trips/${id}/accept`
                );


              const acceptedTrip =
                response?.data?.data
                  ?.trip ||
                response?.data?.data ||
                null;


              setTrips(
                previous =>
                  previous.filter(
                    item =>
                      String(
                        item._id ||
                        item.tripId ||
                        ''
                      ) !==
                      String(id)
                  )
              );


              console.log(
                '[DRIVER RIDES] Ride accepted'
              );


              router.push({
                pathname:
                  '/driver/trip',
                params: {
                  id,
                },
              });


              /*
               * acceptedTrip is intentionally
               * available here for future
               * active-trip state handling.
               */

              void acceptedTrip;

            } catch (
              error: any
            ) {

              console.log(
                '[DRIVER ACCEPT ERROR]',
                error
              );


              if (
                error?.response?.status ===
                401
              ) {

                setAuthToken();

                router.replace(
                  '/login'
                );

                return;
              }


              Alert.alert(
                'Ride unavailable',
                error?.response?.data?.message ||
                'This ride may have already been accepted by another driver.'
              );


              /*
               * Refresh because another
               * driver may have taken it.
               */

              await loadTrips(
                false
              );

            } finally {

              setAcceptingId(
                null
              );

            }

          },

        },

      ]
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
          styles.screen
        }
      >

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
            Looking for available rides...
          </Text>

        </View>

      </SafeAreaView>

    );

  }


  /*
  =======================================================
  MAIN SCREEN
  =======================================================
  */

  return (

    <SafeAreaView
      style={
        styles.screen
      }
    >

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }

        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }

            onRefresh={
              refresh
            }

            colors={[
              BrandColors.primary,
            ]}

            tintColor={
              BrandColors.primary
            }
          />
        }

        contentContainerStyle={
          styles.content
        }
      >

        {/* =============================================
            HEADER
        ============================================= */}

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
              styles.headerCenter
            }
          >

            <Text
              style={
                styles.headerTitle
              }
            >
              Available Rides
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Ride requests near you
            </Text>

          </View>


          <View
            style={
              styles.countBadge
            }
          >

            <Text
              style={
                styles.countText
              }
            >
              {trips.length}
            </Text>

          </View>

        </View>


        {/* =============================================
            STATUS
        ============================================= */}

        <View
          style={
            styles.statusCard
          }
        >

          <View
            style={
              styles.statusIndicator
            }
          />

          <View
            style={
              styles.statusContent
            }
          >

            <Text
              style={
                styles.statusTitle
              }
            >
              Looking for ride requests
            </Text>

            <Text
              style={
                styles.statusText
              }
            >
              New requests will appear here automatically.
            </Text>

          </View>

        </View>


        {/* =============================================
            EMPTY STATE
        ============================================= */}

        {trips.length === 0 ? (

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
              No rides available
            </Text>


            <Text
              style={
                styles.emptyText
              }
            >
              There are no matching ride requests right now. Stay online and new requests will appear automatically.
            </Text>


            <Pressable
              onPress={() =>
                loadTrips()
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
                Refresh
              </Text>

            </Pressable>

          </View>

        ) : (

          <View>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Ride Requests
            </Text>


            {trips.map(
              trip => {

                const id =
                  trip._id ||
                  trip.tripId ||
                  '';


                const isAccepting =
                  acceptingId === id;


                return (

                  <View
                    key={id}
                    style={
                      styles.rideCard
                    }
                  >

                    {/* =================================
                        RIDE HEADER
                    ================================= */}

                    <View
                      style={
                        styles.rideHeader
                      }
                    >

                      <View
                        style={
                          styles.riderAvatar
                        }
                      >

                        <Text
                          style={
                            styles.riderAvatarText
                          }
                        >
                          {(
                            trip.rider
                              ?.fullName ||
                            'R'
                          )
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </Text>

                      </View>


                      <View
                        style={
                          styles.riderInfo
                        }
                      >

                        <Text
                          style={
                            styles.riderName
                          }
                        >
                          {getFirstName(
                            trip.rider
                              ?.fullName
                          )}
                        </Text>


                        <Text
                          style={
                            styles.requestTime
                          }
                        >
                          Ride request {
                            formatTime(
                              trip.createdAt
                            )
                          }
                        </Text>

                      </View>


                      <Text
                        style={
                          styles.fare
                        }
                      >
                        {formatMoney(
                          trip.fare
                        )}
                      </Text>

                    </View>


                    <View
                      style={
                        styles.divider
                      }
                    />


                    {/* =================================
                        ROUTE
                    ================================= */}

                    <View
                      style={
                        styles.route
                      }
                    >

                      <View
                        style={
                          styles.routeIndicator
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
                          styles.routeDetails
                        }
                      >

                        <View
                          style={
                            styles.locationBlock
                          }
                        >

                          <Text
                            style={
                              styles.locationLabel
                            }
                          >
                            PICKUP
                          </Text>


                          <Text
                            numberOfLines={2}
                            style={
                              styles.locationAddress
                            }
                          >
                            {trip.pickup
                              ?.address ||
                              'Pickup location unavailable'}
                          </Text>

                        </View>


                        <View
                          style={
                            styles.routeSpacing
                          }
                        />


                        <View
                          style={
                            styles.locationBlock
                          }
                        >

                          <Text
                            style={
                              styles.locationLabel
                            }
                          >
                            DESTINATION
                          </Text>


                          <Text
                            numberOfLines={2}
                            style={
                              styles.locationAddress
                            }
                          >
                            {trip.destination
                              ?.address ||
                              'Destination unavailable'}
                          </Text>

                        </View>

                      </View>

                    </View>


                    {/* =================================
                        ACCEPT
                    ================================= */}

                    <Pressable
                      onPress={() =>
                        acceptRide(
                          trip
                        )
                      }

                      disabled={
                        Boolean(
                          acceptingId
                        )
                      }

                      style={[
                        styles.acceptButton,

                        Boolean(
                          acceptingId
                        ) &&
                          styles.acceptButtonDisabled,
                      ]}
                    >

                      {isAccepting ? (

                        <ActivityIndicator
                          size="small"
                          color={
                            BrandColors.white
                          }
                        />

                      ) : (

                        <Text
                          style={
                            styles.acceptButtonText
                          }
                        >
                          Accept Ride
                        </Text>

                      )}

                    </Pressable>

                  </View>

                );

              }
            )}

          </View>

        )}


        {/* =============================================
            FOOTER
        ============================================= */}

        <Text
          style={
            styles.footer
          }
        >
          Kaduna Only • Driver
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

    screen: {
      flex: 1,
      backgroundColor:
        BrandColors.background,
    },


    content: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 40,
    },


    /*
    -------------------------------------------------------
    HEADER
    -------------------------------------------------------
    */

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 18,
    },


    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        BrandColors.white,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      alignItems: 'center',
      justifyContent: 'center',
    },


    backText: {
      color:
        BrandColors.text,
      fontSize: 30,
      lineHeight: 32,
      marginTop: -3,
    },


    headerCenter: {
      flex: 1,
      marginLeft: 12,
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
      fontSize: 9,
      marginTop: 3,
    },


    countBadge: {
      minWidth: 34,
      height: 34,
      borderRadius: 17,
      paddingHorizontal: 8,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },


    countText: {
      color:
        BrandColors.primary,
      fontSize: 12,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    STATUS
    -------------------------------------------------------
    */

    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        BrandColors.primaryLight,
      borderRadius: 16,
      padding: 13,
      marginBottom: 20,
    },


    statusIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor:
        BrandColors.success,
      marginRight: 10,
    },


    statusContent: {
      flex: 1,
    },


    statusTitle: {
      color:
        BrandColors.text,
      fontSize: 11,
      fontWeight: '900',
    },


    statusText: {
      color:
        BrandColors.textSecondary,
      fontSize: 8,
      marginTop: 3,
    },


    /*
    -------------------------------------------------------
    SECTION
    -------------------------------------------------------
    */

    sectionTitle: {
      color:
        BrandColors.text,
      fontSize: 15,
      fontWeight: '900',
      marginBottom: 10,
    },


    /*
    -------------------------------------------------------
    RIDE CARD
    -------------------------------------------------------
    */

    rideCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 19,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      padding: 15,
      marginBottom: 13,
    },


    rideHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    riderAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },


    riderAvatarText: {
      color:
        BrandColors.primary,
      fontSize: 15,
      fontWeight: '900',
    },


    riderInfo: {
      flex: 1,
    },


    riderName: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '900',
    },


    requestTime: {
      color:
        BrandColors.textSecondary,
      fontSize: 8,
      marginTop: 3,
    },


    fare: {
      color:
        BrandColors.primary,
      fontSize: 16,
      fontWeight: '900',
    },


    divider: {
      height: 1,
      backgroundColor:
        '#EEEEEE',
      marginVertical: 14,
    },


    /*
    -------------------------------------------------------
    ROUTE
    -------------------------------------------------------
    */

    route: {
      flexDirection: 'row',
    },


    routeIndicator: {
      width: 18,
      alignItems: 'center',
      paddingTop: 4,
    },


    pickupDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor:
        BrandColors.primary,
    },


    routeLine: {
      width: 1,
      height: 30,
      backgroundColor:
        '#D7D7D7',
      marginVertical: 2,
    },


    destinationDot: {
      width: 10,
      height: 10,
      borderRadius: 2,
      backgroundColor:
        BrandColors.text,
    },


    routeDetails: {
      flex: 1,
      marginLeft: 9,
    },


    locationBlock: {
      minHeight: 42,
    },


    locationLabel: {
      color:
        BrandColors.textSecondary,
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
    },


    locationAddress: {
      color:
        BrandColors.text,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 4,
    },


    routeSpacing: {
      height: 8,
    },


    /*
    -------------------------------------------------------
    ACCEPT
    -------------------------------------------------------
    */

    acceptButton: {
      height: 46,
      borderRadius: 13,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 15,
    },


    acceptButtonDisabled: {
      opacity: 0.65,
    },


    acceptButtonText: {
      color:
        BrandColors.white,
      fontSize: 11,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    EMPTY
    -------------------------------------------------------
    */

    emptyCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      paddingHorizontal: 22,
      paddingVertical: 35,
      alignItems: 'center',
    },


    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor:
        BrandColors.backgroundSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 13,
    },


    emptyIconText: {
      color:
        '#AAAAAA',
      fontSize: 20,
      fontWeight: '900',
    },


    emptyTitle: {
      color:
        BrandColors.text,
      fontSize: 14,
      fontWeight: '900',
    },


    emptyText: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      lineHeight: 15,
      textAlign: 'center',
      marginTop: 6,
    },


    refreshButton: {
      minWidth: 110,
      height: 40,
      borderRadius: 12,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 17,
    },


    refreshButtonText: {
      color:
        BrandColors.primary,
      fontSize: 10,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    LOADING
    -------------------------------------------------------
    */

    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        BrandColors.background,
    },


    loadingText: {
      color:
        BrandColors.textSecondary,
      fontSize: 10,
      marginTop: 10,
    },


    /*
    -------------------------------------------------------
    FOOTER
    -------------------------------------------------------
    */

    footer: {
      color:
        '#AAAAAA',
      fontSize: 8,
      textAlign: 'center',
      marginTop: 20,
    },

  });