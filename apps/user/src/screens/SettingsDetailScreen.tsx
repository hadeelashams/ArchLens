import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsDetailScreen({ navigation, route }: any) {
  // route.params.title will be passed from the navigator
  const title = route.name.replace(/([A-Z])/g, ' $1').trim(); 

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.placeholderText}>This is the {title} page.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 16, color: '#64748b' }
});