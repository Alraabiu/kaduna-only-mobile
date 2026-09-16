
  import {
    useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
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
  useLocalSearchParams,
} from 'expo-router';

import { Ionicons } from '@expo/vector-icons';

import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

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
  lat?: number;
  lng?: number;
  heading?: number;
  accuracy?: number;
};

type MapPoint = {
  latitude: number;
  longitude: number;
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
  routeGeometry?: any;

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
COLORS
=========================================================
*/

const PURPLE =
  BrandColors.primary ||
  '#4B24A8';

const WHITE = '#FFFFFF';
const TEXT = BrandColors.text || '#202124';
const MUTED =
  BrandColors.textSecondary ||
  '#777A82';

const BACKGROUND =
  BrandColors.background ||
  '#F7F7FA';

const BORDER = '#E8E6ED';
const SOFT_PURPLE = '#F2EEFF';
const RED = '#D94B4B';
const GREEN = '#159A63';
const GOLD = '#F5B800';


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


function formatValue(
  value?: string
): string {

  if (!value) {
    return 'Not specified';
  }

  return value
    .replace(/_/g, ' ')
    .toLowerCase()
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


function getCoordinate(
  location?: LocationPoint
): MapPoint | null {

  if (!location) {
    return null;
  }

  const latitude =
    Number(
      location.latitude ??
      location.lat
    );

  const longitude =
    Number(
      location.longitude ??
      location.lng
    );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };

}


function getDriverCoordinate(
  location?: DriverLocation | null
): MapPoint | null {

  if (!location) {
    return null;
  }

  const latitude =
    Number(
      location.latitude ??
      location.lat
    );

  const longitude =
    Number(
      location.longitude ??
      location.lng
    );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };

}


function getStatusMessage(
  status?: string
): string {

  switch (status) {

    case 'SEARCHING_DRIVER':
      return 'Finding a nearby driver for your ride.';

    case 'DRIVER_ASSIGNED':
      return 'Your driver has accepted the ride.';

    case 'DRIVER_ARRIVING':
      return 'Your driver is heading to your pickup.';

    case 'DRIVER_ARRIVED':
      return 'Your driver has arrived at the pickup point.';

    case 'TRIP_STARTED':
      return 'You are currently on the way to your destination.';

    case 'COMPLETED':
      return 'This ride has been completed.';

    case 'CANCELLED':
      return 'This ride was cancelled.';

    default:
      return 'Trip status is being updated.';

  }

}


function getStatusIcon(
  status?: string
): keyof typeof Ionicons.glyphMap {

  switch (status) {

    case 'SEARCHING_DRIVER':
      return 'search';

    case 'DRIVER_ASSIGNED':
    case 'DRIVER_ARRIVING':
      return 'car-sport';

    case 'DRIVER_ARRIVED':
      return 'location';

    case 'TRIP_STARTED':
      return 'navigate';

    case 'COMPLETED':
      return 'checkmark-circle';

    case 'CANCELLED':
      return 'close-circle';

    default:
      return 'time';

  }

}


function getStatusColor(
  status?: string
): string {

  switch (status) {

    case 'COMPLETED':
      return GREEN;

    case 'CANCELLED':
      return RED;

    case 'DRIVER_ARRIVED':
      return GOLD;

    default:
      return PURPLE;

  }

}


function getVehicleIcon(
  vehicleType?: string
): keyof typeof Ionicons.glyphMap {

  switch (
    String(vehicleType || '')
      .toLowerCase()
  ) {

    case 'motorcycle':
      return 'bicycle';

    case 'car':
      return 'car-sport';

    default:
      return 'bus';

  }

}


function routeCoordinates(
  geometry: any
): MapPoint[] {

  if (!geometry) {
    return [];
  }

  let raw =
    geometry;

  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw)
  ) {

    if (raw.geometry) {
      raw = raw.geometry;
    }

    if (raw.coordinates) {
      raw = raw.coordinates;
    }

  }


  const points: MapPoint[] =
    [];


  const walk =
    (value: any) => {

      if (!Array.isArray(value)) {
        return;
      }


      if (
        value.length >= 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
      ) {

        points.push({
          latitude:
            Number(value[1]),
          longitude:
            Number(value[0]),
        });

        return;

      }


      value.forEach(
        walk
      );

    };


  walk(raw);


  return points.filter(
    point =>
      Number.isFinite(
        point.latitude
      ) &&
      Number.isFinite(
        point.longitude
      ) &&
      Math.abs(
        point.latitude
      ) <= 90 &&
      Math.abs(
        point.longitude
      ) <= 180
  );

}


