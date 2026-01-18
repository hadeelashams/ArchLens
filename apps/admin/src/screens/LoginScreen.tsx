import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions, ImageBackground } from 'react-native';
import { auth } from '@archlens/shared';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getUserById } from '../services/userService';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateInputs = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email format';
    
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userProfile = await getUserById(userCredential.user.uid);
      if (!userProfile) {
        await auth.signOut();
        Alert.alert("Login Failed", "User profile not found.");
      }
    } catch (error: any) {
      Alert.alert("Login Failed", "Invalid credentials");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgDecoration} />

      <View style={styles.card}>
        {/* LEFT SIDE: Enhanced Branding Section */}
        <ImageBackground 
          source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }} 
          style={styles.brandingSection}
        >
          {/* Darker, more atmospheric overlay to match architectural shadows */}
          <LinearGradient
            colors={['rgba(9, 15, 28, 0.6)', 'rgba(3, 4, 11, 0.85)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.logoWrapper}>
            {/* The "Glass Lens" Container */}
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.lensCircle}
            >
              <Ionicons name="aperture" size={44} color="#f8fafc" />
              {/* Subtle light reflection on the "glass" */}
              <View style={styles.lensRefraction} />
            </LinearGradient>
            
            {/* Ambient Glow that matches the sky/glass tones of the background */}
            <View style={styles.logoAmbientGlow} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.brandText}>
              <Text style={styles.archTypography}>ARCH</Text>
              <Text style={styles.lensTypography}>LENS</Text>
            </Text>
            {/* Minimalist divider with a glow */}
            <View style={styles.accentLine} />
            <Text style={styles.portalSubtext}>ADMINISTRATION PORTAL</Text>
          </View>
        </ImageBackground>

        {/* RIGHT SIDE: Form Section */}
        <View style={styles.formSection}>
          <View style={styles.formHeader}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.subTitle}>Please enter your details to sign in.</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={[styles.inputField, errors.email && styles.inputFieldError]}>
              <MaterialIcons name="alternate-email" size={18} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                placeholder="name@company.com"
                placeholderTextColor="#cbd5e1"
                value={email}
                onChangeText={(text) => setEmail(text)}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={[styles.inputField, errors.password && styles.inputFieldError]}>
              <MaterialIcons name="lock-outline" size={18} color="#94a3b8" />
              <TextInput
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor="#cbd5e1"
                value={password}
                onChangeText={(text) => setPassword(text)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} activeOpacity={0.8}>
            <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.btnGradient}>
              <Text style={styles.loginButtonText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.footerText}>Secure System Access</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  bgDecoration: {
    position: 'absolute',
    width: '100%', height: '100%',
    backgroundColor: '#e2e8f0',
    opacity: 0.3,
  },
  card: {
    width: width * 0.7,
    height: 520,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    elevation: 30,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
  },

  // LEFT: BRANDING SECTION
  brandingSection: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  logoWrapper: { alignItems: 'center', marginBottom: 30, justifyContent: 'center' },
  lensCircle: {
    width: 60,
    height: 60,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // clips the reflection
  },
  lensRefraction: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 60,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ rotate: '45deg' }],
  },
  logoAmbientGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 60,
    backgroundColor: '#1a1736',
    opacity: 0.45,
    zIndex: -1,
  },

  // TEXT STYLING
  textContainer: { alignItems: 'center' },
  brandText: { flexDirection: 'row', alignItems: 'baseline' },
  archTypography: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#ffffff', 
    letterSpacing: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  lensTypography: { 
    fontSize: 28, 
    fontWeight: '300', 
    color: '#bae6fd', 
    letterSpacing: 6, 
    marginLeft: 4 
  },
  accentLine: { 
    width: 30, 
    height: 3, 
    backgroundColor: '#38bdf8', 
    marginVertical: 18, 
    borderRadius: 2,
    shadowColor: '#38bdf8',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  portalSubtext: { fontSize: 10, color: '#94a3b8', fontWeight: '700', letterSpacing: 3, textAlign: 'center' },

  // RIGHT: FORM SECTION
  formSection: { flex: 1.1, paddingHorizontal: 60, justifyContent: 'center', backgroundColor: '#fff' },
  formHeader: { marginBottom: 35 },
  welcomeTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  subTitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8, marginLeft: 2 },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
  },
  inputFieldError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  textInput: { flex: 1, marginLeft: 10, color: '#1e293b', fontSize: 15 },

  loginButton: { marginTop: 15, borderRadius: 12, overflow: 'hidden' },
  btnGradient: { height: 54, justifyContent: 'center', alignItems: 'center' },
  loginButtonText: { color: 'white', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  footerText: { textAlign: 'center', marginTop: 30, fontSize: 11, color: '#cbd5e1', letterSpacing: 1.5, textTransform: 'uppercase' },
});