import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, FirestoreError } from 'firebase/firestore';

export default function ScanCustomer() {
  const [customerCode, setCustomerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [spendingAmount, setSpendingAmount] = useState('');
  const [showSpendingInput, setShowSpendingInput] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    if (customerCode.length !== 6 && customerCode.length !== 16) {
      Alert.alert('Error', 'Please enter a valid code (6 digits for redemption, 16 digits for loyalty card)');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Please sign in to continue');
        return;
      }

      console.log('Current user:', user.uid);

      // Get business data
      const businessDocRef = doc(db, 'users', user.uid);
      console.log('Business doc ref:', businessDocRef);
      
      const businessDoc = await getDoc(businessDocRef);
      if (!businessDoc.exists()) {
        Alert.alert('Error', 'Business data not found');
        return;
      }

      const businessData = businessDoc.data();
      console.log('Business data:', businessData);

      // Check if this is a redemption code
      if (customerCode.length === 6) {
        // Find customer with this redemption code
        const usersRef = collection(db, 'users');
        const redemptionQuery = query(
          usersRef,
          where('type', '==', 'consumer')
        );

        const redemptionSnapshot = await getDocs(redemptionQuery);
        if (redemptionSnapshot.empty) {
          Alert.alert('Error', 'No customers found');
          return;
        }

        // Find the customer with the matching redemption code
        let customerDoc = null;
        let redemption = null;

        for (const doc of redemptionSnapshot.docs) {
          const data = doc.data();
          if (data.activeRedemptions) {
            const foundRedemption = data.activeRedemptions.find(
              (r: any) => r.code === customerCode && r.status === 'pending'
            );
            if (foundRedemption) {
              customerDoc = doc;
              redemption = foundRedemption;
              break;
            }
          }
        }

        if (!customerDoc || !redemption) {
          Alert.alert('Error', 'Invalid or expired redemption code');
          return;
        }

        if (redemption.businessId !== user.uid) {
          Alert.alert('Error', 'This redemption code is for a different business');
          return;
        }

        const customerData = customerDoc.data();

        // Get the reward details
        const reward = businessData.loyaltyProgram?.rewards?.find(
          (r: any) => r.id === redemption.rewardId
        );

        if (!reward) {
          Alert.alert('Error', 'Reward not found');
          return;
        }

        // Validate points before proceeding
        await validatePoints(customerData, reward);

        // Update customer's points and add to recent activity
        const updateData = {
          [`rewards.${user.uid}.points`]: customerData.rewards[user.uid].points - parseInt(reward.requiredPoints),
          recentActivity: [
            {
              id: Date.now().toString(),
              businessName: businessData.businessName,
              points: parseInt(reward.requiredPoints),
              date: new Date().toISOString(),
              type: 'redeemed',
              rewardName: reward.name
            },
            ...(customerData.recentActivity || [])
          ].slice(0, 10),
          activeRedemptions: customerData.activeRedemptions.map((r: any) => 
            r.code === customerCode ? { ...r, status: 'completed' } : r
          )
        };

        await updateDoc(customerDoc.ref, updateData);

        Alert.alert(
          'Success',
          `Reward "${reward.name}" has been redeemed successfully`
        );
        setCustomerCode('');
        return;
      }

      // Handle loyalty card code
      if (!businessData.loyaltyProgram) {
        Alert.alert('Error', 'Please set up your loyalty program first');
        return;
      }

      // Find customer by card number
      try {
        const usersRef = collection(db, 'users');
        console.log('Users collection ref:', usersRef);

        // Query for consumer with matching card number
        const customerQuery = query(
          usersRef,
          where('type', '==', 'consumer'),
          where('cardNumber', '==', customerCode)
        );
        console.log('Customer query:', customerQuery);

        const customerSnapshot = await getDocs(customerQuery);
        console.log('Customer snapshot:', customerSnapshot.empty ? 'empty' : 'found');

        if (customerSnapshot.empty) {
          Alert.alert('Error', 'Customer not found');
          return;
        }

        const customerDoc = customerSnapshot.docs[0];
        const customerData = customerDoc.data();
        console.log('Customer data:', customerData);

        setSelectedCustomer({ doc: customerDoc, data: customerData });
        
        // Only show spending input for monetary programs
        if (businessData.loyaltyProgram.type === 'monetary') {
          setShowSpendingInput(true);
        } else {
          // For stamps, add points directly
          const updateData = {
            [`rewards.${user.uid}`]: {
              businessName: businessData.businessName,
              points: (customerData.rewards?.[user.uid]?.points || 0) + 1,
              lastUpdated: new Date().toISOString(),
            },
            recentActivity: [
              {
                id: Date.now().toString(),
                businessName: businessData.businessName,
                points: 1,
                date: new Date().toISOString(),
                type: 'earned'
              },
              ...(customerData.recentActivity || [])
            ].slice(0, 10)
          };

          await updateDoc(customerDoc.ref, updateData);
          Alert.alert('Success', 'Added 1 stamp to customer\'s account');
          setCustomerCode('');
          setSelectedCustomer(null);
        }
        return;
      } catch (queryError: any) {
        console.error('Query error:', queryError);
        if (queryError instanceof FirestoreError) {
          Alert.alert('Error', `Database error: ${queryError.message}`);
        } else {
          Alert.alert('Error', 'Failed to process customer code');
        }
      }
    } catch (error: any) {
      console.error('Error processing customer code:', error);
      Alert.alert('Error', `Failed to process customer code: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSpendingSubmit = async () => {
    if (!selectedCustomer || !spendingAmount) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const businessDoc = await getDoc(doc(db, 'users', user.uid));
      if (!businessDoc.exists()) return;

      const businessData = businessDoc.data();
      const pointValue = businessData.loyaltyProgram.pointValue || 0.01; // Default to 1p per point
      const pointsToAdd = Math.floor(parseFloat(spendingAmount) / pointValue);

      // Update customer's points/stamps for this business
      const rewardsUpdate = {
        businessName: businessData.businessName,
        points: (selectedCustomer.data.rewards?.[user.uid]?.points || 0) + pointsToAdd,
        lastUpdated: new Date().toISOString(),
      };

      const updateData: any = {
        [`rewards.${user.uid}`]: rewardsUpdate,
        recentActivity: [
          {
            id: Date.now().toString(),
            businessName: businessData.businessName,
            points: pointsToAdd,
            date: new Date().toISOString(),
            type: 'earned',
            spendingAmount: parseFloat(spendingAmount)
          },
          ...(selectedCustomer.data.recentActivity || [])
        ].slice(0, 5)
      };

      await updateDoc(selectedCustomer.doc.ref, updateData);

      Alert.alert(
        'Success',
        `Added ${pointsToAdd} points to customer's account (${spendingAmount} spent)`
      );
      setCustomerCode('');
      setSpendingAmount('');
      setShowSpendingInput(false);
      setSelectedCustomer(null);
    } catch (error: any) {
      console.error('Error updating points:', error);
      Alert.alert('Error', 'Failed to update points');
    } finally {
      setLoading(false);
    }
  };

  // Add validation before processing
  const validatePoints = async (customerData: any, reward: any) => {
    const customerPoints = customerData.rewards?.[auth.currentUser?.uid]?.points || 0;
    const requiredPoints = parseInt(reward.requiredPoints);
    
    if (customerPoints < requiredPoints) {
      throw new Error(`Customer does not have enough points. Required: ${requiredPoints}, Available: ${customerPoints}`);
    }
    
    return true;
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>Enter Code</Text>
        <Text style={styles.subtitle}>Enter the customer's loyalty card code or redemption code</Text>
      </View>

      {/* Input Section */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={customerCode}
          onChangeText={setCustomerCode}
          placeholder="Enter code"
          keyboardType="numeric"
          maxLength={16}
        />
        <TouchableOpacity 
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <Text style={styles.submitButtonText}>Processing...</Text>
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Spending Amount Input */}
      {showSpendingInput && (
        <View style={styles.spendingContainer}>
          <Text style={styles.spendingTitle}>Enter Spending Amount</Text>
          <View style={styles.spendingInputContainer}>
            <Text style={styles.poundSymbol}>£</Text>
            <TextInput
              style={styles.spendingInput}
              value={spendingAmount}
              onChangeText={setSpendingAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#666666"
            />
          </View>
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSpendingSubmit}
            disabled={loading || !spendingAmount}
          >
            {loading ? (
              <Text style={styles.submitButtonText}>Processing...</Text>
            ) : (
              <Text style={styles.submitButtonText}>Add Points</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Instructions</Text>
        <Text style={styles.instructionsText}>
          1. For loyalty points:{'\n'}
          - Ask the customer to show their loyalty card{'\n'}
          - Enter the 16-digit code shown on their card{'\n'}
          {'\n'}
          2. For reward redemption:{'\n'}
          - Ask the customer to show their redemption screen{'\n'}
          - Enter the 6-digit code shown on their screen{'\n'}
          {'\n'}
          3. Submit to process the code{'\n'}
          4. The customer will see their updated balance in their app
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  inputContainer: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#0A7EA4',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  spendingContainer: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    margin: 20,
    borderRadius: 8,
  },
  spendingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  spendingInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  poundSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginRight: 8,
  },
  spendingInput: {
    flex: 1,
    fontSize: 18,
    color: '#1A1A1A',
  },
}); 