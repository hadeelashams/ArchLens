import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen({ navigation }: any) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [promoEnabled, setPromoEnabled] = useState(true);

  const NotificationRow = ({ title, subtitle, value, onValueChange }: any) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        trackColor={{ false: "#cbd5e1", true: "#315b76" }}
        thumbColor={Platform.OS === 'ios' ? '#fff' : value ? "#fff" : "#f4f3f4"}
        onValueChange={onValueChange}
        value={value}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionHeader}>General</Text>
          <NotificationRow 
            title="Push Notifications" 
            subtitle="Receive alerts on your device"
            value={pushEnabled}
            onValueChange={setPushEnabled}
          />
          
          <Text style={styles.sectionHeader}>Updates</Text>
          <NotificationRow 
            title="Email Updates" 
            subtitle="Receive digest via email"
            value={emailEnabled}
            onValueChange={setEmailEnabled}
          />
          <NotificationRow 
            title="Promotions & Tips" 
            subtitle="News about features and offers"
            value={promoEnabled}
            onValueChange={setPromoEnabled}
          />
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
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginTop: 20, marginBottom: 10, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  rowSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 }
});