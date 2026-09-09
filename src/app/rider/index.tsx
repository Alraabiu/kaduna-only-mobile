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
  Ionicons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import api, {
  setAuthToken,
} from '../../services/api';

import {
  getStoredToken,
  getStoredUser,
} from '../../storage/auth';


/*
=========================================================
KADUNA ONLY
RIDER HOME
=========================================================
*/


/*
=========================================================
BRAND
=========================================================
*/

const PURPLE = '#4B24A8';

const DARK_PURPLE = '#24145C';

const GOLD = '#F5C542';

const WHITE = '#FFFFFF';

const BACKGROUND = '#F7F5FB';

const TEXT = '#171717';

const MUTED = '#777777';

const GREEN = '#168A55';

const RED = '#C62828';

const BORDER = '#ECEAF2';

const SOFT_PURPLE = '#F0EBFF';

const SOFT_GREEN = '#E7F7EF';

const SOFT_RED = '#FDECEC';


/*
=========================================================
TYPES
=========================================================
*/

type RiderUser = {

  id?: string;

  _id?: string;

  fullName?: string;

  phone?: string;

  email?: string;

  role?: string;

  status?: string;

};


type TripPoint = {

  lat?: number;

  lng?: number;

  latitude?: number;

  longitude?: number;

  address?: string;

  name?: string;

};


type Driver = {

  _id?: string;

  id?: string;

  fullName?: string;

  phone?: string;

};


type Trip = {

  _id?: string;

  tripId?: string;

  status?: string;

  pickup?: TripPoint;

  destination?: TripPoint;

  vehicleType?: string;

  kekeRideType?: string;

  fare?: number;

  totalFare?: number;

  paymentMethod?: string;

  paymentStatus?: string;

  distanceKm?: number;

  durationMinutes?: number;

  driver?: Driver;

  createdAt?: string;

};


