import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@archlens/shared';
import { FirestoreProvider } from './context/FirestoreContext';

// Screen Imports
import OnboardingScreen from './screens/OnboardingScreen';  
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import RegisterScreen from './screens/RegisterScreen';

const Stack = createNativeStackNavigator();

function AppContent() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // This listener detects BOTH login and logout
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
                <Text style={{ marginTop: 10, color: '#666' }}>Initializing ArchLens...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    // --- AUTHENTICATED SESSIONS ---
                    // When user is logged in, ONLY Home is available.
                    // React Navigation will automatically jump here.
                    <Stack.Screen 
                        name="Home" 
                        component={HomeScreen} 
                        options={{ title: 'ArchLens', headerShown: true }} 
                    />
                ) : (
                    // --- GUEST / AUTH SESSIONS ---
                    // When user is null, these screens are available.
                    // React Navigation will automatically jump back here on logout.
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