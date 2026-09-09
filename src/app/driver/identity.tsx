import React, {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  BrandColors,
} from '../../constants/theme';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';


/*
=========================================================
TYPES
=========================================================
*/

type IdentityStatus = {
  ninSubmitted: boolean;
  ninVerified: boolean;

  faceSubmitted: boolean;
  faceStatus: 'pending' | 'verified' | 'failed';
  faceVerified: boolean;

  identityVerified: boolean;
};


/*
=========================================================
HELPERS
=========================================================
*/

function getErrorMessage(
  error: any,
  fallback: string
) {

  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );

}


/*
=========================================================
IDENTITY SCREEN
=========================================================
*/

export default function DriverIdentity() {

  const [
    identity,
    setIdentity,
  ] = useState<IdentityStatus | null>(
    null
  );


  const [
    nin,
    setNin,
  ] = useState('');


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    submittingNIN,
    setSubmittingNIN,
  ] = useState(false);


    /*
  =======================================================
  FACE CAMERA STATE
  =======================================================
  */

  const [
    cameraVisible,
    setCameraVisible,
  ] = useState(false);


  const [
    capturedFaceUri,
    setCapturedFaceUri,
  ] = useState<string | null>(null);


  const [
    submittingFace,
    setSubmittingFace,
  ] = useState(false);


  const [
    cameraReady,
    setCameraReady,
  ] = useState(false);


  const cameraRef =
    useRef<CameraView | null>(null);


  const [
    cameraPermission,
    requestCameraPermission,
  ] = useCameraPermissions();

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
  LOAD IDENTITY
  =======================================================
  */

  const loadIdentity =
    useCallback(
      async () => {

        try {

          setLoading(
            true
          );


          const authenticated =
            await authenticate();


          if (!authenticated) {
            return;
          }


          const response =
            await api.get(
              '/drivers/me/identity'
            );


          const data =
            response?.data?.data
              ?.identity;


          if (!data) {

            throw new Error(
              'Identity information is unavailable.'
            );

          }


          setIdentity(
            data
          );


        } catch (error: any) {

          console.log(
            '[DRIVER IDENTITY ERROR]',
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
            'Identity & Security',
            getErrorMessage(
              error,
              'Unable to load your identity status.'
            )
          );


        } finally {

          setLoading(
            false
          );

        }

      },
      [
        authenticate,
      ]
    );


  /*
  =======================================================
  REFRESH WHEN SCREEN OPENS
  =======================================================
  */

  useFocusEffect(
    useCallback(
      () => {

        loadIdentity();

      },
      [
        loadIdentity,
      ]
    )
  );


  /*
  =======================================================
  SUBMIT NIN
  =======================================================
  */

  async function submitNIN() {

    const cleanNIN =
      nin
        .replace(/\D/g, '')
        .trim();


    if (
      cleanNIN.length !==
      11
    ) {

      Alert.alert(
        'Invalid NIN',
        'Please enter your 11-digit NIN.'
      );

      return;

    }


    try {

      setSubmittingNIN(
        true
      );


      const response =
        await api.post(
          '/drivers/me/identity/nin',
          {
            nin:
              cleanNIN,
          }
        );


      Alert.alert(
        'NIN Submitted',
        response?.data?.message ||
        'Your NIN has been submitted and is awaiting verification.'
      );


      setNin('');


      await loadIdentity();


    } catch (error: any) {

      console.log(
        '[DRIVER NIN ERROR]',
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
        'NIN Submission',
        getErrorMessage(
          error,
          'Unable to submit your NIN.'
        )
      );


    } finally {

      setSubmittingNIN(
        false
      );

    }

  }


    /*
  =======================================================
  OPEN FACE CAMERA
  =======================================================
  */

  async function openFaceCamera() {

    try {

      if (
        !cameraPermission?.granted
      ) {

        const permission =
          await requestCameraPermission();


        if (
          !permission.granted
        ) {

          Alert.alert(
            'Camera Permission Required',
            'Kaduna Only needs access to your camera to capture your face for driver identity verification.'
          );

          return;

        }

      }


      setCapturedFaceUri(
        null
      );

      setCameraReady(
        false
      );

      setCameraVisible(
        true
      );

    } catch (error: any) {

      console.log(
        '[FACE CAMERA ERROR]',
        error
      );

      Alert.alert(
        'Camera Error',
        getErrorMessage(
          error,
          'Unable to open the camera.'
        )
      );

    }

  }


  /*
  =======================================================
  CAPTURE FACE
  =======================================================
  */

  async function captureFace() {

    if (
      !cameraRef.current
    ) {

      Alert.alert(
        'Camera Not Ready',
        'Please wait for the camera to become ready.'
      );

      return;

    }


    if (
      !cameraReady
    ) {

      Alert.alert(
        'Camera Not Ready',
        'Please wait a moment and try again.'
      );

      return;

    }


    try {

      const photo =
        await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });


      if (
        photo?.uri
      ) {

        setCapturedFaceUri(
          photo.uri
        );

        setCameraVisible(
          false
        );

      }

    } catch (error: any) {

      console.log(
        '[FACE CAPTURE ERROR]',
        error
      );

      Alert.alert(
        'Capture Failed',
        getErrorMessage(
          error,
          'Unable to capture your face.'
        )
      );

    }

  }


  /*
  =======================================================
  RETAKE FACE
  =======================================================
  */

  function retakeFace() {

    setCapturedFaceUri(
      null
    );

    setCameraReady(
      false
    );

    setCameraVisible(
      true
    );

  }


  /*
  =======================================================
  SUBMIT FACE IMAGE
  =======================================================
  */

  async function submitFace() {

    if (
      !capturedFaceUri
    ) {

      Alert.alert(
        'Face Image Required',
        'Please capture your face before submitting.'
      );

      return;

    }


    try {

      setSubmittingFace(
        true
      );


      const formData =
        new FormData();


      formData.append(
        'faceImage',
        {
          uri:
            capturedFaceUri,

          name:
            `face-${Date.now()}.jpg`,

          type:
            'image/jpeg',

        } as any
      );


      const response =
        await api.post(

          '/upload/driver-face',

          formData,

          {
            headers: {
              'Content-Type':
                'multipart/form-data',
            },
          }

        );


      console.log(
        '[FACE UPLOAD SUCCESS]',
        response?.data
      );


      setCapturedFaceUri(
        null
      );


      Alert.alert(
        'Face Submitted',
        response?.data?.message ||
        'Your face image has been submitted and is awaiting verification.'
      );


      await loadIdentity();


    } catch (error: any) {

      console.log(
        '[FACE UPLOAD ERROR]',
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
        'Face Submission',
        getErrorMessage(
          error,
          'Unable to submit your face image.'
        )
      );


    } finally {

      setSubmittingFace(
        false
      );

    }

  }

  /*
  =======================================================
  LOADING
  =======================================================
  */

  if (loading && !identity) {

    return (

      <SafeAreaView
        style={
          styles.screen
        }
      >

        <View
          style={
            styles.loadingScreen
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
            Loading identity status...
          </Text>

        </View>

      </SafeAreaView>

    );

  }


  /*
  =======================================================
  DERIVED STATE
  =======================================================
  */

  const ninVerified =
    identity?.ninVerified === true;


  const faceVerified =
    identity?.faceVerified === true;


  const identityVerified =
    identity?.identityVerified === true;


  const faceStatus =
    identity?.faceStatus ||
    'pending';


  /*
  =======================================================
  UI
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
              Identity & Security
            </Text>

          </View>

        </View>


        {/* SECURITY INTRO */}

        <View
          style={
            styles.introCard
          }
        >

          <View
            style={
              styles.securityIcon
            }
          >

            <Text
              style={
                styles.securityIconText
              }
            >
              ✓
            </Text>

          </View>


          <View
            style={
              styles.introContent
            }
          >

            <Text
              style={
                styles.introTitle
              }
            >
              Protecting you and our riders
            </Text>


            <Text
              style={
                styles.introText
              }
            >
              Kaduna Only uses identity verification
              to help maintain a trusted driver network.
            </Text>

          </View>

        </View>


        {/* OVERALL STATUS */}

        <View
          style={[
            styles.statusCard,
            identityVerified
              ? styles.statusCardVerified
              : styles.statusCardPending,
          ]}
        >

          <View
            style={[
              styles.statusCircle,
              identityVerified
                ? styles.statusCircleVerified
                : styles.statusCirclePending,
            ]}
          >

            <Text
              style={
                styles.statusCircleText
              }
            >
              {identityVerified
                ? '✓'
                : '!'}
            </Text>

          </View>


          <View
            style={
              styles.statusContent
            }
          >

            <Text
              style={
                styles.statusLabel
              }
            >
              Identity Status
            </Text>


            <Text
              style={
                styles.statusTitle
              }
            >
              {identityVerified
                ? 'Fully Verified'
                : 'Verification Required'}
            </Text>


            <Text
              style={
                styles.statusDescription
              }
            >
              {identityVerified
                ? 'Your NIN and face verification have been approved.'
                : 'Complete both identity checks before going online.'}
            </Text>

          </View>

        </View>


        {/* NIN SECTION */}

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
            NIN Verification
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            National Identification Number
          </Text>

        </View>


        <View
          style={
            styles.card
          }
        >

          <View
            style={
              styles.cardHeader
            }
          >

            <View
              style={
                styles.cardIcon
              }
            >

              <Text
                style={
                  styles.cardIconText
                }
              >
                ID
              </Text>

            </View>


            <View
              style={
                styles.cardHeaderContent
              }
            >

              <Text
                style={
                  styles.cardTitle
                }
              >
                NIN
              </Text>


              <Text
                style={
                  styles.cardDescription
                }
              >
                {ninVerified
                  ? 'Your NIN has been verified.'
                  : identity?.ninSubmitted
                    ? 'Your NIN is awaiting administrator verification.'
                    : 'Submit your 11-digit NIN for verification.'}
              </Text>

            </View>


            <View
              style={[
                styles.badge,
                ninVerified
                  ? styles.badgeVerified
                  : styles.badgePending,
              ]}
            >

              <Text
                style={[
                  styles.badgeText,
                  ninVerified
                    ? styles.badgeTextVerified
                    : styles.badgeTextPending,
                ]}
              >
                {ninVerified
                  ? 'Verified'
                  : identity?.ninSubmitted
                    ? 'Pending'
                    : 'Required'}
              </Text>

            </View>

          </View>


          {!ninVerified &&
            !identity?.ninSubmitted && (

            <View
              style={
                styles.formArea
              }
            >

              <Text
                style={
                  styles.inputLabel
                }
              >
                Enter your NIN
              </Text>


              <TextInput
                value={
                  nin
                }

                onChangeText={
                  value =>
                    setNin(
                      value
                        .replace(/\D/g, '')
                        .slice(0, 11)
                    )
                }

                keyboardType="number-pad"

                maxLength={
                  11
                }

                placeholder="11-digit NIN"

                placeholderTextColor="#999999"

                style={
                  styles.input
                }

                editable={
                  !submittingNIN
                }
              />


              <Text
                style={
                  styles.helperText
                }
              >
                Your NIN is securely stored and is not
                displayed in full in administrative views.
              </Text>


              <Pressable
                onPress={
                  submitNIN
                }

                disabled={
                  submittingNIN
                }

                style={[
                  styles.primaryButton,
                  submittingNIN &&
                    styles.disabledButton,
                ]}
              >

                {submittingNIN ? (

                  <ActivityIndicator
                    color={
                      BrandColors.white
                    }
                  />

                ) : (

                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Submit NIN
                  </Text>

                )}

              </Pressable>

            </View>

          )}


          {identity?.ninSubmitted &&
            !ninVerified && (

            <View
              style={
                styles.pendingBox
              }
            >

              <Text
                style={
                  styles.pendingText
                }
              >
                Your NIN has been submitted and is
                awaiting verification by Kaduna Only.
              </Text>

            </View>

          )}

        </View>

        {/* =================================================
            FACE VERIFICATION
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
            Face Verification
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            Confirm that you are the registered driver
          </Text>

        </View>


        <View
          style={
            styles.card
          }
        >

          {/* FACE CARD HEADER */}

          <View
            style={
              styles.cardHeader
            }
          >

            <View
              style={
                styles.faceIcon
              }
            >

              <Text
                style={
                  styles.faceIconText
                }
              >
                FACE
              </Text>

            </View>


            <View
              style={
                styles.cardHeaderContent
              }
            >

              <Text
                style={
                  styles.cardTitle
                }
              >
                Face Verification
              </Text>


              <Text
                style={
                  styles.cardDescription
                }
              >
                {faceVerified
                  ? 'Your face has been verified.'
                  : faceStatus === 'failed'
                    ? 'Your face verification failed. Please submit a new image.'
                    : identity?.faceSubmitted
                      ? 'Your face image is awaiting verification.'
                      : 'A clear face image is required.'}
              </Text>

            </View>


            <View
              style={[
                styles.badge,
                faceVerified
                  ? styles.badgeVerified
                  : faceStatus === 'failed'
                    ? styles.badgeFailed
                    : styles.badgePending,
              ]}
            >

              <Text
                style={[
                  styles.badgeText,
                  faceVerified
                    ? styles.badgeTextVerified
                    : faceStatus === 'failed'
                      ? styles.badgeTextFailed
                      : styles.badgeTextPending,
                ]}
              >
                {faceVerified
                  ? 'Verified'
                  : faceStatus === 'failed'
                    ? 'Failed'
                    : identity?.faceSubmitted
                      ? 'Pending'
                      : 'Required'}
              </Text>

            </View>

          </View>


          {/* =================================================
              VERIFIED STATE
          ================================================= */}

          {faceVerified && (

            <View
              style={
                styles.verifiedBox
              }
            >

              <Text
                style={
                  styles.verifiedText
                }
              >
                Your face identity has been successfully
                verified by Kaduna Only.
              </Text>

            </View>

          )}


          {/* =================================================
              CAPTURED FACE PREVIEW
          ================================================= */}

          {!faceVerified &&
            capturedFaceUri && (

            <View
              style={
                styles.facePreviewContainer
              }
            >

              <Image
                source={{
                  uri:
                    capturedFaceUri,
                }}

                style={
                  styles.facePreview
                }

                resizeMode="cover"
              />


              <Text
                style={
                  styles.previewTitle
                }
              >
                Face photo captured
              </Text>


              <Text
                style={
                  styles.previewDescription
                }
              >
                Review your photo before submitting it
                for administrator verification.
              </Text>


              <View
                style={
                  styles.previewActions
                }
              >

                <Pressable
                  onPress={
                    retakeFace
                  }

                  disabled={
                    submittingFace
                  }

                  style={
                    styles.retakeButton
                  }
                >

                  <Text
                    style={
                      styles.retakeButtonText
                    }
                  >
                    Retake
                  </Text>

                </Pressable>


                <Pressable
                  onPress={
                    submitFace
                  }

                  disabled={
                    submittingFace
                  }

                  style={[
                    styles.primaryButton,
                    submittingFace &&
                      styles.disabledButton,
                  ]}
                >

                  {submittingFace ? (

                    <ActivityIndicator
                      color={
                        BrandColors.white
                      }
                    />

                  ) : (

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Submit Face
                    </Text>

                  )}

                </Pressable>

              </View>

            </View>

          )}


          {/* =================================================
              PENDING STATE
          ================================================= */}

          {!faceVerified &&
            identity?.faceSubmitted &&
            !capturedFaceUri &&
            faceStatus !== 'failed' && (

            <View
              style={
                styles.pendingBox
              }
            >

              <Text
                style={
                  styles.pendingText
                }
              >
                Your face image has been submitted and is
                awaiting verification by Kaduna Only.
              </Text>


              <Pressable
                onPress={
                  loadIdentity
                }

                disabled={
                  loading
                }

                style={
                  styles.secondaryButton
                }
              >

                {loading ? (

                  <ActivityIndicator
                    color={
                      BrandColors.primary
                    }
                  />

                ) : (

                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    Refresh Status
                  </Text>

                )}

              </Pressable>

            </View>

          )}


          {/* =================================================
              REQUIRED / FAILED STATE
          ================================================= */}

          {!faceVerified &&
            (
              !identity?.faceSubmitted ||
              faceStatus === 'failed'
            ) &&
            !capturedFaceUri && (

            <View
              style={
                styles.faceActionArea
              }
            >

              <Text
                style={
                  styles.cameraInstruction
                }
              >
                Take a clear photo of your face. Use good
                lighting, face the camera directly, and make
                sure nothing is covering your face.
              </Text>


              <Pressable
                onPress={
                  openFaceCamera
                }

                style={
                  styles.primaryButton
                }
              >

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  {faceStatus === 'failed'
                    ? 'Take New Face Photo'
                    : 'Verify My Face'}
                </Text>

              </Pressable>

            </View>

          )}

        </View>


        {/* =================================================
            SECURITY NOTICE
        ================================================= */}

        <View
          style={
            styles.noticeCard
          }
        >

          <Text
            style={
              styles.noticeTitle
            }
          >
            Important
          </Text>


          <Text
            style={
              styles.noticeText
            }
          >
            Your face image is submitted securely to the
            Kaduna Only for administrator verification.
            Completing this step does not automatically approve
            your identity.
          </Text>

        </View>


        {/* =================================================
            REFRESH STATUS
        ================================================= */}

        <Pressable
          onPress={
            loadIdentity
          }

          disabled={
            loading
          }

          style={
            styles.refreshButton
          }
        >

          {loading ? (

            <ActivityIndicator
              color={
                BrandColors.primary
              }
            />

          ) : (

            <Text
              style={
                styles.refreshText
              }
            >
              Refresh Verification Status
            </Text>

          )}

        </Pressable>


        {/* =================================================
            FOOTER
        ================================================= */}

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
            Kaduna Only • Driver Security
          </Text>

        </View>

      </ScrollView>


      {/* =================================================
          FULL SCREEN FACE CAMERA
      ================================================= */}

      {cameraVisible && (

        <View
          style={
            styles.cameraScreen
          }
        >

          <CameraView
            ref={
              cameraRef
            }

            style={
              styles.camera
            }

            facing="front"

            onCameraReady={() =>
              setCameraReady(
                true
              )
            }
          >

            <View
              style={
                styles.cameraOverlay
              }
            >

              {/* CAMERA TOP BAR */}

              <View
                style={
                  styles.cameraTopBar
                }
              >

                <Text
                  style={
                    styles.cameraTitle
                  }
                >
                  Face Verification
                </Text>


                <Pressable
                  onPress={() => {

                    setCameraVisible(
                      false
                    );

                    setCameraReady(
                      false
                    );

                  }}

                  style={
                    styles.cameraCloseButton
                  }
                >

                  <Text
                    style={
                      styles.cameraCloseText
                    }
                  >
                    Close
                  </Text>

                </Pressable>

              </View>


              {/* FACE GUIDE */}

              <View
                style={
                  styles.faceGuideArea
                }
              >

                <View
                  style={
                    styles.faceGuide
                  }
                />

              </View>


              {/* CAMERA INSTRUCTIONS */}

              <View
                style={
                  styles.cameraInstructionBox
                }
              >

                <Text
                  style={
                    styles.cameraInstructionTitle
                  }
                >
                  Position your face inside the frame
                </Text>


                <Text
                  style={
                    styles.cameraInstructionText
                  }
                >
                  Look directly at the camera. Keep your
                  entire face visible and stay still.
                </Text>

              </View>


              {/* CAPTURE */}

              <View
                style={
                  styles.cameraBottomBar
                }
              >

                <Pressable
                  onPress={
                    captureFace
                  }

                  disabled={
                    !cameraReady
                  }

                  style={[
                    styles.captureButton,
                    !cameraReady &&
                      styles.captureButtonDisabled,
                  ]}
                >

                  <View
                    style={
                      styles.captureButtonInner
                    }
                  />

                </Pressable>


                <Text
                  style={
                    styles.captureHint
                  }
                >
                  {cameraReady
                    ? 'Tap to capture'
                    : 'Starting camera...'}
                </Text>

              </View>

            </View>

          </CameraView>

        </View>

      )}

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


    loadingScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },


    loadingText: {
      marginTop: 12,
      color:
        BrandColors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },


    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 18,
    },


    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        BrandColors.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 1,
      borderColor: '#ECEAF2',
    },


    backText: {
      fontSize: 29,
      lineHeight: 31,
      color:
        BrandColors.text,
      fontWeight: '500',
    },


    headerText: {
      flex: 1,
    },


    brand: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      color:
        BrandColors.primary,
    },


    title: {
      marginTop: 2,
      fontSize: 22,
      fontWeight: '900',
      color:
        BrandColors.text,
    },


    introCard: {
      backgroundColor:
        BrandColors.primaryLight,
      borderRadius: 18,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },


    securityIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },


    securityIconText: {
      color:
        BrandColors.white,
      fontSize: 20,
      fontWeight: '900',
    },


    introContent: {
      flex: 1,
    },


    introTitle: {
      color:
        BrandColors.text,
      fontSize: 14,
      fontWeight: '900',
    },


    introText: {
      marginTop: 4,
      color:
        BrandColors.textSecondary,
      fontSize: 11,
      lineHeight: 17,
    },


    statusCard: {
      borderRadius: 18,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      marginBottom: 24,
    },


    statusCardVerified: {
      backgroundColor: '#F0FBF4',
      borderColor: '#CFEAD8',
    },


    statusCardPending: {
      backgroundColor: '#FFF9EC',
      borderColor: '#F0DFB0',
    },


    statusCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 13,
    },


    statusCircleVerified: {
      backgroundColor: '#1B9E55',
    },


    statusCirclePending: {
      backgroundColor: '#D99A19',
    },


    statusCircleText: {
      color:
        BrandColors.white,
      fontSize: 21,
      fontWeight: '900',
    },


    statusContent: {
      flex: 1,
    },


    statusLabel: {
      color:
        BrandColors.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },


    statusTitle: {
      marginTop: 2,
      color:
        BrandColors.text,
      fontSize: 17,
      fontWeight: '900',
    },


    statusDescription: {
      marginTop: 4,
      color:
        BrandColors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
    },


    sectionHeader: {
      marginBottom: 9,
    },


    sectionTitle: {
      color:
        BrandColors.text,
      fontSize: 15,
      fontWeight: '900',
    },


    sectionSubtitle: {
      marginTop: 2,
      color:
        BrandColors.textSecondary,
      fontSize: 10,
      fontWeight: '600',
    },


    card: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 18,
      padding: 16,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: '#ECEAF2',
    },


    facePreviewContainer: {
      marginBottom: 22,
      padding: 16,
      borderRadius: 18,
      backgroundColor: BrandColors.white,
      borderWidth: 1,
      borderColor: '#ECEAF2',
    },


    facePreview: {
      width: '100%',
      height: 220,
      borderRadius: 14,
      backgroundColor: '#F6F6F8',
      marginBottom: 14,
    },


    previewTitle: {
      color: BrandColors.text,
      fontSize: 14,
      fontWeight: '900',
    },


    previewDescription: {
      marginTop: 4,
      color: BrandColors.textSecondary,
      fontSize: 10,
      lineHeight: 15,
    },


    previewActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
    },


    retakeButton: {
      height: 50,
      paddingHorizontal: 16,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },


    retakeButtonText: {
      color: BrandColors.primary,
      fontSize: 12,
      fontWeight: '900',
    },


    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },


    cardIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    cardIconText: {
      color:
        BrandColors.primary,
      fontSize: 11,
      fontWeight: '900',
    },


    faceIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },


    faceIconText: {
      color:
        BrandColors.primary,
      fontSize: 22,
      fontWeight: '900',
    },


    cardHeaderContent: {
      flex: 1,
    },


    cardTitle: {
      color:
        BrandColors.text,
      fontSize: 14,
      fontWeight: '900',
    },


    cardDescription: {
      marginTop: 3,
      color:
        BrandColors.textSecondary,
      fontSize: 10,
      lineHeight: 15,
    },


    badge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 20,
      marginLeft: 8,
    },


    badgeVerified: {
      backgroundColor: '#E7F7ED',
    },


    badgePending: {
      backgroundColor: '#FFF3D8',
    },


    badgeFailed: {
      backgroundColor: '#FDE8E8',
    },


    badgeText: {
      fontSize: 9,
      fontWeight: '900',
    },


    badgeTextVerified: {
      color: '#168548',
    },


    badgeTextPending: {
      color: '#A56E00',
    },


    badgeTextFailed: {
      color: '#C53030',
    },


    formArea: {
      marginTop: 18,
    },


    faceActionArea: {
      marginTop: 18,
    },


    cameraInstruction: {
      color: BrandColors.textSecondary,
      fontSize: 10,
      lineHeight: 15,
    },


    inputLabel: {
      color:
        BrandColors.text,
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 7,
    },


    input: {
      height: 52,
      borderWidth: 1,
      borderColor: '#DDD9E7',
      borderRadius: 13,
      paddingHorizontal: 14,
      color:
        BrandColors.text,
      backgroundColor: '#FAFAFC',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 1,
    },


    helperText: {
      marginTop: 7,
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      lineHeight: 14,
    },


    primaryButton: {
      height: 50,
      borderRadius: 13,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },


    primaryButtonText: {
      color:
        BrandColors.white,
      fontSize: 13,
      fontWeight: '900',
    },


    disabledButton: {
      opacity: 0.55,
    },


    pendingBox: {
      marginTop: 15,
      padding: 12,
      borderRadius: 12,
      backgroundColor: '#FFF9EC',
    },


    verifiedBox: {
      marginTop: 15,
      padding: 12,
      borderRadius: 12,
      backgroundColor: '#F0FBF4',
      borderWidth: 1,
      borderColor: '#CFEAD8',
    },


    verifiedText: {
      color: '#168548',
      fontSize: 10,
      lineHeight: 15,
      fontWeight: '600',
    },


    pendingText: {
      color: '#8A6500',
      fontSize: 10,
      lineHeight: 15,
      fontWeight: '600',
    },


    secondaryButton: {
      height: 48,
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },


    secondaryButtonText: {
      color:
        BrandColors.primary,
      fontSize: 12,
      fontWeight: '900',
    },


    noticeCard: {
      backgroundColor:
        '#F6F6F8',
      borderRadius: 16,
      padding: 15,
      marginBottom: 15,
    },


    noticeTitle: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '900',
      marginBottom: 5,
    },


    noticeText: {
      color:
        BrandColors.textSecondary,
      fontSize: 10,
      lineHeight: 15,
    },


    refreshButton: {
      minHeight: 45,
      alignItems: 'center',
      justifyContent: 'center',
    },


    refreshText: {
      color:
        BrandColors.primary,
      fontSize: 11,
      fontWeight: '900',
    },


    footer: {
      alignItems: 'center',
      marginTop: 18,
    },


    footerText: {
      color:
        BrandColors.textSecondary,
      fontSize: 9,
      fontWeight: '600',
    },


    cameraScreen: {
      ...StyleSheet.absoluteFill,
      backgroundColor: '#000000',
    },


    camera: {
      flex: 1,
    },


    cameraOverlay: {
      flex: 1,
      justifyContent: 'space-between',
    },


    cameraCloseText: {
      color: BrandColors.white,
      fontSize: 12,
      fontWeight: '800',
    },


    faceGuideArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },


    faceGuide: {
      width: 230,
      height: 300,
      borderRadius: 115,
      borderWidth: 3,
      borderColor: BrandColors.white,
    },


    cameraInstructionBox: {
      marginHorizontal: 24,
      padding: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },


    cameraInstructionTitle: {
      color: BrandColors.white,
      fontSize: 13,
      fontWeight: '900',
      textAlign: 'center',
    },


    cameraInstructionText: {
      marginTop: 5,
      color: BrandColors.white,
      fontSize: 11,
      lineHeight: 16,
      textAlign: 'center',
    },


    cameraBottomBar: {
      alignItems: 'center',
      paddingTop: 18,
      paddingBottom: 28,
    },


    captureButton: {
      width: 74,
      height: 74,
      borderRadius: 37,
      borderWidth: 4,
      borderColor: BrandColors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },


    captureButtonDisabled: {
      opacity: 0.5,
    },


    captureButtonInner: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor:
        BrandColors.white,
    },


    cameraTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 16,
    },


    cameraCloseButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },


    cameraTitle: {
      color:
        BrandColors.white,
      fontSize: 15,
      fontWeight: '900',
    },


    captureHint: {
      marginTop: 10,
      color:
        BrandColors.white,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },

  });