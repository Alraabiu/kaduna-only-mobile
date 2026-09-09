import {
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';

let requestPlayer: any = null;
let arrivalPlayer: any = null;

let audioInitialised = false;

let lastRequestId: string | null = null;
let lastArrivalTripId: string | null = null;

/*
=========================================================
INITIALISE AUDIO
=========================================================
*/

async function initialiseAudio() {
  if (audioInitialised) {
    return;
  }

  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });

    audioInitialised = true;

    console.log('[TRIP SOUNDS] Audio initialised');
  } catch (error) {
    console.log(
      '[TRIP SOUNDS] Audio initialisation error:',
      error
    );
  }
}

/*
=========================================================
RIDE REQUEST SOUND
=========================================================
*/

export async function playRideRequestSound(
  requestId?: string
) {
  try {
    await initialiseAudio();

    const id = requestId
      ? String(requestId)
      : null;

    /*
    Prevent the same rider request
    from sounding repeatedly.
    */

    if (id && lastRequestId === id) {
      console.log(
        '[TRIP SOUNDS] Request sound already played:',
        id
      );

      return;
    }

    lastRequestId = id;

    if (requestPlayer) {
      try {
        requestPlayer.remove();
      } catch {}
    }

    requestPlayer = createAudioPlayer(
      require('../../assets/sounds/Rider.mp3')
    );

    requestPlayer.play();

    console.log(
      '[TRIP SOUNDS] Ride request sound played'
    );

  } catch (error) {
    console.log(
      '[TRIP SOUNDS] Ride request sound error:',
      error
    );
  }
}

/*
=========================================================
DRIVER ARRIVAL SOUND
=========================================================
*/

export async function playDriverArrivalSound(
  tripId?: string
) {
  try {
    await initialiseAudio();

    const id = tripId
      ? String(tripId)
      : null;

    /*
    Prevent repeated arrival sounds
    for the same trip.
    */

    if (id && lastArrivalTripId === id) {
      console.log(
        '[TRIP SOUNDS] Arrival sound already played:',
        id
      );

      return;
    }

    lastArrivalTripId = id;

    if (arrivalPlayer) {
      try {
        arrivalPlayer.remove();
      } catch {}
    }

    arrivalPlayer = createAudioPlayer(
      require('../../assets/sounds/Driver.mp3')
    );

    arrivalPlayer.play();

    console.log(
      '[TRIP SOUNDS] Driver arrival sound played'
    );

  } catch (error) {
    console.log(
      '[TRIP SOUNDS] Driver arrival sound error:',
      error
    );
  }
}

/*
=========================================================
RESET SOUND STATE
=========================================================
*/

export function resetTripSounds() {
  lastRequestId = null;
  lastArrivalTripId = null;

  console.log(
    '[TRIP SOUNDS] Sound state reset'
  );
}