/*
=========================================================
SMALL COMPONENTS
=========================================================
*/

function DetailRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {

  return (

    <View
      style={[
        styles.detailRow,
        last &&
        styles.detailRowLast,
      ]}
    >

      <View
        style={
          styles.detailIcon
        }
      >

        <Ionicons
          name={icon}
          size={18}
          color={PURPLE}
        />

      </View>


      <View
        style={
          styles.detailCopy
        }
      >

        <Text
          style={
            styles.detailLabel
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.detailValue
          }
        >
          {value}
        </Text>

      </View>

    </View>

  );

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
    Array.isArray(
      params.id
    )
      ? params.id[0]
      : params.id;


  const mapRef =
    useRef<MapView | null>(
      null
    );


  const [
    trip,
    setTrip,
  ] =
    useState<Trip | null>(
      null
    );


  const [
    driverLocation,
    setDriverLocation,
  ] =
    useState<DriverLocation | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState<boolean>(
      true
    );


  const [
    refreshing,
    setRefreshing,
  ] =
    useState<boolean>(
      false
    );


  const [
    cancelling,
    setCancelling,
  ] =
    useState<boolean>(
      false
    );


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  const [
    mapReady,
    setMapReady,
  ] =
    useState<boolean>(
      false
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


    setAuthToken(
      token
    );

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

          setLoading(
            false
          );

          return;

        }


        try {

          if (showLoader) {
            setLoading(
              true
            );
          }


          setError(
            null
          );


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


          if (
            e?.response?.status ===
            401
          ) {

            setAuthToken();

            router.replace(
              '/login' as any
            );

            return;

          }


          setError(
            e?.response?.data?.message ||
            'Unable to load this trip.'
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
  DERIVED MAP DATA
  =======================================================
  */

  const pickupCoordinate: MapPoint | null =
    getCoordinate(
      trip?.pickup
    );


  const destinationCoordinate: MapPoint | null =
    getCoordinate(
      trip?.destination
    );


  const driverCoordinate: MapPoint | null =
    getDriverCoordinate(
      driverLocation
    );


  const routePoints: MapPoint[] =
    routeCoordinates(
      trip?.routeGeometry
    );


  const mapCoordinates: MapPoint[] =
    useMemo<MapPoint[]>(
      () => {

        const points: MapPoint[] =
          [];


        if (
          routePoints.length > 1
        ) {

          points.push(
            ...routePoints
          );

        } else {

          if (
            pickupCoordinate
          ) {

            points.push(
              pickupCoordinate
            );

          }


          if (
            destinationCoordinate
          ) {

            points.push(
              destinationCoordinate
            );

          }

        }


        if (
          driverCoordinate
        ) {

          points.push(
            driverCoordinate
          );

        }


        return points;

      },
      [
        routePoints,
        pickupCoordinate,
        destinationCoordinate,
        driverCoordinate,
      ]
    );


  useFocusEffect(
    useCallback(
      () => {

        if (
          !mapReady ||
          mapCoordinates.length <
          2
        ) {
          return;
        }


        const timer =
          setTimeout(
            () => {

              mapRef.current
                ?.fitToCoordinates(
                  mapCoordinates,
                  {
                    edgePadding: {
                      top: 90,
                      right: 45,
                      bottom: 70,
                      left: 45,
                    },
                    animated: true,
                  }
                );

            },
            250
          );


        return () =>
          clearTimeout(
            timer
          );

      },
      [
        mapReady,
        mapCoordinates,
      ]
    )
  );


  /*
  =======================================================
  ACTIONS
  =======================================================
  */

  async function refreshTrip() {

    setRefreshing(
      true
    );

    await loadTrip(
      
    );

  }


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


  function confirmCancelTrip() {

    if (
      !tripId ||
      !trip ||
      cancelling
    ) {
      return;
    }


    Alert.alert(
      'Cancel this ride?',
      trip.paymentMethod === 'wallet'
        ? 'Your booking will be cancelled. Any reserved wallet payment will be handled by the server refund process.'
        : 'Your booking will be cancelled and the driver will no longer be assigned to this request.',
      [
        {
          text: 'Keep Ride',
          style: 'cancel',
        },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: cancelTrip,
        },
      ]
    );

  }


  async function cancelTrip() {

    if (
      !tripId ||
      cancelling
    ) {
      return;
    }


    try {

      setCancelling(
        true
      );


      const authenticated =
        await prepareAuthentication();


      if (!authenticated) {
        return;
      }


      const response =
        await api.patch(
          `/trips/${tripId}/cancel`
        );


      const cancelledTrip =
        response?.data?.data?.trip ||
        response?.data?.trip ||
        null;


      if (cancelledTrip) {
        setTrip(
          cancelledTrip
        );
      } else {
        await loadTrip(
          false
        );
      }


      setDriverLocation(
        null
      );


      Alert.alert(
        'Ride cancelled',
        trip?.paymentMethod === 'wallet'
          ? 'Your ride has been cancelled. If funds were reserved from your wallet, the backend refund process will restore them according to the trip record.'
          : 'Your ride has been cancelled successfully.'
      );

    } catch (e: any) {

      console.log(
        '[RIDER TRIP CANCEL ERROR]',
        e
      );


      if (
        e?.response?.status ===
        401
      ) {

        setAuthToken();

        router.replace(
          '/login' as any
        );

        return;

      }


      Alert.alert(
        'Unable to cancel ride',
        e?.response?.data?.message ||
        'This ride cannot be cancelled at its current stage.'
      );

    } finally {

      setCancelling(
        false
      );

    }

  }


  function recenterMap() {

    if (
      mapCoordinates.length >=
      2
    ) {

      mapRef.current
        ?.fitToCoordinates(
          mapCoordinates,
          {
            edgePadding: {
              top: 90,
              right: 45,
              bottom: 70,
              left: 45,
            },
            animated: true,
          }
        );

      return;

    }


    if (
      pickupCoordinate
    ) {

      mapRef.current
        ?.animateToRegion(
          {
            ...pickupCoordinate,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          350
        );

    }

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

        <View
          style={
            styles.loadingLogo
          }
        >

          <Ionicons
            name="navigate"
            size={27}
            color={WHITE}
          />

        </View>


        <ActivityIndicator
          size="large"
          color={PURPLE}
        />


        <Text
          style={
            styles.loadingText
          }
        >
          Loading your ride...
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

        <View
          style={
            styles.errorIcon
          }
        >

          <Ionicons
            name="alert-circle-outline"
            size={31}
            color={RED}
          />

        </View>


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
            loadTrip()
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


  const normalizedStatus =
    String(status || '')
      .trim()
      .toUpperCase();


  const hasDriver =
    !!trip.driver;


  /*
  =======================================================
  RIDER CANCELLATION VISIBILITY
  =======================================================
  */

  const canCancel =
    [
      'SEARCHING_DRIVER',
      'DRIVER_ASSIGNED',
      'DRIVER_ARRIVING',
    ].includes(
      normalizedStatus
    );


  const statusColor =
    getStatusColor(
      status
    );


  const mapInitialCoordinate =
    pickupCoordinate ||
    destinationCoordinate ||
    {
      latitude: 10.5222,
      longitude: 7.4383,
    };


  /*
  =======================================================
  MAIN
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
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              refreshTrip
            }
            tintColor={
              PURPLE
            }
            colors={[
              PURPLE,
            ]}
          />
        }
      >

        {/* =================================================
            MAP HERO
        ================================================= */}

        <View
          style={
            styles.mapHero
          }
        >

          <MapView
            ref={mapRef}
            style={
              StyleSheet.absoluteFill
            }
            provider={
              Platform.OS ===
              'android'
                ? PROVIDER_GOOGLE
                : PROVIDER_DEFAULT
            }
            initialRegion={{
              latitude:
                mapInitialCoordinate.latitude,
              longitude:
                mapInitialCoordinate.longitude,
              latitudeDelta:
                0.025,
              longitudeDelta:
                0.025,
            }}
            onMapReady={() =>
              setMapReady(
                true
              )
            }
            showsCompass
            showsScale={
              false
            }
            showsUserLocation={
              false
            }
            toolbarEnabled={
              false
            }
            loadingEnabled
            loadingIndicatorColor={
              PURPLE
            }
            loadingBackgroundColor={
              WHITE
            }
          >

            {
              routePoints.length >
              1 &&
              (
                <Polyline
                  coordinates={
                    routePoints
                  }
                  strokeColor={
                    PURPLE
                  }
                  strokeWidth={
                    5
                  }
                  lineCap="round"
                  lineJoin="round"
                />
              )
            }


            {
              pickupCoordinate &&
              (
                <Marker
                  coordinate={
                    pickupCoordinate
                  }
                  title="Pickup"
                  description={
                    getLocationLabel(
                      trip.pickup
                    )
                  }
                >

                  <View
                    style={
                      styles.pickupMarker
                    }
                  >

                    <View
                      style={
                        styles.pickupMarkerInner
                      }
                    />

                  </View>

                </Marker>
              )
            }


            {
              destinationCoordinate &&
              (
                <Marker
                  coordinate={
                    destinationCoordinate
                  }
                  title="Destination"
                  description={
                    getLocationLabel(
                      trip.destination
                    )
                  }
                >

                  <View
                    style={
                      styles.destinationMarker
                    }
                  >

                    <Ionicons
                      name="flag"
                      size={15}
                      color={WHITE}
                    />

                  </View>

                </Marker>
              )
            }


            {
              driverCoordinate &&
              hasDriver &&
              (
                <Marker
                  coordinate={
                    driverCoordinate
                  }
                  title={
                    trip.driver?.fullName ||
                    'Your driver'
                  }
                  description="Driver location"
                  anchor={{
                    x: 0.5,
                    y: 0.5,
                  }}
                >

                  <View
                    style={
                      styles.driverMarker
                    }
                  >

                    <Ionicons
                      name={
                        getVehicleIcon(
                          trip.vehicleType
                        )
                      }
                      size={22}
                      color={PURPLE}
                    />

                  </View>

                </Marker>
              )
            }

          </MapView>


          <View
            style={
              styles.mapTopBar
            }
          >

            <Pressable
              onPress={
                goBack
              }
              style={
                styles.mapBackButton
              }
            >

              <Ionicons
                name="arrow-back"
                size={22}
                color={TEXT}
              />

            </Pressable>


            <View
              style={
                styles.tripIdentity
              }
            >

              <Text
                style={
                  styles.tripIdentityTitle
                }
              >
                Trip details
              </Text>

              <Text
                style={
                  styles.tripIdentityId
                }
                numberOfLines={
                  1
                }
              >
                {
                  trip.tripId ||
                  trip._id ||
                  'Trip'
                }
              </Text>

            </View>


            <Pressable
              onPress={
                refreshTrip
              }
              style={
                styles.mapActionButton
              }
            >

              <Ionicons
                name="refresh"
                size={20}
                color={PURPLE}
              />

            </Pressable>

          </View>


          <Pressable
            onPress={
              recenterMap
            }
            style={
              styles.recenterButton
            }
          >

            <Ionicons
              name="locate"
              size={21}
              color={PURPLE}
            />

          </Pressable>


          <View
            style={
              styles.mapStatusCard
            }
          >

            <View
              style={[
                styles.statusIcon,
                {
                  backgroundColor:
                    statusColor,
                },
              ]}
            >

              <Ionicons
                name={
                  getStatusIcon(
                    status
                  )
                }
                size={20}
                color={WHITE}
              />

            </View>


            <View
              style={
                styles.statusCopy
              }
            >

              <Text
                style={
                  styles.statusTitle
                }
              >
                {
                  formatStatus(
                    status
                  )
                }
              </Text>

              <Text
                style={
                  styles.statusMessage
                }
                numberOfLines={
                  2
                }
              >
                {
                  getStatusMessage(
                    status
                  )
                }
              </Text>

            </View>

          </View>

        </View>


        {/* =================================================
            ROUTE SUMMARY
        ================================================= */}

        <View
          style={
            styles.routeCard
          }
        >

          <View
            style={
              styles.routeRail
            }
          >

            <View
              style={
                styles.routePickupDot
              }
            />

            <View
              style={
                styles.routeLine
              }
            />

            <View
              style={
                styles.routeDestinationDot
              }
            />

          </View>


          <View
            style={
              styles.routeLocations
            }
          >

            <View
              style={
                styles.routeLocationBlock
              }
            >

              <Text
                style={
                  styles.routeCaption
                }
              >
                PICKUP
              </Text>

              <Text
                style={
                  styles.routeLocationText
                }
                numberOfLines={
                  2
                }
              >
                {
                  getLocationLabel(
                    trip.pickup
                  )
                }
              </Text>

            </View>


            <View
              style={
                styles.routeDivider
              }
            />


            <View
              style={
                styles.routeLocationBlock
              }
            >

              <Text
                style={
                  styles.routeCaption
                }
              >
                DESTINATION
              </Text>

              <Text
                style={
                  styles.routeLocationText
                }
                numberOfLines={
                  2
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
            QUICK SUMMARY
        ================================================= */}

        <View
          style={
            styles.summaryRow
          }
        >

          <View
            style={
              styles.summaryBox
            }
          >

            <Ionicons
              name="cash-outline"
              size={20}
              color={PURPLE}
            />

            <Text
              style={
                styles.summaryValue
              }
            >
              {
                formatMoney(
                  trip.fare
                )
              }
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Fare
            </Text>

          </View>


          <View
            style={
              styles.summaryBox
            }
          >

            <Ionicons
              name="navigate-outline"
              size={20}
              color={PURPLE}
            />

            <Text
              style={
                styles.summaryValue
              }
            >
              {
                trip.distanceKm !=
                null
                  ? `${Number(
                      trip.distanceKm
                    ).toFixed(1)} km`
                  : '--'
              }
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Distance
            </Text>

          </View>


          <View
            style={
              styles.summaryBox
            }
          >

            <Ionicons
              name="time-outline"
              size={20}
              color={PURPLE}
            />

            <Text
              style={
                styles.summaryValue
              }
            >
              {
                trip.estimatedMinutes !=
                null
                  ? `${Math.round(
                      Number(
                        trip.estimatedMinutes
                      )
                    )} min`
                  : '--'
              }
            </Text>

            <Text
              style={
                styles.summaryLabel
              }
            >
              Estimate
            </Text>

          </View>

        </View>


        {/* =================================================
            DRIVER / VEHICLE
        ================================================= */}

        <View
          style={
            styles.card
          }
        >

          <View
            style={
              styles.cardHeading
            }
          >

            <Text
              style={
                styles.cardTitle
              }
            >
              Driver & vehicle
            </Text>

            {
              driverCoordinate &&
              (
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
                    LOCATION
                  </Text>

                </View>
              )
            }

          </View>


          {
            hasDriver
              ? (

                <>
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
                            .charAt(
                              0
                            )
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


                    <View
                      style={
                        styles.vehicleIcon
                      }
                    >

                      <Ionicons
                        name={
                          getVehicleIcon(
                            trip.vehicleType
                          )
                        }
                        size={25}
                        color={PURPLE}
                      />

                    </View>

                  </View>


                  <View
                    style={
                      styles.vehicleDetails
                    }
                  >

                    <DetailRow
                      icon={
                        getVehicleIcon(
                          trip.vehicleType
                        )
                      }
                      label="Vehicle"
                      value={
                        [
                          trip.vehicleColor,
                          trip.vehicleModel,
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            ' '
                          ) ||
                        formatValue(
                          trip.vehicleType
                        )
                      }
                    />


                    <DetailRow
                      icon="card-outline"
                      label="Plate number"
                      value={
                        trip.plateNumber ||
                        'Not available'
                      }
                      last
                    />

                  </View>

                </>

              )
              : (

                <View
                  style={
                    styles.noDriver
                  }
                >

                  <View
                    style={
                      styles.searchingIcon
                    }
                  >

                    {
                      status ===
                      'SEARCHING_DRIVER'
                        ? (
                          <ActivityIndicator
                            color={
                              PURPLE
                            }
                          />
                        )
                        : (
                          <Ionicons
                            name="person-outline"
                            size={23}
                            color={PURPLE}
                          />
                        )
                    }

                  </View>


                  <View
                    style={
                      styles.noDriverCopy
                    }
                  >

                    <Text
                      style={
                        styles.noDriverTitle
                      }
                    >
                      {
                        status ===
                        'SEARCHING_DRIVER'
                          ? 'Finding your driver'
                          : 'Driver not assigned'
                      }
                    </Text>

                    <Text
                      style={
                        styles.noDriverText
                      }
                    >
                      {
                        status ===
                        'SEARCHING_DRIVER'
                          ? 'Nearby approved drivers are receiving your ride request.'
                          : 'Driver information will appear here when a driver is assigned.'
                      }
                    </Text>

                  </View>

                </View>

              )
          }

        </View>


        {/* =================================================
            RIDE & PAYMENT
        ================================================= */}

        <View
          style={
            styles.card
          }
        >

          <Text
            style={
              styles.cardTitle
            }
          >
            Ride & payment
          </Text>


          <View
            style={
              styles.detailsList
            }
          >

            <DetailRow
              icon={
                getVehicleIcon(
                  trip.vehicleType
                )
              }
              label="Ride"
              value={
                formatValue(
                  trip.vehicleType
                )
              }
            />


            {
              trip.kekeRideType &&
              (
                <DetailRow
                  icon="people-outline"
                  label="Keke option"
                  value={
                    formatValue(
                      trip.kekeRideType
                    )
                  }
                />
              )
            }


            {
              trip.seatsRequested !=
              null &&
              (
                <DetailRow
                  icon="person-outline"
                  label="Seats requested"
                  value={
                    String(
                      trip.seatsRequested
                    )
                  }
                />
              )
            }


            <DetailRow
              icon={
                trip.paymentMethod ===
                'wallet'
                  ? 'wallet-outline'
                  : 'cash-outline'
              }
              label="Payment method"
              value={
                formatValue(
                  trip.paymentMethod
                )
              }
            />


            {
              trip.paymentStatus &&
              (
                <DetailRow
                  icon="checkmark-circle-outline"
                  label="Payment status"
                  value={
                    formatValue(
                      trip.paymentStatus
                    )
                  }
                />
              )
            }


            {
              trip.farePerPassenger !=
              null &&
              (
                <DetailRow
                  icon="person-outline"
                  label="Fare per passenger"
                  value={
                    formatMoney(
                      trip.farePerPassenger
                    )
                  }
                />
              )
            }


            <DetailRow
              icon="receipt-outline"
              label="Total fare"
              value={
                formatMoney(
                  trip.fare
                )
              }
              last
            />

          </View>

        </View>


        {/* =================================================
            RIDER CANCELLATION
        ================================================= */}

        {
          canCancel &&
          (
            <View
              style={
                styles.cancelCard
              }
            >

              <View
                style={
                  styles.cancelInfo
                }
              >

                <View
                  style={
                    styles.cancelIcon
                  }
                >

                  <Ionicons
                    name="close-circle-outline"
                    size={22}
                    color={RED}
                  />

                </View>


                <View
                  style={
                    styles.cancelCopy
                  }
                >

                  <Text
                    style={
                      styles.cancelTitle
                    }
                  >
                    Need to cancel?
                  </Text>

                  <Text
                    style={
                      styles.cancelText
                    }
                  >
                    You can cancel before the ride begins.
                  </Text>

                </View>

              </View>


              <Pressable
                onPress={
                  confirmCancelTrip
                }
                disabled={
                  cancelling
                }
                style={[
                  styles.cancelButton,
                  cancelling &&
                  styles.cancelButtonDisabled,
                ]}
              >

                {
                  cancelling
                    ? (
                      <ActivityIndicator
                        size="small"
                        color={RED}
                      />
                    )
                    : (
                      <>
                        <Ionicons
                          name="close-circle-outline"
                          size={18}
                          color={RED}
                        />

                        <Text
                          style={
                            styles.cancelButtonText
                          }
                        >
                          Cancel ride
                        </Text>
                      </>
                    )
                }

              </Pressable>

            </View>
          )
        }



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
              styles.cardTitle
            }
          >
            Trip record
          </Text>


          <View
            style={
              styles.detailsList
            }
          >

            {
              trip.createdAt &&
              (
                <DetailRow
                  icon="calendar-outline"
                  label="Requested"
                  value={
                    new Date(
                      trip.createdAt
                    ).toLocaleString(
                      'en-NG'
                    )
                  }
                />
              )
            }


            {
              trip.routingSource &&
              (
                <DetailRow
                  icon="map-outline"
                  label="Routing"
                  value={
                    formatValue(
                      trip.routingSource
                    )
                  }
                />
              )
            }


            {
              trip.pricingBasis &&
              (
                <DetailRow
                  icon="pricetag-outline"
                  label="Pricing basis"
                  value={
                    formatValue(
                      trip.pricingBasis
                    )
                  }
                />
              )
            }


            {
              trip.pricingVersion &&
              (
                <DetailRow
                  icon="information-circle-outline"
                  label="Pricing version"
                  value={
                    String(
                      trip.pricingVersion
                    )
                  }
                  last
                />
              )
            }

          </View>

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

          {
            refreshing
              ? (
                <ActivityIndicator
                  color={
                    WHITE
                  }
                />
              )
              : (
                <>
                  <Ionicons
                    name="refresh"
                    size={18}
                    color={WHITE}
                  />

                  <Text
                    style={
                      styles.refreshButtonText
                    }
                  >
                    Refresh trip
                  </Text>
                </>
              )
          }

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
        BACKGROUND,
    },


    scroll: {
      flex: 1,
    },


    content: {
      paddingBottom: 30,
    },


    /*
    -------------------------------------------------------
    MAP
    -------------------------------------------------------
    */

    mapHero: {
      height: 390,
      backgroundColor:
        '#E7E7EB',
      marginBottom: 14,
      overflow: 'hidden',
    },


    mapTopBar: {
      position: 'absolute',
      top:
        Platform.OS ===
        'android'
          ? 14
          : 10,
      left: 14,
      right: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },


    mapBackButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        WHITE,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor:
        '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: {
        width: 0,
        height: 3,
      },
    },


    tripIdentity: {
      flex: 1,
      minHeight: 48,
      marginHorizontal: 9,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor:
        WHITE,
      elevation: 5,
      shadowColor:
        '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: {
        width: 0,
        height: 3,
      },
    },


    tripIdentityTitle: {
      color:
        TEXT,
      fontSize: 13,
      fontWeight: '900',
    },


    tripIdentityId: {
      color:
        MUTED,
      fontSize: 9,
      marginTop: 2,
    },


    mapActionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        WHITE,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor:
        '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: {
        width: 0,
        height: 3,
      },
    },


    recenterButton: {
      position: 'absolute',
      right: 15,
      bottom: 91,
      width: 45,
      height: 45,
      borderRadius: 23,
      backgroundColor:
        WHITE,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor:
        '#000000',
      shadowOpacity: 0.14,
      shadowRadius: 7,
      shadowOffset: {
        width: 0,
        height: 3,
      },
    },


    mapStatusCard: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 14,
      minHeight: 67,
      padding: 11,
      borderRadius: 18,
      backgroundColor:
        WHITE,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 7,
      shadowColor:
        '#000000',
      shadowOpacity: 0.14,
      shadowRadius: 10,
      shadowOffset: {
        width: 0,
        height: 4,
      },
    },


    statusIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },


    statusCopy: {
      flex: 1,
      marginLeft: 11,
    },


    statusTitle: {
      color:
        TEXT,
      fontSize: 14,
      fontWeight: '900',
    },


    statusMessage: {
      color:
        MUTED,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },


    pickupMarker: {
      width: 29,
      height: 29,
      borderRadius: 15,
      backgroundColor:
        WHITE,
      borderWidth: 3,
      borderColor:
        PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },


    pickupMarkerInner: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        PURPLE,
    },


    destinationMarker: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor:
        RED,
      borderWidth: 3,
      borderColor:
        WHITE,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },


    driverMarker: {
      width: 45,
      height: 45,
      borderRadius: 23,
      backgroundColor:
        WHITE,
      borderWidth: 3,
      borderColor:
        PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
    },


    /*
    -------------------------------------------------------
    ROUTE
    -------------------------------------------------------
    */

    routeCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 15,
      borderRadius: 19,
      backgroundColor:
        WHITE,
      borderWidth: 1,
      borderColor:
        BORDER,
      flexDirection: 'row',
    },


    routeRail: {
      width: 24,
      alignItems: 'center',
      paddingVertical: 10,
    },


    routePickupDot: {
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 3,
      borderColor:
        PURPLE,
      backgroundColor:
        WHITE,
    },


    routeLine: {
      width: 2,
      flex: 1,
      minHeight: 44,
      marginVertical: 4,
      backgroundColor:
        '#CEC9DA',
    },


    routeDestinationDot: {
      width: 11,
      height: 11,
      borderRadius: 2,
      backgroundColor:
        RED,
    },


    routeLocations: {
      flex: 1,
      paddingLeft: 9,
    },


    routeLocationBlock: {
      minHeight: 52,
      justifyContent: 'center',
    },


    routeCaption: {
      color:
        MUTED,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.6,
    },


    routeLocationText: {
      color:
        TEXT,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
      marginTop: 4,
    },


    routeDivider: {
      height: 1,
      backgroundColor:
        '#EFEFF2',
    },


    /*
    -------------------------------------------------------
    SUMMARY
    -------------------------------------------------------
    */

    summaryRow: {
      marginHorizontal: 16,
      marginBottom: 12,
      flexDirection: 'row',
      gap: 8,
    },


    summaryBox: {
      flex: 1,
      minHeight: 91,
      padding: 11,
      borderRadius: 17,
      backgroundColor:
        WHITE,
      borderWidth: 1,
      borderColor:
        BORDER,
      justifyContent: 'center',
    },


    summaryValue: {
      color:
        TEXT,
      fontSize: 13,
      fontWeight: '900',
      marginTop: 7,
    },


    summaryLabel: {
      color:
        MUTED,
      fontSize: 9,
      marginTop: 2,
    },


    /*
    -------------------------------------------------------
    CARDS
    -------------------------------------------------------
    */

    card: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 16,
      borderRadius: 19,
      backgroundColor:
        WHITE,
      borderWidth: 1,
      borderColor:
        BORDER,
    },


    cardHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },


    cardTitle: {
      color:
        TEXT,
      fontSize: 15,
      fontWeight: '900',
      marginBottom: 13,
    },


    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 9,
      backgroundColor:
        '#EAF8F1',
    },


    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        GREEN,
      marginRight: 5,
    },


    liveText: {
      color:
        GREEN,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.4,
    },


    driverRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    driverAvatar: {
      width: 52,
      height: 52,
      borderRadius: 17,
      backgroundColor:
        SOFT_PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
    },


    driverAvatarText: {
      color:
        PURPLE,
      fontSize: 20,
      fontWeight: '900',
    },


    driverInfo: {
      flex: 1,
      marginLeft: 12,
    },


    driverName: {
      color:
        TEXT,
      fontSize: 15,
      fontWeight: '900',
    },


    driverPhone: {
      color:
        MUTED,
      fontSize: 11,
      marginTop: 4,
    },


    vehicleIcon: {
      width: 45,
      height: 45,
      borderRadius: 14,
      backgroundColor:
        SOFT_PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
    },


    vehicleDetails: {
      marginTop: 14,
      borderTopWidth: 1,
      borderTopColor:
        '#EFEFF2',
    },


    noDriver: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    searchingIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor:
        SOFT_PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
    },


    noDriverCopy: {
      flex: 1,
      marginLeft: 12,
    },


    noDriverTitle: {
      color:
        TEXT,
      fontSize: 13,
      fontWeight: '900',
    },


    noDriverText: {
      color:
        MUTED,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 4,
    },


    detailsList: {
      marginTop: -3,
    },


    detailRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#EFEFF2',
    },


    detailRowLast: {
      borderBottomWidth: 0,
    },


    detailIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor:
        SOFT_PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
    },


    detailCopy: {
      flex: 1,
      marginLeft: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },


    detailLabel: {
      color:
        MUTED,
      fontSize: 10,
      fontWeight: '600',
      flex: 1,
      paddingRight: 10,
    },


    detailValue: {
      color:
        TEXT,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'right',
      maxWidth: '58%',
    },


    /*
    -------------------------------------------------------
    BUTTON / FOOTER
    -------------------------------------------------------
    */

    cancelCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 15,
      borderRadius: 19,
      backgroundColor: '#FFF7F7',
      borderWidth: 1,
      borderColor: '#F2CECE',
    },


    cancelInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    cancelIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: '#FFEAEA',
      alignItems: 'center',
      justifyContent: 'center',
    },


    cancelCopy: {
      flex: 1,
      marginLeft: 11,
    },


    cancelTitle: {
      color: TEXT,
      fontSize: 13,
      fontWeight: '900',
    },


    cancelText: {
      color: MUTED,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },


    cancelButton: {
      minHeight: 48,
      marginTop: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#E8AFAF',
      backgroundColor: WHITE,
      flexDirection: 'row',
      gap: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },


    cancelButtonDisabled: {
      opacity: 0.55,
    },


    cancelButtonText: {
      color: RED,
      fontSize: 12,
      fontWeight: '900',
    },


    refreshButton: {
      minHeight: 52,
      marginHorizontal: 16,
      marginTop: 2,
      borderRadius: 15,
      backgroundColor:
        PURPLE,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },


    refreshButtonText: {
      color:
        WHITE,
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


    /*
    -------------------------------------------------------
    LOADING / ERROR
    -------------------------------------------------------
    */

    loading: {
      flex: 1,
      backgroundColor:
        BACKGROUND,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },


    loadingLogo: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor:
        PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },


    loadingText: {
      color:
        MUTED,
      fontSize: 11,
      marginTop: 11,
    },


    errorIcon: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor:
        '#FFF0F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 13,
    },


    errorTitle: {
      color:
        TEXT,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },


    errorText: {
      color:
        MUTED,
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
        PURPLE,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },


    retryText: {
      color:
        WHITE,
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
        PURPLE,
      fontSize: 11,
      fontWeight: '900',
    },

  });

