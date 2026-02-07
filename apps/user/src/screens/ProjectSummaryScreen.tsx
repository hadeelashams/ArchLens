import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Platform, Alert, ActivityIndicator, LayoutAnimation, UIManager 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { db } from '@archlens/shared';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

// Enable LayoutAnimation on Android (suppress warning for New Architecture)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch (e) {
    // Ignore warning in New Architecture
  }
}

export default function ProjectSummaryScreen({ route, navigation }: any) {
  const { projectId } = route.params || {};
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any>({});

  // Category icons mapping
  const categoryIcons: any = {
    'Foundation': 'home',
    'Wall': 'view-grid-plus',
    'Roofing': 'home-roof',
    'Flooring': 'view-module',
    'Painting': 'format-paint',
    'Plastering': 'texture',
  };

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
      
      // Calculate Total and Category Breakdown
      let total = 0;
      const breakdown: any = {};
      
      data.forEach((item: any) => {
        const cost = item.totalCost || 0;
        total += cost;
        const category = item.category || 'Other';
        
        if (!breakdown[category]) {
          breakdown[category] = { total: 0, items: 0 };
        }
        breakdown[category].total += cost;
        breakdown[category].items += 1;
      });
      
      setGrandTotal(total);
      setCategoryBreakdown(breakdown);
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

  // --- SUB-COMPONENT FOR EXPANDABLE CARD ---
  const ExpandableEstimateCard = ({ item, categoryIcons }: any) => {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = item.lineItems && item.lineItems.length > 0;

    const toggleExpand = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(!expanded);
    };

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9} 
        onPress={hasDetails ? toggleExpand : undefined}
      >
        {/* HEADER ROW */}
        <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
                <MaterialCommunityIcons 
                  name={categoryIcons[item.category] || "calculator-variant"} 
                  size={24} 
                  color="#315b76" 
                />
            </View>
            
            <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.itemName}</Text>
                <Text style={styles.cardSubtitle}>{item.category}</Text>
            </View>
            
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardPrice}>₹{Math.round(item.totalCost).toLocaleString()}</Text>
                <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                    
                    {hasDetails && (
                        <Ionicons 
                          name={expanded ? "chevron-up" : "chevron-down"} 
                          size={20} 
                          color="#94a3b8" 
                          style={{ marginLeft: 8 }}
                        />
                    )}
                </View>
            </View>
        </View>

        {/* EXPANDED DETAILS */}
        {expanded && hasDetails && (
            <View style={styles.detailsContainer}>
                <View style={styles.divider} />
                <View style={styles.detailHeader}>
                    <Text style={styles.detailTh}>ITEM</Text>
                    <Text style={styles.detailTh}>QTY</Text>
                    <Text style={[styles.detailTh, { textAlign: 'right' }]}>COST</Text>
                </View>
                
                {item.lineItems.map((line: any, index: number) => (
                    <View key={index} style={styles.detailRow}>
                        <View style={{ flex: 2 }}>
                            <Text style={styles.detailName}>{line.name}</Text>
                            {line.desc ? <Text style={styles.detailDesc}>{line.desc}</Text> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.detailText}>{line.qty} {line.unit}</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={styles.detailPrice}>₹{Math.round(line.total).toLocaleString()}</Text>
                        </View>
                    </View>
                ))}
                
                {/* Optional: Show Assumptions/Specs if available */}
                {item.specifications && (
                    <View style={styles.specsContainer}>
                        <Text style={styles.specsTitle}>Specifications:</Text>
                        <Text style={styles.specsText}>
                            Method: {item.specifications.method} • Depth: {item.specifications.depth}' 
                            {item.specifications.plinth ? ' • Includes Plinth' : ''}
                        </Text>
                    </View>
                )}
            </View>
        )}
      </TouchableOpacity>
    );
  };

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
                <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ConstructionLevel', { projectId, totalArea: 1000, rooms: [] })}>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.addBtnText}>Start Adding Components</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <>
                {/* Category Breakdown Cards */}
                <View style={styles.breakdownContainer}>
                    <Text style={styles.breakdownTitle}>Cost Breakdown by Category</Text>
                    <View style={styles.breakdownGrid}>
                        {Object.entries(categoryBreakdown).map(([category, data]: [string, any]) => (
                            <View key={category} style={styles.breakdownCard}>
                                <MaterialCommunityIcons name={categoryIcons[category] || "calculator-variant"} size={24} color="#315b76" />
                                <Text style={styles.breakdownCategory}>{category}</Text>
                                <Text style={styles.breakdownAmount}>₹{Math.round(data.total).toLocaleString()}</Text>
                                <Text style={styles.breakdownCount}>{data.items} item(s)</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <FlatList
                    data={estimates}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => <ExpandableEstimateCard item={item} categoryIcons={categoryIcons} />}
                    contentContainerStyle={styles.listContent}
                    scrollEnabled={false}
                    ListFooterComponent={<View style={{ height: 20 }} />}
                />
            </>
        )}

        {/* GRAND TOTAL FOOTER */}
        {estimates.length > 0 && (
            <View style={styles.footer}>
                <View style={styles.footerLeft}>
                    <Text style={styles.totalLabel}>ESTIMATED GRAND TOTAL</Text>
                    <Text style={styles.totalValue}>₹{Math.round(grandTotal).toLocaleString()}</Text>
                </View>
                <View style={styles.footerRight}>
                    <TouchableOpacity style={styles.addMoreBtn} onPress={() => navigation.navigate('ConstructionLevel', { projectId, totalArea: 1000, rooms: [] })}>
                        <Ionicons name="add-circle" size={18} color="#fff" />
                        <Text style={styles.addMoreText}>Add More</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.exportBtn} onPress={() => navigation.navigate('EstimateResult', { projectId })}>
                        <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
                        <Text style={styles.exportText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  backBtn: { padding: 5 },
  listContent: { padding: 20, paddingBottom: 20 },
  
  // BREAKDOWN SECTION
  breakdownContainer: { paddingHorizontal: 20, paddingVertical: 15 },
  breakdownTitle: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  breakdownCard: { 
    flex: 1, 
    minWidth: '48%', 
    backgroundColor: '#fff', 
    padding: 12, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1
  },
  breakdownCategory: { fontSize: 11, fontWeight: '700', color: '#1e293b', marginTop: 6, textAlign: 'center' },
  breakdownAmount: { fontSize: 13, fontWeight: '800', color: '#10b981', marginTop: 4 },
  breakdownCount: { fontSize: 9, color: '#94a3b8', marginTop: 2 },
  
  // CARD STYLES
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, elevation: 2, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', gap: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  cardSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#10b981' },
  actionRow: { flexDirection: 'row', marginTop: 6, alignItems: 'center', justifyContent: 'flex-end' },
  iconBtn: { padding: 4 },

  // DETAILED VIEW STYLES
  detailsContainer: { backgroundColor: '#f8fafc', paddingHorizontal: 15, paddingBottom: 15 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 10 },
  detailHeader: { flexDirection: 'row', marginBottom: 8 },
  detailTh: { fontSize: 10, fontWeight: '700', color: '#94a3b8', flex: 1 },
  detailRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailName: { fontSize: 12, fontWeight: '600', color: '#334155' },
  detailDesc: { fontSize: 10, color: '#94a3b8' },
  detailText: { fontSize: 12, color: '#475569' },
  detailPrice: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  
  specsContainer: { marginTop: 10, padding: 8, backgroundColor: '#eef2ff', borderRadius: 8 },
  specsTitle: { fontSize: 10, fontWeight: '700', color: '#6366f1' },
  specsText: { fontSize: 11, color: '#4338ca', marginTop: 2 },

  // Empty State
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#94a3b8', marginTop: 10, marginBottom: 20, fontSize: 14 },
  addBtn: { backgroundColor: '#315b76', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Footer
  footer: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 10 },
  footerLeft: { flex: 1 },
  footerRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  totalLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginTop: 4 },
  addMoreBtn: { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, gap: 6 },
  addMoreText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  exportBtn: { backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, gap: 6 },
  exportText: { color: '#fff', fontWeight: '700', fontSize: 12 }
});