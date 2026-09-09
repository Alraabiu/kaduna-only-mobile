import React, {
  useCallback,
  useEffect,
  useRef,
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
  useFocusEffect,
} from 'expo-router';

import api, {
  setAuthToken,
} from '../../services/api';

import {
  getStoredToken,
  getStoredUser,
} from '../../storage/auth';

import {
  BrandColors,
} from '../../constants/theme';

import {
  connectSocket,
  getSocket,
  disconnectSocket,
} from '../../services/socket';


/*
=========================================================
TYPES
=========================================================
*/

type DriverUser = {
  _id?: string;
  id?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  role?: string;
  status?: string;
};


type DriverProfile = {
  _id?: string;

  vehicleType?: string;

  vehicleModel?: string;

  vehicleColor?: string;

  plateNumber?: string;

  online?: boolean;

  verificationStatus?: string;

  user?: DriverUser;
};


type Trip = {
  _id?: string;

  tripId?: string;

  status?: string;

  fare?: number;

  currency?: string;

  pickup?: {
    label?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };

  destination?: {
    label?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };

  rider?: DriverUser;

  driver?: DriverUser;
};


type Dashboard = {
  profile?: DriverProfile;

  wallet?: {
    balance?: number;
  };

  activeTrip?: Trip | null;

  completedTrips?: number;

  recentTrips?: Trip[];
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
    return 'Driver';
  }

  return name
    .trim()
    .split(' ')[0];
}


function formatStatus(
  status?: string
) {

  if (!status) {
    return 'Unknown';
  }

  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, c =>
      c.toUpperCase()
    );
}


function vehicleLabel(
  profile?: DriverProfile
) {

  const parts = [
    profile?.vehicleColor,
    profile?.vehicleModel,
    profile?.plateNumber,
  ].filter(Boolean);

  return parts.length
    ? parts.join(' • ')
    : 'Vehicle information unavailable';
}


/*
=========================================================
DRIVER HOME
=========================================================
*/

