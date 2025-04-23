import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebase';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

interface BusinessData extends DocumentData {
  businessName: string;
  isVerified: boolean;
  loyaltyProgram?: {
    type: 'stamps' | 'monetary';
    rewards: Array<{
      id: string;
      name: string;
      description: string;
      requiredPoints: string;
    }>;
  };
  recentActivity?: Array<{
    title: string;
    time: string;
    amount: string;
  }>;
}

export default function BusinessDashboard() {
  const [businessData, setBusinessData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchBusinessData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setBusinessData(userDoc.data() as BusinessData);
      }
    } catch (error) {
      console.error('Error fetching business data:', error);
      Alert.alert('Error', 'Failed to load business data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBusinessData();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchBusinessData();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleLoyaltyProgram = () => {
    if (businessData?.loyaltyProgram) {
      // If loyalty program exists, go to edit mode
      router.push({
        pathname: '/(business)/loyalty-setup',
        params: { mode: 'edit', type: businessData.loyaltyProgram.type }
      });
    } else {
      // If no loyalty program, go to setup mode
      router.push('/(business)/loyalty-setup');
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
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#0A7EA4"
          colors={["#0A7EA4"]}
        />
      }
    >
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome,</Text>
          <Text style={styles.businessName}>{businessData?.businessName || 'Business'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
          <Ionicons name="log-out-outline" size={24} color="#666666" />
        </TouchableOpacity>
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Ionicons 
            name={businessData?.isVerified ? "checkmark-circle" : "time"} 
            size={24} 
            color={businessData?.isVerified ? "#34C759" : "#FF9500"} 
          />
          <Text style={styles.statusText}>
            {businessData?.isVerified ? 'Verified Business' : 'Pending Verification'}
          </Text>
        </View>
        <Text style={styles.statusDescription}>
          {businessData?.isVerified 
            ? 'Your business is verified and ready to accept Perksy cards.'
            : 'We are reviewing your business information. This usually takes 1-2 business days.'}
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={[
              styles.actionButton,
              !businessData?.isVerified && styles.actionButtonDisabled
            ]}
            onPress={() => businessData?.isVerified && router.push('/(business)/scan-qr')}
            disabled={!businessData?.isVerified}
          >
            <View style={styles.actionIcon}>
              <Ionicons 
                name="qr-code" 
                size={24} 
                color={businessData?.isVerified ? "#0A7EA4" : "#999999"} 
              />
            </View>
            <Text style={[
              styles.actionText,
              !businessData?.isVerified && styles.actionTextDisabled
            ]}>
              Scan QR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleLoyaltyProgram}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="gift-outline" size={24} color="#0A7EA4" />
            </View>
            <Text style={styles.actionText}>
              {businessData?.loyaltyProgram ? 'Edit Loyalty Program' : 'Set Up Loyalty Program'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(business)/analytics')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="analytics-outline" size={24} color="#0A7EA4" />
            </View>
            <Text style={styles.actionText}>Analytics</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIcon}>
              <Ionicons name="settings-outline" size={24} color="#0A7EA4" />
            </View>
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/(business)/scan-customer')}
          >
            <Ionicons name="scan-outline" size={24} color="#0A7EA4" />
            <Text style={styles.actionText}>Scan Customer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="card-outline" size={24} color="#0A7EA4" />
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>Card Scan</Text>
              <Text style={styles.activityTime}>2 minutes ago</Text>
            </View>
            <Text style={styles.activityAmount}>-$5.00</Text>
          </View>
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="card-outline" size={24} color="#0A7EA4" />
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>Card Scan</Text>
              <Text style={styles.activityTime}>1 hour ago</Text>
            </View>
            <Text style={styles.activityAmount}>-$3.50</Text>
          </View>
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 16,
    color: '#666666',
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 4,
  },
  iconButton: {
    padding: 8,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    margin: 24,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    color: '#1A1A1A',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F5F5F5',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.5,
  },
  actionIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#E8F5FA',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  actionTextDisabled: {
    color: '#999999',
  },
  activityList: {
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#E8F5FA',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  activityTime: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A7EA4',
  },
}); 