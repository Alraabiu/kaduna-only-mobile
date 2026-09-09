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
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import MapView, {
  Marker,
  AnimatedRegion,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from 'react-native-maps';

import {
  router,
  useLocalSearchParams,
  useFocusEffect,
} from 'expo-router';

import api, {
  setAuthToken,
} from '../../services/api';

import {
  connectSocket,
  onSocket,
} from '../../services/socket';

import {
  getStoredToken,
} from '../../storage/auth';

import * as Location from 'expo-location';

import {
  playDriverArrivalSound,
} from '../../utils/tripSounds';



/*
=========================================================
KADUNA ONLY BRAND
=========================================================
*/

const PURPLE = '#4B24A8';
const GOLD = '#F5C542';

const WHITE = '#FFFFFF';
const BACKGROUND = '#F7F5FB';

const TEXT = '#171717';
const MUTED = '#777777';

const GREEN = '#168A55';
const RED = '#D64545';

const BORDER = '#ECEAF2';
const SOFT_PURPLE = '#F0EBFF';
const SOFT_GREEN = '#EEF9F1';
const SOFT_RED = '#FFF0F0';

/*
=========================================================
TYPES
=========================================================
*/

type TripPoint = {
  label?: string;
  address?: string;
  name?: string;
  lat?: number;
  lng?: number;
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
  estimatedMinutes?: number;
  driver?: Driver;
  arrivalStatus?: string;
  riderArrivalConfirmed?: boolean;
  riderArrivalConfirmedAt?: string;
  driverCompletionRequestedAt?: string;
  createdAt?: string;
  completedAt?: string;
};

/*
=========================================================
HELPERS
=========================================================
*/

function formatMoney(
  amount?: number
): string {
  const value = Number(amount || 0);
  return `₦${value.toLocaleString(
    'en-NG',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function getPointLabel(
  point?: TripPoint
) {
  return (
    point?.label ||
    point?.address ||
    point?.name ||
    'Location unavailable'
  );
}

function formatStatus(
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
      return 'Trip completed';
    case 'CANCELLED':
      return 'Trip cancelled';
    default:
      return 'Ride information';
  }
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 4 &&
    lat <= 14 &&
    lng >= 2 &&
    lng <= 15
  );
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/*
=========================================================
SCREEN
=========================================================
*/

export default function RiderTrip() {
  const params = useLocalSearchParams<{
    id?: string;
  }>();

  const tripId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  /*
  =======================================================
  TRIP DATA
  =======================================================
  */

  const [trip, setTrip] = useState<Trip | null>(null);

  /*
  =======================================================
  SCREEN STATE
  =======================================================
  */

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingArrival, setConfirmingArrival] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);

  /*
  =======================================================
  LIVE DRIVER LOCATION
  =======================================================
  */

  const mapRef = useRef<MapView | null>(null);

  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
  } | null>(null);


  /*
  =======================================================
  RIDER MAP LOCATION
  =======================================================
  */

  const [riderLocation, setRiderLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  /*
  =======================================================
  MAP STATUS
  =======================================================
  */

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketReconnectAttempt, setSocketReconnectAttempt] = useState(0);

  /*
  =======================================================
  DRIVER SEARCH STATUS
  =======================================================
  */

  const [findingDriver, setFindingDriver] = useState(false);
  const [driverApproaching, setDriverApproaching] = useState(false);

  const loadTrip = useCallback(async (showLoading = true) => {
    if (!tripId) {
      setTrip(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      const response = await api.get(`/trips/${tripId}`);
      const loadedTrip: Trip | null =
        response?.data?.data?.trip || response?.data?.trip || null;
      setTrip(loadedTrip);

      const searching = Boolean(
        loadedTrip?.status === 'SEARCHING_DRIVER' && !loadedTrip.driver
      );
      setFindingDriver(searching);
      setDriverApproaching(Boolean(loadedTrip?.driver));
      setTrackingActive(
        Boolean(loadedTrip?.status === 'TRIP_STARTED' && loadedTrip.driver)
      );
      if (
        !loadedTrip ||
        loadedTrip.status === 'TRIP_COMPLETED' ||
        loadedTrip.status === 'CANCELLED'
      ) {
        setFindingDriver(false);
        setDriverApproaching(false);
        setTrackingActive(false);
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        setAuthToken();
        router.replace('/login');
        return;
      }
      setTrip(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  /*
  =======================================================
  MARKER ANIMATION
  =======================================================
  */

  const driverMarkerCoordinate = useRef(
    new AnimatedRegion({
      latitude: 10.5222,
      longitude: 7.4383,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  /*
  =======================================================
  DRIVER ARRIVAL / TRACKING STATE
  =======================================================
  */

  const [driverDistance, setDriverDistance] = useState<number | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);

  
/*
=======================================================
DRIVER ARRIVAL SOUND
=======================================================
*/

const previousTripStatusRef = useRef<string | undefined>(
  undefined
);

useEffect(() => {
  if (!trip) {
    return;
  }

  const currentStatus = trip.status;

  /*
  Only play the sound when the trip
  ENTERS DRIVER_ARRIVED.
  */

  if (
    currentStatus === 'DRIVER_ARRIVED' &&
    previousTripStatusRef.current !== 'DRIVER_ARRIVED'
  ) {
    console.log(
      '[RIDER TRIP] Driver has arrived - playing sound'
    );

    playDriverArrivalSound(
      trip._id || trip.tripId
    );
  }

  previousTripStatusRef.current = currentStatus;
}, [
  trip?.status,
  trip?._id,
  trip?.tripId,
]);

  /*
  =======================================================
  RIDER LIVE DRIVER LOCATION SOCKET
  =======================================================
  */

  useEffect(() => {
    if (!tripId) {
      return;
    }

    let mounted = true;
    let cleanup = () => {};
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function setupDriverLocationSocket() {
      try {
        const socket = await connectSocket();

        if (!socket || !mounted) {
          return;
        }

        setSocketConnected(true);

        console.log(
          '[RIDER TRIP] Driver tracking socket connected',
          tripId
        );

        cleanup = onSocket(
          'driver:location',
          (payload: any) => {
            try {
              if (!mounted) {
                return;
              }

              if (!payload || typeof payload !== 'object') {
                console.warn('[RIDER TRIP] Invalid driver location payload');
                return;
              }

              const incomingTripId = payload?.tripId
                ? String(payload.tripId)
                : null;

              if (!incomingTripId || incomingTripId !== String(tripId)) {
                return;
              }

              const location = payload?.location;
              if (!location || typeof location !== 'object') {
                console.warn('[RIDER TRIP] Missing location data');
                return;
              }

              const latitude = Number(location?.latitude);
              const longitude = Number(location?.longitude);

              if (!isValidCoordinate(latitude, longitude)) {
                console.warn('[RIDER TRIP] Invalid coordinates:', {
                  latitude,
                  longitude,
                });
                return;
              }

              const nextLocation = {
                latitude,
                longitude,
                accuracy: Number.isFinite(Number(location?.accuracy))
                  ? Number(location.accuracy)
                  : undefined,
                heading: Number.isFinite(Number(location?.heading))
                  ? Number(location.heading)
                  : undefined,
              };

              setDriverLocation(nextLocation);

              const animatedDriverLocation = {
                latitude,
                longitude,
              } as any;

              driverMarkerCoordinate.timing({
                toValue: {
                  latitude: animatedDriverLocation.latitude,
                  longitude: animatedDriverLocation.longitude,
                },
                latitude: animatedDriverLocation.latitude,
                longitude: animatedDriverLocation.longitude,
                duration: 1200,
                useNativeDriver: false,
              } as any).start();

              setFindingDriver(false);
              setDriverApproaching(true);

              if (trip?.pickup?.lat && trip?.pickup?.lng) {
                const pickupLat = Number(trip.pickup.lat);
                const pickupLng = Number(trip.pickup.lng);
                if (isValidCoordinate(pickupLat, pickupLng)) {
                  const distance = calculateDistance(
                    latitude,
                    longitude,
                    pickupLat,
                    pickupLng
                  );
                  setDriverDistance(distance);
                }
              }

              if (
                mapReady &&
                mapRef.current &&
                trip?.pickup?.lat &&
                trip?.pickup?.lng
              ) {

                mapRef.current.fitToCoordinates(
                  [
                    {
                      latitude,
                      longitude,
                    },

                    {
                      latitude: Number(
                        trip.pickup.lat
                      ),

                      longitude: Number(
                        trip.pickup.lng
                      ),
                    },

                  ],
                  {
                    edgePadding: {
                      top: 80,
                      bottom: 120,
                      left: 60,
                      right: 60,
                    },

                    animated: true,
                  }
                );

              }

            } catch (error) {
              console.error('[RIDER TRIP] Error processing driver location:', error);
            }
          }
        );

      } catch (error: any) {
        console.log('[RIDER DRIVER LOCATION SOCKET ERROR]', error?.message || error);
        setSocketConnected(false);

        if (mounted) {
          reconnectTimer = setTimeout(() => {
            setSocketReconnectAttempt(prev => prev + 1);
          }, 5000);
        }
      }
    }

    setupDriverLocationSocket();

    return () => {
      mounted = false;
      cleanup();
      setSocketConnected(false);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      driverMarkerCoordinate.stopAnimation(() => {});
      console.log('[RIDER TRIP] Driver location socket cleanup', tripId);
    };

  }, [tripId, mapReady, trip?.pickup?.lat, trip?.pickup?.lng, socketReconnectAttempt]);

  /*
  =======================================================
  RIDER LOCATION TRACKING
  =======================================================
  */

  useEffect(() => {
    let locationSubscription: any = null;

    async function setupRiderLocation() {
      try {
        if (!trip || trip.status !== 'TRIP_STARTED') {
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[RIDER TRIP] Location permission denied');
          return;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            const latitude = location.coords.latitude;
            const longitude = location.coords.longitude;

            if (isValidCoordinate(latitude, longitude)) {
              setRiderLocation({
                latitude,
                longitude,
              });
            }
          }
        );

        console.log('[RIDER TRIP] Rider location tracking started');
      } catch (error) {
        console.log('[RIDER TRIP] Error setting up location tracking:', error);
      }
    }

    setupRiderLocation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
        console.log('[RIDER TRIP] Rider location tracking stopped');
      }
    };
  }, [trip?.status]);

  /*
  =======================================================
  SOCKET RECONNECTION
  =======================================================
  */

  useEffect(() => {
    if (!socketConnected && tripId && trip?.driver) {
      const reconnectTimer = setTimeout(() => {
        console.log('[RIDER TRIP] Attempting to reconnect socket...');
        setSocketReconnectAttempt(prev => prev + 1);
      }, 5000);

      return () => clearTimeout(reconnectTimer);
    }
  }, [socketConnected, tripId, trip?.driver]);

  /*
  =======================================================
  INITIAL LOAD
  =======================================================
  */

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  /*
  =======================================================
  REFRESH WHEN SCREEN GETS FOCUS
  =======================================================
  */

  useFocusEffect(
    useCallback(() => {
      loadTrip(false);
    }, [loadTrip])
  );

  /*
  =======================================================
  REFRESH
  =======================================================
  */

  async function refresh() {
    setRefreshing(true);
    await loadTrip(false);
  }

  /*
  =======================================================
  RIDER ARRIVAL CONFIRMATION
  =======================================================
  */

  async function confirmArrival() {
    if (!trip?._id || confirmingArrival) {
      return;
    }

    if (trip.status !== 'TRIP_STARTED') {
      Alert.alert(
        'Not ready yet',
        'You can confirm arrival when the trip is in progress.'
      );
      return;
    }

    if (trip.riderArrivalConfirmed) {
      Alert.alert(
        'Already confirmed',
        'You have already confirmed your arrival.'
      );
      return;
    }

    Alert.alert(
      'Confirm arrival',
      'Have you actually reached your destination?',
      [
        {
          text: 'Not yet',
          style: 'cancel',
        },
        {
          text: 'Yes, I have arrived',
          onPress: async () => {
            try {
              setConfirmingArrival(true);

              console.log('[RIDER TRIP] Confirming destination:', trip._id);

              const response = await api.post(
                `/trips/${trip._id}/destination/confirm`
              );

              const updated =
                response?.data?.data?.trip ||
                response?.data?.trip ||
                null;

              if (updated) {
                setTrip(updated);
              } else {
                await loadTrip(false);
              }

              Alert.alert(
                'Arrival confirmed',
                'The driver can now complete the trip.'
              );

            } catch (error: any) {
              console.log('[RIDER ARRIVAL ERROR]', error);

              if (error?.response?.status === 401) {
                setAuthToken();
                router.replace('/login');
                return;
              }

              Alert.alert(
                'Unable to confirm arrival',
                error?.response?.data?.message || 'Please try again.'
              );

            } finally {
              setConfirmingArrival(false);
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
      <View style={styles.loadingScreen}>
        <View style={styles.loadingLogo}>
          <Text style={styles.loadingLogoText}>K</Text>
        </View>
        <Text style={styles.loadingBrand}>KADUNA ONLY</Text>
        <Text style={styles.loadingSubtitle}>Loading your ride...</Text>
        <ActivityIndicator size="small" color={PURPLE} style={styles.loadingIndicator} />
      </View>
    );
  }

  /*
  =======================================================
  NO TRIP
  =======================================================
  */

  if (!trip) {
    return (
      <View style={styles.emptyScreen}>
        <View style={styles.emptyIcon}>
          <Ionicons name="car-outline" size={30} color={PURPLE} />
        </View>
        <Text style={styles.emptyTitle}>Ride unavailable</Text>
        <Text style={styles.emptyText}>This ride could not be found.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  /*
=======================================================
STATE
=======================================================
*/

const isStarted = trip.status === 'TRIP_STARTED';

const completed =
  trip.status === 'TRIP_COMPLETED';

const confirmed =
  trip.riderArrivalConfirmed === true ||
  trip.arrivalStatus === 'rider_confirmed';

const completionRequested =
  Boolean(trip.driverCompletionRequestedAt) &&
  !completed;

const isSearchingForDriver =
  trip.status === 'SEARCHING_DRIVER' &&
  !trip.driver;

  /*
  =======================================================
  MAIN SCREEN
  =======================================================
  */

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={PURPLE}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color={TEXT} />
          </Pressable>

          <Pressable style={styles.refreshButton} onPress={() => loadTrip(false)}>
            <Ionicons name="refresh-outline" size={20} color={PURPLE} />
          </Pressable>
        </View>

        {/* ================================================= 
            STATUS CARD 
        ================================================= */}

        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            {completed ? (
              <Ionicons name="checkmark" size={25} color={GREEN} />
            ) : isStarted ? (
              <Ionicons name="navigate" size={25} color={PURPLE} />
            ) : confirmed ? (
              <Ionicons name="flag-outline" size={25} color={PURPLE} />
            ) : (
              <ActivityIndicator size="small" color={PURPLE} />
            )}
          </View>

          <View style={styles.statusContent}>
            <Text style={styles.statusLabel}>RIDE STATUS</Text>
            <Text style={styles.statusTitle}>
              {completed
                ? 'Trip Completed'
                : isStarted
                ? 'Driver On Trip'
                : trip.driver
                ? 'Driver Assigned'
                : 'Finding a driver'}
            </Text>
            <Text style={styles.statusDescription}>
              {completed
                ? 'This ride has been completed successfully.'
                : confirmed
                ? 'You confirmed arrival. The driver can now complete the trip.'
                : completionRequested
                ? 'Your driver has requested completion. Please confirm your arrival.'
                : isStarted
                ? 'Your driver is taking you to your destination.'
                : trip.driver
                ? 'Your driver is on the way to pick you up.'
                : 'Searching for an available driver nearby.'}
            </Text>
          </View>
        </View>

        {/* =================================================
            DRIVER
        ================================================= */}

        {trip.driver && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Driver</Text>

            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>
                  {(trip.driver.fullName || 'Driver').trim().charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.driverInfo}>
                <View style={styles.driverNameRow}>
                  <Text style={styles.driverName}>
                    {trip.driver.fullName || 'Your driver'}
                  </Text>
                  <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                </View>

                {trip.driver.phone && (
                  <Text style={styles.driverPhone}>{trip.driver.phone}</Text>
                )}

                {trip.vehicleType && (
                  <Text style={styles.driverVehicle}>{trip.vehicleType}</Text>
                )}
              </View>

              <View style={styles.driverVerified}>
                <Ionicons name="shield-checkmark" size={23} color={GREEN} />
              </View>
            </View>

            <View style={styles.driverStatus}>
              <View style={styles.driverOnlineDot} />
              <Text style={styles.driverStatusText}>
                Driver is verified and on the way
              </Text>
            </View>
          </View>
        )}

        {/* =================================================
            LIVE DRIVER MAP - FIXED WITH ERROR HANDLING
        ================================================= */}

        <View style={styles.card}>

          <View style={styles.mapHeader}>

            <View>

              <Text style={styles.cardTitle}>
                Driver Tracking
              </Text>

              <Text style={styles.mapSubtitle}>

               {
  isSearchingForDriver

    ? 'Searching for the nearest driver'

    : completed

      ? 'Trip completed'

      : driverLocation

        ? driverDistance !== null &&
          driverDistance < 0.5

          ? 'Driver is very close to you'

          : 'Driver is moving towards you'

        : trip.driver

          ? 'Driver has been assigned'

          : 'Waiting for driver assignment'
}

              </Text>

            </View>

            <View
              style={[
                styles.liveBadge,

                !driverLocation &&
                  styles.searchingBadge,
              ]}
            >

             {
  isSearchingForDriver ? (

    <>

      <ActivityIndicator
        size="small"
        color={PURPLE}
      />

      <Text
        style={
          styles.liveBadgeText
        }
      >
        SEARCHING
      </Text>

    </>

  ) : completed ? (

    <>

      <View
        style={[
          styles.liveBadgeDot,
          {
            backgroundColor: GREEN,
          },
        ]}
      />

      <Text
        style={
          styles.liveBadgeText
        }
      >
        COMPLETED
      </Text>

    </>

  ) : (

    <>

      <View
        style={
          styles.liveBadgeDot
        }
      />

      <Text
        style={
          styles.liveBadgeText
        }
      >
        LIVE
      </Text>

    </>

  )
}
            </View>

          </View>

          {
            !trip.driver ? (

              <View style={styles.mapLoading}>

                <ActivityIndicator
                  size="large"
                  color={PURPLE}
                />

                <Text style={styles.mapLoadingText}>
                  Finding a nearby driver...
                </Text>

                <Text style={styles.searchHint}>
                  Please wait while we match you with a driver.
                </Text>

              </View>

            ) : (

              <View style={styles.mapContainer}>
                <View style={styles.mapWrapper}>
                  {mapError ? (
                    <View style={styles.mapErrorContainer}>
                      <Ionicons name="map-outline" size={40} color={MUTED} />
                      <Text style={styles.mapErrorText}>
                        Unable to load map
                      </Text>
                      <Text style={styles.mapErrorSubtext}>
                        {mapError}
                      </Text>
                      <Pressable 
                        style={styles.retryButton}
                        onPress={() => {
                          setMapError(null);
                          setMapReady(false);
                        }}
                      >
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <MapView
                      key={`map-${trip._id || 'trip'}`}
                      style={styles.map}
                      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                      onMapReady={() => {
                        console.log('[RIDER TRIP] Map ready');
                        setMapReady(true);
                        setMapError(null);
                      }}
                      initialRegion={{
                        latitude: Number(trip.pickup?.lat) || 10.5222,
                        longitude: Number(trip.pickup?.lng) || 7.4383,
                        latitudeDelta: 0.012,
                        longitudeDelta: 0.012,
                      }}
                      showsCompass
                      showsScale={false}
                      showsUserLocation={isStarted}
                      followsUserLocation={false}
                      toolbarEnabled={false}
                      loadingEnabled={true}
                      loadingIndicatorColor={PURPLE}
                      loadingBackgroundColor={WHITE}
                      minZoomLevel={10}
                      maxZoomLevel={20}
                    >

                      {driverLocation && (
                        <Marker.Animated
                          coordinate={driverMarkerCoordinate as any}
                          title={trip.driver.fullName || 'Your Driver'}
                          description="Driver is coming to your pickup location"
                          anchor={{
                            x: 0.5,
                            y: 0.5,
                          }}
                        >
                          <View style={styles.driverMapMarker}>
                            <Text style={styles.driverMapEmoji}>
                              🛺
                            </Text>
                          </View>
                        </Marker.Animated>
                      )}

                      {trip.pickup?.lat && trip.pickup?.lng && (
                        <Marker
                          coordinate={{
                            latitude: Number(trip.pickup.lat),
                            longitude: Number(trip.pickup.lng),
                          }}
                          title="Pickup location"
                        >
                          <View style={styles.pickupMapMarker}>
                            <Text>📍</Text>
                          </View>
                        </Marker>
                      )}

                      {riderLocation && isStarted && (
                        <Marker
                          coordinate={{
                            latitude: riderLocation.latitude,
                            longitude: riderLocation.longitude,
                          }}
                          title="Your location"
                        >
                          <View style={styles.riderMapMarker}>
                            <Text>👤</Text>
                          </View>
                        </Marker>
                      )}

                      {trip.destination?.lat && trip.destination?.lng && (
                        <Marker
                          coordinate={{
                            latitude: Number(trip.destination.lat),
                            longitude: Number(trip.destination.lng),
                          }}
                          title="Destination"
                        >
                          <View style={styles.destinationMapMarker}>
                            <Text>🏁</Text>
                          </View>
                        </Marker>
                      )}

                    </MapView>
                  )}
                </View>

                <View style={styles.liveLocationRow}>
                  <View style={styles.liveLocationDot} />
                  <Text style={styles.liveLocationText}>
                    {
                      isStarted
                        ? 'Your ride is currently in progress'
                        : driverLocation
                          ? 'Driver is moving towards your pickup location'
                          : 'Waiting for driver location update'
                    }
                  </Text>
                </View>

              </View>

            )
          }

        </View>

        {/* =================================================
            ROUTE
        ================================================= */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Details</Text>

          <View style={styles.locationRow}>
            <View style={styles.routeIndicator}>
              <View style={styles.pickupDot} />
              <View style={styles.routeLine} />
              <View style={styles.destinationDot} />
            </View>

            <View style={styles.locationContent}>
              <View style={styles.locationBlock}>
                <Text style={styles.locationLabel}>PICKUP</Text>
                <Text style={styles.locationText} numberOfLines={3}>
                  {getPointLabel(trip.pickup)}
                </Text>
              </View>

              <View style={styles.locationGap} />

              <View style={styles.locationBlock}>
                <Text style={styles.locationLabel}>DESTINATION</Text>
                <Text style={styles.locationText} numberOfLines={3}>
                  {getPointLabel(trip.destination)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* =================================================
            FARE
        ================================================= */}

        <View style={styles.fareCard}>
          <View>
            <Text style={styles.fareLabel}>Trip Fare</Text>
            <Text style={styles.fareAmount}>
              {formatMoney(trip.fare ?? trip.totalFare)}
            </Text>
          </View>

          <View style={styles.paymentBadge}>
            <Ionicons
              name={trip.paymentMethod === 'wallet' ? 'wallet-outline' : 'cash-outline'}
              size={17}
              color={PURPLE}
            />
            <Text style={styles.paymentText}>
              {trip.paymentMethod === 'wallet' ? 'Wallet' : 'Cash'}
            </Text>
          </View>
        </View>

        {/* =================================================
            ARRIVAL CONFIRMATION
        ================================================= */}

        {isStarted && !confirmed && !completed && (
          <View style={styles.confirmCard}>
            <View style={styles.confirmedIcon}>
              <Ionicons name="location" size={23} color={PURPLE} />
            </View>

            <Text style={styles.confirmedTitle}>
              Have you reached your destination?
            </Text>

            <Text style={styles.confirmedText}>
              Only confirm this when you are actually at your destination. Your
              confirmation allows the driver to end the ride.
            </Text>

            <Pressable
              onPress={confirmArrival}
              disabled={confirmingArrival}
              style={styles.primaryButton}
            >
              {confirmingArrival ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={19} color={WHITE} />
                  <Text style={styles.primaryButtonText}>I HAVE ARRIVED</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* =================================================
            CONFIRMED
        ================================================= */}

        {confirmed && !completed && (
          <View style={styles.confirmedCard}>
            <View style={styles.confirmedIcon}>
              <Ionicons name="checkmark" size={24} color={WHITE} />
            </View>

            <View style={styles.confirmedContent}>
              <Text style={styles.confirmedTitle}>Arrival Confirmed</Text>
              <Text style={styles.confirmedText}>
                The driver has been authorized to complete this trip.
              </Text>
            </View>
          </View>
        )}

        {/* =================================================
            DRIVER REQUESTED
        ================================================= */}

        {completionRequested && !confirmed && !completed && (
          <View style={styles.waitingCard}>
            <ActivityIndicator size="small" color={PURPLE} />

            <View style={styles.waitingContent}>
              <Text style={styles.waitingTitle}>Driver requested completion</Text>
              <Text style={styles.waitingText}>
                Please confirm that you have actually reached your destination.
              </Text>
            </View>
          </View>
        )}

        {/* =================================================
            COMPLETED
        ================================================= */}

        {completed && (
          <View style={styles.completedCard}>
            <View style={styles.completedIcon}>
              <Ionicons name="checkmark" size={25} color={WHITE} />
            </View>

            <Text style={styles.completedTitle}>Trip Completed</Text>
            <Text style={styles.completedText}>
              Thank you for riding with Kaduna Only.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

/*
=========================================================
STYLES
=========================================================
*/

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },

  card: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: WHITE,
  },

  cardTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '900',
  },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },

  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },

  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  driverName: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '900',
  },

  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EEFF',
  },

  driverAvatarText: {
    color: PURPLE,
    fontSize: 20,
    fontWeight: '900',
  },

  driverVehicle: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },

  driverPhone: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },

  driverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  driverVerified: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  driverStatusText: {
    marginLeft: 8,
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },

  driverOnlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GREEN,
  },

  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EEFF',
  },

  routeIndicator: {
    width: 18,
    alignItems: 'center',
  },

  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PURPLE,
  },

  routeLine: {
    width: 2,
    flex: 1,
    minHeight: 36,
    marginVertical: 5,
    backgroundColor: '#D8D1EA',
  },

  destinationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GOLD,
  },

  locationRow: {
    flexDirection: 'row',
    marginTop: 16,
  },

  liveLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  locationContent: {
    flex: 1,
    marginLeft: 12,
  },

  locationBlock: {
    minHeight: 48,
  },

  locationGap: {
    height: 20,
  },

  locationLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  locationText: {
    marginTop: 4,
    color: TEXT,
    fontSize: 13,
    fontWeight: '600',
  },

  liveLocationText: {
    marginLeft: 8,
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },

  liveLocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PURPLE,
  },

  primaryButtonText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
  },

  bottomSpace: {
    height: 24,
  },

  fareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: WHITE,
  },

  fareLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },

  fareAmount: {
    marginTop: 4,
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
  },

  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3EEFF',
  },

  paymentText: {
    marginLeft: 6,
    color: PURPLE,
    fontSize: 12,
    fontWeight: '800',
  },

  confirmCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F3EEFF',
  },

  confirmedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#EAF8F0',
  },

  confirmedContent: {
    flex: 1,
  },

  confirmedTitle: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '900',
  },

  confirmedText: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
  },

  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F3EEFF',
  },

  waitingContent: {
    flex: 1,
    marginLeft: 12,
  },

  waitingTitle: {
    color: PURPLE,
    fontSize: 15,
    fontWeight: '900',
  },

  waitingText: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
  },

  completedCard: {
    alignItems: 'center',
    marginTop: 14,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#EAF8F0',
  },

  completedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
  },

  completedTitle: {
    marginTop: 10,
    color: GREEN,
    fontSize: 17,
    fontWeight: '900',
  },

  completedText: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
  },

  confirmedIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
    marginRight: 12,
  },

  mapLoading: {
    height: 220,
    borderRadius: 18,
    backgroundColor: '#F7F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mapLoadingText: {
    marginTop: 10,
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },

  searchHint: {
    marginTop: 5,
    color: MUTED,
    fontSize: 10,
  },

  mapContainer: {
    height: 320,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor: '#F5F5F5',
  },

  mapWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  mapSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: MUTED,
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAF8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  searchingBadge: {
    backgroundColor: '#F3EEFF',
  },

  liveBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },

  searchingDot: {
    backgroundColor: PURPLE,
  },

  liveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PURPLE,
  },

  driverMapMarker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: PURPLE,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },

  driverMapEmoji: {
    fontSize: 27,
  },

  pickupMapMarker: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PURPLE,
  },

  destinationMapMarker: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: GOLD,
  },

  riderMapMarker: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: GREEN,
  },

  mapErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },

  mapErrorText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT,
  },

  mapErrorSubtext: {
    marginTop: 5,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: PURPLE,
  },

  retryButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: 'bold',
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
    backgroundColor: PURPLE,
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
  EMPTY
  =====================================================
  */

  emptyScreen: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: SOFT_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    marginTop: 15,
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
  },

  emptyText: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
  },

  /*
  =====================================================
  HEADER
  =====================================================
  */

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: WHITE,
  },

  statusContent: {
    flex: 1,
    marginLeft: 12,
  },

  statusLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  statusTitle: {
    marginTop: 3,
    color: TEXT,
    fontSize: 16,
    fontWeight: '900',
  },

  statusDescription: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
  },

  headerSubtitle: {
    marginTop: 3,
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});