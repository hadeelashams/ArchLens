import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function HelpCenterScreen({ navigation }: any) {
  
  const FAQItem = ({ question, answer }: any) => (
    <View style={styles.faqContainer}>
      <Text style={styles.question}>{question}</Text>
      <Text style={styles.answer}>{answer}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help Center</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.supportCard}>
            <Feather name="headphones" size={32} color="#fff" />
            <Text style={styles.supportTitle}>Need help?</Text>
            <Text style={styles.supportSub}>Our team is available 24/7</Text>
            <TouchableOpacity style={styles.contactBtn}>
              <Text style={styles.contactBtnText}>Contact Support</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          <FAQItem 
            question="How do I upload a plan?" 
            answer="Go to the Home screen and tap the '+' button. You can upload PDF or Image files directly from your gallery." 
          />
          <FAQItem 
            question="Is my data secure?" 
            answer="Yes, we use enterprise-grade encryption for all your estimates and personal data." 
          />
          <FAQItem 
            question="How do I change my password?" 
            answer="Navigate to Profile > Security > Change Password to send a reset link to your email." 
          />
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
  supportCard: { backgroundColor: '#315b76', borderRadius: 16, padding: 25, alignItems: 'center', marginBottom: 30 },
  supportTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  supportSub: { color: '#bae6fd', marginBottom: 20 },
  contactBtn: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  contactBtnText: { color: '#315b76', fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 15 },
  faqContainer: { marginBottom: 20, backgroundColor: '#f8fafc', padding: 15, borderRadius: 12 },
  question: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 5 },
  answer: { fontSize: 14, color: '#64748b', lineHeight: 20 }
});