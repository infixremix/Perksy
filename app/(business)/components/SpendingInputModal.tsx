import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { auth, db } from '../../../src/config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface SpendingInputModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCustomer: any;
  onSuccess: (message: string) => void;
}

export default function SpendingInputModal({ visible, onClose, selectedCustomer, onSuccess }: SpendingInputModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [pointValue, setPointValue] = useState<number>(1); // Default to £1 = 1 point

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const businessDoc = await getDoc(doc(db, 'users', user.uid));
        if (businessDoc.exists()) {
          const businessData = businessDoc.data();
          if (businessData.loyaltyProgram?.pointValue) {
            setPointValue(businessData.loyaltyProgram.pointValue);
          }
        }
      } catch (error) {
        console.error('Error fetching business data:', error);
      }
    };

    fetchBusinessData();
  }, []);

  const handleSubmit = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Invalid Amount', 'Please enter a valid purchase amount');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in to continue');

      const spentAmount = parseFloat(amount);
      const pointsToAdd = Math.floor(spentAmount / pointValue); // Points based on business's point value

      const customerRef = doc(db, 'users', selectedCustomer.id);
      const businessRef = doc(db, 'users', user.uid);

      // Get business data for name
      const businessDoc = await getDoc(businessRef);
      if (!businessDoc.exists()) throw new Error('Business data not found');
      const businessData = businessDoc.data();

      const customerUpdateData = {
        [`rewards.${user.uid}`]: {
          businessName: businessData.businessName,
          points: (selectedCustomer.rewards?.[user.uid]?.points || 0) + pointsToAdd,
          lastUpdated: new Date().toISOString(),
        },
        recentActivity: [
          {
            id: Date.now().toString(),
            businessName: businessData.businessName,
            points: pointsToAdd,
            amount: spentAmount,
            date: new Date().toISOString(),
            type: 'earned',
          },
          ...(selectedCustomer.recentActivity || []).slice(0, 4),
        ],
      };

      const businessUpdateData = {
        recentActivity: [
          {
            title: `Points Added`,
            time: new Date().toISOString(),
            amount: `${pointsToAdd} points (£${spentAmount.toFixed(2)})`
          },
          ...(businessData.recentActivity || []).slice(0, 4)
        ]
      };

      await Promise.all([
        updateDoc(customerRef, customerUpdateData),
        updateDoc(businessRef, businessUpdateData)
      ]);

      onSuccess(`Added ${pointsToAdd} points for £${spentAmount.toFixed(2)} spent`);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to process points'
      );
    } finally {
      setLoading(false);
      setAmount('');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Purchase Amount</Text>
          <Text style={styles.modalDescription}>
            Please enter the total purchase amount.{'\n'}
            Points will be awarded at a rate of 1 point per £{pointValue.toFixed(2)} spent.
          </Text>
          <View style={styles.inputContainer}>
            <Text style={styles.poundSign}>£</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => {
                setAmount('');
                onClose();
              }}
              disabled={loading}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.modalButtonText}>
                {loading ? 'Processing...' : 'Add Points'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  modalDescription: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  poundSign: {
    fontSize: 24,
    color: '#333',
    marginRight: 5,
  },
  input: {
    flex: 1,
    fontSize: 24,
    padding: 10,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 