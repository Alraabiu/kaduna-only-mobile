import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import api, {
  setAuthToken,
} from '../../services/api';

import {
  connectSocket,
  emitSocket,
  onSocket,
} from '../../services/socket';

import {
  getStoredToken,
} from '../../storage/auth';

import {
  BrandColors,
} from '../../constants/theme';

import MapView, {
  Marker,
} from 'react-native-maps';

import * as Location from 'expo-location';

import {
  playRideRequestSound,
} from '../../utils/tripSounds';



/*
=========================================================
TYPES
=========================================================
*/

type User = {
  _id?: string;
  id?: string;
  fullName?: string;
  phone?: string;
};


type Location = {
  address?: string;
  latitude?: number;
  longitude?: number;
};


type Trip = {
  _id?: string;
  tripId?: string;

  status?: string;

  fare?: number;
  privateFare?: number;
  currency?: string;

  vehicleType?: string;

  pickup?: Location;

  destination?: Location;

  rider?: User;

  driver?: User;

  /*
   * Destination confirmation fields.
   *
   * The backend sets these when the rider
   * confirms that the destination has been reached.
   */

  riderArrivalConfirmed?: boolean;

  arrivalStatus?: string;

  completionRequestedAt?: string;

  completedAt?: string;
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
    Number(
      value || 0
    );

  return `₦${amount.toLocaleString(
    'en-NG'
  )}`;

}


