import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface Reward {
  id: string;
  name: string;
  description: string;
  requiredPoints: string;
}

type Mode = 'setup' | 'edit';

export default function RewardsSetup() {
  const { type, mode } = useLocalSearchParams<{ type: 'stamps' | 'monetary'; mode?: Mode }>();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [newReward, setNewReward] = useState<Partial<Reward>>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const router = useRouter();

  useEffect(() => {
    if (mode === 'edit') {
      fetchRewards();
    }
  }, [mode]);

  const fetchRewards = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.loyaltyProgram?.rewards) {
          setRewards(data.loyaltyProgram.rewards);
        }
      }
    } catch (error) {
      console.error('Error fetching rewards:', error);
      Alert.alert('Error', 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleAddReward = () => {
    if (!newReward.name || !newReward.description || !newReward.requiredPoints) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setRewards([
      ...rewards,
      {
        id: Date.now().toString(),
        name: newReward.name,
        description: newReward.description,
        requiredPoints: newReward.requiredPoints,
      },
    ]);

    setNewReward({});
  };

  const handleRemoveReward = (id: string) => {
    setRewards(rewards.filter(reward => reward.id !== id));
  };

  const handleSave = async () => {
    if (rewards.length === 0) {
      Alert.alert('Error', 'Please add at least one reward');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, 'users', user.uid), {
        loyaltyProgram: {
          type,
          rewards,
        },
      });

      router.push('/(business)/business');
    } catch (error) {
      console.error('Error saving rewards:', error);
      Alert.alert('Error', 'Failed to save rewards');
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
          {mode === 'edit' ? 'Edit Rewards' : 'Set Up Rewards'}
        </Text>
        <Text style={styles.subtitle}>
          {type === 'stamps' 
            ? 'How many stamps needed for each reward?' 
            : 'How many points needed for each reward?'}
        </Text>
      </View>

      {/* Rewards List */}
      <View style={styles.rewardsContainer}>
        {rewards.map((reward) => (
          <View key={reward.id} style={styles.rewardCard}>
            <View style={styles.rewardContent}>
              <Text style={styles.rewardName}>{reward.name}</Text>
              <Text style={styles.rewardDescription}>{reward.description}</Text>
              <View style={styles.pointsContainer}>
                <Text style={styles.pointsLabel}>
                  {type === 'stamps' ? 'Required Stamps:' : 'Required Points:'}
                </Text>
                <Text style={styles.pointsValue}>{reward.requiredPoints}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => handleRemoveReward(reward.id)}
              style={styles.removeButton}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Add New Reward Form */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Add New Reward</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Reward Name</Text>
          <TextInput
            style={styles.input}
            value={newReward.name}
            onChangeText={(text) => setNewReward({ ...newReward, name: text })}
            placeholder="e.g., Free Coffee"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={styles.input}
            value={newReward.description}
            onChangeText={(text) => setNewReward({ ...newReward, description: text })}
            placeholder="e.g., Get a free coffee of your choice"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            {type === 'stamps' ? 'Required Stamps' : 'Required Points'}
          </Text>
          <TextInput
            style={styles.input}
            value={newReward.requiredPoints}
            onChangeText={(text) => setNewReward({ ...newReward, requiredPoints: text })}
            placeholder={type === 'stamps' ? "e.g., 8" : "e.g., 100"}
            keyboardType="numeric"
          />
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddReward}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Reward</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        style={styles.saveButton}
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>Save Rewards</Text>
      </TouchableOpacity>
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
  rewardsContainer: {
    padding: 24,
    gap: 16,
  },
  rewardCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
  },
  rewardContent: {
    flex: 1,
  },
  rewardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  rewardDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  pointsLabel: {
    fontSize: 14,
    color: '#666666',
    marginRight: 8,
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A7EA4',
  },
  removeButton: {
    padding: 8,
    marginLeft: 16,
  },
  formContainer: {
    padding: 24,
    backgroundColor: '#F8FDFF',
    margin: 24,
    borderRadius: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#0A7EA4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#0A7EA4',
    margin: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 