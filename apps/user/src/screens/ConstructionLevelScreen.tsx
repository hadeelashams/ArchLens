import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  Platform,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Data
const COMPONENT_DATA = [
  {
    id: '1',
    title: 'Foundation',
    description: 'Concrete grade M20, steel reinf...',
    icon: 'home', 
    iconLib: 'MaterialIcons',
    gradientColors: ['#4F46E5', '#818cf8'], 
  },
  {
    id: '2',
    title: 'Wall and Masonry',
    description: 'Red clay bricks, cement mortar 1...',
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
    description: 'Internal gypsum, external sand f...',
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
    description: 'Premium emulsion, acrylic exter...',
    icon: 'format-paint', 
    iconLib: 'MaterialIcons',
    gradientColors: ['#10b981', '#34d399'],
  },
];

export default function ConstructionLevelScreen({ route, navigation }: any) {
  const { totalArea } = route.params || { totalArea: 0 };
  const [activeTab, setActiveTab] = useState('Standard');
  const [searchText, setSearchText] = useState('');

  const renderIcon = (lib: string, name: any) => {
    if (lib === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={name} size={24} color="#FFF" />;
    }
    return <MaterialIcons name={name} size={24} color="#FFF" />;
  };

  // --- NEW: Handle Navigation Logic ---
  const handleCardPress = (item: any) => {
    if (item.title === 'Foundation') {
      // Make sure this name matches what you put in App.tsx Stack.Screen
      navigation.navigate('FoundationDetails'); 
    } else {
      // Optional: Alert for other screens not yet built
      // Alert.alert("Coming Soon", `${item.title} screen is under construction.`);
    }
  };

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
          
          <Text style={styles.headerTitle}>Construction Level</Text>
          <View style={{ width: 40 }} /> 
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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

          {/* TABS */}
          <View style={styles.tabContainer}>
            {['Economy', 'Standard', 'Luxury'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabButton, isActive && styles.activeTabButton]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* LIST HEADER */}
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>COMPONENTS</Text>
            {totalArea > 0 && (
              <Text style={styles.areaBadge}>{totalArea} sq.ft</Text>
            )}
          </View>

          {/* COMPONENT CARDS */}
          <View style={styles.cardsContainer}>
            {COMPONENT_DATA.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.card} 
                activeOpacity={0.7}
                // --- ADDED: Link to Foundation Screen ---
                onPress={() => handleCardPress(item)} 
              >
                
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
                
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  scrollContent: { paddingHorizontal: 24 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 15 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 15, height: 52, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b' },

  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 20, padding: 4, height: 50, marginBottom: 20 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  activeTabButton: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#315b76' },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 5 },
  listTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },
  areaBadge: { fontSize: 12, fontWeight: '600', color: '#315b76', backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  cardsContainer: { gap: 10 },

  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 2, borderWidth: 1, borderColor: '#f8fafc' },
  cardIconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardContent: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748B' },
});