function formatStatus(
  status?: string
) {

  if (!status) {
    return 'Unknown';
  }

  return status
    .replaceAll(
      '_',
      ' '
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      c => c.toUpperCase()
    );

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


/*
=========================================================
STATUS DESCRIPTION
=========================================================
*/

function statusDescription(
  status?: string,
  riderArrivalConfirmed?: boolean
) {

  switch (status) {

    case 'DRIVER_ASSIGNED':

      return (
        'Ride accepted. Get ready to pick up the rider.'
      );


    case 'DRIVER_ARRIVING':

      return (
        'You are on your way to the pickup location.'
      );


    case 'DRIVER_ARRIVED':

      return (
        'You have arrived at the pickup location.'
      );


    case 'TRIP_STARTED':

      if (
        riderArrivalConfirmed
      ) {

        return (
          'The rider has confirmed arrival at the destination. You can now complete the trip.'
        );

      }

      return (
        'Trip is in progress. Drive safely to the destination.'
      );


    case 'COMPLETION_REQUESTED':

      if (
        riderArrivalConfirmed
      ) {

        return (
          'The rider has confirmed arrival at the destination. You can now complete the trip.'
        );

      }

      return (
        'Waiting for the rider to confirm the destination.'
      );


    case 'TRIP_COMPLETED':

      return (
        'Trip completed successfully.'
      );


    default:

      return 'Ride information';

  }

}


/*
=========================================================
EXTRACT SOCKET TRIP
=========================================================

Backend realtime events are emitted as:

{
  event: 'trip:updated',
  trip: {...}
}

This helper keeps the mobile app compatible with
that payload structure.
=========================================================
*/

function extractSocketTrip(
  payload: any
): Trip | null {

  if (
    payload?.trip
  ) {

    return payload.trip;

  }


  /*
   * Defensive fallback in case another backend
   * event sends the trip object directly.
   */

  if (
    payload?._id ||
    payload?.tripId
  ) {

    return payload;

  }


  return null;

}


/*
=========================================================
DRIVER TRIP
=========================================================
*/

export default function DriverTrip() {

  const params =
    useLocalSearchParams<{
      id?: string;
      tripId?: string;
    }>();


  const requestedId =
    params.id ||
    params.tripId ||
    '';


  const [
    trip,
    setTrip
  ] = useState<Trip | null>(
    null
  );
  const [
    driverLocation,
    setDriverLocation
  ] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);



  const [
    loading,
    setLoading
  ] = useState(true);


  const [
    accepting,
    setAccepting
  ] = useState(false);


  const [
    advancing,
    setAdvancing
  ] = useState(false);


  const [
    requestingCompletion,
    setRequestingCompletion
  ] = useState(false);


  const [
    availableTrips,
    setAvailableTrips
  ] = useState<Trip[]>([]);


  /*
  =======================================================
  AUTH
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
  LOAD SPECIFIC TRIP
  =======================================================
  */

  const loadTrip =
    useCallback(
      async () => {

        if (!requestedId) {

          return null;

        }


        try {

          const authenticated =
            await authenticate();


          if (!authenticated) {

            return null;

          }


          console.log(
            '[DRIVER TRIP] Loading trip:',
            requestedId
          );


          const response =
            await api.get(
              `/trips/${requestedId}`
            );


          const result =
            response?.data?.data?.trip ||
            null;


          if (result) {

            setTrip(
              result
            );

          }


          return result;

        } catch (
          error: any
        ) {

          console.log(
            '[DRIVER TRIP ERROR]',
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

            return null;

          }


          Alert.alert(
            'Unable to load ride',
            error?.response?.data?.message ||
            'The ride could not be loaded.'
          );


          return null;

        }

      },
      [
        requestedId,
        authenticate,
      ]
    );


  /*
  =======================================================
  AVAILABLE RIDES
  =======================================================
  */

  const loadAvailableTrips =
    useCallback(
      async () => {

        try {

          const authenticated =
            await authenticate();


          if (!authenticated) {

            return;

          }


          const response =
            await api.get(
              '/trips/available'
            );


          const trips =
            response?.data?.data?.trips ||
            [];


          setAvailableTrips(
            Array.isArray(
              trips
            )
              ? trips
              : []
          );

        } catch (
          error: any
        ) {

          console.log(
            '[DRIVER AVAILABLE ERROR]',
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

          }

        }

      },
      [
        authenticate,
      ]
    );


  /*
  =======================================================
  SOCKET
  =======================================================
  */

  useEffect(() => {

    let mounted =
      true;


    let cleanNewTrip =
      () => {};


    let cleanTripTaken =
      () => {};


    let cleanTripUpdated =
      () => {};

      let cleanDestinationConfirmed =
  () => {};


    async function setupSocket() {

      const socket =
        await connectSocket();


      if (
        !mounted ||
        !socket
      ) {

        return;

      }


      console.log(
        '[DRIVER TRIP] Socket ready'
      );


      /*
-----------------------------------------------------
NEW RIDE REQUEST
-----------------------------------------------------
*/

cleanNewTrip =
  onSocket(
    'trip:new',
    (
      payload: any
    ) => {

      const incoming =
        extractSocketTrip(
          payload
        );

      if (!incoming) {

  return;

}


/*
-----------------------------------------------------
PLAY NEW RIDE REQUEST SOUND
-----------------------------------------------------
*/

if (incoming._id) {

  playRideRequestSound(
    String(incoming._id)
  );

}


console.log(
  '[DRIVER TRIP] New ride:',
  incoming._id
);

if (
  incoming._id &&
  String(incoming._id) ===
  String(requestedId)
) {

  setTrip(
    incoming
  );

}

setAvailableTrips(
  previous => {

    const exists =
      previous.some(
        item =>
          String(item._id) ===
          String(incoming._id)
      );

    if (
      exists
    ) {

      return previous;

    }

    return [
      incoming,
      ...previous,
    ];

  }
);

      }
    );

      /*
      -----------------------------------------------------
      ANOTHER DRIVER TOOK RIDE
      -----------------------------------------------------
      */

      cleanTripTaken =
        onSocket(
          'trip:taken',
          (
            payload: any
          ) => {

            console.log(
              '[DRIVER TRIP] Trip taken:',
              payload
            );


            const takenId =
              payload?.tripId ||
              payload?.trip?._id ||
              payload?._id ||
              null;


            if (
              takenId &&
              String(takenId) ===
              String(requestedId)
            ) {

              /*
               * Reload the authoritative trip.
               *
               * This prevents the driver screen from
               * showing stale ownership information.
               */

              loadTrip();

            }


            setAvailableTrips(
              previous =>
                previous.filter(
                  item =>
                    String(item._id) !==
                    String(takenId)
                )
            );

          }
        );


      /*
      -----------------------------------------------------
      TRIP UPDATED
      -----------------------------------------------------
      */

      cleanTripUpdated =
        onSocket(
          'trip:updated',
          (
            payload: any
          ) => {

            const incoming =
              extractSocketTrip(
                payload
              );


            if (!incoming) {

              return;

            }


            console.log(
              '[DRIVER TRIP] Trip updated:',
              {
                tripId:
                  incoming._id,

                status:
                  incoming.status,

                riderArrivalConfirmed:
                  incoming.riderArrivalConfirmed,

                arrivalStatus:
                  incoming.arrivalStatus,
              }
            );


            if (
              String(incoming._id) ===
              String(requestedId)
            ) {

              /*
               * CRITICAL:
               *
               * Replace the current trip with the
               * authoritative updated trip.
               *
               * This is what makes the driver's
               * "Trip Complete" button appear
               * immediately after the rider confirms.
               */

              setTrip(
                incoming
              );

            }

          }
        );

    }


    /*
-----------------------------------------------------
RIDER CONFIRMED DESTINATION
-----------------------------------------------------

The rider presses "I Have Arrived".

The backend may emit destination:confirmed
instead of, or before, the normal trip:updated event.

This event must immediately unlock the
driver's "Trip Complete" button.

-----------------------------------------------------
*/

cleanDestinationConfirmed =
  onSocket(
    'destination:confirmed',
    (
      payload: any
    ) => {

      console.log(
        '[DRIVER TRIP] Rider confirmed destination:',
        payload
      );


      const incoming =
        extractSocketTrip(
          payload
        );


      const incomingId =
        incoming?._id ||
        payload?.tripId ||
        payload?._id ||
        null;


      if (
        !incomingId ||
        String(incomingId) !==
        String(requestedId)
      ) {

        return;

      }


      /*
      ---------------------------------------------------
      MERGE WITH CURRENT TRIP
      ---------------------------------------------------
      */

      setTrip(
        previous => {

          if (!previous) {

            return (
              incoming || {
                _id:
                  String(incomingId),

                riderArrivalConfirmed:
                  true,

                arrivalStatus:
                  'rider_confirmed',
              }
            );

          }


          return {

            ...previous,

            ...(incoming || {}),

            riderArrivalConfirmed:
              true,

            arrivalStatus:
              'rider_confirmed',

          };

        }
      );


      console.log(
        '[DRIVER TRIP] Trip Complete unlocked:',
        {
          tripId:
            incomingId,

          riderArrivalConfirmed:
            true,

          arrivalStatus:
            'rider_confirmed',
        }
      );

    }
  );

    setupSocket();


    return () => {

      mounted =
        false;


      cleanNewTrip();

cleanTripTaken();

cleanTripUpdated();

cleanDestinationConfirmed();

      /*
       * Do not disconnect the global socket here.
       * Other driver screens may still use it.
       */

    };

  }, [
    requestedId,
    loadTrip,
  ]);


  /*
  =======================================================
  AUTHORITATIVE TRIP REFRESH
  =======================================================

  Socket events update the screen immediately, but the
  API remains the source of truth. A short refresh interval
  prevents the driver from missing the rider confirmation
  if a realtime event is delayed or lost.
  =======================================================
  */

  useEffect(() => {

    if (!requestedId) {
      return;
    }

    let active = true;

    const refreshAuthoritativeTrip = async () => {

      if (!active) {
        return;
      }

      try {

        const authenticated =
          await authenticate();

        if (!authenticated || !active) {
          return;
        }

        const response =
  await api.get(
    `/trips/${requestedId}?_refresh=${Date.now()}`,
    {
      headers: {
        'Cache-Control':
          'no-cache',
        Pragma:
          'no-cache',
      },
    }
  );


const latest =
  response?.data?.data?.trip ||
  response?.data?.trip ||
  null;


if (
  latest &&
  active
) {

  setTrip(
    latest
  );


  console.log(
    '[DRIVER TRIP] Authoritative refresh:',
    {
      tripId:
        latest._id,

      status:
        latest.status,

      riderArrivalConfirmed:
        latest.riderArrivalConfirmed,

      arrivalStatus:
        latest.arrivalStatus,
    }
  );


  /*
  -------------------------------------------------------
  RIDER CONFIRMED ARRIVAL
  -------------------------------------------------------

  Keep the authoritative backend state in the driver
  screen even if the socket event was missed.
  -------------------------------------------------------
  */

  if (
    latest.riderArrivalConfirmed === true &&
    String(
      latest.arrivalStatus ||
      ''
    )
      .trim()
      .toLowerCase() ===
      'rider_confirmed'
  ) {

    console.log(
      '[DRIVER TRIP] Rider confirmation detected from API:',
      {
        tripId:
          latest._id,

        riderArrivalConfirmed:
          true,

        arrivalStatus:
          latest.arrivalStatus,
      }
    );

  }

}

      } catch (error: any) {

        console.log(
          '[DRIVER TRIP] Background refresh failed:',
          error?.response?.data?.message ||
          error?.message ||
          error
        );

      }

    };

    const interval =
      setInterval(
        refreshAuthoritativeTrip,
        3000
      );

    return () => {

      active = false;

      clearInterval(
        interval
      );

    };

  }, [
    requestedId,
    authenticate,
  ]);


   /*
  =======================================================
  LIVE DRIVER GPS TRACKING
  =======================================================
  Sends driver's live location to backend
  and broadcasts it to the assigned rider.
  =======================================================
*/

useEffect(() => {

  const activeStatuses = [

    'DRIVER_ASSIGNED',

    'DRIVER_ARRIVING',

    'DRIVER_ARRIVED',

    'TRIP_STARTED',

  ];


  const currentStatus =
    String(
      trip?.status || ''
    ).toUpperCase();



  if (

    !trip?._id ||

    !activeStatuses.includes(
      currentStatus
    )

  ) {

    return;

  }

  const activeTrip = trip;



  let mounted = true;


  let watcher:
    Location.LocationSubscription | null =
      null;



  async function startDriverLocationTracking() {


    try {


      console.log(
        '[DRIVER GPS] Initializing tracking',
        {
          tripId:
            activeTrip._id,

          status:
            currentStatus,
        }
      );



      /*
      ===============================================
      REQUEST LOCATION PERMISSION
      ===============================================
      */


      const permission =
        await Location.requestForegroundPermissionsAsync();



      if (

        permission.status !==
        Location.PermissionStatus.GRANTED

      ) {


        console.log(
          '[DRIVER GPS] Permission denied'
        );


        return;


      }



      if (!mounted) {

        return;

      }



      /*
      ===============================================
      ENSURE SOCKET CONNECTION
      ===============================================
      */


      const socket =
        await connectSocket();



      if (!socket) {


        console.log(
          '[DRIVER GPS] Socket unavailable'
        );


        return;


      }



      /*
      ===============================================
      START WATCHING DRIVER LOCATION
      ===============================================
      */


      watcher =
        await Location.watchPositionAsync(


          {

            accuracy:
              Location.Accuracy.High,


            timeInterval:
              3000,


            distanceInterval:
              5,


          },


          position => {



            if (!mounted) {

              return;

            }



            const {

              latitude,

              longitude,

              accuracy,

            } =
              position.coords;



            if (

              !Number.isFinite(
                latitude
              )

              ||

              !Number.isFinite(
                longitude
              )

            ) {

              return;

            }




            /*
            ===========================================
            UPDATE DRIVER SCREEN LOCATION
            ===========================================
            */


            setDriverLocation({

              latitude,

              longitude,

              accuracy:
                accuracy ??
                undefined,

            });






            /*
            ===========================================
            SEND LOCATION TO BACKEND
            ===========================================
            */


            emitSocket(

              'driver:location',

              {


                tripId:

                  String(
                    activeTrip._id
                  ),



                driverId:

                  String(

                    activeTrip.driver?._id ||

                    activeTrip.driver?.id ||

                    ''

                  ),



                location:

                {

                  latitude,

                  longitude,

                  accuracy:
                    accuracy ??
                    null,

                },


              }

            );




          }


        );

      console.log(

        '[DRIVER GPS] Tracking started',

        {

          tripId:
            activeTrip._id,

        }

      );



    }

    catch(error:any) {


      console.log(

        '[DRIVER GPS] Tracking error',

        error?.message ||
        error

      );


    }


  }



  startDriverLocationTracking();




  return () => {


    mounted = false;



    if (watcher) {


      watcher.remove();


      watcher = null;


    }



    console.log(

      '[DRIVER GPS] Tracking stopped',

      {

        tripId:
          trip?._id,

      }

    );


  };



}, [

  trip?._id,

  trip?.status,

  trip?.driver?._id,

]);

/*
  =======================================================
  INITIAL LOAD
  =======================================================
  */

  useEffect(() => {

    async function load() {

      setLoading(
        true
      );


      if (
        requestedId
      ) {

        await loadTrip();

      } else {

        await loadAvailableTrips();

      }


      setLoading(
        false
      );

    }


    load();

  }, [
    requestedId,
    loadTrip,
    loadAvailableTrips,
  ]);


  /*
  =======================================================
  ACCEPT RIDE
  =======================================================
  */

  async function acceptRide(
    selectedTrip?: Trip
  ) {

    const target =
      selectedTrip ||
      trip;


    if (
      !target?._id ||
      accepting
    ) {

      return;

    }


    try {

      setAccepting(
        true
      );


      console.log(
        '[DRIVER TRIP] Accepting:',
        target._id
      );


      const response =
        await api.post(
          `/trips/${target._id}/accept`
        );


      const updated =
        response?.data?.data?.trip ||
        response?.data?.data ||
        null;


      if (
        updated
      ) {

        setTrip(
          updated
        );

      } else {

        await loadTrip();

      }


      setAvailableTrips(
        previous =>
          previous.filter(
            item =>
              item._id !==
              target._id
          )
      );

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
        'Unable to accept ride',
        error?.response?.data?.message ||
        'This ride may already have been accepted by another driver.'
      );


      await loadAvailableTrips();

    } finally {

      setAccepting(
        false
      );

    }

  }


  /*
  =======================================================
  ADVANCE TRIP
  =======================================================
  */

  async function advanceTrip() {

    if (
      !trip?._id ||
      !trip.status ||
      advancing
    ) {

      return;

    }


    try {

      setAdvancing(
        true
      );


      console.log(
        '[DRIVER TRIP] Advancing:',
        trip.status
      );


      const response =
        await api.patch(
          `/trips/${trip._id}/advance`,
          {
            from:
              trip.status,
          }
        );


      const updated =
        response?.data?.data?.trip ||
        response?.data?.data ||
        null;


      if (
        updated
      ) {

        setTrip(
          updated
        );

      } else {

        await loadTrip();

      }

    } catch (
      error: any
    ) {

      console.log(
        '[DRIVER ADVANCE ERROR]',
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
        'Unable to update trip',
        error?.response?.data?.message ||
        'Please try again.'
      );

    } finally {

      setAdvancing(
        false
      );

    }

  }


  /*
  =======================================================
  COMPLETE / REQUEST COMPLETION
  =======================================================

  IMPORTANT:

  The same backend endpoint handles both stages.

  Stage 1:
    Driver presses "Arrived at Destination"
    before rider confirmation.

  Stage 2:
    Rider presses "I Have Arrived".

  Stage 3:
    Driver sees "Trip Complete" and presses it.

  The backend will only finalize the trip when:
    riderArrivalConfirmed === true
    arrivalStatus === 'rider_confirmed'

  This protects the trip from being completed
  prematurely by the driver.
  =======================================================
  /*
=========================================================
DRIVER REQUESTS TRIP COMPLETION
=========================================================

FLOW:

Stage 1:
  Driver reaches destination.

Stage 2:
  Rider presses "I Have Arrived".

Stage 3:
  Driver presses "Trip Complete".

IMPORTANT:

The backend requires the driver's current GPS
coordinates when requesting completion.

If the rider has already confirmed arrival:
  -> backend completes the trip immediately.

If the rider has NOT confirmed arrival:
  -> backend records the driver's completion request
  -> rider is notified
  -> driver waits for rider confirmation.

The backend remains authoritative.
=========================================================
*/

