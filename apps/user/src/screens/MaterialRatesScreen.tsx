import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  FlatList,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '@archlens/shared';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 3;

// VALIDATED ICONS FOR MATERIAL COMMUNITY ICONS
const CATEGORY_CONFIG: Record<string, { icon: any; colors: [string, string]; label: string }> = {
  Foundation: { icon: 'layers-outline', colors: ['#315b76', '#4a7c9b'], label: 'Foundation' },
  Wall: { icon: 'wall', colors: ['#0891b2', '#1ba0c4'], label: 'Walls' },
  Finishing: { icon: 'format-paint', colors: ['#7c3aed', '#a855f7'], label: 'Finishing' },
  Flooring: { icon: 'view-grid-outline', colors: ['#ea580c', '#c2410c'], label: 'Flooring' },
  Roofing: { icon: 'home-roof', colors: ['#059669', '#10b981'], label: 'Roofing' },
};

export default function MaterialRatesScreen({ navigation }: any) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'price-low' | 'price-high' | 'name'>('name');

  useEffect(() => {
    const q = query(collection(db, 'materials'));
    const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMaterials(data);
        setLoading(false);
      }, (error) => {
        console.error('Error fetching materials:', error);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Memoized filtering logic for performance
  const filteredData = useMemo(() => {
    let result = [...materials];

    if (selectedCategory) {
      result = result.filter((m) => m.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => 
        m.name?.toLowerCase().includes(q) || 
        m.category?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const priceA = Number(a.pricePerUnit) || 0;
      const priceB = Number(b.pricePerUnit) || 0;
      if (sortBy === 'price-low') return priceA - priceB;
      if (sortBy === 'price-high') return priceB - priceA;
      return (a.name || '').localeCompare(b.name || '');
    });

    return result;
  }, [materials, selectedCategory, searchQuery, sortBy]);

  const MaterialCard = ({ item }: { item: any }) => {
    const config = CATEGORY_CONFIG[item.category] || { icon: 'package-variant', colors: ['#64748b', '#94a3b8'] };
    const [imageError, setImageError] = useState(false);

    return (
      <TouchableOpacity activeOpacity={0.9} style={styles.materialCard}>
        {/* IMAGE OR ICON HEADER */}
        <View style={styles.cardHeader}>
          {item.imageUrl && !imageError ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.cardImage}
              onError={() => setImageError(true)}
            />
          ) : (
            <LinearGradient colors={config.colors} style={styles.iconFallback}>
              <MaterialCommunityIcons name={config.icon} size={24} color="#fff" />
            </LinearGradient>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.catLabel}>{item.category || 'General'}</Text>
          <Text style={styles.matName} numberOfLines={2}>{item.name}</Text>
          
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceValue}>₹{Number(item.pricePerUnit).toLocaleString()}</Text>
              <Text style={styles.unitText}>per {item.unit || 'unit'}</Text>
            </View>
            <View style={styles.infoCircle}>
              <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.headerExtension}>
      {/* SEARCH */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search materials (e.g. Cement)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        )}
      </View>

      {/* CATEGORY TABS */}
      <FlatList
        horizontal
        data={Object.entries(CATEGORY_CONFIG)}
        keyExtractor={([key]) => key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item: [key, config] }) => (
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === key && styles.activeChip]}
            onPress={() => setSelectedCategory(selectedCategory === key ? null : key)}
          >
            <MaterialCommunityIcons 
                name={config.icon} 
                size={16} 
                color={selectedCategory === key ? '#fff' : '#315b76'} 
            />
            <Text style={[styles.categoryText, selectedCategory === key && styles.activeTabText]}>
              {config.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* SORT TOOLS */}
      <View style={styles.sortTool}>
        <Text style={styles.resultsCount}>{filteredData.length} items found</Text>
        <View style={styles.sortButtons}>
          <TouchableOpacity 
            style={[styles.sortBtn, sortBy === 'name' && styles.activeSort]} 
            onPress={() => setSortBy('name')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'name' && styles.activeSortText]}>A-Z</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sortBtn, sortBy === 'price-low' && styles.activeSort]} 
            onPress={() => setSortBy('price-low')}
          >
            <Ionicons name="trending-up" size={14} color={sortBy === 'price-low' ? '#fff' : '#64748b'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* NAV BAR */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Market Rates</Text>
          <TouchableOpacity style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color="#315b76" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#315b76" />
            <Text style={styles.loaderText}>Updating daily rates...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id}
            numColumns={3}
            ListHeaderComponent={ListHeader}
            renderItem={({ item }) => <MaterialCard item={item} />}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.scrollPadding}
            ListEmptyComponent={
                <View style={styles.emptyBox}>
                    <Ionicons name="search-outline" size={64} color="#e2e8f0" />
                    <Text style={styles.emptyTitle}>No materials found</Text>
                    <Text style={styles.emptySub}>Try a different search or category</Text>
                </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  navTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  refreshBtn: { padding: 8 },
  
  headerExtension: { paddingHorizontal: 16, marginTop: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, color: '#1e293b' },
  
  categoryList: { paddingVertical: 16, gap: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeChip: { backgroundColor: '#315b76', borderColor: '#315b76' },
  categoryText: { marginLeft: 8, fontSize: 13, fontWeight: '600', color: '#315b76' },
  activeTabText: { color: '#fff' },

  sortTool: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultsCount: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  sortButtons: { flexDirection: 'row', gap: 8 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  activeSort: { backgroundColor: '#315b76', borderColor: '#315b76' },
  sortBtnText: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },
  activeSortText: { color: '#fff' },

  scrollPadding: { paddingBottom: 40 },
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 12, gap: 8 },
  
  materialCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: { 
    height: 65, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  iconFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { padding: 8 },
  catLabel: { fontSize: 8, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 },
  matName: { fontSize: 12, fontWeight: 'bold', color: '#1e293b', marginTop: 2, height: 28 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  priceValue: { fontSize: 14, fontWeight: '800', color: '#059669' },
  unitText: { fontSize: 8, color: '#94a3b8', fontWeight: '600' },
  infoCircle: { marginBottom: 2 },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loaderText: { marginTop: 16, color: '#64748b', fontSize: 14, fontWeight: '500' },

  emptyBox: { marginTop: 80, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
});