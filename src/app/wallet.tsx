import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

import api, { setAuthToken } from '../services/api';
import { getStoredToken } from '../storage/auth';

/* =========================================================
   THEME
   ========================================================= */

const PURPLE = '#4B24A8';
const DEEP_PURPLE = '#321579';
const GOLD = '#F5C542';
const WHITE = '#FFFFFF';
const BACKGROUND = '#F7F5FB';
const TEXT = '#171717';
const MUTED = '#777777';
const GREEN = '#168A55';
const RED = '#C62828';

/* =========================================================
   TYPES
   ========================================================= */

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

type Bank = {
  name?: string;
  bank_name?: string;
  code?: string;
  bank_code?: string;
};

type SelectedBank = {
  name: string;
  code: string;
};

/* =========================================================
   VALIDATORS
   ========================================================= */

function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function isValidAccountNumber(account: string): boolean {
  return /^\d{10}$/.test(account);
}

/* =========================================================
   SCREEN
   ========================================================= */

export default function WalletScreen() {
  /* ------------------------- WALLET ------------------------- */
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ------------------------- TOP UP ------------------------- */
  const [amount, setAmount] = useState('');
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentChecking, setPaymentChecking] = useState(false);

  /* ---------------------- SEND MONEY ------------------------ */
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [sendPin, setSendPin] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  /* ----------------------- WITHDRAW ------------------------- */
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<SelectedBank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankLoading, setBankLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [isWithdrawLoading, setIsWithdrawLoading] = useState(false);
  const [withdrawPin, setWithdrawPin] = useState('');

  /* ---------------------- PIN CREATE ------------------------ */
  const [showCreatePin, setShowCreatePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [pinLoading, setPinLoading] = useState(false);

  /* -------------------- PIN REQUIRED ------------------------ */
  const [showPinRequired, setShowPinRequired] = useState(false);

  /* -------------------- VERIFY RACE GUARD ------------------- */
  const verifyRequestIdRef = useRef(0);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* =========================================================
     LOAD WALLET
     ========================================================= */

  const loadWallet = useCallback(async () => {
    try {
      const token = await getStoredToken();

      if (!token) {
        throw new Error('Authentication session not found');
      }

      setAuthToken(token);

      const response = await api.get('/wallet');
      const wallet = response?.data?.data?.wallet;

      setBalance(Number(wallet?.balance || 0));

      setTransactions(
        Array.isArray(wallet?.transactions) ? wallet.transactions : []
      );

      setHasPin(Boolean(wallet?.hasPin ?? wallet?.has_pin));
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to load wallet';

      if (message.toLowerCase().includes('auth')) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK' },
        ]);
      } else {
        Alert.alert('Wallet', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  /* =========================================================
     REFRESH
     ========================================================= */

  const refreshWallet = useCallback(async () => {
    setRefreshing(true);
    await loadWallet();
  }, [loadWallet]);

  /* =========================================================
     FORMATTERS
     ========================================================= */

  const formatMoney = useCallback((value: number) => {
    return `₦${Number(value || 0).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, []);

  /* =========================================================
     TOP UP
     ========================================================= */

  const initializeTopUp = useCallback(async () => {
    const numericAmount = Number(amount.replace(/,/g, ''));

    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      Alert.alert('Invalid amount', 'Enter at least ₦100.');
      return;
    }

    if (!Number.isInteger(numericAmount)) {
      Alert.alert('Invalid amount', 'Enter a whole naira amount.');
      return;
    }

    try {
      setTopUpLoading(true);

      const response = await api.post('/wallet/paystack/initialize', {
        amount: numericAmount,
      });

      const data = response?.data?.data;

      if (!data?.authorizationUrl) {
        throw new Error('Paystack payment link was not returned.');
      }

      setPaymentReference(data.reference);
      setShowTopUp(false);
      setAmount('');

      await Linking.openURL(data.authorizationUrl);
    } catch (error: any) {
      Alert.alert(
        'Top Up Failed',
        error?.response?.data?.message ||
          error?.message ||
          'Unable to initialize payment.'
      );
    } finally {
      setTopUpLoading(false);
    }
  }, [amount]);

  /* =========================================================
     VERIFY PAYMENT
     ========================================================= */

  const verifyPayment = useCallback(
    async (reference: string | null = paymentReference) => {
      if (!reference) return;

      try {
        setPaymentChecking(true);

        const response = await api.post('/wallet/paystack/verify', {
          reference,
        });

        const wallet = response?.data?.data?.wallet;

        if (wallet) {
          setBalance(Number(wallet.balance || 0));
          setTransactions(
            Array.isArray(wallet.transactions) ? wallet.transactions : []
          );
        }

        setPaymentReference(null);

        Alert.alert(
          'Payment Successful',
          response?.data?.message || 'Your wallet has been credited.'
        );

        await loadWallet();
      } catch (error: any) {
        Alert.alert(
          'Payment Status',
          error?.response?.data?.message ||
            error?.message ||
            'Payment has not been confirmed yet.'
        );
      } finally {
        setPaymentChecking(false);
      }
    },
    [paymentReference, loadWallet]
  );

  /* =========================================================
     AUTO-VERIFY ON RETURN FROM PAYSTACK
     ========================================================= */

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && paymentReference) {
        verifyPayment(paymentReference);
      }
    });

    return () => subscription.remove();
  }, [paymentReference, verifyPayment]);

  /* =========================================================
     PIN GUARD
     ========================================================= */

  const requirePin = useCallback(() => {
    if (!hasPin) {
      setShowPinRequired(true);
      return false;
    }
    return true;
  }, [hasPin]);

  /* =========================================================
     CREATE PIN
     ========================================================= */

  const submitCreatePin = useCallback(async () => {
    if (!isValidPin(newPin)) {
      Alert.alert('Invalid PIN', 'PIN must be 4 to 6 digits.');
      return;
    }

    if (newPin !== confirmNewPin) {
      Alert.alert('PIN Mismatch', 'PIN and Confirm PIN do not match.');
      return;
    }

    try {
      setPinLoading(true);

      await api.post('/wallet/pin', { pin: newPin });

      setHasPin(true);
      setShowCreatePin(false);
      setNewPin('');
      setConfirmNewPin('');
      setPinStep('create');

      Alert.alert('Success', 'Transfer PIN created successfully.');
    } catch (error: any) {
      Alert.alert(
        'PIN Creation Failed',
        error?.response?.data?.message ||
          error?.message ||
          'Unable to create transfer PIN.'
      );
    } finally {
      setPinLoading(false);
    }
  }, [newPin, confirmNewPin]);

  /* =========================================================
     SEND MONEY
     ========================================================= */

  const sendMoney = useCallback(async () => {
    const numericAmount = Number(sendAmount.replace(/,/g, ''));
    const phone = recipientPhone.trim();
    const pin = sendPin.trim();

    if (!Number.isInteger(numericAmount) || numericAmount < 1) {
      Alert.alert('Invalid amount', 'Enter a valid whole naira amount.');
      return;
    }

    if (!phone) {
      Alert.alert('Recipient required', 'Enter the recipient phone number.');
      return;
    }

    if (!isValidPin(pin)) {
      Alert.alert('Wallet PIN required', 'Enter your 4 to 6 digit wallet PIN.');
      return;
    }

    if (numericAmount > balance) {
      Alert.alert(
        'Insufficient balance',
        'You do not have enough money in your wallet.'
      );
      return;
    }

    try {
      setSendLoading(true);

      const response = await api.post('/wallet/transfer', {
        amount: numericAmount,
        phone,
        pin,
      });

      const wallet = response?.data?.data?.wallet;

      if (wallet) {
        setBalance(Number(wallet.balance || 0));
        setTransactions(
          Array.isArray(wallet.transactions) ? wallet.transactions : []
        );
      }

      setShowSendMoney(false);
      setSendAmount('');
      setRecipientPhone('');
      setSendPin('');

      Alert.alert(
        'Transfer Successful',
        response?.data?.message || 'Money sent successfully.'
      );

      await loadWallet();
    } catch (error: any) {
      Alert.alert(
        'Transfer Failed',
        error?.response?.data?.message ||
          error?.message ||
          'Unable to send money.'
      );
    } finally {
      setSendLoading(false);
    }
  }, [sendAmount, recipientPhone, sendPin, balance, loadWallet]);

  /* =========================================================
     LOAD BANKS
     ========================================================= */

  const loadBanks = useCallback(async () => {
    try {
      setBankLoading(true);

      const token = await getStoredToken();
      if (!token) throw new Error('Authentication session not found');

      setAuthToken(token);

      const response = await api.get('/wallet/banks');

      const list =
        response?.data?.data?.banks || response?.data?.data || [];

      setBanks(Array.isArray(list) ? list : []);
    } catch (error: any) {
      Alert.alert(
        'Banks',
        error?.response?.data?.message ||
          error?.message ||
          'Unable to load Nigerian banks.'
      );
    } finally {
      setBankLoading(false);
    }
  }, []);

  /* =========================================================
     FILTERED BANKS (search)
     ========================================================= */

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return banks;

    return banks.filter((bank) => {
      const name = String(bank.name || bank.bank_name || '');
      return name.toLowerCase().includes(q);
    });
  }, [banks, bankSearch]);

  /* =========================================================
     SELECT BANK
     ========================================================= */

  const handleSelectBank = useCallback((bank: Bank) => {
    const name = String(bank.name || bank.bank_name || '');
    const code = String(bank.code || bank.bank_code || '');

    if (!name || !code) return;

    setSelectedBank({ name, code });
    setBankSearch(name);
    setBankDropdownOpen(false);
    setAccountName('');
  }, []);

  /* =========================================================
     AUTO VERIFY BANK ACCOUNT (debounced)
     ========================================================= */

  useEffect(() => {
    // Clear any pending debounce
    if (verifyTimeoutRef.current) {
      clearTimeout(verifyTimeoutRef.current);
      verifyTimeoutRef.current = null;
    }

    const trimmedAccount = accountNumber.trim();

    // Reset if prerequisites are missing
    if (!selectedBank?.code || !isValidAccountNumber(trimmedAccount)) {
      setAccountName('');
      setVerifyLoading(false);
      return;
    }

    // Debounce 600ms before hitting the API
    verifyTimeoutRef.current = setTimeout(async () => {
      const requestId = ++verifyRequestIdRef.current;

      try {
        setVerifyLoading(true);

        const response = await api.post('/wallet/banks/verify', {
          accountNumber: trimmedAccount,
          bankCode: selectedBank.code,
        });

        // Ignore stale responses
        if (requestId !== verifyRequestIdRef.current) return;

        const data = response?.data?.data;
        const resolvedName = data?.accountName || data?.account_name;

        if (!resolvedName) {
          setAccountName('');
          return;
        }

        setAccountName(String(resolvedName));
      } catch (error: any) {
        if (requestId !== verifyRequestIdRef.current) return;

        setAccountName('');

        Alert.alert(
          'Verification Failed',
          error?.response?.data?.message ||
            error?.message ||
            'Unable to verify this bank account.'
        );
      } finally {
        if (requestId === verifyRequestIdRef.current) {
          setVerifyLoading(false);
        }
      }
    }, 600);

    return () => {
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
        verifyTimeoutRef.current = null;
      }
    };
  }, [selectedBank, accountNumber]);

  /* =========================================================
     WITHDRAW
     ========================================================= */

  const withdrawMoney = useCallback(async () => {
    const numericAmount = Number(withdrawAmount.replace(/,/g, ''));
    const pin = withdrawPin.trim();

    if (!Number.isInteger(numericAmount) || numericAmount < 100) {
      Alert.alert(
        'Invalid amount',
        'Enter a valid withdrawal amount of at least ₦100.'
      );
      return;
    }

    if (numericAmount > balance) {
      Alert.alert(
        'Insufficient balance',
        'You do not have enough money in your wallet.'
      );
      return;
    }

    if (!selectedBank?.code) {
      Alert.alert('Select bank', 'Select your bank first.');
      return;
    }

    if (!isValidAccountNumber(accountNumber.trim())) {
      Alert.alert('Invalid account', 'Enter a valid 10 digit account number.');
      return;
    }

    if (!accountName.trim()) {
      Alert.alert(
        'Account not resolved',
        'Wait for the account name to appear before withdrawing.'
      );
      return;
    }

    if (!isValidPin(pin)) {
      Alert.alert('Wallet PIN required', 'Enter your 4 to 6 digit wallet PIN.');
      return;
    }

    try {
      setIsWithdrawLoading(true);

      const response = await api.post('/wallet/withdrawals', {
        amount: numericAmount,
        pin,
        bankName: selectedBank.name,
        bankCode: selectedBank.code,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
      });

      const wallet = response?.data?.data?.wallet;

      if (wallet) {
        setBalance(Number(wallet.balance || 0));
        setTransactions(
          Array.isArray(wallet.transactions) ? wallet.transactions : []
        );
      }

      setShowWithdraw(false);
      setWithdrawAmount('');
      setSelectedBank(null);
      setBankSearch('');
      setAccountNumber('');
      setAccountName('');
      setWithdrawPin('');

      Alert.alert(
        'Withdrawal Submitted',
        response?.data?.message ||
          'Your withdrawal has been submitted successfully.'
      );

      await loadWallet();
    } catch (error: any) {
      Alert.alert(
        'Withdrawal Failed',
        error?.response?.data?.message ||
          error?.message ||
          'Unable to process your withdrawal.'
      );
    } finally {
      setIsWithdrawLoading(false);
    }
  }, [
    withdrawAmount,
    withdrawPin,
    balance,
    selectedBank,
    accountNumber,
    accountName,
    loadWallet,
  ]);

  /* =========================================================
     TRANSACTION HELPERS
     ========================================================= */

  const transactionColor = (transaction: Transaction) =>
    transaction.type === 'credit' ? GREEN : RED;

  const transactionSign = (transaction: Transaction) =>
    transaction.type === 'credit' ? '+' : '-';

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={PURPLE} />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
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
            <Text style={styles.eyebrow}>KADUNA ONLY</Text>
            <Text style={styles.title}>My Wallet</Text>
          </View>
        </View>

        {/* BALANCE */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <Text style={styles.balance}>{formatMoney(balance)}</Text>

          <Pressable
            style={styles.topUpButton}
            onPress={() => setShowTopUp(true)}
          >
            <Text style={styles.topUpText}>+ Top Up Wallet</Text>
          </Pressable>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.actions}>
          <Pressable style={styles.actionCard} onPress={() => setShowTopUp(true)}>
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>+</Text>
            </View>
            <Text style={styles.actionTitle}>Top Up</Text>
            <Text style={styles.actionSubtitle}>Add money</Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              if (!requirePin()) return;
              setSendAmount('');
              setRecipientPhone('');
              setSendPin('');
              setShowSendMoney(true);
            }}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>→</Text>
            </View>
            <Text style={styles.actionTitle}>Send Money</Text>
            <Text style={styles.actionSubtitle}>To another user</Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={async () => {
              if (!requirePin()) return;
              setWithdrawAmount('');
              setSelectedBank(null);
              setBankSearch('');
              setAccountNumber('');
              setAccountName('');
              setWithdrawPin('');
              setBankDropdownOpen(false);
              setShowWithdraw(true);
              if (banks.length === 0) await loadBanks();
            }}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>₦</Text>
            </View>
            <Text style={styles.actionTitle}>Withdraw</Text>
            <Text style={styles.actionSubtitle}>To local bank</Text>
          </Pressable>
        </View>

        {/* REFRESH */}
        <Pressable style={styles.refreshAction} onPress={refreshWallet}>
          <Text style={styles.refreshActionText}>↻ Refresh Wallet</Text>
        </Pressable>

        {/* WALLET SECURITY CARD */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Wallet Security</Text>
        </View>

        <View style={styles.securityCard}>
          <View style={styles.securityLeft}>
            <View style={styles.securityIconCircle}>
              <Text style={styles.securityIconText}>🔒</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityTitle}>Transfer PIN</Text>
              <Text style={styles.securitySubtitle}>
                Protect your wallet transactions
              </Text>
            </View>
          </View>

          <Pressable
            style={[
              styles.securityButton,
              hasPin && styles.securityButtonActive,
            ]}
            onPress={() => {
              if (hasPin) {
                Alert.alert('PIN Active', 'Your transfer PIN is already set.');
              } else {
                setPinStep('create');
                setNewPin('');
                setConfirmNewPin('');
                setShowCreatePin(true);
              }
            }}
            disabled={hasPin}
          >
            <Text
              style={[
                styles.securityButtonText,
                hasPin && styles.securityButtonTextActive,
              ]}
            >
              {hasPin ? '✓ PIN Active' : 'Create Transfer PIN'}
            </Text>
          </Pressable>
        </View>

        {/* PAYMENT PENDING CARD */}
        {paymentReference && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>
              Payment awaiting confirmation
            </Text>
            <Text style={styles.pendingText}>
              Return from Paystack and confirm your payment below.
            </Text>
            <Text style={styles.reference}>Reference: {paymentReference}</Text>

            <Pressable
              style={styles.verifyButton}
              onPress={() => verifyPayment()}
              disabled={paymentChecking}
            >
              {paymentChecking ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.verifyText}>I've Completed Payment</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* TRANSACTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
        </View>

        <View style={styles.transactionsCard}>
          {transactions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyText}>
                Your wallet transactions will appear here.
              </Text>
            </View>
          ) : (
            transactions.slice(0, 20).map((transaction, index) => (
              <View
                key={`${transaction.reference || transaction.createdAt || 'tx'}-${index}`}
                style={[
                  styles.transactionRow,
                  index > 0 && styles.transactionBorder,
                ]}
              >
                <View
                  style={[
                    styles.transactionIcon,
                    {
                      backgroundColor:
                        transaction.type === 'credit' ? '#E7F7EF' : '#FDECEC',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.transactionIconText,
                      { color: transactionColor(transaction) },
                    ]}
                  >
                    {transactionSign(transaction)}
                  </Text>
                </View>

                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle} numberOfLines={1}>
                    {transaction.description || 'Wallet transaction'}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {transaction.createdAt
                      ? new Date(transaction.createdAt).toLocaleDateString(
                          'en-NG'
                        )
                      : ''}
                  </Text>
                </View>

                <View style={styles.transactionAmountContainer}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: transactionColor(transaction) },
                    ]}
                  >
                    {transactionSign(transaction)}
                    {formatMoney(Number(transaction.amount || 0))}
                  </Text>
                  <Text style={styles.transactionStatus}>
                    {transaction.status || 'success'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* =====================================================
          TOP UP MODAL
      ===================================================== */}
      <Modal
        visible={showTopUp}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopUp(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Top Up Wallet</Text>
            <Text style={styles.modalSubtitle}>
              Enter the amount you want to add to your Kaduna Only wallet.
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
              {[100, 500, 1000, 5000, 10000].map((value) => (
                <Pressable
                  key={value}
                  style={styles.amountChip}
                  onPress={() => setAmount(String(value))}
                >
                  <Text style={styles.amountChipText}>
                    ₦{value.toLocaleString()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.modalPrimary}
              onPress={initializeTopUp}
              disabled={topUpLoading}
            >
              {topUpLoading ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.modalPrimaryText}>
                  Continue to Paystack
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.modalCancel}
              onPress={() => setShowTopUp(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          SEND MONEY MODAL
      ===================================================== */}
      <Modal
        visible={showSendMoney}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSendMoney(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Send Money</Text>
            <Text style={styles.modalSubtitle}>
              Send money instantly to another Kaduna Only user.
            </Text>

            <TextInput
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="Recipient phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <TextInput
              value={sendAmount}
              onChangeText={setSendAmount}
              placeholder="Amount in Naira"
              placeholderTextColor="#999"
              keyboardType="numeric"
              style={styles.input}
            />

            <TextInput
              value={sendPin}
              onChangeText={setSendPin}
              placeholder="Wallet PIN"
              placeholderTextColor="#999"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              style={styles.input}
            />

            <Pressable
              style={styles.modalPrimary}
              onPress={sendMoney}
              disabled={sendLoading}
            >
              {sendLoading ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.modalPrimaryText}>Send Money</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.modalCancel}
              onPress={() => {
                setShowSendMoney(false);
                setSendAmount('');
                setRecipientPhone('');
                setSendPin('');
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          WITHDRAW MODAL
      ===================================================== */}
      <Modal
        visible={showWithdraw}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdraw(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'flex-end',
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Withdraw to Bank</Text>
              <Text style={styles.modalSubtitle}>
                Withdraw your Kaduna Only wallet balance to a Nigerian bank
                account. Minimum ₦100.
              </Text>

              {/* BANK DROPDOWN */}
              <Text style={[styles.modalSubtitle, { marginTop: 16 }]}>
                Select Bank
              </Text>

              <Pressable
                style={styles.dropdownTrigger}
                onPress={() => setBankDropdownOpen((v) => !v)}
              >
                <Text
                  style={
                    selectedBank
                      ? styles.dropdownSelected
                      : styles.dropdownPlaceholder
                  }
                  numberOfLines={1}
                >
                  {selectedBank ? selectedBank.name : 'Choose a bank'}
                </Text>
                <Text style={styles.dropdownChevron}>
                  {bankDropdownOpen ? '▲' : '▼'}
                </Text>
              </Pressable>

              {bankDropdownOpen && (
                <View style={styles.dropdownPanel}>
                  <TextInput
                    value={bankSearch}
                    onChangeText={setBankSearch}
                    placeholder="Search bank name"
                    placeholderTextColor="#999"
                    style={styles.dropdownSearch}
                  />

                  {bankLoading ? (
                    <ActivityIndicator
                      color={PURPLE}
                      style={{ marginVertical: 14 }}
                    />
                  ) : filteredBanks.length === 0 ? (
                    <Text style={styles.dropdownEmpty}>No banks found</Text>
                  ) : (
                    <ScrollView
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredBanks.map((bank, index) => {
                        const name = String(
                          bank.name || bank.bank_name || ''
                        );
                        const code = String(
                          bank.code || bank.bank_code || ''
                        );
                        const isSelected =
                          selectedBank?.code === code &&
                          selectedBank?.name === name;

                        return (
                          <Pressable
                            key={`${code || name || 'bank'}-${index}`}
                            onPress={() => handleSelectBank(bank)}
                            style={[
                              styles.dropdownItem,
                              isSelected && styles.dropdownItemSelected,
                            ]}
                          >
                            <Text style={styles.dropdownItemText}>{name}</Text>
                            {isSelected && (
                              <Text style={styles.dropdownItemCheck}>✓</Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* ACCOUNT NUMBER — auto-verify on 10 digits */}
              <TextInput
                value={accountNumber}
                onChangeText={(value) => {
                  setAccountNumber(value.replace(/\D/g, '').slice(0, 10));
                  setAccountName('');
                }}
                placeholder="10 digit account number"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={10}
                style={styles.input}
              />

              {/* AUTO-VERIFY LOADING / STATUS ROW */}
              {selectedBank?.code &&
                accountNumber.length === 10 &&
                verifyLoading && (
                  <View style={styles.resolvingRow}>
                    <ActivityIndicator size="small" color={PURPLE} />
                    <Text style={styles.resolvingText}>
                      Resolving account name…
                    </Text>
                  </View>
                )}

              {/* VERIFIED ACCOUNT */}
              {accountName ? (
                <View style={styles.verifiedBankCard}>
                  <Text style={styles.verifiedBankLabel}>Verified account</Text>
                  <Text style={styles.verifiedBankName}>{accountName}</Text>
                  <Text style={styles.verifiedBankNumber}>
                    {accountNumber} · {selectedBank?.name}
                  </Text>
                </View>
              ) : null}

              {/* AMOUNT */}
              <TextInput
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="Withdrawal amount (min ₦100)"
                placeholderTextColor="#999"
                keyboardType="numeric"
                style={styles.input}
              />

              {/* PIN */}
              <TextInput
                value={withdrawPin}
                onChangeText={setWithdrawPin}
                placeholder="Wallet PIN"
                placeholderTextColor="#999"
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                style={styles.input}
              />

              {/* WITHDRAW BUTTON */}
              <Pressable
                style={[
                  styles.modalPrimary,
                  (!accountName || isWithdrawLoading) && { opacity: 0.5 },
                ]}
                onPress={withdrawMoney}
                disabled={isWithdrawLoading || !accountName}
              >
                {isWithdrawLoading ? (
                  <ActivityIndicator color={WHITE} />
                ) : (
                  <Text style={styles.modalPrimaryText}>Withdraw Money</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setShowWithdraw(false);
                  setWithdrawAmount('');
                  setSelectedBank(null);
                  setBankSearch('');
                  setAccountNumber('');
                  setAccountName('');
                  setWithdrawPin('');
                  setBankDropdownOpen(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* =====================================================
          CREATE PIN MODAL
      ===================================================== */}
      <Modal
        visible={showCreatePin}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreatePin(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {pinStep === 'create' ? 'Create Transfer PIN' : 'Confirm PIN'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {pinStep === 'create'
                ? 'Choose a 4 to 6 digit PIN to protect your wallet transactions.'
                : 'Re-enter your PIN to confirm.'}
            </Text>

            {pinStep === 'create' ? (
              <TextInput
                value={newPin}
                onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 4-6 digit PIN"
                placeholderTextColor="#999"
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                style={styles.input}
              />
            ) : (
              <TextInput
                value={confirmNewPin}
                onChangeText={(v) =>
                  setConfirmNewPin(v.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Confirm your PIN"
                placeholderTextColor="#999"
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                style={styles.input}
              />
            )}

            {pinStep === 'create' ? (
              <Pressable
                style={styles.modalPrimary}
                onPress={() => {
                  if (!isValidPin(newPin)) {
                    Alert.alert('Invalid PIN', 'PIN must be 4 to 6 digits.');
                    return;
                  }
                  setPinStep('confirm');
                }}
              >
                <Text style={styles.modalPrimaryText}>Next</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.modalPrimary}
                onPress={submitCreatePin}
                disabled={pinLoading}
              >
                {pinLoading ? (
                  <ActivityIndicator color={WHITE} />
                ) : (
                  <Text style={styles.modalPrimaryText}>Create PIN</Text>
                )}
              </Pressable>
            )}

            <Pressable
              style={styles.modalCancel}
              onPress={() => {
                setShowCreatePin(false);
                setNewPin('');
                setConfirmNewPin('');
                setPinStep('create');
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          PIN REQUIRED MODAL
      ===================================================== */}
      <Modal
        visible={showPinRequired}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPinRequired(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Transfer PIN Required</Text>
            <Text style={styles.modalSubtitle}>
              Create your transfer PIN before sending money or making
              withdrawals.
            </Text>

            <Pressable
              style={styles.modalPrimary}
              onPress={() => {
                setShowPinRequired(false);
                setPinStep('create');
                setNewPin('');
                setConfirmNewPin('');
                setShowCreatePin(true);
              }}
            >
              <Text style={styles.modalPrimaryText}>Create PIN</Text>
            </Pressable>

            <Pressable
              style={styles.modalCancel}
              onPress={() => setShowPinRequired(false)}
            >
              <Text style={styles.modalCancelText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* =========================================================
   STYLES (unchanged Kaduna Only theme + new resolving row)
   ========================================================= */

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

  refreshAction: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
  },

  refreshActionText: {
    color: PURPLE,
    fontSize: 13,
    fontWeight: '800',
  },

  /* -------------------- SECURITY CARD -------------------- */

  securityCard: {
    backgroundColor: WHITE,
    borderRadius: 17,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEAF2',
  },

  securityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  securityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  securityIconText: {
    fontSize: 18,
  },

  securityTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },

  securitySubtitle: {
    marginTop: 3,
    color: MUTED,
    fontSize: 11,
  },

  securityButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  securityButtonActive: {
    backgroundColor: '#E7F7EF',
  },

  securityButtonText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
  },

  securityButtonTextActive: {
    color: GREEN,
  },

  /* -------------------- PENDING CARD ---------------------- */

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

  /* -------------------- SECTIONS -------------------------- */

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

  /* -------------------- MODALS ---------------------------- */

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

  /* -------------------- BANK DROPDOWN --------------------- */

  dropdownTrigger: {
    marginTop: 10,
    height: 54,
    borderWidth: 1,
    borderColor: '#DDD9E8',
    borderRadius: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: WHITE,
  },

  dropdownSelected: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
  },

  dropdownPlaceholder: {
    color: '#999',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },

  dropdownChevron: {
    color: PURPLE,
    fontSize: 12,
    fontWeight: '800',
  },

  dropdownPanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DDD9E8',
    borderRadius: 12,
    backgroundColor: WHITE,
    overflow: 'hidden',
  },

  dropdownSearch: {
    height: 46,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    color: TEXT,
    fontSize: 14,
  },

  dropdownEmpty: {
    padding: 16,
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
  },

  dropdownItem: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
    backgroundColor: WHITE,
  },

  dropdownItemSelected: {
    backgroundColor: '#F0EBFF',
  },

  dropdownItemText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },

  dropdownItemCheck: {
    color: PURPLE,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },

  /* -------------------- VERIFIED CARD --------------------- */

  verifiedBankCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F7F4FF',
    borderWidth: 1,
    borderColor: '#DDD3F5',
  },

  verifiedBankLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },

  verifiedBankName: {
    marginTop: 5,
    color: TEXT,
    fontSize: 15,
    fontWeight: '800',
  },

  verifiedBankNumber: {
    marginTop: 4,
    color: MUTED,
    fontSize: 13,
  },

  /* -------------------- RESOLVING ROW --------------------- */

  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },

  resolvingText: {
    marginLeft: 8,
    color: PURPLE,
    fontSize: 12,
    fontWeight: '700',
  },

  /* -------------------- AMOUNT CHIPS ---------------------- */

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

  /* -------------------- BUTTONS --------------------------- */

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

  modalSecondary: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F0EBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  modalSecondaryText: {
    color: PURPLE,
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