async function requestCompletion() {

  if (
    !trip?._id ||
    requestingCompletion ||
    completed
  ) {

    return;

  }


  try {

    setRequestingCompletion(
      true
    );


    const tripId =
      trip._id;


    console.log(
      '[DRIVER COMPLETION] Starting completion request:',
      tripId
    );


    /*
    =======================================================
    STEP 1
    GET THE LATEST TRIP
    =======================================================
    */

    let latestTrip =
      trip;


    try {

      const latestResponse =
        await api.get(
          `/trips/${tripId}`
        );


      latestTrip =
        latestResponse?.data?.data?.trip ||
        latestResponse?.data?.trip ||
        trip;


      if (
        latestTrip
      ) {

        setTrip(
          latestTrip
        );

      }

    } catch (
      refreshError
    ) {

      console.log(
        '[DRIVER COMPLETION] Pre-completion refresh failed:',
        refreshError
      );

    }


    /*
    =======================================================
    STEP 2
    VERIFY TRIP IS STILL ACTIVE
    =======================================================
    */

    const latestStatus =
      String(
        latestTrip?.status ||
        ''
      )
      .trim()
      .toUpperCase();


    if (
      latestStatus &&
      latestStatus !== 'TRIP_STARTED'
    ) {

      console.log(
        '[DRIVER COMPLETION] Trip is no longer in TRIP_STARTED:',
        latestStatus
      );


      /*
      -----------------------------------------------------
      If already completed, simply refresh the screen.
      -----------------------------------------------------
      */

      if (
        latestStatus ===
        'TRIP_COMPLETED'
      ) {

        setTrip(
          latestTrip
        );

        return;

      }


      Alert.alert(
        'Trip cannot be completed',
        `The trip is currently ${latestStatus}.`
      );


      return;

    }


    /*
    =======================================================
    STEP 3
    REQUEST LOCATION PERMISSION
    =======================================================
    */

    console.log(
      '[DRIVER COMPLETION] Requesting location permission'
    );


    const {
      status: permissionStatus
    } =
      await Location.requestForegroundPermissionsAsync();


    if (
      permissionStatus !==
      Location.PermissionStatus.GRANTED
    ) {

      console.log(
        '[DRIVER COMPLETION] Location permission denied'
      );


      Alert.alert(
        'Location Required',
        'Kaduna Only needs your current location to confirm that you are at the destination. Please allow location access and try again.',
        [
          {
            text:
              'OK'
          }
        ]
      );


      return;

    }


    /*
    =======================================================
    STEP 4
    VERIFY LOCATION SERVICES
    =======================================================
    */

    const servicesEnabled =
      await Location.hasServicesEnabledAsync();


    if (
      !servicesEnabled
    ) {

      console.log(
        '[DRIVER COMPLETION] Location services disabled'
      );


      Alert.alert(
        'Location Is Off',
        'Please turn on your phone location service and try again.',
        [
          {
            text:
              'OK'
          }
        ]
      );


      return;

    }


    /*
    =======================================================
    STEP 5
    GET CURRENT DRIVER LOCATION
    =======================================================
    */

    console.log(
      '[DRIVER COMPLETION] Getting current GPS position'
    );


    const position =
      await Location.getCurrentPositionAsync({
        accuracy:
          Location.Accuracy.High,
      });


    const latitude =
      Number(
        position?.coords?.latitude
      );


    const longitude =
      Number(
        position?.coords?.longitude
      );


    const accuracy =
      Number(
        position?.coords?.accuracy
      );


    /*
    =======================================================
    STEP 6
    VALIDATE GPS
    =======================================================
    */

    if (
      !Number.isFinite(
        latitude
      ) ||
      latitude < -90 ||
      latitude > 90
    ) {

      throw new Error(
        'Unable to obtain a valid driver latitude.'
      );

    }


    if (
      !Number.isFinite(
        longitude
      ) ||
      longitude < -180 ||
      longitude > 180
    ) {

      throw new Error(
        'Unable to obtain a valid driver longitude.'
      );

    }


    console.log(
      '[DRIVER COMPLETION] GPS obtained:',
      {
        latitude,
        longitude,
        accuracy,
      }
    );


    /*
    =======================================================
    STEP 7
    CHECK WHETHER RIDER ALREADY CONFIRMED
    =======================================================
    */

    const latestRiderConfirmed =
      latestTrip?.riderArrivalConfirmed === true &&
      String(
        latestTrip?.arrivalStatus ||
        ''
      )
      .trim()
      .toLowerCase() ===
        'rider_confirmed';


    console.log(
      '[DRIVER COMPLETION] Rider confirmation:',
      {
        riderArrivalConfirmed:
          latestTrip?.riderArrivalConfirmed,

        arrivalStatus:
          latestTrip?.arrivalStatus,

        latestRiderConfirmed,
      }
    );


    /*
    =======================================================
    STEP 8
    SEND COMPLETION REQUEST
    =======================================================
    */

    console.log(
      '[DRIVER COMPLETION] Sending completion request to backend'
    );


    const response =
      await api.post(
        `/trips/${tripId}/completion-request`,
        {
          latitude,
          longitude,

          ...(Number.isFinite(
            accuracy
          )
            ? {
                accuracy
              }
            : {}),
        }
      );


    console.log(
      '[DRIVER COMPLETION] Backend response:',
      response?.data
    );


    /*
    =======================================================
    STEP 9
    EXTRACT UPDATED TRIP
    =======================================================
    */

    const updated =
      response?.data?.data?.trip ||
      response?.data?.trip ||
      response?.data?.data ||
      null;


    if (
      updated
    ) {

      setTrip(
        updated
      );

    }


    /*
    =======================================================
    STEP 10
    REFRESH AUTHORITATIVE TRIP
    =======================================================
    */

    console.log(
      '[DRIVER COMPLETION] Refreshing authoritative trip'
    );


    const finalTrip =
      await loadTrip();


    /*
    =======================================================
    STEP 11
    DETERMINE FINAL RESULT
    =======================================================
    */

    const finalStatus =
      String(
        finalTrip?.status ||
        updated?.status ||
        ''
      )
      .trim()
      .toUpperCase();


    const finalRiderConfirmed =
      finalTrip?.riderArrivalConfirmed === true &&
      String(
        finalTrip?.arrivalStatus ||
        ''
      )
      .trim()
      .toLowerCase() ===
        'rider_confirmed';


    /*
    -------------------------------------------------------
    TRIP COMPLETED
    -------------------------------------------------------
    */

    if (
      finalStatus ===
      'TRIP_COMPLETED'
    ) {

      console.log(
        '[DRIVER COMPLETION] Trip completed successfully'
      );


      setTrip(
        finalTrip
      );


      Alert.alert(
        'Trip Completed',
        'The trip has been completed successfully.'
      );


      return;

    }


    /*
    -------------------------------------------------------
    RIDER CONFIRMATION STILL REQUIRED
    -------------------------------------------------------
    */

    if (
      response?.data?.data
        ?.requiresRiderConfirmation === true ||
      !finalRiderConfirmed
    ) {

      console.log(
        '[DRIVER COMPLETION] Waiting for rider confirmation'
      );


      Alert.alert(
        'Waiting for Rider',
        'The completion request has been sent. The rider must confirm the destination before the trip can be completed.'
      );


      return;

    }


    /*
    -------------------------------------------------------
    FALLBACK
    -------------------------------------------------------
    */

    console.log(
      '[DRIVER COMPLETION] Completion request accepted but trip remains active:',
      finalStatus
    );


  } catch (
    error: any
  ) {

    console.log(
      '[DRIVER COMPLETION] Error:',
      error
    );


    const status =
      error?.response?.status;


    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Unable to request trip completion. Please try again.';


    /*
    =======================================================
    409 HANDLING
    =======================================================
    */

    if (
      status === 409
    ) {

      Alert.alert(
        'Trip Not Ready',
        message
      );


      /*
      -----------------------------------------------------
      Refresh because another device may have changed
      the trip state.
      -----------------------------------------------------
      */

      try {

        await loadTrip();

      } catch (
        refreshError
      ) {

        console.log(
          '[DRIVER COMPLETION] Recovery refresh failed:',
          refreshError
        );

      }


      return;

    }


    /*
    =======================================================
    400 HANDLING
    =======================================================
    */

    if (
      status === 400
    ) {

      Alert.alert(
        'Unable to Complete Trip',
        message
      );


      return;

    }


    /*
    =======================================================
    NETWORK ERROR
    =======================================================
    */

    if (
      !error?.response
    ) {

      Alert.alert(
        'Connection Problem',
        'The completion request could not reach the server. Check your internet connection and try again.'
      );


      return;

    }


    /*
    =======================================================
    GENERAL ERROR
    =======================================================
    */

    Alert.alert(
      'Trip Completion Failed',
      message
    );


  } finally {

    /*
    =======================================================
    ALWAYS RELEASE BUTTON LOCK
    =======================================================
    */

    setRequestingCompletion(
      false
    );

  }

}


  /*
  =======================================================
  NAVIGATION
  =======================================================
  */

  function goBack() {

    router.back();

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
            Loading ride...
          </Text>

        </View>

      </SafeAreaView>

    );

  }


  /*
  =======================================================
  AVAILABLE RIDE LIST
  =======================================================
  */

  if (
    !requestedId &&
    !trip
  ) {

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

          contentContainerStyle={
            styles.content
          }
        >

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
                  styles.backText
                }
              >
                <Text
  style={
    styles.backText
  }
