import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';

// Internal Imports
import { auth } from '@archlens/shared';
import { FirestoreProvider } from './context/FirestoreContext';

// Screen Imports
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import UploadPlanScreen from './screens/UploadPlanScreen'; 
import PlanVerificationScreen from './screens/PlanVerificationScreen'; 
import ProfileScreen from './screens/ProfileScreen';

// NEW: Settings Detail Screen Imports
// Make sure the paths match where you saved the files above!
import PersonalInfoScreen from './screens/settings/PersonalInfoScreen';
import NotificationsScreen from './screens/settings/NotificationsScreen';
import SecurityScreen from './screens/settings/SecurityScreen';
import HelpCenterScreen from './screens/settings/HelpCenterScreen';
import PrivacyPolicyScreen from './screens/settings/PrivacyPolicyScreen';

// 1. Updated Stack Param List for TypeScript
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  UploadPlan: undefined; 
  PlanVerification: { planImage: string }; 
  Profile: undefined;
  // Detail Screens
  PersonalInfo: undefined;
  Notifications: undefined;
  Security: undefined;
  HelpCenter: undefined;
  PrivacyPolicy: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#315b76" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="UploadPlan" component={UploadPlanScreen} />
            <Stack.Screen name="PlanVerification" component={PlanVerificationScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            
            {/* Connected the real screens here */}
            <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Security" component={SecurityScreen} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
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