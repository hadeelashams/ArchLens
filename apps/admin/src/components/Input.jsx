import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

/**
 * Reusable Input Component for React Native
 * Handles text, email, and password inputs with validation
 */
export default function Input({
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  disabled = false,
  ...props
}) {
  const isSecure = type === 'password';
  
  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        editable={!disabled}
        secureTextEntry={isSecure}
        keyboardType={type === 'email' ? 'email-address' : 'default'}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#333' },
  required: { color: '#d32f2f', marginLeft: 4 },
  input: { padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 6, backgroundColor: '#fff' },
  inputError: { borderColor: '#d32f2f' },
  errorText: { color: '#d32f2f', fontSize: 12, marginTop: 4 }
});
