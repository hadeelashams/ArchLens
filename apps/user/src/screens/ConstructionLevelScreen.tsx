import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  Platform,
  StatusBar,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// --- 1. COMPONENT DATA ---
const COMPONENT_DATA = [
  {
    id: '1',
    title: 'Foundation',
    description: 'Excavation, RCC footing, and plinth beam',
    icon: 'home', 
    iconLib: 'MaterialIcons',
    gradientColors: ['#4F46E5', '#818cf8'], 
  },
  {
    id: '2',
    title: 'Wall and Masonry',
    description: 'Brickwork, blocks, and internal walls',
    icon: 'view-grid-plus', 
    iconLib: 'MaterialCommunityIcons',
    gradientColors: ['#3b82f6', '#60a5fa'],
  },
  {
    id: '3',
    title: 'Roofing',
    description: 'RC slab, chemical waterproofing',
    icon: 'home-roof', 
    iconLib: 'MaterialCommunityIcons',
    gradientColors: ['#0ea5e9', '#38bdf8'],
  },
  {
    id: '4',
    title: 'Plastering',
    description: 'Internal gypsum, external sand finish',
    icon: 'texture', 
    iconLib: 'MaterialIcons',
    gradientColors: ['#64748B', '#94a3b8'],
  },
  {
    id: '5',
    title: 'Flooring',
    description: 'Premium vitrified tiles 600x600...',
    icon: 'view-module', 
    iconLib: 'MaterialIcons',
    gradientColors: ['#14b8a6', '#2dd4bf'],
  },
  {
    id: '6',
    title: 'Painting',
    description: 'Premium emulsion, acrylic exterior...',
    icon: 'format-paint', 
    iconLib: 'MaterialIcons',
    gradientColors: ['#10b981', '#34d399'],
  },
];

const BUDGET_TIERS = [
  { id: 'Economy', label: 'Economy', subtitle: 'Basic & Durable', color: '#10b981' },
  { id: 'Standard', label: 'Standard', subtitle: 'Best Value', color: '#3b82f6' },
  { id: 'Luxury', label: 'Luxury', subtitle: 'Premium Finish', color: '#8b5cf6' },
];