export default function DriverHome() {

  const [
    dashboard,
    setDashboard
  ] = useState<Dashboard | null>(
    null
  );


  const [
    storedUser,
    setStoredUser
  ] = useState<DriverUser | null>(
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


  const [
    changingOnline,
    setChangingOnline
  ] = useState(false);


  /*
  -------------------------------------------------------
  Prevent multiple background refresh requests
  -------------------------------------------------------
  */

  const refreshInFlight =
    useRef(false);


  /*
  -------------------------------------------------------
  Prevent duplicate socket initialization
  -------------------------------------------------------
  */

  const socketInitialized =
    useRef(false);


  /*
  =======================================================
  AUTHENTICATION
  =======================================================
  */

  const authenticate =
    useCallback(
      async () => {

        try {

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


          const user =
            await getStoredUser();


          if (user) {

            setStoredUser(
              user
            );

          }


          return true;

        } catch (error) {

          console.log(
            '[DRIVER AUTH ERROR]',
            error
          );

          setAuthToken();

          router.replace(
            '/login'
          );

          return false;

        }

      },
      []
    );


  /*
  =======================================================
  LOAD DRIVER DASHBOARD
  =======================================================
  */

  const loadDashboard =
    useCallback(
      async (
        showLoader = true
      ) => {

        /*
        ---------------------------------------------------
        Do not allow realtime events to fire several
        simultaneous dashboard requests.
        ---------------------------------------------------
        */

        if (
          !showLoader &&
          refreshInFlight.current
        ) {

          return;

        }


        if (
          !showLoader
        ) {

          refreshInFlight.current =
            true;

        }


        try {

          if (
            showLoader
          ) {

            setLoading(
              true
            );

          }


          console.log(
            '[DRIVER HOME] Loading dashboard'
          );


          const authenticated =
            await authenticate();


          if (
            !authenticated
          ) {

            return;

          }


          const response =
            await api.get(
              '/drivers/dashboard'
            );


          const data =
            response?.data?.data ||
            null;


        if (
  data
) {

  setDashboard(
    data
  );

}


          console.log(
            '[DRIVER HOME] Dashboard loaded',
            {
              activeTrip:
                data?.activeTrip?._id ||
                null,

              activeStatus:
                data?.activeTrip?.status ||
                null,
            }
          );


        } catch (
          error: any
        ) {

          console.log(
            '[DRIVER HOME ERROR]',
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
            404
          ) {

            Alert.alert(
              'Driver profile unavailable',
              error?.response?.data?.message ||
              'Your driver profile could not be found.'
            );

            return;

          }


          /*
          -------------------------------------------------
          Only show an alert for foreground/manual loads.
          -------------------------------------------------
          */

          if (
            showLoader
          ) {

            Alert.alert(
              'Unable to load dashboard',
              error?.response?.data?.message ||
              'Please check your connection and try again.'
            );

          }


        } finally {

          setLoading(
            false
          );


          setRefreshing(
            false
          );


          if (
            !showLoader
          ) {

            refreshInFlight.current =
              false;

          }

        }

      },
      [
        authenticate,
      ]
    );


  /*
  =======================================================
  REALTIME SOCKET
  =======================================================
  */

  useEffect(() => {

    let mounted =
      true;


    let socket:
      ReturnType<typeof getSocket> =
        null;


    let fallbackTimer:
      ReturnType<typeof setInterval> | null =
        null;


    /*
    -------------------------------------------------------
    REFRESH FROM SOCKET
    -------------------------------------------------------
    */

    const refreshFromRealtime =
      (
        eventName: string,
        payload?: any
      ) => {

        console.log(
          `[DRIVER SOCKET] ${eventName}`,
          payload?.trip?._id ||
          payload?._id ||
          null,

          payload?.trip?.status ||
          payload?.status ||
          null
        );


        if (
          mounted
        ) {

          /*
          * Database remains authoritative.
          */

          loadDashboard(
            false
          );

        }

      };


    /*
    -------------------------------------------------------
    SOCKET INITIALIZATION
    -------------------------------------------------------
    */

    async function initializeSocket() {

      try {

        const authenticated =
          await authenticate();


        if (
          !mounted ||
          !authenticated
        ) {

          return;

        }


        console.log(
          '[DRIVER SOCKET] Connecting'
        );


        const connected =
          await connectSocket();


        if (
          !mounted ||
          !connected
        ) {

          console.log(
            '[DRIVER SOCKET] Socket connection unavailable'
          );

          return;

        }


        socket =
          getSocket();


        if (
          !socket
        ) {

          console.log(
            '[DRIVER SOCKET] Socket unavailable'
          );

          return;

        }


        socketInitialized.current =
          true;


        console.log(
          '[DRIVER SOCKET] Ready',
          socket.id
        );


        /*
        ===================================================
        NEW RIDE REQUEST
        ===================================================
        */

        const handleNewTrip =
          (payload: any) => {

            refreshFromRealtime(
              'NEW RIDE REQUEST',
              payload
            );

          };


        /*
        ===================================================
        TRIP UPDATED
        ===================================================
        */

        const handleTripUpdated =
          (payload: any) => {

            refreshFromRealtime(
              'TRIP UPDATED',
              payload
            );

          };


        /*
        ===================================================
        TRIP UPDATE
        ===================================================
        *
        * Included because older/newer versions of the
        * mobile application may use trip:update.
        */

        const handleTripUpdate =
          (payload: any) => {

            refreshFromRealtime(
              'TRIP UPDATE',
              payload
            );

          };


        /*
        ===================================================
        TRIP TAKEN
        ===================================================
        */

        const handleTripTaken =
          (payload: any) => {

            refreshFromRealtime(
              'TRIP TAKEN',
              payload
            );

          };


        /*
        ===================================================
        DESTINATION CONFIRMED
        ===================================================
        *
        * Rider presses:
        *
        * I HAVE ARRIVED
        *
        * The driver's dashboard must refresh immediately.
        */

        const handleDestinationConfirmed =
          (payload: any) => {

            refreshFromRealtime(
              'RIDER CONFIRMED ARRIVAL',
              payload
            );

          };


        /*
        ===================================================
        COMPLETION REQUEST
        ===================================================
        */

        const handleCompletionRequest =
          (payload: any) => {

            refreshFromRealtime(
              'COMPLETION REQUEST',
              payload
            );

          };


        /*
        ===================================================
        CONNECTED
        ===================================================
        */

        const handleConnect =
          () => {

            console.log(
              '[DRIVER SOCKET] Connected:',
              socket?.id
            );


            if (
              mounted
            ) {

              loadDashboard(
                false
              );

            }

          };


        /*
        ===================================================
        RECONNECTED
        ===================================================
        */

        const handleReconnect =
          (
            attempt?: number
          ) => {

            console.log(
              '[DRIVER SOCKET] Reconnected:',
              attempt
            );


            if (
              mounted
            ) {

              loadDashboard(
                false
              );

            }

          };


        /*
        ===================================================
        REGISTER EVENTS
        ===================================================
        */

        socket.on(
          'trip:new',
          handleNewTrip
        );


        socket.on(
          'trip:updated',
          handleTripUpdated
        );


        socket.on(
          'trip:update',
          handleTripUpdate
        );


        socket.on(
          'trip:taken',
          handleTripTaken
        );


        socket.on(
          'destination:confirmed',
          handleDestinationConfirmed
        );


        socket.on(
          'completion:requested',
          handleCompletionRequest
        );


        socket.on(
          'connect',
          handleConnect
        );


        socket.on(
          'reconnect',
          handleReconnect
        );


        /*
        ===================================================
        FALLBACK DATABASE REFRESH
        ===================================================
        *
        * If Socket.IO misses an event because the phone
        * temporarily loses connectivity, the dashboard
        * still recovers from the database.
        */

        fallbackTimer =
          setInterval(
            () => {

              if (
                mounted
              ) {

                loadDashboard(
                  false
                );

              }

            },
            10000
          );


      } catch (error) {

        console.log(
          '[DRIVER SOCKET ERROR]',
          error
        );

      }

    }


    initializeSocket();


    /*
    =======================================================
    CLEANUP
    =======================================================
    */

    return () => {

      mounted =
        false;


      if (
        fallbackTimer
      ) {

        clearInterval(
          fallbackTimer
        );

        fallbackTimer =
          null;

      }


      if (
        socket
      ) {

        socket.off(
          'trip:new'
        );


        socket.off(
          'trip:updated'
        );


        socket.off(
          'trip:update'
        );


        socket.off(
          'trip:taken'
        );


        socket.off(
          'destination:confirmed'
        );


        socket.off(
          'completion:requested'
        );


        socket.off(
          'connect'
        );


        socket.off(
          'reconnect'
        );

      }


      /*
      * Do not destroy the shared connection merely
      * because this screen unmounted.
      *
      * The socket service owns the singleton connection.
      */

      socketInitialized.current =
        false;


      refreshInFlight.current =
        false;

    };


  }, [
    authenticate,
    loadDashboard,
  ]);


 /*
=======================================================
SCREEN FOCUS
=======================================================
*/

useFocusEffect(
  useCallback(() => {

    let mounted = true;

    async function refreshOnFocus() {

      if (!mounted) return;

      await loadDashboard(false);

    }


    refreshOnFocus();


    return () => {

      mounted = false;

    };

  }, [loadDashboard])
);
  /*
  =======================================================
  MANUAL REFRESH
  =======================================================
  */

  async function refresh() {

    setRefreshing(
      true
    );


    await loadDashboard(
      false
    );

  }


  /*
=========================================================
TOGGLE ONLINE
=========================================================

Online status is controlled by the backend.

Before going online the backend verifies:

1. Driver account approval
2. NIN verification
3. Face verification

The mobile app handles the backend response and sends
the driver to Identity & Security when required.
=========================================================
*/

async function toggleOnline() {

  if (
    changingOnline ||
    !dashboard?.profile
  ) {

    return;

  }


  const current =
    Boolean(
      dashboard.profile.online
    );


  const next =
    !current;


  /*
  -------------------------------------------------------
  DRIVER ACCOUNT APPROVAL
  -------------------------------------------------------
  */

  if (
    next &&
    String(
      dashboard.profile
        .verificationStatus ||
      ''
    ).toLowerCase() !==
      'approved'
  ) {

    Alert.alert(
      'Account not approved',
      'Your driver account must be approved before you can go online.'
    );

    return;

  }


  try {

    setChangingOnline(
      true
    );


    /*
    -------------------------------------------------------
    REQUEST ONLINE STATUS CHANGE
    -------------------------------------------------------
    */

    const response =
      await api.patch(
        '/drivers/me/online',
        {
          online:
            next,
        }
      );


    const online =
      Boolean(
        response?.data?.data
          ?.online
      );


    /*
    -------------------------------------------------------
    UPDATE LOCAL DASHBOARD STATE
    -------------------------------------------------------
    */

    setDashboard(
      previous => {

        if (
          !previous
        ) {

          return previous;

        }


        return {

          ...previous,

          profile: {

            ...previous.profile,

            online,

          },

        };

      }
    );


    /*
    -------------------------------------------------------
    REALTIME / SOCKET AVAILABILITY
    -------------------------------------------------------
    */

    /*
      KEEP YOUR EXISTING REALTIME/SOCKET CODE HERE.

      Do not remove the existing code that runs between
      the successful PATCH request and loadDashboard().
    */


    /*
    -------------------------------------------------------
    REFRESH DASHBOARD
    -------------------------------------------------------
    */

    await loadDashboard(
      false
    );


  } catch (
  error: any
) {

  console.log(
    '[DRIVER ONLINE ERROR]',
    error
  );


  /*
  -------------------------------------------------------
  AUTHENTICATION EXPIRED
  -------------------------------------------------------
  */

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


  /*
  -------------------------------------------------------
  IDENTITY VERIFICATION REQUIRED
  -------------------------------------------------------
  */

  const errorCode =
    error?.response?.data?.code;


  if (
    errorCode ===
    'IDENTITY_VERIFICATION_REQUIRED'
  ) {

    const ninVerified =
      error?.response?.data?.data
        ?.ninVerified === true;


    const faceVerified =
      error?.response?.data?.data
        ?.faceVerified === true;


    let message =
      'Complete your identity verification before going online.';


    if (
      !ninVerified &&
      !faceVerified
    ) {

      message =
        'Please verify your NIN and face before going online.';

    } else if (
      !ninVerified
    ) {

      message =
        'Your NIN must be verified before you can go online.';

    } else if (
      !faceVerified
    ) {

      message =
        'Your face must be verified before you can go online.';

    }


    Alert.alert(
      'Identity Verification Required',
      message,
      [
        {
          text:
            'Cancel',

          style:
            'cancel',
        },

        {
          text:
            'Complete Verification',

          onPress: () =>
            router.push(
              '/driver/identity' as any
            ),

        },

      ]
    );


    return;

  }


  /*
  -------------------------------------------------------
  OTHER BACKEND ERRORS
  -------------------------------------------------------
  */

  Alert.alert(
    'Unable to change status',
    error?.response?.data?.message ||
    'Please try again.'
  );

}

}
/*
  =======================================================
  ACTIVE TRIP
  =======================================================
  */

  function openActiveTrip() {

  const trip =
    dashboard?.activeTrip;


  if (
    !trip?._id
  ) {

    return;

  }


  router.push({

    pathname:
      '/driver/trip',

    params: {

      id:
        trip._id,

    },

  });

}


  /*
  =======================================================
  LOGOUT
  =======================================================
  */

  async function logout() {

    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [

        {
          text:
            'Cancel',

          style:
            'cancel',

        },

        {

          text:
            'Log out',

          style:
            'destructive',

          onPress:
            async () => {

              try {

                const {
                  clearAuth,
                } =
                  await import(
                    '../../storage/auth'
                  );


                await clearAuth();


                setAuthToken();


                disconnectSocket();


                router.replace(
                  '/login'
                );


              } catch (
                error
              ) {

                console.log(
                  '[DRIVER LOGOUT ERROR]',
                  error
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

  if (
    loading
  ) {

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
            Loading driver dashboard...
          </Text>

        </View>

      </SafeAreaView>

    );

  }


  /*
  =======================================================
  DATA
  =======================================================
  */

  const profile =
    dashboard?.profile;


  const user =
    profile?.user ||
    storedUser;


  const activeTrip =
    dashboard?.activeTrip;


  const walletBalance =
    dashboard?.wallet?.balance ||
    0;


  const completedTrips =
    dashboard?.completedTrips ||
    0;


  const isOnline =
    Boolean(
      profile?.online
    );


  const verification =
    String(
      profile?.verificationStatus ||
      ''
    ).toLowerCase();


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
        ============================================== */}

        <View
          style={
            styles.header
          }
        >

          <View
            style={
              styles.headerLeft
            }
          >

            <View
              style={
                styles.logoCircle
              }
            >

              <Text
                style={
                  styles.logoText
                }
              >
                K
              </Text>

            </View>


            <View>

              <Text
                style={
                  styles.brand
                }
              >
                KADUNA ONLY
              </Text>


              <Text
                style={
                  styles.greeting
                }
              >
                Hello, {
                  getFirstName(
                    user?.fullName
                  )
                }
              </Text>

            </View>

          </View>


          <Pressable
            onPress={() =>
             router.push(
  '/profile'
)
            }

            style={
              styles.profileButton
            }
          >

            <Text
              style={
                styles.profileInitial
              }
            >

              {(
                user?.fullName ||
                'D'
              )
                .trim()
                .charAt(0)
                .toUpperCase()}

            </Text>

          </Pressable>

        </View>


        {/* =============================================
            ONLINE STATUS
        ============================================== */}

        <View
          style={
            styles.statusCard
          }
        >

          <View
            style={
              styles.statusInfo
            }
          >

            <View
              style={[
                styles.statusDot,

                isOnline &&
                  styles.statusDotOnline,
              ]}
            />


            <View>

              <Text
                style={
                  styles.statusTitle
                }
              >
                {isOnline
                  ? 'You are Online'
                  : 'You are Offline'}
              </Text>


              <Text
                style={
                  styles.statusSubtitle
                }
              >
                {isOnline
                  ? 'Ready to receive ride requests'
                  : 'Go online to receive ride requests'}
              </Text>

            </View>

          </View>


          <Pressable
            onPress={
              toggleOnline
            }

            disabled={
              changingOnline
            }

            style={[
              styles.toggle,

              isOnline &&
                styles.toggleOnline,

              changingOnline &&
                styles.toggleDisabled,
            ]}
          >

            {changingOnline ? (

              <ActivityIndicator
                size="small"
                color={
                  isOnline
                    ? BrandColors.primary
                    : BrandColors.white
                }
              />

            ) : (

              <View
                style={[
                  styles.toggleKnob,

                  isOnline &&
                    styles.toggleKnobOnline,
                ]}
              />

            )}

          </Pressable>

        </View>


        {/* =============================================
            VERIFICATION
        ============================================== */}

        {verification !== 'approved' && (

          <View
            style={
              styles.warningCard
            }
          >

            <View
              style={
                styles.warningIcon
              }
            >

              <Text
                style={
                  styles.warningIconText
                }
              >
                !
              </Text>

            </View>


            <View
              style={
                styles.warningTextContainer
              }
            >

              <Text
                style={
                  styles.warningTitle
                }
              >
                Driver verification
              </Text>


              <Text
                style={
                  styles.warningText
                }
              >
                Status: {
                  formatStatus(
                    profile?.verificationStatus
                  )
                }
              </Text>

            </View>

          </View>

        )}


        {/* =============================================
            WALLET
        ============================================== */}

        <View
          style={
            styles.earningsCard
          }
        >

          <View>

            <Text
              style={
                styles.earningsLabel
              }
            >
              WALLET BALANCE
            </Text>


            <Text
              style={
                styles.earningsAmount
              }
            >
              {formatMoney(
                walletBalance
              )}
            </Text>

          </View>


          <Pressable
            onPress={() =>
              router.push(
                '/wallet'
              )
            }

            style={
              styles.walletButton
            }
          >

            <Text
              style={
                styles.walletButtonText
              }
            >
              Wallet
            </Text>


            <Text
              style={
                styles.walletArrow
              }
            >
              →
            </Text>

          </Pressable>

        </View>


        {/* =============================================
            STATISTICS
        ============================================== */}

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

            <Text
              style={
                styles.statNumber
              }
            >
              {completedTrips}
            </Text>


            <Text
              style={
                styles.statLabel
              }
            >
              Completed Trips
            </Text>

          </View>


          <View
            style={
              styles.statCard
            }
          >

            <Text
              style={
                styles.statNumber
              }
            >
              {isOnline
                ? 'ON'
                : 'OFF'}
            </Text>


            <Text
              style={
                styles.statLabel
              }
            >
              Availability
            </Text>

          </View>

        </View>


        {/* =============================================
            ACTIVE TRIP
        ============================================== */}

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
            Active Trip
          </Text>

        </View>


        {activeTrip ? (

          <Pressable
            onPress={
              openActiveTrip
            }

            style={
              styles.activeTripCard
            }
          >

            <View
              style={
                styles.activeTripTop
              }
            >

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
                  K
                </Text>

              </View>


              <View
                style={
                  styles.tripInfo
                }
              >

                <Text
                  style={
                    styles.tripNumber
                  }
                >
                  {activeTrip.tripId ||
                    'Active Ride'}
                </Text>


                <Text
                  style={
                    styles.tripStatus
                  }
                >
                  {formatStatus(
                    activeTrip.status
                  )}
                </Text>

              </View>


              <Text
                style={
                  styles.tripArrow
                }
              >
                →
              </Text>

            </View>


            <View
              style={
                styles.tripDivider
              }
            />


            <View
              style={
                styles.locationRow
              }
            >

              <View
                style={
                  styles.locationDot
                }
              />


              <Text
                numberOfLines={1}
                style={
                  styles.locationText
                }
              >
                {activeTrip.pickup
                  ?.address ||
                  activeTrip.pickup
                    ?.label ||
                  'Pickup location'}
              </Text>

            </View>


            <View
              style={
                styles.locationLine
              }
            />


            <View
              style={
                styles.locationRow
              }
            >

              <View
                style={
                  styles.destinationDot
                }
              />


              <Text
                numberOfLines={1}
                style={
                  styles.locationText
                }
              >
                {activeTrip.destination
                  ?.address ||
                  activeTrip.destination
                    ?.label ||
                  'Destination'}
              </Text>

            </View>

          </Pressable>

        ) : (

          <View
            style={
              styles.emptyTripCard
            }
          >

            <View
              style={
                styles.emptyTripIcon
              }
            >

              <Text
                style={
                  styles.emptyTripIconText
                }
              >
                K
              </Text>

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
                No active trip
              </Text>


              <Text
                style={
                  styles.emptyTripText
                }
              >
                {isOnline
                  ? 'You are ready to receive your next ride request.'
                  : 'Go online when you are ready to start receiving rides.'}
              </Text>

            </View>

          </View>

        )}


        {/* =============================================
            VEHICLE
        ============================================== */}

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
            Your Vehicle
          </Text>


          <Pressable
            onPress={() =>
             router.push(
  '/profile'
)
            }
          >

            <Text
              style={
                styles.editText
              }
            >
              Edit
            </Text>

          </Pressable>

        </View>


        <View
          style={
            styles.vehicleCard
          }
        >

          <View
            style={
              styles.vehicleIcon
            }
          >

            <Text
              style={
                styles.vehicleIconText
              }
            >
              🛺
            </Text>

          </View>


          <View
            style={
              styles.vehicleInfo
            }
          >

            <Text
              style={
                styles.vehicleType
              }
            >
              {profile?.vehicleType ||
                'Vehicle'}
            </Text>


            <Text
              numberOfLines={1}
              style={
                styles.vehicleDetails
              }
            >
              {vehicleLabel(
                profile
              )}
            </Text>

          </View>

        </View>


        {/* =============================================
            QUICK ACTIONS
        ============================================== */}

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
            Quick Actions
          </Text>

        </View>


        <View
          style={
            styles.actionsGrid
          }
        >

          <Pressable
            onPress={() =>
              router.push(
                '/messages'
              )
            }

            style={
              styles.actionCard
            }
          >

            <View
              style={
                styles.actionIcon
              }
            >

              <Text
                style={
                  styles.actionIconText
                }
              >
                M
              </Text>

            </View>


            <Text
              style={
                styles.actionTitle
              }
            >
              Messages
            </Text>


            <Text
              style={
                styles.actionSubtitle
              }
            >
              Chat with riders
            </Text>

          </Pressable>


          <Pressable
            onPress={() =>
              router.push(
                '/driver/rides'
              )
            }

            style={
              styles.actionCard
            }
          >

            <View
              style={
                styles.actionIcon
              }
            >

              <Text
                style={
                  styles.actionIconText
                }
              >
                R
              </Text>

            </View>


            <Text
              style={
                styles.actionTitle
              }
            >
              Available Rides
            </Text>


            <Text
              style={
                styles.actionSubtitle
              }
            >
              Find ride requests
            </Text>

          </Pressable>


          <Pressable
            onPress={() =>
            router.push(
  '/profile'
)
            }

            style={
              styles.actionCard
            }
          >

            <View
              style={
                styles.actionIcon
              }
            >

              <Text
                style={
                  styles.actionIconText
                }
              >
                P
              </Text>

            </View>


            <Text
              style={
                styles.actionTitle
              }
            >
              Profile
            </Text>


            <Text
              style={
                styles.actionSubtitle
              }
            >
              Account settings
            </Text>

          </Pressable>

        </View>


        {/* =============================================
            LOGOUT
        ============================================== */}

        <Pressable
          onPress={
            logout
          }

          style={
            styles.logoutButton
          }
        >

          <Text
            style={
              styles.logoutText
            }
          >
            Log Out
          </Text>

        </Pressable>


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
      justifyContent: 'space-between',
      marginBottom: 20,
    },


    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    logoCircle: {
      width: 43,
      height: 43,
      borderRadius: 22,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },


    logoText: {
      color:
        BrandColors.white,
      fontSize: 20,
      fontWeight: '900',
    },


    brand: {
      color:
        BrandColors.primary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.1,
    },


    greeting: {
      color:
        BrandColors.text,
      fontSize: 19,
      fontWeight: '900',
      marginTop: 2,
    },


    profileButton: {
      width: 43,
      height: 43,
      borderRadius: 22,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor:
        '#E1D4F7',
    },


    profileInitial: {
      color:
        BrandColors.primary,
      fontSize: 16,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    ONLINE STATUS
    -------------------------------------------------------
    */

    statusCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 18,
      padding: 15,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },


    statusInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },


    statusDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor:
        '#B7B7B7',
      marginRight: 10,
    },


    statusDotOnline: {
      backgroundColor:
        BrandColors.success,
    },


    statusTitle: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '900',
    },


    statusSubtitle: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      marginTop: 3,
    },


    toggle: {
      width: 51,
      height: 29,
      borderRadius: 15,
      backgroundColor:
        '#C7C7CC',
      padding: 3,
      justifyContent: 'center',
    },


    toggleOnline: {
      backgroundColor:
        BrandColors.primary,
    },


    toggleDisabled: {
      opacity: 0.6,
    },


    toggleKnob: {
      width: 23,
      height: 23,
      borderRadius: 12,
      backgroundColor:
        BrandColors.white,
    },


    toggleKnobOnline: {
      alignSelf: 'flex-end',
    },


    /*
    -------------------------------------------------------
    WARNING
    -------------------------------------------------------
    */

    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#FFF8E7',
      borderWidth: 1,
      borderColor:
        '#F6DF9B',
      borderRadius: 15,
      padding: 12,
      marginBottom: 12,
    },


    warningIcon: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor:
        '#F59E0B',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },


    warningIconText: {
      color:
        BrandColors.white,
      fontSize: 16,
      fontWeight: '900',
    },


    warningTextContainer: {
      flex: 1,
    },


    warningTitle: {
      color:
        '#7A5200',
      fontSize: 11,
      fontWeight: '900',
    },


    warningText: {
      color:
        '#8B6A1E',
      fontSize: 9,
      marginTop: 2,
    },


    /*
    -------------------------------------------------------
    WALLET
    -------------------------------------------------------
    */

    earningsCard: {
      backgroundColor:
        BrandColors.primary,
      borderRadius: 20,
      padding: 19,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },


    earningsLabel: {
      color:
        '#E9DBFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },


    earningsAmount: {
      color:
        BrandColors.white,
      fontSize: 27,
      fontWeight: '900',
      marginTop: 4,
    },


    walletButton: {
      backgroundColor:
        'rgba(255,255,255,0.16)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
    },


    walletButtonText: {
      color:
        BrandColors.white,
      fontSize: 10,
      fontWeight: '900',
    },


    walletArrow: {
      color:
        BrandColors.white,
      fontSize: 15,
      marginLeft: 5,
    },


    /*
    -------------------------------------------------------
    STATISTICS
    -------------------------------------------------------
    */

    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 5,
    },


    statCard: {
      flex: 1,
      backgroundColor:
        BrandColors.white,
      borderRadius: 16,
      padding: 15,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
    },


    statNumber: {
      color:
        BrandColors.primary,
      fontSize: 20,
      fontWeight: '900',
    },


    statLabel: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      marginTop: 4,
    },


    /*
    -------------------------------------------------------
    SECTION
    -------------------------------------------------------
    */

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 20,
      marginBottom: 9,
    },


    sectionTitle: {
      color:
        BrandColors.text,
      fontSize: 15,
      fontWeight: '900',
    },


    editText: {
      color:
        BrandColors.primary,
      fontSize: 10,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    ACTIVE TRIP
    -------------------------------------------------------
    */

    activeTripCard: {
      backgroundColor:
        BrandColors.white,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      borderRadius: 17,
      padding: 14,
    },


    activeTripTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    tripIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },


    tripIconText: {
      color:
        BrandColors.primary,
      fontSize: 15,
      fontWeight: '900',
    },


    tripInfo: {
      flex: 1,
    },


    tripNumber: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '900',
    },


    tripStatus: {
      color:
        BrandColors.primary,
      fontSize: 9,
      fontWeight: '800',
      marginTop: 3,
    },


    tripArrow: {
      color:
        BrandColors.primary,
      fontSize: 22,
      fontWeight: '700',
    },


    tripDivider: {
      height: 1,
      backgroundColor:
        '#EEEEEE',
      marginVertical: 13,
    },


    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    locationDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        BrandColors.primary,
      marginHorizontal: 3,
      marginRight: 9,
    },


    destinationDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        '#111111',
      marginHorizontal: 3,
      marginRight: 9,
    },


    locationText: {
      flex: 1,
      color:
        BrandColors.textSecondary,
      fontSize: 9,
    },


    locationLine: {
      width: 1,
      height: 13,
      backgroundColor:
        '#D8D8D8',
      marginLeft: 7,
    },


    /*
    -------------------------------------------------------
    EMPTY ACTIVE TRIP
    -------------------------------------------------------
    */

    emptyTripCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      padding: 15,
      flexDirection: 'row',
      alignItems: 'center',
    },


    emptyTripIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        BrandColors.backgroundSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    emptyTripIconText: {
      color:
        '#AAAAAA',
      fontSize: 16,
      fontWeight: '900',
    },


    emptyTripContent: {
      flex: 1,
    },


    emptyTripTitle: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '900',
    },


    emptyTripText: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      lineHeight: 14,
      marginTop: 3,
    },


    /*
    -------------------------------------------------------
    VEHICLE
    -------------------------------------------------------
    */

    vehicleCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },


    vehicleIcon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    vehicleIconText: {
      fontSize: 23,
    },


    vehicleInfo: {
      flex: 1,
    },


    vehicleType: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'capitalize',
    },


    vehicleDetails: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      marginTop: 4,
    },


    /*
    -------------------------------------------------------
    QUICK ACTIONS
    -------------------------------------------------------
    */

    actionsGrid: {
      flexDirection: 'row',
      gap: 10,
    },


    actionCard: {
      flex: 1,
      backgroundColor:
        BrandColors.white,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      padding: 13,
    },


    actionIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 9,
    },


    actionIconText: {
      color:
        BrandColors.primary,
      fontSize: 12,
      fontWeight: '900',
    },


    actionTitle: {
      color:
        BrandColors.text,
      fontSize: 11,
      fontWeight: '900',
    },


    actionSubtitle: {
      color:
        BrandColors.textSecondary,
      fontSize: 8,
      marginTop: 3,
    },


    /*
    -------------------------------------------------------
    LOGOUT
    -------------------------------------------------------
    */

    logoutButton: {
      minHeight: 45,
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        '#F0D4D2',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 25,
    },


    logoutText: {
      color:
        BrandColors.danger,
      fontSize: 11,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    FOOTER
    -------------------------------------------------------
    */

    footer: {
      textAlign: 'center',
      color:
        '#AAAAAA',
      fontSize: 8,
      marginTop: 16,
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
      fontSize: 11,
      marginTop: 10,
    },

  });