import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { auth } from '@archlens/shared';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getUserById } from '../services/userService';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Verify user exists in Firestore
      const userProfile = await getUserById(userCredential.user.uid);
      if (!userProfile) {
        await auth.signOut();
        Alert.alert("Login Failed", "User profile not found. Please register first.");
        return;
      }
    } catch (error: any) {
      let message = "Invalid email or password. Please check your details.";
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#60889c', '#315b76']} style={styles.fullBackground} />
      <Text style={styles.mainTitle}>ARCH LENS</Text>
      <Text style={{ fontSize: 15, fontFamily: 'sans', opacity: 0.7, bottom: 75, color: '#ffffff' }}>
      Smart Estimation & Plan Analysis Platform
</Text>


      <View style={styles.shadowWrapper}>
        <View style={styles.card}>
          {/* Sloped decorative background on the right */}
          <LinearGradient
            colors={['#abe4e4', '#ffffff']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          <View style={styles.formSection}>
            {/* BRAND TEXT MOVED HERE */}
           
            <View style={styles.headerGroup}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>User Login</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <MaterialIcons name="email" size={18} color="#64748b" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <MaterialIcons name="lock" size={18} color="#64748b" />
              </View>
            </View>

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
              <LinearGradient colors={['#315b76', '#60889c']} style={styles.buttonGradient}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.loginButtonText}>Login</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.signupContainer}>
                <Text style={styles.signupText}>New user?</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.signupLink}> Create Account</Text>
                </TouchableOpacity>
            </View>
          </View>
          
          {/* Empty section to maintain the sloped layout structure */}
          
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullBackground: { position: 'absolute', width: '100%', height: '100%' },

  shadowWrapper: {
    width: width * 0.85,
    height: 460,
    backgroundColor: 'transparent',
    boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)',
    elevation: 12,
  },
  card: { flex: 1, backgroundColor: '#ffffff', borderRadius: 22``, overflow: 'hidden', flexDirection: 'row' },
  formSection: { 
    flex: 2, // Increased flex to allow text to fit better
    padding: 25, 
    justifyContent: 'center', 
    zIndex: 10 
  },
 
  mainTitle: {
      fontSize: 26,
      fontWeight: 'bold',
      color: '#ffffff',
      bottom: 70,
      letterSpacing: 2,
      marginVertical: 8,
      textAlign: 'center',
      fontFamily: 'serif',
    },
  brandText: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: '#0d9488', // Teal color for branding
    letterSpacing: 1,
    marginBottom: 60 
  },
  headerGroup: {
    marginTop: -40,    // Moves the section higher up
    marginBottom: 40,  // Adds space before the input fields
  },
  title: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#194f60',
    textAlign: 'center',
    marginBottom: 6
  },
  subtitle: {
  fontSize: 14,
  fontWeight: '600',
  textAlign: 'center',
  color: '#64748b',
},

  inputGroup: { marginBottom: 20 },
  label: { color: '#64748b', fontSize: 13, marginBottom: 4, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0', paddingBottom: 5 },
  input: { flex: 1, color: '#334155', fontSize: 15 },
  loginButton: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
  buttonGradient: { paddingVertical: 14, alignItems: 'center' },
  loginButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  signupContainer: { marginTop: 20, flexDirection: 'row' },
  signupText: { color: '#94a3b8', fontSize: 12 },
  signupLink: { color: '#0d433b', fontSize: 12, fontWeight: 'bold' },
});