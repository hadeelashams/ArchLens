import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';

// Internal Imports
import { auth } from '@archlens/shared';
import { FirestoreProvider } from './context/FirestoreContext';
import { AIAnalysisProvider } from './context/AIAnalysisContext';

// Screen Imports
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import UploadPlanScreen from './screens/UploadPlanScreen'; 
import PlanVerificationScreen from './screens/PlanVerificationScreen'; 
import ConstructionLevelScreen from './screens/ConstructionLevelScreen'; 
import ProjectSummaryScreen from './screens/ProjectSummaryScreen';
import MaterialRatesScreen from './screens/MaterialRatesScreen';

// --- UPDATED FOUNDATION IMPORTS ---
import FoundationSelection from './screens/FoundationSelection';
import FoundationCost from './screens/FoundationCost';

import WallScreen from './screens/WallScreen'; 
import WallCostSummaryScreen from './screens/WallCostSummaryScreen';
import RoofingScreen from './screens/RoofingScreen';
import RoofingCostScreen from './screens/RoofingCostScreen';
import FlooringScreen from './screens/FlooringScreen';
import PaintingScreen from './screens/PaintingScreen';
import ProfileScreen from './screens/ProfileScreen';

// Settings Screens
import PersonalInfoScreen from './screens/settings/PersonalInfoScreen';
import NotificationsScreen from './screens/settings/NotificationsScreen';
import SecurityScreen from './screens/settings/SecurityScreen';
import HelpCenterScreen from './screens/settings/HelpCenterScreen';
import PrivacyPolicyScreen from './screens/settings/PrivacyPolicyScreen';
import EstimateResultScreen from './screens/EstimateResultScreen';

// 1. Updated Stack Param List for TypeScript
export type RootStackParamList = {
  // Auth & Onboarding
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;

  // Main Flow
  Home: undefined;
  UploadPlan: undefined; 
  PlanVerification: { planImage: string }; 
  ConstructionLevel: { totalArea: number; projectId: string; rooms: any[] }; 
  ProjectSummary: { projectId: string };
  MaterialRates: undefined;
  FoundationSelection: { totalArea: number; projectId: string }; 
  
  FoundationCost: { 
    projectId: string; 
    area: number | string; 
    depth: string; 
    activeMethod: string; 
    selections: any; 
  };

  // Other Estimates
  WallDetails: { totalArea: number; projectId: string; rooms: any[]; tier: string }; 
  WallCostSummary: { 
    totalArea: number; 
    rooms: any[]; 
    projectId: string; 
    tier: string; 
    height: string; 
    wallThickness: string; 
    jointThickness: string; 
    openingDeduction: string; 
    partitionWallThickness: number; 
    avgMainWallRatio: number; 
    avgPartitionWallRatio: number; 
    avgOpeningPercentage: number; 
    loadBearingBrick: any; 
    partitionBrick: any; 
    cement: any; 
    sand: any; 
    aiInsights?: any;
  };
  RoofingScreen: { totalArea: number; projectId: string; tier: string };
  RoofingCostScreen: {
    projectId: string; tier: string; roofType: string;
    roofArea: string; slabThickness: string; openingDeduction: string;
    hasWaterproofing: boolean; hasParapet: boolean;
    parapetHeight: string; parapetThickness: string;
    selections: any;
  };
  FlooringScreen: { totalArea: number; projectId: string; tier: string };
  PaintingScreen: { totalArea: number; projectId: string; tier: string };
  EstimateResult: { 
    totalArea: number; 
    level: string; 
    projectId: string; 
    foundationData?: any; // Added optional data props for result screen
  };

  // Settings & Profile
  Profile: undefined;
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
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animationEnabled: true,
          gestureEnabled: true,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 400,
                useNativeDriver: true,
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 400,
                useNativeDriver: true,
              },
            },
          },
          cardStyleInterpolator: ({ current, next, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
              overlayStyle: {
                opacity: current.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.07],
                }),
              },
            };
          },
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="UploadPlan" component={UploadPlanScreen} />
            <Stack.Screen name="PlanVerification" component={PlanVerificationScreen} />
            <Stack.Screen name="ConstructionLevel" component={ConstructionLevelScreen} />
            <Stack.Screen name="ProjectSummary" component={ProjectSummaryScreen} />
            <Stack.Screen name="MaterialRates" component={MaterialRatesScreen} />
            
            {/* --- UPDATED FOUNDATION SCREENS --- */}
            <Stack.Screen name="FoundationSelection" component={FoundationSelection} />
            <Stack.Screen name="FoundationCost" component={FoundationCost} />

            <Stack.Screen name="WallDetails" component={WallScreen} />
            <Stack.Screen name="WallCostSummary" component={WallCostSummaryScreen} />
            <Stack.Screen name="RoofingScreen" component={RoofingScreen} />
            <Stack.Screen name="RoofingCostScreen" component={RoofingCostScreen} />
            <Stack.Screen name="FlooringScreen" component={FlooringScreen} />
            <Stack.Screen name="PaintingScreen" component={PaintingScreen} />
            <Stack.Screen name="EstimateResult" component={EstimateResultScreen} />

            <Stack.Screen name="Profile" component={ProfileScreen} />
            
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
      <AIAnalysisProvider>
        <AppContent />
      </AIAnalysisProvider>
    </FirestoreProvider>
  );
}