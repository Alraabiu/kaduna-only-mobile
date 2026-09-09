import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
} from '../services/api';

import {
  getStoredToken,
  getStoredUser,
  saveAuth,
} from '../storage/auth';

import {
  BrandColors,
} from '../constants/theme';

import * as ImagePicker from 'expo-image-picker';


/*
=========================================================
TYPES
=========================================================
*/

type User = {

  id?: string;

  _id?: string;

  fullName?: string;

  email?: string;

  phone?: string;

  role?: string;

  status?: string;


  // DRIVER DETAILS

  vehicleMake?: string;

  vehicleModel?: string;

  vehicleColor?: string;

  plateNumber?: string;

  driverLicenceNumber?: string;

  vehicleType?: string;

  verificationStatus?: string;

  driverImage?: string;

};

/*
=========================================================
PROFILE SCREEN
=========================================================
*/

export default function Profile() {

  const [
    user,
    setUser
  ] = useState<User | null>(
    null
  );

  const [
    fullName,
    setFullName
  ] = useState('');

  const [
    email,
    setEmail
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    refreshing,
    setRefreshing
  ] = useState(false);

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    editing,
    setEditing
  ] = useState(false);

  const [
  vehicleMake,
  setVehicleMake
] = useState('');

const [
  vehicleModel,
  setVehicleModel
] = useState('');

const [
  vehicleType,
  setVehicleType
] = useState('');

const [
  plateNumber,
  setPlateNumber
] = useState('');

const [
  driverLicenceNumber,
  setDriverLicenceNumber
] = useState('');

const [driverImage, setDriverImage] = useState('');

  /*
  =======================================================
  AUTHENTICATION
  =======================================================
  */

  async function prepareAuthentication() {

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
  }


/*
=======================================================
LOAD PROFILE
=======================================================
*/

