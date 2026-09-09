import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import api, {
  setAuthToken,
} from '../services/api';

import {
  getStoredToken,
} from '../storage/auth';


const PURPLE = '#4B24A8';
const DEEP_PURPLE = '#321579';
const GOLD = '#F5C542';
const WHITE = '#FFFFFF';
const BACKGROUND = '#F7F5FB';
const TEXT = '#171717';
const MUTED = '#777777';
const GREEN = '#168A55';
const RED = '#C62828';


type Transaction = {
  type?: string;
  amount?: number;
  description?: string;
  reference?: string;
  provider?: string;
  status?: string;
  createdAt?: string;
  trip?: {
    tripId?: string;
  };
};


export default function WalletScreen() {

  const [balance, setBalance] =
    useState(0);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [amount, setAmount] =
    useState('');

  const [showTopUp, setShowTopUp] =
    useState(false);

  const [topUpLoading, setTopUpLoading] =
    useState(false);

  const [paymentReference, setPaymentReference] =
    useState<string | null>(null);

  const [paymentChecking, setPaymentChecking] =
    useState(false);


  useEffect(() => {

    loadWallet();

  }, []);


  /*
  =========================================================
  LOAD WALLET
  =========================================================
  */

  async function loadWallet() {

    try {

      const token =
        await getStoredToken();

      if (!token) {

        throw new Error(
          'Authentication session not found'
        );

      }

      setAuthToken(token);

      const response =
        await api.get('/wallet');

      const wallet =
        response?.data?.data?.wallet;

      setBalance(
        Number(wallet?.balance || 0)
      );

      setTransactions(
        Array.isArray(wallet?.transactions)
          ? wallet.transactions
          : []
      );

    } catch (error: any) {

      console.log(
        '[MOBILE WALLET ERROR]',
        error
      );

      Alert.alert(
        'Wallet',
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load wallet'
      );

    } finally {

      setLoading(false);
      setRefreshing(false);

    }

  }


  /*
  =========================================================
  REFRESH
  =========================================================
  */

  async function refreshWallet() {

    setRefreshing(true);

    await loadWallet();

  }


  /*
  =========================================================
  FORMAT MONEY
  =========================================================
  */

  function formatMoney(
    value: number
  ) {

    return `₦${Number(value || 0)
      .toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

  }


  /*
  =========================================================
  TOP UP
  =========================================================
  */

  async function initializeTopUp() {

    const numericAmount =
      Number(
        amount.replace(/,/g, '')
      );


    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 100
    ) {

      Alert.alert(
        'Invalid amount',
        'Enter at least ₦100.'
      );

      return;

    }


    if (
      !Number.isInteger(
        numericAmount
      )
    ) {

      Alert.alert(
        'Invalid amount',
        'Enter a whole naira amount.'
      );

      return;

    }


    try {

      setTopUpLoading(true);


      const response =
        await api.post(
          '/wallet/paystack/initialize',
          {
            amount: numericAmount,
          }
        );


      const data =
        response?.data?.data;


      if (!data?.authorizationUrl) {

        throw new Error(
          'Paystack payment link was not returned.'
        );

      }


      setPaymentReference(
        data.reference
      );

      setShowTopUp(false);

      setAmount('');


      /*
      Open the real Paystack checkout.
      */

      await Linking.openURL(
        data.authorizationUrl
      );


    } catch (error: any) {

      console.log(
        '[PAYSTACK INITIALIZE ERROR]',
        error
      );

      Alert.alert(
        'Top Up Failed',
        error?.response?.data?.message ||
        error?.message ||
        'Unable to initialize payment.'
      );

    } finally {

      setTopUpLoading(false);

    }

  }


  /*
  =========================================================
  VERIFY PAYMENT
  =========================================================
  */

  async function verifyPayment(
    reference = paymentReference
  ) {

    if (!reference) {

      return;

    }


    try {

      setPaymentChecking(true);


      const response =
        await api.post(
          '/wallet/paystack/verify',
          {
            reference,
          }
        );


      const data =
        response?.data?.data;


      const wallet =
        data?.wallet;


      if (wallet) {

        setBalance(
          Number(wallet.balance || 0)
        );

        setTransactions(
          Array.isArray(wallet.transactions)
            ? wallet.transactions
            : []
        );

      }


      setPaymentReference(null);


      Alert.alert(
        'Payment Successful',
        response?.data?.message ||
        'Your wallet has been credited.'
      );


      await loadWallet();


    } catch (error: any) {

      console.log(
        '[PAYSTACK VERIFY ERROR]',
        error
      );


      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Payment has not been confirmed yet.';


      Alert.alert(
        'Payment Status',
        message
      );

    } finally {

      setPaymentChecking(false);

    }

  }


  /*
  =========================================================
  AUTO CHECK WHEN USER RETURNS FROM PAYSTACK
  =========================================================
  */

  useEffect(() => {

    const subscription =
      AppState.addEventListener(
        'change',
        nextState => {

          if (
            nextState === 'active' &&
            paymentReference
          ) {

            verifyPayment(
              paymentReference
            );

          }

        }
      );


    return () => {

      subscription.remove();

    };

  }, [paymentReference]);


  /*
  =========================================================
  TRANSACTION DISPLAY
  =========================================================
  */

  function transactionColor(
    transaction: Transaction
  ) {

    return transaction.type === 'credit'
      ? GREEN
      : RED;

  }


  function transactionSign(
    transaction: Transaction
  ) {

    return transaction.type === 'credit'
      ? '+'
      : '-';

  }


  /*
  =========================================================
  LOADING
  =========================================================
  */

  if (loading) {

    return (

      <View style={styles.loading}>

        <ActivityIndicator
          size="large"
          color={PURPLE}
        />

        <Text style={styles.loadingText}>
          Loading wallet...
        </Text>

      </View>

    );

  }


  /*
  =========================================================
  MAIN
  =========================================================
  */

  return (

    <View style={styles.screen}>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshWallet}
            colors={[PURPLE]}
            tintColor={PURPLE}
          />
        }
      >

        {/* HEADER */}

        <View style={styles.header}>

          <View>

            <Text style={styles.eyebrow}>
              KADUNA ONLY
            </Text>

            <Text style={styles.title}>
              My Wallet
            </Text>

          </View>

        </View>


        {/* BALANCE */}

        <View style={styles.balanceCard}>

          <Text style={styles.balanceLabel}>
            Wallet Balance
          </Text>

          <Text style={styles.balance}>
            {formatMoney(balance)}
          </Text>


          <Pressable
            style={styles.topUpButton}
            onPress={() =>
              setShowTopUp(true)
            }
          >

            <Text style={styles.topUpText}>
              + Top Up Wallet
            </Text>

          </Pressable>

        </View>


        {/* QUICK ACTIONS */}

        <View style={styles.actions}>

          <Pressable
            style={styles.actionCard}
            onPress={() =>
              setShowTopUp(true)
            }
          >

            <View style={styles.actionIcon}>

              <Text style={styles.actionIconText}>
                +
              </Text>

            </View>

            <Text style={styles.actionTitle}>
              Top Up
            </Text>

            <Text style={styles.actionSubtitle}>
              Add money
            </Text>

          </Pressable>


          <Pressable
            style={styles.actionCard}
            onPress={refreshWallet}
          >

            <View style={styles.actionIcon}>

              <Text style={styles.actionIconText}>
                ↻
              </Text>

            </View>

            <Text style={styles.actionTitle}>
              Refresh
            </Text>

            <Text style={styles.actionSubtitle}>
              Update balance
            </Text>

          </Pressable>

        </View>


        {/* PAYMENT VERIFICATION */}

        {paymentReference && (

          <View style={styles.pendingCard}>

            <Text style={styles.pendingTitle}>
              Payment awaiting confirmation
            </Text>

            <Text style={styles.pendingText}>
              Return from Paystack and confirm
              your payment below.
            </Text>

            <Text style={styles.reference}>
              Reference: {paymentReference}
            </Text>


            <Pressable
              style={styles.verifyButton}
              onPress={() =>
                verifyPayment()
              }
              disabled={paymentChecking}
            >

              {paymentChecking ? (

                <ActivityIndicator
                  color={WHITE}
                />

              ) : (

                <Text style={styles.verifyText}>
                  I've Completed Payment
                </Text>

              )}

            </Pressable>

          </View>

        )}


        {/* TRANSACTIONS */}

        <View style={styles.sectionHeader}>

          <Text style={styles.sectionTitle}>
            Recent Transactions
          </Text>

        </View>


        <View style={styles.transactionsCard}>

          {transactions.length === 0 ? (

            <View style={styles.empty}>

              <Text style={styles.emptyTitle}>
                No transactions yet
              </Text>

              <Text style={styles.emptyText}>
                Your wallet transactions will
                appear here.
              </Text>

            </View>

          ) : (

            transactions
              .slice(0, 20)
              .map(
                (
                  transaction,
                  index
                ) => (

                  <View
                    key={
                      transaction.reference ||
                      `${transaction.createdAt}-${index}`
                    }
                    style={[
                      styles.transactionRow,
                      index > 0 &&
                      styles.transactionBorder,
                    ]}
                  >

                    <View
                      style={[
                        styles.transactionIcon,
                        {
                          backgroundColor:
                            transaction.type === 'credit'
                              ? '#E7F7EF'
                              : '#FDECEC',
                        },
                      ]}
                    >

                      <Text
                        style={[
                          styles.transactionIconText,
                          {
                            color:
                              transactionColor(
                                transaction
                              ),
                          },
                        ]}
                      >
                        {transactionSign(
                          transaction
                        )}
                      </Text>

                    </View>


                    <View
                      style={
                        styles.transactionInfo
                      }
                    >

                      <Text
                        style={
                          styles.transactionTitle
                        }
                        numberOfLines={1}
                      >
                        {
                          transaction.description ||
                          'Wallet transaction'
                        }
                      </Text>

                      <Text
                        style={
                          styles.transactionDate
                        }
                      >
                        {
                          transaction.createdAt
                            ? new Date(
                                transaction.createdAt
                              ).toLocaleDateString(
                                'en-NG'
                              )
                            : ''
                        }
                      </Text>

                    </View>


                    <View
                      style={
                        styles.transactionAmountContainer
                      }
                    >

                      <Text
                        style={[
                          styles.transactionAmount,
                          {
                            color:
                              transactionColor(
                                transaction
                              ),
                          },
                        ]}
                      >
                        {transactionSign(
                          transaction
                        )}
                        {formatMoney(
                          Number(
                            transaction.amount || 0
                          )
                        )}
                      </Text>

                      <Text
                        style={
                          styles.transactionStatus
                        }
                      >
                        {
                          transaction.status ||
                          'success'
                        }
                      </Text>

                    </View>

                  </View>

                )
              )

          )}

        </View>


        <View style={styles.bottomSpace} />

      </ScrollView>


      {/* TOP UP MODAL */}

      <Modal
        visible={showTopUp}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowTopUp(false)
        }
      >

        <View style={styles.modalOverlay}>

          <View style={styles.modal}>

            <Text style={styles.modalTitle}>
              Top Up Wallet
            </Text>

            <Text style={styles.modalSubtitle}>
              Enter the amount you want to
              add to your Kaduna Only wallet.
            </Text>


            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Amount in Naira"
              placeholderTextColor="#999"
              keyboardType="numeric"
              style={styles.input}
            />


            <View style={styles.amountRow}>

              {[1000, 2000, 5000, 10000].map(
                value => (

                  <Pressable
                    key={value}
                    style={styles.amountChip}
                    onPress={() =>
                      setAmount(
                        String(value)
                      )
                    }
                  >

                    <Text
                      style={
                        styles.amountChipText
                      }
                    >
                      ₦{value.toLocaleString()}
                    </Text>

                  </Pressable>

                )
              )}

            </View>


            <Pressable
              style={styles.modalPrimary}
              onPress={initializeTopUp}
              disabled={topUpLoading}
            >

              {topUpLoading ? (

                <ActivityIndicator
                  color={WHITE}
                />

              ) : (

                <Text
                  style={
                    styles.modalPrimaryText
                  }
                >
                  Continue to Paystack
                </Text>

              )}

            </Pressable>


            <Pressable
              style={styles.modalCancel}
              onPress={() =>
                setShowTopUp(false)
              }
            >

              <Text style={styles.modalCancelText}>
                Cancel
              </Text>

            </Pressable>

          </View>

        </View>

      </Modal>

    </View>

  );

}


/*
===========================================================
STYLES
===========================================================
*/

const styles = StyleSheet.create({

  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  content: {
    padding: 18,
    paddingBottom: 30,
  },

  loading: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: MUTED,
    fontSize: 14,
  },

  header: {
    marginBottom: 18,
  },

  eyebrow: {
    color: PURPLE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  title: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '900',
    color: TEXT,
  },

  balanceCard: {
    backgroundColor: PURPLE,
    borderRadius: 20,
    padding: 22,
    minHeight: 170,
  },

  balanceLabel: {
    color: '#DDD4F5',
    fontSize: 13,
    fontWeight: '600',
  },

  balance: {
    marginTop: 8,
    color: WHITE,
    fontSize: 32,
    fontWeight: '900',
  },

  topUpButton: {
    alignSelf: 'flex-start',
    marginTop: 20,
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },

  topUpText: {
    color: PURPLE,
    fontSize: 13,
    fontWeight: '800',
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 15,
  },

  actionCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ECEAF2',
  },

  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  actionIconText: {
    color: PURPLE,
    fontSize: 21,
    fontWeight: '900',
  },

  actionTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },

  actionSubtitle: {
    marginTop: 3,
    color: MUTED,
    fontSize: 11,
  },

  pendingCard: {
    marginTop: 15,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF8DF',
    borderWidth: 1,
    borderColor: '#F2D878',
  },

  pendingTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '800',
  },

  pendingText: {
    marginTop: 5,
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },

  reference: {
    marginTop: 10,
    color: TEXT,
    fontSize: 11,
    fontWeight: '700',
  },

  verifyButton: {
    marginTop: 13,
    height: 44,
    borderRadius: 10,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  verifyText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
  },

  sectionHeader: {
    marginTop: 25,
    marginBottom: 12,
  },

  sectionTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
  },

  transactionsCard: {
    backgroundColor: WHITE,
    borderRadius: 17,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ECEAF2',
  },

  transactionRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
  },

  transactionBorder: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },

  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  transactionIconText: {
    fontSize: 19,
    fontWeight: '900',
  },

  transactionInfo: {
    flex: 1,
    paddingRight: 8,
  },

  transactionTitle: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '700',
  },

  transactionDate: {
    marginTop: 4,
    color: MUTED,
    fontSize: 10,
  },

  transactionAmountContainer: {
    alignItems: 'flex-end',
  },

  transactionAmount: {
    fontSize: 13,
    fontWeight: '800',
  },

  transactionStatus: {
    marginTop: 3,
    color: MUTED,
    fontSize: 9,
  },

  empty: {
    paddingVertical: 35,
    alignItems: 'center',
  },

  emptyTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },

  emptyText: {
    marginTop: 5,
    color: MUTED,
    fontSize: 11,
    textAlign: 'center',
  },

  bottomSpace: {
    height: 30,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  modal: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 30,
  },

  modalTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
  },

  modalSubtitle: {
    marginTop: 7,
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
  },

  input: {
    height: 54,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#DDD9E8',
    borderRadius: 12,
    paddingHorizontal: 15,
    color: TEXT,
    fontSize: 17,
    fontWeight: '700',
  },

  amountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },

  amountChip: {
    backgroundColor: '#F0EBFF',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  amountChipText: {
    color: PURPLE,
    fontSize: 11,
    fontWeight: '800',
  },

  modalPrimary: {
    height: 52,
    borderRadius: 12,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },

  modalPrimaryText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
  },

  modalCancel: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  modalCancelText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },

});