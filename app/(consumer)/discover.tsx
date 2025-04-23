import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import * as Location from 'expo-location';
import { MAPBOX_ACCESS_TOKEN } from '../../config/mapbox';

interface Business {
  id: string;
  businessName: string;
  businessAddress: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessCategory: string;
  isVerified?: boolean;
  location?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  distance?: string;
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

const CATEGORIES = [
  { id: 'all', name: 'All', icon: 'grid-outline' },
  { id: 'restaurant', name: 'Restaurants', icon: 'restaurant-outline' },
  { id: 'retail', name: 'Retail', icon: 'cart-outline' },
  { id: 'cafe', name: 'Cafes', icon: 'cafe-outline' },
  { id: 'beauty', name: 'Beauty', icon: 'cut-outline' },
  { id: 'fitness', name: 'Fitness', icon: 'fitness-outline' },
  { id: 'other', name: 'Other', icon: 'apps-outline' },
];

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
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>Find Perksy partners near you</Text>
      </View>
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIES.map((_, index) => (
            <Animated.View
              key={index}
              style={[styles.skeletonCategory, { opacity }]}
            />
          ))}
        </ScrollView>
      </View>
      <ScrollView style={styles.listContainer}>
        {[1, 2, 3, 4].map((_, index) => (
          <Animated.View
            key={index}
            style={[styles.skeletonCard, { opacity }]}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const calculateDistanceWithMapbox = async (
  userLocation: { latitude: number; longitude: number } | null,
  businesses: Array<{ id: string; location: { latitude: number; longitude: number; address: string } }>
): Promise<Record<string, string>> => {
  try {
    if (!userLocation || !businesses || businesses.length === 0) return {};

    // Process businesses in batches of 25 to avoid API limits
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < businesses.length; i += batchSize) {
      batches.push(businesses.slice(i, i + batchSize));
    }

    const results: Record<string, string> = {};
    
    await Promise.all(batches.map(async (batch) => {
      const coordinates = [
        `${userLocation.longitude},${userLocation.latitude}`,
        ...batch.map(b => `${b.location.longitude},${b.location.latitude}`)
      ].join(';');

      const response = await fetch(
        `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordinates}?sources=0&destinations=${
          Array.from({ length: batch.length }, (_, i) => i + 1).join(';')
        }&annotations=distance,duration&access_token=${MAPBOX_ACCESS_TOKEN}`
      );

      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.distances?.[0]) return;

      batch.forEach((business, index) => {
        const distance = data.distances[0][index];
        if (typeof distance !== 'number' || isNaN(distance)) return;

        const distanceInMiles = distance * 0.000621371;
        results[business.id] = distanceInMiles < 0.1
          ? `${(Math.round(distanceInMiles * 100) / 100).toFixed(2)} miles`
          : `${Math.round(distanceInMiles * 10) / 10} miles`;
      });
    }));

    return results;
  } catch (error) {
    console.error('Error calculating distances:', error);
    return {};
  }
};

export default function Discover() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const router = useRouter();

  // Use memoization for filtered businesses
  const filteredBusinesses = useMemo(() => {
    if (selectedCategory === 'all') return businesses;
    return businesses.filter(business => 
      business.businessCategory?.toLowerCase() === selectedCategory
    );
  }, [selectedCategory, businesses]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        // Get location permission early
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;

        // Parallel fetch of location and businesses
        const [locationResult, businessesSnapshot] = await Promise.all([
          status === 'granted' ? Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          }) : null,
          getDocs(query(
            collection(db, 'users'),
            where('type', '==', 'business'),
            where('isVerified', '==', true)
          ))
        ]);

        if (!mounted) return;

        // Process location
        const currentLocation = locationResult ? {
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
        } : null;
        setUserLocation(currentLocation);

        // Process businesses
        let businessList = businessesSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Business))
          .filter(business => (
            business.businessName?.trim() &&
            business.loyaltyProgram &&
            business.businessAddress?.trim() &&
            business.location?.latitude &&
            business.location?.longitude
          ));

        // Calculate distances if location is available
        if (currentLocation && businessList.length > 0) {
          const businessesWithLocation = businessList.map(b => ({
            id: b.id,
            location: b.location!
          }));

          const distanceMap = await calculateDistanceWithMapbox(currentLocation, businessesWithLocation);

          businessList = businessList.map(business => ({
            ...business,
            distance: distanceMap[business.id]
          }));

          businessList.sort((a, b) => {
            if (!a.distance || !b.distance) return 0;
            const distA = parseFloat(a.distance.replace(/[^0-9.]/g, ''));
            const distB = parseFloat(b.distance.replace(/[^0-9.]/g, ''));
            return distA - distB;
          });
        }

        if (!mounted) return;
        setBusinesses(businessList);
      } catch (error) {
        console.error('Error initializing:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();
    return () => { mounted = false; };
  }, []);

  const handleBusinessPress = (businessId: string) => {
    router.push({
      pathname: '/(shared)/business-profile',
      params: { businessId }
    });
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>Find Perksy partners near you</Text>
      </View>

      {/* Category Filters */}
      <View style={styles.categoryContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContent}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.id && styles.selectedCategory
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Ionicons 
                name={category.icon as any} 
                size={16} 
                color={selectedCategory === category.id ? '#FFFFFF' : '#666666'} 
              />
              <Text style={[
                styles.categoryButtonText,
                selectedCategory === category.id && styles.selectedCategoryText
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.listContainer}>
        {filteredBusinesses.length > 0 ? (
          filteredBusinesses.map((business) => (
            <TouchableOpacity 
              key={business.id}
              style={styles.businessCard}
              onPress={() => handleBusinessPress(business.id)}
            >
              <View style={styles.businessImageContainer}>
                <View style={styles.placeholderImage}>
                  <Ionicons 
                    name={CATEGORY_ICONS[business.businessCategory?.toLowerCase() as keyof typeof CATEGORY_ICONS] || 'business'} 
                    size={30} 
                    color="#0A7EA4" 
                  />
                </View>
              </View>
              <View style={styles.businessDetails}>
                <Text style={styles.businessName}>{business.businessName}</Text>
                <View style={styles.businessMeta}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{business.businessCategory}</Text>
                  </View>
                  {business.distance ? (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="location-outline" size={12} color="#666666" />
                      <Text style={styles.distanceText}>{business.distance}</Text>
                    </View>
                  ) : (
                    <Text style={styles.noLocationText}>No location data</Text>
                  )}
                  <View style={styles.loyaltyBadge}>
                    <Ionicons name="gift-outline" size={16} color="#0A7EA4" />
                    <Text style={styles.loyaltyText}>
                      {business.loyaltyProgram?.type === 'stamps' ? 'Stamps' : 'Points'}
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666666" />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="business" size={48} color="#666666" />
            <Text style={styles.emptyStateText}>No businesses found</Text>
            <Text style={styles.emptyStateSubtext}>
              {selectedCategory === 'all' 
                ? 'Check back later for new Perksy partners'
                : `No ${CATEGORIES.find(c => c.id === selectedCategory)?.name} found`}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
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
  categoryContainer: {
    backgroundColor: '#FFFFFF',
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 4,
    height: 32,
  },
  selectedCategory: {
    backgroundColor: '#0A7EA4',
  },
  categoryButtonText: {
    fontSize: 13,
    color: '#666666',
    marginLeft: 4,
    fontWeight: '500',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  listContainer: {
    flex: 1,
    padding: 12,
  },
  businessCard: {
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
  categoryBadge: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
  },
  loyaltyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4F8',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  loyaltyText: {
    fontSize: 11,
    color: '#0A7EA4',
    marginLeft: 3,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginRight: 4,
  },
  distanceText: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 3,
    fontWeight: '500',
  },
  noLocationText: {
    fontSize: 11,
    color: '#666666',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
  },
  skeletonCategory: {
    width: 100,
    height: 36,
    backgroundColor: '#E1E9EE',
    borderRadius: 18,
    marginRight: 8,
  },
  skeletonCard: {
    height: 100,
    backgroundColor: '#E1E9EE',
    borderRadius: 12,
    marginBottom: 16,
  },
}); 