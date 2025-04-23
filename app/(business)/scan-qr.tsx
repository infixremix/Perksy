import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Button, Modal, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, FirestoreError } from 'firebase/firestore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import SpendingInputModal from './components/SpendingInputModal';

interface CustomerData {
  id: string;
  type: 'consumer';
  cardNumber?: string;
  firstName?: string;
  lastName?: string;
  rewards?: Record<string, { 
    points: number;
    businessName: string;
  }>;
  recentActivity?: Array<{
    id: string;
    businessName: string;
    points: number;
    date: string;
    type: 'earned' | 'redeemed';
    rewardName?: string;
    amount?: number;
  }>;
  [key: string]: any;
}

interface BusinessData {
  businessName: string;
  loyaltyProgram?: {
    type: 'stamps' | 'monetary';
    pointValue?: number;
    rewards: Array<{
      id: string;
      name: string;
      description: string;
      requiredPoints: string;
    }>;
  };
  recentActivity?: Array<{
    title: string;
    time: string;
    amount: string;
  }>;
}

type NotificationType = 'success' | 'error';

interface NotificationState {
  message: string;
  type: NotificationType;
  show: boolean;
}

export default function ScanQR() {
  const [loading, setLoading] = useState(false);
  const [showSpendingInput, setShowSpendingInput] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    title: string;
    message: string;
    type: 'redemption' | 'loyalty' | null;
    reward?: any;
    customerName?: string;
  } | null>(null);
  const [scannedData, setScannedData] = useState<{ type: string; data: string } | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [notification, setNotification] = useState<NotificationState>({
    message: '',
    type: 'success',
    show: false
  });
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    if (notification.show) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // After 2 seconds, fade out
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setNotification(prev => ({ ...prev, show: false, message: '' }));
          if (notification.type === 'success') {
            resetScanState();
          } else {
            setScanned(false);
          }
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  const resetScanState = () => {
    setScanned(false);
    setShowConfirmation(false);
    setScannedData(null);
    setSelectedCustomer(null);
    setConfirmationData(null);
  };

  const showNotification = (message: string, type: NotificationType) => {
    setNotification({
      message,
      type,
      show: true
    });
  };

  const handleSuccess = (message: string) => {
    showNotification(message, 'success');
  };

  const handleError = (error: unknown) => {
    const message = error instanceof Error 
      ? error.message 
      : typeof error === 'string'
        ? error
        : 'An error occurred';
    showNotification(message, 'error');
  };

  const getCustomerDisplayName = (customerData: CustomerData) => {
    if (customerData.firstName && customerData.lastName) {
      return `${customerData.firstName} ${customerData.lastName}`;
    }
    return 'Customer';
  };

  const validateRedemption = async (customerData: any, redemption: any) => {
    // Check if customer has enough points
    const customerPoints = customerData.rewards?.[auth.currentUser?.uid]?.points || 0;
    const requiredPoints = parseInt(redemption.requiredPoints);
    
    if (customerPoints < requiredPoints) {
      throw new Error(`Customer does not have enough points. Required: ${requiredPoints}, Available: ${customerPoints}`);
    }
    
    return true;
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScannedData({ type, data });
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Please sign in to continue');
      }

      // Get business data
      const businessDocRef = doc(db, 'users', user.uid);
      const businessDoc = await getDoc(businessDocRef);
      if (!businessDoc.exists()) {
        throw new Error('Business data not found');
      }

      const businessData = businessDoc.data() as BusinessData;

      // Validate QR code format first
      if (data.length !== 6 && data.length !== 16) {
        throw new Error('Invalid QR code format');
      }

      // Handle redemption code (6 digits)
      if (data.length === 6) {
        const usersRef = collection(db, 'users');
        const redemptionQuery = query(
          usersRef,
          where('type', '==', 'consumer')
        );

        const redemptionSnapshot = await getDocs(redemptionQuery);
        if (!redemptionSnapshot.empty) {
          let customerDoc = null;
          let redemption = null;

          for (const doc of redemptionSnapshot.docs) {
            const customerData = doc.data() as CustomerData;
            if (customerData.activeRedemptions) {
              const foundRedemption = customerData.activeRedemptions.find(
                (r: any) => r.code === data && r.status === 'pending'
              );
              if (foundRedemption) {
                customerDoc = doc;
                redemption = foundRedemption;
                break;
              }
            }
          }

          if (customerDoc && redemption) {
            const customerData = customerDoc.data() as CustomerData;
            const customerName = getCustomerDisplayName(customerData);
            
            const reward = businessData.loyaltyProgram?.rewards?.find(
              (r: any) => r.id === redemption.rewardId
            );

            if (reward) {
              await validateRedemption(customerData, redemption);
              setConfirmationData({
                type: 'redemption',
                title: 'Reward Redemption',
                message: `${customerName} would like to redeem:\n\n${reward.name}`,
                reward,
                customerName
              });
              setShowConfirmation(true);
              return;
            }
          }
        }
        throw new Error('Invalid or expired redemption code');
      }

      // Handle loyalty card code (16 digits)
      if (data.length === 16) {
        const usersRef = collection(db, 'users');
        const customerQuery = query(
          usersRef,
          where('type', '==', 'consumer'),
          where('cardNumber', '==', data)
        );

        const customerSnapshot = await getDocs(customerQuery);
        if (!customerSnapshot.empty) {
          const customerDoc = customerSnapshot.docs[0];
          const customerData = customerDoc.data() as CustomerData;

          if (businessData.loyaltyProgram?.type !== 'monetary') {
            // For stamps, show simple confirmation
            setConfirmationData({
              type: 'loyalty',
              title: 'Add Stamp',
              message: 'Add 1 stamp to this loyalty card?',
              customerName: 'Customer'
            });
            setShowConfirmation(true);
          } else {
            setSelectedCustomer({ 
              ...customerData,
              id: customerDoc.id
            });
            setShowSpendingInput(true);
          }
          return;
        }
        throw new Error('Customer not found');
      }

      throw new Error('Invalid QR code format');
    } catch (error) {
      handleError(error);
      setScanned(false);
    }
  };

  const handleConfirmScan = async () => {
    if (!scannedData || !confirmationData) return;
    setShowConfirmation(false);
    setLoading(true);

    try {
      const { data } = scannedData;
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in to continue');

      // Get business data first
      const businessDocRef = doc(db, 'users', user.uid);
      const businessDoc = await getDoc(businessDocRef);
      if (!businessDoc.exists()) throw new Error('Business data not found');
      const businessData = businessDoc.data() as BusinessData;

      if (confirmationData.type === 'redemption') {
        // Process redemption logic
        const usersRef = collection(db, 'users');
        const redemptionQuery = query(
          usersRef,
          where('type', '==', 'consumer')
        );

        const redemptionSnapshot = await getDocs(redemptionQuery);
        const customerDoc = redemptionSnapshot.docs.find(doc => {
          const customerData = doc.data();
          return customerData.activeRedemptions?.some(
            (r: any) => r.code === data && r.status === 'pending'
          );
        });

        if (customerDoc) {
          const customerData = customerDoc.data() as CustomerData;
          const redemption = customerData.activeRedemptions.find(
            (r: any) => r.code === data && r.status === 'pending'
          );

          if (!redemption || !confirmationData.reward) throw new Error('Redemption data not found');

          await validateRedemption(customerData, redemption);

          // Update customer document
          const customerUpdateData = {
            [`rewards.${user.uid}.points`]: customerData.rewards?.[user.uid]?.points - parseInt(redemption.requiredPoints),
            [`rewards.${user.uid}.businessName`]: businessData.businessName,
            recentActivity: [
              {
                id: Date.now().toString(),
                businessName: businessData.businessName,
                points: parseInt(redemption.requiredPoints),
                date: new Date().toISOString(),
                type: 'redeemed',
                rewardName: confirmationData.reward.name
              },
              ...(customerData.recentActivity || []).slice(0, 4)
            ],
            activeRedemptions: customerData.activeRedemptions.map((r: any) => 
              r.code === data ? { ...r, status: 'completed' } : r
            )
          };

          // Update business document
          const businessUpdateData = {
            recentActivity: [
              {
                title: `Reward Redeemed: ${confirmationData.reward.name}`,
                time: new Date().toISOString(),
                amount: `${parseInt(redemption.requiredPoints)} points`
              },
              ...(businessData.recentActivity || []).slice(0, 4)
            ]
          };

          await Promise.all([
            updateDoc(customerDoc.ref, customerUpdateData),
            updateDoc(businessDocRef, businessUpdateData)
          ]);

          handleSuccess(`Successfully redeemed "${confirmationData.reward.name}"`);
        }
      } else if (confirmationData.type === 'loyalty') {
        // Process loyalty stamp logic
        const usersRef = collection(db, 'users');
        const customerQuery = query(
          usersRef,
          where('type', '==', 'consumer'),
          where('cardNumber', '==', data)
        );

        const customerSnapshot = await getDocs(customerQuery);
        if (!customerSnapshot.empty) {
          const customerDoc = customerSnapshot.docs[0];
          const customerData = customerDoc.data() as CustomerData;
          const currentPoints = customerData.rewards?.[user.uid]?.points || 0;

          // Update customer document
          const customerUpdateData = {
            [`rewards.${user.uid}`]: {
              points: currentPoints + 1,
              businessName: businessData.businessName,
              lastUpdated: new Date().toISOString()
            },
            recentActivity: [
              {
                id: Date.now().toString(),
                businessName: businessData.businessName,
                points: 1,
                date: new Date().toISOString(),
                type: 'earned'
              },
              ...(customerData.recentActivity || []).slice(0, 4)
            ]
          };

          // Update business document
          const businessUpdateData = {
            recentActivity: [
              {
                title: 'Stamp Added',
                time: new Date().toISOString(),
                amount: '1 stamp'
              },
              ...(businessData.recentActivity || []).slice(0, 4)
            ]
          };

          await Promise.all([
            updateDoc(customerDoc.ref, customerUpdateData),
            updateDoc(businessDocRef, businessUpdateData)
          ]);

          handleSuccess('Successfully added 1 stamp to loyalty card');
        }
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', color: '#fff' }}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', color: '#fff' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr"]
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.scanArea} />
              <Text style={styles.scanText}>Position QR code within the frame</Text>
              <TouchableOpacity 
                style={styles.manualEntryButton}
                onPress={() => router.push('/(business)/scan-customer')}
              >
                <Text style={styles.manualEntryText}>CAN'T SCAN QR CODE?</Text>
                <Text style={styles.manualEntrySubtext}>ENTER CODE MANUALLY</Text>
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      )}

      {/* Notification Banner */}
      {notification.show && (
        <Animated.View 
          style={[
            styles.notificationContainer,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0]
                })
              }]
            }
          ]}
        >
          <View style={[
            styles.notificationContent,
            notification.type === 'error' ? styles.errorContent : styles.successContent
          ]}>
            <Ionicons 
              name={notification.type === 'error' ? "close-circle" : "checkmark-circle"} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.notificationText}>{notification.message}</Text>
          </View>
        </Animated.View>
      )}

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmation}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{confirmationData?.title || 'Confirm'}</Text>
            <Text style={styles.modalText}>{confirmationData?.message || ''}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={resetScanState}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleConfirmScan}
              >
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SpendingInputModal
        visible={showSpendingInput}
        onClose={() => {
          setShowSpendingInput(false);
          resetScanState();
        }}
        selectedCustomer={selectedCustomer}
        onSuccess={(message: string) => {
          setShowSpendingInput(false);
          handleSuccess(message);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  scanText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  modalButtonCancel: {
    backgroundColor: '#ff4444',
  },
  modalButtonConfirm: {
    backgroundColor: '#00C851',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666666', // Dark gray for cancel button
  },
  notificationContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  notificationContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successContent: {
    backgroundColor: '#4CAF50',
  },
  errorContent: {
    backgroundColor: '#F44336',
  },
  notificationText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  manualEntryButton: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  manualEntryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  manualEntrySubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.4,
  }
});