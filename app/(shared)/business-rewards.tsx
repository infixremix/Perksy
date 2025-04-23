import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface Reward {
  id: string;
  name: string;
  description: string;
  requiredPoints: string;
}

interface BusinessReward {
  businessName: string;
  points: number;
  lastUpdated: string;
}

export default function BusinessRewards() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [businessRewards, setBusinessRewards] = useState<Reward[]>([]);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchBusinessRewards();
  }, [businessId]);

  const fetchBusinessRewards = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get business data
      const businessDoc = await getDoc(doc(db, 'users', businessId));
      if (!businessDoc.exists()) {
        Alert.alert('Error', 'Business not found');
        router.back();
        return;
      }

      const businessData = businessDoc.data();
      if (businessData.loyaltyProgram?.rewards) {
        setBusinessRewards(businessData.loyaltyProgram.rewards);
      }

      // Get user's points for this business
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userRewards = userData.rewards?.[businessId];
        if (userRewards) {
          setUserPoints(userRewards.points);
        }
      }
    } catch (error) {
      console.error('Error fetching business rewards:', error);
      Alert.alert('Error', 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (requiredPoints: string) => {
    const required = parseInt(requiredPoints);
    const progress = Math.min((userPoints / required) * 100, 100);
    return progress;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading rewards...</Text>
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
        <Text style={styles.title}>Available Rewards</Text>
        <Text style={styles.points}>Your Points: {userPoints}</Text>
      </View>

      {/* Rewards List */}
      <View style={styles.rewardsContainer}>
        {businessRewards.map((reward) => {
          const progress = calculateProgress(reward.requiredPoints);
          const canRedeem = userPoints >= parseInt(reward.requiredPoints);

          return (
            <View key={reward.id} style={styles.rewardCard}>
              <View style={styles.rewardHeader}>
                <View>
                  <Text style={styles.rewardName}>{reward.name}</Text>
                  <Text style={styles.rewardDescription}>{reward.description}</Text>
                </View>
                <Text style={styles.requiredPoints}>{reward.requiredPoints} points</Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
                <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
              </View>

              {/* Redeem Button */}
              <TouchableOpacity 
                style={[
                  styles.redeemButton,
                  !canRedeem && styles.redeemButtonDisabled
                ]}
                disabled={!canRedeem}
                onPress={() => {
                  if (canRedeem) {
                    router.push({
                      pathname: '/(shared)/redeem-reward',
                      params: {
                        businessId,
                        rewardId: reward.id
                      }
                    });
                  }
                }}
              >
                <Text style={styles.redeemButtonText}>
                  {canRedeem ? 'Redeem Now' : 'Not Enough Points'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {businessRewards.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="gift-outline" size={48} color="#666666" />
            <Text style={styles.emptyStateText}>No rewards available</Text>
            <Text style={styles.emptyStateSubtext}>
              This business hasn't set up any rewards yet
            </Text>
          </View>
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
  points: {
    fontSize: 16,
    color: '#0A7EA4',
    fontWeight: '600',
  },
  rewardsContainer: {
    padding: 20,
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rewardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
    marginRight: 16,
  },
  requiredPoints: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A7EA4',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    marginBottom: 12,
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0A7EA4',
    borderRadius: 4,
  },
  progressText: {
    position: 'absolute',
    right: 0,
    top: -20,
    fontSize: 12,
    color: '#666666',
  },
  redeemButton: {
    backgroundColor: '#0A7EA4',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  redeemButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  redeemButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
}); 