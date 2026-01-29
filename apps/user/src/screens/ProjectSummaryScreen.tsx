import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { db } from '@archlens/shared';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

export default function ProjectSummaryScreen({ route, navigation }: any) {
  const { projectId } = route.params || {};
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    if (!projectId) {
        setLoading(false);
        return;
    }

    // Listen to all estimates for this project
    const q = query(collection(db, 'estimates'), where('projectId', '==', projectId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEstimates(data);
      
      // Calculate Total
      const total = data.reduce((sum: number, item: any) => sum + (item.totalCost || 0), 0);
      setGrandTotal(total);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleDelete = async (id: string) => {
    Alert.alert("Remove Item", "Are you sure you want to remove this estimate?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, 'estimates', id)) }
    ]);
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
        <View style={styles.cardIcon}>
            <MaterialCommunityIcons name="calculator-variant" size={24} color="#315b76" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.itemName}</Text>
            <Text style={styles.cardSubtitle}>{item.category} • {item.notes || 'No details'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.cardPrice}>₹{Math.round(item.totalCost).toLocaleString()}</Text>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 5, marginTop: 5 }}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
        </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Project Estimate Summary</Text>
            <View style={{ width: 24 }} />
        </View>

        {loading ? (
            <ActivityIndicator size="large" color="#315b76" style={{ marginTop: 50 }} />
        ) : estimates.length === 0 ? (
            <View style={styles.emptyState}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={64} color="#cbd5e1" />
                <Text style={styles.emptyText}>No estimates added yet.</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ConstructionLevel', { projectId })}>
                    <Text style={styles.addBtnText}>Add Component</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <FlatList
                data={estimates}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListFooterComponent={<View style={{ height: 100 }} />}
            />
        )}

        {/* GRAND TOTAL FOOTER */}
        {estimates.length > 0 && (
            <View style={styles.footer}>
                <View>
                    <Text style={styles.totalLabel}>ESTIMATED GRAND TOTAL</Text>
                    <Text style={styles.totalValue}>₹{Math.round(grandTotal).toLocaleString()}</Text>
                </View>
                <TouchableOpacity style={styles.exportBtn}>
                    <Text style={styles.exportText}>Export PDF</Text>
                    <Ionicons name="download-outline" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  backBtn: { padding: 5 },
  listContent: { padding: 20 },
  card: { backgroundColor: '#fff', flexDirection: 'row', padding: 15, borderRadius: 16, marginBottom: 12, alignItems: 'center', gap: 12, elevation: 2 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  cardSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#94a3b8', marginTop: 10, marginBottom: 20 },
  addBtn: { backgroundColor: '#315b76', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: 'bold' },

  footer: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 10 },
  totalLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  totalValue: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  exportBtn: { backgroundColor: '#315b76', flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 8 },
  exportText: { color: '#fff', fontWeight: '700' }
});