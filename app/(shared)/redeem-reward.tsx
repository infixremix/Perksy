import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Animated, Modal, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import QRCode from 'react-native-qrcode-svg';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

interface Reward {
  id: string;
  name: string;
  description: string;
  requiredPoints: string;
}

interface ErrorPopupProps {
  visible: boolean;
  message: string;
  onClose: () => void;
}

const ErrorPopup: React.FC<ErrorPopupProps> = ({ visible, message, onClose }) => {
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.errorContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle" size={32} color="#FF3B30" />
          </View>
          <Text style={styles.errorTitle}>Insufficient Points</Text>
          <Text style={styles.errorMessage}>{message}</Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={onClose}
          >
            <Text style={styles.errorButtonText}>Got It</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function RedeemReward() {
  const { businessId, rewardId } = useLocalSearchParams<{ businessId: string; rewardId: string }>();
  const [reward, setReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState('');
  const [errorPopup, setErrorPopup] = useState({
    visible: false,
    message: ''
  });
  const router = useRouter();

  const fetchRewardDetails = async () => {
    try {
      setLoading(true); // Ensure loading is set at start
      const user = auth.currentUser;
      if (!user) {
        setErrorPopup({
          visible: true,
          message: 'Please sign in to continue'
        });
        return;
      }

      // Get business data and user data in parallel
      const [businessDoc, userDoc] = await Promise.all([
        getDoc(doc(db, 'users', businessId)),
        getDoc(doc(db, 'users', user.uid))
      ]);

      if (!businessDoc.exists()) {
        setErrorPopup({
          visible: true,
          message: 'Business not found'
        });
        return;
      }

      if (!userDoc.exists()) {
        setErrorPopup({
          visible: true,
          message: 'User data not found'
        });
        return;
      }

      const businessData = businessDoc.data();
      const userData = userDoc.data();
      const rewardData = businessData.loyaltyProgram?.rewards?.find(
        (r: Reward) => r.id === rewardId
      );

      if (!rewardData) {
        setErrorPopup({
          visible: true,
          message: 'Reward not found'
        });
        return;
      }

      // Check if user has enough points
      const userPoints = userData.rewards?.[businessId]?.points || 0;
      if (userPoints < parseInt(rewardData.requiredPoints)) {
        setErrorPopup({
          visible: true,
          message: `You need ${rewardData.requiredPoints} points for this reward. You currently have ${userPoints} points.`
        });
        return;
      }

      setReward(rewardData);

      // Generate redemption code only if points check passes
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRedeemCode(code);

      await updateDoc(doc(db, 'users', user.uid), {
        activeRedemptions: arrayUnion({
          code,
          businessId,
          rewardId,
          timestamp: new Date().toISOString(),
          status: 'pending',
          requiredPoints: rewardData.requiredPoints
        })
      });
    } catch (error) {
      console.error('Error:', error);
      setErrorPopup({
        visible: true,
        message: 'Failed to prepare reward redemption'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewardDetails();
  }, [businessId, rewardId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A7EA4" />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        {reward && (
          <>
            <StatusBar style="dark" />
            
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
              </TouchableOpacity>
              <Text style={styles.title}>Redeem Reward</Text>
              <Text style={styles.subtitle}>Show this to the business to redeem your reward</Text>
            </View>

            {/* Reward Details */}
            <View style={styles.rewardCard}>
              <Text style={styles.rewardName}>{reward.name}</Text>
              <Text style={styles.rewardDescription}>{reward.description}</Text>
              <Text style={styles.requiredPoints}>{reward.requiredPoints} points</Text>
            </View>

            {/* QR Code */}
            <View style={styles.qrContainer}>
              <QRCode
                value={redeemCode}
                size={200}
              />
              <Text style={styles.qrCodeText}>{redeemCode}</Text>
              <Text style={styles.qrInstructions}>
                Show this QR code or enter the code above to the business
              </Text>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>How to redeem</Text>
              <Text style={styles.instructionsText}>
                1. Show this screen to the business{'\n'}
                2. They will scan the QR code or enter the code{'\n'}
                3. Once verified, your reward will be redeemed{'\n'}
                4. The business will confirm when it's done
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      <ErrorPopup 
        visible={errorPopup.visible}
        message={errorPopup.message}
        onClose={() => {
          setErrorPopup({ visible: false, message: '' });
          router.back();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  rewardName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  rewardDescription: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 12,
  },
  requiredPoints: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A7EA4',
  },
  qrContainer: {
    alignItems: 'center',
    padding: 20,
  },
  qrCodeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    letterSpacing: 4,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  instructionsContainer: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    margin: 20,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
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
  errorIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF1F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: '#0A7EA4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 