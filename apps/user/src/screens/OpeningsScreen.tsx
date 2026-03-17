import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Image, ActivityIndicator, Alert, Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useOpeningsCalculations } from '../hooks/useOpeningsCalculations';
import { db, auth, generateText, extractStructuredData } from '@archlens/shared';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export default function OpeningsScreen({ route, navigation }: any) {
    const { totalArea = 1000, projectId, tier = 'Standard', rooms = [], editEstimateId } = route.params || {};
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
            isRecommended: false,
            aiConfidence: 0,
            aiReasoning: ''
        }))
    );
    const [aiApplied, setAiApplied] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [loadingEstimate, setLoadingEstimate] = useState(!!editEstimateId);
    const fetchedRef = useRef(false);

    useEffect(() => {
        const fetchExistingEstimate = async () => {
            if (editEstimateId && materials.length > 0 && !fetchedRef.current) {
                fetchedRef.current = true;
                try {
                    const docSnap = await getDoc(doc(db, 'estimates', editEstimateId));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        
                        setRoomsData((prev: any) => prev.map((r: any) => {
                            let selDoorId: string | undefined;
                            let selWindowId: string | undefined;
                            let selDoorCount: number | undefined;
                            let selWindowCount: number | undefined;

                            if (data.roomSelections && data.roomSelections[r.id]) {
                                const sel = data.roomSelections[r.id];
                                selDoorId = sel.doorId;
                                selWindowId = sel.windowId;
                                selDoorCount = sel.doorCount;
                                selWindowCount = sel.windowCount;
                            } else if (data.lineItems) {
                                // Fallback for older estimates without roomSelections
                                const dItem = data.lineItems.find((li: any) => li.roomId === r.id && li.type === 'door');
                                const wItem = data.lineItems.find((li: any) => li.roomId === r.id && li.type === 'window');
                                if (dItem) {
                                    selDoorId = dItem.materialId || dItem.id;
                                    selDoorCount = dItem.quantity;
                                }
                                if (wItem) {
                                    selWindowId = wItem.materialId || wItem.id;
                                    selWindowCount = wItem.quantity;
                                }
                            }

                            if (selDoorId || selWindowId || selDoorCount !== undefined || selWindowCount !== undefined) {
                                const doorMat = selDoorId ? materials.find((m: any) => m.id === selDoorId) : undefined;
                                const windowMat = selWindowId ? materials.find((m: any) => m.id === selWindowId) : undefined;
                                
                                return {
                                    ...r,
                                    doorCount: selDoorCount ?? r.doorCount,
                                    windowCount: selWindowCount ?? r.windowCount,
                                    doorMaterial: doorMat || r.doorMaterial,
                                    windowMaterial: windowMat || r.windowMaterial,
                                };
                            }
                            return r;
                        }));
                    }
                } catch (error) {
                    console.error("Error fetching existing estimate:", error);
                } finally {
                    setLoadingEstimate(false);
                }
            } else if (!editEstimateId) {
                setLoadingEstimate(false);
            }
        };
        fetchExistingEstimate();
    }, [editEstimateId, materials.length]);


    // AI-Powered Recommendation System with Batch Processing
    const getBatchAIRecommendations = async (roomsToProcess: any[], budgetTier: string, mats: any[]) => {
        try {
            const doorsList = mats.filter(m => m.subCategory === 'Doors');
            const windowsList = mats.filter(m => m.subCategory === 'Windows');

            const doorCatalog = doorsList.map(m => `ID:${m.id} | ${m.name} | ${m.type} | Grade:${m.grade} | ₹${m.pricePerUnit}/${m.unit}`).join('\n');
            const windowCatalog = windowsList.map(m => `ID:${m.id} | ${m.name} | ${m.type} | Grade:${m.grade} | ₹${m.pricePerUnit}/${m.unit}`).join('\n');

            const roomsDescription = roomsToProcess.map(r => `- ${r.name} (ID: ${r.id}): ${r.doorCount} doors, ${r.windowCount} windows`).join('\n');

            const prompt = `
You are a Senior Civil Engineer specializing in Indian residential construction.
Analyze these rooms and recommend the best door and window materials from the catalog provided.

BUDGET TIER: ${budgetTier}
PROJECT AREA: ${totalArea} sq ft

ROOMS TO ANALYZE:
${roomsDescription}

AVAILABLE DOORS:
${doorCatalog}

AVAILABLE WINDOWS:
${windowCatalog}

For each room, consider its usage (e.g., Bathroom needs moisture-proof UPVC/PVC, Main Entrance needs security, Bedrooms need ventilation/aesthetics). 
For LUXURY tier, ALWAYS prioritize "Teak Wood" or equivalent premium wood for Main Entrance, Bedrooms, and Dressing Area doors.
Stay within the ${budgetTier} tier.

Return ONLY a JSON object in this exact format:
{
  "recommendations": [
    {
      "roomId": "room_id_here",
      "doorMaterialId": "actual_door_id_from_catalog",
      "windowMaterialId": "actual_window_id_from_catalog",
      "confidence": 85,
      "reasoning": "Brief engineering explanation for this specific room"
    }
  ],
  "overallAnalysis": "Brief overall selection strategy"
}`;

            const aiResponse = await generateText(prompt, {
                temperature: 0.4,
                maxOutputTokens: 1500
            });

            // Clean response to handle potential markdown or preamble
            let jsonText = aiResponse.trim();
            if (jsonText.includes('```json')) {
                jsonText = jsonText.split('```json')[1].split('```')[0].trim();
            } else if (jsonText.includes('```')) {
                jsonText = jsonText.split('```')[1].split('```')[0].trim();
            }

            // Fallback: use extractStructuredData if initial parse fails, but try to avoid it
            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (e) {
                console.log('Direct parse failed, trying structured extraction...');
                const structuredData = await extractStructuredData(aiResponse, `{
                    "recommendations": [{"roomId": "string", "doorMaterialId": "string", "windowMaterialId": "string", "confidence": "number", "reasoning": "string"}],
                    "overallAnalysis": "string"
                }`);
                parsed = JSON.parse(structuredData);
            }

            return parsed.recommendations;
        } catch (error) {
            console.warn('Batch AI recommendation failed:', error);
            return null;
        }
    };

    // Fallback rule-based recommendation (backup for AI failures)
    const getFallbackRecommendation = (roomName: string, budgetTier: string, mats: any[]) => {
        const doorsList = mats.filter(m => m.subCategory === 'Doors');
        const windowsList = mats.filter(m => m.subCategory === 'Windows');
        const lowerRoom = roomName.toLowerCase();

        const isBath = lowerRoom.includes('bath') || lowerRoom.includes('toilet');
        const isMain = lowerRoom.includes('living') || lowerRoom.includes('main');

        const door = isBath
            ? doorsList.find(m => m.type?.includes('PVC') || m.type?.includes('UPVC')) || doorsList[0]
            : isMain
                ? doorsList.find(m => m.type?.includes('Main')) || doorsList[0]
                : doorsList[0];

        const window = windowsList[0];

        return {
            door, window,
            doorConfidence: 70, windowConfidence: 70,
            doorReasoning: 'Rule-based selection for room type',
            windowReasoning: 'Standard selection for budget tier',
            contextAnalysis: 'Basic recommendation based on room category'
        };
    };

    const applyRecommendations = async () => {
        if (!materials || materials.length === 0) return;

        setAiLoading(true);

        try {
            const validRooms = roomsData.filter((r: any) => r.doorCount > 0 || r.windowCount > 0);
            const batchResults = await getBatchAIRecommendations(validRooms, tier, materials);

            if (!batchResults) {
                throw new Error('No recommendations returned from AI');
            }

            const doorsList = materials.filter((m: any) => m.subCategory === 'Doors');
            const windowsList = materials.filter((m: any) => m.subCategory === 'Windows');

            const updatedRooms = roomsData.map((room: any) => {
                const recommendation = (batchResults as any[]).find(res => res.roomId === room.id);

                if (recommendation) {
                    return {
                        ...room,
                        doorMaterial: doorsList.find(m => m.id === recommendation.doorMaterialId) || room.doorMaterial || doorsList[0],
                        windowMaterial: windowsList.find(m => m.id === recommendation.windowMaterialId) || room.windowMaterial || windowsList[0],
                        isRecommended: true,
                        aiConfidence: recommendation.confidence || 80,
                        aiReasoning: recommendation.reasoning || 'AI-optimized selection'
                    };
                }
                return room;
            });

            setRoomsData(updatedRooms);
            setAiApplied(true);

            Alert.alert(
                '🤖 AI Recommendations Applied',
                `Smart material selection completed in a single batch for ${validRooms.length} rooms.`,
                [{ text: 'Review Selections', style: 'default' }]
            );
        } catch (error) {
            console.error('AI recommendation error:', error);
            Alert.alert(
                'AI Recommendation Error',
                'Unable to get AI recommendations. Please select materials manually or try again later.',
                [{ text: 'OK' }]
            );
        } finally {
            setAiLoading(false);
        }
    };

    const currentRoom = roomsData.find((r: any) => r.id === selectedRoomId);
    const doorsList = materials.filter((m: any) => m.subCategory === 'Doors');
    const windowsList = materials.filter((m: any) => m.subCategory === 'Windows');
    const allComplete = roomsData.every((r: any) =>
        (r.doorCount > 0 ? !!r.doorMaterial : true) &&
        (r.windowCount > 0 ? !!r.windowMaterial : true)
    );
    const hasAnySelection = roomsData.some((r: any) => r.doorMaterial || r.windowMaterial);

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

    const handleContinue = () => {
        if (!hasAnySelection) return Alert.alert('No Selection', 'Please select at least one door or window material.');

        navigation.navigate('OpeningsCostEstimation', {
            projectId,
            totalArea,
            tier,
            roomsData: roomsData.filter((r: any) => r.doorMaterial || r.windowMaterial),
            totalCost,
            editEstimateId
        });
    };


    const isScreenLoading = loading || loadingEstimate;

    if (isScreenLoading) {
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
        accentColor: string,
        recommendedId?: string
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
                        material.id === recommendedId && { borderColor: '#0ea5e9', borderWidth: 1 }
                    ]}
                    onPress={() => {
                        // Toggle: if already selected, deselect (set to null), otherwise select
                        if (selected?.id === material.id) {
                            updateRoomData(field, null);
                        } else {
                            updateRoomData(field, material);
                        }
                    }}
                >
                    {material.id === recommendedId && (
                        <View style={styles.recommendedBadge}>
                            <Ionicons name="sparkles" size={8} color="#fff" />
                        </View>
                    )}
                    {material.id === recommendedId && currentRoom?.aiConfidence > 0 && (
                        <View style={styles.confidenceBadge}>
                            <Text style={styles.confidenceText}>{currentRoom.aiConfidence}%</Text>
                        </View>
                    )}
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

                    {/* No Rooms Warning */}
                    {roomsData.length === 0 && (
                        <View style={styles.noRoomsWarning}>
                            <Ionicons name="information-circle-outline" size={24} color="#d97706" />
                            <Text style={styles.noRoomsTitle}>No Room Data Available</Text>
                            <Text style={styles.noRoomsText}>
                                Please complete the floor plan upload and wall configuration to see door and window counts for each room.
                            </Text>
                            <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
                                <Text style={styles.goBackText}>Go Back</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Summary Card */}
                    {roomsData.length > 0 && (
                        <>
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

                            {/* AI Recommendation Banner */}
                            <TouchableOpacity
                                style={[styles.aiBanner, aiApplied && styles.aiBannerApplied]}
                                onPress={applyRecommendations}
                                activeOpacity={0.8}
                                disabled={aiLoading}
                            >
                                <View style={styles.aiIconContainer}>
                                    {aiLoading ? (
                                        <ActivityIndicator size={24} color="#315b76" />
                                    ) : (
                                        <MaterialCommunityIcons
                                            name={aiApplied ? "robot-happy" : "robot"}
                                            size={24}
                                            color={aiApplied ? "#059669" : "#315b76"}
                                        />
                                    )}
                                </View>
                                <View style={styles.aiContent}>
                                    <Text style={[styles.aiTitle, aiApplied && styles.aiTitleApplied]}>
                                        {aiLoading
                                            ? "AI Analyzing..."
                                            : aiApplied
                                                ? "AI Recommendation Applied"
                                                : "AI Recommendation"
                                        }
                                    </Text>
                                    <Text style={styles.aiDesc}>
                                        {aiLoading
                                            ? "Processing..."
                                            : aiApplied
                                                ? "Recommendations applied to your selections"
                                                : `Get smart suggestions for your ${tier} plan`}
                                    </Text>
                                </View>
                                {!aiApplied && (
                                    <View style={styles.applyBadge}>
                                        <Text style={styles.applyBadgeText}>APPLY</Text>
                                        <Ionicons name="sparkles" size={12} color="#fff" />
                                    </View>
                                )}
                                {aiApplied && (
                                    <Ionicons name="checkmark-circle" size={20} color="#059669" />
                                )}
                            </TouchableOpacity>

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
                                        {currentRoom.doorCount > 0 && renderMaterialScroll(
                                            doorsList,
                                            currentRoom.doorMaterial,
                                            'doorMaterial',
                                            '#315b76',
                                            (aiApplied && currentRoom.isRecommended) ? currentRoom.doorMaterial?.id : undefined
                                        )}
                                        {currentRoom.doorCount > 0 && currentRoom.isRecommended && currentRoom.aiReasoning && currentRoom.aiReasoning.trim() !== '' && currentRoom.aiConfidence > 0 && (
                                            <>
                                                <View style={styles.aiReasoningCard}>
                                                    <View style={styles.aiReasoningHeader}>
                                                        <Text style={styles.aiReasoningTitle}>AI Recommendations</Text>
                                                        <Text style={styles.aiReasoningConfidence}>{currentRoom.aiConfidence}%</Text>
                                                    </View>
                                                    <Text style={styles.aiReasoningText}>{currentRoom.aiReasoning}</Text>
                                                </View>
                                                <Text style={styles.aiApplyText}>AI recommendation applied</Text>
                                            </>
                                        )}
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
                                        {currentRoom.windowCount > 0 && renderMaterialScroll(
                                            windowsList,
                                            currentRoom.windowMaterial,
                                            'windowMaterial',
                                            '#3b82f6',
                                            (aiApplied && currentRoom.isRecommended) ? currentRoom.windowMaterial?.id : undefined
                                        )}
                                        {currentRoom.windowCount > 0 && currentRoom.isRecommended && currentRoom.aiReasoning && currentRoom.aiReasoning.trim() !== '' && currentRoom.aiConfidence > 0 && (
                                            <>
                                                <View style={styles.aiReasoningCard}>
                                                    <View style={styles.aiReasoningHeader}>
                                                        <Text style={styles.aiReasoningTitle}>AI Recommendations</Text>
                                                        <Text style={styles.aiReasoningConfidence}>{currentRoom.aiConfidence}%</Text>
                                                    </View>
                                                    <Text style={styles.aiReasoningText}>{currentRoom.aiReasoning}</Text>
                                                </View>
                                                <Text style={styles.aiApplyText}>AI recommendation applied</Text>
                                            </>
                                        )}
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>

                {/* Bottom Bar */}
                <View style={styles.bottomBar}>
                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>ESTIMATED COST</Text>
                        <Text style={styles.costTotal}>Rs.{totalCost.toLocaleString('en-IN')}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.saveBtn, !hasAnySelection && styles.saveBtnDisabled]}
                        onPress={handleContinue}
                        disabled={!hasAnySelection}
                    >
                        <Text style={styles.saveBtnText}>View Estimation</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
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

    /* No Rooms Warning */
    noRoomsWarning: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12, marginTop: 40 },
    noRoomsTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
    noRoomsText: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
    goBackBtn: { backgroundColor: '#315b76', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 12 },
    goBackText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    /* Save Button */
    saveBtn: {
        backgroundColor: '#315b76', padding: 16, borderRadius: 14,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    /* AI Recommendation Banner */
    aiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        borderRadius: 16,
        padding: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#bae6fd',
        gap: 12,
    },
    aiBannerApplied: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    aiIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    aiContent: {
        flex: 1,
    },
    aiTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0c4a6e',
    },
    aiTitleApplied: {
        color: '#065f46',
    },
    aiDesc: {
        fontSize: 11,
        color: '#0369a1',
        fontWeight: '500',
    },
    applyBadge: {
        backgroundColor: '#315b76',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    applyBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    recommendedBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#0ea5e9',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
    },
    recommendedBadgeText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '900',
    },

    /* AI Enhancement Styles */
    confidenceBadge: {
        position: 'absolute',
        top: -4,
        left: -4,
        backgroundColor: '#6366f1',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 8,
        zIndex: 10,
        elevation: 2,
    },
    confidenceText: {
        color: '#fff',
        fontSize: 7,
        fontWeight: '800',
    },
    aiReasoningCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    aiReasoningHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    aiReasoningTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6366f1',
        flex: 1,
    },
    aiReasoningConfidence: {
        fontSize: 9,
        fontWeight: '600',
        color: '#10b981',
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    aiReasoningText: {
        fontSize: 11,
        color: '#475569',
        lineHeight: 16,
        fontWeight: '500',
    },
    aiApplyText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6366f1',
        marginTop: 8,
        textAlign: 'center',
    },
});
