import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Sidebar } from './Sidebar';
import { db } from '@archlens/shared';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

const BLUE_ARCH = '#1e293b';

// --- Sub-Components (Defined outside to prevent re-renders) ---

const StatCard = ({ title, value, icon, color }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
      <Feather name={icon} size={24} color={color} />
    </View>
    <View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  </View>
);

const QueryItem = ({ item }: any) => (
  <View style={styles.queryItem}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>
        {item.userName ? item.userName.charAt(0).toUpperCase() : 'U'}
      </Text>
    </View>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.queryTitle}>{item.userName || 'Unknown User'}</Text>
        <Text style={styles.queryTime}>
          {item.createdAt ? new Date(item.createdAt.toDate()).toLocaleDateString() : 'Just now'}
        </Text>
      </View>
      <Text style={styles.queryBody} numberOfLines={2}>
        {item.message || item.subject || 'No content provided...'}
      </Text>
    </View>
  </View>
);

// --- Main Component ---

export default function AdminHomeScreen({ navigation }: any) {
  const [materialCount, setMaterialCount] = useState(0);
  const [queryCount, setQueryCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [recentQueries, setRecentQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Setup Listeners
    const unsubMaterials = onSnapshot(collection(db, 'materials'), 
      (snap) => setMaterialCount(snap.size),
      (err) => console.error("Materials listener error:", err)
    );
    
    const unsubQueriesCount = onSnapshot(collection(db, 'queries'), 
      (snap) => setQueryCount(snap.size),
      (err) => console.error("Queries count listener error:", err)
    );
    
    const unsubUsers = onSnapshot(collection(db, 'users'), 
      (snap) => setUserCount(snap.size),
      (err) => console.error("Users listener error:", err)
    );

    // 2. Fetch Recent Queries
    const qQuery = query(
      collection(db, 'queries'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubRecentQueries = onSnapshot(qQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentQueries(data);
      setLoading(false);
    }, (err) => {
      console.error("Recent queries listener error:", err);
      setLoading(false); // Stop loading even if error
    });

    // Cleanup listeners on unmount
    return () => {
      unsubMaterials();
      unsubQueriesCount();
      unsubUsers();
      unsubRecentQueries();
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Sidebar Navigation */}
      <Sidebar navigation={navigation} activeRoute="AdminHome" />

      {/* Main Content Area */}
      <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 40 }}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>System Overview</Text>
            <Text style={styles.subHeaderText}>Welcome back, Administrator.</Text>
          </View>
        </View>

        {/* Statistics Row */}
        <View style={styles.statsRow}>
          <StatCard title="Active Materials" value={materialCount} icon="package" color="#38bdf8" />
          <StatCard title="Pending Queries" value={queryCount} icon="message-square" color="#818cf8" />
          <StatCard title="Registered Users" value={userCount} icon="users" color="#10b981" />
        </View>

        {/* Dashboard Grid */}
        <View style={styles.gridContainer}>

          {/* LEFT: Quick Management */}
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Quick Management</Text>
            
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Dashboard')}>
              <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.cardGradient}>
                <Feather name="edit-3" size={32} color="#fff" />
                <Text style={styles.cardTitle}>Material Rate Master</Text>
                <Text style={styles.cardDesc}>Update prices and construction hierarchy.</Text>
                <Feather name="arrow-right" size={20} color="#bae6fd" style={{ marginTop: 20 }} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, styles.cardLight, { marginTop: 20, height: 160 }]}>
              <Feather name="settings" size={32} color="#1e293b" />
              <Text style={[styles.cardTitle, { color: '#1e293b' }]}>System Settings</Text>
              <Text style={styles.cardDesc}>Configure global units and permissions.</Text>
            </TouchableOpacity>
          </View>

          {/* RIGHT: Recent Inquiries */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Recent Inquiries</Text>
              <TouchableOpacity>
                <Text style={{ color: BLUE_ARCH, fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.updatesContainer}>
              {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator color={BLUE_ARCH} size="large" />
                </View>
              ) : recentQueries.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <Feather name="inbox" size={24} color="#cbd5e1" />
                  <Text style={{ color: '#94a3b8', marginTop: 10 }}>No inquiries found.</Text>
                </View>
              ) : (
                recentQueries.map((item) => <QueryItem key={item.id} item={item} />)
              )}
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f1f5f9' },
  mainContent: { flex: 1 },
  header: { marginBottom: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeText: { fontSize: 32, fontWeight: '800', color: '#0f172a' },
  subHeaderText: { fontSize: 16, color: '#64748b', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 40 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 25, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  statIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  gridContainer: { flexDirection: 'row', gap: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 20 },
  actionCard: { height: 260, borderRadius: 24, overflow: 'hidden' },
  cardLight: { backgroundColor: '#fff', padding: 35, borderWidth: 1, borderColor: '#e2e8f0' },
  cardGradient: { flex: 1, padding: 35, justifyContent: 'center' },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 20 },
  cardDesc: { color: '#94a3b8', fontSize: 14, marginTop: 10, lineHeight: 20 },
  updatesContainer: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', minHeight: 400 },
  queryItem: { flexDirection: 'row', gap: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  avatarText: { fontWeight: 'bold', color: '#64748b' },
  queryTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  queryBody: { fontSize: 13, color: '#64748b', marginTop: 2 },
  queryTime: { fontSize: 11, color: '#94a3b8' },
});