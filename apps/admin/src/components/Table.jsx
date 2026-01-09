import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList } from 'react-native';

/**
 * Reusable Table Component for React Native
 * Displays data in rows and columns with actions
 */
export default function Table({
  columns,
  data,
  onEdit,
  onDelete,
  loading = false,
  emptyMessage = 'No data available',
}) {
  if (loading) {
    return <Text style={styles.loading}>Loading...</Text>;
  }

  if (!data || data.length === 0) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.table}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          {columns.map((col) => (
            <Text key={col.key} style={[styles.headerCell, { flex: col.width || 1 }]}>
              {col.label}
            </Text>
          ))}
          {(onEdit || onDelete) && <Text style={styles.headerCell}>Actions</Text>}
        </View>

        {/* Data Rows */}
        {data.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {columns.map((col) => (
              <Text key={col.key} style={[styles.cell, { flex: col.width || 1 }]}>
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </Text>
            ))}
            {(onEdit || onDelete) && (
              <View style={styles.actions}>
                {onEdit && (
                  <TouchableOpacity onPress={() => onEdit(row)} style={styles.actionBtn}>
                    <Text style={styles.actionText}>✏️</Text>
                  </TouchableOpacity>
                )}
                {onDelete && (
                  <TouchableOpacity onPress={() => onDelete(row)} style={styles.actionBtn}>
                    <Text style={styles.actionText}>🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 8, marginBottom: 20 },
  table: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  headerRow: { flexDirection: 'row', backgroundColor: '#f5f5f5', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: '#ddd' },
  headerCell: { fontSize: 14, fontWeight: '600', color: '#333' },
  row: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cell: { fontSize: 14, color: '#555' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 4 },
  actionText: { fontSize: 16 },
  loading: { padding: 40, textAlign: 'center', color: '#999' },
  empty: { padding: 40, textAlign: 'center', color: '#999' }
});