type DashboardData = {

  rider?: RiderUser;

  wallet?: {

    balance?: number;

  };

  completedTrips?: number;

  activeTrip?: Trip | null;

  recentTrips?: Trip[];

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
FORMAT MONEY
=========================================================
*/

function formatMoney(
  amount: number
) {

  return `₦${Number(
    amount || 0
  ).toLocaleString(
    'en-NG',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;

}


/*
=========================================================
TRIP STATUS
=========================================================
*/

function formatTripStatus(
  status?: string
) {

  switch (status) {

    case 'SEARCHING_DRIVER':

      return 'Finding a driver';


    case 'DRIVER_ASSIGNED':

      return 'Driver assigned';


    case 'DRIVER_ARRIVING':

      return 'Driver arriving';


    case 'DRIVER_ARRIVED':

      return 'Driver has arrived';


    case 'TRIP_STARTED':

      return 'Trip in progress';


    case 'TRIP_COMPLETED':

      return 'Completed';


    case 'CANCELLED':

      return 'Cancelled';


    default:

      return 'Trip';

  }

}


/*
=========================================================
STATUS COLOR
=========================================================
*/

function getStatusColor(
  status?: string
) {

  switch (status) {

    case 'TRIP_COMPLETED':

      return GREEN;


    case 'CANCELLED':

      return RED;


    default:

      return PURPLE;

  }

}


/*
=========================================================
DATE
=========================================================
*/

function formatDate(
  date?: string
) {

  if (!date) {

    return '';

  }


  try {

    return new Date(
      date
    ).toLocaleDateString(
      'en-NG',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    );

  } catch {

    return '';

  }

}


/*
=========================================================
DESTINATION DISPLAY
=========================================================
*/

function getDestination(
  trip: Trip
) {

  return (
    trip.destination?.address ||
    trip.destination?.name ||
    'Kaduna Only Ride'
  );

}


/*
=========================================================
FARE DISPLAY
=========================================================
*/

function getTripFare(
  trip: Trip
) {

  const fare =
    trip.fare ??
    trip.totalFare;


  if (
    typeof fare !== 'number'
  ) {

    return '--';

  }


  return formatMoney(
    fare
  );

}


/*
=========================================================
RIDER HOME
=========================================================
*/

export default function RiderHome() {


  /*
  =======================================================
  STATE
  =======================================================
  */

  const [
    user,
    setUser,
  ] = useState<RiderUser | null>(
    null
  );


  const [
    walletBalance,
    setWalletBalance,
  ] = useState(0);


  const [
    completedTrips,
    setCompletedTrips,
  ] = useState(0);


  const [
    recentTrips,
    setRecentTrips,
  ] = useState<Trip[]>([]);


  const [
    activeTrip,
    setActiveTrip,
  ] = useState<Trip | null>(
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


  /*
  =======================================================
  DASHBOARD LOADER
  =======================================================
  */

  const loadDashboard =
    useCallback(
      async (
        showLoader = true
      ) => {

        try {

          if (showLoader) {

            setLoading(true);

          }


          /*
          -------------------------------------------------
          GET STORED AUTH
          -------------------------------------------------
          */

          const token =
            await getStoredToken();


          const storedUser =
            await getStoredUser();


          /*
          -------------------------------------------------
          NO SESSION
          -------------------------------------------------
          */

          if (
            !token ||
            !storedUser
          ) {

            setAuthToken();

            router.replace(
              '/login'
            );

            return;

          }


          /*
          -------------------------------------------------
          APPLY JWT
          -------------------------------------------------
          */

          setAuthToken(
            token
          );


          /*
          -------------------------------------------------
          SHOW STORED USER IMMEDIATELY
          -------------------------------------------------
          */

          setUser(
            storedUser
          );


          /*
          -------------------------------------------------
          REQUEST BACKEND DASHBOARD
          -------------------------------------------------
          */

          console.log(
            '[RIDER HOME] Loading dashboard'
          );


          const response =
            await api.get(
              '/rider/dashboard'
            );


          console.log(
            '[RIDER HOME] Dashboard loaded'
          );


          /*
          -------------------------------------------------
          NORMALIZE RESPONSE
          -------------------------------------------------
          */

          const dashboard:
            DashboardData =
              response?.data?.data ||
              {};


          /*
          -------------------------------------------------
          RIDER
          -------------------------------------------------
          */

          if (
            dashboard.rider
          ) {

            setUser(
              dashboard.rider
            );

          }


          /*
          -------------------------------------------------
          WALLET
          -------------------------------------------------
          */

          setWalletBalance(
            Number(
              dashboard.wallet?.balance ||
              0
            )
          );


          /*
          -------------------------------------------------
          COMPLETED
          -------------------------------------------------
          */

          setCompletedTrips(
            Number(
              dashboard.completedTrips ||
              0
            )
          );


          /*
          -------------------------------------------------
          RECENT TRIPS
          -------------------------------------------------
          */

          setRecentTrips(

            Array.isArray(
              dashboard.recentTrips
            )
              ? dashboard.recentTrips
              : []

          );


          /*
          -------------------------------------------------
          ACTIVE TRIP
          -------------------------------------------------
          */

          setActiveTrip(
            dashboard.activeTrip ||
            null
          );


        } catch (
          error: any
        ) {

          console.log(
            '[RIDER HOME ERROR]',
            error
          );


          /*
          -------------------------------------------------
          UNAUTHORIZED
          -------------------------------------------------
          */

          if (
            error?.response?.status ===
            401
          ) {

            setAuthToken();


            Alert.alert(
              'Session expired',
              'Please sign in again.',
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
          SERVER ERROR
          -------------------------------------------------
          */

          const message =
            error?.response?.data?.message;


          Alert.alert(
            'Unable to load dashboard',
            message ||
            'Please check your connection and try again.'
          );


        } finally {

          setLoading(false);

          setRefreshing(false);

        }

      },
      []
    );


  /*
  =======================================================
  INITIAL LOAD
  =======================================================
  */

  useEffect(
    () => {

      loadDashboard();

    },
    [
      loadDashboard,
    ]
  );


  /*
  =======================================================
  REFRESH
  =======================================================
  */

  async function refreshDashboard() {

    setRefreshing(
      true
    );


    await loadDashboard(
      false
    );

  }


  /*
  =======================================================
  BOOK RIDE
  =======================================================
  */

  function bookRide() {

    router.push(
      '/book-ride' as any
    );

  }


  /*
  =======================================================
  WALLET
  =======================================================
  */

  function openWallet() {

    router.push(
      '/wallet'
    );

  }


  /*
  =======================================================
  ACTIVE TRIP
  =======================================================
  */

  function openActiveTrip() {

    if (
      !activeTrip?._id
    ) {

      Alert.alert(
        'Ride unavailable',
        'The active ride details are not available yet.'
      );

      return;

    }


    router.push(
      `/trip/${activeTrip._id}` as any
    );

  }


  /*
  =======================================================
  TRIPS
  =======================================================
  */

  function openTrips() {

    router.push(
      '/trips' as any
    );

  }


  /*
  =======================================================
  MESSAGES
  =======================================================
  */

  function openMessages() {

    router.push(
      '/messages' as any
    );

  }


  /*
  =======================================================
  PROFILE
  =======================================================
  */

  function openProfile() {

    router.push(
      '/profile' as any
    );

  }


  /*
  =======================================================
  OTHER SERVICES
  =======================================================
  */

  function hireTruck() {

    Alert.alert(
      'Hire a Truck',
      'Truck booking will be connected next.'
    );

  }


  function sendPackage() {

    Alert.alert(
      'Send Package',
      'Package delivery will be connected next.'
    );

  }


  function openMarket() {

    Alert.alert(
      'Market',
      'Market services will be connected next.'
    );

  }


  /*
  =======================================================
  LOADING SCREEN
  =======================================================
  */

  if (loading) {

    return (

      <View
        style={
          styles.loadingScreen
        }
      >

        <View
          style={
            styles.loadingLogo
          }
        >

          <Text
            style={
              styles.loadingLogoText
            }
          >
            K
          </Text>

        </View>


        <Text
          style={
            styles.loadingBrand
          }
        >
          KADUNA ONLY
        </Text>


        <Text
          style={
            styles.loadingSubtitle
          }
        >
          Your City. Your Ride.
        </Text>


        <ActivityIndicator
          size="small"
          color={PURPLE}
          style={
            styles.loadingIndicator
          }
        />

      </View>

    );

  }


  /*
  =======================================================
  USER
  =======================================================
  */

  const fullName =
    String(
      user?.fullName ||
      'Rider'
    ).trim();


  const firstName =
    fullName
      .split(/\s+/)[0] ||
      'Rider';


  const initial =
    firstName
      .charAt(0)
      .toUpperCase() ||
      'R';


  /*
  =======================================================
  ACTIVE TRIP CHECK
  =======================================================
  */

  const hasActiveTrip =
    !!activeTrip &&
    ACTIVE_STATUSES.includes(
      String(
        activeTrip.status
      )
    );


  /*
  =======================================================
  MAIN
  =======================================================
  */

  return (

    <View
      style={styles.screen}
    >


      <ScrollView

        showsVerticalScrollIndicator={
          false
        }

        contentContainerStyle={
          styles.scrollContent
        }

        refreshControl={

          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              refreshDashboard
            }
            tintColor={
              PURPLE
            }
          />

        }

      >


        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={styles.header}
        >

          <View
            style={
              styles.greetingContainer
            }
          >

            <View
              style={styles.avatar}
            >

              <Text
                style={
                  styles.avatarText
                }
              >
                {initial}
              </Text>

            </View>


            <View>

              <Text
                style={
                  styles.smallGreeting
                }
              >
                Good Morning,
              </Text>


              <Text
                style={styles.name}
              >
                {firstName}
              </Text>

            </View>

          </View>


          <Pressable
            style={
              styles.notificationButton
            }
            onPress={
              openMessages
            }
          >

            <Ionicons
              name={
                'notifications-outline'
              }
              size={23}
              color={TEXT}
            />


            <View
              style={
                styles.notificationDot
              }
            />

          </Pressable>

        </View>


        {/* =================================================
            ACTIVE TRIP
        ================================================= */}

        {hasActiveTrip && (

          <Pressable
            style={
              styles.activeTripCard
            }
            onPress={
              openActiveTrip
            }
          >

            <View
              style={
                styles.activeTripIcon
              }
            >

              <Ionicons
                name="navigate"
                size={21}
                color={PURPLE}
              />

            </View>


            <View
              style={
                styles.activeTripContent
              }
            >

              <Text
                style={
                  styles.activeTripLabel
                }
              >
                ACTIVE RIDE
              </Text>


              <Text
                style={
                  styles.activeTripStatus
                }
              >
                {formatTripStatus(
                  activeTrip?.status
                )}
              </Text>


              {activeTrip?.driver
                ?.fullName && (

                <Text
                  style={
                    styles.activeTripDriver
                  }
                >
                  Driver:{' '}
                  {
                    activeTrip.driver.fullName
                  }
                </Text>

              )}


              {activeTrip?.destination && (

                <Text
                  style={
                    styles.activeTripDestination
                  }
                  numberOfLines={1}
                >
                  To:{' '}
                  {
                    getDestination(
                      activeTrip
                    )
                  }
                </Text>

              )}

            </View>


            <Ionicons
              name="chevron-forward"
              size={20}
              color={PURPLE}
            />

          </Pressable>

        )}


        {/* =================================================
            NO ACTIVE RIDE
        ================================================= */}

        {!hasActiveTrip && (

          <Pressable
            style={
              styles.bookPromptCard
            }
            onPress={
              bookRide
            }
          >

            <View
              style={
                styles.bookPromptIcon
              }
            >

              <Ionicons
                name="car-outline"
                size={24}
                color={PURPLE}
              />

            </View>


            <View
              style={
                styles.bookPromptContent
              }
            >

              <Text
                style={
                  styles.bookPromptTitle
                }
              >
                Need a ride?
              </Text>


              <Text
                style={
                  styles.bookPromptText
                }
              >
                Book a Keke or car around Kaduna.
              </Text>

            </View>


            <View
              style={
                styles.bookPromptArrow
              }
            >

              <Ionicons
                name="arrow-forward"
                size={19}
                color={DARK_PURPLE}
              />

            </View>

          </Pressable>

        )}


        {/* =================================================
            WALLET
        ================================================= */}

        <Pressable
          style={
            styles.walletCard
          }
          onPress={
            openWallet
          }
        >

          <View>

            <Text
              style={
                styles.walletLabel
              }
            >
              Wallet Balance
            </Text>


            <Text
              style={
                styles.walletAmount
              }
            >
              {formatMoney(
                walletBalance
              )}
            </Text>


            <Text
              style={
                styles.walletHint
              }
            >
              Available for rides
            </Text>

          </View>


          <View
            style={
              styles.topUpButton
            }
          >

            <Ionicons
              name="add"
              size={17}
              color={PURPLE}
            />


            <Text
              style={
                styles.topUpText
              }
            >
              Top Up
            </Text>

          </View>

        </Pressable>


        {/* =================================================
            SERVICES
        ================================================= */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          What do you need today?
        </Text>


        <View
          style={
            styles.serviceGrid
          }
        >


          {/* BOOK RIDE */}

          <Pressable
            style={
              styles.serviceCard
            }
            onPress={
              bookRide
            }
          >

            <View
              style={
                styles.serviceIcon
              }
            >

              <Ionicons
                name="car-outline"
                size={25}
                color={PURPLE}
              />

            </View>


            <Text
              style={
                styles.serviceTitle
              }
            >
              Book a Ride
            </Text>


            <Text
              style={
                styles.serviceSubtitle
              }
            >
              Ride around the city
            </Text>

          </Pressable>


          {/* TRUCK */}

          <Pressable
            style={
              styles.serviceCard
            }
            onPress={
              hireTruck
            }
          >

            <View
              style={
                styles.serviceIcon
              }
            >

              <Ionicons
                name="car-sport-outline"
                size={25}
                color={PURPLE}
              />

            </View>


            <Text
              style={
                styles.serviceTitle
              }
            >
              Hire a Truck
            </Text>


            <Text
              style={
                styles.serviceSubtitle
              }
            >
              Move larger items
            </Text>

          </Pressable>


          {/* PACKAGE */}

          <Pressable
            style={
              styles.serviceCard
            }
            onPress={
              sendPackage
            }
          >

            <View
              style={
                styles.serviceIcon
              }
            >

              <Ionicons
                name="cube-outline"
                size={25}
                color={PURPLE}
              />

            </View>


            <Text
              style={
                styles.serviceTitle
              }
            >
              Send Package
            </Text>


            <Text
              style={
                styles.serviceSubtitle
              }
            >
              Deliver packages
            </Text>

          </Pressable>


          {/* MARKET */}

          <Pressable
            style={
              styles.serviceCard
            }
            onPress={
              openMarket
            }
          >

            <View
              style={
                styles.serviceIcon
              }
            >

              <Ionicons
                name="bag-handle-outline"
                size={25}
                color={PURPLE}
              />

            </View>


            <Text
              style={
                styles.serviceTitle
              }
            >
              Market
            </Text>


            <Text
              style={
                styles.serviceSubtitle
              }
            >
              Food and services
            </Text>

          </Pressable>

        </View>


        {/* =================================================
            STATISTICS
        ================================================= */}

        <View
          style={
            styles.statsRow
          }
        >

          <View
            style={
              styles.statCard
            }
          >

            <View
              style={
                styles.statIcon
              }
            >

              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={GREEN}
              />

            </View>


            <View>

              <Text
                style={
                  styles.statValue
                }
              >
                {completedTrips}
              </Text>


              <Text
                style={
                  styles.statLabel
                }
              >
                Completed trips
              </Text>

            </View>

          </View>


          <View
            style={
              styles.statCard
            }
          >

            <View
              style={[
                styles.statIcon,
                styles.statIconPurple,
              ]}
            >

              <Ionicons
                name="wallet-outline"
                size={20}
                color={PURPLE}
              />

            </View>


            <View>

              <Text
                style={
                  styles.statValueSmall
                }
              >
                {formatMoney(
                  walletBalance
                )}
              </Text>


              <Text
                style={
                  styles.statLabel
                }
              >
                Available balance
              </Text>

            </View>

          </View>

        </View>


        {/* =================================================
            RECENT TRIPS HEADER
        ================================================= */}

        <View
          style={
            styles.sectionHeader
          }
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            Recent Trips
          </Text>


          <Pressable
            onPress={
              openTrips
            }
          >

            <Text
              style={
                styles.viewAll
              }
            >
              View all
            </Text>

          </Pressable>

        </View>


        {/* =================================================
            RECENT TRIPS
        ================================================= */}

        <View
          style={
            styles.tripsCard
          }
        >

          {recentTrips.length === 0 ? (

            <Pressable
              style={
                styles.emptyTrip
              }
              onPress={
                bookRide
              }
            >

              <View
                style={
                  styles.emptyTripIcon
                }
              >

                <Ionicons
                  name="car-outline"
                  size={22}
                  color={PURPLE}
                />

              </View>


              <View
                style={
                  styles.emptyTripContent
                }
              >

                <Text
                  style={
                    styles.emptyTripTitle
                  }
                >
                  No recent trips
                </Text>


                <Text
                  style={
                    styles.emptyTripText
                  }
                >
                  Book your first ride around Kaduna.
                </Text>

              </View>


              <Ionicons
                name="chevron-forward"
                size={19}
                color={PURPLE}
              />

            </Pressable>

          ) : (

            recentTrips
              .slice(
                0,
                5
              )
              .map(
                (
                  trip,
                  index
                ) => (

                  <Pressable
                    key={
                      trip._id ||
                      trip.tripId ||
                      String(
                        index
                      )
                    }
                    style={[
                      styles.tripRow,

                      index <
                        Math.min(
                          recentTrips.length,
                          5
                        ) - 1 &&
                        styles.tripRowBorder,

                    ]}
                    onPress={
                      openTrips
                    }
                  >

                    <View
                      style={[
                        styles.tripIconGreen,

                        trip.status ===
                          'CANCELLED' &&
                          styles.tripIconRed,

                      ]}
                    >

                      <Ionicons
                        name={
                          trip.status ===
                          'TRIP_COMPLETED'
                            ? 'checkmark'
                            : trip.status ===
                                'CANCELLED'
                              ? 'close'
                              : 'car-outline'
                        }
                        size={20}
                        color={
                          trip.status ===
                          'CANCELLED'
                            ? RED
                            : GREEN
                        }
                      />

                    </View>


                    <View
                      style={
                        styles.tripRoute
                      }
                    >

                      <Text
                        style={
                          styles.routeText
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {
                          getDestination(
                            trip
                          )
                        }
                      </Text>


                      <Text
                        style={
                          styles.tripDate
                        }
                      >

                        <Text
                          style={{
                            color:
                              getStatusColor(
                                trip.status
                              ),
                            fontWeight:
                              '800',
                          }}
                        >
                          {
                            formatTripStatus(
                              trip.status
                            )
                          }
                        </Text>


                        {trip.createdAt
                          ? ` • ${formatDate(
                              trip.createdAt
                            )}`
                          : ''}

                      </Text>

                    </View>


                    <View
                      style={
                        styles.tripRight
                      }
                    >

                      <Text
                        style={
                          styles.tripAmount
                        }
                      >
                        {
                          getTripFare(
                            trip
                          )
                        }
                      </Text>


                      <Text
                        style={
                          styles.tripVehicle
                        }
                      >
                        {
                          trip.vehicleType
                            ? String(
                                trip.vehicleType
                              ).toUpperCase()
                            : ''
                        }
                      </Text>

                    </View>

                  </Pressable>

                )
              )

          )}

        </View>


        {/* =================================================
            SAFETY
        ================================================= */}

        <View
          style={
            styles.safetyCard
          }
        >

          <View
            style={
              styles.safetyIcon
            }
          >

            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color={WHITE}
            />

          </View>


          <View
            style={
              styles.safetyContent
            }
          >

            <Text
              style={
                styles.safetyTitle
              }
            >
              Safe & Secure
            </Text>


            <Text
              style={
                styles.safetyText
              }
            >
              Verified drivers and secure payments
            </Text>

          </View>

        </View>


        <View
          style={
            styles.bottomSpace
          }
        />

      </ScrollView>


      {/* =================================================
          BOTTOM NAV
      ================================================= */}

      <View
        style={
          styles.bottomNav
        }
      >


        {/* HOME */}

        <Pressable
          style={
            styles.navItem
          }
        >

          <Ionicons
            name="home"
            size={21}
            color={PURPLE}
          />


          <Text
            style={
              styles.navTextActive
            }
          >
            Home
          </Text>

        </Pressable>


        {/* TRIPS */}

        <Pressable
          style={
            styles.navItem
          }
          onPress={
            openTrips
          }
        >

          <Ionicons
            name="receipt-outline"
            size={21}
            color="#8B8991"
          />


          <Text
            style={
              styles.navText
            }
          >
            Trips
          </Text>

        </Pressable>


        {/* WALLET */}

        <Pressable
          style={
            styles.navItem
          }
          onPress={
            openWallet
          }
        >

          <Ionicons
            name="wallet-outline"
            size={21}
            color="#8B8991"
          />


          <Text
            style={
              styles.navText
            }
          >
            Wallet
          </Text>

        </Pressable>


        {/* MESSAGES */}

        <Pressable
          style={
            styles.navItem
          }
          onPress={
            openMessages
          }
        >

          <Ionicons
            name="chatbubble-ellipses-outline"
            size={21}
            color="#8B8991"
          />


          <Text
            style={
              styles.navText
            }
          >
            Messages
          </Text>

        </Pressable>


        {/* PROFILE */}

        <Pressable
          style={
            styles.navItem
          }
          onPress={
            openProfile
          }
        >

          <Ionicons
            name="person-outline"
            size={21}
            color="#8B8991"
          />


          <Text
            style={
              styles.navText
            }
          >
            Profile
          </Text>

        </Pressable>


      </View>

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
    =====================================================
    SCREEN
    =====================================================
    */

    screen: {
      flex: 1,
      backgroundColor:
        BACKGROUND,
    },


    scrollContent: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 105,
    },


    /*
    =====================================================
    LOADING
    =====================================================
    */

    loadingScreen: {
      flex: 1,
      backgroundColor: WHITE,
      alignItems: 'center',
      justifyContent: 'center',
    },


    loadingLogo: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor:
        PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
    },


    loadingLogoText: {
      color: GOLD,
      fontSize: 38,
      fontWeight: '900',
    },


    loadingBrand: {
      marginTop: 15,
      fontSize: 22,
      fontWeight: '900',
      color: PURPLE,
    },


    loadingSubtitle: {
      marginTop: 5,
      color: MUTED,
      fontSize: 14,
    },


    loadingIndicator: {
      marginTop: 25,
    },


    /*
    =====================================================
    HEADER
    =====================================================
    */

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 16,
    },


    greetingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    avatar: {
      width: 45,
      height: 45,
      borderRadius: 23,
      backgroundColor:
        PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    avatarText: {
      color: WHITE,
      fontSize: 18,
      fontWeight: '800',
    },


    smallGreeting: {
      fontSize: 12,
      color: MUTED,
    },


    name: {
      marginTop: 2,
      fontSize: 18,
      fontWeight: '800',
      color: TEXT,
    },


    notificationButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: WHITE,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: BORDER,
    },


    notificationDot: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: GOLD,
      top: 9,
      right: 9,
    },


    /*
    =====================================================
    ACTIVE TRIP
    =====================================================
    */

    activeTripCard: {
      backgroundColor:
        '#EEE8FF',
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor:
        '#DDD2FF',
    },


    activeTripIcon: {
      width: 43,
      height: 43,
      borderRadius: 13,
      backgroundColor: WHITE,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    activeTripContent: {
      flex: 1,
    },


    activeTripLabel: {
      color: PURPLE,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.5,
    },


    activeTripStatus: {
      marginTop: 3,
      color: TEXT,
      fontSize: 14,
      fontWeight: '800',
    },


    activeTripDriver: {
      marginTop: 3,
      color: MUTED,
      fontSize: 11,
    },


    activeTripDestination: {
      marginTop: 2,
      color: MUTED,
      fontSize: 10,
    },


    /*
    =====================================================
    BOOK PROMPT
    =====================================================
    */

    bookPromptCard: {
      backgroundColor: WHITE,
      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: BORDER,
    },


    bookPromptIcon: {
      width: 45,
      height: 45,
      borderRadius: 14,
      backgroundColor:
        SOFT_PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    bookPromptContent: {
      flex: 1,
    },


    bookPromptTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: TEXT,
    },


    bookPromptText: {
      marginTop: 3,
      fontSize: 10,
      color: MUTED,
    },


    bookPromptArrow: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: GOLD,
      alignItems: 'center',
      justifyContent: 'center',
    },


    /*
    =====================================================
    WALLET
    =====================================================
    */

    walletCard: {
      minHeight: 130,
      borderRadius: 18,
      backgroundColor:
        PURPLE,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },


    walletLabel: {
      color: '#DDD4F5',
      fontSize: 13,
      fontWeight: '600',
    },


    walletAmount: {
      marginTop: 7,
      color: WHITE,
      fontSize: 27,
      fontWeight: '900',
    },


    walletHint: {
      marginTop: 3,
      color: '#C8BCE9',
      fontSize: 10,
    },


    topUpButton: {
      minWidth: 82,
      height: 35,
      borderRadius: 9,
      backgroundColor:
        GOLD,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      paddingHorizontal: 10,
    },


    topUpText: {
      marginLeft: 3,
      color: PURPLE,
      fontSize: 12,
      fontWeight: '800',
    },


    /*
    =====================================================
    SECTION
    =====================================================
    */

    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: TEXT,
      marginTop: 25,
      marginBottom: 13,
    },


    serviceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent:
        'space-between',
    },


    /*
    =====================================================
    SERVICES
    =====================================================
    */

    serviceCard: {
      width: '48%',
      minHeight: 126,
      backgroundColor: WHITE,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: BORDER,
    },


    serviceIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor:
        SOFT_PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },


    serviceTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: TEXT,
    },


    serviceSubtitle: {
      marginTop: 4,
      fontSize: 11,
      color: MUTED,
      lineHeight: 16,
    },


    /*
    =====================================================
    STATS
    =====================================================
    */

    statsRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      gap: 10,
    },


    statCard: {
      flex: 1,
      minHeight: 72,
      backgroundColor: WHITE,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: BORDER,
      flexDirection: 'row',
      alignItems: 'center',
    },


    statIcon: {
      width: 37,
      height: 37,
      borderRadius: 12,
      backgroundColor:
        SOFT_GREEN,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 9,
    },


    statIconPurple: {
      backgroundColor:
        SOFT_PURPLE,
    },


    statValue: {
      fontSize: 14,
      fontWeight: '900',
      color: TEXT,
    },


    statValueSmall: {
      fontSize: 11,
      fontWeight: '900',
      color: TEXT,
    },


    statLabel: {
      marginTop: 2,
      fontSize: 9,
      color: MUTED,
    },


    /*
    =====================================================
    SECTION HEADER
    =====================================================
    */

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },


    viewAll: {
      color: PURPLE,
      fontSize: 12,
      fontWeight: '800',
    },


    /*
    =====================================================
    TRIPS
    =====================================================
    */

    tripsCard: {
      backgroundColor: WHITE,
      borderRadius: 16,
      paddingHorizontal: 15,
      borderWidth: 1,
      borderColor: BORDER,
      overflow: 'hidden',
    },


    emptyTrip: {
      minHeight: 84,
      flexDirection: 'row',
      alignItems: 'center',
    },


    emptyTripIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor:
        SOFT_PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    emptyTripContent: {
      flex: 1,
    },


    emptyTripTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: TEXT,
    },


    emptyTripText: {
      marginTop: 3,
      fontSize: 11,
      color: MUTED,
    },


    tripRow: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
    },


    tripRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor:
        BORDER,
    },


    tripIconGreen: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        SOFT_GREEN,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    tripIconRed: {
      backgroundColor:
        SOFT_RED,
    },


    tripRoute: {
      flex: 1,
      paddingRight: 8,
    },


    routeText: {
      fontSize: 13,
      fontWeight: '700',
      color: TEXT,
    },


    tripDate: {
      marginTop: 4,
      fontSize: 10,
      color: MUTED,
    },


    tripRight: {
      alignItems: 'flex-end',
      minWidth: 65,
    },


    tripAmount: {
      fontSize: 12,
      fontWeight: '800',
      color: TEXT,
    },


    tripVehicle: {
      marginTop: 3,
      fontSize: 8,
      color: MUTED,
      fontWeight: '700',
    },


    /*
    =====================================================
    SAFETY
    =====================================================
    */

    safetyCard: {
      marginTop: 18,
      borderRadius: 16,
      backgroundColor:
        SOFT_PURPLE,
      padding: 15,
      flexDirection: 'row',
      alignItems: 'center',
    },


    safetyIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    safetyContent: {
      flex: 1,
    },


    safetyTitle: {
      color: PURPLE,
      fontSize: 14,
      fontWeight: '800',
    },


    safetyText: {
      marginTop: 3,
      color: MUTED,
      fontSize: 11,
    },


    bottomSpace: {
      height: 15,
    },


    /*
    =====================================================
    BOTTOM NAV
    =====================================================
    */

    bottomNav: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 76,
      backgroundColor: WHITE,
      borderTopWidth: 1,
      borderTopColor:
        '#E8E6ED',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-around',
      paddingBottom: 7,
    },


    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },


    navTextActive: {
      marginTop: 4,
      fontSize: 10,
      color: PURPLE,
      fontWeight: '800',
    },


    navText: {
      marginTop: 4,
      fontSize: 10,
      color: '#8B8991',
      fontWeight: '600',
    },

  });