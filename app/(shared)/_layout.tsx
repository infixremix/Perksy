import { Stack } from 'expo-router';

export default function SharedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="business-rewards" />
      <Stack.Screen name="redeem-reward" />
      <Stack.Screen name="business-profile" />
    </Stack>
  );
} 