import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Dimensions, Image, ActivityIndicator, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useOpeningsCalculations } from '../hooks/useOpeningsCalculations';
import { db, auth } from '@archlens/shared';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function OpeningsScreen({ route, navigation }: any) {
    const { totalArea = 1000, projectId, tier = 'Standard' } = route.params || {};
    const {
        loading, materials, selections, setSelections,
        estimatedDoors, estimatedWindows, calculation
    } = useOpeningsCalculations({ totalArea, tier });

    const [saving, setSaving] = useState(false);
    const [activeModal, setActiveModal] = useState<'door' | 'window' | null>(null);

    const doorsList = materials.filter(m => m.subCategory === 'Doors');
    const windowsList = materials.filter(m => m.subCategory === 'Windows');

    const handleSave = async () => {
        if (!auth.currentUser) return Alert.alert('Error', 'User not authenticated.');
        if (!selections.door || !selections.window) {
            return Alert.alert('Selection Required', 'Please select both Door and Window materials.');
        }

        setSaving(true);
        try {
            await addDoc(collection(db, 'estimates'), {
                projectId,
                userId: auth.currentUser.uid,
                itemName: 'Doors & Windows',
                category: 'Openings',
                totalCost: calculation.totalCost,
                lineItems: calculation.items,
                area: totalArea,
                tier,
                createdAt: serverTimestamp(),
            });
            Alert.alert('✅ Saved!', 'Openings estimate saved successfully.');
            navigation.navigate('ProjectSummary', { projectId });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#315b76" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color="#315b76" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Openings Setup</Text>
                    <View style={styles.tierBadge}><Text style={styles.tierText}>{tier}</Text></View>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Summary Card */}
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>ESTIMATED COST</Text>
                        <Text style={styles.summaryTotal}>₹{calculation.totalCost.toLocaleString('en-IN')}</Text>
                        <View style={styles.summaryStats}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Doors</Text>
                                <Text style={styles.statValue}>{estimatedDoors} Nos</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Windows</Text>
                                <Text style={styles.statValue}>{estimatedWindows} Nos</Text>
                            </View>
                        </View>
                    </View>

                    {/* Selection Sections */}
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>DOORS</Text>
                        <View style={styles.countBadge}><Text style={styles.countText}>{estimatedDoors} Units</Text></View>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                        {doorsList.map((item: any) => {
                            const isSelected = selections.door?.id === item.id;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.horizontalCard, isSelected && styles.horizontalCardSelected]}
                                    onPress={() => setSelections({ ...selections, door: item })}
                                    activeOpacity={0.7}
                                >
                                    <Image source={{ uri: item.imageUrl }} style={styles.horizontalMaterialImage} />
                                    <View style={styles.horizontalMaterialInfo}>
                                        <Text style={styles.horizontalMaterialName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.horizontalMaterialGrade} numberOfLines={1}>{item.grade || 'Standard'}</Text>
                                        <Text style={styles.horizontalMaterialPrice}>₹{item.pricePerUnit.toLocaleString('en-IN')}</Text>
                                    </View>
                                    {isSelected && (
                                        <View style={styles.selectionIcon}>
                                            <Ionicons name="checkmark-circle" size={18} color="#315b76" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                        <Text style={styles.sectionTitle}>WINDOWS</Text>
                        <View style={styles.countBadge}><Text style={styles.countText}>{estimatedWindows} Units</Text></View>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                        {windowsList.map((item: any) => {
                            const isSelected = selections.window?.id === item.id;
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.horizontalCard, isSelected && styles.horizontalCardSelected]}
                                    onPress={() => setSelections({ ...selections, window: item })}
                                    activeOpacity={0.7}
                                >
                                    <Image source={{ uri: item.imageUrl }} style={styles.horizontalMaterialImage} />
                                    <View style={styles.horizontalMaterialInfo}>
                                        <Text style={styles.horizontalMaterialName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.horizontalMaterialGrade} numberOfLines={1}>{item.grade || 'Standard'}</Text>
                                        <Text style={styles.horizontalMaterialPrice}>₹{item.pricePerUnit.toLocaleString('en-IN')}</Text>
                                    </View>
                                    {isSelected && (
                                        <View style={styles.selectionIcon}>
                                            <Ionicons name="checkmark-circle" size={18} color="#315b76" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={{ height: 120 }} />
                </ScrollView>

                <TouchableOpacity
                    style={[styles.saveBtn, (!selections.door || !selections.window) && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving || !selections.door || !selections.window}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Openings Estimate</Text>}
                </TouchableOpacity>


            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    safeArea: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 15 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', flex: 1 },
    tierBadge: { backgroundColor: '#315b76', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    tierText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    scroll: { padding: 20 },
    summaryCard: { backgroundColor: '#1e293b', borderRadius: 24, padding: 25, marginBottom: 25, elevation: 8 },
    summaryLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    summaryTotal: { color: '#fff', fontSize: 32, fontWeight: '900', marginVertical: 8 },
    summaryStats: { flexDirection: 'row', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },
    statValue: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 },
    statDivider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)' },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: '#64748b', marginBottom: 15, letterSpacing: 0.5 },
    selectionCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
    selectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    selectionTitleContainer: { flex: 1 },
    selectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    selectionSubtitle: { fontSize: 12, color: '#64748b' },
    placeholderText: { marginTop: 15, color: '#94a3b8', fontStyle: 'italic', fontSize: 13 },
    selectedMaterial: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 15, padding: 12, backgroundColor: '#f8fafc', borderRadius: 12 },
    materialThumb: { width: 40, height: 40, borderRadius: 8 },
    materialName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    materialPrice: { fontSize: 12, color: '#10b981', fontWeight: '700' },
    saveBtn: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#315b76', padding: 18, borderRadius: 20, alignItems: 'center', elevation: 5 },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    countBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    countText: { fontSize: 10, fontWeight: '700', color: '#64748b' },

    horizontalScroll: { paddingRight: 20, paddingBottom: 15 },
    horizontalCard: {
        width: width * 0.3,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 8,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        elevation: 0.21,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 2
    },
    horizontalCardSelected: {
        borderColor: '#315b76',
        backgroundColor: '#eff6ff',
        borderWidth: 1.5
    },
    horizontalMaterialImage: {
        width: '100%',
        height: 75,
        borderRadius: 10,
        backgroundColor: '#fff',
        marginBottom: 8,
        resizeMode: 'contain'
    },
    horizontalMaterialInfo: {
        width: '100%',
        alignItems: 'flex-start'
    },
    horizontalMaterialName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b'
    },
    horizontalMaterialPrice: {
        fontSize: 13,
        color: '#10b981',
        fontWeight: '800',
        marginTop: 4
    },
    horizontalMaterialGrade: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2
    },
    selectionIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#fff',
        borderRadius: 10
    },
});
