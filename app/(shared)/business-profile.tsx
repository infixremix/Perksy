import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';

interface Business {
  id: string;
  businessName: string;
  businessAddress: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessCategory: string;
  businessCategoryName: string;
  loyaltyProgram?: {
    type: 'stamps' | 'points';
    rewards: Array<{
      id: string;
      name: string;
      description: string;
      requiredPoints: string;
    }>;
  };
}

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
        <TouchableOpacity style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Animated.View style={[styles.skeletonTitle, { opacity }]} />
          <Animated.View style={[styles.skeletonCategory, { opacity }]} />
        </View>
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={24} color="#0A7EA4" />
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          <View style={styles.infoCard}>
            <Animated.View style={[styles.skeletonInfo, { opacity }]} />
            <Animated.View style={[styles.skeletonInfo, { opacity }]} />
            <Animated.View style={[styles.skeletonInfo, { opacity }]} />
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="gift-outline" size={24} color="#0A7EA4" />
            <Text style={styles.sectionTitle}>Available Rewards</Text>
          </View>
          <Animated.View style={[styles.skeletonReward, { opacity }]} />
          <Animated.View style={[styles.skeletonReward, { opacity }]} />
          <Animated.View style={[styles.skeletonReward, { opacity }]} />
        </View>
      </ScrollView>
    </View>
  );
};

export default function BusinessProfile() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchBusinessData();
  }, [businessId]);

  const fetchBusinessData = async () => {
    try {
      const businessDoc = await getDoc(doc(db, 'users', businessId));
      if (businessDoc.exists()) {
        setBusiness({
          id: businessDoc.id,
          ...businessDoc.data()
        } as Business);
      }
    } catch (error) {
      console.error('Error fetching business data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (business?.businessPhone) {
      Linking.openURL(`tel:${business.businessPhone}`);
    }
  };

  const handleWebsite = () => {
    if (business?.businessWebsite) {
      Linking.openURL(business.businessWebsite);
    }
  };

  const handleRewardPress = (rewardId: string) => {
    router.push({
      pathname: '/(shared)/redeem-reward',
      params: { businessId, rewardId }
    });
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!business) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Business not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{business.businessName}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{business.businessCategoryName}</Text>
          </View>
        </View>
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={24} color="#0A7EA4" />
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={20} color="#666666" />
              <Text style={styles.infoText}>{business.businessAddress}</Text>
            </View>
            {business.businessPhone && (
              <TouchableOpacity style={styles.infoItem} onPress={handleCall}>
                <Ionicons name="call-outline" size={20} color="#666666" />
                <Text style={[styles.infoText, styles.linkText]}>{business.businessPhone}</Text>
              </TouchableOpacity>
            )}
            {business.businessWebsite && (
              <TouchableOpacity style={styles.infoItem} onPress={handleWebsite}>
                <Ionicons name="globe-outline" size={20} color="#666666" />
                <Text style={[styles.infoText, styles.linkText]}>{business.businessWebsite}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="gift-outline" size={24} color="#0A7EA4" />
            <Text style={styles.sectionTitle}>Available Rewards</Text>
          </View>
          {business.loyaltyProgram?.rewards ? (
            business.loyaltyProgram.rewards.map((reward) => (
              <View
                key={reward.id}
                style={styles.rewardCard}
              >
                <View style={styles.rewardHeader}>
                  <Text style={styles.rewardName}>{reward.name}</Text>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsText}>{reward.requiredPoints}</Text>
                    <Text style={styles.pointsLabel}>points</Text>
                  </View>
                </View>
                <Text style={styles.rewardDescription}>{reward.description}</Text>
              </View>
            ))
          ) : (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1,
    padding: 8,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  categoryBadge: {
    backgroundColor: '#E1F0FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
  },
  categoryText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  linkText: {
    color: '#007AFF',
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  pointsBadge: {
    backgroundColor: '#E1F0FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointsText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pointsLabel: {
    color: '#007AFF',
    fontSize: 14,
  },
  rewardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  skeletonTitle: {
    height: 32,
    backgroundColor: '#E1E9EE',
    borderRadius: 8,
    marginBottom: 12,
    width: '50%',
    alignSelf: 'center',
  },
  skeletonCategory: {
    height: 32,
    backgroundColor: '#E1E9EE',
    borderRadius: 20,
    width: '30%',
    alignSelf: 'center',
  },
  skeletonInfo: {
    height: 24,
    backgroundColor: '#E1E9EE',
    borderRadius: 8,
  },
  skeletonReward: {
    height: 100,
    backgroundColor: '#E1E9EE',
    borderRadius: 12,
    marginBottom: 12,
  },
}); 