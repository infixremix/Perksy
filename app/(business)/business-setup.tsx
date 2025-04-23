import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MAPBOX_ACCESS_TOKEN, MAPBOX_GEOCODING_API } from '../../config/mapbox';

// Use ReturnType of setTimeout instead of NodeJS.Timeout
type TimeoutHandle = ReturnType<typeof setTimeout>;

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

interface Category {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface AddressSuggestion {
  id: string;
  place_name: string;
  center: [number, number]; // [longitude, latitude]
}

const BUSINESS_CATEGORIES: Category[] = [
  { id: 'restaurant', name: 'Restaurant', icon: 'restaurant' },
  { id: 'cafe', name: 'Café', icon: 'cafe' },
  { id: 'retail', name: 'Retail Store', icon: 'cart' },
  { id: 'beauty', name: 'Beauty & Spa', icon: 'cut' },
  { id: 'fitness', name: 'Fitness', icon: 'fitness' },
  { id: 'health', name: 'Healthcare', icon: 'medical' },
  { id: 'education', name: 'Education', icon: 'school' },
  { id: 'entertainment', name: 'Entertainment', icon: 'film' },
  { id: 'automotive', name: 'Automotive', icon: 'car' },
  { id: 'other', name: 'Other', icon: 'business' }
];

export default function BusinessSetup() {
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<TimeoutHandle | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  const searchAddress = async (query: string) => {
    setBusinessAddress(query);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!query.trim()) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
        return;
      }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `${MAPBOX_GEOCODING_API}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=GB&types=address&limit=5`
        );
        const data = await response.json();
        
        const suggestions = data.features.map((feature: any) => ({
          id: feature.id,
          place_name: feature.place_name,
          center: feature.center
        }));
        
        setAddressSuggestions(suggestions);
        setShowAddressSuggestions(true);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      }
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    const formattedAddress = suggestion.place_name;
    setBusinessAddress(formattedAddress);
        setLocation({
      latitude: suggestion.center[1],
      longitude: suggestion.center[0],
      address: formattedAddress
    });
    setShowAddressSuggestions(false);
    setError('');
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setShowCategoryModal(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (!businessName || !businessAddress || !businessPhone || !selectedCategory) {
      setError('Please fill in all fields and select a category');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user found');
      }

      await updateDoc(doc(db, 'users', user.uid), {
        businessName,
        businessAddress,
        businessPhone,
        businessCategory: selectedCategory.id,
        businessCategoryName: selectedCategory.name,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address // Save the formatted address with the coordinates
        } : null,
        setupCompleted: true,
        type: 'business',
        isVerified: false
      });

      router.replace('/');
    } catch (error) {
      console.error('Business setup error:', error);
      setError('An error occurred while saving your business information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Business Setup</Text>
          <Text style={styles.subtitle}>Tell us about your business</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Business Name</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="Enter your business name"
              value={businessName}
              onChangeText={(text) => {
                setBusinessName(text);
                setError('');
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Business Address</Text>
            <View style={styles.addressContainer}>
              <TextInput
                style={[styles.input, error && styles.inputError]}
                placeholder="Search for your address"
                value={businessAddress}
                onChangeText={searchAddress}
                onFocus={() => businessAddress.trim() && setShowAddressSuggestions(true)}
              />
              {showAddressSuggestions && addressSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {addressSuggestions.map((suggestion) => (
              <TouchableOpacity 
                      key={suggestion.id}
                      style={styles.suggestionItem}
                      onPress={() => handleAddressSelect(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion.place_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Business Phone</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="Enter your business phone"
              value={businessPhone}
              onChangeText={(text) => {
                setBusinessPhone(text);
                setError('');
              }}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Business Category</Text>
            <TouchableOpacity
              style={[styles.categorySelector, error && styles.inputError]}
              onPress={() => setShowCategoryModal(true)}
            >
              {selectedCategory ? (
                <View style={styles.selectedCategory}>
                  <Ionicons name={selectedCategory.icon} size={24} color="#0A7EA4" />
                  <Text style={styles.selectedCategoryText}>{selectedCategory.name}</Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>Select your business category</Text>
              )}
              <Ionicons name="chevron-down" size={24} color="#666666" />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Complete Setup</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCategoryModal(false)}
              >
                <Ionicons name="close" size={24} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoriesList}>
              {BUSINESS_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryOption,
                    selectedCategory?.id === category.id && styles.categoryOptionSelected
                  ]}
                  onPress={() => handleCategorySelect(category)}
                >
                  <View style={[
                    styles.categoryIcon,
                    selectedCategory?.id === category.id && styles.categoryIconSelected
                  ]}>
                    <Ionicons 
                      name={category.icon} 
                      size={24} 
                      color={selectedCategory?.id === category.id ? '#FFFFFF' : '#0A7EA4'} 
                    />
                  </View>
                  <Text style={[
                    styles.categoryOptionText,
                    selectedCategory?.id === category.id && styles.categoryOptionTextSelected
                  ]}>
                    {category.name}
                  </Text>
                  {selectedCategory?.id === category.id && (
                    <Ionicons name="checkmark" size={24} color="#0A7EA4" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
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
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addressContainer: {
    position: 'relative',
    zIndex: 1,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#0A7EA4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedCategoryText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  categoriesList: {
    padding: 12,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryOptionSelected: {
    backgroundColor: '#F0F9FF',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryIconSelected: {
    backgroundColor: '#0A7EA4',
  },
  categoryOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  categoryOptionTextSelected: {
    color: '#0A7EA4',
    fontWeight: '600',
  },
}); 