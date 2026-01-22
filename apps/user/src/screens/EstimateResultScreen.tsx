import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  Platform, 
  SafeAreaView, 
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Mock Rates per Sq. Ft.
const RATES = {
  Economy: 1600,
  Standard: 2200,
  Luxury: 3500
};

export default function EstimateResultScreen({ route, navigation }: any) {
  // Get data passed from ConstructionLevelScreen
  // Defaults provided in case of direct navigation for testing
  const { totalArea = 1000, level = 'Standard' } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<any>(null);

  useEffect(() => {
    // Simulate Calculation Delay
    setTimeout(() => {
      calculateCosts();
      setLoading(false);
    }, 1500);
  }, []);

  const calculateCosts = () => {
    const rate = RATES[level as keyof typeof RATES] || 2200;
    const total = totalArea * rate;

    // Standard Industry Breakdown (approximate)
    setCosts({
      total: total,
      rate: rate,
      material: total * 0.60, // 60% Material
      labor: total * 0.25,    // 25% Labor
      services: total * 0.15, // 15% Architect/Services
    });
  };

  // Helper to format currency (Indian Rupee or USD based on preference, using generic comma format here)
  const formatCurrency = (amount: number) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Reused Card Component from HomeScreen
  const CostCard = ({ title, amount, iconName, gradientColors, subtext }: any) => (
    <View style={styles.card}>
      <LinearGradient colors={gradientColors} style={styles.cardIconContainer}>
        <MaterialCommunityIcons name={iconName} size={24} color="#fff" />
      </LinearGradient>

      <View style={styles.cardTextContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtext}>{subtext}</Text>
      </View>

      <View style={styles.amountContainer}>
         <Text style={styles.amountText}>{costs ? formatCurrency(Math.round(amount)) : '...'}</Text>
         <Text style={styles.currencyLabel}>INR</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#315b76" />
        <Text style={styles.loadingText}>Calculating Estimates...</Text>
        <Text style={styles.loadingSubText}>Analyzing current market rates for {level} tier</Text>
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
          <Text style={styles.headerTitle}>Project Estimate</Text>
          <View style={{ width: 40 }} /> 
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          
          {/* HERO SECTION - Total Cost */}
          <View style={styles.heroWrapper}>
            <LinearGradient
                colors={['#315b76', '#2a4179']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroContainer}
            >
                <View style={styles.heroHeader}>
                    <Text style={styles.heroLabel}>ESTIMATED TOTAL COST</Text>
                    <View style={styles.levelBadge}>
                        <Text style={styles.levelText}>{level.toUpperCase()}</Text>
                    </View>
                </View>

                <Text style={styles.heroAmount}>
                    ₹ {formatCurrency(costs.total)}
                </Text>
                
                <Text style={styles.heroSubtitle}>
                    Based on {totalArea} sq.ft built-up area
                </Text>

                <View style={styles.divider} />

                <View style={styles.statRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Avg. Rate</Text>
                        <Text style={styles.statValue}>₹{costs.rate}/sq.ft</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Completion</Text>
                        <Text style={styles.statValue}>~8-10 Months</Text>
                    </View>
                </View>
            </LinearGradient>
          </View>

          {/* COST BREAKDOWN */}
          <View style={styles.sectionHeader}>
             <Text style={styles.sectionLabel}>COST BREAKDOWN</Text>
          </View>

          <View style={styles.cardsContainer}>
            
            <CostCard 
                title="Material Cost"
                subtext="Cement, Steel, Bricks, Finishings"
                amount={costs.material}
                iconName="cube-outline"
                gradientColors={['#4F46E5', '#818cf8']} // Indigo
            />

            <CostCard 
                title="Labor Charges"
                subtext="Contractor, Masonry, Plumbing"
                amount={costs.labor}
                iconName="account-hard-hat"
                gradientColors={['#d97706', '#fbbf24']} // Amber
            />

            <CostCard 
                title="Services & Fees"
                subtext="Architecture, Approval, Electric"
                amount={costs.services}
                iconName="file-certificate-outline"
                gradientColors={['#10b981', '#34d399']} // Emerald
            />

          </View>

          {/* DISCLAIMER */}
          <View style={styles.disclaimerBox}>
            <Ionicons name="information-circle" size={20} color="#64748b" style={{marginRight: 8}}/>
            <Text style={styles.disclaimerText}>
                This is an approximate estimation based on current market averages. Actual costs may vary by +/- 15% based on location and specific material choices.
            </Text>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.saveButtonText}>Save Estimate</Text>
            <Ionicons name="save-outline" size={20} color="#fff" style={{marginLeft: 8}}/>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Global Setup
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 20, fontSize: 18, fontWeight: '700', color: '#1e293b' },
  loadingSubText: { marginTop: 8, fontSize: 14, color: '#64748b' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  iconButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },

  // Hero Section
  heroWrapper: { marginTop: 10, marginBottom: 25 },
  heroContainer: {
    borderRadius: 24,
    padding: 24,
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

  // Section Headers
  sectionHeader: { marginBottom: 15 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },

  // Cards
  cardsContainer: { gap: 16 },
  card: { 
    backgroundColor: '#ffffff', 
    borderRadius: 20, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 2,
    borderWidth: 1, borderColor: '#f8fafc'
  },
  cardIconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTextContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  cardSubtext: { fontSize: 12, color: '#64748b' },
  amountContainer: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  currencyLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  // Disclaimer
  disclaimerBox: { 
    marginTop: 25, 
    flexDirection: 'row', 
    backgroundColor: '#f1f5f9', 
    padding: 15, 
    borderRadius: 16,
    alignItems: 'center'
  },
  disclaimerText: { flex: 1, fontSize: 11, color: '#64748b', lineHeight: 16 },

  // Action Button
  saveButton: {
    marginTop: 20,
    backgroundColor: '#315b76',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#315b76', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' }
});