import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  Platform, 
  StatusBar,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '@archlens/shared';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// Enable LayoutAnimation on Android (suppress warning for New Architecture)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch (e) {
    // Ignore warning in New Architecture
  }
}

export default function EstimateResultScreen({ route, navigation }: any) {
  const { projectId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<any[]>([]);
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
      setError('Project ID not found. Please go back and try again.');
      setLoading(false);
      return;
    }

    try {
      // Listen to all estimates for this project
      const q = query(collection(db, 'estimates'), where('projectId', '==', projectId));
      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setEstimates(data);
          setError(null); // Clear any previous errors
          
          // Calculate Total and Category Breakdown
          let total = 0;
          const breakdown: any = {};
          
          data.forEach((item: any) => {
            const cost = item.totalCost || 0;
            total += cost;
            const category = item.category || 'Other';
            
            if (!breakdown[category]) {
              breakdown[category] = { total: 0, items: 0, color: getCategoryColor(category) };
            }
            breakdown[category].total += cost;
            breakdown[category].items += 1;
          });
          
          setGrandTotal(total);
          setCategoryBreakdown(breakdown);
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching estimates:', error);
          setError('Failed to load estimates. Please try again.');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error('Error setting up listener:', err);
      setError('Error loading data: ' + err.message);
      setLoading(false);
    }
  }, [projectId]);

  const getCategoryColor = (category: string) => {
    const colors: any = {
      'Foundation': ['#4F46E5', '#818cf8'],
      'Wall': ['#3b82f6', '#60a5fa'],
      'Roofing': ['#0ea5e9', '#38bdf8'],
      'Flooring': ['#14b8a6', '#2dd4bf'],
      'Painting': ['#10b981', '#34d399'],
      'Plastering': ['#64748B', '#94a3b8'],
    };
    return colors[category] || ['#6b7280', '#9ca3af'];
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Remove Item", "Are you sure you want to remove this estimate?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, 'estimates', id)) }
    ]);
  };

  const formatCurrency = (amount: number) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Category Card Component
  const CategoryCard = ({ category, data }: any) => {
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(!expanded);
    };

    const categoryEstimates = estimates.filter(e => e.category === category);

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9}
        onPress={toggleExpand}
      >
        {/* Main Row */}
        <View style={styles.cardMainRow}>
          <LinearGradient colors={data.color} style={styles.cardIconContainer}>
            <MaterialCommunityIcons name={categoryIcons[category] || "calculator-variant"} size={24} color="#fff" />
          </LinearGradient>

          <View style={styles.cardTextContent}>
            <Text style={styles.cardTitle}>{category}</Text>
            <Text style={styles.cardSubtext}>{data.items} item(s)</Text>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountText}>₹{formatCurrency(Math.round(data.total))}</Text>
            <View style={styles.currencyRow}>
              <Text style={styles.currencyLabel}>{grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) : '0'}%</Text>
              <Ionicons 
                name={expanded ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#94a3b8" 
                style={{ marginLeft: 4 }}
              />
            </View>
          </View>
        </View>

        {/* Expanded Details */}
        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.cardDivider} />
            {categoryEstimates.map((item, idx) => (
              <View key={idx} style={styles.detailRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                  {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
                </View>
                <View style={{alignItems: 'flex-end', gap: 4}}>
                  <Text style={styles.itemCost}>₹{formatCurrency(Math.round(item.totalCost))}</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#315b76" />
        <Text style={styles.loadingText}>Loading Project Summary...</Text>
        <Text style={styles.loadingSubText}>Gathering all estimates</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.iconButton}
            >
              <Ionicons name="arrow-back" size={20} color="#315b76" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Project Summary</Text>
            <View style={{ width: 40 }} /> 
          </View>
          
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={60} color="#ef4444" />
            <Text style={styles.errorTitle}>Error Loading Summary</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.iconButton}
          >
             <Ionicons name="arrow-back" size={20} color="#315b76" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Project Summary</Text>
          <View style={{ width: 40 }} /> 
        </View>

        {estimates.length === 0 ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.emptyStateContainer}>
              <MaterialCommunityIcons name="file-document-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No Estimates Yet</Text>
              <Text style={styles.emptyStateSubtext}>Add estimates from construction components to see the summary</Text>
              <TouchableOpacity 
                style={styles.addMoreButton}
                onPress={() => navigation.navigate("ConstructionLevel")}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addMoreButtonText}>Add Estimate</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            
            {/* HERO SECTION */}
            <View style={styles.heroWrapper}>
              <LinearGradient
                  colors={['#315b76', '#2a4179']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroContainer}
              >
                  <View style={styles.heroHeader}>
                      <Text style={styles.heroLabel}>PROJECT TOTAL ESTIMATE</Text>
                      <View style={styles.levelBadge}>
                          <Text style={styles.levelText}>{Object.keys(categoryBreakdown).length} CATEGORIES</Text>
                      </View>
                  </View>

                  <Text style={styles.heroAmount}>
                      ₹ {formatCurrency(grandTotal)}
                  </Text>
                  
                  <Text style={styles.heroSubtitle}>
                      {estimates.length} estimates across {Object.keys(categoryBreakdown).length} categories
                  </Text>

                  <View style={styles.divider} />

                  <View style={styles.statRow}>
                      <View style={styles.statItem}>
                          <Text style={styles.statLabel}>Total Items</Text>
                          <Text style={styles.statValue}>{estimates.length}</Text>
                      </View>
                      <View style={styles.statItem}>
                          <Text style={styles.statLabel}>Categories</Text>
                          <Text style={styles.statValue}>{Object.keys(categoryBreakdown).length}</Text>
                      </View>
                  </View>
              </LinearGradient>
            </View>

            {/* CATEGORY BREAKDOWN */}
            <View style={styles.sectionHeader}>
               <Text style={styles.sectionLabel}>CATEGORY BREAKDOWN</Text>
            </View>

            <View style={styles.cardsContainer}>
              {Object.entries(categoryBreakdown).map(([category, data]: [string, any]) => (
                <CategoryCard key={category} category={category} data={data} />
              ))}
            </View>

            {/* FOOTER ACTIONS */}
            <View style={styles.footerActions}>
              <TouchableOpacity 
                style={styles.addMoreButton}
                onPress={() => navigation.navigate("ConstructionLevel")}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addMoreButtonText}>Add More</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.exportButton}>
                <Ionicons name="download-outline" size={20} color="#315b76" />
                <Text style={styles.exportButtonText}>Export</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 20, fontSize: 18, fontWeight: '700', color: '#1e293b' },
  loadingSubText: { marginTop: 8, fontSize: 14, color: '#64748b' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 15,
  },
  iconButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },

  heroWrapper: { marginTop: 10, marginBottom: 25 },
  heroContainer: {
    borderRadius: 24, padding: 24,
    shadowColor: '#315b76', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  levelBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  levelText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 15 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'flex-start' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 2 },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '600' },

  sectionHeader: { marginBottom: 15 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },

  cardsContainer: { gap: 16 },
  card: { 
    backgroundColor: '#ffffff', borderRadius: 20, padding: 16, 
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 2,
    borderWidth: 1, borderColor: '#f8fafc',
    overflow: 'hidden'
  },
  cardMainRow: { flexDirection: 'row', alignItems: 'center' },
  cardIconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTextContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  cardSubtext: { fontSize: 12, color: '#64748b' },
  amountContainer: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  currencyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  currencyLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  expandedContent: { marginTop: 16 },
  cardDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemName: { fontSize: 13, color: '#1e293b', fontWeight: '600' },
  itemNotes: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  itemCost: { fontSize: 13, fontWeight: '700', color: '#315b76' },

  emptyStateContainer: { 
    flex: 1, justifyContent: 'center', alignItems: 'center', 
    paddingVertical: 60, paddingHorizontal: 24 
  },
  emptyStateText: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 16 },
  emptyStateSubtext: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center', lineHeight: 19 },

  footerActions: { 
    flexDirection: 'row', gap: 12, marginTop: 25
  },
  addMoreButton: {
    flex: 1, backgroundColor: '#315b76', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#315b76', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  addMoreButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  
  exportButton: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  exportButtonText: { fontSize: 15, fontWeight: '700', color: '#315b76' },

  // Error State Styles
  errorContainer: { 
    flex: 1, justifyContent: 'center', alignItems: 'center', 
    paddingVertical: 60, paddingHorizontal: 24 
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#ef4444', marginTop: 16, marginBottom: 8 },
  errorText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryButton: {
    backgroundColor: '#315b76', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12
  },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});