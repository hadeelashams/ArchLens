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

// Import for Database Timestamps
import { serverTimestamp } from 'firebase/firestore'; 

const { width, height } = Dimensions.get('window');

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ADDED: State to hold error messages
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  // ADDED: Validation Logic function
  const validateInputs = () => {
    const newErrors: { email?: string; password?: string; confirmPassword?: string } = {};
    let isValid = true;

    // Email Check
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    // Password Check
    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    // Confirm Password Check
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    // Clear previous errors
    setErrors({});

    // Check Validation first
    if (!validateInputs()) {
      return; 
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      // Your existing document creation logic
      await setDocument('users', userCredential.user.uid, {
        uid: userCredential.user.uid,
        email: userCredential.user.email || email.trim(),
        displayName: email.trim().split('@')[0],
        role: 'user',
        isActive: true,
        createdAt: serverTimestamp() 
      });
      
      Alert.alert("Success", "Account created successfully!", [
        { text: "OK", onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      console.log(error.code);
      const newErrors: { email?: string; password?: string } = {};

      // Map Firebase errors to specific fields
      switch (error.code) {
        case 'auth/email-already-in-use':
          newErrors.email = 'This email is already in use.';
          break;
        case 'auth/invalid-email':
          newErrors.email = 'Invalid email address.';
          break;
        case 'auth/weak-password':
          newErrors.password = 'Password is too weak.';
          break;
        default:
          Alert.alert("Registration Failed", error.message);
      }
      setErrors(newErrors);
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
        
        {/* Header Image */}
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
            
            {/* --- Email Field --- */}
            <Text style={styles.label}>Email Address</Text>
            {/* Apply Error Style if error exists */}
            <View style={[styles.inputBox, errors.email ? styles.inputFieldError : null]}>
              <MaterialIcons name="email" size={20} color="#335c77" />
              <TextInput
                style={styles.inputField}
                placeholder="name@example.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({...errors, email: undefined});
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            {/* Display Email Error Text */}
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}


            {/* --- Password Field --- */}
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputBox, errors.password ? styles.inputFieldError : null]}>
              <MaterialIcons name="lock" size={20} color="#335c77" />
              <TextInput
                style={styles.inputField}
                placeholder="Create password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({...errors, password: undefined});
                }}
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
            {/* Display Password Error Text */}
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}


            {/* --- Confirm Password Field --- */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputBox, errors.confirmPassword ? styles.inputFieldError : null]}>
              <MaterialIcons name="verified-user" size={20} color="#335c77" />
              <TextInput
                style={styles.inputField}
                placeholder="Repeat password"
                placeholderTextColor="#94a3b8"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) setErrors({...errors, confirmPassword: undefined});
                }}
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
            {/* Display Confirm Password Error Text */}
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}


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
    height: height * 0.35, 
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
    marginBottom: 8, // Slightly reduced bottom margin to fit error text closer
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  // ADDED: Style for Error State (Red Border & Background)
  inputFieldError: {
    borderColor: '#ef4444', 
  },
  inputField: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1e293b',
  },
  // ADDED: Style for Error Text Message
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: -4,
    fontWeight: '500'
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