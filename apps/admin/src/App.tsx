import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@archlens/shared';
import { FirestoreProvider } from './context/FirestoreContext';

// Screens
import LoginScreen from './screens/LoginScreen';
import AdminHomeScreen from './screens/AdminHomeScreen';
import DashboardScreen from './screens/DashboardScreen';
import UsersScreen from './screens/UsersScreen';

const Stack = createNativeStackNavigator();

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' }}>
        <ActivityIndicator size="large" color="#bae6fd" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // AUTHENTICATED ROUTES (Admin Only)
          <>
            <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Users" component={UsersScreen} />
          </>
        ) : (
          // PUBLIC ROUTES (Login)
          <Stack.Screen name="Login" component={LoginScreen} />
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