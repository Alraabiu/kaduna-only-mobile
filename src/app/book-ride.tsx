import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import * as Location from 'expo-location';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from 'react-native-maps';

import api, { setAuthToken } from '../services/api';
import { getStoredToken } from '../storage/auth';

const PURPLE = '#4B24A8';
const DARK_PURPLE = '#321276';
const GOLD = '#F5B800';
const WHITE = '#FFFFFF';
const TEXT = '#202124';
const MUTED = '#777A82';
const BORDER = '#E7E5EC';
const BG = '#F7F7FA';
const SOFT_PURPLE = '#F2EEFF';
const RED = '#D94B4B';
const GREEN = '#159A63';

type VehicleType = 'keke' | 'car' | 'motorcycle';
type KekeRideType = 'single_seat' | 'private';
type PaymentMethod = 'cash' | 'wallet';
type SearchField = 'pickup' | 'destination';

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

type MapPoint = {
  latitude: number;
  longitude: number;
};

const RIDES: Array<{
  type: VehicleType;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { type: 'keke', title: 'Keke', subtitle: 'Everyday value', icon: 'bus-outline' },
  { type: 'car', title: 'Car', subtitle: 'Private comfort', icon: 'car-sport-outline' },
  { type: 'motorcycle', title: 'Bike', subtitle: 'Quick city ride', icon: 'bicycle-outline' },
];

function money(value?: number) {
  return `₦${Number(value || 0).toLocaleString('en-NG')}`;
}

function duration(value?: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return n < 60 ? `${Math.round(n)} min` : `${Math.floor(n / 60)} hr ${Math.round(n % 60)} min`;
}

