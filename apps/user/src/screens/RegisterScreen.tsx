import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Dimensions, 
  ActivityIndicator, 
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

// Keeping your exact logic imports
import { auth } from '@archlens/shared';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDocument } from '@archlens/shared';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      await setDocument('users', userCredential.user.uid, {
        uid: userCredential.user.uid,
        email: userCredential.user.email || email.trim(),
        displayName: email.trim().split('@')[0],
        role: 'user'
      });
      
      Alert.alert("Success", "Account created successfully!", [
        { text: "OK", onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        
        {/* Header Image - Matching Login */}
        <ImageBackground 
          source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }} 
          style={styles.headerImage}
        >
          <View style={styles.curveWrapper}>
            <View style={styles.whiteCurve} />
          </View>
        </ImageBackground>

        <View style={styles.formContent}>
          {/* Brand Header */}
          <Text style={styles.archLensTitle}>ARCH LENS</Text>
          <Text style={styles.descriptionHeader}>Join Our Community</Text>

          <View style={styles.inputContainer}>
            
            {/* Email Field */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputBox}>
              <MaterialIcons name="email" size={20} color="#335c77" />
              <TextInput
                style={styles.inputField}
                placeholder="name@example.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password Field */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputBox}>
              <MaterialIcons name="lock" size={20} color="#335c77" />
              <TextInput
                style={styles.inputField}
                placeholder="Create password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons 
                  name={showPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#94a3b8" 
                />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Field */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputBox}>
              <MaterialIcons name="verified-user" size={20} color="#335c77" />
              <TextInput
                style={styles.inputField}
                placeholder="Repeat password"
                placeholderTextColor="#94a3b8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <MaterialIcons 
                  name={showConfirmPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#94a3b8" 
                />
              </TouchableOpacity>
            </View>

            {/* Register Button */}
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={handleRegister} 
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.btnText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            {/* Login Redirect */}
            <TouchableOpacity 
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginBold}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerImage: {
    width: '100%',
    height: height * 0.35, // Adjusted slightly for registration fields
    justifyContent: 'flex-end',
  },
  curveWrapper: {
    height: 80,
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
  },
  whiteCurve: {
    backgroundColor: '#ffffff',
    height: 200,
    width: width * 1.4,
    borderTopLeftRadius: width,
    borderTopRightRadius: width,
    position: 'absolute',
    bottom: -120, 
  },
  formContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingHorizontal: 35,
    marginTop: -40, 
  },
  archLensTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#335c77',
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    letterSpacing: 2,
  },
  descriptionHeader: {
    fontSize: 15,
    color: '#7d7d7d',
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#335c77',
    marginBottom: 8,
    marginLeft: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  inputField: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1e293b',
  },
  actionBtn: {
    backgroundColor: '#335c77',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  },
  loginLink: {
    marginTop: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  loginText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  loginBold: {
    color: '#335c77',
    fontWeight: 'bold',
  }
});