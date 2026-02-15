import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Sidebar } from './Sidebar';
import { db } from '@archlens/shared';
import { collection, onSnapshot } from 'firebase/firestore';

const { width } = Dimensions.get('window');
const SLATE_900 = '#0f172a';
const SLATE_800 = '#1e293b';
const SKY_500 = '#0ea5e9';

// --- Aesthetic Stat Card ---
const StatCard = ({ title, value, icon, color }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
      <Feather name={icon} size={20} color={color} />
    </View>
    <View style={styles.statInfo}>
      <Text style={styles.statLabel}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  </View>
);

// --- Category Breakdown Card ---
const CategoryTile = ({ category, count, index }: any) => {
  const icons: any = {
    'Foundation': 'layers',
    'Superstructure': 'home',
    'Finishing': 'droplet',
    'Electrical': 'zap',
    'Plumbing': 'filter'
  };

  return (
    <View style={styles.categoryTile}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryIconCircle}>
          <Feather name={icons[category] || 'box'} size={18} color={SLATE_800} />
        </View>
        <Text style={styles.categoryCount}>{count}</Text>
      </View>
      <Text style={styles.categoryName}>{category}</Text>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${Math.min(count * 5, 100)}%` }]} />
      </View>
    </View>
  );
};

export default function AdminHomeScreen({ navigation }: any) {
  const [materialCount, setMaterialCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [queryCount, setQueryCount] = useState(0);
  const [categoryData, setCategoryData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Materials and aggregate by category
    const unsubMaterials = onSnapshot(collection(db, 'materials'), (snap) => {
      setMaterialCount(snap.size);
      const counts: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const cat = doc.data().category || 'Other';
        counts[cat] = (counts[cat] || 0) + 1;
      });
      setCategoryData(counts);
      setLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => setUserCount(snap.size));
    const unsubQueries = onSnapshot(collection(db, 'queries'), (snap) => setQueryCount(snap.size));

    return () => {
      unsubMaterials();
      unsubUsers();
      unsubQueries();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Sidebar navigation={navigation} activeRoute="AdminHome" />

      <ScrollView style={styles.mainContent} contentContainerStyle={{ padding: 40 }}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            <Text style={styles.welcomeText}>Admin Dashboard</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn}>
            <Feather name="bell" size={20} color={SLATE_800} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        {/* Global Stats */}
        <View style={styles.statsRow}>
          <StatCard title="Total Materials" value={materialCount} icon="package" color={SKY_500} />
          <StatCard title="Active Users" value={userCount} icon="users" color="#10b981" />
          <StatCard title="Total Queries" value={queryCount} icon="mail" color="#f59e0b" />
        </View>

        <View style={styles.gridContainer}>
          
          {/* LEFT COLUMN: Category Inventory */}
          <View style={{ flex: 2 }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Material Inventory</Text>
              <Text style={styles.sectionSub}>Breakdown by construction phase</Text>
            </View>

            {loading ? (
              <ActivityIndicator color={SLATE_800} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.categoryGrid}>
                {Object.keys(categoryData).map((cat, index) => (
                  <CategoryTile key={cat} category={cat} count={categoryData[cat]} index={index} />
                ))}
              </View>
            )}
          </View>

          {/* RIGHT COLUMN: Quick Actions */}
          <View style={{ flex: 1, marginLeft: 40 }}>
            <Text style={styles.sectionTitle}>Control Panel</Text>
            
            <TouchableOpacity 
              style={styles.mainActionCard}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <LinearGradient colors={[SLATE_800, SLATE_900]} style={styles.actionGradient}>
                <View style={styles.actionIconCircle}>
                  <Feather name="database" size={24} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>Rate Master</Text>
                <Text style={styles.actionDesc}>Manage material hierarchy and live market pricing.</Text>
                <View style={styles.actionFooter}>
                  <Text style={styles.actionLink}>Open Database</Text>
                  <Feather name="arrow-right" size={16} color={SKY_500} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryActionCard}>
              <Feather name="shield" size={20} color={SLATE_800} />
              <Text style={styles.secondaryActionText}>Access Logs</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryActionCard}>
              <Feather name="settings" size={20} color={SLATE_800} />
              <Text style={styles.secondaryActionText}>System Config</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f0f4f8' },
  mainContent: { flex: 1 },
  
  // Header
  header: { marginBottom: 35, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  dateText: { fontSize: 12, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  welcomeText: { fontSize: 32, fontWeight: '800', color: SLATE_900, marginTop: 6 },
  profileBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 2.5, borderColor: '#fff' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 40 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 12 },
  statIconContainer: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  statInfo: { flex: 1 },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  statValue: { fontSize: 24, fontWeight: '800', color: SLATE_900 },

  // Grid
  gridContainer: { flexDirection: 'row' },
  sectionHeader: { marginBottom: 28 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: SLATE_900, marginBottom: 6 },
  sectionSub: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  
  // Category Grid
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  categoryTile: { width: '47%', backgroundColor: '#fff', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 8 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  categoryIconCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  categoryCount: { fontSize: 20, fontWeight: '800', color: SLATE_900 },
  categoryName: { fontSize: 15, fontWeight: '700', color: SLATE_800, marginBottom: 12 },
  progressBarBg: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: SKY_500 },

  // Quick Actions
  mainActionCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16 },
  actionGradient: { padding: 28 },
  actionIconCircle: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  actionTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  actionDesc: { fontSize: 13, color: '#cbd5e1', lineHeight: 20, marginBottom: 22 },
  actionFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionLink: { color: '#0ea5e9', fontWeight: '700', fontSize: 13 },
  
  secondaryActionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6 },
  secondaryActionText: { marginLeft: 14, fontSize: 14, fontWeight: '600', color: SLATE_800 }
});