import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MaterialGrid } from './MaterialGrid';

interface Material {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  pricePerUnit: number;
  currency?: string;
  unit?: string;
  dimensions?: string;
  category?: string;
  subCategory?: string;
  availability?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  rating?: number;
  reviews?: number;
  discount?: number;
  supplier?: string;
  deliveryDays?: number;
  type?: string;
}

interface MaterialSelectionModalProps {
  visible: boolean;
  title: string;
  materials: Material[];
  selectedMaterialId?: string;
  onMaterialSelect: (material: Material) => void;
  onClose: () => void;
  loading?: boolean;
  filterBySubCategory?: string;
  filterByCategory?: string;
  displayMode?: 'grid' | 'list';
  showFilter?: boolean;
}

export const MaterialSelectionModal: React.FC<MaterialSelectionModalProps> = ({
  visible,
  title,
  materials,
  selectedMaterialId,
  onMaterialSelect,
  onClose,
  loading = false,
  filterBySubCategory,
  filterByCategory,
  displayMode = 'list',
  showFilter = true,
}) => {
  const [searchText, setSearchText] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'price-asc' | 'price-desc' | 'rating' | 'newest'>('price-asc');

  const filteredAndSortedMaterials = useMemo(() => {
    let filtered = [...materials];

    // Filter by category
    if (filterByCategory) {
      filtered = filtered.filter((m) => m.category === filterByCategory);
    }

    // Filter by sub-category
    if (filterBySubCategory) {
      filtered = filtered.filter((m) => m.subCategory === filterBySubCategory);
    }

    // Filter by search text
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.brand?.toLowerCase().includes(query) ||
          m.supplier?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
        break;
      case 'rating':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
        // Assuming newer items come first in original order
        break;
    }

    return filtered;
  }, [materials, searchText, sortBy, filterByCategory, filterBySubCategory]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.resultCount}>{filteredAndSortedMaterials.length}</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search materials..."
            placeholderTextColor="#cbd5e1"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter & Sort Controls */}
        {showFilter && (
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {['price-asc', 'price-desc', 'rating', 'newest'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterChip,
                    sortBy === option && styles.filterChipActive,
                  ]}
                  onPress={() => setSortBy(option as any)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      sortBy === option && styles.filterChipTextActive,
                    ]}
                  >
                    {option === 'price-asc'
                      ? '💰 Low to High'
                      : option === 'price-desc'
                        ? '💰 High to Low'
                        : option === 'rating'
                          ? '⭐ Top Rated'
                          : '✨ Newest'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Material Grid/List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#315b76" />
              <Text style={styles.loadingText}>Loading materials...</Text>
            </View>
          ) : filteredAndSortedMaterials.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No materials found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters or search term</Text>
            </View>
          ) : (
            <MaterialGrid
              materials={filteredAndSortedMaterials}
              selectedMaterialId={selectedMaterialId}
              onMaterialSelect={(material) => {
                onMaterialSelect(material);
                onClose();
              }}
              displayMode={displayMode}
            />
          )}
        </ScrollView>

        {/* Footer Info */}
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Ionicons name="information-circle" size={16} color="#3b82f6" />
            <Text style={styles.footerText}>
              {selectedMaterialId
                ? `${filteredAndSortedMaterials.length} materials available`
                : 'Select a material to continue'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

import { TextInput } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginLeft: 12,
  },
  headerRight: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resultCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#315b76',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1e293b',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#315b76',
    borderColor: '#315b76',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8,
    fontWeight: '500',
  },
});
