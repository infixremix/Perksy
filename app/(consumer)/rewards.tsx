import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface BusinessReward {
  businessName: string;
  points: number;
  lastUpdated: string;
  businessCategory?: string;
  loyaltyProgram?: {
    type: 'stamps' | 'points';
  };
}

const CATEGORY_ICONS = {
  restaurant: 'restaurant',
  retail: 'cart',
  cafe: 'cafe',
  beauty: 'cut',
  fitness: 'fitness',
  health: 'medical',
  education: 'school',
  entertainment: 'film',
  automotive: 'car',
  other: 'business'
} as const;

const LoadingSkeleton = () => {
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Rewards</Text>
          <Text style={styles.subtitle}>Track your loyalty programs</Text>
        </View>
      </View>
      <ScrollView style={styles.rewardsContainer}>
        {[1, 2, 3].map((_, index) => (
          <Animated.View key={index} style={[styles.skeletonCard, { opacity }]} />
        ))}
      </ScrollView>
    </View>
  );
};

export default function Rewards() {
  const [rewards, setRewards] = useState<Record<string, BusinessReward>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.rewards) {
          setRewards(data.rewards);
        }
      }
    } catch (error) {
      console.error('Error fetching rewards:', error);
      Alert.alert('Error', 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchRewards();
  };

  const handleRewardPress = (businessId: string) => {
    router.push({
      pathname: '/(shared)/business-rewards',
      params: { businessId }
    });
  };

  const getRewardIcon = (type?: 'stamps' | 'points') => {
    if (type === 'stamps') {
      return 'gift';
    }
    return 'star';
  };

  const getCategoryIcon = (category?: string) => {
    if (!category) return 'business';
    const normalizedCategory = category.toLowerCase();
    return CATEGORY_ICONS[normalizedCategory as keyof typeof CATEGORY_ICONS] || 'business';
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Rewards</Text>
          <Text style={styles.subtitle}>Track your loyalty programs</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="#666666" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.rewardsContainer}>
        {Object.entries(rewards).length > 0 ? (
          Object.entries(rewards).map(([businessId, reward]) => (
            <TouchableOpacity
              key={businessId}
              style={styles.rewardCard}
              onPress={() => handleRewardPress(businessId)}
            >
              <View style={styles.businessImageContainer}>
                <View style={styles.placeholderImage}>
                  <Ionicons 
                    name={getCategoryIcon(reward.businessCategory)} 
                    size={24} 
                    color="#0A7EA4" 
                  />
                </View>
              </View>
              <View style={styles.businessDetails}>
                <Text style={styles.businessName}>{reward.businessName}</Text>
                <View style={styles.businessMeta}>
                  <View style={styles.pointsBadge}>
                    <Ionicons 
                      name={getRewardIcon(reward.loyaltyProgram?.type)} 
                      size={16} 
                      color="#0A7EA4" 
                    />
                    <Text style={styles.pointsText}>
                      {reward.points} {reward.loyaltyProgram?.type === 'stamps' ? 'stamps' : 'points'}
                    </Text>
                  </View>
                  <View style={styles.lastUpdatedBadge}>
                    <Ionicons name="time-outline" size={12} color="#666666" />
                    <Text style={styles.lastUpdatedText}>
                      {new Date(reward.lastUpdated).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666666" />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIconContainer}>
              <Ionicons name="gift" size={48} color="#666666" />
            </View>
            <Text style={styles.emptyStateText}>No rewards yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Start collecting rewards by scanning QR codes at Perksy partners
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  rewardsContainer: {
    flex: 1,
    padding: 12,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  businessImageContainer: {
    marginRight: 12,
  },
  placeholderImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  businessMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4F8',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  pointsText: {
    fontSize: 11,
    color: '#0A7EA4',
    marginLeft: 3,
    fontWeight: '500',
  },
  lastUpdatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  lastUpdatedText: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 3,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyStateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  skeletonCard: {
    height: 72,
    backgroundColor: '#E1E9EE',
    borderRadius: 12,
    marginBottom: 8,
  },
}); 