export default function ConstructionLevelScreen({ route, navigation }: any) {
  const { totalArea, projectId, rooms, wallComposition: initialWallComposition } = route.params || { totalArea: 0, projectId: null, rooms: [], wallComposition: null };
  
  // Store wall composition in state so it persists across navigations
  const [wallComposition, setWallComposition] = useState(initialWallComposition);
  
  // CHANGED: Initial state is NULL to force selection
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  // Update wall composition when route params change (when returning from WallScreen with updated data)
  useEffect(() => {
    if (route.params?.wallComposition) {
      console.log('📊 Received updated wall composition from WallScreen:', route.params.wallComposition);
      setWallComposition(route.params.wallComposition);
    }
  }, [route.params?.wallComposition]);

  // --- HOME NAVIGATION HANDLER ---
  const goHome = () => {
    navigation.navigate('Home');
  };

  const renderIcon = (lib: string, name: any) => {
    if (lib === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={name} size={24} color="#FFF" />;
    }
    return <MaterialIcons name={name} size={24} color="#FFF" />;
  };

  const handleCardPress = (item: any) => {
    // NEW LOGIC: Prevent navigation if no tier selected
    if (!activeTab) {
      Alert.alert(
        "Select Quality Level",
        "Please select a Quality Level (Economy, Standard, or Luxury) before choosing a component.",
        [{ text: "OK" }]
      );
      return;
    }

    if (item.title === 'Foundation') {
      navigation.navigate('FoundationSelection', { totalArea, projectId, tier: activeTab }); 
    } 
    else if (item.title === 'Wall and Masonry') {
      navigation.navigate('WallDetails', { totalArea, projectId, rooms, tier: activeTab, wallComposition });
    } 
    else if (item.title === 'Roofing') {
      navigation.navigate('RoofingScreen', { totalArea, projectId, tier: activeTab });
    }
    else if (item.title === 'Flooring') {
      navigation.navigate('FlooringScreen', { totalArea, projectId, tier: activeTab });
    }
    else if (item.title === 'Painting') {
      navigation.navigate('PaintingScreen', { totalArea, projectId, tier: activeTab });
    }
    else {
      navigation.navigate('EstimateResult', { totalArea, level: activeTab, projectId });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView style={styles.safeArea}>
      
        {/* --- HEADER WITH HOME BUTTON --- */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.iconButton}
          >
             <Ionicons name="arrow-back" size={20} color="#315b76" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Construction Level</Text>
          
          <TouchableOpacity 
            onPress={goHome} 
            style={styles.iconButton}
          >
             <Ionicons name="home-outline" size={20} color="#315b76" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          
          {/* --- COMPACT AREA CARD --- */}
          {totalArea > 0 && (
            <View style={styles.miniSummaryCard}>
               <View style={styles.miniSummaryLeft}>
                  <MaterialCommunityIcons name="ruler-square" size={18} color="#315b76" />
                  <Text style={styles.miniSummaryLabel}>Total Built-up Area</Text>
               </View>
               <Text style={styles.miniSummaryValue}>{totalArea} <Text style={{fontSize:12, fontWeight:'normal'}}>sq.ft</Text></Text>
            </View>
          )}

          {/* STEP 1: BUDGET TIERS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>1. Select Quality Level <Text style={{color:'red'}}>*</Text></Text>
          </View>

          <View style={styles.tierContainer}>
            {BUDGET_TIERS.map((tier) => {
              const isActive = activeTab === tier.id;
              return (
                <TouchableOpacity
                  key={tier.id}
                  style={[
                    styles.tierCard, 
                    isActive && { borderColor: tier.color, backgroundColor: '#fff', elevation: 2 }
                  ]}
                  onPress={() => setActiveTab(tier.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tierTitle, isActive && { color: tier.color }]}>{tier.label}</Text>
                  <Text style={styles.tierSub}>{tier.subtitle}</Text>
                  {isActive && (
                    <View style={[styles.activeDot, { backgroundColor: tier.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* SEARCH BAR */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search components..."
              placeholderTextColor="#94A3B8"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {/* --- STEP 2: COMPONENT CARDS --- */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>2. Select Component</Text>
          </View>

          <View style={[styles.cardsContainer, !activeTab && { opacity: 0.6 }]}> 
            {/* Added opacity style if no tab is selected */}
            
            {COMPONENT_DATA.filter(item => 
              item.title.toLowerCase().includes(searchText.toLowerCase())
            ).map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.card} 
                activeOpacity={0.7}
                onPress={() => handleCardPress(item)} 
              >
                {/* Gradient Icon Box */}
                <LinearGradient 
                  colors={item.gradientColors as any} 
                  style={styles.cardIconContainer}
                >
                  {renderIcon(item.iconLib, item.icon)}
                </LinearGradient>

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
                
                {!activeTab ? (
                   <Ionicons name="lock-closed-outline" size={18} color="#cbd5e1" />
                ) : (
                   <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={{ height: 100 }} /> 
        </ScrollView>
      </SafeAreaView>

      {/* FLOATING ACTION BUTTON (CART) - MOVED TO RIGHT */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('ProjectSummary', { projectId })}
        activeOpacity={0.8}
      >
        <LinearGradient colors={['#315b76', '#2a4179']} style={styles.fabGradient}>
            <Ionicons name="receipt-outline" size={24} color="#fff" />
            <Text style={styles.fabText}>Estimate</Text>
        </LinearGradient>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  
  // Header
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 15 
  },
  iconButton: { 
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', 
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },

  // Mini Summary Card (Reduced Size)
  miniSummaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0'
  },
  miniSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniSummaryLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  miniSummaryValue: { fontSize: 16, fontWeight: '800', color: '#315b76' },

  // Budget Tiers
  sectionHeader: { marginBottom: 10, marginTop: 5 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  tierContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  tierCard: { 
    flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, 
    borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center'
  },
  tierTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 2 },
  tierSub: { fontSize: 10, color: '#94a3b8' },
  activeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },

  // Search
  searchContainer: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', 
    borderRadius: 14, paddingHorizontal: 15, height: 48, marginBottom: 15, 
    borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#64748b', shadowOpacity: 0.05, shadowRadius: 5 
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b' },

  // Cards
  cardsContainer: { gap: 12 },
  card: { 
    backgroundColor: '#ffffff', borderRadius: 18, padding: 14, 
    flexDirection: 'row', alignItems: 'center', 
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 2, 
    borderWidth: 1, borderColor: '#f8fafc' 
  },
  cardIconContainer: { 
    width: 48, height: 48, borderRadius: 12, 
    justifyContent: 'center', alignItems: 'center', marginRight: 14 
  },
  cardContent: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  cardDesc: { fontSize: 12, color: '#64748B' },

  // FAB - UPDATED POSITION
  fab: {
    position: 'absolute', 
    bottom: 30, 
    right: 20, // Moved to right corner
    borderRadius: 30, 
    elevation: 10,
    shadowColor: '#315b76', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 10,
  },
  fabGradient: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, 
    borderRadius: 30, alignItems: 'center', gap: 8
  },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});