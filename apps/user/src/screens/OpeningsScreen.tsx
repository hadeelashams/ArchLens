import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Image, ActivityIndicator, Alert, Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useOpeningsCalculations } from '../hooks/useOpeningsCalculations';
import { db, auth } from '@archlens/shared';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function OpeningsScreen({ route, navigation }: any) {
    const { totalArea = 1000, projectId, tier = 'Standard', rooms = [] } = route.params || {};
    const { loading, materials } = useOpeningsCalculations({ totalArea, tier, rooms });

    const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || null);
    const [roomsData, setRoomsData] = useState(
        rooms.map((room: any) => ({
            id: room.id,
            name: room.name,
            doorCount: room.doorCount || 0,
            windowCount: room.windowCount || 0,
            doorMaterial: null,
            windowMaterial: null,
        }))
    );
    const [saving, setSaving] = useState(false);

    const currentRoom = roomsData.find((r: any) => r.id === selectedRoomId);
    const doorsList = materials.filter((m: any) => m.subCategory === 'Doors');
    const windowsList = materials.filter((m: any) => m.subCategory === 'Windows');
    const allComplete = roomsData.every((r: any) =>
        (r.doorCount > 0 ? !!r.doorMaterial : true) &&
        (r.windowCount > 0 ? !!r.windowMaterial : true)
    );

    const totalDoors = roomsData.reduce((sum: number, r: any) => sum + r.doorCount, 0);
    const totalWindows = roomsData.reduce((sum: number, r: any) => sum + r.windowCount, 0);
    const totalCost = roomsData.reduce((sum: number, room: any) => {
        let cost = 0;
        if (room.doorMaterial && room.doorCount > 0) cost += room.doorMaterial.pricePerUnit * room.doorCount;
        if (room.windowMaterial && room.windowCount > 0) cost += room.windowMaterial.pricePerUnit * room.windowCount;
        return sum + cost;
    }, 0);

    const updateRoomData = (field: string, value: any) => {
        setRoomsData((prev: any[]) => {
            const updated = [...prev];
            const idx = updated.findIndex((r: any) => r.id === selectedRoomId);
            if (idx !== -1) updated[idx] = { ...updated[idx], [field]: value };
            return updated;
        });
    };

    const handleSave = async () => {
        if (!auth.currentUser) return Alert.alert('Error', 'User not authenticated.');
        if (!allComplete) return Alert.alert('Incomplete', 'Please complete all room selections.');

        setSaving(true);
        try {
            const roomSelections = Object.fromEntries(
                roomsData.map((r: any) => [r.id, {
                    doorCount: r.doorCount,
                    windowCount: r.windowCount,
                    doorId: r.doorMaterial?.id,
                    windowId: r.windowMaterial?.id,
                }])
            );

            const lineItems = roomsData.flatMap((room: any) => [
                ...(room.doorMaterial && room.doorCount > 0 ? [{
                    roomId: room.id, roomName: room.name, type: 'door',
                    materialName: room.doorMaterial.name, quantity: room.doorCount,
                    unitPrice: room.doorMaterial.pricePerUnit,
                    total: room.doorMaterial.pricePerUnit * room.doorCount,
                }] : []),
                ...(room.windowMaterial && room.windowCount > 0 ? [{
                    roomId: room.id, roomName: room.name, type: 'window',
                    materialName: room.windowMaterial.name, quantity: room.windowCount,
                    unitPrice: room.windowMaterial.pricePerUnit,
                    total: room.windowMaterial.pricePerUnit * room.windowCount,
                }] : []),
            ]);

            await addDoc(collection(db, 'estimates'), {
                projectId, userId: auth.currentUser.uid,
                itemName: 'Doors & Windows', category: 'Openings',
                totalCost, lineItems, roomSelections,
                area: totalArea, tier, createdAt: serverTimestamp(),
            });
            Alert.alert('Saved!', 'Openings estimate saved successfully.');
            navigation.navigate('ProjectSummary', { projectId });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                <ActivityIndicator size="large" color="#315b76" />
            </View>
        );
    }

    const renderMaterialScroll = (
        list: any[],
        selected: any,
        field: 'doorMaterial' | 'windowMaterial',
        accentColor: string
    ) => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.materialScrollContainer}
            style={{ marginTop: 10 }}
        >
            {list.map((material: any) => (
                <TouchableOpacity
                    key={material.id}
                    style={[
                        styles.materialCardCompact,
                        selected?.id === material.id && { backgroundColor: '#eef2f7', borderColor: accentColor, borderWidth: 2 },
                    ]}
                    onPress={() => updateRoomData(field, material)}
                >
                    <Image source={{ uri: material.imageUrl }} style={styles.materialImageCompact} />
                    <Text style={styles.materialNameCompact} numberOfLines={2}>{material.name}</Text>
                    <Text style={styles.materialPriceCompact}>Rs.{material.pricePerUnit}</Text>
                    {selected?.id === material.id && (
                        <Ionicons name="checkmark" size={14} color={accentColor} style={{ marginTop: 4 }} />
                    )}
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color="#315b76" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Openings</Text>
                    <View style={styles.tierBadge}>
                        <Text style={styles.tierText}>{tier}</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    {/* Summary Card */}
                    <View style={styles.summaryCard}>
                        <View style={styles.statItem}>
                            <MaterialCommunityIcons name="door" size={22} color="#f59e0b" />
                            <Text style={styles.statLabel}>Doors</Text>
                            <Text style={styles.statValue}>{totalDoors} Nos</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <MaterialCommunityIcons name="window-open-variant" size={22} color="#3b82f6" />
                            <Text style={styles.statLabel}>Windows</Text>
                            <Text style={styles.statValue}>{totalWindows} Nos</Text>
                        </View>
                    </View>

                    {/* Room Selection Pills */}
                    <Text style={styles.roomsLabel}>SELECT ROOM</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomPillsScroll}>
                        {roomsData.map((room: any) => {
                            const isComplete = (room.doorCount === 0 || !!room.doorMaterial) && (room.windowCount === 0 || !!room.windowMaterial);
                            const isSelected = room.id === selectedRoomId;
                            return (
                                <TouchableOpacity
                                    key={room.id}
                                    style={[styles.roomPill, isSelected && styles.roomPillSelected, isComplete && styles.roomPillComplete]}
                                    onPress={() => setSelectedRoomId(room.id)}
                                >
                                    <Text style={[styles.roomPillText, isSelected && styles.roomPillTextSelected]}>{room.name}</Text>
                                    {isComplete && <Ionicons name="checkmark-circle" size={14} color="#059669" />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Selected Room Details */}
                    {currentRoom && (
                        <View>
                            {/* Doors */}
                            <View style={styles.detailSection}>
                                <View style={styles.sectionRow}>
                                    <View style={styles.detailLabel}>
                                        <MaterialCommunityIcons name="door" size={16} color="#ef4444" />
                                        <Text style={styles.detailLabelText}>Doors</Text>
                                    </View>
                                    <View style={styles.counterRow}>
                                        <TouchableOpacity style={styles.counterBtn} onPress={() => updateRoomData('doorCount', Math.max(0, currentRoom.doorCount - 1))}>
                                            <Text style={styles.counterBtnText}>{'-'}</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.counterValue}>{currentRoom.doorCount}</Text>
                                        <TouchableOpacity style={styles.counterBtn} onPress={() => updateRoomData('doorCount', currentRoom.doorCount + 1)}>
                                            <Text style={styles.counterBtnText}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {currentRoom.doorCount > 0 && renderMaterialScroll(doorsList, currentRoom.doorMaterial, 'doorMaterial', '#315b76')}
                            </View>

                            {/* Windows */}
                            <View style={styles.detailSection}>
                                <View style={styles.sectionRow}>
                                    <View style={styles.detailLabel}>
                                        <MaterialCommunityIcons name="window-open-variant" size={16} color="#3b82f6" />
                                        <Text style={styles.detailLabelText}>Windows</Text>
                                    </View>
                                    <View style={styles.counterRow}>
                                        <TouchableOpacity style={styles.counterBtn} onPress={() => updateRoomData('windowCount', Math.max(0, currentRoom.windowCount - 1))}>
                                            <Text style={styles.counterBtnText}>{'-'}</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.counterValue}>{currentRoom.windowCount}</Text>
                                        <TouchableOpacity style={styles.counterBtn} onPress={() => updateRoomData('windowCount', currentRoom.windowCount + 1)}>
                                            <Text style={styles.counterBtnText}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                {currentRoom.windowCount > 0 && renderMaterialScroll(windowsList, currentRoom.windowMaterial, 'windowMaterial', '#3b82f6')}
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Bottom Bar */}
                <View style={styles.bottomBar}>
                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>ESTIMATED COST</Text>
                        <Text style={styles.costTotal}>Rs.{totalCost.toLocaleString('en-IN')}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.saveBtn, !allComplete && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={saving || !allComplete}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Text style={styles.saveBtnText}>Save</Text>
                                <Ionicons name="checkmark" size={18} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    safeArea: { flex: 1 },

    /* Header */
    header: { flexDirection: 'row', alignItems: 'center', padding: 15, justifyContent: 'space-between' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', flex: 1, marginLeft: 12, textAlign: 'center' },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', elevation: 1 },
    tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tierText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    scroll: { paddingHorizontal: 20, paddingBottom: 20 },

    /* Summary Card */
    summaryCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 15, borderWidth: 1,
        borderColor: '#e2e8f0', padding: 16, marginBottom: 15, marginTop: 4,
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5,
    },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
    statValue: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
    statDivider: { width: 1, height: 50, backgroundColor: '#e2e8f0' },

    /* Room Pills */
    roomsLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', marginBottom: 10, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 },
    roomPillsScroll: { paddingHorizontal: 4, gap: 8, marginBottom: 12 },
    roomPill: {
        paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, minWidth: 90,
    },
    roomPillSelected: { backgroundColor: '#315b76', borderColor: '#315b76' },
    roomPillComplete: { borderColor: '#10b981' },
    roomPillText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    roomPillTextSelected: { color: '#fff' },

    /* Room Detail */
    detailSection: { marginBottom: 14 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    detailLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabelText: { fontSize: 12, fontWeight: '700', color: '#475569' },

    /* Counter */
    counterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    counterBtn: {
        width: 26, height: 26, borderRadius: 6,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1',
        justifyContent: 'center', alignItems: 'center',
    },
    counterBtnText: { fontSize: 16, fontWeight: '600', color: '#475569' },
    counterValue: { fontSize: 13, fontWeight: '700', color: '#1e293b', minWidth: 24, textAlign: 'center' },

    /* Material Scroll */
    materialScrollContainer: { gap: 8 },
    materialCardCompact: {
        alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8,
        backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1,
        borderColor: '#e2e8f0', width: 90,
    },
    materialImageCompact: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#fff', marginBottom: 6 },
    materialNameCompact: { fontSize: 10, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
    materialPriceCompact: { fontSize: 10, fontWeight: '700', color: '#10b981', marginTop: 2, textAlign: 'center' },

    /* Bottom Bar */
    bottomBar: {
        backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0',
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 8,
    },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
    costLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase' },
    costTotal: { fontSize: 20, fontWeight: '900', color: '#1e293b' },

    /* Save Button */
    saveBtn: {
        backgroundColor: '#315b76', padding: 16, borderRadius: 14,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
