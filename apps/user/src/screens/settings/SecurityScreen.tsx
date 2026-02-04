import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function SecurityScreen({ navigation }: any) {
  
  const handleChangePassword = () => {
    Alert.alert("Reset Password", "A password reset link will be sent to your email.");
  };

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account", "This action is irreversible. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive" }
    ]);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <TouchableOpacity style={styles.row} onPress={handleChangePassword}>
            <View style={styles.iconBox}>
              <Feather name="lock" size={20} color="#315b76" />
            </View>
            <Text style={styles.rowText}>Change Password</Text>
            <Feather name="chevron-right" size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.row}>
            <View style={styles.iconBox}>
              <Feather name="smartphone" size={20} color="#315b76" />
            </View>
            <Text style={styles.rowText}>Two-Factor Authentication</Text>
            <Feather name="chevron-right" size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  content: { padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  iconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rowText: { flex: 1, fontSize: 16, fontWeight: '500', color: '#1e293b' },
  divider: { height: 30 },
  deleteButton: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 12, padding: 15, alignItems: 'center' },
  deleteText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 }
});