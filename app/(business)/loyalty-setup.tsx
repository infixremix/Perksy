import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

type LoyaltyType = 'stamps' | 'monetary' | null;
type Mode = 'setup' | 'edit';

interface SearchParams {
  mode?: Mode;
  type?: LoyaltyType;
}

export default function LoyaltySetup() {
  const params = useLocalSearchParams<SearchParams>();
  const { mode, type } = params;
  const [loyaltyType, setLoyaltyType] = useState<LoyaltyType>(type || null);
  const [rewards, setRewards] = useState<Array<{
    id: string;
    name: string;
    description: string;
    requiredPoints: string;
  }>>([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [pointValue, setPointValue] = useState('0.01');
  const [businessData, setBusinessData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (mode === 'edit') {
      fetchLoyaltyProgram();
    }
  }, [mode]);

  const fetchLoyaltyProgram = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setBusinessData(data);
        if (data.loyaltyProgram) {
          setLoyaltyType(data.loyaltyProgram.type);
          setRewards(data.loyaltyProgram.rewards || []);
          if (data.loyaltyProgram.pointValue) {
            setPointValue(data.loyaltyProgram.pointValue.toString());
          }
        }
      }
    } catch (error) {
      console.error('Error fetching loyalty program:', error);
      Alert.alert('Error', 'Failed to load loyalty program');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get current program data
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;

      const currentData = userDoc.data();
      const currentProgram = currentData.loyaltyProgram || {};

      // Update the program
      await updateDoc(doc(db, 'users', user.uid), {
        loyaltyProgram: {
          ...currentProgram,
          type: loyaltyType,
          pointValue: loyaltyType === 'monetary' ? parseFloat(pointValue) : null
        },
      });

      router.back();
    } catch (error) {
      console.error('Error saving loyalty program:', error);
      Alert.alert('Error', 'Failed to save loyalty program');
    }
  };

  const handleContinue = () => {
    if (loyaltyType === 'stamps') {
      router.push('/(business)/rewards-setup?type=stamps&mode=' + (mode || 'setup'));
    } else if (loyaltyType === 'monetary') {
      router.push('/(business)/rewards-setup?type=monetary&mode=' + (mode || 'setup'));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

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
        <Text style={styles.title}>
          {mode === 'edit' ? 'Edit Loyalty Program' : 'Set Up Loyalty Program'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'edit' 
            ? 'Update your loyalty program settings'
            : 'Choose how customers earn rewards'}
        </Text>
      </View>

      {/* Program Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Program Type</Text>
        <View style={styles.optionsContainer}>
          {/* Stamps Option */}
          <TouchableOpacity 
            style={[
              styles.optionCard,
              loyaltyType === 'stamps' && styles.optionCardSelected
            ]}
            onPress={() => setLoyaltyType('stamps')}
          >
            <View style={styles.optionIcon}>
              <Ionicons 
                name="card-outline" 
                size={32} 
                color={loyaltyType === 'stamps' ? '#0A7EA4' : '#666666'} 
              />
            </View>
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionTitle,
                loyaltyType === 'stamps' && styles.optionTitleSelected
              ]}>
                Stamps
              </Text>
              <Text style={styles.optionDescription}>
                Customers earn stamps for each visit. Great for cafes and small businesses.
              </Text>
              <View style={styles.exampleContainer}>
                <Text style={styles.exampleTitle}>Example:</Text>
                <Text style={styles.exampleText}>1 visit = 1 stamp</Text>
              </View>
            </View>
            <View style={[
              styles.checkmark,
              loyaltyType === 'stamps' && styles.checkmarkSelected
            ]}>
              <Ionicons 
                name="checkmark" 
                size={20} 
                color={loyaltyType === 'stamps' ? '#FFFFFF' : '#E5E5E5'} 
              />
            </View>
          </TouchableOpacity>

          {/* Monetary Option */}
          <TouchableOpacity 
            style={[
              styles.optionCard,
              loyaltyType === 'monetary' && styles.optionCardSelected
            ]}
            onPress={() => setLoyaltyType('monetary')}
          >
            <View style={styles.optionIcon}>
              <Ionicons 
                name="cash" 
                size={32} 
                color={loyaltyType === 'monetary' ? '#0A7EA4' : '#666666'} 
              />
            </View>
            <View style={styles.optionContent}>
              <Text style={[
                styles.optionTitle,
                loyaltyType === 'monetary' && styles.optionTitleSelected
              ]}>
                Monetary Value
              </Text>
              <Text style={styles.optionDescription}>
                Customers earn points based on their spending. Great for retail and restaurants.
              </Text>
              <View style={styles.exampleContainer}>
                <Text style={styles.exampleTitle}>Example:</Text>
                <Text style={styles.exampleText}>£1 spent = 1 point</Text>
              </View>
            </View>
            <View style={[
              styles.checkmark,
              loyaltyType === 'monetary' && styles.checkmarkSelected
            ]}>
              <Ionicons 
                name="checkmark" 
                size={20} 
                color={loyaltyType === 'monetary' ? '#FFFFFF' : '#E5E5E5'} 
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Point Value Input for Monetary Type */}
        {loyaltyType === 'monetary' && (
          <View style={styles.pointValueContainer}>
            <Text style={styles.pointValueLabel}>Point Value</Text>
            <View style={styles.pointValueInputContainer}>
              <Text style={styles.pointValueText}>£</Text>
              <TextInput
                style={styles.pointValueInput}
                value={pointValue}
                onChangeText={setPointValue}
                keyboardType="numeric"
                placeholder="1.00"
                placeholderTextColor="#666666"
              />
              <Text style={styles.pointValueText}>= 1 point</Text>
            </View>
            <Text style={styles.pointValueDescription}>
              How much does a customer need to spend to earn 1 point?
            </Text>
            <View style={styles.conversionExample}>
              <Text style={styles.conversionExampleTitle}>Example:</Text>
              <Text style={styles.conversionExampleText}>
                If set to £1.00: £1 spent = 1 point{'\n'}
                If set to £3.00: £3 spent = 1 point
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {mode === 'edit' ? (
          <>
            <TouchableOpacity 
              style={[
                styles.continueButton,
                !loyaltyType && styles.continueButtonDisabled
              ]}
              onPress={handleSave}
              disabled={!loyaltyType}
            >
              <Text style={styles.continueButtonText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.editRewardsButton}
              onPress={() => router.push('/(business)/rewards-setup?type=' + (loyaltyType || 'stamps') + '&mode=edit')}
            >
              <Text style={styles.editRewardsButtonText}>Edit Rewards</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity 
            style={[
              styles.continueButton,
              !loyaltyType && styles.continueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={!loyaltyType}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        )}
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
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  optionsContainer: {
    padding: 24,
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  optionCardSelected: {
    borderColor: '#0A7EA4',
    backgroundColor: '#F8FDFF',
  },
  optionIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#F5F5F5',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  optionTitleSelected: {
    color: '#0A7EA4',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  exampleContainer: {
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 8,
  },
  exampleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  checkmarkSelected: {
    backgroundColor: '#0A7EA4',
  },
  continueButton: {
    backgroundColor: '#0A7EA4',
    margin: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  pointValueContainer: {
    padding: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    margin: 24,
  },
  pointValueLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  pointValueInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  pointValueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  pointValueInput: {
    flex: 1,
    fontSize: 18,
    color: '#1A1A1A',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  pointValueDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  conversionExample: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  conversionExampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  conversionExampleText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 24,
    gap: 12,
  },
  editRewardsButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0A7EA4',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  editRewardsButtonText: {
    color: '#0A7EA4',
    fontSize: 16,
    fontWeight: '600',
  },
}); 