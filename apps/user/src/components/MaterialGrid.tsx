import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCard } from './MaterialCard';

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
}

interface MaterialGridProps {
  materials: Material[];
  selectedMaterialId?: string;
  onMaterialSelect?: (material: Material) => void;
  loading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  emptyMessage?: string;
  columns?: number;
  displayMode?: 'grid' | 'list';
}

export const MaterialGrid: React.FC<MaterialGridProps> = ({
  materials,
  selectedMaterialId,
  onMaterialSelect,
  loading = false,
  onRefresh,
  isRefreshing = false,
  emptyMessage = 'No materials available',
  columns = 1,
  displayMode = 'list',
}) => {
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#315b76" />
        <Text style={styles.loadingText}>Loading materials...</Text>
      </View>
    );
  }

  if (materials.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={materials}
      keyExtractor={(item) => item.id}
      numColumns={displayMode === 'grid' ? columns : 1}
      contentContainerStyle={styles.container}
      scrollEnabled={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} /> : undefined}
      renderItem={({ item }) => (
        <View style={displayMode === 'grid' ? styles.gridItem : styles.listItem}>
          <MaterialCard
            id={item.id}
            name={item.name}
            brand={item.brand}
            imageUrl={item.imageUrl}
            pricePerUnit={item.pricePerUnit}
            currency={item.currency}
            unit={item.unit}
            dimension={item.dimensions}
            category={item.category}
            subCategory={item.subCategory}
            availability={item.availability}
            rating={item.rating}
            reviews={item.reviews}
            discount={item.discount}
            supplier={item.supplier}
            deliveryDays={item.deliveryDays}
            isSelected={selectedMaterialId === item.id}
            onPress={() => onMaterialSelect?.(item)}
          />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  gridItem: {
    flex: 1,
    marginHorizontal: 6,
  },
  listItem: {
    width: '100%',
  },
});
