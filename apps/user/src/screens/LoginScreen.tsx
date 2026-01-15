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
// KEEPING YOUR EXACT LINKS
import { auth } from '@archlens/shared';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getUserById } from '../services/userService';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // New state for hide/show

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userProfile = await getUserById(userCredential.user.uid);
      if (!userProfile) {
        await auth.signOut();
        Alert.alert("Login Failed", "User profile not found. Please register first.");
        return;
      }
    } catch (error: any) {
      Alert.alert("Login Failed", "Invalid email or password.");
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
        
        <ImageBackground 
          source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }} 
          style={styles.headerImage}
        >
          <View style={styles.curveWrapper}>
            <View style={styles.whiteCurve} />
          </View>
        </ImageBackground>

        <View style={styles.formContent}>
          {/* TITLE - Gap reduced significantly by negative marginTop */}
          <Text style={styles.archLensTitle}>ARCH LENS</Text>
          <Text style={styles.descriptionHeader}>Plan Your Home</Text>

          <View style={styles.inputContainer}>
            
            {/* Email Label & Box */}
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

            {/* Password Label & Box */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputBox}>
              <MaterialIcons name="lock" size={20} color="#335c77" />
              <TextInput
                style={styles.inputField}
                placeholder="Enter password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword} // Toggle logic
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons 
                  name={showPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#94a3b8" 
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.getStartedBtn} 
              onPress={handleLogin} 
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.btnText}>Login</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.registerLink}
                onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.registerText}>
                New user? <Text style={styles.registerBold}>Create Account</Text>
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
    height: height * 0.45, // Slightly reduced image height
    justifyContent: 'flex-end',
  },
  curveWrapper: {
    height: 100,
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
    bottom: -100, // Pushes the curve center up
  },
  formContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingHorizontal: 35,
    marginTop: -55, // Increased negative margin to pull Arch Lens closer to image
  },
  archLensTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#335c77',
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    letterSpacing: 2,
    marginBottom: 0,
  },
  descriptionHeader: {
    fontSize: 15,
    color: '#7d7d7d',
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 25,
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
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  inputField: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1e293b',
  },
  getStartedBtn: {
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
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  registerBold: {
    color: '#335c77',
    fontWeight: 'bold',
  }
});