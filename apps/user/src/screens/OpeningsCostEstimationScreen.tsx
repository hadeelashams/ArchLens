import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Dimensions, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { db, auth } from '@archlens/shared';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function OpeningsCostEstimationScreen({ route, navigation }: any) {
    const {
        projectId,
        totalArea,
        tier,
        roomsData = [],
        totalCost = 0
    } = route.params || {};

    const [saving, setSaving] = useState(false);

    const materialBreakdown = useMemo(() => {
        const breakdown: any = {
            doors: {},
            windows: {}
        };

        roomsData.forEach((room: any) => {
            if (room.doorMaterial && room.doorCount > 0) {
                const mat = room.doorMaterial;
                if (!breakdown.doors[mat.id]) {
                    breakdown.doors[mat.id] = {
                        name: mat.name,
                        price: mat.pricePerUnit,
                        qty: 0,
                        total: 0,
                        imageUrl: mat.imageUrl,
                        rooms: []
                    };
                }
                breakdown.doors[mat.id].qty += room.doorCount;
                breakdown.doors[mat.id].total += room.doorCount * mat.pricePerUnit;
                breakdown.doors[mat.id].rooms.push({ name: room.name, count: room.doorCount });
            }

            if (room.windowMaterial && room.windowCount > 0) {
                const mat = room.windowMaterial;
                if (!breakdown.windows[mat.id]) {
                    breakdown.windows[mat.id] = {
                        name: mat.name,
                        price: mat.pricePerUnit,
                        qty: 0,
                        total: 0,
                        imageUrl: mat.imageUrl,
                        rooms: []
                    };
                }
                breakdown.windows[mat.id].qty += room.windowCount;
                breakdown.windows[mat.id].total += room.windowCount * mat.pricePerUnit;
                breakdown.windows[mat.id].rooms.push({ name: room.name, count: room.windowCount });
            }
        });


        return breakdown;
    }, [roomsData]);

    const handleSave = async () => {
        console.log('🔘 Save button pressed');
        
        if (!auth.currentUser) {
            console.log('❌ User not authenticated');
            return Alert.alert('Error', 'User not authenticated.');
        }

        console.log('✅ User authenticated:', auth.currentUser.uid);
        setSaving(true);
        
        try {
            console.log('📊 Processing room data...', roomsData);
            
            const roomSelections = Object.fromEntries(
                roomsData.map((r: any) => {
                    const selection: any = {
                        doorCount: r.doorCount || 0,
                        windowCount: r.windowCount || 0,
                    };
                    
                    // Only add material IDs if they exist (avoid undefined values)
                    if (r.doorMaterial?.id) {
                        selection.doorId = r.doorMaterial.id;
                    }
                    if (r.windowMaterial?.id) {
                        selection.windowId = r.windowMaterial.id;
                    }
                    
                    return [r.id, selection];
                })
            );

            const lineItems = roomsData.flatMap((room: any) => [
                ...(room.doorMaterial && room.doorCount > 0 && room.doorMaterial.id ? [{
                    roomId: room.id, 
                    roomName: room.name, 
                    type: 'door',
                    materialId: room.doorMaterial.id,
                    materialName: room.doorMaterial.name, 
                    quantity: room.doorCount,
                    unitPrice: room.doorMaterial.pricePerUnit,
                    total: room.doorMaterial.pricePerUnit * room.doorCount,
                }] : []),
                ...(room.windowMaterial && room.windowCount > 0 && room.windowMaterial.id ? [{
                    roomId: room.id, 
                    roomName: room.name, 
                    type: 'window',
                    materialId: room.windowMaterial.id,
                    materialName: room.windowMaterial.name, 
                    quantity: room.windowCount,
                    unitPrice: room.windowMaterial.pricePerUnit,
                    total: room.windowMaterial.pricePerUnit * room.windowCount,
                }] : []),
            ]);

            console.log('📋 Room selections:', roomSelections);
            console.log('📦 Line items:', lineItems);

            console.log('💾 Saving to Firestore...');
            
            await addDoc(collection(db, 'estimates'), {
                projectId, userId: auth.currentUser.uid,
                itemName: 'Doors & Windows', category: 'Openings',
                totalCost, lineItems, roomSelections,
                area: totalArea, tier, createdAt: serverTimestamp(),
            });
            
            console.log('✅ Successfully saved to Firestore');
            Alert.alert('Saved!', 'Openings estimate saved successfully.');
            
            console.log('🧭 Navigating to ProjectSummary...');
            navigation.navigate('ProjectSummary', { projectId });
        } catch (e: any) {
            console.error('❌ Save error:', e);
            Alert.alert('Error', e.message || 'Failed to save estimate. Please try again.');
        } finally {
            setSaving(false);
            console.log('🏁 Save process completed');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundBtn}>
                        <Ionicons name="arrow-back" size={20} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Openings Estimation</Text>
                    <View style={styles.tierBadge}>
                        <Text style={styles.tierText}>{tier}</Text>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <View>
                                <Text style={styles.summaryLabel}>TOTAL OPENINGS COST</Text>
                                <Text style={styles.summaryTotal}>Rs.{totalCost.toLocaleString('en-IN')}</Text>
                            </View>
                            <View style={styles.methodBadge}>
                                <Text style={styles.methodBadgeText}>Openings</Text>
                            </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.specRow}>
                            <View style={styles.specItem}>
                                <MaterialCommunityIcons name="door" size={14} color="#cbd5e1" />
                                <Text style={styles.specText}>{roomsData.reduce((s: number, r: any) => s + r.doorCount, 0)} Doors</Text>
                            </View>
                            <View style={styles.specItem}>
                                <MaterialCommunityIcons name="window-open-variant" size={14} color="#cbd5e1" />
                                <Text style={styles.specText}>{roomsData.reduce((s: number, r: any) => s + r.windowCount, 0)} Windows</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>MATERIAL BREAKDOWN</Text>



                    {/* Doors Breakdown */}
                    {Object.keys(materialBreakdown.doors).length > 0 && (
                        <View style={styles.categoryContainer}>
                            <View style={styles.categoryHeader}>
                                <MaterialCommunityIcons name="door" size={20} color="#315b76" />
                                <Text style={styles.categoryTitle}>Doors</Text>
                            </View>
                            <View style={styles.table}>
                                {Object.values(materialBreakdown.doors).map((item: any, idx: number) => (
                                    <View key={idx} style={styles.tableRow}>
                                        <View style={{ flex: 2 }}>
                                            <Text style={styles.itemName}>{item.name}</Text>
                                            {item.rooms.map((r: any, rIdx: number) => (
                                                <View key={rIdx} style={styles.roomBadgeRow}>
                                                    <View style={styles.roomDot} />
                                                    <Text style={styles.roomInfoText}>{r.name}: {r.count} Nos</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <View style={{ flex: 1, alignItems: 'center' }}>
                                            <Text style={styles.itemQty}>{item.qty} <Text style={styles.itemUnit}>Nos</Text></Text>
                                        </View>
                                        <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                                            <Text style={styles.itemPrice}>Rs.{item.total.toLocaleString()}</Text>
                                            <Text style={styles.itemRate}>@ Rs.{item.price}/Nos</Text>
                                        </View>
                                    </View>
                                ))}

                            </View>
                        </View>
                    )}

                    {/* Windows Breakdown */}
                    {Object.keys(materialBreakdown.windows).length > 0 && (
                        <View style={styles.categoryContainer}>
                            <View style={styles.categoryHeader}>
                                <MaterialCommunityIcons name="window-open-variant" size={20} color="#315b76" />
                                <Text style={styles.categoryTitle}>Windows</Text>
                            </View>
                            <View style={styles.table}>
                                {Object.values(materialBreakdown.windows).map((item: any, idx: number) => (
                                    <View key={idx} style={styles.tableRow}>
                                        <View style={{ flex: 2 }}>
                                            <Text style={styles.itemName}>{item.name}</Text>
                                            {item.rooms.map((r: any, rIdx: number) => (
                                                <View key={rIdx} style={styles.roomBadgeRow}>
                                                    <View style={styles.roomDot} />
                                                    <Text style={styles.roomInfoText}>{r.name}: {r.count} Nos</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <View style={{ flex: 1, alignItems: 'center' }}>
                                            <Text style={styles.itemQty}>{item.qty} <Text style={styles.itemUnit}>Nos</Text></Text>
                                        </View>
                                        <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                                            <Text style={styles.itemPrice}>Rs.{item.total.toLocaleString()}</Text>
                                            <Text style={styles.itemRate}>@ Rs.{item.price}/Nos</Text>
                                        </View>
                                    </View>
                                ))}

                            </View>
                        </View>
                    )}

                    <View style={styles.disclaimer}>
                        <Ionicons name="information-circle-outline" size={18} color="#0369a1" />
                        <Text style={styles.disclaimerText}>
                            Cost is based on selected materials and counts per room. 2026 market rates applied.
                        </Text>
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>

                <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={() => {
                        console.log('🎯 Save button touch detected');
                        handleSave();
                    }}
                    disabled={saving}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Text style={styles.saveBtnText}>Save Estimation</Text>
                            <Ionicons name="save-outline" size={20} color="#fff" />
                        </>
                    )}
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
    roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    tierText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    scroll: { padding: 20 },
    summaryCard: { backgroundColor: '#1e293b', borderRadius: 24, padding: 25, marginBottom: 25, elevation: 8 },
    summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    summaryLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 5, textTransform: 'uppercase' },
    summaryTotal: { color: '#fff', fontSize: 28, fontWeight: '800' },
    methodBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    methodBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
    specRow: { flexDirection: 'row', justifyContent: 'space-between' },
    specItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    specText: { color: '#cbd5e1', fontSize: 13, fontWeight: '500' },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 15, letterSpacing: 0.5, textTransform: 'uppercase' },
    categoryContainer: { marginBottom: 20 },
    categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    categoryTitle: { fontSize: 14, fontWeight: '700', color: '#315b76' },
    table: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
    tableRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
    itemName: { fontSize: 14, fontWeight: '700', color: '#334155' },
    itemQty: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
    itemUnit: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
    itemPrice: { fontSize: 13, fontWeight: '700', color: '#10b981' },
    itemRate: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
    roomBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    roomDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#94a3b8' },
    roomInfoText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
    disclaimer: { flexDirection: 'row', gap: 10, backgroundColor: '#E0F2FE', padding: 15, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: '#BAE6FD' },


    disclaimerText: { flex: 1, fontSize: 11, color: '#0369a1', lineHeight: 16 },
    saveBtn: { 
        position: 'absolute', 
        bottom: 30, 
        left: width * 0.075, 
        right: width * 0.075,
        width: width * 0.85, 
        backgroundColor: '#315b76', 
        padding: 18, 
        borderRadius: 20, 
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 10, 
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 1000
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
