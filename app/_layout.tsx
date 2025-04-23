import { Stack } from 'expo-router';
import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { auth } from '../src/config/firebase';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0A7EA4" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(business)" />
      <Stack.Screen name="(consumer)" />
      <Stack.Screen name="(shared)" />
    </Stack>
  );
}
