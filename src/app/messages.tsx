import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
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
} from '../storage/auth';

import {
  BrandColors,
} from '../constants/theme';


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
  role?: string;
  status?: string;
};

type Trip = {
  _id?: string;
  tripId?: string;
  status?: string;
};

type Message = {
  _id: string;
  text: string;
  read: boolean;
  createdAt: string;
  sender?: User;
  recipient?: User;
  trip?: Trip | null;
};

type Conversation = {
  key: string;
  user?: User;
  trip?: Trip | null;
  lastMessage?: Message;
  unreadCount?: number;
};


/*
=========================================================
HELPERS
=========================================================
*/

function getUserId(user?: User) {
  return user?._id || user?.id || '';
}


function formatTime(dateString?: string) {

  if (!dateString) {
    return '';
  }

  const date =
    new Date(dateString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  );
}


function formatDate(dateString?: string) {

  if (!dateString) {
    return '';
  }

  const date =
    new Date(dateString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const today =
    new Date();

  if (
    date.toDateString() ===
    today.toDateString()
  ) {
    return formatTime(
      dateString
    );
  }

  return date.toLocaleDateString(
    [],
    {
      day: 'numeric',
      month: 'short',
    }
  );
}


/*
=========================================================
MESSAGES SCREEN
=========================================================
*/

export default function Messages() {

  const [
    conversations,
    setConversations
  ] = useState<Conversation[]>([]);

  const [
    selectedConversation,
    setSelectedConversation
  ] =
    useState<Conversation | null>(
      null
    );

  const [
    messages,
    setMessages
  ] = useState<Message[]>([]);

  const [
    currentUserId,
    setCurrentUserId
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
    conversationLoading,
    setConversationLoading
  ] = useState(false);

  const [
    sending,
    setSending
  ] = useState(false);

  const [
    messageText,
    setMessageText
  ] = useState('');


  /*
  =======================================================
  AUTH
  =======================================================
  */

  async function authenticate() {

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
  }


  /*
  =======================================================
  LOAD CONVERSATIONS
  =======================================================
  */

  const loadConversations =
    useCallback(
      async (
        showLoader = true
      ) => {

        try {

          if (showLoader) {
            setLoading(true);
          }

          console.log(
            '[RIDER MESSAGES] Loading conversations'
          );


          const authenticated =
            await authenticate();

          if (!authenticated) {
            return;
          }


          const response =
            await api.get(
              '/messages'
            );


          const list =
            response?.data?.data
              ?.conversations || [];


          setConversations(
            list
          );


          console.log(
            '[RIDER MESSAGES] Conversations loaded:',
            list.length
          );


        } catch (
          error: any
        ) {

          console.log(
            '[RIDER MESSAGES ERROR]',
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
            'Messages unavailable',
            error?.response?.data?.message ||
            'Unable to load your messages.'
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
  LOAD CONVERSATION
  =======================================================
  */

  async function openConversation(
    conversation: Conversation
  ) {

    try {

      setSelectedConversation(
        conversation
      );

      setConversationLoading(
        true
      );


      const authenticated =
        await authenticate();

      if (!authenticated) {
        return;
      }


      const tripId =
        conversation.trip?._id;


      const response =
        await api.get(
          '/messages/conversation',
          {
            params: {
              ...(tripId
                ? {
                    tripId,
                  }
                : {}),
            },
          }
        );


      const loadedMessages =
        response?.data?.data
          ?.messages || [];


      setMessages(
        loadedMessages
      );


      /*
      -----------------------------------------------------
      MARK AS READ
      -----------------------------------------------------
      */

      const senderId =
        getUserId(
          conversation.user
        );


      await api.patch(
        '/messages/read',
        {
          ...(tripId
            ? {
                tripId,
              }
            : {}),

          ...(senderId
            ? {
                senderId,
              }
            : {}),
        }
      );


      /*
      -----------------------------------------------------
      REMOVE UNREAD COUNT LOCALLY
      -----------------------------------------------------
      */

      setConversations(
        previous =>
          previous.map(
            item =>
              item.key ===
              conversation.key
                ? {
                    ...item,
                    unreadCount: 0,
                  }
                : item
          )
      );


    } catch (
      error: any
    ) {

      console.log(
        '[RIDER MESSAGES CONVERSATION ERROR]',
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
        'Unable to open conversation',
        error?.response?.data?.message ||
        'Please try again.'
      );


    } finally {

      setConversationLoading(
        false
      );

    }

  }


  /*
  =======================================================
  SEND MESSAGE
  =======================================================
  */

  async function sendMessage() {

    const text =
      messageText.trim();


    if (
      !text ||
      sending ||
      !selectedConversation
    ) {
      return;
    }


    const recipientId =
      getUserId(
        selectedConversation.user
      );


    if (!recipientId) {

      Alert.alert(
        'Unable to send',
        'The recipient could not be identified.'
      );

      return;
    }


    try {

      setSending(
        true
      );


      const tripId =
        selectedConversation
          .trip?._id;


      const response =
        await api.post(
          '/messages',
          {
            recipientId,

            ...(tripId
              ? {
                  tripId,
                }
              : {}),

            text,
          }
        );


      const newMessage =
        response?.data?.data
          ?.message;


      if (newMessage) {

        setMessages(
          previous => [
            ...previous,
            newMessage,
          ]
        );

      }


      setMessageText('');


      /*
      -----------------------------------------------------
      UPDATE LAST MESSAGE
      -----------------------------------------------------
      */

      if (newMessage) {

        setConversations(
          previous =>
            previous.map(
              item =>
                item.key ===
                selectedConversation.key
                  ? {
                      ...item,
                      lastMessage:
                        newMessage,
                    }
                  : item
            )
        );

      }


    } catch (
      error: any
    ) {

      console.log(
        '[RIDER SEND MESSAGE ERROR]',
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
        'Message failed',
        error?.response?.data?.message ||
        'Unable to send your message.'
      );


    } finally {

      setSending(
        false
      );

    }

  }


  /*
  =======================================================
  BACK TO CONVERSATIONS
  =======================================================
  */

  function closeConversation() {

    setSelectedConversation(
      null
    );

    setMessages([]);

    setMessageText('');

    loadConversations(
      false
    );

  }


  /*
  =======================================================
  REFRESH
  =======================================================
  */

  async function refresh() {

    setRefreshing(
      true
    );

    await loadConversations(
      false
    );

  }


  /*
  =======================================================
  INITIAL LOAD
  =======================================================
  */

  useFocusEffect(
    useCallback(() => {

      loadConversations();

    }, [loadConversations])
  );


  /*
  =======================================================
  CONVERSATION LIST ITEM
  =======================================================
  */

  function renderConversation(
    {
      item,
    }: {
      item: Conversation;
    }
  ) {

    const name =
      item.user?.fullName ||
      'Kaduna Only User';


    const initial =
      name
        .trim()
        .charAt(0)
        .toUpperCase() ||
      'K';


    const lastMessage =
      item.lastMessage?.text ||
      'No messages yet';


    const unread =
      Number(
        item.unreadCount || 0
      );


    return (

      <Pressable
        onPress={() =>
          openConversation(
            item
          )
        }

        style={({ pressed }) => [
          styles.conversationCard,

          pressed &&
            styles.pressed,
        ]}
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
            {initial}
          </Text>

        </View>


        <View
          style={
            styles.conversationMiddle
          }
        >

          <View
            style={
              styles.nameRow
            }
          >

            <Text
              numberOfLines={1}
              style={
                styles.name
              }
            >
              {name}
            </Text>


            {item.lastMessage && (

              <Text
                style={
                  styles.time
                }
              >
                {formatDate(
                  item.lastMessage.createdAt
                )}
              </Text>

            )}

          </View>


          {item.trip?.tripId && (

            <Text
              style={
                styles.tripReference
              }
            >
              Trip {item.trip.tripId}
            </Text>

          )}


          <Text
            numberOfLines={1}
            style={[
              styles.preview,

              unread > 0 &&
                styles.unreadPreview,
            ]}
          >
            {lastMessage}
          </Text>

        </View>


        {unread > 0 && (

          <View
            style={
              styles.unreadBadge
            }
          >

            <Text
              style={
                styles.unreadText
              }
            >
              {unread > 99
                ? '99+'
                : unread}
            </Text>

          </View>

        )}

      </Pressable>

    );

  }


  /*
  =======================================================
  MESSAGE ITEM
  =======================================================
  */

  function renderMessage(
    {
      item,
    }: {
      item: Message;
    }
  ) {

    const senderId =
      getUserId(
        item.sender
      );


    const mine =
      senderId ===
      currentUserId;


    return (

      <View
        style={[
          styles.messageRow,

          mine &&
            styles.messageRowMine,
        ]}
      >

        <View
          style={[
            styles.messageBubble,

            mine &&
              styles.messageBubbleMine,
          ]}
        >

          <Text
            style={[
              styles.messageText,

              mine &&
                styles.messageTextMine,
            ]}
          >
            {item.text}
          </Text>


          <Text
            style={[
              styles.messageTime,

              mine &&
                styles.messageTimeMine,
            ]}
          >
            {formatTime(
              item.createdAt
            )}
          </Text>

        </View>

      </View>

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
            Loading messages...
          </Text>

        </View>

      </SafeAreaView>

    );

  }


  /*
  =======================================================
  CHAT SCREEN
  =======================================================
  */

  if (selectedConversation) {

    const name =
      selectedConversation
        .user?.fullName ||
      'Kaduna Only User';


    return (

      <SafeAreaView
        style={
          styles.screen
        }
      >

        <KeyboardAvoidingView
          style={
            styles.chatContainer
          }

          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >

          {/* CHAT HEADER */}

          <View
            style={
              styles.chatHeader
            }
          >

            <Pressable
              onPress={
                closeConversation
              }

              style={
                styles.backButton
              }
            >

              <Text
                style={
                  styles.backIcon
                }
              >
                ‹
              </Text>

            </Pressable>


            <View
              style={
                styles.chatAvatar
              }
            >

              <Text
                style={
                  styles.chatAvatarText
                }
              >
                {name
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </Text>

            </View>


            <View
              style={
                styles.chatHeaderText
              }
            >

              <Text
                numberOfLines={1}
                style={
                  styles.chatName
                }
              >
                {name}
              </Text>


              {selectedConversation
                .trip?.tripId && (

                <Text
                  style={
                    styles.chatTrip
                  }
                >
                  Trip {
                    selectedConversation
                      .trip
                      .tripId
                  }
                </Text>

              )}

            </View>

          </View>


          {/* MESSAGES */}

          {conversationLoading ? (

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
                Opening conversation...
              </Text>

            </View>

          ) : (

            <FlatList
              data={
                messages
              }

              keyExtractor={
                item =>
                  item._id
              }

              renderItem={
                renderMessage
              }

              contentContainerStyle={
                messages.length === 0
                  ? styles.emptyChatContainer
                  : styles.chatMessages
              }

              showsVerticalScrollIndicator={
                false
              }

              keyboardShouldPersistTaps="handled"

              ListEmptyComponent={

                <View
                  style={
                    styles.emptyChat
                  }
                >

                  <View
                    style={
                      styles.emptyChatIcon
                    }
                  >

                    <Text
                      style={
                        styles.emptyChatIconText
                      }
                    >
                      K
                    </Text>

                  </View>


                  <Text
                    style={
                      styles.emptyChatTitle
                    }
                  >
                    Start a conversation
                  </Text>


                  <Text
                    style={
                      styles.emptyChatText
                    }
                  >
                    Send a message to start
                    chatting.
                  </Text>

                </View>

              }

            />

          )}


          {/* MESSAGE INPUT */}

          <View
            style={
              styles.inputArea
            }
          >

            <TextInput
              value={
                messageText
              }

              onChangeText={
                setMessageText
              }

              placeholder="Type a message..."
              placeholderTextColor="#999999"

              style={
                styles.messageInput
              }

              multiline

              maxLength={1000}

              editable={
                !sending
              }

              onSubmitEditing={() => {
                if (
                  Platform.OS !== 'ios'
                ) {
                  sendMessage();
                }
              }}
            />


            <Pressable
              onPress={
                sendMessage
              }

              disabled={
                sending ||
                !messageText.trim()
              }

              style={[
                styles.sendButton,

                (
                  sending ||
                  !messageText.trim()
                ) &&
                  styles.sendButtonDisabled,
              ]}
            >

              {sending ? (

                <ActivityIndicator
                  color={
                    BrandColors.white
                  }

                  size="small"
                />

              ) : (

                <Text
                  style={
                    styles.sendIcon
                  }
                >
                  ➤
                </Text>

              )}

            </Pressable>

          </View>

        </KeyboardAvoidingView>

      </SafeAreaView>

    );

  }


  /*
  =======================================================
  CONVERSATION LIST SCREEN
  =======================================================
  */

  return (

    <SafeAreaView
      style={
        styles.screen
      }
    >

      <View
        style={
          styles.header
        }
      >

        <View>

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
            Messages
          </Text>

        </View>

      </View>


      <FlatList
        data={
          conversations
        }

        keyExtractor={
          item =>
            item.key
        }

        renderItem={
          renderConversation
        }

        showsVerticalScrollIndicator={
          false
        }

        contentContainerStyle={
          conversations.length === 0
            ? styles.emptyListContainer
            : styles.listContent
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

        ListEmptyComponent={

          <View
            style={
              styles.emptyList
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
              No messages yet
            </Text>


            <Text
              style={
                styles.emptyText
              }
            >
              Your driver conversations
              will appear here when you
              start communicating through
              Kaduna Only.
            </Text>


            <Pressable
              onPress={() =>
                router.push(
                  '/book-ride'
                )
              }

              style={
                styles.bookButton
              }
            >

              <Text
                style={
                  styles.bookButtonText
                }
              >
                Book a Ride
              </Text>

            </Pressable>

          </View>

        }

      />

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


    /*
    -------------------------------------------------------
    HEADER
    -------------------------------------------------------
    */

    header: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 16,
    },


    eyebrow: {
      color:
        BrandColors.primary,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.1,
      marginBottom: 3,
    },


    title: {
      color:
        BrandColors.text,
      fontSize: 28,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    LIST
    -------------------------------------------------------
    */

    listContent: {
      paddingHorizontal: 18,
      paddingBottom: 30,
    },


    conversationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        BrandColors.white,
      borderWidth: 1,
      borderColor:
        '#ECEAF2',
      borderRadius: 16,
      padding: 13,
      marginBottom: 10,
    },


    pressed: {
      opacity: 0.75,
    },


    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },


    avatarText: {
      color:
        BrandColors.primary,
      fontSize: 17,
      fontWeight: '900',
    },


    conversationMiddle: {
      flex: 1,
      minWidth: 0,
    },


    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },


    name: {
      flex: 1,
      color:
        BrandColors.text,
      fontSize: 13,
      fontWeight: '900',
      marginRight: 8,
    },


    time: {
      color:
        '#999999',
      fontSize: 9,
    },


    tripReference: {
      color:
        BrandColors.primary,
      fontSize: 9,
      fontWeight: '700',
      marginTop: 3,
    },


    preview: {
      color:
        '#777777',
      fontSize: 11,
      marginTop: 4,
    },


    unreadPreview: {
      color:
        BrandColors.text,
      fontWeight: '800',
    },


    unreadBadge: {
      minWidth: 21,
      height: 21,
      paddingHorizontal: 5,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        BrandColors.primary,
      marginLeft: 8,
    },


    unreadText: {
      color:
        BrandColors.white,
      fontSize: 9,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    EMPTY LIST
    -------------------------------------------------------
    */

    emptyListContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 35,
      paddingBottom: 80,
    },


    emptyList: {
      alignItems: 'center',
    },


    emptyIcon: {
      width: 74,
      height: 74,
      borderRadius: 37,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },


    emptyIconText: {
      color:
        BrandColors.primary,
      fontSize: 28,
      fontWeight: '900',
    },


    emptyTitle: {
      color:
        BrandColors.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },


    emptyText: {
      color:
        BrandColors.textSecondary,
      fontSize: 12,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 300,
    },


    bookButton: {
      backgroundColor:
        BrandColors.primary,
      borderRadius: 12,
      paddingHorizontal: 25,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
    },


    bookButtonText: {
      color:
        BrandColors.white,
      fontSize: 12,
      fontWeight: '900',
    },


    /*
    -------------------------------------------------------
    CHAT
    -------------------------------------------------------
    */

    chatContainer: {
      flex: 1,
    },


    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EEEEEE',
      backgroundColor:
        BrandColors.white,
    },


    backButton: {
      width: 36,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },


    backIcon: {
      color:
        BrandColors.text,
      fontSize: 34,
      fontWeight: '300',
      lineHeight: 34,
    },


    chatAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 7,
    },


    chatAvatarText: {
      color:
        BrandColors.primary,
      fontSize: 15,
      fontWeight: '900',
    },


    chatHeaderText: {
      flex: 1,
    },


    chatName: {
      color:
        BrandColors.text,
      fontSize: 14,
      fontWeight: '900',
    },


    chatTrip: {
      color:
        BrandColors.primary,
      fontSize: 9,
      fontWeight: '700',
      marginTop: 2,
    },


    chatMessages: {
      paddingHorizontal: 13,
      paddingVertical: 18,
    },


    messageRow: {
      width: '100%',
      alignItems: 'flex-start',
      marginBottom: 9,
    },


    messageRowMine: {
      alignItems: 'flex-end',
    },


    messageBubble: {
      maxWidth: '78%',
      backgroundColor:
        '#F1F1F4',
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },


    messageBubbleMine: {
      backgroundColor:
        BrandColors.primary,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 4,
    },


    messageText: {
      color:
        BrandColors.text,
      fontSize: 12,
      lineHeight: 18,
    },


    messageTextMine: {
      color:
        BrandColors.white,
    },


    messageTime: {
      color:
        '#999999',
      fontSize: 8,
      marginTop: 4,
      textAlign: 'right',
    },


    messageTimeMine: {
      color:
        '#DDD0F4',
    },


    /*
    -------------------------------------------------------
    INPUT
    -------------------------------------------------------
    */

    inputArea: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom:
        Platform.OS === 'ios'
          ? 10
          : 8,
      borderTopWidth: 1,
      borderTopColor:
        '#EEEEEE',
      backgroundColor:
        BrandColors.white,
    },


    messageInput: {
      flex: 1,
      maxHeight: 100,
      minHeight: 43,
      backgroundColor:
        '#F6F6F8',
      borderRadius: 22,
      paddingHorizontal: 15,
      paddingVertical: 11,
      color:
        BrandColors.text,
      fontSize: 12,
      marginRight: 8,
    },


    sendButton: {
      width: 43,
      height: 43,
      borderRadius: 22,
      backgroundColor:
        BrandColors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },


    sendButtonDisabled: {
      opacity: 0.4,
    },


    sendIcon: {
      color:
        BrandColors.white,
      fontSize: 17,
      fontWeight: '900',
      marginLeft: 2,
    },


    /*
    -------------------------------------------------------
    EMPTY CHAT
    -------------------------------------------------------
    */

    emptyChatContainer: {
      flexGrow: 1,
      justifyContent: 'center',
    },


    emptyChat: {
      alignItems: 'center',
      paddingHorizontal: 35,
    },


    emptyChatIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor:
        BrandColors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },


    emptyChatIconText: {
      color:
        BrandColors.primary,
      fontSize: 23,
      fontWeight: '900',
    },


    emptyChatTitle: {
      color:
        BrandColors.text,
      fontSize: 16,
      fontWeight: '900',
    },


    emptyChatText: {
      color:
        BrandColors.textSecondary,
      fontSize: 11,
      marginTop: 5,
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
      fontSize: 12,
      marginTop: 10,
    },

  });