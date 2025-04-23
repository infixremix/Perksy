import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { auth, db } from '../src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';

export default function Index() {
  const [isChecking, setIsChecking] = useState(true);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkUserType = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          if (isMounted) {
            setUserType('login');
            setIsChecking(false);
          }
          return;
        }

        // Check Firestore for user type
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          if (isMounted) {
            setUserType('login');
            setIsChecking(false);
          }
          return;
        }

        const userData = userDoc.data();
        if (isMounted) {
          setUserType(userData.type === 'business' ? '/(business)/business' : '/(consumer)/consumer');
          setIsChecking(false);
        }
      } catch (error) {
        console.error('Error checking user type:', error);
        if (isMounted) {
          setUserType('login');
          setIsChecking(false);
        }
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
      if (!user) {
        if (isMounted) {
          setUserType('login');
          setIsChecking(false);
        }
      } else {
        checkUserType();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0A7EA4" />
      </View>
    );
  }

  if (userType) {
    return <Redirect href={userType} />;
  }

  return null;
} 