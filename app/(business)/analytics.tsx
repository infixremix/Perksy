import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface AnalyticsData {
  totalCustomers: number;
  totalPoints: number;
  totalRedemptions: number;
  averagePointsPerCustomer: number;
  recentActivity: Array<{
    title: string;
    time: string;
    amount: string;
  }>;
}

type TimeFilter = '1d' | '30d' | '6m' | 'all';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalCustomers: 0,
    totalPoints: 0,
    totalRedemptions: 0,
    averagePointsPerCustomer: 0,
    recentActivity: []
  });
  const router = useRouter();

  const getFilterDate = (filter: TimeFilter): Date | null => {
    if (filter === 'all') return null;
    
    const now = new Date();
    switch (filter) {
      case '1d':
        return new Date(now.setDate(now.getDate() - 1));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '6m':
        return new Date(now.setMonth(now.getMonth() - 6));
      default:
        return null;
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get business data first
      const businessDoc = await getDoc(doc(db, 'users', user.uid));
      if (!businessDoc.exists()) return;
      
      const businessData = businessDoc.data();
      const filterDate = getFilterDate(timeFilter);
      
      // Get all customers with rewards from this business
      const usersRef = collection(db, 'users');
      const customersQuery = query(
        usersRef,
        where('type', '==', 'consumer'),
        where(`rewards.${user.uid}`, '!=', null)
      );

      const customersSnapshot = await getDocs(customersQuery);
      let totalPoints = 0;
      let totalRedemptions = 0;
      let filteredActivity: any[] = [];

      customersSnapshot.forEach(doc => {
        const customerData = doc.data();
        if (customerData.rewards?.[user.uid]) {
          // Only count points from activities within the filter period
          if (customerData.recentActivity) {
            customerData.recentActivity.forEach((activity: any) => {
              const activityDate = new Date(activity.date);
              if (!filterDate || activityDate >= filterDate) {
                if (activity.type === 'earned') {
                  totalPoints += activity.points || 0;
                } else if (activity.type === 'redeemed') {
                  totalRedemptions++;
                }
              }
            });
          }
        }
      });

      // Filter recent activity based on time filter
      const filteredBusinessActivity = businessData.recentActivity?.filter((activity: any) => {
        if (!filterDate) return true;
        const activityDate = new Date(activity.time);
        return activityDate >= filterDate;
      }) || [];

      setAnalyticsData({
        totalCustomers: customersSnapshot.size,
        totalPoints,
        totalRedemptions,
        averagePointsPerCustomer: customersSnapshot.size > 0 ? Math.round(totalPoints / customersSnapshot.size) : 0,
        recentActivity: filteredBusinessActivity
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeFilter]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A7EA4" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header - Updated padding */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>Analytics</Text>
      </View>

      {/* Time Filter - Adjusted spacing */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterButton, timeFilter === '1d' && styles.filterButtonActive]}
          onPress={() => setTimeFilter('1d')}
        >
          <Text style={[styles.filterText, timeFilter === '1d' && styles.filterTextActive]}>24h</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, timeFilter === '30d' && styles.filterButtonActive]}
          onPress={() => setTimeFilter('30d')}
        >
          <Text style={[styles.filterText, timeFilter === '30d' && styles.filterTextActive]}>30d</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, timeFilter === '6m' && styles.filterButtonActive]}
          onPress={() => setTimeFilter('6m')}
        >
          <Text style={[styles.filterText, timeFilter === '6m' && styles.filterTextActive]}>6m</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, timeFilter === 'all' && styles.filterButtonActive]}
          onPress={() => setTimeFilter('all')}
        >
          <Text style={[styles.filterText, timeFilter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid - Updated spacing */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="people-outline" size={24} color="#0A7EA4" />
          </View>
          <Text style={styles.statValue}>{analyticsData.totalCustomers}</Text>
          <Text style={styles.statLabel}>Total Customers</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="star-outline" size={24} color="#0A7EA4" />
          </View>
          <Text style={styles.statValue}>{analyticsData.totalPoints}</Text>
          <Text style={styles.statLabel}>Total Points</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="gift-outline" size={24} color="#0A7EA4" />
          </View>
          <Text style={styles.statValue}>{analyticsData.totalRedemptions}</Text>
          <Text style={styles.statLabel}>Redemptions</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="analytics-outline" size={24} color="#0A7EA4" />
          </View>
          <Text style={styles.statValue}>{analyticsData.averagePointsPerCustomer}</Text>
          <Text style={styles.statLabel}>Avg. Points/Customer</Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {analyticsData.recentActivity.length > 0 ? (
          analyticsData.recentActivity.map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityTime}>
                  {new Date(activity.time).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.activityAmount}>{activity.amount}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noActivity}>No recent activity</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    minWidth: 70,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#0A7EA4',
  },
  filterText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 10,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 14,
    color: '#666666',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0A7EA4',
  },
  noActivity: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 16,
    paddingVertical: 20,
  },
}); 