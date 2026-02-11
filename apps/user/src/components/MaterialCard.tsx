import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MaterialCardProps {
  id: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  pricePerUnit: number;
  currency?: string;
  unit?: string;
  dimension?: string; // e.g., "9x4.25x3"
  category?: string;
  subCategory?: string;
  availability?: 'In Stock' | 'Low Stock' | 'Out of Stock';
  rating?: number;
  reviews?: number;
  discount?: number;
  onPress?: () => void;
  isSelected?: boolean;
  supplier?: string;
  deliveryDays?: number;
}

export const MaterialCard: React.FC<MaterialCardProps> = ({
  id,
  name,
  brand,
  imageUrl,
  pricePerUnit,
  currency = '₹',
  unit = 'Nos',
  dimension,
  category,
  subCategory,
  availability = 'In Stock',
  rating = 0,
  reviews = 0,
  discount = 0,
  onPress,
  isSelected = false,
  supplier,
  deliveryDays,
}) => {
  const [imageLoading, setImageLoading] = React.useState(true);
  const discountedPrice = discount > 0 ? (pricePerUnit * (1 - discount / 100)).toFixed(2) : null;

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Image Container */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
            />
            {imageLoading && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator size="small" color="#315b76" />
              </View>
            )}
          </>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
          </View>
        )}

        {/* Discount Badge */}
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}% OFF</Text>
          </View>
        )}

        {/* Availability Badge */}
        <View
          style={[
            styles.availabilityBadge,
            {
              backgroundColor:
                availability === 'In Stock'
                  ? '#10b981'
                  : availability === 'Low Stock'
                    ? '#f59e0b'
                    : '#ef4444',
            },
          ]}
        >
          <Text style={styles.availabilityText}>{availability}</Text>
        </View>

        {/* Selected Checkmark */}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <View style={styles.checkmark}>
              <Ionicons name="checkmark" size={24} color="#fff" />
            </View>
          </View>
        )}
      </View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Brand & Supplier */}
        {(brand || supplier) && (
          <Text style={styles.brand} numberOfLines={1}>
            {brand || supplier}
          </Text>
        )}

        {/* Material Name */}
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>

        {/* Dimension */}
        {dimension && (
          <View style={styles.dimensionContainer}>
            <Ionicons name="resize-outline" size={12} color="#64748b" />
            <Text style={styles.dimension}>{dimension} inches</Text>
          </View>
        )}

        {/* Price Section */}
        <View style={styles.priceContainer}>
          <View style={styles.priceBox}>
            {discount > 0 ? (
              <>
                <Text style={styles.originalPrice}>{currency} {pricePerUnit.toFixed(2)}</Text>
                <Text style={styles.discountedPrice}>
                  {currency} {discountedPrice}
                </Text>
              </>
            ) : (
              <Text style={styles.price}>
                {currency} {pricePerUnit.toFixed(2)}
              </Text>
            )}
            <Text style={styles.unit}>per {unit}</Text>
          </View>
        </View>

        {/* Rating & Delivery */}
        <View style={styles.footerContainer}>
          {rating > 0 && (
            <View style={styles.ratingBox}>
              <Ionicons name="star" size={12} color="#fbbf24" />
              <Text style={styles.rating}>{rating.toFixed(1)}</Text>
              {reviews > 0 && <Text style={styles.reviews}>({reviews})</Text>}
            </View>
          )}

          {deliveryDays && (
            <View style={styles.deliveryBox}>
              <Ionicons name="flash" size={12} color="#3b82f6" />
              <Text style={styles.delivery}>{deliveryDays}d delivery</Text>
            </View>
          )}
        </View>

        {/* Category Badge */}
        {(category || subCategory) && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {subCategory || category}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: '#10b981',
    shadowOpacity: 0.15,
    elevation: 5,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: '#f8fafc',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  availabilityBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  availabilityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  checkmark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  contentContainer: {
    padding: 12,
  },
  brand: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    lineHeight: 18,
  },
  dimensionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dimension: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 4,
    fontWeight: '500',
  },
  priceContainer: {
    marginBottom: 10,
  },
  priceBox: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  originalPrice: {
    fontSize: 11,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
    marginTop: 2,
  },
  unit: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 3,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rating: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    marginLeft: 3,
  },
  reviews: {
    fontSize: 9,
    color: '#92400e',
    marginLeft: 3,
  },
  deliveryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  delivery: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e40af',
    marginLeft: 3,
  },
  categoryBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4338ca',
  },
});
