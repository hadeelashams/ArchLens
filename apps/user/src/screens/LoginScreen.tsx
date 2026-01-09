import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { auth } from '@archlens/shared/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // On success, navigation handles the switch if you have a listener in App.tsx
            Alert.alert("Success", "Welcome to ArchLens!");
        } catch (error: any) {
            Alert.alert("Login Failed", error.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>ArchLens User Login</Text>
            <TextInput 
                style={styles.input} 
                placeholder="Email" 
                value={email} 
                onChangeText={setEmail}
                autoCapitalize="none"
            />
            <TextInput 
                style={styles.input} 
                placeholder="Password" 
                value={password} 
                onChangeText={setPassword} 
                secureTextEntry 
            />
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 15 },
    button: { backgroundColor: '#2563EB', padding: 15, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
