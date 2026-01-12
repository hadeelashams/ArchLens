import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@archlens/shared';
import { FirestoreProvider } from './context/FirestoreContext';

import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';

const Stack = createNativeStackNavigator();

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    try {
      // Listener that detects login/logout
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
      return unsubscribe;
    } catch (err) {
      console.error('Auth error:', err);
      setError(err);
      setLoading(false);
    }
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: 'red', fontSize: 16, textAlign: 'center', padding: 20 }}>
          System Error: {error.message}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // 1. AUTHENTICATED STACK
          // When 'user' is present, the app ONLY knows the Dashboard
          <Stack.Screen 
            name="Dashboard" 
            component={DashboardScreen} 
            options={{ 
              title: 'ArchLens Admin Panel', 
              headerShown: true,
              headerLeft: () => null // Removes back arrow after login
            }}
          />
        ) : (
          // 2. GUEST STACK
          // When 'user' is null, the app ONLY knows the Login screen
          // Registration is completely removed from here.
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <FirestoreProvider>
      <AppContent />
    </FirestoreProvider>
  );
}