function distance(value?: number) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} km` : '--';
}

function routeCoordinates(geometry: any): MapPoint[] {
  if (!geometry) return [];

  let raw: any = geometry;
  if (raw.geometry) raw = raw.geometry;
  if (raw.coordinates) raw = raw.coordinates;

  const points: MapPoint[] = [];

  const walk = (value: any) => {
    if (!Array.isArray(value)) return;

    if (
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number'
    ) {
      // Backend route geometry is GeoJSON: [longitude, latitude].
      points.push({
        latitude: Number(value[1]),
        longitude: Number(value[0]),
      });
      return;
    }

    value.forEach(walk);
  };

  walk(raw);

  return points.filter(
    (p) =>
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude) &&
      Math.abs(p.latitude) <= 90 &&
      Math.abs(p.longitude) <= 180
  );
}

export default function BookRide() {
  const mapRef = useRef<MapView | null>(null);
  const pickupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showMap, setShowMap] = useState(false);

  const [pickupText, setPickupText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [pickup, setPickup] = useState<LocationResult | null>(null);
  const [destination, setDestination] = useState<LocationResult | null>(null);

  const [pickupResults, setPickupResults] = useState<LocationResult[]>([]);
  const [destinationResults, setDestinationResults] = useState<LocationResult[]>([]);
  const [searchingPickup, setSearchingPickup] = useState(false);
  const [searchingDestination, setSearchingDestination] = useState(false);
  const [activeField, setActiveField] = useState<SearchField | null>('destination');

  const [vehicleType, setVehicleType] = useState<VehicleType>('keke');
  const [kekeRideType, setKekeRideType] = useState<KekeRideType>('single_seat');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [booking, setBooking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const routePoints = useMemo(
    () => routeCoordinates(quote?.routeGeometry),
    [quote?.routeGeometry]
  );

  async function prepareAuthentication() {
    const token = await getStoredToken();

    if (!token) {
      setAuthToken();
      Alert.alert('Session expired', 'Please log in again.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
      return false;
    }

    setAuthToken(token);
    return true;
  }

  async function searchLocation(query: string, field: SearchField) {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 3) {
      if (field === 'pickup') setPickupResults([]);
      else setDestinationResults([]);
      return;
    }

    if (!(await prepareAuthentication())) return;

    if (field === 'pickup') setSearchingPickup(true);
    else setSearchingDestination(true);

    try {
      console.log(`[MOBILE MAP SEARCH] Searching ${field}:`, cleanQuery);

      const response = await api.get('/maps/search', {
        params: { q: cleanQuery },
      });

      const results: LocationResult[] =
        response?.data?.data?.results ||
        response?.data?.results ||
        [];

      if (field === 'pickup') setPickupResults(results);
      else setDestinationResults(results);
    } catch (error: any) {
      console.log('[MOBILE MAP SEARCH ERROR]', error);

      if (error?.response?.status === 401) {
        setAuthToken();
        router.replace('/login');
        return;
      }

      if (error?.response?.status !== 400) {
        Alert.alert(
          'Location search',
          'Unable to search this location right now. Please try again.'
        );
      }
    } finally {
      if (field === 'pickup') setSearchingPickup(false);
      else setSearchingDestination(false);
    }
  }

  function handlePickupChange(value: string) {
    setPickupText(value);
    setPickup(null);
    setQuote(null);
    setShowMap(false);
    setActiveField('pickup');

    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    pickupTimer.current = setTimeout(() => searchLocation(value, 'pickup'), 650);
  }

  function handleDestinationChange(value: string) {
    setDestinationText(value);
    setDestination(null);
    setQuote(null);
    setShowMap(false);
    setActiveField('destination');

    if (destinationTimer.current) clearTimeout(destinationTimer.current);
    destinationTimer.current = setTimeout(
      () => searchLocation(value, 'destination'),
      650
    );
  }

  function selectPickup(item: LocationResult) {
    console.log('[MOBILE MAP] Pickup selected:', item);
    setPickup(item);
    setPickupText(item.shortLabel || item.label);
    setPickupResults([]);
    setQuote(null);

    if (destination) {
      setActiveField(null);
      setShowMap(true);
    } else {
      setActiveField('destination');
    }
  }

  function selectDestination(item: LocationResult) {
    console.log('[MOBILE MAP] Destination selected:', item);
    setDestination(item);
    setDestinationText(item.shortLabel || item.label);
    setDestinationResults([]);
    setQuote(null);

    if (pickup) {
      setActiveField(null);
      setShowMap(true);
    } else {
      setActiveField('pickup');
    }
  }

  async function useCurrentPickup() {
    setLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Allow location access to use your current position as pickup.'
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = current.coords.latitude;
      const lng = current.coords.longitude;

      let label = 'Current location';
      let shortLabel = 'Current location';

      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        const place = places?.[0];

        if (place) {
          shortLabel =
            place.name ||
            place.street ||
            place.district ||
            place.city ||
            'Current location';

          label = [
            place.name || place.street,
            place.district,
            place.city,
            place.region,
          ]
            .filter(Boolean)
            .join(', ');
        }
      } catch {}

      selectPickup({
        placeId: `current-${lat}-${lng}`,
        label: label || 'Current location',
        shortLabel,
        lat,
        lng,
        type: 'current_location',
      });
    } catch (error) {
      console.log('[MOBILE CURRENT LOCATION ERROR]', error);
      Alert.alert(
        'Current location',
        'Unable to get your current location. Search for your pickup instead.'
      );
    } finally {
      setLocating(false);
    }
  }

  async function requestQuote(
    nextVehicle: VehicleType = vehicleType,
    nextKeke: KekeRideType = kekeRideType
  ): Promise<Quote | null> {
    if (!pickup || !destination) return null;
    if (!(await prepareAuthentication())) return null;

    setLoadingQuote(true);

    try {
      console.log('[MOBILE BOOK RIDE] Requesting quote');

      const response = await api.post('/trips/quote', {
        vehicleType: nextVehicle,
        kekeRideType: nextVehicle === 'keke' ? nextKeke : 'single_seat',
        pickup: {
          label: pickup.label,
          lat: pickup.lat,
          lng: pickup.lng,
        },
        destination: {
          label: destination.label,
          lat: destination.lat,
          lng: destination.lng,
        },
      });

      console.log('[MOBILE BOOK RIDE] Quote response', response.data);

      const receivedQuote: Quote | null =
        response?.data?.data?.quote ||
        response?.data?.quote ||
        null;

      if (!receivedQuote) throw new Error('No quote returned by server');

      setQuote(receivedQuote);
      return receivedQuote;
    } catch (error: any) {
      console.log('[MOBILE BOOK RIDE QUOTE ERROR]', error);

      if (error?.response?.status === 401) {
        setAuthToken();
        router.replace('/login');
        return null;
      }

      Alert.alert(
        'Unable to get fare',
        error?.response?.data?.message ||
          'We could not calculate the fare for this route.'
      );

      return null;
    } finally {
      setLoadingQuote(false);
    }
  }

  useEffect(() => {
    if (!showMap || !pickup || !destination) return;
    requestQuote();
    // Quote is intentionally refreshed whenever the selected ride changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, vehicleType, kekeRideType]);

  useEffect(() => {
    if (!mapReady || !pickup || !destination) return;

    const coords =
      routePoints.length > 1
        ? routePoints
        : [
            { latitude: pickup.lat, longitude: pickup.lng },
            { latitude: destination.lat, longitude: destination.lng },
          ];

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 125, right: 55, bottom: 390, left: 55 },
        animated: true,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [mapReady, pickup, destination, routePoints]);

  useEffect(() => {
    return () => {
      if (pickupTimer.current) clearTimeout(pickupTimer.current);
      if (destinationTimer.current) clearTimeout(destinationTimer.current);
    };
  }, []);

  function chooseVehicle(type: VehicleType) {
    if (type === vehicleType) return;
    setVehicleType(type);
    setQuote(null);
  }

  function chooseKeke(type: KekeRideType) {
    if (type === kekeRideType) return;
    setKekeRideType(type);
    setQuote(null);
  }

  async function createTrip() {
    if (!pickup || !destination) {
      Alert.alert(
        'Locations required',
        'Please select both pickup and destination.'
      );
      return;
    }

    let currentQuote = quote;

    if (!currentQuote) {
      currentQuote = await requestQuote();
      if (!currentQuote) return;
    }

    if (!(await prepareAuthentication())) return;

    setBooking(true);

    try {
      console.log('[MOBILE BOOK RIDE] Creating trip');

      const response = await api.post('/trips', {
        vehicleType,
        kekeRideType:
          vehicleType === 'keke' ? kekeRideType : 'single_seat',
        pickup: {
          label: pickup.label,
          lat: pickup.lat,
          lng: pickup.lng,
        },
        destination: {
          label: destination.label,
          lat: destination.lat,
          lng: destination.lng,
        },
        paymentMethod,
      });

      console.log('[MOBILE BOOK RIDE] Trip created', response.data);

      const trip =
        response?.data?.data?.trip ||
        response?.data?.trip;

      if (trip?._id) {
        router.replace(`/trip/${trip._id}` as any);
      } else {
        router.replace('/rider');
      }
    } catch (error: any) {
      console.log('[MOBILE BOOK RIDE ERROR]', error);

      const status = error?.response?.status;
      const message = error?.response?.data?.message;

      if (status === 401) {
        setAuthToken();
        router.replace('/login');
        return;
      }

      if (status === 402) {
        Alert.alert(
          'Insufficient wallet balance',
          message || 'Your wallet balance is not enough to pay for this ride.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Fund Wallet', onPress: () => router.push('/wallet') },
          ]
        );
        return;
      }

      if (status === 409) {
        Alert.alert(
          'Active ride exists',
          message || 'You already have an active trip.'
        );
        return;
      }

      Alert.alert(
        status === 400 ? 'Unable to book ride' : 'Booking failed',
        message || 'We could not create the ride. Please try again.'
      );
    } finally {
      setBooking(false);
    }
  }

  const results =
    activeField === 'pickup' ? pickupResults : destinationResults;

  const searching =
    activeField === 'pickup' ? searchingPickup : searchingDestination;

  const activeText =
    activeField === 'pickup' ? pickupText : destinationText;

  const selectedRide =
    RIDES.find((item) => item.type === vehicleType) || RIDES[0];

  if (!showMap || !pickup || !destination) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.searchHeader}>
          <Pressable style={styles.roundButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={TEXT} />
          </Pressable>
          <Text style={styles.headerLabel}>Plan your ride</Text>
          <View style={styles.headerGap} />
        </View>

        <View style={styles.titleArea}>
          <Text style={styles.bigTitle}>Where to?</Text>
          <Text style={styles.subtitle}>
            Choose your pickup and destination.
          </Text>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchRail}>
            <View style={styles.pickupDot} />
            <View style={styles.railLine} />
            <View style={styles.dropDot} />
          </View>

          <View style={styles.inputColumn}>
            <View
              style={[
                styles.inputBox,
                activeField === 'pickup' && styles.inputBoxActive,
              ]}
            >
              <TextInput
                style={styles.input}
                value={pickupText}
                onChangeText={handlePickupChange}
                onFocus={() => setActiveField('pickup')}
                placeholder="Pickup location"
                placeholderTextColor="#9A9CA2"
              />
              {searchingPickup && (
                <ActivityIndicator size="small" color={PURPLE} />
              )}
            </View>

            <View style={styles.inputDivider} />

            <View
              style={[
                styles.inputBox,
                activeField === 'destination' && styles.inputBoxActive,
              ]}
            >
              <TextInput
                style={styles.input}
                value={destinationText}
                onChangeText={handleDestinationChange}
                onFocus={() => setActiveField('destination')}
                placeholder="Where are you going?"
                placeholderTextColor="#9A9CA2"
              />
              {searchingDestination && (
                <ActivityIndicator size="small" color={PURPLE} />
              )}
            </View>
          </View>
        </View>

        {activeField === 'pickup' && (
          <Pressable
            style={styles.currentLocation}
            onPress={useCurrentPickup}
            disabled={locating}
          >
            <View style={styles.locationIcon}>
              {locating ? (
                <ActivityIndicator size="small" color={PURPLE} />
              ) : (
                <Ionicons name="locate" size={20} color={PURPLE} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.currentTitle}>Use my current location</Text>
              <Text style={styles.currentSub}>Set this as your pickup</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </Pressable>
        )}

        <ScrollView
          style={styles.results}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {activeField &&
            searching &&
            activeText.trim().length >= 3 && (
              <View style={styles.empty}>
                <ActivityIndicator color={PURPLE} />
                <Text style={styles.emptyText}>Finding places…</Text>
              </View>
            )}

          {activeField &&
            !searching &&
            activeText.trim().length >= 3 &&
            results.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={26} color={MUTED} />
                <Text style={styles.emptyTitle}>No places found</Text>
                <Text style={styles.emptyText}>
                  Try a street, landmark or neighbourhood.
                </Text>
              </View>
            )}

          {results.slice(0, 8).map((item, index) => (
            <Pressable
              key={`${item.placeId}-${index}`}
              style={styles.resultRow}
              onPress={() =>
                activeField === 'pickup'
                  ? selectPickup(item)
                  : selectDestination(item)
              }
            >
              <View style={styles.resultIcon}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={PURPLE}
                />
              </View>

              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {item.shortLabel || item.label}
                </Text>
                <Text style={styles.resultSub} numberOfLines={2}>
                  {item.label}
                </Text>
              </View>

              <Ionicons name="arrow-forward" size={17} color={MUTED} />
            </Pressable>
          ))}

          {pickup && destination && (
            <Pressable
              style={styles.viewRides}
              onPress={() => {
                setActiveField(null);
                setShowMap(true);
              }}
            >
              <Text style={styles.viewRidesText}>View ride options</Text>
              <Ionicons name="arrow-forward" size={20} color={WHITE} />
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.mapScreen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={
          Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
        }
        initialRegion={{
          latitude: pickup.lat,
          longitude: pickup.lng,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        onMapReady={() => setMapReady(true)}
        showsCompass
        showsUserLocation
        toolbarEnabled={false}
        loadingEnabled
        loadingIndicatorColor={PURPLE}
        loadingBackgroundColor={WHITE}
      >
        <Marker
          coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
          title="Pickup"
          description={pickup.label}
        >
          <View style={styles.pickupMarker}>
            <View style={styles.pickupMarkerInner} />
          </View>
        </Marker>

        <Marker
          coordinate={{
            latitude: destination.lat,
            longitude: destination.lng,
          }}
          title="Destination"
          description={destination.label}
        >
          <View style={styles.destinationMarker}>
            <Ionicons name="flag" size={15} color={WHITE} />
          </View>
        </Marker>

        {routePoints.length > 1 && (
          <Polyline
            coordinates={routePoints}
            strokeColor={PURPLE}
            strokeWidth={5}
          />
        )}
      </MapView>

      <View style={styles.mapHeader}>
        <Pressable
          style={styles.mapBack}
          onPress={() => {
            setShowMap(false);
            setActiveField('destination');
          }}
        >
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </Pressable>

        <Pressable
          style={styles.routeCard}
          onPress={() => {
            setShowMap(false);
            setActiveField('destination');
          }}
        >
          <View style={styles.miniRail}>
            <View style={styles.miniPickup} />
            <View style={styles.miniLine} />
            <View style={styles.miniDrop} />
          </View>

          <View style={styles.routeCopy}>
            <Text style={styles.routeText} numberOfLines={1}>
              {pickupText}
            </Text>
            <Text style={styles.routeText} numberOfLines={1}>
              {destinationText}
            </Text>
          </View>

          <Ionicons name="create-outline" size={19} color={PURPLE} />
        </Pressable>
      </View>

      <Pressable
        style={styles.recenter}
        onPress={() => {
          const coords =
            routePoints.length > 1
              ? routePoints
              : [
                  { latitude: pickup.lat, longitude: pickup.lng },
                  {
                    latitude: destination.lat,
                    longitude: destination.lng,
                  },
                ];

          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 125, right: 55, bottom: 390, left: 55 },
            animated: true,
          });
        }}
      >
        <Ionicons name="locate" size={22} color={PURPLE} />
      </Pressable>

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.sheetHead}>
          <View>
            <Text style={styles.sheetTitle}>Choose a ride</Text>
            <Text style={styles.sheetSub}>
              {quote
                ? `${distance(quote.distanceKm)} • ${duration(
                    quote.estimatedMinutes
                  )}`
                : 'Calculating route and fare…'}
            </Text>
          </View>
          {loadingQuote && <ActivityIndicator color={PURPLE} />}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rideRow}
        >
          {RIDES.map((ride) => {
            const active = ride.type === vehicleType;

            return (
              <Pressable
                key={ride.type}
                style={[styles.ride, active && styles.rideActive]}
                onPress={() => chooseVehicle(ride.type)}
              >
                <View
                  style={[
                    styles.rideIcon,
                    active && styles.rideIconActive,
                  ]}
                >
                  <Ionicons
                    name={ride.icon}
                    size={25}
                    color={active ? WHITE : PURPLE}
                  />
                </View>

                <Text style={styles.rideTitle}>{ride.title}</Text>
                <Text style={styles.rideSub} numberOfLines={1}>
                  {ride.subtitle}
                </Text>

                <Text
                  style={[
                    styles.ridePrice,
                    !active && styles.ridePriceMuted,
                  ]}
                >
                  {active && quote ? money(quote.fare) : 'Select'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {vehicleType === 'keke' && (
          <View style={styles.kekeSwitch}>
            <Pressable
              style={[
                styles.kekeChoice,
                kekeRideType === 'single_seat' && styles.kekeChoiceActive,
              ]}
              onPress={() => chooseKeke('single_seat')}
            >
              <Text
                style={[
                  styles.kekeTitle,
                  kekeRideType === 'single_seat' && styles.kekeTextActive,
                ]}
              >
                Single Seat
              </Text>
              <Text
                style={[
                  styles.kekeSub,
                  kekeRideType === 'single_seat' && styles.kekeTextActive,
                ]}
              >
                {quote?.singleSeatFare != null
                  ? money(quote.singleSeatFare)
                  : 'Shared Keke'}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.kekeChoice,
                kekeRideType === 'private' && styles.kekeChoiceActive,
              ]}
              onPress={() => chooseKeke('private')}
            >
              <Text
                style={[
                  styles.kekeTitle,
                  kekeRideType === 'private' && styles.kekeTextActive,
                ]}
              >
                Private
              </Text>
              <Text
                style={[
                  styles.kekeSub,
                  kekeRideType === 'private' && styles.kekeTextActive,
                ]}
              >
                {quote?.privateFare != null
                  ? money(quote.privateFare)
                  : 'Whole Keke'}
              </Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={styles.paymentRow}
          onPress={() => setPaymentOpen(true)}
        >
          <View style={styles.paymentLeft}>
            <View style={styles.paymentIcon}>
              <Ionicons
                name={
                  paymentMethod === 'wallet'
                    ? 'wallet-outline'
                    : 'cash-outline'
                }
                size={20}
                color={PURPLE}
              />
            </View>
            <View>
              <Text style={styles.paymentTitle}>
                {paymentMethod === 'wallet' ? 'Wallet' : 'Cash'}
              </Text>
              <Text style={styles.paymentSub}>
                Tap to change payment method
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={19} color={MUTED} />
        </Pressable>

        <Pressable
          style={[
            styles.continueButton,
            (!quote || loadingQuote || booking) && styles.disabled,
          ]}
          disabled={!quote || loadingQuote || booking}
          onPress={createTrip}
        >
          {booking ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <View>
              <Text style={styles.continueText}>Continue</Text>
              {quote && (
                <Text style={styles.continueSub}>
                  {selectedRide.title} • {money(quote.fare)}
                </Text>
              )}
            </View>
          )}
          {!booking && (
            <Ionicons name="arrow-forward" size={21} color={WHITE} />
          )}
        </Pressable>
      </View>

      <Modal
        visible={paymentOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPaymentOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Payment method</Text>
            <Text style={styles.modalSub}>
              Choose how you want to pay for this ride.
            </Text>

            {(['cash', 'wallet'] as PaymentMethod[]).map((method) => (
              <Pressable
                key={method}
                style={[
                  styles.paymentChoice,
                  paymentMethod === method && styles.paymentChoiceActive,
                ]}
                onPress={() => {
                  setPaymentMethod(method);
                  setPaymentOpen(false);
                }}
              >
                <View style={styles.paymentChoiceIcon}>
                  <Ionicons
                    name={method === 'wallet' ? 'wallet-outline' : 'cash-outline'}
                    size={22}
                    color={PURPLE}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceTitle}>
                    {method === 'wallet' ? 'Wallet' : 'Cash'}
                  </Text>
                  <Text style={styles.choiceSub}>
                    {method === 'wallet'
                      ? 'Pay from your Kaduna Only wallet'
                      : 'Pay your driver directly'}
                  </Text>
                </View>

                <Ionicons
                  name={
                    paymentMethod === method
                      ? 'checkmark-circle'
                      : 'ellipse-outline'
                  }
                  size={23}
                  color={paymentMethod === method ? GREEN : MUTED}
                />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WHITE },
  searchHeader: {
    height: 72,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F2F1F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: { fontSize: 16, fontWeight: '800', color: TEXT },
  headerGap: { width: 42 },
  titleArea: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  bigTitle: { fontSize: 32, fontWeight: '900', color: TEXT, letterSpacing: -0.8 },
  subtitle: { marginTop: 5, fontSize: 14, color: MUTED },
  searchCard: {
    marginHorizontal: 18,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFAFC',
    flexDirection: 'row',
  },
  searchRail: { width: 24, alignItems: 'center', paddingVertical: 19 },
  pickupDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: PURPLE,
    backgroundColor: WHITE,
  },
  railLine: { width: 2, flex: 1, minHeight: 37, marginVertical: 3, backgroundColor: '#CEC9DA' },
  dropDot: { width: 11, height: 11, borderRadius: 2, backgroundColor: RED },
  inputColumn: { flex: 1, marginLeft: 8 },
  inputBox: { minHeight: 50, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  inputBoxActive: { backgroundColor: WHITE },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: TEXT, paddingVertical: 12 },
  inputDivider: { height: 1, backgroundColor: BORDER, marginHorizontal: 10 },
  currentLocation: {
    marginHorizontal: 18,
    marginTop: 14,
    padding: 13,
    borderRadius: 15,
    backgroundColor: SOFT_PURPLE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  currentTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  currentSub: { marginTop: 2, fontSize: 11, color: MUTED },
  results: { flex: 1, marginTop: 10, paddingHorizontal: 18 },
  resultRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EFEFF2' },
  resultIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F3F1F7', alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1, marginHorizontal: 12 },
  resultTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  resultSub: { marginTop: 3, fontSize: 11, lineHeight: 16, color: MUTED },
  empty: { paddingVertical: 34, alignItems: 'center' },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: '800', color: TEXT },
  emptyText: { marginTop: 7, fontSize: 12, color: MUTED, textAlign: 'center' },
  viewRides: { height: 56, marginTop: 18, marginBottom: 28, borderRadius: 15, paddingHorizontal: 18, backgroundColor: PURPLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewRidesText: { fontSize: 15, fontWeight: '900', color: WHITE },

  mapScreen: { flex: 1, backgroundColor: BG },
  mapHeader: { position: 'absolute', top: Platform.OS === 'android' ? 18 : 12, left: 14, right: 14, flexDirection: 'row', alignItems: 'center' },
  mapBack: { width: 44, height: 44, borderRadius: 22, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 9, elevation: 4 },
  routeCard: { flex: 1, minHeight: 66, borderRadius: 16, backgroundColor: WHITE, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', elevation: 4 },
  miniRail: { width: 17, alignItems: 'center' },
  miniPickup: { width: 8, height: 8, borderRadius: 4, backgroundColor: PURPLE },
  miniLine: { width: 2, height: 14, marginVertical: 2, backgroundColor: '#C8C3D4' },
  miniDrop: { width: 8, height: 8, borderRadius: 2, backgroundColor: RED },
  routeCopy: { flex: 1, marginHorizontal: 9 },
  routeText: { fontSize: 12, lineHeight: 22, fontWeight: '700', color: TEXT },
  pickupMarker: { width: 29, height: 29, borderRadius: 15, backgroundColor: WHITE, borderWidth: 3, borderColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  pickupMarkerInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: PURPLE },
  destinationMarker: { width: 31, height: 31, borderRadius: 16, backgroundColor: RED, borderWidth: 3, borderColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  recenter: { position: 'absolute', right: 16, bottom: 365, width: 46, height: 46, borderRadius: 23, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', elevation: 5 },

  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 340, maxHeight: '58%', backgroundColor: WHITE, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 17, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 28 : 18, elevation: 15 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#D8D8DC', marginBottom: 11 },
  sheetHead: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: TEXT },
  sheetSub: { marginTop: 3, fontSize: 11, color: MUTED },
  rideRow: { paddingVertical: 10, gap: 9, paddingRight: 6 },
  ride: { width: 128, minHeight: 116, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FAFAFC', padding: 11 },
  rideActive: { borderWidth: 2, borderColor: PURPLE, backgroundColor: SOFT_PURPLE },
  rideIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  rideIconActive: { backgroundColor: PURPLE },
  rideTitle: { marginTop: 8, fontSize: 14, fontWeight: '900', color: TEXT },
  rideSub: { marginTop: 2, fontSize: 9, color: MUTED },
  ridePrice: { marginTop: 5, fontSize: 14, fontWeight: '900', color: DARK_PURPLE },
  ridePriceMuted: { fontSize: 12, color: MUTED },

  kekeSwitch: { flexDirection: 'row', backgroundColor: '#F1F1F4', borderRadius: 13, padding: 4, marginBottom: 8 },
  kekeChoice: { flex: 1, minHeight: 47, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kekeChoiceActive: { backgroundColor: PURPLE },
  kekeTitle: { fontSize: 12, fontWeight: '800', color: TEXT },
  kekeSub: { marginTop: 2, fontSize: 9, fontWeight: '600', color: MUTED },
  kekeTextActive: { color: WHITE },

  paymentRow: { minHeight: 57, borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paymentLeft: { flexDirection: 'row', alignItems: 'center' },
  paymentIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: SOFT_PURPLE, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  paymentTitle: { fontSize: 13, fontWeight: '900', color: TEXT },
  paymentSub: { marginTop: 2, fontSize: 9, color: MUTED },
  continueButton: { minHeight: 58, borderRadius: 15, backgroundColor: PURPLE, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disabled: { opacity: 0.5 },
  continueText: { fontSize: 16, fontWeight: '900', color: WHITE },
  continueSub: { marginTop: 2, fontSize: 9, fontWeight: '600', color: '#E9E1FF' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: WHITE, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22 },
  modalTitle: { fontSize: 21, fontWeight: '900', color: TEXT },
  modalSub: { marginTop: 4, marginBottom: 12, fontSize: 12, color: MUTED },
  paymentChoice: { minHeight: 72, borderWidth: 1, borderColor: BORDER, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  paymentChoiceActive: { borderColor: PURPLE, backgroundColor: SOFT_PURPLE },
  paymentChoiceIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  choiceTitle: { fontSize: 14, fontWeight: '900', color: TEXT },
  choiceSub: { marginTop: 3, fontSize: 10, color: MUTED },
});
