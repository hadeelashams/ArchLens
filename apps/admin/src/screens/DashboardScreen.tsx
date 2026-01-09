import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { auth } from '@archlens/shared/firebase';
import { signOut } from 'firebase/auth';

export default function DashboardScreen() {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ArchLens Admin Panel</Text>
      <Text style={styles.subtitle}>Welcome, Admin</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dashboard Features</Text>
        <Text style={styles.cardText}>📊 View Material Prices</Text>
        <Text style={styles.cardText}>✏️ Update Rates</Text>
        <Text style={styles.cardText}>📈 Monitor Usage</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: '#F3F4F6', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#111827', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#6B7280', marginBottom: 30 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 30, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
  cardText: { fontSize: 14, color: '#4B5563', marginBottom: 8 },
  logoutButton: { backgroundColor: '#EF4444', padding: 15, borderRadius: 10, alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
