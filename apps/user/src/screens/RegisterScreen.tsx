import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { auth } from '@archlens/shared';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDocument } from '@archlens/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      // Store user profile in Firestore with uid as document ID
      await setDocument('users', userCredential.user.uid, {
        uid: userCredential.user.uid,
        email: userCredential.user.email || email.trim(),
        displayName: email.trim().split('@')[0],
        role: 'user'
      });
      
      Alert.alert("Success", "Account created! You can now login.", [
        { text: "OK", onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#59a0a0', '#59a0a0']} style={styles.fullBackground} />

      <View style={styles.shadowWrapper}>
        <View style={styles.card}>
          {/* Sloped Background (Left side for Register) */}
          <LinearGradient
            colors={['#abe4e4', '#ffffff']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.slopeBackground}
          />

          <View style={styles.welcomeTextSection}>
            <Text style={styles.welcomeBackText}>ARCH{"\n"}LENS</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.title}>User Register</Text>

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
                  placeholder="Create password"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <MaterialIcons name="lock" size={18} color="#64748b" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Repeat password"
                  placeholderTextColor="#94a3b8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
                <MaterialIcons name="verified-user" size={18} color="#64748b" />
              </View>
            </View>

            <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
              <LinearGradient colors={['#126a5e', '#1a656e']} style={styles.buttonGradient}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.registerButtonText}>Sign Up</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 15 }} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullBackground: { position: 'absolute', width: '100%', height: '100%' },
  shadowWrapper: { width: width * 0.88, height: 550, backgroundColor: 'transparent', boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)', elevation: 12 },
  card: { flex: 1, backgroundColor: '#ffffff', borderRadius: 24, overflow: 'hidden', flexDirection: 'row' },
  slopeBackground: { position: 'absolute', left: -110, top: -50, bottom: -70, width: '45%', transform: [{ rotate: '14deg' }] },
  formSection: { flex: 2, padding: 25, justifyContent: 'center', zIndex: 10 },
  welcomeTextSection: { flex: 1, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 20, zIndex: 10 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#194f60', marginBottom: 20 },
  welcomeBackText: { fontSize: 22, fontWeight: '900', color: '#0d9488' },
  inputGroup: { marginBottom: 15 },
  label: { color: '#64748b', fontSize: 12, marginBottom: 4, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: '#e2e8f0', paddingBottom: 5 },
  input: { flex: 1, color: '#334155', fontSize: 14 },
  registerButton: { marginTop: 15, borderRadius: 12, overflow: 'hidden' },
  buttonGradient: { paddingVertical: 14, alignItems: 'center' },
  registerButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  loginLink: { textAlign: 'center', color: '#0d433b', fontSize: 12, fontWeight: 'bold' }
});