>
  ‹
</Text>
              </Text>

            </Pressable>


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
                  styles.title
                }
              >
                Ride Requests
              </Text>

            </View>

          </View>


          {
            availableTrips.length === 0
              ? (

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
                    No ride requests
                  </Text>


                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    New ride requests will appear here when you are online and available.
                  </Text>

                </View>

              )
              : (

                availableTrips.map(
                  item => (

                    <View
                      key={
                        item._id
                      }

                      style={
                        styles.requestCard
                      }
                    >

                      <View
                        style={
                          styles.requestHeader
                        }
                      >

                        <View
                          style={
                            styles.requestIcon
                          }
                        >

                          <Text
                            style={
                              styles.requestIconText
                            }
                          >
                            K
                          </Text>

                        </View>


                        <View
                          style={
                            styles.requestInfo
                          }
                        >

                          <Text
                            style={
                              styles.requestTitle
                            }
                          >
                            {
                              getFirstName(
                                item.rider?.fullName
                              )
                            }
                          </Text>


                          <Text
                            style={
                              styles.requestSubtitle
                            }
                          >
                            New ride request
                          </Text>

                        </View>


                        <Text
                          style={
                            styles.fare
                          }
                        >
                          {
                            formatMoney(
                              item.fare
                            )
                          }
                        </Text>

                      </View>


                      <View
                        style={
                          styles.locationBlock
                        }
                      >

                        <View
                          style={
                            styles.locationRow
                          }
                        >

                          <View
                            style={
                              styles.pickupDot
                            }
                          />


                          <Text
                            numberOfLines={
                              2
                            }

                            style={
                              styles.locationText
                            }
                          >
                            {
                              item.pickup?.address ||
                              'Pickup location'
                            }
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
                            numberOfLines={
                              2
                            }

                            style={
                              styles.locationText
                            }
                          >
                            {
                              item.destination?.address ||
                              'Destination'
                            }
                          </Text>

                        </View>

                      </View>


                      <Pressable
                        onPress={() =>
                          acceptRide(
                            item
                          )
                        }

                        disabled={
                          accepting
                        }

                        style={
                          styles.acceptButton
                        }
                      >

                        {
                          accepting
                            ? (

                              <ActivityIndicator
                                color={
                                  BrandColors.white
                                }
                              />

                            )
                            : (

                              <Text
                                style={
                                  styles.acceptText
                                }
                              >
                                Accept Ride
                              </Text>

                            )
                        }

                      </Pressable>

                    </View>

                  )
                )

              )
          }

        </ScrollView>

      </SafeAreaView>

    );

  }


  /*
  =======================================================
  TRIP DATA
  =======================================================
  */

  const status =
    trip?.status ||
    'UNKNOWN';


  const isAssigned =
    status ===
    'DRIVER_ASSIGNED';


  const isArriving =
    status ===
    'DRIVER_ARRIVING';


  const isArrived =
    status ===
    'DRIVER_ARRIVED';


  const isStarted =
    status ===
    'TRIP_STARTED';


  const completionRequested =
    status ===
    'COMPLETION_REQUESTED';


  const completed =
    status ===
    'TRIP_COMPLETED';


  /*
  =======================================================
  RIDER CONFIRMATION
  =======================================================
  */

  const riderConfirmedArrival =
    trip?.riderArrivalConfirmed === true &&
    String(
      trip?.arrivalStatus || ''
    ).trim().toLowerCase() ===
      'rider_confirmed';


  /*
  =======================================================
  MAIN TRIP SCREEN
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

        contentContainerStyle={
          styles.content
        }
      >

        {/* HEADER */}

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
                styles.brand
              }
            >
              KADUNA ONLY
            </Text>


            <Text
              style={
                styles.title
              }
            >
              Ride Details
            </Text>

          </View>

        </View>


        {/* STATUS */}

        <View
          style={
            styles.statusCard
          }
        >

          <View
            style={
              styles.statusIndicator
            }
          >

            <View
              style={
                styles.statusDot
              }
            />

          </View>


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
              {
                formatStatus(
                  status
                )
              }
            </Text>


            <Text
              style={
                styles.statusDescription
              }
            >
              {
                statusDescription(
                  status,
                  riderConfirmedArrival
                )
              }
            </Text>

          </View>

        </View>


        {/* RIDER */}

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
            Rider
          </Text>

        </View>


        <View
          style={
            styles.riderCard
          }
        >

          <View
            style={
              styles.avatar
            }
          >

            <Text
              style={
                styles.avatarText
              }
            >
              {
                (
                  trip?.rider?.fullName ||
                  'R'
                )
                  .trim()
                  .charAt(0)
                  .toUpperCase()
              }
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
              {
                trip?.rider?.fullName ||
                'Rider'
              }
            </Text>


            <Text
              style={
                styles.riderPhone
              }
            >
              {
                trip?.rider?.phone ||
                'Phone unavailable'
              }
            </Text>

          </View>

        </View>


        {/* DRIVER LIVE MAP */}

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
            Live Location
          </Text>

        </View>


        <View
          style={
            styles.mapCard
          }
        >

          <MapView
            style={
              styles.map
            }

            region={
              driverLocation
                ? {
                    latitude:
                      driverLocation.latitude,

                    longitude:
                      driverLocation.longitude,

                    latitudeDelta:
                      0.012,

                    longitudeDelta:
                      0.012,
                  }
                : undefined
            }

            showsUserLocation={
              false
            }

            showsMyLocationButton={
              false
            }
          >

            {driverLocation && (

              <Marker
                coordinate={{
                  latitude:
                    driverLocation.latitude,

                  longitude:
                    driverLocation.longitude,
                }}

                title="Your current location"

                description="Live GPS position"
              />

            )}

          </MapView>


          <View
            style={
              styles.liveLocationRow
            }
          >

            <View
              style={
                styles.liveLocationDot
              }
            />

            <Text
              style={
                styles.liveLocationText
              }
            >
              GPS tracking active
            </Text>

          </View>

        </View>

        {/* LOCATIONS */}

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
            Route
          </Text>

        </View>


        <View
          style={
            styles.routeCard
          }
        >

          <View
            style={
              styles.routeRow
            }
          >

            <View
              style={
                styles.pickupMarker
              }
            />


            <View
              style={
                styles.routeText
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
                  styles.routeAddress
                }
              >
                {
                  trip?.pickup?.address ||
                  'Pickup location'
                }
              </Text>

            </View>

          </View>


          <View
            style={
              styles.routeConnector
            }
          />


          <View
            style={
              styles.routeRow
            }
          >

            <View
              style={
                styles.destinationMarker
              }
            />


            <View
              style={
                styles.routeText
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
                  styles.routeAddress
                }
              >
                {
                  trip?.destination?.address ||
                  'Destination'
                }
              </Text>

            </View>

          </View>

        </View>


        {/* FARE */}

        <View
          style={
            styles.fareCard
          }
        >

          <View>

            <Text
              style={
                styles.fareLabel
              }
            >
              RIDE FARE
            </Text>


            <Text
              style={
                styles.fareAmount
              }
            >
              {
                formatMoney(
                  trip?.fare
                )
              }
            </Text>

          </View>


          <View
            style={
              styles.vehicleBadge
            }
          >

            <Text
              style={
                styles.vehicleIcon
              }
            >
              🛺
            </Text>


            <Text
              style={
                styles.vehicleText
              }
            >
              {
                trip?.vehicleType ||
                'Keke'
              }
            </Text>

          </View>

        </View>


        {/* ACCEPT */}

        {
          status ===
          'SEARCHING_DRIVER' && (

            <Pressable
              onPress={() =>
                acceptRide()
              }

              disabled={
                accepting
              }

              style={
                styles.primaryButton
              }
            >

              {
                accepting
                  ? (

                    <ActivityIndicator
                      color={
                        BrandColors.white
                      }
                    />

                  )
                  : (

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Accept Ride
                    </Text>

                  )
              }

            </Pressable>

          )
        }


        {/* DRIVER ASSIGNED */}

        {
          isAssigned && (

            <Pressable
              onPress={
                advanceTrip
              }

              disabled={
                advancing
              }

              style={
                styles.primaryButton
              }
            >

              {
                advancing
                  ? (

                    <ActivityIndicator
                      color={
                        BrandColors.white
                      }
                    />

                  )
                  : (

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Start Driving to Pickup
                    </Text>

                  )
              }

            </Pressable>

          )
        }


        {/* ARRIVING */}

        {
          isArriving && (

            <Pressable
              onPress={
                advanceTrip
              }

              disabled={
                advancing
              }

              style={
                styles.primaryButton
              }
            >

              {
                advancing
                  ? (

                    <ActivityIndicator
                      color={
                        BrandColors.white
                      }
                    />

                  )
                  : (

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      I Have Arrived
                    </Text>

                  )
              }

            </Pressable>

          )
        }


        {/* ARRIVED */}

        {
          isArrived && (

            <Pressable
              onPress={
                advanceTrip
              }

              disabled={
                advancing
              }

              style={
                styles.primaryButton
              }
            >

              {
                advancing
                  ? (

                    <ActivityIndicator
                      color={
                        BrandColors.white
                      }
                    />

                  )
                  : (

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Start Trip
                    </Text>

                  )
              }

            </Pressable>

          )
        }


        {/* =================================================
            DRIVER DESTINATION / COMPLETION ACTION
            ================================================= */}

        {
          !completed &&
          (
            (
              isStarted &&
              !riderConfirmedArrival
            ) ||
            riderConfirmedArrival
          ) && (

            <Pressable
              onPress={
                requestCompletion
              }

              disabled={
                requestingCompletion
              }

              style={
                styles.primaryButton
              }
            >

              {
                requestingCompletion
                  ? (

                    <ActivityIndicator
                      color={
                        BrandColors.white
                      }
                    />

                  )
                  : (

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      {
                        riderConfirmedArrival
                          ? 'Trip Complete'
                          : 'Arrived at Destination'
                      }
                    </Text>

                  )
              }

            </Pressable>

          )
        }


        {/* =================================================
            COMPLETION REQUESTED
            ================================================= */}

        {
          completionRequested &&
          !riderConfirmedArrival && (

            <View
              style={
                styles.waitingCard
              }
            >

              <ActivityIndicator
                color={
                  BrandColors.primary
                }
              />


              <View
                style={
                  styles.waitingContent
                }
              >

                <Text
                  style={
                    styles.waitingTitle
                  }
                >
                  Waiting for Rider
                </Text>


                <Text
                  style={
                    styles.waitingText
                  }
                >
                  The rider needs to confirm that the destination has been reached.
                </Text>

              </View>

            </View>

          )
        }


        {/* =================================================
            COMPLETED
            ================================================= */}

        {
          completed && (

            <View
              style={
                styles.completedCard
              }
            >

              <View
                style={
                  styles.completedIcon
                }
              >

                <Text
                  style={
                    styles.completedIconText
                  }
                >
                   ✔
                </Text>

              </View>


              <Text
                style={
                  styles.completedTitle
                }
              >
                Trip Completed
              </Text>


              <Text
                style={
                  styles.completedText
                }
              >
                This ride has been completed successfully.
              </Text>

            </View>

          )
        }


        <View
          style={
            styles.footer
          }
        >

          <Text
            style={
              styles.footerText
            }
          >
            Kaduna Only • Driver
          </Text>

        </View>

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
      marginBottom: 20,
    },


    headerCenter: {
      marginLeft: 10,
    },


    backButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },


    backText: {
      color:
        BrandColors.primary,
      fontSize: 28,
      lineHeight: 30,
      fontWeight: '700',
      marginTop: -3,
    },


    brand: {
      color:
        BrandColors.primary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.1,
    },


    title: {
      color:
        BrandColors.text,
      fontSize: 19,
      fontWeight: '900',
      marginTop: 2,
    },


    /*
    -------------------------------------------------------
    STATUS
    -------------------------------------------------------
    */

    statusCard: {
      backgroundColor:
        BrandColors.primary,
      borderRadius: 19,
      padding: 17,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },


    statusIndicator: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },


    statusDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor:
        BrandColors.white,
    },


    statusContent: {
      flex: 1,
    },


    statusTitle: {
      color:
        BrandColors.white,
      fontSize: 13,
      fontWeight: '900',
    },


    statusDescription: {
      color:
        '#E9DBFF',
      fontSize: 9,
      lineHeight: 14,
      marginTop: 3,
    },


    /*
    -------------------------------------------------------
    SECTION
    -------------------------------------------------------
    */

    /*

    -------------------------------------------------------

    LIVE DRIVER MAP

    -------------------------------------------------------

    */


    mapCard: {

      backgroundColor:

        BrandColors.white,

      borderRadius: 17,

      borderWidth: 1,

      borderColor: '#ECEAF2',

      overflow: 'hidden',

    },


    map: {

      width: '100%',

      height: 240,

    },


    liveLocationRow: {

      flexDirection: 'row',

      alignItems: 'center',

      paddingHorizontal: 14,

      paddingVertical: 10,

    },


    liveLocationDot: {

      width: 8,

      height: 8,

      borderRadius: 4,

      backgroundColor:

        BrandColors.success,

      marginRight: 8,

    },


    liveLocationText: {

      color:

        BrandColors.success,

      fontSize: 11,

      fontWeight: '700',

    },

    sectionHeader: {
      marginTop: 19,
      marginBottom: 9,
    },


    sectionTitle: {
      color:
        BrandColors.text,
      fontSize: 15,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    RIDER
    -------------------------------------------------------
    */

    riderCard: {
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


    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    avatarText: {
      color:
        BrandColors.primary,
      fontSize: 17,
      fontWeight: '900',
    },


    riderInfo: {
      flex: 1,
    },


    riderName: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '900',
    },


    riderPhone: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      marginTop: 4,
    },


    /*
    -------------------------------------------------------
    ROUTE
    -------------------------------------------------------
    */

    routeCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      padding: 15,
    },


    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    pickupMarker: {
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor:
        BrandColors.primary,
      marginHorizontal: 3,
      marginRight: 12,
    },


    destinationMarker: {
      width: 11,
      height: 11,
      borderRadius: 2,
      backgroundColor:
        BrandColors.text,
      marginHorizontal: 3,
      marginRight: 12,
    },


    routeText: {
      flex: 1,
    },


    routeLabel: {
      color:
        BrandColors.textSecondary,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.7,
    },


    routeAddress: {
      color:
        BrandColors.text,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 16,
      marginTop: 3,
    },


    routeConnector: {
      width: 1,
      height: 18,
      backgroundColor:
        '#D8D8D8',
      marginLeft: 8,
      marginVertical: 3,
    },


    /*
    -------------------------------------------------------
    FARE
    -------------------------------------------------------
    */

    fareCard: {
      backgroundColor:
        BrandColors.primaryLight,
      borderRadius: 17,
      padding: 16,
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },


    fareLabel: {
      color:
        BrandColors.primary,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },


    fareAmount: {
      color:
        BrandColors.text,
      fontSize: 24,
      fontWeight: '900',
      marginTop: 3,
    },


    vehicleBadge: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },


    vehicleIcon: {
      fontSize: 19,
      marginRight: 5,
    },


    vehicleText: {
      color:
        BrandColors.text,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'capitalize',
    },


    /*
    -------------------------------------------------------
    PRIMARY BUTTON
    -------------------------------------------------------
    */

    primaryButton: {
      minHeight: 52,
      borderRadius: 15,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
    },


    primaryButtonText: {
      color:
        BrandColors.white,
      fontSize: 12,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    WAITING
    -------------------------------------------------------
    */

    waitingCard: {
      marginTop: 18,
      backgroundColor:
        BrandColors.white,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      borderRadius: 17,
      padding: 15,
      flexDirection: 'row',
      alignItems: 'center',
    },


    waitingContent: {
      flex: 1,
      marginLeft: 12,
    },


    waitingTitle: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '900',
    },


    waitingText: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      lineHeight: 14,
      marginTop: 3,
    },


    /*
    -------------------------------------------------------
    COMPLETED
    -------------------------------------------------------
    */

    completedCard: {
      marginTop: 18,
      backgroundColor:
        '#EEF9F1',
      borderWidth: 1,
      borderColor:
        '#CDEBD5',
      borderRadius: 17,
      padding: 18,
      alignItems: 'center',
    },


    completedIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        BrandColors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },


    completedIconText: {
      color:
        BrandColors.white,
      fontSize: 22,
      fontWeight: '900',
    },


    completedTitle: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '900',
      marginTop: 9,
    },


    completedText: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      textAlign: 'center',
      marginTop: 4,
    },


    /*
    -------------------------------------------------------
    AVAILABLE REQUESTS
    -------------------------------------------------------
    */

    requestCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      padding: 15,
      marginBottom: 11,
    },


    requestHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    requestIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },


    requestIconText: {
      color:
        BrandColors.primary,
      fontSize: 15,
      fontWeight: '900',
    },


    requestInfo: {
      flex: 1,
    },


    requestTitle: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '900',
    },


    requestSubtitle: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      marginTop: 3,
    },


    fare: {
      color:
        BrandColors.primary,
      fontSize: 14,
      fontWeight: '900',
    },


    locationBlock: {
      marginTop: 14,
      marginBottom: 12,
    },


    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    pickupDot: {
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
      borderRadius: 2,
      backgroundColor:
        BrandColors.text,
      marginHorizontal: 3,
      marginRight: 9,
    },


    locationText: {
      flex: 1,
      color:
        BrandColors.text,
      fontSize: 10,
      lineHeight: 15,
    },


    locationLine: {
      width: 1,
      height: 13,
      backgroundColor:
        '#D8D8D8',
      marginLeft: 7,
      marginVertical: 2,
    },


    acceptButton: {
      minHeight: 45,
      borderRadius: 13,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },


    acceptText: {
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
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      padding: 28,
      alignItems: 'center',
      marginTop: 10,
    },


    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
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
      fontSize: 14,
      fontWeight: '900',
      marginTop: 12,
    },


    emptyText: {
      color:
        BrandColors.textSecondary,
      fontSize: 10,
      lineHeight: 16,
      textAlign: 'center',
      marginTop: 5,
    },


    /*
    -------------------------------------------------------
    FOOTER
    -------------------------------------------------------
    */

    footer: {
      alignItems: 'center',
      marginTop: 28,
    },


    footerText: {
      color:
        '#AAAAAA',
      fontSize: 8,
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