const loadProfile =
  useCallback(
    async (
      showLoader = true
    ) => {

      try {

        if (showLoader) {

          setLoading(true);

        }


        console.log(
          '[PROFILE] Loading profile'
        );


        const authenticated =
          await prepareAuthentication();


        if (!authenticated) {

          return;

        }


        const storedUser =
          await getStoredUser();


        const role =
          String(
            storedUser?.role || ''
          ).toLowerCase();


        const isDriver =
          role === 'driver';


        const endpoint =
          isDriver
            ? '/drivers/me'
            : '/rider/profile';



        const response =
          await api.get(
            endpoint
          );


        console.log(
          '[PROFILE] Profile response',
          {
            role,
            endpoint,
          }
        );



        const data =
          response?.data?.data ||
          null;



        let profileUser =
          null;



        /*
        ===============================================
        DRIVER RESPONSE
        /drivers/me

        {
          profile:{
             user:{
                fullName,
                email,
                phone
             }
          }
        }
        ===============================================
        */


        if (isDriver) {


          profileUser =
            data?.profile?.user ||
            data?.user ||
            null;


        }


        /*
        ===============================================
        RIDER RESPONSE
        /rider/profile

        {
          user:{
             fullName,
             email,
             phone
          }
        }

        ===============================================
        */


        else {


          profileUser =
            data?.user ||
            data ||
            null;


        }



        if (!profileUser) {


          throw new Error(
            'Profile data was not returned by server.'
          );


        }



        setUser(
          {

            ...profileUser,

            role:
              profileUser.role ||
              role,

          }
        );



        setFullName(
          profileUser.fullName ||
          ''
        );



        setEmail(
          profileUser.email ||
          ''
        );

        setVehicleMake(
  profileUser.vehicleMake ||
  ''
);

setVehicleModel(
  profileUser.vehicleModel ||
  ''
);

setVehicleType(
  profileUser.vehicleType ||
  ''
);

setPlateNumber(
  profileUser.plateNumber ||
  ''
);

setDriverLicenceNumber(
  profileUser.driverLicenceNumber ||
  ''
);

setDriverImage(
  profileUser.driverImage ||
  ''
);



      } catch (
        error:any
      ) {


        console.log(
          '[PROFILE ERROR]',
          error
        );



        const status =
          error?.response?.status;



        if (
          status === 401
        ) {


          setAuthToken();


          Alert.alert(
            'Session expired',
            'Please login again.',
            [
              {

                text:'OK',

                onPress:() =>
                  router.replace(
                    '/login'
                  ),

              },
            ]
          );


          return;


        }



        Alert.alert(
          'Unable to load profile',

          error?.response?.data?.message ||
          error?.message ||
          'Please try again.'
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
  LOAD PROFILE WHEN SCREEN OPENS
  =======================================================
  */

  useFocusEffect(
    useCallback(() => {

      loadProfile();

    }, [loadProfile])
  );


  /*
  =======================================================
  REFRESH
  =======================================================
  */

  async function refreshProfile() {

    setRefreshing(true);

    await loadProfile(
      false
    );

  }


  async function pickDriverImage() {

  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();


  if (!permission.granted) {

    Alert.alert(
      'Permission required',
      'Please allow access to your gallery.'
    );

    return;

  }

  const result =
    await ImagePicker.launchImageLibraryAsync({

      mediaTypes:
        ImagePicker.MediaTypeOptions.Images,

      allowsEditing:true,

      aspect:[
        1,
        1
      ],

      quality:0.8

    });


  if (!result.canceled) {

  const image =
    result.assets[0];


  const formData =
    new FormData();


  formData.append(
    'driverImage',
    {
      uri: image.uri,

      name:
        image.fileName ||
        `driver-${Date.now()}.jpg`,

      type:
        image.mimeType ||
        'image/jpeg'

    } as any
  );


  try {


    const response =
      await api.post(

        '/upload/driver-image',

        formData,

        {
          headers:{
            'Content-Type':
              'multipart/form-data'
          }
        }

      );


    const uploadedImage =
      response?.data?.data?.driverImage;


    if(uploadedImage){

      setDriverImage(
        uploadedImage
      );

    }


    Alert.alert(
      'Success',
      'Driver image uploaded successfully'
    );


  } catch(error:any){


    console.log(
      '[IMAGE UPLOAD ERROR]',
      error
    );


    Alert.alert(
      'Upload failed',
      error?.response?.data?.message ||
      'Unable to upload image'
    );

  }

}

}
  /*
  =======================================================
  SAVE PROFILE
  =======================================================
  */

  async function saveProfile() {

    const cleanName =
      fullName.trim();

    const cleanEmail =
      email.trim().toLowerCase();


    if (!cleanName) {

      Alert.alert(
        'Full name required',
        'Please enter your full name.'
      );

      return;
    }


    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {

      Alert.alert(
        'Invalid email',
        'Please enter a valid email address.'
      );

      return;
    }


    try {

      setSaving(true);


      console.log(
        '[RIDER PROFILE] Updating profile'
      );


      const authenticated =
        await prepareAuthentication();

      if (!authenticated) {
        return;
      }


     const user =
  await getStoredUser();


const storedUser =
  await getStoredUser();


const role =
  String(
    storedUser?.role || ''
  ).toLowerCase();



const response =
  await api.patch(

    role === 'driver'
      ? '/drivers/me'
      : '/rider/profile',

    {
  fullName:
    cleanName,

  email:
    cleanEmail,


  ...(role === 'driver' && {

    vehicleMake:
      vehicleMake.trim(),

    vehicleModel:
      vehicleModel.trim(),

    vehicleType:
      vehicleType.trim() || undefined,

    plateNumber:
      plateNumber.trim(),

    driverLicenceNumber:
      driverLicenceNumber.trim(),

    driverImage:
      driverImage,

})
}

  );

      console.log(
        '[RIDER PROFILE] Profile updated'
      );


      const responseData =
  response?.data?.data;



const updatedUser =
  responseData?.profile?.user ||
  responseData?.user ||
  responseData;

      if (updatedUser) {

        setUser(
          updatedUser
        );

        setFullName(
          updatedUser.fullName ||
          cleanName
        );

        setEmail(
          updatedUser.email ||
          cleanEmail
        );

      }


      setEditing(
        false
      );


      Alert.alert(
        'Profile updated',
        'Your profile has been updated successfully.'
      );


    } catch (
      error: any
    ) {

      console.log(
        '[RIDER PROFILE UPDATE ERROR]',
        error
      );


      const status =
        error?.response?.status;


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


      Alert.alert(
        'Update failed',
        error?.response?.data?.message ||
        error?.message ||
        'Unable to update your profile.'
      );


    } finally {

      setSaving(false);

    }

  }


  /*
  =======================================================
  CANCEL EDIT
  =======================================================
  */

  function cancelEdit() {

    setFullName(
      user?.fullName ||
      ''
    );

    setEmail(
      user?.email ||
      ''
    );

    setEditing(
      false
    );

  }


  /*
  =======================================================
  LOGOUT
  =======================================================
  */

  function logout() {

    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Log out',
          style: 'destructive',

          onPress: async () => {

            try {

              setAuthToken();

              /*
               * Clear the local authentication
               * if the storage implementation
               * supports the existing logout flow.
               *
               * We deliberately do not invent
               * another storage API here.
               */

              router.replace(
                '/login'
              );

            } catch (error) {

              console.log(
                '[RIDER PROFILE LOGOUT ERROR]',
                error
              );

              router.replace(
                '/login'
              );

            }

          },
        },
      ]
    );

  }


  /*
  =======================================================
  AVATAR INITIAL
  =======================================================
  */

  function getInitial() {

    const name =
      user?.fullName ||
      fullName ||
      'R';

    return name
      .trim()
      .charAt(0)
      .toUpperCase();

  }


  /*
  =======================================================
  LOADING
  =======================================================
  */

  if (loading) {

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
          Loading your profile...
        </Text>

      </View>

    );

  }


  /*
  =======================================================
  MAIN SCREEN
  =======================================================
  */

  return (

    <KeyboardAvoidingView
      style={
        styles.screen
      }

      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
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
              refreshProfile
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
              Profile
            </Text>

          </View>


          {!editing && (

            <Pressable
              onPress={() =>
                setEditing(
                  true
                )
              }

              style={
                styles.editButton
              }
            >

              <Text
                style={
                  styles.editButtonText
                }
              >
                Edit
              </Text>

            </Pressable>

          )}

        </View>


        {/* =================================================
            PROFILE HERO
        ================================================= */}

        <View
          style={
            styles.profileHero
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
              {getInitial()}
            </Text>

          </View>


          <Text
            style={
              styles.profileName
            }
          >
            {user?.fullName ||
              'Rider'}
          </Text>


          <Text
            style={
              styles.profileEmail
            }
          >
            {user?.email ||
              'No email address'}
          </Text>


          <View
            style={
              styles.statusBadge
            }
          >

            <View
              style={
                styles.statusDot
              }
            />

            <Text
              style={
                styles.statusText
              }
            >
              {user?.status ===
              'active'
                ? 'Active account'
                : user?.status ||
                  'Account'}
            </Text>

          </View>

        </View>


        {/* =================================================
            PERSONAL INFORMATION
        ================================================= */}

        <View
          style={
            styles.section
          }
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            Personal Information
          </Text>


          <View
            style={
              styles.card
            }
          >

            {/* FULL NAME */}

            <View
              style={
                styles.field
              }
            >

              <Text
                style={
                  styles.fieldLabel
                }
              >
                FULL NAME
              </Text>


              {editing ? (

                <TextInput
                  value={
                    fullName
                  }

                  onChangeText={
                    setFullName
                  }

                  placeholder="Enter your full name"

                  placeholderTextColor="#A0A0A0"

                  style={
                    styles.input
                  }

                  autoCapitalize="words"

                  editable={
                    !saving
                  }
                />

              ) : (

                <Text
                  style={
                    styles.fieldValue
                  }
                >
                  {user?.fullName ||
                    'Not provided'}
                </Text>

              )}

            </View>


            {/* EMAIL */}

            <View
              style={
                styles.field
              }
            >

              <Text
                style={
                  styles.fieldLabel
                }
              >
                EMAIL ADDRESS
              </Text>


              {editing ? (

                <TextInput
                  value={
                    email
                  }

                  onChangeText={
                    setEmail
                  }

                  placeholder="Enter your email"

                  placeholderTextColor="#A0A0A0"

                  style={
                    styles.input
                  }

                  keyboardType="email-address"

                  autoCapitalize="none"

                  autoCorrect={false}

                  editable={
                    !saving
                  }
                />

              ) : (

                <Text
                  style={
                    styles.fieldValue
                  }
                >
                  {user?.email ||
                    'Not provided'}
                </Text>

              )}

            </View>


            {/* PHONE */}

            <View
              style={
                styles.field
              }
            >

              <Text
                style={
                  styles.fieldLabel
                }
              >
                PHONE NUMBER
              </Text>


              <Text
                style={
                  styles.fieldValue
                }
              >
                {user?.phone ||
                  'Not provided'}
              </Text>


              {editing && (

                <Text
                  style={
                    styles.helperText
                  }
                >
                  Phone number is managed
                  from your account.
                </Text>

              )}

            </View>

          </View>

        </View>


        {/* =================================================
            DRIVER INFORMATION
        ================================================= */}

        {
          user?.role === 'driver' && (

<View
style={
  styles.section
}
>

<Text
style={
 styles.sectionTitle
}
>
Driver Information
</Text>


<View
style={
 styles.accountCard
}
>

{/* DRIVER IMAGE */}

<View
  style={
    styles.field
  }
>

<Text
  style={
    styles.fieldLabel
  }
>
DRIVER IMAGE
</Text>


{
editing ? (

<Pressable

onPress={
  pickDriverImage
}

style={{
  height:120,
  width:120,
  borderRadius:60,
  backgroundColor:'#F5F5F5',
  alignItems:'center',
  justifyContent:'center',
  overflow:'hidden'
}}

>


{
driverImage

?

<Image

source={{
uri: driverImage
}}

style={{
height:120,
width:120,
borderRadius:60
}}

/>


:

<Text>
Upload Image
</Text>

}


</Pressable>


)

:

(

user?.driverImage

?

<Image

source={{
uri:user.driverImage
}}

style={{
height:80,
width:80,
borderRadius:40
}}

/>

:

<Text
style={
styles.fieldValue
}
>
No image uploaded
</Text>

)

}


</View>

{/* VEHICLE TYPE */}

<View
style={
 styles.field
}
>

<Text
style={
 styles.fieldLabel
}
>
VEHICLE TYPE
</Text>


{
editing ? (

<TextInput
value={
 vehicleType
}

onChangeText={
 setVehicleType
}

placeholder="keke, car, bike"

placeholderTextColor="#999"

style={
 styles.input
}

/>

)

:(

<Text
style={
 styles.fieldValue
}
>
{
 user?.vehicleType ||
 'Not provided'
}
</Text>

)

}

</View>



{/* VEHICLE MAKE */}

<View
style={
 styles.field
}
>

<Text
style={
 styles.fieldLabel
}
>
VEHICLE MAKE
</Text>


{
editing ? (

<TextInput

value={
 vehicleMake
}

onChangeText={
 setVehicleMake
}

placeholder="Toyota, Bajaj"

placeholderTextColor="#999"

style={
 styles.input
}

/>

)

:

(

<Text
style={
 styles.fieldValue
}
>
{
 user?.vehicleMake ||
 'Not provided'
}
</Text>

)

}

</View>



{/* VEHICLE MODEL */}

<View
style={
 styles.field
}
>

<Text
style={
 styles.fieldLabel
}
>
VEHICLE MODEL
</Text>


{
editing ? (

<TextInput

value={
 vehicleModel
}

onChangeText={
 setVehicleModel
}

placeholder="Model"

placeholderTextColor="#999"

style={
 styles.input
}

/>

)

:

(

<Text
style={
 styles.fieldValue
}
>
{
 user?.vehicleModel ||
 'Not provided'
}
</Text>

)

}

</View>




{/* PLATE NUMBER */}

<View
style={
 styles.field
}
>

<Text
style={
 styles.fieldLabel
}
>
PLATE NUMBER
</Text>


{
editing ? (

<TextInput

value={
 plateNumber
}

onChangeText={
 setPlateNumber
}

placeholder="ABC123XY"

placeholderTextColor="#999"

style={
 styles.input
}

autoCapitalize="characters"

/>

)

:

(

<Text
style={
 styles.fieldValue
}
>
{
 user?.plateNumber ||
 'Not provided'
}
</Text>

)

}

</View>




{/* DRIVER LICENCE */}

<View
style={
 styles.field
}
>

<Text
style={
 styles.fieldLabel
}
>
DRIVER LICENCE NUMBER
</Text>


{
editing ? (

<TextInput

value={
 driverLicenceNumber
}

onChangeText={
 setDriverLicenceNumber
}

placeholder="Licence number"

placeholderTextColor="#999"

style={
 styles.input
}

autoCapitalize="characters"

/>

)

:

(

<Text
style={
 styles.fieldValue
}
>
{
 user?.driverLicenceNumber ||
 'Not provided'
}
</Text>

)

}

</View>



<View
style={
 styles.field
}
>

<Text
style={
 styles.fieldLabel
}
>
VERIFICATION STATUS
</Text>


<Text
style={
 styles.accountActive
}
>
{
user?.verificationStatus ||
'Pending'
}
</Text>


</View>


</View>

</View>

)
}

{/* =================================================
    IDENTITY & SECURITY
================================================= */}

{
  user?.role === 'driver' && (

    <View
      style={
        styles.section
      }
    >

      <Text
        style={
          styles.sectionTitle
        }
      >
        Identity & Security
      </Text>


      <Pressable
        onPress={() =>
          router.push(
            '/driver/identity' as any
          )
        }
        style={
          styles.accountCard
        }
      >

        <View
          style={
            styles.accountRow
          }
        >

          <View
            style={{
              flex: 1,
              paddingRight: 12,
            }}
          >

            <Text
              style={
                styles.accountLabel
              }
            >
              Identity Verification
            </Text>


            <Text
              style={[
                styles.helperText,
                {
                  marginTop: 4,
                },
              ]}
            >
              Verify your NIN and face
              to secure your driver account.
            </Text>

          </View>


          <Text
            style={
              styles.accountValue
            }
          >
            &gt;
          </Text>

        </View>

      </Pressable>

    </View>

  )
}
        {/* =================================================
            ACCOUNT INFORMATION
        ================================================= */}


        <View
          style={
            styles.section
          }
        >

          <Text
            style={
              styles.sectionTitle
            }
          >
            Account
          </Text>


          <View
            style={
              styles.accountCard
            }
          >

            <View
              style={
                styles.accountRow
              }
            >

              <Text
                style={
                  styles.accountLabel
                }
              >
                Account type
              </Text>


              <Text
                style={
                  styles.accountValue
                }
              >

                {
                  user?.role === 'driver'
                    ? 'Driver'
                    : user?.role === 'rider'
                      ? 'Rider'
                      : 'Unknown'
                }

              </Text>

            </View>



            <View
              style={
                styles.separator
              }
            />



            <View
              style={
                styles.accountRow
              }
            >

              <Text
                style={
                  styles.accountLabel
                }
              >
                Account status
              </Text>


              <Text
                style={
                  styles.accountActive
                }
              >

                {
                  user?.status === 'active'
                    ? 'Active'
                    : user?.status ||
                      'Unknown'
                }

              </Text>


            </View>


          </View>


        </View>
        {/* =================================================
            EDIT ACTIONS
        ================================================= */}

        {editing && (

          <View
            style={
              styles.editActions
            }
          >

            <Pressable
              onPress={
                cancelEdit
              }

              disabled={
                saving
              }

              style={
                styles.cancelButton
              }
            >

              <Text
                style={
                  styles.cancelText
                }
              >
                Cancel
              </Text>

            </Pressable>


            <Pressable
              onPress={
                saveProfile
              }

              disabled={
                saving
              }

              style={[
                styles.saveButton,

                saving &&
                  styles.disabledButton,
              ]}
            >

              {saving ? (

                <ActivityIndicator
                  color={
                    BrandColors.white
                  }
                  size="small"
                />

              ) : (

                <Text
                  style={
                    styles.saveText
                  }
                >
                  Save Changes
                </Text>

              )}

            </Pressable>

          </View>

        )}


        {/* =================================================
            LOGOUT
        ================================================= */}

        {!editing && (

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

        )}


        <Text
          style={
            styles.footer
          }
        >
          Kaduna Only
        </Text>


        <View
          style={
            styles.bottomSpace
          }
        />

      </ScrollView>

    </KeyboardAvoidingView>

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
      paddingBottom: 30,
    },


    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        BrandColors.background,
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


    editButton: {
      backgroundColor:
        BrandColors.primaryLight,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },


    editButtonText: {
      color:
        BrandColors.primary,
      fontSize: 11,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    PROFILE HERO
    -------------------------------------------------------
    */

    profileHero: {
      alignItems: 'center',
      backgroundColor:
        BrandColors.primary,
      borderRadius: 21,
      paddingVertical: 24,
      paddingHorizontal: 18,
      marginBottom: 25,
    },


    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor:
        BrandColors.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 11,
    },


    avatarText: {
      color:
        BrandColors.primary,
      fontSize: 27,
      fontWeight: '900',
    },


    profileName: {
      color:
        BrandColors.white,
      fontSize: 19,
      fontWeight: '900',
      textAlign: 'center',
    },


    profileEmail: {
      color: '#DED3F3',
      fontSize: 11,
      marginTop: 4,
      textAlign: 'center',
    },


    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        'rgba(255,255,255,0.14)',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 12,
    },


    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        BrandColors.success,
      marginRight: 6,
    },


    statusText: {
      color:
        BrandColors.white,
      fontSize: 9,
      fontWeight: '800',
    },


    /*
    -------------------------------------------------------
    SECTIONS
    -------------------------------------------------------
    */

    section: {
      marginBottom: 22,
    },


    sectionTitle: {
      color:
        BrandColors.text,
      fontSize: 17,
      fontWeight: '900',
      marginBottom: 10,
    },


    card: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      paddingHorizontal: 15,
    },


    field: {
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EEEEEE',
    },


    fieldLabel: {
      color:
        '#8A8A8A',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginBottom: 6,
    },


    fieldValue: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '600',
    },


    input: {
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '600',
      borderWidth: 1,
      borderColor:
        '#DDD9E7',
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 10,
      backgroundColor:
        '#FAFAFC',
    },


    helperText: {
      marginTop: 5,
      color:
        '#999999',
      fontSize: 9,
    },


    /*
    -------------------------------------------------------
    ACCOUNT
    -------------------------------------------------------
    */

    accountCard: {
      backgroundColor:
        BrandColors.white,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      paddingHorizontal: 15,
    },


    accountRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },


    accountLabel: {
      color:
        BrandColors.textSecondary,
      fontSize: 11,
    },


    accountValue: {
      color:
        BrandColors.text,
      fontSize: 11,
      fontWeight: '800',
    },


    accountActive: {
      color:
        BrandColors.success,
      fontSize: 11,
      fontWeight: '900',
    },


    separator: {
      height: 1,
      backgroundColor:
        '#EEEEEE',
    },


    /*
    -------------------------------------------------------
    EDIT ACTIONS
    -------------------------------------------------------
    */

    editActions: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },


    cancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor:
        BrandColors.border,
      borderRadius: 12,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        BrandColors.white,
    },


    cancelText: {
      color:
        BrandColors.text,
      fontSize: 12,
      fontWeight: '800',
    },


    saveButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        BrandColors.primary,
    },


    disabledButton: {
      opacity: 0.65,
    },


    saveText: {
      color:
        BrandColors.white,
      fontSize: 12,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    LOGOUT
    -------------------------------------------------------
    */

    logoutButton: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#F1D4D1',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        '#FFF9F8',
      marginTop: 2,
    },


    logoutText: {
      color:
        BrandColors.danger,
      fontSize: 12,
      fontWeight: '900',
    },


    footer: {
      textAlign: 'center',
      color:
        '#AAAAAA',
      fontSize: 9,
      marginTop: 22,
    },


    bottomSpace: {
      height: 20,
    },

  });