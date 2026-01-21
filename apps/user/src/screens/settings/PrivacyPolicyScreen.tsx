import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lastUpdated}>Last updated: January 2026</Text>
          
          <Text style={styles.heading}>1. Introduction</Text>
          <Text style={styles.paragraph}>
            Welcome to Arch Lens. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our app.
          </Text>

          <Text style={styles.heading}>2. Data We Collect</Text>
          <Text style={styles.paragraph}>
            We may collect, use, store and transfer different kinds of personal data about you which we have grouped together follows: Identity Data, Contact Data, and Technical Data.
          </Text>

          <Text style={styles.heading}>3. How We Use Your Data</Text>
          <Text style={styles.paragraph}>
            We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances: Where we need to perform the contract we are about to enter into or have entered into with you.
          </Text>
          
          <Text style={styles.heading}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  content: { padding: 20 },
  lastUpdated: { fontSize: 12, color: '#94a3b8', marginBottom: 20, fontStyle: 'italic' },
  heading: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 15, marginBottom: 8 },
  paragraph: { fontSize: 14, color: '#64748b', lineHeight: 22, textAlign: 'justify' }
});