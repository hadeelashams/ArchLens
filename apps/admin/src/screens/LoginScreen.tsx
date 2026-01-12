import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions, Image } from 'react-native';
import { auth } from '@archlens/shared';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getUserById } from '../services/userService';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // 1. New state for visibility
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateInputs = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'Invalid email format';
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

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
        return;
      }
    } catch (error: any) {
      let newErrors: { email?: string; password?: string } = {};
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        newErrors.email = 'Invalid email or password';
        newErrors.password = 'Invalid email or password';
      } else {
        Alert.alert("Login Failed", error.message);
      }
      setErrors(newErrors);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#59a0a0', '#59a0a0']} style={styles.fullBackground} />

      <View style={styles.card}>
        <LinearGradient
          colors={['#abe4e4', '#ffffff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.slopeBackground}
        />

        <View style={styles.formSection}>
          <Text style={styles.title}>Login</Text>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.inputWrapper, errors.email && styles.inputWrapperError]}>
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                autoCapitalize="none"
              />
              <MaterialIcons name="person" size={18} color={errors.email ? '#ef4444' : '#64748b'} />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password Input with Show/Hide */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputWrapper, errors.password && styles.inputWrapperError]}>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                secureTextEntry={!showPassword} // 2. Toggle secure entry
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)} // 3. Toggle state on click
                style={styles.iconButton}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility" : "visibility-off"} // 4. Dynamic Icon
                  size={20} 
                  color={errors.password ? '#ef4444' : '#64748b'} 
                />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <LinearGradient colors={['#126a5e', '#1a656e']} style={styles.buttonGradient}>
              <Text style={styles.loginButtonText}>Login</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeTextSection}>
           <Image 
             source={require('../../assets/icon.png')} 
             style={styles.logo}
             resizeMode="cover"
           />
           <Text style={styles.welcomeBackText}>ARCH LENS</Text>
           <Text style={styles.signupLink}>ADMIN PORTAL</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullBackground: { position: 'absolute', width: '100%', height: '100%' },
  card: {
    width: width * 0.78,
    height: 480,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row',
    elevation: 10,
    borderWidth: 1,
    borderColor: '#787878',
  },
  slopeBackground: {
    position: 'absolute',
    right: -100, top: -50, bottom: -70,
    width: '46%',
    transform: [{ rotate: '14deg' }],
  },
  formSection: { flex: 1.6, padding: 30, justifyContent: 'center', zIndex: 10 },
  welcomeTextSection: { flex: 2, left: 66, justifyContent: 'center', alignItems: 'center', paddingRight: 20, zIndex: 15 },
  logo: { width: 70, height: 60, marginBottom: 2 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#194f60', marginBottom: 35 },
  welcomeBackText: { fontSize: 20, left: 2, fontWeight: '900', color: '#0d9488', textAlign: 'center', letterSpacing: 1 },
  inputGroup: { marginBottom: 20 },
  label: { color: '#64748b', fontSize: 13, marginBottom: 4, fontWeight: '600' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 5,
  },
  inputWrapperError: { borderBottomColor: '#ef4444' },
  input: { flex: 1, color: '#334155', fontSize: 15 },
  iconButton: { padding: 4 }, // Area for the eye icon
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, fontWeight: '500' },
  loginButton: { marginTop: 25, borderRadius: 12, overflow: 'hidden' },
  buttonGradient: { paddingVertical: 14, alignItems: 'center' },
  loginButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  signupLink: { color: '#0d433b', fontSize: 12, fontWeight: 'bold' },
});